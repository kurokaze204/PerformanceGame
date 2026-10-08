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
export const KM_WEEK_MAX_KNOWLEDGE = 5;
export const KM_WEEK_MAX_EXPERT_KNOWLEDGE = 6;
export const KM_WEEK_SHOCK_WINDOW_SECONDS = 180;
export const KM_WEEK_SHOCK_GAP_COST = 20;

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
    description:'Solve at least 2 free-play Challenges using local team capability only.',
    points:5,
  },
  'deep-bench': {
    id:'deep-bench',
    title:'Deep Bench',
    description:'Finish with all three specialists at Knowledge 6.',
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
    {id:'HR3',domain:'hr',difficulty:3,impact:45},
    {id:'HR4',domain:'hr',difficulty:4,impact:60},
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
  const replacementScore=Math.max(3,...siteScores);
  expert.name=retirement.replacementName;
  skill.score=Math.min(KM_WEEK_MAX_EXPERT_KNOWLEDGE,replacementScore);
  expert.isVacant=false;
  expert.state='Available';
  expert.replacementDueRound=null;
  expert.replacementName=null;
  retirement.replacementScore=skill.score;
  retirement.status='replaced';
}

function guidedChallenge(turn:number):KMWeekChallenge{
  if(turn===1)return {id:'G1',title:'Packaging line shutdown',story:'A conveyor-control fault has stopped Brisbane’s packaging line during a customer production run. Dispatch will miss today’s cut-off unless the line is restarted quickly.',siteId:'brisbane',domain:'operations',difficulty:4,impact:30,status:'open',guided:true};
  if(turn===2)return {id:'G2',title:'Batch quality hold',story:'After production restarts, quality checks find inconsistent fill weights across two Brisbane batches. Shipments are on hold until the cause is identified and corrected.',siteId:'brisbane',domain:'operations',difficulty:1,impact:30,status:'open',guided:true};
  return {id:'G3',title:'Perth shift handover breakdown',story:'Incomplete maintenance and dispatch notes leave Perth’s afternoon shift unable to safely release several urgent customer orders.',siteId:'perth',domain:'operations',difficulty:4,impact:35,status:'open',guided:true};
}

function cloneChallenges(items:KMWeekChallenge[]):KMWeekChallenge[]{
  return items.map(item=>({...item}));
}

