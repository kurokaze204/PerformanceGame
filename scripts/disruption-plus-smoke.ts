import assert from 'node:assert/strict';
import { createNewSessionV2 } from '../src/server/gameServiceV4.ts';
import { createNewSessionV2 as createServiceSessionV2, knowledgeActionV2 as serviceKnowledgeActionV2 } from '../src/server/gameServiceV9.ts';
import { saveSessionV2 } from '../src/server/dbV2.ts';
import { disruptionStrengthForRoundsV1, estimatedDisruptionRoundsForTimedGameV1, evaluateFinalDisruptionV1, finalDisruptionChanceV1, swapDisruptionWithPeerV1 } from '../src/engine/disruptionPlusV1.ts';

assert.equal(finalDisruptionChanceV1(0),100,'no final knowledge gap must be certain');
assert.equal(finalDisruptionChanceV1(2),54,'two missing points must leave a 54% chance');
assert.equal(finalDisruptionChanceV1(5),0,'large gaps must clamp at zero chance');
assert.deepEqual(disruptionStrengthForRoundsV1(3),{rounds:3,high:11,low:10});
assert.deepEqual(disruptionStrengthForRoundsV1(10),{rounds:10,high:13,low:12});
assert.deepEqual(disruptionStrengthForRoundsV1(35),{rounds:35,high:23,low:22});
assert.deepEqual(disruptionStrengthForRoundsV1(40),{rounds:40,high:25,low:24},'calibrated line must continue beyond the 35-round test horizon');

const names=['Alpha','Beta','Gamma','Delta','Epsilon','Zeta'];
const session=await createNewSessionV2('DISRUPTION-SMOKE','Disruption Smoke',names,{experienceMode:'newbie',gameDurationMinutes:60});
assert.equal(estimatedDisruptionRoundsForTimedGameV1(session),8,'a 60-minute timed game leaves about 50 minutes before the final window, completing round 8');
assert.deepEqual(session.companies[0].disruptionCard!.domains.map(item=>item.difficulty),[13,12],'60-minute Newbie game should use the calibrated 8-round card strength');
assert.equal(session.companies.length,6);
assert.equal(session.strategicDisruptionDomains?.length,3,'game should choose exactly three shared strategic disruption domains');
const strategic=new Set(session.strategicDisruptionDomains);

const siteIds=session.companies.map(company=>company.disruptionCard?.siteId);
assert.equal(new Set(siteIds).size,6,'up to six companies should receive different disruption cities');

const pairKeys:string[]=[];
for(const company of session.companies){
  assert.ok(company.disruptionCard,'company should receive a disruption at startup');
  assert.equal(company.disruptionCard!.domains.length,2);
  const expertDomains=new Set(company.experts.flatMap(expert=>expert.domains.map(skill=>skill.domain)));
  for(const domain of strategic)assert.ok(expertDomains.has(domain),'every company should have expert-role coverage in all three shared strategic domains');
  for(const requirement of company.disruptionCard!.domains){
    assert.ok(strategic.has(requirement.domain),'disruption card domains must come from the shared strategic set');
    assert.ok(expertDomains.has(requirement.domain),'every disruption domain must have an expert role in the receiving company');
  }
  pairKeys.push(company.disruptionCard!.domains.map(item=>item.domain).sort().join('+'));
}
assert.equal(new Set(pairKeys).size,3,'six companies should rotate through all three possible domain pairs');

const company=session.companies[0];
const card=company.disruptionCard!;
const first=card.domains[0];
const site=company.sites.find(candidate=>candidate.id===card.siteId)!;
site.teamCapability[first.domain]=5;
company.intranet[first.domain]=0;
site.codifiedKnowledge[first.domain]=0;
const expert=company.experts.find(candidate=>candidate.domains.some(skill=>skill.domain===first.domain))!;
expert.isVacant=false;
expert.domains.find(skill=>skill.domain===first.domain)!.score=6;
const evaluation=evaluateFinalDisruptionV1(session,company,{[first.domain]:{expertId:expert.id}});
assert.ok(evaluation);
const firstResult=evaluation!.domainResults.find(result=>result.domain===first.domain)!;
assert.equal(firstResult.local,5);
assert.equal(firstResult.expertScore,6);
assert.equal(firstResult.depthKnowledge,6,'the strongest source should set disruption depth');
assert.equal(firstResult.breadthBonus,1,'the second independent source should add one breadth point');
assert.equal(firstResult.totalKnowledge,7,'local 5 plus expert 6 should compose as depth 6 + breadth 1, not 11');
session.copMemberships.push({companyId:company.id,domain:'general',expertId:expert.id,activeRound:session.round+1,scope:'general'});
const noPartnerCop=evaluateFinalDisruptionV1(session,company,{[first.domain]:{expertId:expert.id}})!;
assert.equal(noPartnerCop.domainResults.find(result=>result.domain===first.domain)!.copScore,0,'one company alone must not activate CoP support');
const copPeer=session.companies[1];
const peerExpert=copPeer.experts.find(candidate=>!candidate.isVacant)!;
session.copMemberships.push({companyId:copPeer.id,domain:'general',expertId:peerExpert.id,activeRound:session.round+1,scope:'general'});
copPeer.intranet[first.domain]=8;
const withCop=evaluateFinalDisruptionV1(session,company,{[first.domain]:{expertId:expert.id}})!;
const withCopResult=withCop.domainResults.find(result=>result.domain===first.domain)!;
assert.equal(withCopResult.copScore,2,'two reciprocal CoP members may add up to two breadth points when the peer knows more');
assert.equal(withCopResult.totalKnowledge,9,'reciprocal CoP support must add two points on top of depth and breadth, not another full peer score');

