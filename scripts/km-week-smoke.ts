import assert from 'node:assert/strict';
import { DEFAULT_CONFIG } from '../src/engine/config.ts';
import { createInitialCompanyV2 } from '../src/engine/coreV2.ts';
import {
  applyKMWeekActionV1,
  initialiseKMWeekSessionV1,
  initialiseKMWeekCompanyV1,
  ensureKMWeekSessionV1,
  investKMWeekV1,
  calculateKMWeekScoreV1,
  KM_WEEK_DOMAINS,
  KM_WEEK_SITE_IDS,
  KM_WEEK_SHOCK_FAILURE_COST,
  kmWeekRiskOddsV1,
} from '../src/engine/kmWeekV1.ts';
import type { GameSessionV2 } from '../src/types/gameV2.ts';
import { riverSiteKnowledgeScore } from '../src/engine/riverKnowledgeV1.ts';

const config={...DEFAULT_CONFIG,actions_per_round:1};
const company=createInitialCompanyV2('Apex Technologies','kmw-company',config);
const session={
  id:'KMWEEKTEST',
  title:'KM Week Test',
  round:1,
  phase:'respond',
  isPaused:false,
  isFinalDisruptionActive:false,
  companies:[company],
  activeEvents:{},
  copMemberships:[],
  config,
  createdAt:new Date().toISOString(),
  updatedAt:new Date().toISOString(),
  timerStartedAt:null,
  timerEndsAt:null,
  timerPausedSecondsRemaining:1800,
  riskResults:null,
  rulesVersion:'test',
  deckVersion:'test',
  balanceVersion:'test',
  experienceMode:'km_week',
  gameDurationMinutes:30,
  finalWindowMinutes:3,
  minutesPerMove:8,
  maxPlayersPerCompany:1,
  populationMode:'balanced',
  gameEndMode:'time',
  finalRoundCount:30,
  participants:[],
  soloMode:true,
  copMessages:[],
  soloCopPeer:null,
} as GameSessionV2;

initialiseKMWeekSessionV1(session);
assert.equal(company.kmWeek?.stage,'guided');
assert.equal(company.kmWeek?.guidedTurn,1);
assert.equal(company.kmWeek?.phase,'challenge');
assert.deepEqual(company.sites.filter(site=>!site.isClosed).map(site=>site.id),[...KM_WEEK_SITE_IDS]);
for(const site of company.sites.filter(site=>!site.isClosed)){
  for(const domain of KM_WEEK_DOMAINS)assert.ok((site.teamCapability[domain]||0)>=0&&(site.teamCapability[domain]||0)<=5);
}
for(const site of company.sites.filter(site=>!site.isClosed)){
  for(const domain of KM_WEEK_DOMAINS)assert.equal(riverSiteKnowledgeScore(site,domain,'km_week'),site.teamCapability[domain]||0,'KM Week River must exactly match the visible site score');
}
assert.deepEqual(company.experts.map(expert=>expert.domains[0].domain),['operations','hr','marketing']);
assert.deepEqual(kmWeekRiskOddsV1(1,2),{performanceGap:1,requiredRoll:1,successfulFaces:6,chancePercent:100},'A one-point performance gap must be a 1+ roll on d6');
assert.deepEqual(kmWeekRiskOddsV1(0,4),{performanceGap:4,requiredRoll:4,successfulFaces:3,chancePercent:50},'Risk odds must be calculated from the remaining performance gap');

const opsExpert=()=>company.experts.find(expert=>expert.domains.some(skill=>skill.domain==='operations'))!;
const resolveGuidedExpert=(includeLocalBreadth=false)=>{
  const challenge=company.kmWeek!.challenges[0];
  const result=applyKMWeekActionV1(session,company.id,{type:'KM_WEEK_RESOLVE',challengeId:challenge.id,method:'expert',expertId:opsExpert().id,includeLocalBreadth});
  assert.equal(result.success,true,result.message);
  assert.equal(company.kmWeek?.phase,'invest');
};