export function freeChallengesForRound(session:GameSessionV2,company:CompanyV2,round:number):KMWeekChallenge[]{
  const safeRound=Math.max(1,round);
  const cycle=Math.floor((safeRound-1)/FREE_ROUND_VALUES.length);
  const position=(safeRound-1)%FREE_ROUND_VALUES.length;
  const seedBase=`${session.id}|${company.id}|cycle:${cycle}`;
  const shuffledProfiles=seededShuffle(FREE_ROUND_VALUES,`${seedBase}|profiles`);
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
      difficulty:value.difficulty,
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

function enterBusinessShock(company:CompanyV2,message='The final three minutes have begun. The Business Shock is here.'){
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
  return {business:0,expertise:0,localCapability:0,knowledgeFlow:0,resilience:0,goal:0,total:0};
}

function activeSites(company:CompanyV2){
  return KM_WEEK_SITE_IDS.map(id=>company.sites.find(site=>site.id===id)).filter((site):site is CompanyV2['sites'][number]=>Boolean(site));
}

function activeExperts(company:CompanyV2){
  return company.experts.filter(expert=>!expert.isVacant&&expert.domains.some(skill=>KM_WEEK_DOMAINS.includes(skill.domain)));
}

function applyStartingBoard(company:CompanyV2){
  for(const site of company.sites){
    site.isClosed=!KM_WEEK_SITE_IDS.includes(site.id as any);
    for(const domain of ['engineering','hr','marketing','operations','finance'] as KnowledgeDomain[]){
      site.teamCapability[domain]=0;
      site.codifiedKnowledge[domain]=0;
    }
  }
  const mel=company.sites.find(site=>site.id==='melbourne');
  const bne=company.sites.find(site=>site.id==='brisbane');
  const per=company.sites.find(site=>site.id==='perth');
  if(mel){mel.teamCapability.operations=1;mel.teamCapability.hr=1;mel.teamCapability.marketing=0;mel.turnover=300;}
  if(bne){bne.teamCapability.operations=1;bne.teamCapability.hr=0;bne.teamCapability.marketing=1;bne.turnover=290;}
  if(per){per.teamCapability.operations=0;per.teamCapability.hr=1;per.teamCapability.marketing=1;per.turnover=285;}
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
  const experts:ExpertV2[]=[
    {id:`kmw-${id}-ops`,name:'Priya Patel',domains:[{domain:'operations',score:4}],location:'melbourne',homeLocation:'melbourne',state:'Available',isSPOF:true,spofDomains:['operations'],isVacant:false,replacementDueRound:null,replacementName:null},
    {id:`kmw-${id}-hr`,name:'Marcus Sterling',domains:[{domain:'hr',score:4}],location:'brisbane',homeLocation:'brisbane',state:'Available',isSPOF:true,spofDomains:['hr'],isVacant:false,replacementDueRound:null,replacementName:null},
    {id:`kmw-${id}-marketing`,name:'Mary Jackson',domains:[{domain:'marketing',score:4}],location:'perth',homeLocation:'perth',state:'Available',isSPOF:true,spofDomains:['marketing'],isVacant:false,replacementDueRound:null,replacementName:null},
  ];
  company.experts=experts;
  company.strategicInvestmentFund=0;
  company.actionsRemaining=1;
}

export function initialiseKMWeekCompanyV1(company:CompanyV2){
  applyStartingBoard(company);
  company.round=1;
  company.roundPhase='events';
  company.kmWeek={
    stage:'guided',
    phase:'challenge',
    guidedTurn:1,
    freeRound:0,
    challenges:[guidedChallenge(1)],
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
    initialiseKMWeekCompanyV1(company);
    session.activeEvents[company.id]=[];
    syncScore(session,company);
  }
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
    if(!company.kmWeek){initialiseKMWeekCompanyV1(company);session.activeEvents[company.id]=[];syncScore(session,company);changed=true;}
    else{
      if(!company.kmWeek.turnoverHistory){company.kmWeek.turnoverHistory=[{label:'CURRENT',turnover:company.turnover}];changed=true;}
      if(company.kmWeek.businessDifficultySolved===undefined){company.kmWeek.businessDifficultySolved=company.kmWeek.freeSuccesses*3;changed=true;}
    }
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
  return activeExperts(company).reduce((sum,expert)=>{
    const skill=expert.domains.find(item=>KM_WEEK_DOMAINS.includes(item.domain));
    return sum+Math.max(0,(skill?.score||0)-3);
  },0);
}

function goalAchieved(session:GameSessionV2,company:CompanyV2){
  const state=company.kmWeek!;
  const goal=session.kmWeekGoalId||hashGoal(session.id);
  if(goal==='local-heroes')return state.localSuccesses>=2;
  if(goal==='deep-bench')return activeExperts(company).every(expert=>(expert.domains.find(skill=>KM_WEEK_DOMAINS.includes(skill.domain))?.score||0)>=KM_WEEK_MAX_EXPERT_KNOWLEDGE);
  if(goal==='broad-base')return localCapabilityPoints(company)>=4;
  const totals=activeSites(company).map(site=>KM_WEEK_DOMAINS.reduce((sum,domain)=>sum+(site.teamCapability[domain]||0),0));
  return totals.length===3&&totals.every(total=>total>=3)&&totals.some(total=>total>=4);
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
    resilience:state.shockChecks.filter(check=>check.passed).length,
    goal:goalAchieved(session,company)?5:0,
    total:0,
  };
  score.total=score.business+score.expertise+score.localCapability+score.knowledgeFlow+score.resilience+score.goal;
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
  for(const expert of activeExperts(company))expert.state=expert.location==='HQ'?'HQ Assignment':'Available';
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
){
  const state=company.kmWeek;
  if(!state||state.phase!=='challenge'||state.stage==='shock'||state.stage==='complete')return{success:false,message:'No normal Challenge is ready to resolve.'};
  const challenge=state.challenges.find(item=>item.id===challengeId);
  if(!challenge||challenge.status!=='open')return{success:false,message:'That Challenge has already been resolved.'};
  const site=company.sites.find(item=>item.id===challenge.siteId);
  if(!site)return{success:false,message:'Challenge site not found.'};

  if(state.stage==='guided'&&state.guidedTurn!==2&&method!=='expert'){
    return{success:false,message:'This guided move is teaching expert deployment. Send the Operations expert.'};
  }

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
    travelCost=expert.location===site.id?0:2;
    expert.location=site.id;
    expert.state='Supporting Event';
    if(state.stage==='free')state.usedExpertIds.push(expert.id);
    if(won&&state.stage==='free')state.expertSuccesses+=1;
  }else{
    roll=Math.floor(Math.random()*6)+1;
    const team=useLocalRisk?(site.teamCapability[challenge.domain]||0):0;
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
  applyTurnover(company,turnoverChange);
  const challengeIndex=state.challenges.findIndex(item=>item.id===challenge.id)+1;
  const challengeLabel=state.stage==='guided'?`G${state.guidedTurn} C`:`R${state.freeRound} C${challengeIndex}`;
  state.turnoverHistory.push({label:challengeLabel,turnover:company.turnover});
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
  return'Knowledge Transfer';
}

