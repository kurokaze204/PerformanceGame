import type { CompanyV2, GameSessionV2 } from '../types/gameV2.ts';
import type { ExpertV2 } from '../types/gameV2.ts';
import type { KnowledgeDomain } from '../types/game.ts';
import type {
  KMWeekChallenge,
  KMWeekCompanyState,
  KMWeekGoal,
  KMWeekGoalId,
  KMWeekInvestment,
  KMWeekScore,
  KMWeekShockCheck,
} from '../types/kmWeek.ts';

export const KM_WEEK_DOMAINS: KnowledgeDomain[] = ['operations','hr','marketing'];
export const KM_WEEK_SITE_IDS = ['melbourne','brisbane','perth'] as const;
// Knowledge levels grow with the escalating Challenges; only Score Pad points are capped.
// Six is a Deep Bench goal milestone, NOT a limit on expert learning.
export const KM_WEEK_DEEP_BENCH_TARGET = 6;
export const KM_WEEK_AAR_COST = 50;
export const KM_WEEK_AAR_UNLOCK_ROUND = 7;

export function kmWeekAARCandidatesV1(company:CompanyV2):KMWeekChallenge[]{
 const state=company.kmWeek;
 if(!state||state.stage!=='free'||state.phase!=='invest'||company.round<KM_WEEK_AAR_UNLOCK_ROUND)return [];
 const reviewed=new Set(state.investmentHistory.filter(item=>item.type==='AFTER_ACTION_REVIEW').map(item=>item.challengeId));
 const opportunities=state.pressureDomain&&state.lastPressureFailure
  ?[...state.challenges,state.lastPressureFailure]:state.challenges;
 return opportunities.filter((item,index)=>item.difficulty>=5
  &&(state.pressureDomain?item.domain===state.pressureDomain&&item.status==='failure':item.status!=='open')
  &&!reviewed.has(item.id)&&opportunities.findIndex(other=>other.id===item.id)===index);
}

export const KM_WEEK_SHOCK_WINDOW_SECONDS = 180;
export const KM_WEEK_SHOCK_GAP_COST = 40; // $40k per documented non-conformity knowledge point (fine)

export const KM_WEEK_SHOCK_SPECS:{id:string;siteId:string;domain:KnowledgeDomain;difficulty:number}[]=[
  {id:'S1',siteId:'brisbane',domain:'operations',difficulty:4},
  {id:'S2',siteId:'perth',domain:'operations',difficulty:3},
  {id:'S3',siteId:'melbourne',domain:'hr',difficulty:4},
  {id:'S4',siteId:'brisbane',domain:'marketing',difficulty:3},
  {id:'S5',siteId:'perth',domain:'marketing',difficulty:4},
];
export const KM_WEEK_SHOCK_CUTOFF=Math.max(...KM_WEEK_SHOCK_SPECS.map(check=>check.difficulty));

export function kmWeekRiskOddsV1(localKnowledge:number,difficulty:number){
  // Risk is based on the remaining performance gap, but a shortfall must still
  // carry genuine uncertainty. A one-point gap therefore needs 2+ on a d6
  // (83%), two points need 3+ (67%), and so on.
  const performanceGap=Math.max(0,difficulty-localKnowledge);
  const requiredRoll=performanceGap===0?1:performanceGap+1;
  const successfulFaces=requiredRoll>6?0:Math.max(0,Math.min(6,7-requiredRoll));
  return{
    performanceGap,
    requiredRoll,
    successfulFaces,
    chancePercent:Math.round((successfulFaces/6)*100),
  };
}

export const KM_WEEK_GOALS: Record<KMWeekGoalId, KMWeekGoal> = {
  'local-heroes': {
    id:'local-heroes',
    title:'Local Heroes',
    description:'Solve at least 5 free-play Challenges using local team capability only.',
    points:5,
  },
  'deep-bench': {
    id:'deep-bench',
    title:'Deep Bench',
    description:'Finish with all three specialists at Knowledge 6 or higher.',
    points:5,
  },
  'broad-base': {
    id:'broad-base',
    title:'Broad Base',
    description:'Finish with at least 4 site/domain capabilities at Knowledge 2 or higher.',
    points:5,
  },
  'balanced-network': {
    id:'balanced-network',
    title:'No Weak Site',
    description:'Finish with every site totalling at least 3 knowledge and one site totalling at least 4.',
    points:5,
  },
};

type KMWeekFreeDomain='operations'|'hr'|'marketing';
type KMWeekFreeValue={id:string;domain:KMWeekFreeDomain;difficulty:number;impact:number};
type KMWeekEventDescription={id:string;title:string;story:string};

// Six business-pressure patterns repeat, but their order is independently
// shuffled for each company at the start of every six-round cycle.
const FREE_ROUND_VALUES:KMWeekFreeValue[][]=[
  [
    // The first full round is a manageable introduction before the pressure builds.
    {id:'HR2',domain:'hr',difficulty:2,impact:30},
    {id:'MKT3INTRO',domain:'marketing',difficulty:3,impact:45},
  ],
  [
    {id:'HR3B',domain:'hr',difficulty:3,impact:45},
    {id:'MKT4A',domain:'marketing',difficulty:4,impact:60},
  ],
  [
    {id:'MKT4B',domain:'marketing',difficulty:4,impact:60},
    {id:'OPS8',domain:'operations',difficulty:8,impact:120},
  ],
  [
    {id:'OPS6',domain:'operations',difficulty:6,impact:90},
    {id:'OPS4A',domain:'operations',difficulty:4,impact:60},
  ],
  [
    {id:'MKT5A',domain:'marketing',difficulty:5,impact:75},
    {id:'OPS4B',domain:'operations',difficulty:4,impact:60},
  ],
  [
    {id:'MKT6',domain:'marketing',difficulty:6,impact:90},
    {id:'MKT5B',domain:'marketing',difficulty:5,impact:75},
  ],
];
const FREE_CYCLE_DIFFICULTY_TOTAL=FREE_ROUND_VALUES.flat().reduce((sum,card)=>sum+card.difficulty,0);

// Eighteen story cards: six per knowledge domain. Only twelve are drawn in a
// normal six-round cycle, so companies see different stories as well as a
// different order of pressure patterns.
const FREE_EVENT_DESCRIPTIONS:Record<KMWeekFreeDomain,KMWeekEventDescription[]>={
  hr:[
    {id:'HR-A',title:'Weekend supervisor shortage',story:'Two {site} shift supervisors call in sick before a high-volume weekend run. Coverage must be reorganised without breaching fatigue limits.'},
    {id:'HR-B',title:'Seasonal hiring backlog',story:'The {site} seasonal intake is behind schedule and several critical roles remain unfilled days before demand peaks.'},
    {id:'HR-C',title:'Roster compliance dispute',story:'Employees at {site} challenge a new overtime roster, claiming fatigue and allowance rules have been applied inconsistently.'},
    {id:'HR-D',title:'Safety-critical vacancy',story:'A safety-critical supervisor at {site} leaves at short notice and the team must redesign coverage without breaching competency requirements.'},
    {id:'HR-E',title:'Industrial relations briefing',story:'Managers at {site} need an urgent workforce briefing after a policy change, but the usual HR specialist is unavailable.'},
    {id:'HR-F',title:'Competency sign-off gap',story:'An audit at {site} finds several people performing higher-risk work without current competency sign-off. Operations must continue while the gap is resolved.'},
  ],
  marketing:[
    {id:'MKT-A',title:'Competitor launch response',story:'A competitor launches a discounted product into {site}’s strongest customer segment and several key accounts ask for an immediate response.'},
    {id:'MKT-B',title:'Major account renewal at risk',story:'A long-standing {site} customer questions recent service levels and is reconsidering its annual contract.'},
    {id:'MKT-C',title:'Distributor escalation',story:'A distributor supporting {site} threatens to pause orders after receiving conflicting product and delivery advice from different parts of the company.'},
    {id:'MKT-D',title:'Recall communications',story:'A product issue requires {site} to contact customers quickly with accurate advice before rumours spread through the market.'},
    {id:'MKT-E',title:'Tender response deadline',story:'A major customer gives {site} one day to answer a complex tender clarification that could decide whether the company stays on the shortlist.'},
    {id:'MKT-F',title:'Pricing commitment dispute',story:'A customer at {site} produces an earlier pricing commitment that conflicts with the current offer. The account team needs a defensible response today.'},
  ],
  operations:[
    {id:'OPS-A',title:'Maintenance backlog',story:'The {site} maintenance backlog has grown to the point that it is starting to constrain output and increase operational risk.'},
    {id:'OPS-B',title:'Supplier changeover error',story:'A supplier substitution reaches {site} production without the expected process notes, and operators are seeing inconsistent setup results.'},
    {id:'OPS-C',title:'Safety interlock investigation',story:'A repeated interlock trip stops {site} production. The team must diagnose whether the fault is instrumentation, setup or process-related before restarting safely.'},
    {id:'OPS-D',title:'Cold-storage sensor failure',story:'The {site} team loses trusted temperature readings during a high-volume run and must decide how to keep production safe and moving.'},
    {id:'OPS-E',title:'Batch traceability issue',story:'A traceability mismatch at {site} means the team cannot immediately confirm which production settings were used for a customer batch awaiting release.'},
    {id:'OPS-F',title:'Shift handover breakdown',story:'Incomplete maintenance and dispatch notes leave the incoming {site} shift unable to safely release several urgent customer orders.'},
  ],
};