const openingTurnover=company.turnover;
// Match the main-game composition rule: Expert depth 4 + one independent local
// source = 5 total selected knowledge, so a difficulty-5 Challenge succeeds.
company.kmWeek!.challenges[0].difficulty=5;
let breadthResult=applyKMWeekActionV1(session,company.id,{type:'KM_WEEK_RESOLVE',challengeId:company.kmWeek!.challenges[0].id,method:'expert',expertId:opsExpert().id});
assert.equal(breadthResult.success,false,'Local breadth must not be assumed when an expert is selected');
assert.match(breadthResult.message,/Select the Local Team as breadth/,'The player must be prompted to select Local explicitly for breadth');
resolveGuidedExpert(true);
assert.equal(company.kmWeek?.challenges[0].status,'success','Explicitly selected local breadth must add +1 to expert depth');
assert.equal(company.kmWeek?.challenges[0].travelCost,2,'Expert travel between sites must cost $2k');
assert.equal(company.kmWeek?.challenges[0].turnoverChange,28,'A +$30k Challenge solved by a travelling expert must net +$28k turnover');
assert.equal(company.turnover,openingTurnover+28,'Challenge value and travel cost must both flow through company turnover');
let result=applyKMWeekActionV1(session,company.id,{type:'KM_WEEK_INVEST',investment:'TRAIN_EXPERT',expertId:opsExpert().id,domain:'operations'});
assert.equal(result.success,true,result.message);
assert.equal(opsExpert().domains[0].score,5);
assert.equal(company.kmWeek?.guidedTurn,2);

// Guided 2 deliberately teaches a local-team risk response rather than
// sending Priya for a second challenge in a row.
const guided2=company.kmWeek!.challenges[0];
result=applyKMWeekActionV1(session,company.id,{type:'KM_WEEK_RESOLVE',challengeId:guided2.id,method:'risk',useLocalRisk:true});
assert.equal(result.success,true,result.message);
assert.equal(guided2.resolution,'risk');
assert.ok((guided2.dieRoll||0)>=1&&(guided2.dieRoll||0)<=6,'Guided 2 must record the d6 result');
assert.equal(company.kmWeek?.phase,'invest');
const beforeRemoteTraining=company.turnover;
result=applyKMWeekActionV1(session,company.id,{type:'KM_WEEK_INVEST',investment:'LOCAL_TRAINING',expertId:opsExpert().id,siteId:'melbourne',domain:'operations'});
assert.equal(result.success,true,result.message);
assert.equal(company.sites.find(site=>site.id==='melbourne')?.teamCapability.operations,2,'Local Training must allow an expert to teach another site');
assert.equal(company.turnover,beforeRemoteTraining-12,'Remote KM Week Local Training must cost $10k plus the fixed $2k travel fee');
assert.equal(opsExpert().location,'melbourne','Local Training travel must update the expert location used by both the River and Investment panel');
assert.equal(company.kmWeek?.guidedTurn,3);

resolveGuidedExpert();
result=applyKMWeekActionV1(session,company.id,{type:'KM_WEEK_INVEST',investment:'KNOWLEDGE_TRANSFER',sourceSiteId:'melbourne',targetSiteId:'brisbane',domain:'hr'});
assert.equal(result.success,true,result.message);
assert.equal(company.sites.find(site=>site.id==='brisbane')?.teamCapability.hr,1,'Guided Knowledge Transfer must accept any valid domain/source/target choice');
assert.equal(company.kmWeek?.stage,'free');
assert.equal(company.kmWeek?.freeRound,1);
assert.equal(company.kmWeek?.challenges.length,2);
assert.equal(company.initialRiverSnapshot?.sites.find(site=>site.id==='melbourne')?.teamCapability.operations,2,'AAR Before River must snapshot each company after its guided investments, at the start of free play');
{
  const transferCompany=createInitialCompanyV2('Transfer Test','kmw-transfer-test',config);
  initialiseKMWeekCompanyV1(transferCompany);
  transferCompany.kmWeek!.stage='free';
  transferCompany.kmWeek!.phase='invest';
  transferCompany.kmWeek!.freeRound=1;
  const mel=transferCompany.sites.find(site=>site.id==='melbourne')!,bne=transferCompany.sites.find(site=>site.id==='brisbane')!;
  mel.teamCapability.marketing=5;bne.teamCapability.marketing=1;
  const transfer=investKMWeekV1(session,transferCompany,{investment:'KNOWLEDGE_TRANSFER',sourceSiteId:'melbourne',targetSiteId:'brisbane',domain:'marketing'});
  assert.equal(transfer.success,true,transfer.message);
  assert.equal(bne.teamCapability.marketing,3,'Knowledge Transfer must move half the 4-point gap, not only +1');
  assert.equal(transferCompany.kmWeek!.knowledgeTransfers,2,'Knowledge Flow score must count the number of knowledge levels actually moved');

  const weaker=createInitialCompanyV2('Weaker River','kmw-weaker',config);
  initialiseKMWeekCompanyV1(weaker);
  const stronger=structuredClone(weaker);
  stronger.id='kmw-stronger';
  stronger.kmWeek=structuredClone(weaker.kmWeek);
  stronger.sites.find(site=>site.id==='perth')!.teamCapability.operations=4;
  assert.ok(calculateKMWeekScoreV1(session,stronger).localCapability>calculateKMWeekScoreV1(session,weaker).localCapability,'A materially stronger River must produce a higher Local capability score');
}

