import assert from 'node:assert/strict';
import { DEFAULT_CONFIG } from '../src/engine/config.ts';
import { createInitialCompanyV2 } from '../src/engine/coreV2.ts';
import {
  applyKMWeekActionV1,
  initialiseKMWeekSessionV1,
  initialiseKMWeekCompanyV1,
  investKMWeekV1,
  calculateKMWeekScoreV1,
  kmWeekFinalTurnoverPointsV1,
  KM_WEEK_DOMAINS,
  KM_WEEK_SITE_IDS,
  KM_WEEK_SHOCK_GAP_COST,
  KM_WEEK_MAX_EXPERT_KNOWLEDGE,
  freeChallengesForRound,
  kmWeekRiskOddsV1,
  kmWeekAARCandidatesV1,
  KM_WEEK_AAR_COST,
  KM_WEEK_AAR_UNLOCK_ROUND,
} from '../src/engine/kmWeekV1.ts';
import type { GameSessionV2 } from '../src/types/gameV2.ts';
import { riverSiteKnowledgeScore } from '../src/engine/riverKnowledgeV1.ts';
import { kmWeekCoachV1 } from '../src/engine/kmWeekCoachV1.ts';

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
assert.deepEqual(kmWeekRiskOddsV1(1,2),{performanceGap:1,requiredRoll:2,successfulFaces:5,chancePercent:83},'A one-point performance gap must still carry risk and require 2+ on d6');
assert.deepEqual(kmWeekRiskOddsV1(0,4),{performanceGap:4,requiredRoll:5,successfulFaces:2,chancePercent:33},'Risk odds must worsen as the remaining performance gap grows');

{
  const rounds=Array.from({length:6},(_,index)=>freeChallengesForRound(session,company,index+1));
  const signatures=rounds.map(cards=>cards.map(card=>card.domain+':'+card.difficulty).sort().join('|')).sort();
  const expected=[
    'hr:2|marketing:3',
    'hr:3|marketing:4',
    'marketing:4|operations:8',
    'operations:4|operations:6',
    'marketing:5|operations:4',
    'marketing:5|marketing:6',
  ].sort();
  assert.deepEqual(signatures,expected,'Each six-round cycle must contain the agreed six challenge-value profiles exactly once');
  assert.equal(rounds.filter(cards=>cards[0].domain===cards[1].domain&&cards.every(card=>card.difficulty>2)).length,2,'Each cycle must contain two later same-domain expert-bottleneck rounds');
  assert.deepEqual(rounds[0].map(card=>card.domain+':'+card.difficulty).sort(),['hr:2','marketing:3'],'The first full round must remain approachable for new players');
  assert.ok(rounds.flat().every(card=>card.impact===card.difficulty*15),'Free-play business impact must scale at $15k per required knowledge level');
  assert.ok(rounds.every(cards=>cards[0].siteId!==cards[1].siteId),'The two Challenges in a round must be assigned to different sites');
  assert.equal(new Set(rounds.flat().map(card=>card.title)).size,12,'Story descriptions must not repeat within a six-round cycle');
  const secondCycle=Array.from({length:6},(_,index)=>freeChallengesForRound(session,company,index+7));
  assert.deepEqual(secondCycle.flat().length,12,'A new six-round cycle must generate another twelve Challenges from the same six value profiles');
  const thirdCycle=Array.from({length:6},(_,index)=>freeChallengesForRound(session,company,index+13));
  const profileSignature=(cycleCards:typeof rounds,increment:number)=>cycleCards.map(cards=>
   cards.map(card=>card.domain+':'+(card.difficulty-increment)).sort().join('|')
  ).sort();
  assert.deepEqual(profileSignature(secondCycle,1),signatures,'Every Challenge requirement must increase by one in free-play rounds 7–12');
  assert.deepEqual(profileSignature(thirdCycle,2),signatures,'Every Challenge requirement must increase by two in rounds 13–18');
  assert.deepEqual(secondCycle[0].map(card=>card.difficulty),rounds[0].map(card=>card.difficulty+1),'The approachable opening profile must increase by one when the deck repeats');
  assert.ok(secondCycle.flat().every(card=>card.impact===(card.difficulty-1)*15),'A higher Challenge knowledge requirement must not silently change the existing financial impact');
  assert.ok(thirdCycle.flat().every(card=>card.impact===(card.difficulty-2)*15),'Monetary consequences should still be based on the original six profiles after two rotations');
  assert.deepEqual(freeChallengesForRound(session,company,7),secondCycle[0],'Escalated rounds must remain reproducible for a given game');
}