export function investKMWeekV1(session:GameSessionV2,company:CompanyV2,payload:any){
  const state=company.kmWeek;
  if(!state||state.phase!=='invest'||state.stage==='shock'||state.stage==='complete')return{success:false,message:'Investment is not available right now.'};
  const type=String(payload?.investment||'') as KMWeekInvestment;
  if(!['TRAIN_EXPERT','LOCAL_TRAINING','KNOWLEDGE_TRANSFER'].includes(type))return{success:false,message:'Choose one of the three KM Week investments.'};
  if(state.stage==='guided'&&type!==guidedRequirement(state))return{success:false,message:`For this guided move, choose ${investmentLabel(guidedRequirement(state))}.`};
  const domain=String(payload?.domain||'') as KnowledgeDomain;
  if(!KM_WEEK_DOMAINS.includes(domain))return{success:false,message:'Choose Operations, Human Resources or Marketing.'};

  let before=0,after=0,cost=0,expertId:string|undefined,siteId:string|undefined,sourceSiteId:string|undefined,targetSiteId:string|undefined,meaningfulFlow=false;

  if(type==='TRAIN_EXPERT'){
    const expert=company.experts.find(item=>item.id===payload?.expertId&&!item.isVacant);
    const skill=expert?.domains.find(item=>item.domain===domain);
    if(!expert||!skill)return{success:false,message:'Choose an expert and one of their knowledge domains.'};
    if(skill.score>=KM_WEEK_MAX_EXPERT_KNOWLEDGE)return{success:false,message:`${expert.name} is already at the KM Week expert maximum of ${KM_WEEK_MAX_EXPERT_KNOWLEDGE}.`};
    cost=15;if(!spend(company,cost))return{success:false,message:'Not enough turnover for this investment.'};
    before=skill.score;skill.score=Math.min(KM_WEEK_MAX_EXPERT_KNOWLEDGE,skill.score+1);after=skill.score;expertId=expert.id;expert.state='Training';
  }else if(type==='LOCAL_TRAINING'){
    const expert=company.experts.find(item=>item.id===payload?.expertId&&!item.isVacant);
    const site=company.sites.find(item=>item.id===payload?.siteId&&!item.isClosed);
    const skill=expert?.domains.find(item=>item.domain===domain);
    if(!expert||!site||!skill)return{success:false,message:'Choose an expert, their domain and a site.'};
    if((site.teamCapability[domain]||0)>=skill.score)return{success:false,message:'The local team is already at this expert’s teaching ceiling.'};
    const travelCost=expert.location===site.id?0:2;
    cost=10+travelCost;if(!spend(company,cost))return{success:false,message:'Not enough turnover for this investment.'};
    before=site.teamCapability[domain]||0;site.teamCapability[domain]=Math.min(KM_WEEK_MAX_KNOWLEDGE,before+1,skill.score);after=site.teamCapability[domain];expertId=expert.id;siteId=site.id;expert.location=site.id;expert.state='Knowledge Transfer';
  }else{
    const source=company.sites.find(item=>item.id===payload?.sourceSiteId&&!item.isClosed);
    const target=company.sites.find(item=>item.id===payload?.targetSiteId&&!item.isClosed);
    if(!source||!target||source.id===target.id)return{success:false,message:'Choose two different sites.'};
    const sourceScore=source.teamCapability[domain]||0;
    const targetScore=target.teamCapability[domain]||0;
    if(sourceScore<=targetScore)return{success:false,message:`${source.name} must know more than ${target.name} in this domain before it can teach them.`};
    cost=8;if(!spend(company,cost))return{success:false,message:'Not enough turnover for this investment.'};
    const uplift=Math.max(1,Math.ceil((sourceScore-targetScore)/2));
    before=targetScore;target.teamCapability[domain]=Math.min(KM_WEEK_MAX_KNOWLEDGE,targetScore+uplift,sourceScore);after=target.teamCapability[domain];
    const actualUplift=after-before;
    sourceSiteId=source.id;targetSiteId=target.id;meaningfulFlow=before<2&&after>=2;
    if(state.stage==='free'){state.knowledgeTransfers+=actualUplift;if(meaningfulFlow)state.meaningfulTransfers+=1;}
  }

  state.investmentHistory.push({
    roundLabel:state.stage==='guided'?`Guided ${state.guidedTurn}`:`Free ${state.freeRound}`,
    type,domain,expertId,siteId,sourceSiteId,targetSiteId,before,after,meaningfulFlow,
  });
  state.turnoverHistory.push({label:state.stage==='guided'?`G${state.guidedTurn} I`:`R${state.freeRound} I`,turnover:company.turnover});
  state.lastMessage=`${investmentLabel(type)} complete: ${before} → ${after}. Cost $${cost}k.`;

  if(state.stage==='guided'){
    if(state.guidedTurn<3){
      state.guidedTurn+=1;
      company.round=state.guidedTurn;
      setChallengePhase(company,[guidedChallenge(state.guidedTurn)]);
    }else{
      company.initialRiverSnapshot={
        sites:structuredClone(company.sites),
        experts:structuredClone(company.experts),
      };
      if(kmWeekShockWindowOpen(session)){
        enterBusinessShock(company,'The guided section has ended just as the final three-minute window begins. Your organisation now has to cope without its specialists.');
      }else{
        state.stage='free';
        state.freeRound=1;
        company.round=4;
        setChallengePhase(company,freeChallengesForRound(session,company,1));
        state.lastMessage='Guided section complete. From here, keep playing until the final three-minute Business Shock.';
      }
    }
  }else{
    if(kmWeekShockWindowOpen(session)){
      enterBusinessShock(company,'The clock has entered its final three minutes. The specialists are no longer available: reveal the Business Shock.');
    }else{
      state.freeRound+=1;
      company.round=3+state.freeRound;
      setChallengePhase(company,freeChallengesForRound(session,company,state.freeRound));
      state.lastMessage=`Round ${state.freeRound} begins. Keep building capability before the final three-minute Business Shock.`;
    }
  }
  syncScore(session,company);
  return{success:true,message:state.lastMessage};
}

