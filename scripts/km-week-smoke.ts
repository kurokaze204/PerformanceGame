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
  kmWeekFinalTurnoverPointsV1,
  KM_WEEK_DOMAINS,
  KM_WEEK_GOALS,
  KM_WEEK_SITE_IDS,
  kmWeekGuidedTrainingSiteV1,
  kmWeekGuidedTransferV1,
  KM_WEEK_SHOCK_GAP_COST,
  KM_WEEK_DEEP_BENCH_TARGET,
  freeChallengesForRound,
  kmWeekRiskOddsV1,
  kmWeekAARCandidatesV1,
  kmWeekAvailableInvestmentExpertV1,
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
for(const domain of KM_WEEK_DOMAINS){
 assert.deepEqual(KM_WEEK_SITE_IDS.map(id=>company.sites.find(site=>site.id===id)!.teamCapability[domain]).sort(),[0,1,2],'KM Week starts each domain with the same 2/1/0 budget across its sites');
}
for(const site of company.sites.filter(site=>!site.isClosed)){
  for(const domain of KM_WEEK_DOMAINS)assert.equal(riverSiteKnowledgeScore(site,domain,'km_week'),site.teamCapability[domain]||0,'KM Week River must exactly match the visible site score');
}
assert.deepEqual(company.experts.map(expert=>expert.domains[0].domain),['operations','hr','marketing']);
assert.deepEqual(company.experts.map(expert=>expert.domains[0].score).sort(),[4,5,5],'Two KM Week specialists must start at five and the third at four');
assert.notEqual(company.kmWeek!.challenges[0].siteId,'melbourne','The first expert tutorial should teach deploying Priya to another city');
assert.ok((company.sites.find(site=>site.id===company.kmWeek!.challenges[0].siteId)!.teamCapability.operations||0)>0,'First guided scenario must pick a site where local breadth is present');
{
 // Random legacy starting data must be replaced with the standard KM Week baseline
 // for every company, including one created after the session has begun.
 const newcomer=createInitialCompanyV2('Late Arrival','kmw-late-arrival',config);
 initialiseKMWeekCompanyV1(newcomer,session.id);
 const initialSignature=(co:typeof company)=>({
  sites:KM_WEEK_SITE_IDS.map(siteId=>{
   const site=co.sites.find(item=>item.id===siteId)!;
   return [site.id,...KM_WEEK_DOMAINS.map(domain=>site.teamCapability[domain]||0),site.turnover];
  }),
  experts:co.experts.map(expert=>[expert.domains[0]?.domain,expert.domains[0]?.score,expert.isVacant]),
  turnover:co.turnover,
  stage:co.kmWeek?.stage,
  guidedTurn:co.kmWeek?.guidedTurn,
 });
 assert.deepEqual(initialSignature(newcomer),initialSignature(company),'Late-joining KM Week companies must have exactly the same starting knowledge, experts, turnover and tutorial state');
 assert.deepEqual(newcomer.initialRiverSnapshot?.sites,newcomer.sites,'The final AAR snapshot must capture the original sites');
 assert.deepEqual(newcomer.initialRiverSnapshot?.experts,newcomer.experts,'The final AAR snapshot must capture the original experts');
}
// Regression: one company was created on an older release, while the others
// joined after the shared-seed fix. Repair only untouched Guided-1 companies,
// and populate all starting Score Pads rather than leaving joiners at zero.
{
 const repairSession={...session,id:'KMW-REPAIR-SESSION',companies:[],activeEvents:{},participants:[],timerStartedAt:null,timerEndsAt:null,timerPausedSecondsRemaining:1200} as GameSessionV2;
 const first=createInitialCompanyV2('Apex','kmw-repair-1',config);
 const second=createInitialCompanyV2('Vanguard','kmw-repair-2',config);
 const third=createInitialCompanyV2('Horizon','kmw-repair-3',config);
 repairSession.companies=[first];
 initialiseKMWeekSessionV1(repairSession);
 for(const other of [second,third]){
  initialiseKMWeekCompanyV1(other,repairSession.id);
  other.kmWeek!.score={business:0,expertise:0,localCapability:0,knowledgeFlow:0,resilience:0,goal:0,turnover:0,total:0};
  repairSession.companies.push(other);
 }
 first.sites.find(site=>site.id==='brisbane')!.teamCapability.operations=3;
 first.initialRiverSnapshot!.sites.find(site=>site.id==='brisbane')!.teamCapability.operations=3;
 assert.equal(first.kmWeek!.challenges[0].status,'open');
 assert.equal(first.kmWeek!.guidedTurn,1);
 assert.equal(ensureKMWeekSessionV1(repairSession),true,'Inconsistent, untouched starting boards and zeroed Score Pads must be healed');
 for(const domain of KM_WEEK_DOMAINS){
  const base=KM_WEEK_SITE_IDS.map(id=>first.sites.find(site=>site.id===id)!.teamCapability[domain]);
  assert.deepEqual([...base].sort(),[0,1,2]);
  for(const other of [second,third])assert.deepEqual(KM_WEEK_SITE_IDS.map(id=>other.sites.find(site=>site.id===id)!.teamCapability[domain]),base,'All three companies must get the identical site allocation');
 }
 assert.deepEqual(first.experts.map(e=>e.domains[0].score),second.experts.map(e=>e.domains[0].score),'Expert scores must be equal across all three companies');
 const scores=repairSession.companies.map(c=>c.kmWeek!.score.total);
 assert.ok(scores[0]>0,'Starting knowledge contributes to the Score Pad');
 assert.deepEqual(scores,[scores[0],scores[0],scores[0]],'Late-joining company Score Pads must match the first company rather than remain at zero');
 assert.equal(ensureKMWeekSessionV1(repairSession),false,'Already repaired session must not trigger repeated writes');
 // Preserve gameplay and knowledge already gained by an active company.
 first.kmWeek!.guidedTurn=2;
 first.kmWeek!.challenges=[{...first.kmWeek!.challenges[0],id:'G2',status:'open'}];
 first.sites.find(site=>site.id==='brisbane')!.teamCapability.operations=9;
 assert.equal(ensureKMWeekSessionV1(repairSession),true,'Progressed knowledge can update the Score Pad without resetting the company');
 assert.equal(first.kmWeek!.guidedTurn,2,'Progressed guided rounds must not restart');
 assert.equal(first.sites.find(site=>site.id==='brisbane')!.teamCapability.operations,9,'Actual gameplay progress must remain untouched');
 assert.equal(ensureKMWeekSessionV1(repairSession),false,'A reconciled and scored progressed company should require no further writes');
}
// Different workshops see different shuffled starting Rivers, but each
// company's three guided lessons must remain valid for every session seed.
for(let sample=0;sample<18;sample++){
 const variantSession={...session,id:`KMWSTART-${sample}`,companies:[],activeEvents:{},participants:[],timerEndsAt:null,timerPausedSecondsRemaining:1200} as GameSessionV2;
 const a=createInitialCompanyV2('First','kmw-sample-a-'+sample,config);
 const b=createInitialCompanyV2('Second','kmw-sample-b-'+sample,config);
 variantSession.companies=[a,b];
 initialiseKMWeekSessionV1(variantSession);
 for(const domain of KM_WEEK_DOMAINS){
  const first=KM_WEEK_SITE_IDS.map(id=>a.sites.find(site=>site.id===id)!.teamCapability[domain]);
  const second=KM_WEEK_SITE_IDS.map(id=>b.sites.find(site=>site.id===id)!.teamCapability[domain]);
  assert.deepEqual(first,second,'Same-session companies must get identical per-domain allocation regardless of company ID');
  assert.deepEqual([...first].sort(),[0,1,2],'Every knowledge-domain budget must be exactly three');
 }
 assert.deepEqual(a.experts.map(expert=>expert.domains[0].score),b.experts.map(expert=>expert.domains[0].score),'Starting experts must be identical within the session');
 const specialist=(domain:string)=>a.experts.find(expert=>expert.domains.some(skill=>skill.domain===domain))!;
 const focus=a.kmWeek!.pressureDomain!;
 const focusPosition=KM_WEEK_DOMAINS.indexOf(focus);
 const other=[KM_WEEK_DOMAINS[(focusPosition+1)%3],KM_WEEK_DOMAINS[(focusPosition+2)%3]];
 assert.equal(b.kmWeek!.pressureDomain,focus,'Every company in the workshop must share the selected business pressure');
 const first=a.kmWeek!.challenges[0];
 assert.equal(first.domain,focus,'The first expert tutorial must follow the selected domain');
 assert.ok((a.sites.find(site=>site.id===first.siteId)!.teamCapability[focus]||0)>0,'First guided problem needs real breadth');
 assert.notEqual(first.siteId,specialist(focus).location,'First guided problem should involve expert travel');
 let action=applyKMWeekActionV1(variantSession,a.id,{type:'KM_WEEK_RESOLVE',challengeId:first.id,method:'expert',expertId:specialist(focus).id,includeLocalBreadth:true});
 assert.ok(action.success,action.message);
 action=applyKMWeekActionV1(variantSession,a.id,{type:'KM_WEEK_INVEST',investment:'TRAIN_EXPERT',expertId:specialist(focus).id,domain:focus});
 assert.ok(action.success,action.message);
 const second=a.kmWeek!.challenges[0];
 assert.equal(second.domain,other[0],'Guided 2 must introduce another business domain');
 assert.ok((a.sites.find(site=>site.id===second.siteId)!.teamCapability[other[0]]||0)>=second.difficulty,'Guided local challenge must remain winnable');
 action=applyKMWeekActionV1(variantSession,a.id,{type:'KM_WEEK_RESOLVE',challengeId:second.id,method:'local'});
 assert.ok(action.success,action.message);
 const trainingSiteId=kmWeekGuidedTrainingSiteV1(a);
 action=applyKMWeekActionV1(variantSession,a.id,{type:'KM_WEEK_INVEST',investment:'LOCAL_TRAINING',expertId:specialist(focus).id,siteId:trainingSiteId,domain:focus});
 assert.ok(action.success,action.message);
 const third=a.kmWeek!.challenges[0];
 assert.equal(third.domain,other[1],'Guided 3 must introduce the remaining domain');
 assert.ok(third.story.includes(a.sites.find(site=>site.id===third.siteId)!.name),'Guided story must match its actual site');
 action=applyKMWeekActionV1(variantSession,a.id,{type:'KM_WEEK_RESOLVE',challengeId:third.id,method:'expert',expertId:specialist(other[1]).id});
 assert.ok(action.success,action.message);
 const transfer=kmWeekGuidedTransferV1(a);
 assert.equal(transfer.domain,other[0],'Guided knowledge transfer must use an untrained domain');
 action=applyKMWeekActionV1(variantSession,a.id,{type:'KM_WEEK_INVEST',investment:'KNOWLEDGE_TRANSFER',...transfer});
 assert.ok(action.success,action.message);
 assert.equal(a.kmWeek!.stage,'free','All 3 guided lessons must complete for any starting allocation');
 const cycle=Array.from({length:6},(_,index)=>freeChallengesForRound(variantSession,a,index+1)).flat();
 assert.equal(cycle.filter(card=>card.domain===focus).length,6,'Every variant must have six related Challenges');
 assert.ok(cycle.filter(card=>card.difficulty>=5).every(card=>card.domain===focus),'Every variant must focus all high requirements in its selected domain');
 assert.equal(new Set(cycle.map(card=>card.title)).size,12,'A recurring domain must not cause story repetition');
 const nextCycle=Array.from({length:6},(_,index)=>freeChallengesForRound(variantSession,a,index+7)).flat();
 assert.deepEqual(nextCycle.map(card=>card.difficulty).sort((x,y)=>x-y),cycle.map(card=>card.difficulty+1).sort((x,y)=>x-y),'All variants must continue escalating every six rounds');
}
assert.deepEqual(kmWeekRiskOddsV1(1,2),{performanceGap:1,requiredRoll:2,successfulFaces:5,chancePercent:83},'A one-point performance gap must still carry risk and require 2+ on d6');
assert.deepEqual(kmWeekRiskOddsV1(0,4),{performanceGap:4,requiredRoll:5,successfulFaces:2,chancePercent:33},'Risk odds must worsen as the remaining performance gap grows');

