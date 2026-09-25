import assert from 'node:assert/strict';
import { createNewSessionV2 } from '../src/server/gameServiceV4.ts';
import { evaluateFinalDisruptionV1, swapDisruptionWithPeerV1 } from '../src/engine/disruptionPlusV1.ts';

const names=['Alpha','Beta','Gamma','Delta','Epsilon','Zeta'];
const session=await createNewSessionV2('DISRUPTION-SMOKE','Disruption Smoke',names,{experienceMode:'newbie',gameDurationMinutes:60});
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
assert.equal(firstResult.totalKnowledge,11,'local 5 + expert 6 must equal 11 before other additive sources');

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

console.log('Disruption Plus smoke tests passed.');