export function resolveKMWeekShockV1(session:GameSessionV2,company:CompanyV2){
  const state=company.kmWeek;
  if(!state||state.stage!=='shock'||state.shockResolved)return{success:false,message:'The Business Shock is not ready.'};
  const checks:KMWeekShockCheck[]=KM_WEEK_SHOCK_SPECS.map(spec=>{
    const site=company.sites.find(item=>item.id===spec.siteId);
    const localKnowledge=site?.teamCapability[spec.domain]||0;
    const passed=localKnowledge>=spec.difficulty;
    return{...spec,localKnowledge,passed,resolution:passed?'ready':undefined,recovered:passed};
  });
  state.shockChecks=checks;
  state.shockResolved=true;
  state.phase='challenge';
  company.roundPhase='risk';

  const failures=checks.filter(check=>!check.passed);
  const failedSiteIds=[...new Set(failures.map(check=>check.siteId))];
  const missingKnowledge=failures.reduce((sum,check)=>sum+Math.max(0,check.difficulty-check.localKnowledge),0);
  const totalCost=missingKnowledge*KM_WEEK_SHOCK_GAP_COST;
  if(totalCost>0)applyTurnover(company,-totalCost);
  state.turnoverHistory.push({label:`SHOCK -${totalCost}k`,turnover:company.turnover});

  state.lastMessage=failures.length
    ? `The shock exposed ${failures.length} local capability gap${failures.length===1?'':'s'} across ${failedSiteIds.length} site${failedSiteIds.length===1?'':'s'}, with ${missingKnowledge} knowledge point${missingKnowledge===1?'':'s'} missing. Emergency external support cost ${totalCost}k in total.`
    : `All ${checks.length} critical capability tests were handled locally. No emergency external support was needed.`;
  syncScore(session,company);
  return{success:true,message:state.lastMessage};
}

