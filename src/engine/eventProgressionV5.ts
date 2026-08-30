import type { CompanyV2, ExperienceMode, GameSessionV2 } from '../types/gameV2.ts';
import type { DomainScoreMap, EventCard, EventType, KnowledgeDomain, SimulationConfig, Site } from '../types/game.ts';

const DOMAINS: KnowledgeDomain[] = ['engineering', 'hr', 'marketing', 'operations', 'finance'];
export const PROGRAMMED_FAILURE_TAG = 'tutorial-programmed-failure';

const EARLY_CARDS: EventCard[] = [
  { id:'LEARN-P-OPS', type:'problem', scope:'local', title:'Late Dispatch at a Local Site', description:'A routine scheduling mistake has delayed several customer deliveries. The financial exposure is small, making this a safe chance to learn how local knowledge affects a response.', domains:[{domain:'operations',difficulty:2}], impact:18, tags:['learning','routine','operations'] },
  { id:'LEARN-P-HR', type:'problem', scope:'local', title:'Unexpected Shift Absence', description:'Several people call in sick before a busy shift. Supervisors need to reorganise coverage without disrupting normal production.', domains:[{domain:'hr',difficulty:2}], impact:16, tags:['learning','routine','hr'] },
  { id:'LEARN-P-FIN', type:'problem', scope:'local', title:'Supplier Invoice Dispute', description:'A supplier disputes a small batch of invoices. The issue is contained, but resolving it quickly avoids unnecessary local cash-flow friction.', domains:[{domain:'finance',difficulty:2}], impact:20, tags:['learning','routine','finance'] },
  { id:'LEARN-P-ENG', type:'problem', scope:'local', title:'Minor Equipment Calibration Drift', description:'A production instrument is producing inconsistent readings. The site can keep operating, but local technical knowledge will determine how quickly the fault is corrected.', domains:[{domain:'engineering',difficulty:2}], impact:22, tags:['learning','routine','engineering'] },
  { id:'LEARN-O-MKT', type:'opportunity', scope:'local', title:'Small Regional Customer Enquiry', description:'A local customer asks whether the site can handle a modest additional order. It is a low-risk opportunity to practise matching knowledge to a commercial decision.', domains:[{domain:'marketing',difficulty:2}], impact:18, tags:['learning','routine','marketing'] },
  { id:'LEARN-O-OPS', type:'opportunity', scope:'local', title:'Simple Process Improvement', description:'Operators identify a straightforward change to staging and handover that could save time each week with little implementation risk.', domains:[{domain:'operations',difficulty:2}], impact:20, tags:['learning','routine','operations'] },
  { id:'LEARN-O-HR', type:'opportunity', scope:'local', title:'Local Cross-Skilling Offer', description:'A nearby training provider offers a subsidised short course that could improve workforce flexibility at one site.', domains:[{domain:'hr',difficulty:2}], impact:16, tags:['learning','routine','hr'] },
  { id:'LEARN-O-FIN', type:'opportunity', scope:'local', title:'Early-Payment Discount', description:'A supplier offers a modest discount for changing payment timing. It is useful, but not important enough to threaten the business if declined.', domains:[{domain:'finance',difficulty:2}], impact:17, tags:['learning','routine','finance'] },
];