{
  const scoreProbe=createInitialCompanyV2('Business Score Test','kmw-score-test',config);
  initialiseKMWeekCompanyV1(scoreProbe);
  scoreProbe.kmWeek!.businessDifficultySolved=28;
  assert.equal(calculateKMWeekScoreV1(session,scoreProbe).business,6,'Business Performance must scale with Challenge difficulty solved, not raw win count');
  scoreProbe.kmWeek!.businessDifficultySolved=54;
  assert.equal(calculateKMWeekScoreV1(session,scoreProbe).business,12,'Solving the full six-round difficulty load must earn the full 12 Business Performance points');
}

{
  const retireCompany=createInitialCompanyV2('Retirement Test','kmw-retirement',config);
  const retireSession={...session,id:'KMWEEKRETIRE',companies:[retireCompany],activeEvents:{},participants:[],timerEndsAt:null,timerPausedSecondsRemaining:600} as GameSessionV2;
  initialiseKMWeekSessionV1(retireSession);
  const retireState=retireCompany.kmWeek!;
  retireState.stage='free';
  retireState.phase='challenge';
  retireState.freeRound=5;
  retireCompany.round=8;
  const ops=retireCompany.experts.find(expert=>expert.domains.some(skill=>skill.domain==='operations'))!;
  const hr=retireCompany.experts.find(expert=>expert.domains.some(skill=>skill.domain==='hr'))!;
  ops.domains[0].score=6;
  hr.domains[0].score=5;
  retireCompany.sites.find(site=>site.id==='melbourne')!.teamCapability.operations=4;
  retireState.challenges=[{id:'RETIRE-R5',title:'Retirement trigger',story:'Test',siteId:'brisbane',domain:'operations',difficulty:1,impact:15,status:'open'}];
  let retirementResult=applyKMWeekActionV1(retireSession,retireCompany.id,{type:'KM_WEEK_RESOLVE',challengeId:'RETIRE-R5',method:'local'});
  assert.equal(retirementResult.success,true,retirementResult.message);
  assert.equal(retireState.phase,'invest');
  assert.equal(retireState.expertRetirement?.retiredName,ops.name,'The highest-scoring expert must retire after free Round 5 Challenges');
  assert.equal(retireState.expertRetirement?.retiredScore,6);
  assert.equal(ops.isVacant,true,'The retired expert must disappear from the active expert pool');

  const retiredName=retireState.expertRetirement!.retiredName;
  retirementResult=applyKMWeekActionV1(retireSession,retireCompany.id,{type:'KM_WEEK_INVEST',investment:'TRAIN_EXPERT',expertId:hr.id,domain:'hr'});
  assert.equal(retirementResult.success,true,retirementResult.message);
  assert.equal(retireState.freeRound,6);
  assert.equal(ops.isVacant,true,'The retired expert must remain absent throughout the next Challenge round');

  retireState.challenges=[{id:'REPLACE-R6',title:'Replacement trigger',story:'Test',siteId:'brisbane',domain:'operations',difficulty:1,impact:15,status:'open'}];
  retirementResult=applyKMWeekActionV1(retireSession,retireCompany.id,{type:'KM_WEEK_RESOLVE',challengeId:'REPLACE-R6',method:'local'});
  assert.equal(retirementResult.success,true,retirementResult.message);
  assert.equal(retireState.phase,'invest');
  assert.equal(retireState.expertRetirement?.status,'replaced','The replacement must arrive at the next round Invest phase');
  assert.equal(ops.isVacant,false);
  assert.notEqual(ops.name,retiredName,'The replacement expert must have a new name');
  assert.equal(ops.domains[0].score,4,'Replacement expertise must be Knowledge 3 or the strongest site score, whichever is higher');
}