// Chosen once per random workshop ID, stable across reloads and company joins.
function kmWeekPressureDomainV1(sessionSeed:string):KMWeekFreeDomain{
 return KM_WEEK_DOMAINS[seededHash(sessionSeed+'|kmw3-pressure')%KM_WEEK_DOMAINS.length] as KMWeekFreeDomain;
}
function guidedDomainRotation(domain:KnowledgeDomain):[KnowledgeDomain,KnowledgeDomain,KnowledgeDomain]{
 const start=KM_WEEK_DOMAINS.indexOf(domain);
 return [0,1,2].map(offset=>KM_WEEK_DOMAINS[(start+offset)%3]) as [KnowledgeDomain,KnowledgeDomain,KnowledgeDomain];
}
function seededHash(text:string){
  let hash=2166136261;
  for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,16777619);}
  return hash>>>0;
}

function seededShuffle<T>(items:readonly T[],seedText:string):T[]{
  const result=[...items];
  let seed=seededHash(seedText)||1;
  const random=()=>{
    seed+=0x6D2B79F5;
    let value=seed;
    value=Math.imul(value^(value>>>15),value|1);
    value^=value+Math.imul(value^(value>>>7),value|61);
    return((value^(value>>>14))>>>0)/4294967296;
  };
  for(let i=result.length-1;i>0;i--){
    const j=Math.floor(random()*(i+1));
    [result[i],result[j]]=[result[j],result[i]];
  }
  return result;
}

const KM_WEEK_REPLACEMENT_NAMES:Record<KMWeekFreeDomain,string[]>={
  operations:['Alex Nguyen','Samira Khan','Daniel Cho','Riley Morgan'],
  hr:['Elena Morris','Aisha Rahman','Jordan Lee','Tom Bennett'],
  marketing:['Sofia Bennett','Maya Singh','Lucas Chen','Amelia Brooks'],
};

function primaryKMWeekSkill(expert:ExpertV2){
  return expert.domains.find(skill=>KM_WEEK_DOMAINS.includes(skill.domain));
}

function retireHighestScoringExpert(session:GameSessionV2,company:CompanyV2){
  const state=company.kmWeek;
  if(!state||state.expertRetirement)return;
  const ranked=activeExperts(company)
    .map(expert=>({expert,skill:primaryKMWeekSkill(expert)}))
    .filter((item):item is {expert:ExpertV2;skill:{domain:KnowledgeDomain;score:number}}=>Boolean(item.skill))
    .sort((a,b)=>b.skill.score-a.skill.score||a.expert.name.localeCompare(b.expert.name));
  const selected=ranked[0];
  if(!selected)return;
  const domain=selected.skill.domain as KMWeekFreeDomain;
  const names=KM_WEEK_REPLACEMENT_NAMES[domain];
  const replacementName=names[seededHash(`${session.id}|${company.id}|${domain}|replacement`)%names.length];
  selected.expert.isVacant=true;
  selected.expert.state='Available';
  selected.expert.replacementDueRound=state.freeRound+1;
  selected.expert.replacementName=replacementName;
  if(!company.retiredExpertNames.includes(selected.expert.name))company.retiredExpertNames.push(selected.expert.name);
  state.expertRetirement={
    expertId:selected.expert.id,
    domain:selected.skill.domain,
    retiredName:selected.expert.name,
    retiredScore:selected.skill.score,
    retiredAtRound:state.freeRound,
    replacementRound:state.freeRound+1,
    replacementName,
    status:'retired',
  };
}

function hireRetiredExpertReplacement(company:CompanyV2){
  const state=company.kmWeek;
  const retirement=state?.expertRetirement;
  if(!state||!retirement||retirement.status!=='retired'||state.freeRound<retirement.replacementRound)return;
  const expert=company.experts.find(item=>item.id===retirement.expertId);
  if(!expert)return;
  const skill=expert.domains.find(item=>item.domain===retirement.domain);
  if(!skill)return;
  const siteScores=activeSites(company).map(site=>site.teamCapability[retirement.domain]||0);
  // AAR lessons recorded while this specialist was retired are handed to the
  // replacement, rather than lost when the vacancy is filled.
  const replacementScore=Math.max(3,...siteScores)+(retirement.pendingAARUplift||0);
  expert.name=retirement.replacementName;
  skill.score=replacementScore;
  expert.isVacant=false;
  expert.state='Available';
  expert.replacementDueRound=null;
  expert.replacementName=null;
  retirement.replacementScore=skill.score;
  retirement.status='replaced';
}

/** Preserve expert deployment, local solving/training, and knowledge transfer
 * irrespective of which domain is the workshop's recurring constraint.
 */
function guidedChallenge(company:CompanyV2,turn:number,pressure=company.kmWeek?.pressureDomain||'operations'):KMWeekChallenge{
 const sites=activeSites(company);
 const [focus,second,third]=guidedDomainRotation(pressure);
 const choose=(domain:KnowledgeDomain,filter:(score:number,site:CompanyV2['sites'][number])=>boolean,preferred:string)=>{
  const candidates=sites.filter(site=>filter(site.teamCapability[domain]||0,site));
  return candidates.find(site=>site.id===preferred)||candidates[0]||sites[0];
 };
 const example=(domain:KnowledgeDomain,index:number,site:CompanyV2['sites'][number])=>{
  const description=FREE_EVENT_DESCRIPTIONS[domain as KMWeekFreeDomain][index];
  return {title:description.title,story:description.story.split('{site}').join(site.name)};
 };
 if(turn===1){
  const expert=activeExperts(company).find(item=>item.domains.some(skill=>skill.domain===focus));
  const site=choose(focus,(score,item)=>score>0&&item.id!==expert?.location,'brisbane');
  const narrative=focus==='operations'
   ?{title:'Packaging line shutdown',story:`A conveyor-control fault has stopped ${site.name}’s packaging line during a customer production run. Dispatch will miss today’s cut-off unless the line is restarted quickly.`}
   :example(focus,focus==='hr'?0:1,site);
  return {id:'G1',...narrative,siteId:site.id,domain:focus,difficulty:4,impact:30,status:'open',guided:true};
 }
 if(turn===2){
  const site=choose(second,score=>score>=1,'melbourne');
  const narrative=second==='hr'
   ?{title:'Roster coverage dispute',story:`A last-minute ${site.name} staffing change raises concerns about shift coverage and fatigue limits. The local team needs to put a compliant roster in place before work begins.`}
   :example(second,5,site);
  return {id:'G2',...narrative,siteId:site.id,domain:second,difficulty:1,impact:30,status:'open',guided:true};
 }
 const site=choose(third,score=>score<=1,'perth');
 const narrative=third==='marketing'
  ?{title:'Distributor escalation',story:`A distributor in ${site.name} threatens to suspend urgent customer deliveries after receiving conflicting product and service advice. The team needs a clear, consistent response today.`}
  :example(third,third==='operations'?0:3,site);
 return {id:'G3',...narrative,siteId:site.id,domain:third,difficulty:4,impact:35,status:'open',guided:true};
}