const HIGH_STAKES_CARDS: EventCard[] = [
  { id:'ESC-P-OPS', type:'problem', scope:'local', title:'Major Site Production Shutdown', description:'A cascading production failure stops the site during a peak delivery period. Failure to restore operations quickly could wipe out a large share of the site’s annual turnover.', domains:[{domain:'operations',difficulty:6},{domain:'engineering',difficulty:5}], impact:26, tags:['escalation','site-threatening','operations','engineering'] },
  { id:'ESC-P-HR', type:'problem', scope:'enterprise', title:'Coordinated Workforce Exit', description:'A cluster of experienced supervisors and specialists signal they will leave across several sites. The immediate disruption is significant and the knowledge loss could compound future failures.', domains:[{domain:'hr',difficulty:6},{domain:'operations',difficulty:5}], impact:27, tags:['escalation','workforce','enterprise'] },
  { id:'ESC-P-FIN', type:'problem', scope:'enterprise', title:'Major Customer Insolvency', description:'One of the company’s largest customers enters administration with substantial unpaid invoices. The exposure is large enough to threaten investment capacity across the business.', domains:[{domain:'finance',difficulty:7},{domain:'marketing',difficulty:5}], impact:29, tags:['escalation','finance','enterprise'] },
  { id:'ESC-P-ENG', type:'problem', scope:'local', title:'Safety-Critical Engineering Failure', description:'A serious equipment defect forces an immediate shutdown and external scrutiny. The site faces a material loss if the organisation cannot diagnose and contain the failure quickly.', domains:[{domain:'engineering',difficulty:7},{domain:'operations',difficulty:6},{domain:'hr',difficulty:4}], impact:31, tags:['escalation','safety','site-threatening'] },
  { id:'ESC-O-MKT', type:'opportunity', scope:'enterprise', title:'National Strategic Customer Contract', description:'A major customer offers a multi-site contract that would materially change company revenue. Winning it requires confidence that the organisation can deliver at scale.', domains:[{domain:'marketing',difficulty:6},{domain:'operations',difficulty:6}], impact:28, tags:['escalation','growth','enterprise'] },
  { id:'ESC-O-ENG', type:'opportunity', scope:'local', title:'High-Value Technical Tender', description:'A large specialist tender arrives with a short response window. It is worth a substantial percentage of the target site’s turnover but demands credible technical capability.', domains:[{domain:'engineering',difficulty:7},{domain:'finance',difficulty:5}], impact:30, tags:['escalation','tender','engineering'] },
  { id:'ESC-O-OPS', type:'opportunity', scope:'enterprise', title:'National Distribution Partnership', description:'A national partner offers to make the company its preferred supplier. The upside is transformational, but only if operations can support the promised service level.', domains:[{domain:'operations',difficulty:7},{domain:'marketing',difficulty:5},{domain:'finance',difficulty:4}], impact:32, tags:['escalation','partnership','enterprise'] },
  { id:'ESC-O-HR', type:'opportunity', scope:'enterprise', title:'Acquisition of a Specialist Team', description:'A respected specialist team becomes available after a competitor restructures. Acquiring and integrating them could rapidly increase capability, but the opportunity is expensive and time-sensitive.', domains:[{domain:'hr',difficulty:6},{domain:'finance',difficulty:5}], impact:27, tags:['escalation','talent','enterprise'] },
];

function pick<T>(items:T[]):T { return items[Math.floor(Math.random()*items.length)]; }
function cloneCard(card:EventCard):EventCard { return { ...card, domains: card.domains.map(d=>({...d})), tags:[...card.tags] }; }
function openingDomains(mode:ExperienceMode):KnowledgeDomain[] { return mode==='newbie'?DOMAINS.filter(domain=>domain!=='finance'):DOMAINS; }
function siteKnowledge(site:Site,domain:KnowledgeDomain,mode:ExperienceMode):number { return mode==='newbie'?(site.teamCapability[domain]||0):Math.max(site.teamCapability[domain]||0,site.codifiedKnowledge[domain]||0); }

export interface OpeningKnowledgeGap {
  domain: KnowledgeDomain;
  targetSite: Site;
  sourceSite: Site;
  targetScore: number;
  sourceScore: number;
}

/**
 * The opening challenge must visually and mathematically make sense: the target
 * site cannot already be strong in the tested domain. Prefer an existing local
 * score of 0–1. If random setup produced no such gap, deliberately create one
 * in the weakest site/domain pair so the learning event is never a 100% walkover.
 */