{
  const failCompany=createInitialCompanyV2('Shortfall Test','kmw-shortfall',config);
  const failSession={...session,id:'KMWEEKSHORTFALL',companies:[failCompany],activeEvents:{},participants:[],timerEndsAt:null,timerPausedSecondsRemaining:600} as GameSessionV2;
  initialiseKMWeekSessionV1(failSession);
  const failState=failCompany.kmWeek!;
  failState.stage='free';
  failState.phase='challenge';
  failState.freeRound=1;
  failCompany.round=4;
  const failSite=failCompany.sites.find(site=>site.id==='brisbane')!;
  failSite.teamCapability.operations=1;
  failState.challenges=[{id:'SHORTFALL',title:'Capability shortfall',story:'Test',siteId:'brisbane',domain:'operations',difficulty:4,impact:60,status:'open'}];
  const beforeFailure=failCompany.turnover;
  const failed=applyKMWeekActionV1(failSession,failCompany.id,{type:'KM_WEEK_RESOLVE',challengeId:'SHORTFALL',method:'local'});
  assert.equal(failed.success,true,'A committed underpowered free-play response must resolve as a real business outcome');
  assert.equal(failState.challenges[0].status,'failure','Knowledge 1 committed against Knowledge 4 must fail rather than return an invalid-move error');
  assert.equal(failCompany.turnover,beforeFailure-60,'A committed knowledge shortfall must apply the full business loss');
  assert.equal(failState.turnoverHistory.at(-1)?.challengeResult,'failure','Final AAR history must retain red failure markers independent of the next investment');
  assert.equal(failState.phase,'invest','A failed committed response must still complete the Challenge and move the game forward');
}

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
assert.equal(company.kmWeek!.turnoverHistory.at(-1)?.challengeResult,'success','Final AAR history must retain actual wins, even when their net turnover includes travel fees');
let result=applyKMWeekActionV1(session,company.id,{type:'KM_WEEK_INVEST',investment:'TRAIN_EXPERT',expertId:opsExpert().id,domain:'operations'});
assert.equal(result.success,true,result.message);
assert.equal(opsExpert().domains[0].score,5);
assert.equal(company.kmWeek?.guidedTurn,2);

// Guided 2 uses Human Resources so the local team or Marcus can respond
// without bringing Priya back in straight after her first investment.
const guided2=company.kmWeek!.challenges[0];
assert.equal(guided2.domain,'hr','Guided 2 should introduce HR rather than require Priya again');
assert.equal(guided2.siteId,'melbourne');
const melbourneHR=company.sites.find(site=>site.id==='melbourne')?.teamCapability.hr||0;
assert.ok(melbourneHR>=guided2.difficulty,'Guided 2 must be solvable by Melbourne local HR');
result=applyKMWeekActionV1(session,company.id,{type:'KM_WEEK_RESOLVE',challengeId:guided2.id,method:'local'});
assert.equal(result.success,true,result.message);
assert.equal(guided2.status,'success');
assert.equal(guided2.resolution,'local');
assert.equal(company.kmWeek?.phase,'invest');
const beforeRemoteTraining=company.turnover;
result=applyKMWeekActionV1(session,company.id,{type:'KM_WEEK_INVEST',investment:'LOCAL_TRAINING',expertId:opsExpert().id,siteId:'melbourne',domain:'operations'});
assert.equal(result.success,true,result.message);
assert.equal(company.sites.find(site=>site.id==='melbourne')?.teamCapability.operations,3,'Local Training must allow an expert to teach another site');
assert.equal(company.turnover,beforeRemoteTraining-12,'Remote KM Week Local Training must cost $10k plus the fixed $2k travel fee');
assert.equal(opsExpert().location,'melbourne','Local Training travel must update the expert location used by both the River and Investment panel');
assert.equal(company.kmWeek?.guidedTurn,3);