/** Guided-investment recommendations follow the knowledge each team actually has. */
export function kmWeekGuidedTrainingSiteV1(company:CompanyV2):string{
 const focus=company.kmWeek?.pressureDomain||'operations';
 const expert=activeExperts(company).find(item=>item.domains.some(skill=>skill.domain===focus));
 const sites=activeSites(company).filter(site=>site.id!==expert?.location);
 return [...sites].sort((a,b)=>(a.teamCapability[focus]||0)-(b.teamCapability[focus]||0)||a.id.localeCompare(b.id))[0]?.id||activeSites(company)[0]?.id||'brisbane';
}
export function kmWeekGuidedTransferV1(company:CompanyV2):{domain:KnowledgeDomain;sourceSiteId:string;targetSiteId:string}{
 // Transfer uses the second lesson's domain, independent of the expert-training lesson.
 const domain=guidedDomainRotation(company.kmWeek?.pressureDomain||'operations')[1];
 const sites=[...activeSites(company)].sort((a,b)=>a.id.localeCompare(b.id));
 const source=[...sites].sort((a,b)=>(b.teamCapability[domain]||0)-(a.teamCapability[domain]||0))[0];
 const target=[...sites].sort((a,b)=>(a.teamCapability[domain]||0)-(b.teamCapability[domain]||0))[0];
 return {domain,sourceSiteId:source?.id||'melbourne',targetSiteId:target?.id||'perth'};
}

function cloneChallenges(items:KMWeekChallenge[]):KMWeekChallenge[]{
  return items.map(item=>({...item}));
}

export function freeChallengesForRound(session:GameSessionV2,company:CompanyV2,round:number):KMWeekChallenge[]{
  const safeRound=Math.max(1,round);
  const cycle=Math.floor((safeRound-1)/FREE_ROUND_VALUES.length);
  const position=(safeRound-1)%FREE_ROUND_VALUES.length;
  const seedBase=`${session.id}|${company.id}|cycle:${cycle}`;
  // Keep the first full-play round approachable. Shuffle the five tougher
  // pairs independently for every company and six-round cycle.
  const pressure=company.kmWeek?.pressureDomain;
  // Place the five highest original requirements and one paired 4 in a
  // recurring domain; preserve two same-domain rounds and all cash impacts.
  // In-progress legacy games retain their existing profiles.
  const alternatives=KM_WEEK_DOMAINS.filter(domain=>domain!==pressure);
  const profiles=pressure?FREE_ROUND_VALUES.map(pair=>pair.map(value=>({
    ...value,
    domain:(value.difficulty>=5||value.id==='OPS4A'
      ?pressure
      :value.domain==='marketing'?alternatives[1]:alternatives[0]) as KMWeekFreeDomain,
  }))):FREE_ROUND_VALUES;
  const shuffledProfiles=[profiles[0],...seededShuffle(profiles.slice(1),`${seedBase}|profiles`)];
  const profile=shuffledProfiles[position];

  const descriptionPools={
    hr:seededShuffle(FREE_EVENT_DESCRIPTIONS.hr,`${seedBase}|stories:hr`),
    marketing:seededShuffle(FREE_EVENT_DESCRIPTIONS.marketing,`${seedBase}|stories:marketing`),
    operations:seededShuffle(FREE_EVENT_DESCRIPTIONS.operations,`${seedBase}|stories:operations`),
  };

  // Work out how many descriptions from each domain have already been consumed
  // earlier in this six-round cycle so no story repeats within the cycle.
  const usedBefore:Record<KMWeekFreeDomain,number>={hr:0,marketing:0,operations:0};
  for(const prior of shuffledProfiles.slice(0,position)){
    for(const card of prior)usedBefore[card.domain]+=1;
  }

  const sites=seededShuffle(KM_WEEK_SITE_IDS,`${seedBase}|sites:${position}`);
  const usedThisRound:Record<KMWeekFreeDomain,number>={hr:0,marketing:0,operations:0};

  return profile.map((value,index)=>{
    const storyIndex=usedBefore[value.domain]+usedThisRound[value.domain]++;
    const description=descriptionPools[value.domain][storyIndex%descriptionPools[value.domain].length];
    const siteId=sites[index%sites.length];
    const site=company.sites.find(item=>item.id===siteId);
    const siteLabel=site?.name||siteId;
    return{
      id:`F-C${cycle+1}-R${safeRound}-${value.id}-${description.id}-${siteId}`,
      title:description.title,
      story:description.story.split('{site}').join(siteLabel),
      siteId,
      domain:value.domain,
      // Knowledge requirements rise by one each time the six-pattern
      // challenge deck cycles (Rounds 1-6 base, 7-12 +1, 13-18 +2, etc).
      // Keep the existing monetary impacts unchanged.
      difficulty:value.difficulty+cycle,
      impact:value.impact,
      status:'open',
    };
  });
}

function kmWeekSecondsRemaining(session:GameSessionV2){
  if(session.timerEndsAt)return Math.max(0,Math.ceil((new Date(session.timerEndsAt).getTime()-Date.now())/1000));
  if(typeof session.timerPausedSecondsRemaining==='number')return Math.max(0,session.timerPausedSecondsRemaining);
  return Math.max(0,(session.gameDurationMinutes||30)*60);
}

function kmWeekShockWindowOpen(session:GameSessionV2){
  return kmWeekSecondsRemaining(session)<=KM_WEEK_SHOCK_WINDOW_SECONDS;
}

function enterSiteAudits(company:CompanyV2,message='The final three minutes have begun. Site Audits are starting.'){
  const state=company.kmWeek!;
  state.stage='shock';
  state.phase='challenge';
  state.challenges=[];
  state.usedExpertIds=[];
  state.shockChecks=[];
  state.shockResolved=false;
  company.round=Math.max(company.round,3+state.freeRound)+1;
  company.roundPhase='risk';
  state.lastMessage=message;
}

function hashGoal(sessionId:string):KMWeekGoalId{
  const ids=Object.keys(KM_WEEK_GOALS) as KMWeekGoalId[];
  let hash=0;
  for(const char of sessionId)hash=(hash*31+char.charCodeAt(0))>>>0;
  return ids[hash%ids.length];
}

function emptyScore():KMWeekScore{
  return {business:0,expertise:0,localCapability:0,knowledgeFlow:0,resilience:0,goal:0,turnover:0,total:0};
}

function activeSites(company:CompanyV2){
  return KM_WEEK_SITE_IDS.map(id=>company.sites.find(site=>site.id===id)).filter((site):site is CompanyV2['sites'][number]=>Boolean(site));
}

function activeExperts(company:CompanyV2){
  return company.experts.filter(expert=>!expert.isVacant&&expert.domains.some(skill=>KM_WEEK_DOMAINS.includes(skill.domain)));
}