const beforeA=company.disruptionCard!.id;
const peer=session.companies[1];
const beforeB=peer.disruptionCard!.id;
const swap=swapDisruptionWithPeerV1(session,company.id);
assert.ok(swap,'shared strategic expert coverage should make disruption swaps compatible');
assert.equal(company.disruptionCard!.id,beforeB);
assert.equal(peer.disruptionCard!.id,beforeA);
for(const receivingCompany of [company,peer]){
  const expertDomains=new Set(receivingCompany.experts.flatMap(item=>item.domains.map(skill=>skill.domain)));
  for(const requirement of receivingCompany.disruptionCard!.domains)assert.ok(expertDomains.has(requirement.domain),'a swapped disruption must remain expert-compatible');
}

const shortTimed=await createNewSessionV2('DISRUPTION-30','Disruption 30',['A'],{experienceMode:'newbie',gameDurationMinutes:30});
assert.equal(estimatedDisruptionRoundsForTimedGameV1(shortTimed),3);
assert.deepEqual(shortTimed.companies[0].disruptionCard!.domains.map(item=>item.difficulty),[11,10]);

const longTimed=await createNewSessionV2('DISRUPTION-90','Disruption 90',['A'],{experienceMode:'newbie',gameDurationMinutes:90});
assert.equal(estimatedDisruptionRoundsForTimedGameV1(longTimed),18);
assert.deepEqual(longTimed.companies[0].disruptionCard!.domains.map(item=>item.difficulty),[16,15]);

const roundExpert=await createNewSessionV2('DISRUPTION-35R','Disruption 35R',['A'],{experienceMode:'expert',gameEndMode:'rounds',finalRoundCount:35});
assert.deepEqual(roundExpert.companies[0].disruptionCard!.domains.map(item=>item.difficulty),[23,22]);

const large=await createNewSessionV2('DISRUPTION-CITY-ROTATE','Disruption City Rotate',['A','B','C','D','E','F','G'],{experienceMode:'expert',gameDurationMinutes:60});
assert.equal(large.strategicDisruptionDomains?.length,3);
const largeSites=large.companies.map(item=>item.disruptionCard!.siteId);
assert.equal(new Set(largeSites.slice(0,6)).size,6,'first six companies should use six distinct cities');
assert.equal(largeSites[6],largeSites[0],'seventh company should rotate back to the first city');
for(const companyItem of large.companies){
  const expertDomains=new Set(companyItem.experts.flatMap(item=>item.domains.map(skill=>skill.domain)));
  for(const domain of large.strategicDisruptionDomains!)assert.ok(expertDomains.has(domain),'Expert mode companies also need all three strategic expert domains');
  for(const requirement of companyItem.disruptionCard!.domains)assert.ok(expertDomains.has(requirement.domain),'Expert mode disruption cards must stay expert-compatible');
}

// Legacy/persisted cards must still resolve deterministically with a consultant,
// and duplicate/concurrent clicks must not charge the consultant twice.
{
  const legacy=await createServiceSessionV2('DISRUPTION-LEGACY-CONSULTANT','Legacy Consultant',['Legacy Co'],{experienceMode:'newbie',gameDurationMinutes:30});
  const legacyCompany=legacy.companies[0];
  legacy.isFinalDisruptionActive=true;
  legacy.finalDisruptionResolved=false;
  (legacy as any).finalDisruptionResults=[];
  legacyCompany.disruptionCard!.domains=legacyCompany.disruptionCard!.domains.map((requirement,index)=>({...requirement,difficulty:index===0?9:8}));
  const target=legacyCompany.sites.find(site=>site.id===legacyCompany.disruptionCard!.siteId)!;
  for(const requirement of legacyCompany.disruptionCard!.domains){
    target.teamCapability[requirement.domain]=0;
    legacyCompany.intranet[requirement.domain]=0;
  }
  const turnoverBefore=legacyCompany.turnover;
  const consultantBefore=legacyCompany.cumulativeConsultantSpend||0;
  await saveSessionV2(legacy);

  const payload={type:'FINAL_DISRUPTION_RESOLVE',selections:{},useConsultant:true};
  const [firstResolve,duplicateResolve]=await Promise.all([
    serviceKnowledgeActionV2(legacy.id,legacyCompany.id,payload),
    serviceKnowledgeActionV2(legacy.id,legacyCompany.id,payload),
  ]);
  assert.equal(firstResolve.success,true,'a consultant-backed legacy 9/8 disruption must resolve successfully');
  assert.equal(firstResolve.result?.success,true,'consultant must make the final disruption outcome certain');
  assert.ok((firstResolve.result?.consultantCost||0)>0,'legacy gap should require a real consultant cost');
  assert.equal(duplicateResolve.success,true,'a duplicate final-resolution request must be idempotent');
  assert.equal(duplicateResolve.alreadyResolved,true,'duplicate request should return the stored result instead of failing');

  const after=duplicateResolve.session.companies.find(item=>item.id===legacyCompany.id)!;
  assert.equal(after.cumulativeConsultantSpend,consultantBefore+firstResolve.result.consultantCost,'consultant spend must be charged exactly once');
  assert.equal(after.turnover,turnoverBefore-firstResolve.result.consultantCost,'turnover must be debited exactly once');
}

console.log('Disruption Plus smoke tests passed.');
