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

export const KM_WEEK_SHOCK_SPECS:{id:string;siteId:string;domain:KnowledgeDomain;difficulty:number}[]=[
  {id:'S1',siteId:'brisbane',domain:'operations',difficulty:2},
  {id:'S2',siteId:'perth',domain:'operations',difficulty:1},
  {id:'S3',siteId:'melbourne',domain:'hr',difficulty:2},
  {id:'S4',siteId:'brisbane',domain:'marketing',difficulty:2},
  {id:'S5',siteId:'perth',domain:'marketing',difficulty:2},
];
export const KM_WEEK_SHOCK_CUTOFF=Math.max(...KM_WEEK_SHOCK_SPECS.map(check=>check.difficulty));

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
    description:'Finish with all three specialists at Knowledge 5.',
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

const FREE_ROUNDS: KMWeekChallenge[][] = [
  [
    {id:'F1-HR-MEL',title:'Roster gap',story:'A sudden staffing gap threatens a critical Melbourne shift.',siteId:'melbourne',domain:'hr',difficulty:2,impact:35,status:'open'},
    {id:'F1-HR-PER',title:'Recruitment surge',story:'Perth needs the same HR capability at the same time. One specialist cannot cover both sites.',siteId:'perth',domain:'hr',difficulty:2,impact:35,status:'open'},
  ],
  [
    {id:'F2-HR-MEL',title:'Workforce handover',story:'Melbourne needs HR capability again. What did the organisation retain from last round?',siteId:'melbourne',domain:'hr',difficulty:2,impact:35,status:'open'},
    {id:'F2-MKT-BNE',title:'Campaign launch',story:'Brisbane must respond to a fast-moving customer opportunity.',siteId:'brisbane',domain:'marketing',difficulty:2,impact:40,status:'open'},
  ],
  [
    {id:'F3-MKT-BNE',title:'Customer response',story:'Brisbane faces another Marketing decision under time pressure.',siteId:'brisbane',domain:'marketing',difficulty:2,impact:40,status:'open'},
    {id:'F3-OPS-PER',title:'Maintenance backlog',story:'Perth has a growing Operations backlog that is starting to hit output.',siteId:'perth',domain:'operations',difficulty:2,impact:45,status:'open'},
  ],
]

function guidedChallenge(turn:number):KMWeekChallenge{
  if(turn===1)return {id:'G1',title:'Production line stopped',story:'Brisbane has an urgent Operations problem. The local team is out of its depth.',siteId:'brisbane',domain:'operations',difficulty:4,impact:30,status:'open',guided:true};
  if(turn===2)return {id:'G2',title:'Quality problem returns',story:'The immediate crisis is over, but another Operations problem appears in Brisbane.',siteId:'brisbane',domain:'operations',difficulty:4,impact:30,status:'open',guided:true};
  return {id:'G3',title:'Perth handover failure',story:'A similar Operations issue has now appeared in Perth.',siteId:'perth',domain:'operations',difficulty:4,impact:35,status:'open',guided:true};
}

function cloneChallenges(items:KMWeekChallenge[]):KMWeekChallenge[]{
  return items.map(item=>({...item}));
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
    localSuccesses:0,
    expertSuccesses:0,
    riskSuccesses:0,
    knowledgeTransfers:0,
    meaningfulTransfers:0,
    investmentHistory:[],
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
  session.finalWindowMinutes=5;
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
  if(!session.kmWeekGoalId){session.kmWeekGoalId=hashGoal(session.id);changed=true;}
  for(const company of session.companies){
    if(!company.kmWeek){initialiseKMWeekCompanyV1(company);session.activeEvents[company.id]=[];syncScore(session,company);changed=true;}
  }
  return changed;
}

export function kmWeekGoalV1(session:GameSessionV2):KMWeekGoal{
  return KM_WEEK_GOALS[session.kmWeekGoalId||hashGoal(session.id)];
}

function localCapabilityPoints(company:CompanyV2){
  return activeSites(company).reduce((sum,site)=>sum+KM_WEEK_DOMAINS.filter(domain=>(site.teamCapability[domain]||0)>=2).length,0);
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
  if(goal==='deep-bench')return activeExperts(company).every(expert=>(expert.domains.find(skill=>KM_WEEK_DOMAINS.includes(skill.domain))?.score||0)>=5);
  if(goal==='broad-base')return localCapabilityPoints(company)>=4;
  const totals=activeSites(company).map(site=>KM_WEEK_DOMAINS.reduce((sum,domain)=>sum+(site.teamCapability[domain]||0),0));
  return totals.length===3&&totals.every(total=>total>=3)&&totals.some(total=>total>=4);
}