// An investment selection may outlive an expert: Retirement happens as the
// final Challenge is resolved, before Invest is displayed. Never leave the
// client pointing at a vacant specialist or silently ignore the Commit button.
export function kmWeekAvailableInvestmentExpertV1(company:CompanyV2,preferredId:string,domain:KnowledgeDomain):ExpertV2|undefined{
  const available=activeExperts(company);
  return available.find(expert=>expert.id===preferredId)
    ||available.find(expert=>expert.domains.some(skill=>skill.domain===domain))
    ||available[0];
}

function applyStartingBoard(company:CompanyV2,sessionSeed:string){
  for(const site of company.sites){
    site.isClosed=!KM_WEEK_SITE_IDS.includes(site.id as any);
    for(const domain of ['engineering','hr','marketing','operations','finance'] as KnowledgeDomain[]){
      site.teamCapability[domain]=0;
      site.codifiedKnowledge[domain]=0;
    }
  }
  // One per-session seed creates a fair starting distribution for every
  // company, while different workshops see different knowledge gaps.
  for(const domain of KM_WEEK_DOMAINS){
    const allocation=seededShuffle([2,1,0],`${sessionSeed}|km-week-start|${domain}`);
    for(let index=0;index<KM_WEEK_SITE_IDS.length;index++){
      const site=company.sites.find(item=>item.id===KM_WEEK_SITE_IDS[index]);
      if(site)site.teamCapability[domain]=allocation[index];
    }
  }
  const turnoverBySite:Record<string,number>={melbourne:300,brisbane:290,perth:285};
  for(const site of company.sites)if(site.id in turnoverBySite)site.turnover=turnoverBySite[site.id];
  company.turnover=875;
  company.startingTurnover=875;
  for(const domain of ['engineering','hr','marketing','operations','finance'] as KnowledgeDomain[]){
    company.intranet[domain]=0;
    company.intranetRoundGrowth[domain]=0;
  }
  company.automatedDomains=[];
  company.horizonScanDomain=null;
  company.horizonScanUsedThisRound=false;
  const id=company.id;
  // Two specialists start at depth 5, the other at depth 4. The assignment is
  // shared by every company in the session, not randomly advantaged per CEO.
  const levelFiveDomains=new Set(seededShuffle(KM_WEEK_DOMAINS,`${sessionSeed}|km-week-experts`).slice(0,2));
  const level=(domain:KnowledgeDomain)=>levelFiveDomains.has(domain)?5:4;
  const experts:ExpertV2[]=[
    {id:`kmw-${id}-ops`,name:'Priya Patel',domains:[{domain:'operations',score:level('operations')}],location:'melbourne',homeLocation:'melbourne',state:'Available',isSPOF:true,spofDomains:['operations'],isVacant:false,replacementDueRound:null,replacementName:null},
    {id:`kmw-${id}-hr`,name:'Marcus Sterling',domains:[{domain:'hr',score:level('hr')}],location:'brisbane',homeLocation:'brisbane',state:'Available',isSPOF:true,spofDomains:['hr'],isVacant:false,replacementDueRound:null,replacementName:null},
    {id:`kmw-${id}-marketing`,name:'Mary Jackson',domains:[{domain:'marketing',score:level('marketing')}],location:'perth',homeLocation:'perth',state:'Available',isSPOF:true,spofDomains:['marketing'],isVacant:false,replacementDueRound:null,replacementName:null},
  ];
  company.experts=experts;
  company.strategicInvestmentFund=0;
  company.actionsRemaining=1;
}

export function initialiseKMWeekCompanyV1(company:CompanyV2,sessionSeed='KM_WEEK_DEFAULT'){
  const pressureDomain=kmWeekPressureDomainV1(sessionSeed);
  applyStartingBoard(company,sessionSeed);
  company.round=1;
  company.roundPhase='events';
  company.kmWeek={
    stage:'guided',
    phase:'challenge',
    guidedTurn:1,
    freeRound:0,
    pressureDomain,
    challenges:[guidedChallenge(company,1,pressureDomain)],
    usedExpertIds:[],
    freeSuccesses:0,
    businessDifficultySolved:0,
    localSuccesses:0,
    expertSuccesses:0,
    riskSuccesses:0,
    knowledgeTransfers:0,
    meaningfulTransfers:0,
    investmentHistory:[],
    turnoverHistory:[{label:'START',turnover:company.turnover}],
    shockChecks:[],
    shockResolved:false,
    score:emptyScore(),
    lastMessage:'Start with the business problem in front of you.',
  };
  company.initialRiverSnapshot={
    sites:structuredClone(company.sites),
    experts:structuredClone(company.experts),
  };
}

export function initialiseKMWeekSessionV1(session:GameSessionV2){
  session.kmWeekGoalId=hashGoal(session.id);
  session.gameDurationMinutes=30;
  session.finalWindowMinutes=3;
  session.isFinalDisruptionActive=false;
  session.finalDisruptionResolved=false;
  session.riskResults=null;
  for(const company of session.companies){
    initialiseKMWeekCompanyV1(company,session.id);
    session.activeEvents[company.id]=[];
    syncScore(session,company);
  }
}

/** Older in-flight workshop sessions may have been created before the
 * shared seed was deployed, and subsequently receive new companies after
 * deployment. Only untouched Guided 1 boards can be safely reconciled.
 */
function kmWeekUnplayedOpening(company:CompanyV2):boolean{
 const state=company.kmWeek;
 return Boolean(state&&state.stage==='guided'&&state.phase==='challenge'
  &&state.guidedTurn===1&&state.freeRound===0
  &&state.challenges.length===1&&state.challenges[0].status==='open'
  &&state.investmentHistory?.length===0
  &&state.turnoverHistory?.length===1&&state.turnoverHistory[0]?.label==='START'
  &&company.turnover===company.startingTurnover);
}

function kmWeekMatchesSessionOpening(company:CompanyV2,sessionId:string):boolean{
 const reference=structuredClone(company);
 applyStartingBoard(reference,sessionId);
 const matchesSites=(sites:CompanyV2['sites'])=>KM_WEEK_SITE_IDS.every(id=>{
  const actual=sites.find(site=>site.id===id),expected=reference.sites.find(site=>site.id===id);
  return Boolean(actual&&expected&&KM_WEEK_DOMAINS.every(domain=>
   (actual.teamCapability[domain]||0)===(expected.teamCapability[domain]||0)));
 });
 const matchesExperts=(experts:ExpertV2[])=>reference.experts.every(expected=>{
  const actual=experts.find(expert=>expert.id===expected.id);
  return Boolean(actual&&!actual.isVacant&&actual.location===expected.location
   &&expected.domains.every(skill=>actual.domains.some(item=>item.domain===skill.domain&&item.score===skill.score)));
 })&&experts.length===reference.experts.length;
 const guided=guidedChallenge(reference,1,company.kmWeek?.pressureDomain||'operations');
 return matchesSites(company.sites)&&matchesExperts(company.experts)
  &&Boolean(company.initialRiverSnapshot
   &&matchesSites(company.initialRiverSnapshot.sites)
   &&matchesExperts(company.initialRiverSnapshot.experts))
  &&company.kmWeek?.challenges[0]?.siteId===guided.siteId
  &&company.kmWeek?.challenges[0]?.domain===guided.domain
  &&company.startingTurnover===875;
}