const busyChallenge=company.kmWeek!.challenges[0];
assert.equal(busyChallenge.domain,'marketing','Guided 3 must offer another domain while Priya trains');
const blocked=applyKMWeekActionV1(session,company.id,{type:'KM_WEEK_RESOLVE',challengeId:busyChallenge.id,method:'expert',expertId:opsExpert().id});
assert.equal(blocked.success,false,'A site trainer must be unavailable next round');
assert.match(blocked.message,/Busy training staff/);
const marketingExpert=company.experts.find(expert=>expert.domains.some(skill=>skill.domain==='marketing'))!;
const availableExpert=applyKMWeekActionV1(session,company.id,{type:'KM_WEEK_RESOLVE',challengeId:busyChallenge.id,method:'expert',expertId:marketingExpert.id});
assert.equal(availableExpert.success,true,availableExpert.message);
assert.equal(busyChallenge.status,'success','Mary should be able to solve Guided 3 while Priya is training');
result=applyKMWeekActionV1(session,company.id,{type:'KM_WEEK_INVEST',investment:'KNOWLEDGE_TRANSFER',sourceSiteId:'melbourne',targetSiteId:'brisbane',domain:'hr'});
assert.equal(result.success,true,result.message);
assert.equal(company.sites.find(site=>site.id==='brisbane')?.teamCapability.hr,1,'Guided Knowledge Transfer must accept any valid domain/source/target choice');
assert.equal(company.kmWeek?.stage,'free');
assert.equal(company.kmWeek?.freeRound,1);
{
  const coach=kmWeekCoachV1(company);
  assert.ok(coach?.text&&coach.domain,'The first full-play round must offer a River-informed coaching question');
  const originalFreeRound=company.kmWeek!.freeRound;
  const originalRound=company.round;
  company.kmWeek!.freeRound=6;
  company.round=9;
  assert.ok(kmWeekCoachV1(company)?.text,'Coaching must still appear in the sixth full round, even though the company turn number is nine');
  company.kmWeek!.freeRound=7;
  assert.equal(kmWeekCoachV1(company),null,'Coaching must stop after the sixth full round');
  company.kmWeek!.stage='guided';
  company.kmWeek!.freeRound=1;
  assert.equal(kmWeekCoachV1(company),null,'The introductory guided rounds must not count towards the six River coaching questions');
  company.kmWeek!.stage='free';
  company.kmWeek!.freeRound=originalFreeRound;
  company.round=originalRound;
}
assert.notEqual(company.kmWeek?.trainingCommitments?.[opsExpert().id],company.round,'Trainer must return after one round');
assert.equal(company.kmWeek?.challenges.length,2);
assert.ok(company.kmWeek!.challenges[0].siteId!==company.kmWeek!.challenges[1].siteId,'Free-play Challenges must be assigned to different sites');
assert.equal(company.initialRiverSnapshot?.sites.find(site=>site.id==='melbourne')?.teamCapability.operations,3,'AAR Before River must snapshot each company after its guided investments, at the start of free play');
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
  const trainable=company.experts.find(candidate=>candidate.domains[0].score<KM_WEEK_MAX_EXPERT_KNOWLEDGE);
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
// itself trigger the Site Audits while more than three minutes remain.
session.timerEndsAt=null;
session.timerPausedSecondsRemaining=600;
for(let round=1;round<=3;round++){
  resolveFreeRound();
  const invested=makeFreeInvestment();
  assert.equal(invested.success,true,invested.message);
}
assert.equal(company.kmWeek?.stage,'free','Free play must continue beyond three rounds when time remains');
assert.equal(company.kmWeek?.freeRound,4,'The next free-play round must open instead of forcing the audits');
assert.ok(company.kmWeek!.challenges[0].siteId!==company.kmWeek!.challenges[1].siteId,'Every shuffled free-play round must use two different sites');

// Once the clock enters the final three minutes, finish the current round and
// the next committed investment hands directly into the Site Audits.
resolveFreeRound();
session.timerPausedSecondsRemaining=180;
const finalInvestment=makeFreeInvestment();
assert.equal(finalInvestment.success,true,finalInvestment.message);