{
  const rounds=Array.from({length:6},(_,index)=>freeChallengesForRound(session,company,index+1));
  const signatures=rounds.map(cards=>cards.map(card=>card.domain+':'+card.difficulty).sort().join('|')).sort();
  const pressure=company.kmWeek!.pressureDomain!;
  const [side1,side2]=KM_WEEK_DOMAINS.filter(domain=>domain!==pressure);
  const expected=[
    [`${side1}:2`,`${side2}:3`],
    [`${side1}:3`,`${side2}:4`],
    [`${side2}:4`,`${pressure}:8`],
    [`${pressure}:4`,`${pressure}:6`],
    [`${side1}:4`,`${pressure}:5`],
    [`${pressure}:5`,`${pressure}:6`],
  ].map(items=>items.sort().join('|')).sort();
  assert.deepEqual(signatures,expected,'Each six-round cycle must contain the agreed six challenge-value profiles exactly once');
  assert.equal(rounds.filter(cards=>cards[0].domain===cards[1].domain&&cards.every(card=>card.difficulty>2)).length,2,'Each cycle must contain two later same-domain expert-bottleneck rounds');
  assert.deepEqual(rounds[0].map(card=>card.domain+':'+card.difficulty).sort(),[`${side1}:2`,`${side2}:3`].sort(),'The first full round must remain approachable for new players');
  assert.equal(rounds.flat().filter(card=>card.difficulty>=5).length,5,'There must be five high-pressure cards each cycle');
  assert.ok(rounds.flat().filter(card=>card.difficulty>=5).every(card=>card.domain===pressure),'All five high-pressure Challenges must demand the same knowledge domain');
  assert.equal(rounds.flat().filter(card=>card.domain===pressure).length,6,'The recurring constraint must appear in half the Challenges');
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
  const localHero=createInitialCompanyV2('Local Heroes Threshold','kmw-local-heroes',config);
  initialiseKMWeekCompanyV1(localHero);
  const localGoalSession={...session,kmWeekGoalId:'local-heroes',companies:[localHero]} as GameSessionV2;
  assert.match(KM_WEEK_GOALS['local-heroes'].description,/at least 5 free-play Challenges/,'The Local Heroes screen must describe the five-win target');
  for(const wins of [0,2,4]){
    localHero.kmWeek!.localSuccesses=wins;
    assert.equal(calculateKMWeekScoreV1(localGoalSession,localHero).goal,0,`Local Heroes must not award points after ${wins} local-only wins`);
  }
  localHero.kmWeek!.localSuccesses=5;
  assert.equal(calculateKMWeekScoreV1(localGoalSession,localHero).goal,5,'Five local-only wins must earn the Local Heroes award');
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
  assert.equal(kmWeekAvailableInvestmentExpertV1(retireCompany,ops.id,'operations')?.id,hr.id,
   'Invest must switch away from a retired expert instead of retaining a stale selection and silently ignoring Commit');

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
 // UAT regression: after Round 5 the highest specialist may retire just as
 // a player first selects the AAR from an earlier serious setback. Commit must
 // still do something and the company must retain the expert learning.
 const co=createInitialCompanyV2('Retirement AAR Review','kmw-retirement-aar',config);
 const run={...session,id:'KM-RETIRE-AAR',companies:[co],activeEvents:{},timerEndsAt:null,timerPausedSecondsRemaining:900} as GameSessionV2;
 initialiseKMWeekSessionV1(run);
 const st=co.kmWeek!;
 st.pressureDomain='operations';
 st.stage='free';st.phase='challenge';st.freeRound=5;co.round=8;
 const retiring=co.experts.find(expert=>expert.domains.some(skill=>skill.domain==='operations'))!;
 retiring.domains[0].score=9;
 st.challenges=[{id:'BIG-FAILURE',title:'Major process breakdown',story:'Round five',siteId:'brisbane',domain:'operations',difficulty:8,impact:120,status:'open'}];
 const challenge=applyKMWeekActionV1(run,co.id,{type:'KM_WEEK_RESOLVE',challengeId:'BIG-FAILURE',method:'local'});
 assert.equal(challenge.success,true,challenge.message);
 assert.equal(st.phase,'invest');
 assert.equal(st.lastPressureFailure?.id,'BIG-FAILURE');
 assert.equal(st.expertRetirement?.expertId,retiring.id,'High-scoring domain expert must still retire after Round 5');
 assert.equal(retiring.isVacant,true);
 assert.deepEqual(kmWeekAARCandidatesV1(co).map(c=>c.id),['BIG-FAILURE']);
 const brisbane=co.sites.find(site=>site.id==='brisbane')!;
 const before=brisbane.teamCapability.operations||0;
 const aar=applyKMWeekActionV1(run,co.id,{type:'KM_WEEK_INVEST',investment:'AFTER_ACTION_REVIEW',challengeId:'BIG-FAILURE'});
 assert.equal(aar.success,true,'An AAR must commit even while the domain specialist is retired: '+aar.message);
 assert.equal(brisbane.teamCapability.operations,before+2,'AAR must immediately strengthen the affected local team');
 assert.equal(st.expertRetirement?.pendingAARUplift,2,'AAR knowledge must be preserved for the future specialist');
 assert.equal(retiring.isVacant,true,'The retired expert must still be absent from the next Challenge round');
 assert.equal(st.freeRound,6,'Successful AAR advances exactly one round');
 const expectedBase=Math.max(3,...co.sites.filter(site=>KM_WEEK_SITE_IDS.includes(site.id as typeof KM_WEEK_SITE_IDS[number])).map(site=>site.teamCapability.operations||0));
 st.challenges=[{id:'NEXT-ROUND',title:'Next round',story:'Replacement',siteId:'perth',domain:'marketing',difficulty:1,impact:15,status:'open'}];
 const end=applyKMWeekActionV1(run,co.id,{type:'KM_WEEK_RESOLVE',challengeId:'NEXT-ROUND',method:'local'});
 assert.equal(end.success,true,end.message);
 assert.equal(st.expertRetirement?.status,'replaced');
 assert.equal(retiring.isVacant,false,'The replacement must arrive normally in Round 6');
 assert.equal(retiring.domains[0].score,expectedBase+2,'The replacement must inherit the AAR learning on top of its normal starting level');
 assert.deepEqual(kmWeekAARCandidatesV1(co).map(c=>c.id),[],'One reviewed failure cannot produce another AAR');
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
// Verify local breadth is necessary at any starting expert depth (4 or 5).
const startingOperationsExpert=opsExpert().domains[0].score;
company.kmWeek!.challenges[0].difficulty=startingOperationsExpert+1;
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
assert.equal(opsExpert().domains[0].score,startingOperationsExpert+1);
assert.equal(company.kmWeek?.guidedTurn,2);

// Guided 2 uses Human Resources so the local team or Marcus can respond
// without bringing Priya back in straight after her first investment.
const guided2=company.kmWeek!.challenges[0];
assert.equal(guided2.domain,'hr','Guided 2 should introduce HR rather than require Priya again');
const guided2HR=company.sites.find(site=>site.id===guided2.siteId)?.teamCapability.hr||0;
assert.ok(guided2HR>=guided2.difficulty,'Guided 2 must select a capable local HR team');
assert.ok(guided2.story.includes(company.sites.find(site=>site.id===guided2.siteId)!.name),'Guided 2 narrative should name the actual site');
result=applyKMWeekActionV1(session,company.id,{type:'KM_WEEK_RESOLVE',challengeId:guided2.id,method:'local'});
assert.equal(result.success,true,result.message);
assert.equal(guided2.status,'success');
assert.equal(guided2.resolution,'local');
assert.equal(company.kmWeek?.phase,'invest');
const beforeRemoteTraining=company.turnover;
const trainingSiteId=kmWeekGuidedTrainingSiteV1(company);
const trainingSite=company.sites.find(site=>site.id===trainingSiteId)!;
const beforeTraining=trainingSite.teamCapability.operations;
assert.notEqual(trainingSiteId,opsExpert().location,'Guided training must suggest a team away from the expert');
result=applyKMWeekActionV1(session,company.id,{type:'KM_WEEK_INVEST',investment:'LOCAL_TRAINING',expertId:opsExpert().id,siteId:trainingSiteId,domain:'operations'});
assert.equal(result.success,true,result.message);
assert.equal(trainingSite.teamCapability.operations,Math.min(beforeTraining+2,opsExpert().domains[0].score),'Local Training must develop the selected team');
assert.equal(company.turnover,beforeRemoteTraining-12,'Remote KM Week training must cost $10k plus $2k travel');
assert.equal(opsExpert().location,trainingSiteId,'Expert location must update after Local Training');
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
const guidedTransfer=kmWeekGuidedTransferV1(company);
const transferFrom=company.sites.find(site=>site.id===guidedTransfer.sourceSiteId)!;
const transferTo=company.sites.find(site=>site.id===guidedTransfer.targetSiteId)!;
const beforeTransfer=transferTo.teamCapability.hr;
assert.ok(transferFrom.teamCapability.hr>beforeTransfer,'Guided transfer must suggest a stronger HR source');
result=applyKMWeekActionV1(session,company.id,{type:'KM_WEEK_INVEST',investment:'KNOWLEDGE_TRANSFER',...guidedTransfer});
assert.equal(result.success,true,result.message);
assert.ok(transferTo.teamCapability.hr>beforeTransfer,'The guided transfer must raise the learning site score');
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
assert.deepEqual(KM_WEEK_SITE_IDS.map(id=>company.initialRiverSnapshot!.sites.find(site=>site.id===id)!.teamCapability.operations).sort(),[0,1,2],'The final AAR Before River shows the original 2/1/0 Ops budget');
assert.equal(company.initialRiverSnapshot?.experts.find(expert=>expert.domains.some(skill=>skill.domain==='operations'))?.domains[0].score,startingOperationsExpert,'The final AAR preserves original expert depth');
assert.equal(trainingSite.teamCapability.operations,Math.min(beforeTraining+2,startingOperationsExpert+1),'The current River includes guided local training');
assert.equal(opsExpert().domains[0].score,startingOperationsExpert+1,'The current River includes guided expert training');
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
  const trainable=company.experts.find(candidate=>candidate.domains[0].score<KM_WEEK_DEEP_BENCH_TARGET);
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
  delete st.pressureDomain; // Legacy sessions still permit successful or failed reviews.
  st.stage='free';st.phase='invest';st.freeRound=3;co.round=6;
  const site=co.sites.find(site=>site.id==='perth')!;
  const expert=co.experts.find(expert=>expert.domains.some(skill=>skill.domain==='marketing'))!;
  const skill=expert.domains.find(skill=>skill.domain==='marketing')!;
  site.teamCapability.marketing=startingSite;
  skill.score=startingExpert;
  st.challenges=[
   {id:'TOUGH',title:'Distributor failure',story:'Difficult Perth incident',siteId:site.id,domain:'marketing',difficulty:9,impact:135,status},
   {id:'EASY',title:'Minor delay',story:'Routine',siteId:site.id,domain:'marketing',difficulty:4,impact:20,status:'success'},
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
 assert.equal(won.site.teamCapability.marketing,3,'Success should improve local knowledge by one');
 assert.equal(won.skill.score,5,'Success should improve the facilitating expert by one');
 const lost=makeReview('failure',5,6);
 assert.equal(lost.site.teamCapability.marketing,7,'Perth failure AAR must add +2 beyond the old level-five site cap');
 assert.equal(lost.skill.score,8,'Failure AAR must add +2 beyond the old level-six expert cap');
 assert.equal(lost.co.kmWeek!.investmentHistory.at(-1)?.after,7,'AAR records the full site uplift');
 assert.equal(lost.co.kmWeek!.investmentHistory.at(-1)?.expertAfter,8,'AAR records the full expert uplift');
 const high=makeReview('failure',9,10);
 assert.equal(high.site.teamCapability.marketing,11,'Perth site knowledge must grow above ten');
 assert.equal(high.skill.score,12,'Experts must grow above ten');
 const highSuccess=makeReview('success',10,11);
 assert.equal(highSuccess.site.teamCapability.marketing,11,'Success AAR adds one beyond ten');
 assert.equal(highSuccess.skill.score,12,'Successful AAR also adds one to the expert beyond ten');
 assert.ok(calculateKMWeekScoreV1(session,high.co).expertise<=6,'Higher knowledge must not overflow the six-point Score Pad category');
}
// In KMWeek3 the first AAR opportunity follows a substantial failure in the
// recurring problem domain, not a success or a failure elsewhere.
{
 const co=createInitialCompanyV2('Pressure Review','kmw-pressure-review',config);
 initialiseKMWeekCompanyV1(co,'KMW-PRESSURE-REVIEW');
 const st=co.kmWeek!,focus=st.pressureDomain!;
 const other=KM_WEEK_DOMAINS.find(domain=>domain!==focus)!;
 st.stage='free';st.phase='invest';st.freeRound=4;co.round=7;
 const makeCard=(id:string,domain:typeof focus,status:'success'|'failure')=>({id,title:id,story:id,siteId:'perth',domain,difficulty:8,impact:120,status});
 st.challenges=[makeCard('SUCCESS',focus,'success'),makeCard('OTHER',other,'failure')];
 assert.deepEqual(kmWeekAARCandidatesV1(co),[],'The AAR must stay hidden without a failure in the recurring domain');
 st.lastPressureFailure=makeCard('EARLIER',focus,'failure');
 assert.deepEqual(kmWeekAARCandidatesV1(co).map(item=>item.id),['EARLIER'],'A substantial earlier-round failure should be reviewable when round seven begins');
 st.lastPressureFailure=undefined;
 st.challenges.push(makeCard('TARGET',focus,'failure'));
 assert.deepEqual(kmWeekAARCandidatesV1(co).map(item=>item.id),['TARGET'],'Only a tough failure in the recurring domain may introduce the AAR');
 assert.equal(investKMWeekV1({...session,companies:[co]} as GameSessionV2,co,{investment:'AFTER_ACTION_REVIEW',challengeId:'OTHER'}).success,false,'The server must enforce AAR domain eligibility');
 st.challenges[2].difficulty=4;
 assert.deepEqual(kmWeekAARCandidatesV1(co),[],'An easy failure must not introduce the AAR');
 st.challenges[2].difficulty=8;
 co.round=6;
 assert.deepEqual(kmWeekAARCandidatesV1(co),[],'The original AAR unlock timing must be preserved');
}
// Store actual past failures, so a player sees the review when it unlocks,
// even if the immediate round did not contain another big loss.
{
 const co=createInitialCompanyV2('Previous failure','kmw-previous-failure',config);
 const sampleSession={...session,id:'KMW-PRIOR-FAILURE',companies:[co],activeEvents:{}} as GameSessionV2;
 initialiseKMWeekSessionV1(sampleSession);
 const focus=co.kmWeek!.pressureDomain!;
 const prior={id:'EARLY-HARD',title:'High-pressure incident',story:'Learning opportunity',siteId:'perth',domain:focus,difficulty:8,impact:120,status:'open' as const};
 co.kmWeek!.stage='free';co.kmWeek!.phase='challenge';co.kmWeek!.freeRound=2;co.round=5;co.kmWeek!.challenges=[prior];
 const failure=applyKMWeekActionV1(sampleSession,co.id,{type:'KM_WEEK_RESOLVE',challengeId:prior.id,method:'local'});
 assert.equal(failure.success,true,failure.message);
 assert.equal(co.kmWeek!.lastPressureFailure?.id,prior.id,'The resolved failure must be saved for review');
 co.kmWeek!.freeRound=4;co.round=7;co.kmWeek!.phase='invest';co.kmWeek!.challenges=[];
 assert.deepEqual(kmWeekAARCandidatesV1(co).map(challenge=>challenge.id),[prior.id],'The previous failure must become reviewable at the original unlock');
}
// Other investments must be able to strengthen expertise beyond difficulty ten.
{
 const co=createInitialCompanyV2('High Knowledge','kmw-high-knowledge',config);
 initialiseKMWeekCompanyV1(co);
 co.kmWeek!.stage='free';co.kmWeek!.phase='invest';co.kmWeek!.freeRound=4;co.round=7;
 const s={...session,companies:[co]} as GameSessionV2;
 const expert=co.experts.find(e=>e.domains.some(d=>d.domain==='marketing'))!;
 const skill=expert.domains.find(d=>d.domain==='marketing')!;
 skill.score=10;
 let result=investKMWeekV1(s,co,{investment:'TRAIN_EXPERT',expertId:expert.id,domain:'marketing'});
 assert.equal(result.success,true,result.message);
 assert.equal(skill.score,11,'Train Expert must continue beyond ten');
 co.kmWeek!.stage='free';co.kmWeek!.phase='invest';
 skill.score=12;
 const perth=co.sites.find(site=>site.id==='perth')!;
 perth.teamCapability.marketing=9;
 result=investKMWeekV1(s,co,{investment:'LOCAL_TRAINING',expertId:expert.id,siteId:perth.id,domain:'marketing'});
 assert.equal(result.success,true,result.message);
 assert.equal(perth.teamCapability.marketing,11,'Local Training must add two beyond ten, without exceeding the expert');
 co.kmWeek!.stage='free';co.kmWeek!.phase='invest';
 const brisbane=co.sites.find(site=>site.id==='brisbane')!;
 brisbane.teamCapability.marketing=15;
 result=investKMWeekV1(s,co,{investment:'KNOWLEDGE_TRANSFER',sourceSiteId:brisbane.id,targetSiteId:perth.id,domain:'marketing'});
 assert.equal(result.success,true,result.message);
 assert.equal(perth.teamCapability.marketing,13,'Knowledge Transfer must move half the gap even above ten');
 assert.equal(co.kmWeek!.investmentHistory.at(-1)?.after,13);
}

// Regression from live webinar KMHSRBW: a company bankrupt at turnover 0
// finished its Challenges but could not afford any Invest intervention, which
// prevented all companies from reaching the full AAR comparison.
{
 const bankrupt=createInitialCompanyV2('Cash-strapped','kmw-bankrupt',config);
 initialiseKMWeekCompanyV1(bankrupt,'KMW-WEBINAR');
 const game={...session,id:'KMW-WEBINAR',companies:[bankrupt],timerEndsAt:null,timerPausedSecondsRemaining:0,finalDisruptionResolved:false} as GameSessionV2;
 bankrupt.kmWeek!.stage='free';bankrupt.kmWeek!.phase='invest';
 bankrupt.kmWeek!.freeRound=10;bankrupt.round=13;bankrupt.roundPhase='investment';
 bankrupt.turnover=0;
 const invested=applyKMWeekActionV1(game,bankrupt.id,{type:'KM_WEEK_INVEST',investment:'TRAIN_EXPERT',domain:'operations',expertId:bankrupt.experts[0].id});
 assert.equal(invested.success,false,'An unaffordable investment must fail without mutating knowledge');
 const pastInvestments=bankrupt.kmWeek!.investmentHistory.length;
 const skipped=applyKMWeekActionV1(game,bankrupt.id,{type:'KM_WEEK_SKIP_INVEST'});
 assert.equal(skipped.success,true,skipped.message);
 assert.equal(bankrupt.kmWeek!.stage,'shock','A bankrupt company can escape Invest and reach Site Audits');
 assert.equal(bankrupt.kmWeek!.investmentHistory.length,pastInvestments,'Skipping must not invent knowledge or pretend an investment occurred');
 assert.equal(bankrupt.turnover,0,'Skipping must never change turnover');
 let after=applyKMWeekActionV1(game,bankrupt.id,{type:'KM_WEEK_RESOLVE_SHOCK'});
 assert.equal(after.success,true,after.message);
 after=applyKMWeekActionV1(game,bankrupt.id,{type:'KM_WEEK_COMPLETE_SHOCK'});
 assert.equal(after.success,true,after.message);
 assert.equal(bankrupt.kmWeek!.stage,'complete','The previously bankrupt player must be able to reach the final AAR');
}

{
 // During the final three-minute cutoff, a previously selected expert may
 // already be retired. The normal final Commit must still reach Site Audits.
 const finalCo=createInitialCompanyV2('Final Invest After Retirement','kmw-final-invest-retired',config);
 const finalSession={...session,id:'KMW-FINAL-RETIRE',companies:[finalCo],timerEndsAt:null,timerPausedSecondsRemaining:0} as GameSessionV2;
 initialiseKMWeekSessionV1(finalSession);
 const finalState=finalCo.kmWeek!;
 finalState.stage='free';finalState.phase='invest';finalState.freeRound=5;finalCo.round=8;
 const retired=finalCo.experts.find(expert=>expert.domains.some(skill=>skill.domain==='operations'))!;
 retired.isVacant=true;
 const replacement=kmWeekAvailableInvestmentExpertV1(finalCo,retired.id,'operations');
 assert.ok(replacement&&!replacement.isVacant&&replacement.id!==retired.id,'Retired selection must fall back to a working specialist');
 const initialTurnover=finalCo.turnover;
 const committed=applyKMWeekActionV1(finalSession,finalCo.id,{type:'KM_WEEK_INVEST',investment:'TRAIN_EXPERT',expertId:replacement.id,domain:replacement.domains[0].domain});
 assert.equal(committed.success,true,'Final Commit must accept the available expert: '+committed.message);
 assert.equal(finalState.stage,'shock','A valid final investment must enter Site Audits without the emergency button');
 assert.equal(finalCo.turnover,initialTurnover-15,'The final investment must be charged once, not silently skipped');
 assert.equal(finalState.investmentHistory.at(-1)?.expertId,replacement.id,'The actual available expert must receive the final investment');
}

{
 const co=createInitialCompanyV2('Deadline Escape','kmw-deadline',config);
 initialiseKMWeekCompanyV1(co,'KMW-CUTOFF');
 const game={...session,id:'KMW-CUTOFF',companies:[co],timerEndsAt:null,timerPausedSecondsRemaining:0,finalDisruptionResolved:false} as GameSessionV2;
 co.kmWeek!.stage='free';co.kmWeek!.phase='challenge';co.kmWeek!.freeRound=3;co.round=6;
 co.kmWeek!.challenges=[
  {id:'C1',title:'Resolved',story:'A resolved problem',siteId:'brisbane',domain:'operations',difficulty:5,impact:30,status:'success'},
  {id:'C2',title:'Stuck',story:'Last unresolved problem',siteId:'perth',domain:'marketing',difficulty:6,impact:45,status:'open'},
 ];
 const original=co.turnover;
 const outcome=applyKMWeekActionV1(game,co.id,{type:'KM_WEEK_TO_AUDITS'});
 assert.equal(outcome.success,true,outcome.message);
 assert.equal(co.kmWeek!.stage,'shock','The final deadline must release a company stranded on its last Challenge');
 assert.equal(co.turnover,original-45,'Only unfinished Challenges are forfeited as losses');
 assert.equal(co.kmWeek!.turnoverHistory.at(-1)?.challengeResult,'failure','Forfeited Challenges must be recorded in the AAR turnover chart');
 const again=applyKMWeekActionV1(game,co.id,{type:'KM_WEEK_TO_AUDITS'});
 assert.equal(again.success,false,'The deadline cannot be used twice');
 const preDeadline=createInitialCompanyV2('Time Protected','kmw-timer-guard',config);
 initialiseKMWeekCompanyV1(preDeadline,'KMW-NOT-YET');
 preDeadline.kmWeek!.stage='free';preDeadline.kmWeek!.phase='challenge';
 const protectedGame={...game,id:'KMW-NOT-YET',companies:[preDeadline],timerPausedSecondsRemaining:600} as GameSessionV2;
 assert.equal(applyKMWeekActionV1(protectedGame,preDeadline.id,{type:'KM_WEEK_TO_AUDITS'}).success,false,'Players cannot bypass Challenges before the final three-minute window');
}
console.log('KM Week smoke passed');