export function ensureKMWeekSessionV1(session:GameSessionV2):boolean{
  if(session.experienceMode!=='km_week')return false;
  let changed=false;
  // KM Week is time-boxed for facilitation, not hard-stopped. Once the clock
  // reaches zero, freeze it at 0:00 and let the company finish its current game.
  if(session.timerEndsAt&&new Date(session.timerEndsAt).getTime()<=Date.now()){
    session.timerEndsAt=null;
    session.timerPausedSecondsRemaining=0;
    changed=true;
  }
  if(!session.kmWeekGoalId){session.kmWeekGoalId=hashGoal(session.id);changed=true;}
  if(session.finalWindowMinutes!==3){session.finalWindowMinutes=3;changed=true;}
  for(const company of session.companies){
    if(!company.kmWeek){
      initialiseKMWeekCompanyV1(company,session.id);
      session.activeEvents[company.id]=[];
      changed=true;
    }else if(kmWeekUnplayedOpening(company)&&!kmWeekMatchesSessionOpening(company,session.id)){
      // Restore equality only before the player has acted. Never rewrite
      // companies already progressing through the guided/free rounds.
      initialiseKMWeekCompanyV1(company,session.id);
      session.activeEvents[company.id]=[];
      changed=true;
    }else{
      if(!company.kmWeek.turnoverHistory){company.kmWeek.turnoverHistory=[{label:'CURRENT',turnover:company.turnover}];changed=true;}
      if(company.kmWeek.businessDifficultySolved===undefined){company.kmWeek.businessDifficultySolved=company.kmWeek.freeSuccesses*3;changed=true;}
    }
  }
  // Starting points are earned from the baseline knowledge, not from turns.
  // Refresh every company's stored Score Pad, including late joins and any
  // competitors whose finishing position has changed since the last action.
  for(const company of session.companies){
    const previous=JSON.stringify(company.kmWeek?.score);
    syncScore(session,company);
    if(previous!==JSON.stringify(company.kmWeek?.score))changed=true;
  }
  return changed;
}

export function kmWeekGoalV1(session:GameSessionV2):KMWeekGoal{
  return KM_WEEK_GOALS[session.kmWeekGoalId||hashGoal(session.id)];
}

function localCapabilityPoints(company:CompanyV2){
  // Reward the actual strength of the local River, not only threshold crossings.
  // Two local knowledge levels = 1 point, capped at the existing 9-point score box.
  const total=activeSites(company).reduce((sum,site)=>sum+KM_WEEK_DOMAINS.reduce((siteSum,domain)=>siteSum+(site.teamCapability[domain]||0),0),0);
  return Math.min(9,Math.floor(total/2));
}

function expertisePoints(company:CompanyV2){
  // More than six points of expertise still helps solve tougher Challenges,
  // but does not overflow the Score Pad's 6-point Expertise category.
  return Math.min(6,activeExperts(company).reduce((sum,expert)=>{
    const skill=expert.domains.find(item=>KM_WEEK_DOMAINS.includes(item.domain));
    return sum+Math.max(0,(skill?.score||0)-3);
  },0));
}

function goalAchieved(session:GameSessionV2,company:CompanyV2){
  const state=company.kmWeek!;
  const goal=session.kmWeekGoalId||hashGoal(session.id);
  if(goal==='local-heroes')return state.localSuccesses>=5;
  if(goal==='deep-bench')return activeExperts(company).every(expert=>(expert.domains.find(skill=>KM_WEEK_DOMAINS.includes(skill.domain))?.score||0)>=KM_WEEK_DEEP_BENCH_TARGET);
  if(goal==='broad-base')return localCapabilityPoints(company)>=4;
  const totals=activeSites(company).map(site=>KM_WEEK_DOMAINS.reduce((sum,domain)=>sum+(site.teamCapability[domain]||0),0));
  return totals.length===3&&totals.every(total=>total>=3)&&totals.some(total=>total>=4);
}

/** Final turnover placements are decided across the companies actually playing.
 * Equal turnover shares the same place; the next place is skipped (competition ranking).
 * Nobody earns a placement bonus while any participating company is still playing.
 */
export function kmWeekFinalTurnoverPointsV1(session:GameSessionV2,company:CompanyV2):number{
  const participantCompanyIds=new Set(session.participants.filter(participant=>participant.role!=='facilitator'&&participant.companyId).map(participant=>participant.companyId));
  const competitors=participantCompanyIds.size
    ?session.companies.filter(candidate=>participantCompanyIds.has(candidate.id))
    :session.companies;
  if(!competitors.length||!competitors.some(candidate=>candidate.id===company.id)||!competitors.every(candidate=>candidate.kmWeek?.stage==='complete'))return 0;
  const ahead=competitors.filter(candidate=>candidate.turnover>company.turnover).length;
  return [7,4,2][ahead]??0;
}

export function calculateKMWeekScoreV1(session:GameSessionV2,company:CompanyV2):KMWeekScore{
  const state=company.kmWeek;
  if(!state)return emptyScore();
  const weightedBusiness=state.businessDifficultySolved??state.freeSuccesses*3;
  const score:KMWeekScore={
    business:Math.min(12,Math.round((weightedBusiness/FREE_CYCLE_DIFFICULTY_TOTAL)*12)),
    expertise:expertisePoints(company),
    localCapability:localCapabilityPoints(company),
    knowledgeFlow:Math.min(6,state.knowledgeTransfers+state.meaningfulTransfers),
    // Squeaky clean: one point per cleared audit, plus ten if all five clear.
    resilience:state.shockChecks.filter(check=>check.passed).length+
      (state.shockChecks.length===KM_WEEK_SHOCK_SPECS.length&&state.shockChecks.every(check=>check.passed)?10:0),
    goal:goalAchieved(session,company)?5:0,
    turnover:kmWeekFinalTurnoverPointsV1(session,company),
    total:0,
  };
  score.total=score.business+score.expertise+score.localCapability+score.knowledgeFlow+score.resilience+score.goal+score.turnover;
  return score;
}

function syncScore(session:GameSessionV2,company:CompanyV2){
  if(company.kmWeek)company.kmWeek.score=calculateKMWeekScoreV1(session,company);
}

function setChallengePhase(company:CompanyV2,challenges:KMWeekChallenge[]){
  const state=company.kmWeek!;
  state.phase='challenge';
  state.challenges=cloneChallenges(challenges);
  state.usedExpertIds=[];
  company.roundPhase='events';
  company.actionsRemaining=1;
  for(const expert of activeExperts(company))expert.state=state.trainingCommitments?.[expert.id]===company.round?'Knowledge Transfer':expert.location==='HQ'?'HQ Assignment':'Available';
}

function afterChallengeSet(session:GameSessionV2,company:CompanyV2){
  const state=company.kmWeek!;
  if(state.challenges.some(challenge=>challenge.status==='open'))return;
  state.phase='invest';
  company.roundPhase='investment';

  if(state.stage==='free'&&state.freeRound===5&&!state.expertRetirement){
    retireHighestScoringExpert(session,company);
  }else if(state.stage==='free'&&state.expertRetirement?.status==='retired'&&state.freeRound>=state.expertRetirement.replacementRound){
    hireRetiredExpertReplacement(company);
  }

  state.lastMessage=state.stage==='guided'
    ? 'Challenge handled. Make the guided investment before continuing.'
    : 'Both Challenges are resolved. Choose one investment for the next round.';
  syncScore(session,company);
}

function applyTurnover(company:CompanyV2,amount:number){
  company.turnover=Math.max(0,company.turnover+amount);
}