assert.equal(company.kmWeek?.stage,'shock');
assert.ok((company.kmWeek?.score.business||0)>=0&&(company.kmWeek?.score.business||0)<=12);
const beforeShockTurnover=company.turnover;
// A low-dice audit run should reveal every local capability shortfall,
// while sites meeting their standards must clear automatically.
const naturalRandom=Math.random;
Math.random=()=>0;
try{result=applyKMWeekActionV1(session,company.id,{type:'KM_WEEK_RESOLVE_SHOCK'});}
finally{Math.random=naturalRandom;}
assert.equal(result.success,true,result.message);
assert.equal(company.kmWeek?.stage,'shock','Site Audits result must stay visible before the debrief');
assert.equal(company.kmWeek?.shockChecks.length,5);
assert.ok(company.kmWeek!.shockChecks.every(check=>Number.isFinite(check.localKnowledge)),'Every audit must persist the tested local capability');
for(const check of company.kmWeek!.shockChecks){
 const gap=Math.max(0,check.difficulty-check.localKnowledge);
 assert.equal(check.passed,gap===0,'A minimum audit roll must find a shortfall; fully capable sites always clear');
 if(gap)assert.equal(check.dieRoll,1,'Audits must record their individual d6 detection rolls');
}
const missingKnowledge=company.kmWeek!.shockChecks.filter(check=>!check.passed).reduce((sum,check)=>sum+Math.max(0,check.difficulty-check.localKnowledge),0);
const auditFines=missingKnowledge*KM_WEEK_SHOCK_GAP_COST;
assert.equal(KM_WEEK_SHOCK_GAP_COST,40,'Each non-compliance knowledge point now attracts a $40k fine');
assert.equal(company.turnover,Math.max(0,beforeShockTurnover-auditFines),'Site Audits must apply double the previous financial penalty');
assert.equal(company.kmWeek!.auditTurnoverBefore,beforeShockTurnover,'Audit presentation must retain turnover before fines for the orb animation');
assert.equal(company.kmWeek!.auditFineTotal,auditFines);
assert.equal(company.kmWeek!.turnoverHistory.filter(point=>point.label.startsWith('SITE AUDITS ')).length,1,'Site Audits should remain one explicit turnover event in the final graph');
assert.ok(company.kmWeek!.turnoverHistory.some(point=>point.label===`SITE AUDITS -${auditFines}k`),'The graph should preserve the exact fine amount');
assert.equal(company.kmWeek!.score.resilience,company.kmWeek!.shockChecks.filter(check=>check.passed).length,'Without a clean sweep only cleared audits score points');

// Conversely a company meeting every local standard clears all five audits,
// pays no fines and gains an additional ten Squeaky clean score points.
const cleanCompany=createInitialCompanyV2('Clean Audit Co','kmw-clean-audit',config);
initialiseKMWeekCompanyV1(cleanCompany);
cleanCompany.kmWeek!.stage='shock';
for(const site of cleanCompany.sites)for(const domain of KM_WEEK_DOMAINS)site.teamCapability[domain]=5;
const cleanSession={...session,companies:[cleanCompany]} as GameSessionV2;
const cleanBefore=cleanCompany.turnover;
const cleanResult=applyKMWeekActionV1(cleanSession,cleanCompany.id,{type:'KM_WEEK_RESOLVE_SHOCK'});
assert.equal(cleanResult.success,true,cleanResult.message);
assert.ok(cleanCompany.kmWeek!.shockChecks.every(check=>check.passed&&check.dieRoll===undefined));
assert.equal(cleanCompany.kmWeek!.score.resilience,15,'Five cleared audits plus ten bonus Squeaky clean points must total fifteen');
assert.equal(cleanCompany.turnover,cleanBefore,'A clean audit earns no fine');
result=applyKMWeekActionV1(session,company.id,{type:'KM_WEEK_COMPLETE_SHOCK'});
assert.equal(result.success,true,result.message);
assert.equal(company.kmWeek?.stage,'complete');
assert.ok((company.kmWeek?.turnoverHistory.length||0)>6,'KM Week must preserve turnover history for the AAR-lite graph');
assert.equal(company.kmWeek?.turnoverHistory[0].label,'START','KM Week turnover history must begin with the starting company');
assert.equal(session.finalDisruptionResolved,true,'completed KM Week session should be marked complete');
assert.ok((company.kmWeek?.score.total||0)>0);


// Final turnover ranking is worth 7 / 4 / 2 points after all participating
// companies finish. Earlier finishers must receive their points when the last
// team completes, and ties share the same place rather than depend on ordering.
{
 const teams=['First','Second','Third','Fourth'].map((name,index)=>{
  const team=createInitialCompanyV2(name,'kmw-turnover-'+index,config);
  initialiseKMWeekCompanyV1(team);
  team.turnover=1000-index*100;
  team.kmWeek!.stage=index===3?'shock':'complete';
  team.kmWeek!.shockResolved=true;
  return team;
 });
 const rankedSession={...session,id:'KMWEEK-RANK-TEST',companies:teams,participants:[],finalDisruptionResolved:false} as GameSessionV2;
 assert.deepEqual(teams.map(team=>kmWeekFinalTurnoverPointsV1(rankedSession,team)),[0,0,0,0],'No team should receive turnover placement points before every team finishes');
 for(const team of teams.slice(0,3))team.kmWeek!.score=calculateKMWeekScoreV1(rankedSession,team);
 const finish=applyKMWeekActionV1(rankedSession,teams[3].id,{type:'KM_WEEK_COMPLETE_SHOCK'});
 assert.equal(finish.success,true,finish.message);
 assert.equal(rankedSession.finalDisruptionResolved,true,'Workshop final scores must be settled when the last team finishes');
 assert.deepEqual(teams.map(team=>team.kmWeek!.score.turnover),[7,4,2,0],'Final turnover placement must award first 7, second 4, third 2, fourth zero');
 for(const team of teams){
  const {total,...parts}=team.kmWeek!.score;
  assert.equal(total,Object.values(parts).reduce((a,b)=>a+b,0),'Each final Score Pad total must include its turnover placement points');
 }
 teams[1].turnover=teams[0].turnover;
 assert.deepEqual(teams.map(team=>kmWeekFinalTurnoverPointsV1(rankedSession,team)),[7,7,2,0],'Tied first-place turnover shares seven points, and the next company is third');
}


