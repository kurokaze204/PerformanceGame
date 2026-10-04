import assert from 'node:assert/strict';
import { DEFAULT_CONFIG } from '../src/engine/config.ts';
import { createInitialCompanyV2 } from '../src/engine/coreV2.ts';
import {
  applyKMWeekActionV1,
  initialiseKMWeekSessionV1,
  ensureKMWeekSessionV1,
  KM_WEEK_DOMAINS,
  KM_WEEK_SITE_IDS,
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
  finalWindowMinutes:5,
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
assert.deepEqual(kmWeekRiskOddsV1(1,2),{requiredRoll:3,successfulFaces:4,chancePercent:67},'Local 1 against Requirement 2 must show a 67% risk chance requiring 3+ on d6');
assert.deepEqual(kmWeekRiskOddsV1(0,4),{requiredRoll:6,successfulFaces:1,chancePercent:17},'Risk odds must fall as the knowledge deficit grows');

const opsExpert=()=>company.experts.find(expert=>expert.domains.some(skill=>skill.domain==='operations'))!;
const resolveGuided=()=>{
  const challenge=company.kmWeek!.challenges[0];
  const result=applyKMWeekActionV1(session,company.id,{type:'KM_WEEK_RESOLVE',challengeId:challenge.id,method:'expert',expertId:opsExpert().id});
  assert.equal(result.success,true,result.message);
  assert.equal(company.kmWeek?.phase,'invest');
};

const openingTurnover=company.turnover;
// Match the main-game composition rule: Expert depth 4 + one independent local
// source = 5 total selected knowledge, so a difficulty-5 Challenge succeeds.
company.kmWeek!.challenges[0].difficulty=5;
resolveGuided();
assert.equal(company.kmWeek?.challenges[0].status,'success','Expert depth plus local breadth must use the main-game selected-knowledge calculation');
assert.equal(company.kmWeek?.challenges[0].travelCost,2,'Expert travel between sites must cost $2k');
assert.equal(company.kmWeek?.challenges[0].turnoverChange,28,'A +$30k Challenge solved by a travelling expert must net +$28k turnover');
assert.equal(company.turnover,openingTurnover+28,'Challenge value and travel cost must both flow through company turnover');
let result=applyKMWeekActionV1(session,company.id,{type:'KM_WEEK_INVEST',investment:'TRAIN_EXPERT',expertId:opsExpert().id,domain:'operations'});
assert.equal(result.success,true,result.message);
assert.equal(opsExpert().domains[0].score,5);
assert.equal(company.kmWeek?.guidedTurn,2);

// The KM Week clock is facilitation guidance, not a hard game lock. Reproduce
// the playtest case where Guided 2 is still underway after 0:00.
session.timerEndsAt=new Date(Date.now()-1000).toISOString();
session.timerPausedSecondsRemaining=null;
assert.equal(ensureKMWeekSessionV1(session),true);
assert.equal(session.timerEndsAt,null,'expired KM Week timer must be frozen rather than left running');
assert.equal(session.timerPausedSecondsRemaining,0,'expired KM Week timer must remain visibly at zero');
resolveGuided();
assert.equal(company.kmWeek?.phase,'invest','Guided Challenge must still resolve after the KM Week clock reaches zero');
result=applyKMWeekActionV1(session,company.id,{type:'KM_WEEK_INVEST',investment:'LOCAL_TRAINING',expertId:opsExpert().id,siteId:'brisbane',domain:'operations'});
assert.equal(result.success,true,result.message);
assert.equal(company.sites.find(site=>site.id==='brisbane')?.teamCapability.operations,2);
assert.equal(company.kmWeek?.guidedTurn,3);

resolveGuided();
result=applyKMWeekActionV1(session,company.id,{type:'KM_WEEK_INVEST',investment:'KNOWLEDGE_TRANSFER',sourceSiteId:'melbourne',targetSiteId:'brisbane',domain:'hr'});
assert.equal(result.success,true,result.message);
assert.equal(company.sites.find(site=>site.id==='brisbane')?.teamCapability.hr,1,'Guided Knowledge Transfer must accept any valid domain/source/target choice');
assert.equal(company.kmWeek?.stage,'free');
assert.equal(company.kmWeek?.freeRound,1);
assert.equal(company.kmWeek?.challenges.length,2);

for(let round=1;round<=3;round++){
  const challenges=[...company.kmWeek!.challenges];
  for(let index=0;index<challenges.length;index++){
    const challenge=challenges[index];
    const expert=company.experts.find(candidate=>candidate.domains.some(skill=>skill.domain===challenge.domain))!;
    const local=company.sites.find(site=>site.id===challenge.siteId)!.teamCapability[challenge.domain]||0;
    const canUseExpert=!company.kmWeek!.usedExpertIds.includes(expert.id);
    const method=local>=challenge.difficulty?'local':canUseExpert?'expert':'risk';
    const resolved=applyKMWeekActionV1(session,company.id,{type:'KM_WEEK_RESOLVE',challengeId:challenge.id,method,expertId:method==='expert'?expert.id:undefined});
    assert.equal(resolved.success,true,resolved.message);
  }
  assert.equal(company.kmWeek?.phase,'invest');
  const expert=company.experts.find(candidate=>candidate.domains[0].score<5)||company.experts[0];
  const skill=expert.domains[0];
  if(skill.score<5){
    const invested=applyKMWeekActionV1(session,company.id,{type:'KM_WEEK_INVEST',investment:'TRAIN_EXPERT',expertId:expert.id,domain:skill.domain});
    assert.equal(invested.success,true,invested.message);
  }else{
    const source=company.sites.find(site=>site.id==='brisbane')!;
    const target=company.sites.find(site=>site.id==='perth')!;
    const domain='operations';
    if((source.teamCapability[domain]||0)>(target.teamCapability[domain]||0)){
      const invested=applyKMWeekActionV1(session,company.id,{type:'KM_WEEK_INVEST',investment:'KNOWLEDGE_TRANSFER',sourceSiteId:source.id,targetSiteId:target.id,domain});
      assert.equal(invested.success,true,invested.message);
    }else{
      const trainer=company.experts.find(candidate=>candidate.location==='perth'&&candidate.domains.some(s=>s.domain==='operations'))!;
      const invested=applyKMWeekActionV1(session,company.id,{type:'KM_WEEK_INVEST',investment:'LOCAL_TRAINING',expertId:trainer.id,siteId:'perth',domain:'operations'});
      assert.equal(invested.success,true,invested.message);
    }
  }
}

assert.equal(company.kmWeek?.stage,'shock');
assert.ok((company.kmWeek?.score.business||0)>=0&&(company.kmWeek?.score.business||0)<=12);
result=applyKMWeekActionV1(session,company.id,{type:'KM_WEEK_RESOLVE_SHOCK'});
assert.equal(result.success,true,result.message);
assert.equal(company.kmWeek?.stage,'complete');
assert.ok((company.kmWeek?.turnoverHistory.length||0)>6,'KM Week must preserve turnover history for the AAR-lite graph');
assert.equal(company.kmWeek?.turnoverHistory[0].label,'START','KM Week turnover history must begin with the starting company');
assert.equal(session.finalDisruptionResolved,true,'completed KM Week session should be marked complete');
assert.equal(company.kmWeek?.shockChecks.length,5);
assert.ok((company.kmWeek?.score.total||0)>0);

console.log('KM Week smoke passed');