export function resolveKMWeekChallengeV1(
  session:GameSessionV2,
  company:CompanyV2,
  challengeId:string,
  method:'local'|'expert'|'risk',
  expertId?:string,
  includeLocalBreadth=false,
  includeExpertBreadth=false,
  useLocalRisk=true,
  useExpertRisk=false,
){
  const state=company.kmWeek;
  if(!state||state.phase!=='challenge'||state.stage==='shock'||state.stage==='complete')return{success:false,message:'No normal Challenge is ready to resolve.'};
  const challenge=state.challenges.find(item=>item.id===challengeId);
  if(!challenge||challenge.status!=='open')return{success:false,message:'That Challenge has already been resolved.'};
  const site=company.sites.find(item=>item.id===challenge.siteId);
  if(!site)return{success:false,message:'Challenge site not found.'};

  if(state.stage==='guided'&&state.guidedTurn===1&&method!=='expert'){
    return{success:false,message:`This guided move is teaching expert deployment. Send the ${challenge.domain==='hr'?'Human Resources':challenge.domain==='marketing'?'Marketing':'Operations'} expert.`};
  }

  if(expertId&&(method==='expert'||includeExpertBreadth||useExpertRisk)&&state.trainingCommitments?.[expertId]===company.round)return{success:false,message:'Busy training staff'};

  let won=false;
  let roll:number|undefined;
  let riskRequiredRoll:number|undefined;
  let riskPerformanceGap:number|undefined;
  let expert:ExpertV2|undefined;
  let travelCost=0;
  if(method==='local'){
    const localKnowledge=site.teamCapability[challenge.domain]||0;
    let breadth=0;
    if(includeExpertBreadth){
      expert=company.experts.find(item=>item.id===expertId&&!item.isVacant);
      if(!expert)return{success:false,message:'Choose an available expert for breadth.'};
      const skill=expert.domains.find(item=>item.domain===challenge.domain);
      if(!skill||skill.score<=0)return{success:false,message:`${expert.name} cannot contribute breadth in this domain.`};
      if(state.stage==='free'&&state.usedExpertIds.includes(expert.id))return{success:false,message:`${expert.name} has already handled a Challenge this round.`};
      breadth=1;
    }
    const total=localKnowledge+breadth;
    won=total>=challenge.difficulty;
    if(state.stage==='guided'&&!won)return{success:false,message:`${site.name} provides depth ${localKnowledge}${breadth?' plus expert breadth +1':''}; total selected knowledge ${total}/${challenge.difficulty}.`};
    if(expert){
      travelCost=expert.location===site.id?0:2;
      expert.location=site.id;
      expert.state='Supporting Event';
      if(state.stage==='free')state.usedExpertIds.push(expert.id);
    }
    if(won&&state.stage==='free'&&!includeExpertBreadth)state.localSuccesses+=1;
  }else if(method==='expert'){
    expert=company.experts.find(item=>item.id===expertId&&!item.isVacant);
    if(!expert)return{success:false,message:'Choose an available expert.'};
    const skill=expert.domains.find(item=>item.domain===challenge.domain);
    if(!skill)return{success:false,message:`${expert.name} does not hold this knowledge domain.`};
    if(state.stage==='free'&&state.usedExpertIds.includes(expert.id))return{success:false,message:`${expert.name} has already handled a Challenge this round.`};
    const localKnowledge=site.teamCapability[challenge.domain]||0;
    const breadth=includeLocalBreadth&&localKnowledge>0?1:0;
    const total=skill.score+breadth;
    won=total>=challenge.difficulty;
    if(state.stage==='guided'&&!won){
      const breadthHint=!includeLocalBreadth&&localKnowledge>0?' Select the Local Team as breadth to add +1.':'';
      return{success:false,message:`${expert.name} provides depth ${skill.score}${breadth?' plus local breadth +1':''}; total selected knowledge ${total}/${challenge.difficulty}.${breadthHint}`};
    }
    travelCost=expert.location===site.id?0:2;
    expert.location=site.id;
    expert.state='Supporting Event';
    if(state.stage==='free')state.usedExpertIds.push(expert.id);
    if(won&&state.stage==='free')state.expertSuccesses+=1;
  }else{
    roll=Math.floor(Math.random()*6)+1;
    let team=useLocalRisk?(site.teamCapability[challenge.domain]||0):0;
    if(useExpertRisk||includeExpertBreadth){
      expert=company.experts.find(item=>item.id===expertId&&!item.isVacant);
      const skill=expert?.domains.find(item=>item.domain===challenge.domain);
      if(!expert||!skill||skill.score<=0||state.usedExpertIds.includes(expert.id))return{success:false,message:'Choose an available expert.'};
      team=useExpertRisk?skill.score+(includeLocalBreadth&&team>0?1:0):team+1;
      travelCost=expert.location===site.id?0:2;
      expert.location=site.id;expert.state='Supporting Event';
      if(state.stage==='free')state.usedExpertIds.push(expert.id);
    }
    const odds=kmWeekRiskOddsV1(team,challenge.difficulty);
    riskRequiredRoll=odds.requiredRoll;
    riskPerformanceGap=odds.performanceGap;
    won=roll>=odds.requiredRoll;
    if(won&&state.stage==='free')state.riskSuccesses+=1;
  }

  challenge.status=won?'success':'failure';
  challenge.resolution=method;
  challenge.expertId=expert?.id;
  challenge.dieRoll=roll;
  const businessChange=won?challenge.impact:-challenge.impact;
  const turnoverChange=businessChange-travelCost;
  challenge.travelCost=travelCost||undefined;
  challenge.turnoverChange=turnoverChange;
  if(state.stage==='free'&&!won&&state.pressureDomain===challenge.domain&&challenge.difficulty>=5){
    // Hold onto the most recent significant setback until AAR becomes available.
    state.lastPressureFailure={...challenge};
  }
  applyTurnover(company,turnoverChange);
  const challengeIndex=state.challenges.findIndex(item=>item.id===challenge.id)+1;
  const challengeLabel=state.stage==='guided'?`G${state.guidedTurn} C`:`R${state.freeRound} C${challengeIndex}`;
  state.turnoverHistory.push({label:challengeLabel,turnover:company.turnover,challengeResult:challenge.status});
  if(won&&state.stage==='free'){
    state.freeSuccesses+=1;
    state.businessDifficultySolved=(state.businessDifficultySolved||0)+challenge.difficulty;
  }
  const travelText=travelCost?` Expert travel -${travelCost}k.`:'';
  const rollText=roll!==undefined?` Dice roll ${roll}: ${won?'SUCCESS':'FAILURE'} (performance gap ${riskPerformanceGap}, needed ${riskRequiredRoll}+).`:'';
  state.lastMessage=won
    ? `${site.name} handled “${challenge.title}”. Business +${challenge.impact}k.${travelText}${rollText} Net turnover ${turnoverChange>=0?'+':''}${turnoverChange}k.`
    : `${site.name} could not contain “${challenge.title}”. Business -${challenge.impact}k.${travelText}${rollText} Net turnover -${Math.abs(turnoverChange)}k.`;
  afterChallengeSet(session,company);
  syncScore(session,company);
  return{success:true,message:state.lastMessage};
}

function spend(company:CompanyV2,cost:number){
  if(company.turnover<cost)return false;
  company.turnover-=cost;
  return true;
}

function guidedRequirement(state:KMWeekCompanyState):KMWeekInvestment{
  if(state.guidedTurn===1)return'TRAIN_EXPERT';
  if(state.guidedTurn===2)return'LOCAL_TRAINING';
  return'KNOWLEDGE_TRANSFER';
}

function investmentLabel(type:KMWeekInvestment){
  if(type==='TRAIN_EXPERT')return'Train Expert';
  if(type==='LOCAL_TRAINING')return'Local Training';
  if(type==='AFTER_ACTION_REVIEW')return'After Action Review';
  return'Knowledge Transfer';
}