export function completeKMWeekShockV1(session:GameSessionV2,company:CompanyV2){
  const state=company.kmWeek;
  if(!state||state.stage!=='shock'||!state.shockResolved)return{success:false,message:'Run the Business Shock first.'};
  state.stage='complete';
  state.phase='challenge';
  company.roundPhase='risk';
  const ready=state.shockChecks.filter(check=>check.passed).length;
  const gaps=state.shockChecks.length-ready;
  const failedSites=new Set(state.shockChecks.filter(check=>!check.passed).map(check=>check.siteId));
  const missingKnowledge=state.shockChecks.reduce((sum,check)=>sum+Math.max(0,check.difficulty-check.localKnowledge),0);
  const cost=missingKnowledge*KM_WEEK_SHOCK_GAP_COST;
  state.lastMessage=gaps
    ? `${ready} of ${state.shockChecks.length} critical capabilities held locally. ${gaps} gap${gaps===1?'':'s'} across ${failedSites.size} site${failedSites.size===1?'':'s'} left ${missingKnowledge} knowledge point${missingKnowledge===1?'':'s'} missing and required emergency external support costing ${cost}k.`
    : `All ${state.shockChecks.length} critical capabilities held locally. The organisation absorbed the shock without external rescue.`;
  syncScore(session,company);
  return{success:true,message:state.lastMessage};
}

export function applyKMWeekActionV1(session:GameSessionV2,companyId:string,payload:any){
  if(session.experienceMode!=='km_week')return{success:false,message:'This action is only available in KM Week mode.'};
  const company=session.companies.find(item=>item.id===companyId);
  if(!company)return{success:false,message:'Company not found.'};
  if(!company.kmWeek)initialiseKMWeekCompanyV1(company);
  const type=String(payload?.type||'');
  let result:{success:boolean;message:string};
  if(type==='KM_WEEK_RESOLVE'){
    const useLocalRisk=payload?.useLocalRisk===undefined?true:Boolean(payload?.useLocalRisk);
    result=resolveKMWeekChallengeV1(session,company,String(payload?.challengeId||''),payload?.method,payload?.expertId,Boolean(payload?.includeLocalBreadth),Boolean(payload?.includeExpertBreadth),useLocalRisk);
  }else if(type==='KM_WEEK_INVEST'){
    result=investKMWeekV1(session,company,payload);
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
  if(relevant.length&&relevant.every(candidate=>candidate.kmWeek?.stage==='complete'))session.finalDisruptionResolved=true;
  return{...result,session};
}