const makeFreeInvestment=()=>{
  const trainable=company.experts.find(candidate=>candidate.domains[0].score<5);
  if(trainable){
    const skill=trainable.domains[0];
    return applyKMWeekActionV1(session,company.id,{type:'KM_WEEK_INVEST',investment:'TRAIN_EXPERT',expertId:trainable.id,domain:skill.domain});
  }
  for(const expert of company.experts){
    const skill=expert.domains[0];
    const site=company.sites.find(candidate=>!candidate.isClosed&&(candidate.teamCapability[skill.domain]||0)<skill.score);
    if(site)return applyKMWeekActionV1(session,company.id,{type:'KM_WEEK_INVEST',investment:'LOCAL_TRAINING',expertId:expert.id,siteId:site.id,domain:skill.domain});
  }
  throw new Error('Smoke test could not find a valid KM Week investment');
};

const resolveFreeRound=()=>{
  const challenges=[...company.kmWeek!.challenges];
  for(const challenge of challenges){
    const expert=company.experts.find(candidate=>candidate.domains.some(skill=>skill.domain===challenge.domain))!;
    const local=company.sites.find(site=>site.id===challenge.siteId)!.teamCapability[challenge.domain]||0;
    const canUseExpert=!company.kmWeek!.usedExpertIds.includes(expert.id);
    const method=local>=challenge.difficulty?'local':canUseExpert?'expert':'risk';
    const resolved=applyKMWeekActionV1(session,company.id,{type:'KM_WEEK_RESOLVE',challengeId:challenge.id,method,expertId:method==='expert'?expert.id:undefined,useLocalRisk:method==='risk'});
    assert.equal(resolved.success,true,resolved.message);
  }
  assert.equal(company.kmWeek?.phase,'invest');
};

// Free play is now time-based, so completing three free rounds must not by
// itself trigger the Business Shock while more than three minutes remain.
session.timerEndsAt=null;
session.timerPausedSecondsRemaining=600;
for(let round=1;round<=3;round++){
  resolveFreeRound();
  const invested=makeFreeInvestment();
  assert.equal(invested.success,true,invested.message);
}
assert.equal(company.kmWeek?.stage,'free','Free play must continue beyond three rounds when time remains');
assert.equal(company.kmWeek?.freeRound,4,'The next free-play round must open instead of forcing the Shock');

// Once the clock enters the final three minutes, finish the current round and
// the next committed investment hands directly into the Business Shock.
resolveFreeRound();
session.timerPausedSecondsRemaining=180;
const finalInvestment=makeFreeInvestment();
assert.equal(finalInvestment.success,true,finalInvestment.message);

assert.equal(company.kmWeek?.stage,'shock');
assert.ok((company.kmWeek?.score.business||0)>=0&&(company.kmWeek?.score.business||0)<=12);
const beforeShockTurnover=company.turnover;
result=applyKMWeekActionV1(session,company.id,{type:'KM_WEEK_RESOLVE_SHOCK'});
assert.equal(result.success,true,result.message);
assert.equal(company.kmWeek?.stage,'shock','Business Shock must show its result before leaving for the debrief');
assert.equal(company.kmWeek?.shockChecks.length,5);
assert.ok(company.kmWeek!.shockChecks.every(check=>Number.isFinite(check.localKnowledge)),'Business Shock result must record the local capability tested at each site');
const failedSites=new Set(company.kmWeek!.shockChecks.filter(check=>!check.passed).map(check=>check.siteId));
assert.equal(company.turnover,beforeShockTurnover-(failedSites.size*KM_WEEK_SHOCK_FAILURE_COST),'Business Shock must charge $15k once for each affected site');
assert.equal(company.kmWeek!.turnoverHistory.filter(point=>point.label.startsWith('SHOCK ')).length,failedSites.size,'Each failed site must appear as a shock cost in the turnover history');
result=applyKMWeekActionV1(session,company.id,{type:'KM_WEEK_COMPLETE_SHOCK'});
assert.equal(result.success,true,result.message);
assert.equal(company.kmWeek?.stage,'complete');
assert.ok((company.kmWeek?.turnoverHistory.length||0)>6,'KM Week must preserve turnover history for the AAR-lite graph');
assert.equal(company.kmWeek?.turnoverHistory[0].label,'START','KM Week turnover history must begin with the starting company');
assert.equal(session.finalDisruptionResolved,true,'completed KM Week session should be marked complete');
assert.ok((company.kmWeek?.score.total||0)>0);

console.log('KM Week smoke passed');
