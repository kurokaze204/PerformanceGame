import type { ActiveEventV2, CompanyV2, GameSessionV2 } from '../types/gameV2.ts';
import type { DomainScoreMap, EventCard, EventType, KnowledgeDomain, SimulationConfig, Site } from '../types/game.ts';

const DOMAINS: KnowledgeDomain[] = ['engineering', 'hr', 'marketing', 'operations', 'finance'];

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

function pickProgressionCard(type:EventType, moveNumber:number, fallback:EventCard):EventCard {
  if (moveNumber <= 2) return cloneCard(pick(EARLY_CARDS.filter(c=>c.type===type)));
  if (moveNumber >= 5 && Math.random() < 0.65) return cloneCard(pick(HIGH_STAKES_CARDS.filter(c=>c.type===type)));
  return cloneCard(fallback);
}

export function progressEventCard(fallback:EventCard, moveNumber:number, config:SimulationConfig):EventCard {
  const card=pickProgressionCard(fallback.type,moveNumber,fallback);
  const valueFactor=Math.pow(config.event_value_growth_factor,Math.max(0,moveNumber-1));
  const startingMultiplier=moveNumber<=2?1:config.event_initial_impact_multiplier;
  card.impact=Math.max(5,Math.round(card.impact*startingMultiplier*valueFactor));
  card.domains=card.domains.map(req=>({
    ...req,
    difficulty:Math.max(1,Math.round(req.difficulty+(moveNumber-1)*config.event_difficulty_growth_per_move)),
  }));
  const tier=moveNumber<=2?'LEARNING':moveNumber<=4?'MATERIAL':moveNumber<=6?'HIGH STAKES':'CRITICAL';
  card.title=`${tier}: ${card.title}`;
  card.description=`${card.description} This is move ${moveNumber}; the financial stakes and knowledge difficulty are deliberately higher as the game progresses.`;
  return card;
}

function chooseSite(company:CompanyV2):Site|undefined {
  const active=company.sites.filter(s=>!s.isClosed);
  return active.length?pick(active):undefined;
}

export function applyProgressionToCurrentEvents(session:GameSessionV2, company:CompanyV2):void {
  const events=session.activeEvents[company.id]||[];
  const firstMove=Math.max(1,company.eventsDrawnCount-events.length+1);
  events.forEach((event,index)=>{
    const moveNumber=firstMove+index;
    event.card=progressEventCard(event.card,moveNumber,session.config);
    if(event.card.scope==='local'){
      if(!event.targetSiteId||!company.sites.some(s=>s.id===event.targetSiteId&&!s.isClosed)) event.targetSiteId=chooseSite(company)?.id;
    } else event.targetSiteId=undefined;
    const allocations:any={};
    event.card.domains.forEach(req=>{allocations[req.domain]=event.allocations?.[req.domain]||{}});
    event.allocations=allocations;
  });
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
  for(const site of company.sites){
    diversifyMap(site.teamCapability);
    diversifyMap(site.codifiedKnowledge);
  }
  diversifyMap(company.intranet);
}
