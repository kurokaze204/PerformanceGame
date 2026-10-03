import assert from 'node:assert/strict';
import { DEFAULT_CONFIG } from '../src/engine/config.ts';
import { createInitialCompanyV2 } from '../src/engine/coreV2.ts';
import {
  applyKMWeekActionV1,
  initialiseKMWeekSessionV1,
  KM_WEEK_DOMAINS,
  KM_WEEK_SITE_IDS,
} from '../src/engine/kmWeekV1.ts';
import type { GameSessionV2 } from '../src/types/gameV2.ts';

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
assert.deepEqual(company.experts.map(expert=>expert.domains[0].domain),['operations','hr','marketing']);

const opsExpert=()=>company.experts.find(expert=>expert.domains.some(skill=>skill.domain==='operations'))!;
const resolveGuided=()=>{
  const challenge=company.kmWeek!.challenges[0];
  const result=applyKMWeekActionV1(session,company.id,{type:'KM_WEEK_RESOLVE',challengeId:challenge.id,method:'expert',expertId:opsExpert().id});
  assert.equal(result.success,true,result.message);
  assert.equal(company.kmWeek?.phase,'invest');
};

resolveGuided();
let result=applyKMWeekActionV1(session,company.id,{type:'KM_WEEK_INVEST',investment:'TRAIN_EXPERT',expertId:opsExpert().id,domain:'operations'});
assert.equal(result.success,true,result.message);
assert.equal(opsExpert().domains[0].score,5);
assert.equal(company.kmWeek?.guidedTurn,2);

resolveGuided();
result=applyKMWeekActionV1(session,company.id,{type:'KM_WEEK_INVEST',investment:'LOCAL_TRAINING',expertId:opsExpert().id,siteId:'brisbane',domain:'operations'});
assert.equal(result.success,true,result.message);
assert.equal(company.sites.find(site=>site.id==='brisbane')?.teamCapability.operations,2);
assert.equal(company.kmWeek?.guidedTurn,3);

resolveGuided();
result=applyKMWeekActionV1(session,company.id,{type:'KM_WEEK_INVEST',investment:'KNOWLEDGE_TRANSFER',sourceSiteId:'brisbane',targetSiteId:'perth',domain:'operations'});
assert.equal(result.success,true,result.message);
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
assert.equal(session.finalDisruptionResolved,true,'completed KM Week session should be marked complete');
assert.equal(company.kmWeek?.shockChecks.length,5);
assert.ok((company.kmWeek?.score.total||0)>0);

console.log('KM Week smoke passed');