export function findOpeningKnowledgeGap(company:CompanyV2,mode:ExperienceMode='newbie'):OpeningKnowledgeGap {
  const sites=company.sites.filter(site=>!site.isClosed);
  const domains=openingDomains(mode);
  let best:OpeningKnowledgeGap|undefined;
  for(const domain of domains){
    for(const targetSite of sites){
      const targetScore=siteKnowledge(targetSite,domain,mode);
      if(targetScore>1)continue;
      for(const sourceSite of sites){
        if(sourceSite.id===targetSite.id)continue;
        const sourceScore=siteKnowledge(sourceSite,domain,mode);
        if(sourceScore<=targetScore)continue;
        const candidate={domain,targetSite,sourceSite,targetScore,sourceScore};
        if(!best || sourceScore-targetScore>best.sourceScore-best.targetScore)best=candidate;
      }
    }
  }
  if(best)return best;

  // No naturally weak target was generated. Choose the weakest site/domain pair,
  // make that opening weakness explicit, then select the strongest other site as
  // the knowledge source. This is part of the tutorial setup, not a mid-game nerf.
  let weakest={domain:domains[0],site:sites[0],score:Number.POSITIVE_INFINITY};
  for(const domain of domains)for(const site of sites){const score=siteKnowledge(site,domain,mode);if(score<weakest.score)weakest={domain,site,score};}
  weakest.site.teamCapability[weakest.domain]=Math.min(1,weakest.site.teamCapability[weakest.domain]||1);
  if(mode==='expert')weakest.site.codifiedKnowledge[weakest.domain]=Math.min(1,weakest.site.codifiedKnowledge[weakest.domain]||1);
  const others=sites.filter(site=>site.id!==weakest.site.id);
  let source=others.sort((a,b)=>siteKnowledge(b,weakest.domain,mode)-siteKnowledge(a,weakest.domain,mode))[0]||weakest.site;
  if(source.id!==weakest.site.id&&siteKnowledge(source,weakest.domain,mode)<=1)source.teamCapability[weakest.domain]=3;
  return {domain:weakest.domain,targetSite:weakest.site,sourceSite:source,targetScore:siteKnowledge(weakest.site,weakest.domain,mode),sourceScore:siteKnowledge(source,weakest.domain,mode)};
}

export function buildProgrammedOpeningFailure(company:CompanyV2,mode:ExperienceMode='newbie'):{card:EventCard;targetSiteId:string;gap:OpeningKnowledgeGap} {
  const gap=findOpeningKnowledgeGap(company,mode);
  const domainLabel=gap.domain==='hr'?'Human Resources':gap.domain[0].toUpperCase()+gap.domain.slice(1);
  const card:EventCard={
    id:`TUTORIAL-ISOLATED-${gap.domain.toUpperCase()}`,
    type:'problem',
    scope:'local',
    title:'LEARNING: A Problem Another Site Knows How to Solve',
    description:`${gap.targetSite.name} faces a contained ${domainLabel.toLowerCase()} problem. This opening challenge deliberately tests only knowledge the site can reach today. Elsewhere in the company, ${gap.sourceSite.name} already has stronger ${domainLabel} knowledge — but that knowledge is not yet available here through the Corporate Intranet.`,
    domains:[{domain:gap.domain,difficulty:99}],
    impact:18,
    tags:[PROGRAMMED_FAILURE_TAG,'learning','knowledge-isolation',`tutorial-domain:${gap.domain}`,`tutorial-source:${gap.sourceSite.id}`,`tutorial-target:${gap.targetSite.id}`],
  };
  return {card,targetSiteId:gap.targetSite.id,gap};
}

function pressureMove(moveNumber:number, config:SimulationConfig, experienceMode:ExperienceMode='newbie'):number {
  if(experienceMode!=='expert') return moveNumber;
  const movesPerStep=Math.max(1,Math.round(config.event_expert_moves_per_pressure_step ?? 6));
  return 1+Math.floor(Math.max(0,moveNumber-1)/movesPerStep);
}

function pickProgressionCard(type:EventType, pressureNumber:number, fallback:EventCard):EventCard {
  if (pressureNumber <= 2) return cloneCard(pick(EARLY_CARDS.filter(c=>c.type===type)));
  if (pressureNumber >= 5 && Math.random() < 0.65) return cloneCard(pick(HIGH_STAKES_CARDS.filter(c=>c.type===type)));
  return cloneCard(fallback);
}

