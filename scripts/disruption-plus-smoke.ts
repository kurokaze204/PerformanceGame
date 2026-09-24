import assert from 'node:assert/strict';
import { createNewSessionV2 } from '../src/server/gameServiceV4.ts';
import { evaluateFinalDisruptionV1, swapDisruptionWithPeerV1 } from '../src/engine/disruptionPlusV1.ts';

const session=await createNewSessionV2('DISRUPTION-SMOKE','Disruption Smoke',['Alpha','Beta'],{experienceMode:'newbie',gameDurationMinutes:60});
assert.equal(session.companies.length,2);
for(const company of session.companies){
  assert.ok(company.disruptionCard,'company should receive a disruption at startup');
  assert.equal(company.disruptionCard!.domains.length,2);
  const expertDomains=new Set(company.experts.flatMap(expert=>expert.domains.map(skill=>skill.domain)));
  for(const requirement of company.disruptionCard!.domains)assert.ok(expertDomains.has(requirement.domain),'Newbie disruption domains must match company expert roles');
}

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

const peer=session.companies[1];
const domainsA=new Set(company.experts.flatMap(expert=>expert.domains.map(skill=>skill.domain)));
const domainsB=new Set(peer.experts.flatMap(expert=>expert.domains.map(skill=>skill.domain)));
const common=[...domainsA].filter(domain=>domainsB.has(domain)).slice(0,2);
assert.equal(common.length,2,'test companies should share at least two expert-role domains');
company.disruptionCard!.domains=common.map((domain,index)=>({domain,difficulty:index===0?9:8}));
peer.disruptionCard!.domains=common.map((domain,index)=>({domain,difficulty:index===0?8:9}));
const beforeA=company.disruptionCard!.id;
const beforeB=peer.disruptionCard!.id;
const swap=swapDisruptionWithPeerV1(session,company.id);
assert.ok(swap,'two-company Newbie game should find a compatible disruption swap when cards are compatible');
assert.equal(company.disruptionCard!.id,beforeB);
assert.equal(session.companies[1].disruptionCard!.id,beforeA);
assert.ok(company.disruptionSwapNotice);

console.log('Disruption Plus smoke tests passed.');