export function calculateKMWeekScoreV1(session:GameSessionV2,company:CompanyV2):KMWeekScore{
  const state=company.kmWeek;
  if(!state)return emptyScore();
  const score:KMWeekScore={
    business:state.freeSuccesses*2,
    expertise:expertisePoints(company),
    localCapability:localCapabilityPoints(company),
    knowledgeFlow:state.knowledgeTransfers+state.meaningfulTransfers,
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
){
  const state=company.kmWeek;
  if(!state||state.phase!=='challenge'||state.stage==='shock'||state.stage==='complete')return{success:false,message:'No normal Challenge is ready to resolve.'};
  const challenge=state.challenges.find(item=>item.id===challengeId);
  if(!challenge||challenge.status!=='open')return{success:false,message:'That Challenge has already been resolved.'};
  const site=company.sites.find(item=>item.id===challenge.siteId);
  if(!site)return{success:false,message:'Challenge site not found.'};

  if(state.stage==='guided'&&method!=='expert')return{success:false,message:'This guided move is teaching expert deployment. Send the Operations expert.'};

  let won=false;
  let roll:number|undefined;
  let expert:ExpertV2|undefined;
  let travelCost=0;
  if(method==='local'){
    won=(site.teamCapability[challenge.domain]||0)>=challenge.difficulty;
    if(!won)return{success:false,message:`${site.name} only has ${site.teamCapability[challenge.domain]||0}; this Challenge needs ${challenge.difficulty}. Choose another response.`};
    if(state.stage==='free')state.localSuccesses+=1;
  }else if(method==='expert'){
    expert=company.experts.find(item=>item.id===expertId&&!item.isVacant);
    if(!expert)return{success:false,message:'Choose an available expert.'};
    const skill=expert.domains.find(item=>item.domain===challenge.domain);
    if(!skill)return{success:false,message:`${expert.name} does not hold this knowledge domain.`};
    if(state.stage==='free'&&state.usedExpertIds.includes(expert.id))return{success:false,message:`${expert.name} has already handled a Challenge this round.`};
    won=skill.score>=challenge.difficulty;
    if(!won)return{success:false,message:`${expert.name} has Knowledge ${skill.score}; this Challenge needs ${challenge.difficulty}.`};
    travelCost=expert.location===site.id?0:2;
    expert.location=site.id;
    expert.state='Supporting Event';
    if(state.stage==='free')state.usedExpertIds.push(expert.id);
    if(state.stage==='free')state.expertSuccesses+=1;
  }else{
    roll=Math.floor(Math.random()*6)+1;
    const team=site.teamCapability[challenge.domain]||0;
    won=team+roll>=challenge.difficulty+2;
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
  if(won&&state.stage==='free')state.freeSuccesses+=1;
  const travelText=travelCost?` Expert travel -${travelCost}k.`:'';
  state.lastMessage=won
    ? `${site.name} handled “${challenge.title}”. Business +${challenge.impact}k.${travelText} Net turnover ${turnoverChange>=0?'+':''}${turnoverChange}k.`
    : `${site.name} could not contain “${challenge.title}”. Business -${challenge.impact}k.${travelText} Net turnover -${Math.abs(turnoverChange)}k.`;
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
    if(skill.score>=KM_WEEK_MAX_KNOWLEDGE)return{success:false,message:`${expert.name} is already at the KM Week maximum of 5.`};
    cost=15;if(!spend(company,cost))return{success:false,message:'Not enough turnover for this investment.'};
    before=skill.score;skill.score=Math.min(KM_WEEK_MAX_KNOWLEDGE,skill.score+1);after=skill.score;expertId=expert.id;expert.state='Training';
  }else if(type==='LOCAL_TRAINING'){
    const expert=company.experts.find(item=>item.id===payload?.expertId&&!item.isVacant);
    const site=company.sites.find(item=>item.id===payload?.siteId&&!item.isClosed);
    const skill=expert?.domains.find(item=>item.domain===domain);
    if(!expert||!site||!skill)return{success:false,message:'Choose an expert, their domain and a site.'};
    if(expert.location!==site.id)return{success:false,message:`${expert.name} is currently in ${company.sites.find(item=>item.id===expert.location)?.name||expert.location}. Use the expert on a Challenge there first, or choose their current site.`};
    if((site.teamCapability[domain]||0)>=skill.score)return{success:false,message:'The local team is already at this expert’s teaching ceiling.'};
    cost=10;if(!spend(company,cost))return{success:false,message:'Not enough turnover for this investment.'};
    before=site.teamCapability[domain]||0;site.teamCapability[domain]=Math.min(KM_WEEK_MAX_KNOWLEDGE,before+1,skill.score);after=site.teamCapability[domain];expertId=expert.id;siteId=site.id;expert.state='Knowledge Transfer';
  }else{
    const source=company.sites.find(item=>item.id===payload?.sourceSiteId&&!item.isClosed);
    const target=company.sites.find(item=>item.id===payload?.targetSiteId&&!item.isClosed);
    if(!source||!target||source.id===target.id)return{success:false,message:'Choose two different sites.'};
    const sourceScore=source.teamCapability[domain]||0;
    const targetScore=target.teamCapability[domain]||0;
    if(sourceScore<=targetScore)return{success:false,message:`${source.name} must know more than ${target.name} in this domain before it can teach them.`};
    cost=8;if(!spend(company,cost))return{success:false,message:'Not enough turnover for this investment.'};
    before=targetScore;target.teamCapability[domain]=Math.min(KM_WEEK_MAX_KNOWLEDGE,targetScore+1,sourceScore);after=target.teamCapability[domain];
    sourceSiteId=source.id;targetSiteId=target.id;meaningfulFlow=before<2&&after>=2;
    if(state.stage==='free'){state.knowledgeTransfers+=1;if(meaningfulFlow)state.meaningfulTransfers+=1;}
  }

  state.investmentHistory.push({
    roundLabel:state.stage==='guided'?`Guided ${state.guidedTurn}`:`Free ${state.freeRound}`,
    type,domain,expertId,siteId,sourceSiteId,targetSiteId,before,after,meaningfulFlow,
  });
  state.lastMessage=`${investmentLabel(type)} complete: ${before} → ${after}. Cost $${cost}k.`;

  if(state.stage==='guided'){
    if(state.guidedTurn<3){
      state.guidedTurn+=1;
      company.round=state.guidedTurn;
      setChallengePhase(company,[guidedChallenge(state.guidedTurn)]);
    }else{
      state.stage='free';
      state.freeRound=1;
      company.round=4;
      setChallengePhase(company,FREE_ROUNDS[0]);
      state.lastMessage='Guided section complete. From here, the company is yours to run.';
    }
  }else{
    if(state.freeRound<3){
      state.freeRound+=1;
      company.round=3+state.freeRound;
      setChallengePhase(company,FREE_ROUNDS[state.freeRound-1]);
    }else{
      state.stage='shock';
      state.phase='challenge';
      company.round=7;
      company.roundPhase='risk';
      state.challenges=[];
      state.usedExpertIds=[];
      state.lastMessage='Free play complete. Turn over the Business Shock card.';
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
    return{...spec,passed:Boolean(site&&(site.teamCapability[spec.domain]||0)>=spec.difficulty)};
  });
  state.shockChecks=checks;
  state.shockResolved=true;
  state.stage='complete';
  state.phase='challenge';
  company.roundPhase='risk';
  const passed=checks.filter(check=>check.passed).length;
  state.lastMessage=`Your organisation handled ${passed} of ${checks.length} Business Shock tests without its specialists.`;
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
    result=resolveKMWeekChallengeV1(session,company,String(payload?.challengeId||''),payload?.method,payload?.expertId);
  }else if(type==='KM_WEEK_INVEST'){
    result=investKMWeekV1(session,company,payload);
  }else if(type==='KM_WEEK_RESOLVE_SHOCK'){
    result=resolveKMWeekShockV1(session,company);
  }else{
    return{success:false,message:'Unknown KM Week action.'};
  }
  syncScore(session,company);
  const staffedIds=new Set(session.participants.filter(participant=>participant.role!=='facilitator').map(participant=>participant.companyId));
  const relevant=staffedIds.size?session.companies.filter(candidate=>staffedIds.has(candidate.id)):session.companies;
  if(relevant.length&&relevant.every(candidate=>candidate.kmWeek?.stage==='complete'))session.finalDisruptionResolved=true;
  return{...result,session};
}