// After the seventh full-play round, tough resolved Challenges can produce a
// one-off After Action Review investment. The company's specialist facilitates
// automatically, even when a failure requires a larger learning uplift.
{
 assert.equal(KM_WEEK_AAR_COST,50);
 assert.equal(KM_WEEK_AAR_UNLOCK_ROUND,7);
 const makeReview=(status:'success'|'failure',startingSite:number,startingExpert:number)=>{
  const co=createInitialCompanyV2('Lessons Review '+status,'kmw-aar-'+status,config);
  initialiseKMWeekCompanyV1(co);
  const st=co.kmWeek!;
  st.stage='free';st.phase='invest';st.freeRound=3;co.round=6;
  const site=co.sites.find(site=>site.id==='brisbane')!;
  const expert=co.experts.find(expert=>expert.domains.some(skill=>skill.domain==='operations'))!;
  const skill=expert.domains.find(skill=>skill.domain==='operations')!;
  site.teamCapability.operations=startingSite;
  skill.score=startingExpert;
  st.challenges=[
   {id:'TOUGH',title:'Maintenance crisis',story:'Difficult incident',siteId:site.id,domain:'operations',difficulty:6,impact:90,status},
   {id:'EASY',title:'Minor delay',story:'Routine',siteId:site.id,domain:'operations',difficulty:4,impact:20,status:'success'},
  ];
  const s={...session,companies:[co]} as GameSessionV2;
  assert.deepEqual(kmWeekAARCandidatesV1(co),[],'The AAR must stay unavailable before the seventh game-round Challenge is resolved');
  assert.equal(investKMWeekV1(s,co,{investment:'AFTER_ACTION_REVIEW',challengeId:'TOUGH'}).success,false,'Server must reject early reviews');
  st.freeRound=4;co.round=7;
  assert.deepEqual(kmWeekAARCandidatesV1(co).map(challenge=>challenge.id),['TOUGH'],'Only completed Challenges needing at least five may be reviewed');
  assert.equal(investKMWeekV1(s,co,{investment:'AFTER_ACTION_REVIEW',challengeId:'EASY'}).success,false,'A review must not be available for an easy Challenge');
  const beforeTurnover=co.turnover;
  const result=investKMWeekV1(s,co,{investment:'AFTER_ACTION_REVIEW',challengeId:'TOUGH'});
  assert.equal(result.success,true,result.message);
  assert.equal(co.turnover,beforeTurnover-50,'AAR must deduct $50k');
  assert.equal(co.kmWeek!.investmentHistory.at(-1)?.type,'AFTER_ACTION_REVIEW');
  assert.equal(co.kmWeek!.investmentHistory.at(-1)?.challengeId,'TOUGH');
  assert.equal(co.kmWeek!.investmentHistory.at(-1)?.expertId,expert.id,'The company domain expert facilitates automatically');
  return {site,skill,co};
 };
 const won=makeReview('success',2,4);
 assert.equal(won.site.teamCapability.operations,3,'Success should improve local knowledge by one');
 assert.equal(won.skill.score,5,'Success should improve the facilitating expert by one');
 const lost=makeReview('failure',4,5);
 assert.equal(lost.site.teamCapability.operations,5,'Failure should improve site knowledge by two, capped at five');
 assert.equal(lost.skill.score,6,'Failure should improve the expert by two, capped at six');
}
console.log('KM Week smoke passed');