export function investKMWeekV1(session:GameSessionV2,company:CompanyV2,payload:any){
  const state=company.kmWeek;
  if(!state||state.phase!=='invest'||state.stage==='shock'||state.stage==='complete')return{success:false,message:'Investment is not available right now.'};
  const type=String(payload?.investment||'') as KMWeekInvestment;
  if(!['TRAIN_EXPERT','LOCAL_TRAINING','KNOWLEDGE_TRANSFER','AFTER_ACTION_REVIEW'].includes(type))return{success:false,message:'Choose an available KM Week investment.'};
  if(state.stage==='guided'&&type!==guidedRequirement(state))return{success:false,message:`For this guided move, choose ${investmentLabel(guidedRequirement(state))}.`};
  const domain=String(payload?.domain||'') as KnowledgeDomain;
  if(type!=='AFTER_ACTION_REVIEW'&&!KM_WEEK_DOMAINS.includes(domain))return{success:false,message:'Choose Operations, Human Resources or Marketing.'};

  let before=0,after=0,cost=0,expertId:string|undefined,siteId:string|undefined,sourceSiteId:string|undefined,targetSiteId:string|undefined,meaningfulFlow=false;
  let reviewedChallengeId:string|undefined,expertBefore:number|undefined,expertAfter:number|undefined;
  let selectedDomain=domain;

  if(type==='AFTER_ACTION_REVIEW'){
    const event=kmWeekAARCandidatesV1(company).find(item=>item.id===payload?.challengeId);
    if(!event)return{success:false,message:'Choose an eligible completed Challenge (knowledge requirement of 5 or more).'};
    const site=company.sites.find(item=>item.id===event.siteId&&!item.isClosed);
    const retirement=state.expertRetirement;
    // When the domain expert has just retired, the local team may still carry
    // out its AAR. Captured lessons are handed to the incoming specialist.
    const expert=activeExperts(company).find(item=>item.domains.some(skill=>skill.domain===event.domain))
      ||(retirement?.status==='retired'&&retirement.domain===event.domain
        ?company.experts.find(item=>item.id===retirement.expertId&&item.isVacant)
        :undefined);
    const skill=expert?.domains.find(item=>item.domain===event.domain);
    if(!site||!expert||!skill)return{success:false,message:'The relevant domain expert is unavailable for this review. Choose another investment or review after their replacement arrives.'};
    cost=KM_WEEK_AAR_COST;
    if(!spend(company,cost))return{success:false,message:'Not enough turnover for the $50k After Action Review.'};
    const uplift=event.status==='failure'?2:1;
    selectedDomain=event.domain;siteId=site.id;expertId=expert.id;reviewedChallengeId=event.id;
    before=site.teamCapability[event.domain]||0;
    after=before+uplift;
    expertBefore=skill.score;expertAfter=expertBefore+uplift;
    site.teamCapability[event.domain]=after;
    if(expert.isVacant&&retirement?.status==='retired'&&retirement.expertId===expert.id){
      retirement.pendingAARUplift=(retirement.pendingAARUplift||0)+uplift;
    }else skill.score=expertAfter;
  }else if(type==='TRAIN_EXPERT'){
    const expert=company.experts.find(item=>item.id===payload?.expertId&&!item.isVacant);
    const skill=expert?.domains.find(item=>item.domain===domain);
    if(!expert||!skill)return{success:false,message:'Choose an expert and one of their knowledge domains.'};
    cost=15;if(!spend(company,cost))return{success:false,message:'Not enough turnover for this investment.'};
    before=skill.score;skill.score+=1;after=skill.score;expertId=expert.id;expert.state='Training';
  }else if(type==='LOCAL_TRAINING'){
    const expert=company.experts.find(item=>item.id===payload?.expertId&&!item.isVacant);
    const site=company.sites.find(item=>item.id===payload?.siteId&&!item.isClosed);
    const skill=expert?.domains.find(item=>item.domain===domain);
    if(!expert||!site||!skill)return{success:false,message:'Choose an expert, their domain and a site.'};
    if((site.teamCapability[domain]||0)>=skill.score)return{success:false,message:'The local team is already at this expert’s teaching ceiling.'};
    const travelCost=expert.location===site.id?0:2;
    cost=10+travelCost;if(!spend(company,cost))return{success:false,message:'Not enough turnover for this investment.'};
    before=site.teamCapability[domain]||0;site.teamCapability[domain]=Math.min(before+2,skill.score);after=site.teamCapability[domain];expertId=expert.id;siteId=site.id;expert.location=site.id;expert.state='Knowledge Transfer';
    state.trainingCommitments={...state.trainingCommitments,[expert.id]:company.round+1};
  }else{
    const source=company.sites.find(item=>item.id===payload?.sourceSiteId&&!item.isClosed);
    const target=company.sites.find(item=>item.id===payload?.targetSiteId&&!item.isClosed);
    if(!source||!target||source.id===target.id)return{success:false,message:'Choose two different sites.'};
    const sourceScore=source.teamCapability[domain]||0;
    const targetScore=target.teamCapability[domain]||0;
    if(sourceScore<=targetScore)return{success:false,message:`${source.name} must know more than ${target.name} in this domain before it can teach them.`};
    cost=8;if(!spend(company,cost))return{success:false,message:'Not enough turnover for this investment.'};
    const uplift=Math.max(1,Math.ceil((sourceScore-targetScore)/2));
    before=targetScore;target.teamCapability[domain]=Math.min(targetScore+uplift,sourceScore);after=target.teamCapability[domain];
    const actualUplift=after-before;
    sourceSiteId=source.id;targetSiteId=target.id;meaningfulFlow=before<2&&after>=2;
    if(state.stage==='free'){state.knowledgeTransfers+=actualUplift;if(meaningfulFlow)state.meaningfulTransfers+=1;}
  }

  state.investmentHistory.push({
    roundLabel:state.stage==='guided'?`Guided ${state.guidedTurn}`:`Free ${state.freeRound}`,
    type,domain:selectedDomain,expertId,siteId,sourceSiteId,targetSiteId,before,after,meaningfulFlow,challengeId:reviewedChallengeId,expertBefore,expertAfter,
  });
  state.turnoverHistory.push({label:state.stage==='guided'?`G${state.guidedTurn} I`:`R${state.freeRound} I`,turnover:company.turnover});
  state.lastMessage=type==='AFTER_ACTION_REVIEW'
    ?state.expertRetirement?.status==='retired'&&state.expertRetirement.expertId===expertId
      ?`After Action Review complete: site ${before} → ${after}; +${after-before} knowledge captured for the incoming expert. Cost ${cost}k.`
      :`After Action Review complete: site ${before} → ${after}, expert ${expertBefore} → ${expertAfter}. Cost ${cost}k.`
    :`${investmentLabel(type)} complete: ${before} → ${after}. Cost ${cost}k.`;

  advanceAfterKMWeekInvestment(session,company);
  syncScore(session,company);
  return{success:true,message:state.lastMessage};
}

/** Every accepted investment, or an explicit decision to skip one, must
 * advance exactly one round. This transition is the only path to the next
 * Challenge set; committing Challenges never skips an investment.
 */
function advanceAfterKMWeekInvestment(session:GameSessionV2,company:CompanyV2){
  const state=company.kmWeek!;
  if(state.stage==='guided'){
    if(state.guidedTurn<3){
      state.guidedTurn+=1;
      company.round=state.guidedTurn;
      setChallengePhase(company,[guidedChallenge(company,state.guidedTurn)]);
    }else if(kmWeekShockWindowOpen(session)){
      enterSiteAudits(company,'The guided section has ended as the final three-minute window begins. Site Audits are now underway.');
    }else{
      state.stage='free';
      state.freeRound=1;
      company.round=4;
      setChallengePhase(company,freeChallengesForRound(session,company,1));
      state.lastMessage='Guided section complete. From here, play until the final three-minute Site Audits.';
    }
  }else if(kmWeekShockWindowOpen(session)){
    enterSiteAudits(company,'The final three minutes have begun. Site Audits assess local capability without expert assistance.');
  }else{
    state.freeRound+=1;
    company.round=3+state.freeRound;
    setChallengePhase(company,freeChallengesForRound(session,company,state.freeRound));
    state.lastMessage=`Round ${state.freeRound} begins. Invest again after completing both Challenges.`;
  }
}