export function progressEventCard(fallback:EventCard, moveNumber:number, config:SimulationConfig, experienceMode:ExperienceMode='newbie'):EventCard {
  const pressureNumber=pressureMove(moveNumber,config,experienceMode);
  const card=pickProgressionCard(fallback.type,pressureNumber,fallback);
  const growth=config.event_value_growth_factor ?? 1.4;
  const difficultyGrowth=config.event_difficulty_growth_per_move ?? 0.28;
  const difficultyCap=config.event_difficulty_cap ?? 9;
  const initialMultiplier=config.event_initial_impact_multiplier ?? 0.12;
  const valueFactor=Math.pow(growth,Math.max(0,pressureNumber-1));
  const isLearning=card.tags.includes('learning');
  const isEscalation=card.tags.includes('escalation');
  const startingMultiplier=(isLearning||isEscalation)?1:initialMultiplier;
  card.impact=Math.max(5,Math.round(card.impact*startingMultiplier*valueFactor));
  card.domains=card.domains.map(req=>({ ...req, difficulty:Math.min(difficultyCap,Math.max(1,Math.round(req.difficulty+(pressureNumber-1)*difficultyGrowth))) }));
  const tier=pressureNumber<=2?'LEARNING':pressureNumber<=4?'MATERIAL':pressureNumber<=6?'HIGH STAKES':'CRITICAL';
  card.title=`${tier}: ${card.title.replace(/^(LEARNING|MATERIAL|HIGH STAKES|CRITICAL):\s*/,'')}`;
  card.description=`${card.description} This is move ${moveNumber}; the financial stakes and knowledge difficulty increase as the simulation develops.`;
  return card;
}

export function capProgressedEventImpact(card:EventCard, company:CompanyV2, targetSiteId:string|undefined, config:SimulationConfig):EventCard {
  const ratio=Math.max(0.05,config.event_impact_cap_ratio ?? 0.35);
  const site=targetSiteId?company.sites.find(s=>s.id===targetSiteId&&!s.isClosed):undefined;
  const scopeTurnover=card.scope==='local'&&site?Math.max(1,site.turnover):Math.max(1,company.turnover);
  return {...card,impact:Math.max(5,Math.min(card.impact,Math.round(scopeTurnover*ratio)))};
}

function chooseSite(company:CompanyV2):Site|undefined { const active=company.sites.filter(s=>!s.isClosed); return active.length?pick(active):undefined; }

export function applyProgressionToCurrentEvents(session:GameSessionV2, company:CompanyV2):void {
  const events=session.activeEvents[company.id]||[];
  const firstMove=Math.max(1,company.eventsDrawnCount-events.length+1);
  events.forEach((event,index)=>{
    const moveNumber=firstMove+index;
    if(session.round===1&&moveNumber===1){
      const tutorial=buildProgrammedOpeningFailure(company,session.experienceMode);
      event.card=tutorial.card;
      event.targetSiteId=tutorial.targetSiteId;
    } else {
      event.card=progressEventCard(event.card,moveNumber,session.config,session.experienceMode);
      if(event.card.scope==='local'){
        if(!event.targetSiteId||!company.sites.some(s=>s.id===event.targetSiteId&&!s.isClosed)) event.targetSiteId=chooseSite(company)?.id;
      } else event.targetSiteId=undefined;
      event.card=capProgressedEventImpact(event.card,company,event.targetSiteId,session.config);
    }
    const allocations:any={};
    event.card.domains.forEach(req=>{allocations[req.domain]=event.allocations?.[req.domain]||{}});
    event.allocations=allocations;
  });

  if(session.round===1&&firstMove===1){
    company.problemEventsDrawn=events.filter(event=>event.card.type==='problem').length;
    company.opportunityEventsDrawn=events.filter(event=>event.card.type==='opportunity').length;
    company.eventsDrawnCount=events.length;
  }
}

function diversifyMap(map:DomainScoreMap):void {
  const values=DOMAINS.map(domain=>({domain,value:map[domain]}));
  const max=Math.max(...values.map(x=>x.value));
  const min=Math.min(...values.map(x=>x.value));
  const high=pick(values.filter(x=>x.value===max)).domain;
  const lowCandidates=values.filter(x=>x.value===min&&x.domain!==high);
  const low=pick(lowCandidates.length?lowCandidates:values.filter(x=>x.value===min)).domain;
  map[high]+=2;
  map[low]=Math.max(0,map[low]-1);
}

export function diversifyInitialKnowledge(company:CompanyV2):void {
  for(const site of company.sites){ diversifyMap(site.teamCapability); diversifyMap(site.codifiedKnowledge); }
  diversifyMap(company.intranet);
}