/** A cash-strapped or time-constrained company must not be trapped in Invest. */
export function skipKMWeekInvestmentV1(session:GameSessionV2,company:CompanyV2){
  const state=company.kmWeek;
  if(!state||state.stage!=='free'||state.phase!=='invest')return{success:false,message:'Finish the current Challenges before skipping an investment.'};
  // No intervention was purchased, so leave investmentHistory unchanged.
  state.turnoverHistory.push({label:`R${state.freeRound} I`,turnover:company.turnover});
  advanceAfterKMWeekInvestment(session,company);
  syncScore(session,company);
  return{success:true,message:state.lastMessage};
}

/** At the closing window, an unresolved Challenge must never strand an
 * entire workshop. Forfeited Challenges count as failures (and cost turnover);
 * already recorded wins and investments remain unchanged.
 */
export function advanceKMWeekToAuditsV1(session:GameSessionV2,company:CompanyV2){
  const state=company.kmWeek;
  if(!state||state.stage!=='free'||!kmWeekShockWindowOpen(session))
    return{success:false,message:'Early Site Audits open only during the final three minutes.'};
  if(state.phase!=='challenge'&&state.phase!=='invest')
    return{success:false,message:'The company is already past its normal Challenges.'};
  let forfeited=0;
  if(state.phase==='challenge'){
    for(const challenge of state.challenges){
      if(challenge.status!=='open')continue;
      challenge.status='failure';
      challenge.resolution='local';
      challenge.turnoverChange=-challenge.impact;
      applyTurnover(company,-challenge.impact);
      state.turnoverHistory.push({label:`R${state.freeRound} C${state.challenges.indexOf(challenge)+1}`,turnover:company.turnover,challengeResult:'failure'});
      forfeited++;
    }
  }
  enterSiteAudits(company,`Site Audits are ready. ${forfeited} unfinished Challenge${forfeited===1?' was':'s were'} forfeited at the deadline.`);
  syncScore(session,company);
  return{success:true,message:state.lastMessage};
}

export function resolveKMWeekShockV1(session:GameSessionV2,company:CompanyV2){
  const state=company.kmWeek;
  if(!state||state.stage!=='shock'||state.shockResolved)return{success:false,message:'The Site Audits are not ready.'};
  const checks:KMWeekShockCheck[]=KM_WEEK_SHOCK_SPECS.map(spec=>{
    const site=company.sites.find(item=>item.id===spec.siteId);
    const localKnowledge=site?.teamCapability[spec.domain]||0;
    const shortfall=Math.max(0,spec.difficulty-localKnowledge);
    // A fully capable site always passes; every missing knowledge level adds
    // another face of a d6 on which auditors identify a non-conformity.
    const dieRoll=shortfall>0?Math.floor(Math.random()*6)+1:undefined;
    const passed=shortfall===0||(dieRoll!==undefined&&dieRoll>shortfall);
    return{...spec,localKnowledge,passed,dieRoll,resolution:passed?'ready':'accept',recovered:passed};
  });
  state.shockChecks=checks;
  state.shockResolved=true;
  state.phase='challenge';
  company.roundPhase='risk';

  const failures=checks.filter(check=>!check.passed);
  const failedSiteIds=[...new Set(failures.map(check=>check.siteId))];
  const missingKnowledge=failures.reduce((sum,check)=>sum+Math.max(0,check.difficulty-check.localKnowledge),0);
  const totalCost=missingKnowledge*KM_WEEK_SHOCK_GAP_COST;
  state.auditTurnoverBefore=company.turnover;
  state.auditFineTotal=totalCost;
  if(totalCost>0)applyTurnover(company,-totalCost);
  state.turnoverHistory.push({label:`SITE AUDITS -${totalCost}k`,turnover:company.turnover});

  state.lastMessage=failures.length
    ? `Auditors identified ${failures.length} non-conformit${failures.length===1?'y':'ies'} at ${failedSiteIds.length} site${failedSiteIds.length===1?'':'s'}. The knowledge shortfall of ${missingKnowledge} point${missingKnowledge===1?'':'s'} attracted fines totalling ${totalCost}k.`
    : `All ${checks.length} Site Audits passed. No fines, and a 10-point Squeaky clean bonus!`;
  syncScore(session,company);
  return{success:true,message:state.lastMessage};
}

export function completeKMWeekShockV1(session:GameSessionV2,company:CompanyV2){
  const state=company.kmWeek;
  if(!state||state.stage!=='shock'||!state.shockResolved)return{success:false,message:'Run the Site Audits first.'};
  state.stage='complete';
  state.phase='challenge';
  company.roundPhase='risk';
  const ready=state.shockChecks.filter(check=>check.passed).length;
  const gaps=state.shockChecks.length-ready;
  const failedSites=new Set(state.shockChecks.filter(check=>!check.passed).map(check=>check.siteId));
  const missingKnowledge=state.shockChecks.filter(check=>!check.passed).reduce((sum,check)=>sum+Math.max(0,check.difficulty-check.localKnowledge),0);
  const cost=missingKnowledge*KM_WEEK_SHOCK_GAP_COST;
  state.lastMessage=gaps
    ? `${ready} of ${state.shockChecks.length} Site Audits passed; ${gaps} non-conformit${gaps===1?'y':'ies'} across ${failedSites.size} site${failedSites.size===1?'':'s'} attracted fines of ${cost}k.`
    : `All ${state.shockChecks.length} Site Audits passed. No fines and an additional 10 Squeaky clean points.`;
  syncScore(session,company);
  return{success:true,message:state.lastMessage};
}

export function applyKMWeekActionV1(session:GameSessionV2,companyId:string,payload:any){
  if(session.experienceMode!=='km_week')return{success:false,message:'This action is only available in KM Week mode.'};
  const company=session.companies.find(item=>item.id===companyId);
  if(!company)return{success:false,message:'Company not found.'};
  if(!company.kmWeek)initialiseKMWeekCompanyV1(company,session.id);
  const type=String(payload?.type||'');
  let result:{success:boolean;message:string};
  if(type==='KM_WEEK_RESOLVE'){
    const useLocalRisk=payload?.useLocalRisk===undefined?true:Boolean(payload?.useLocalRisk);
    result=resolveKMWeekChallengeV1(session,company,String(payload?.challengeId||''),payload?.method,payload?.expertId,Boolean(payload?.includeLocalBreadth),Boolean(payload?.includeExpertBreadth),useLocalRisk,Boolean(payload?.useExpertRisk));
  }else if(type==='KM_WEEK_INVEST'){
    result=investKMWeekV1(session,company,payload);
  }else if(type==='KM_WEEK_SKIP_INVEST'){
    result=skipKMWeekInvestmentV1(session,company);
  }else if(type==='KM_WEEK_TO_AUDITS'){
    result=advanceKMWeekToAuditsV1(session,company);
  }else if(type==='KM_WEEK_RESOLVE_SHOCK'){
    result=resolveKMWeekShockV1(session,company);
  }else if(type==='KM_WEEK_COMPLETE_SHOCK'){
    result=completeKMWeekShockV1(session,company);
  }else{
    return{success:false,message:'Unknown KM Week action.'};
  }
  syncScore(session,company);
  const staffedIds=new Set(session.participants.filter(participant=>participant.role!=='facilitator').map(participant=>participant.companyId));
  const relevant=staffedIds.size?session.companies.filter(candidate=>staffedIds.has(candidate.id)):session.companies;
  if(relevant.length&&relevant.every(candidate=>candidate.kmWeek?.stage==='complete')){
    session.finalDisruptionResolved=true;
    // Turnover rankings only exist after the last team completes. Re-score all
    // participants together so the persisted final totals match the debrief.
    for(const candidate of relevant)syncScore(session,candidate);
  }
  return{...result,session};
}
