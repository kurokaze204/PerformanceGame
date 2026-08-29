import assert from 'node:assert/strict';
import { DEFAULT_CONFIG } from '../src/engine/config.ts';
import {
  buildEventTypePlan,
  createInitialCompanyV2,
  currentConsultantRate,
  drawRoundEventsV2,
  executeKnowledgeActionV2,
  resolveSingleEventV2,
  validateEventAllocationV2,
} from '../src/engine/coreV2.ts';
import {
  evaluateEventDomainKnowledgeExplicitV2,
  resolveSingleEventExplicitV2,
} from '../src/engine/challengeResponseV2.ts';
import { asSessionV2 } from '../src/types/gameV2.ts';
import type { ActiveEvent, EventCard, GameSession } from '../src/types/game.ts';

function makeSession(mode:'newbie'|'expert'='newbie') {
  const company = createInitialCompanyV2('Smoke Co', 'smoke-co', DEFAULT_CONFIG);
  const session = asSessionV2({
    id: 'SMOKE',
    title: 'Smoke Test',
    round: 1,
    phase: 'events',
    isPaused: false,
    isFinalDisruptionActive: false,
    companies: [company],
    activeEvents: { [company.id]: [] },
    copMemberships: [],
    config: { ...DEFAULT_CONFIG },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as GameSession);
  session.experienceMode=mode;
  return { session, company };
}

// 1. Planned game has an equal event mix.
{
  const plan = buildEventTypePlan(DEFAULT_CONFIG);
  assert.equal(plan.length, 10);
  assert.equal(plan.filter((x) => x === 'problem').length, 5);
  assert.equal(plan.filter((x) => x === 'opportunity').length, 5);
}

// 2. Consultant dependence gets progressively more expensive.
{
  const { company } = makeSession();
  assert.equal(currentConsultantRate(company), 15);
  company.consultantEngagements = 1;
  assert.equal(currentConsultantRate(company), 20);
  company.consultantEngagements = 2;
  assert.equal(currentConsultantRate(company), 27);
}

// 3. Ten ordinary draws remain 5/5 when played to completion.
{
  const { session, company } = makeSession();
  for (let round = 1; round <= 5; round++) {
    session.round = round;
    drawRoundEventsV2(session, company);
  }
  assert.equal(company.problemEventsDrawn, 5);
  assert.equal(company.opportunityEventsDrawn, 5);
}

// 4. The same expert cannot be reserved for two separate events.
{
  const { session, company } = makeSession();
  const expert = company.experts[0];
  const domain = expert.domains[0].domain;
  const card: EventCard = {
    id: 'TEST-ONE', type: 'problem', scope: 'enterprise', title: 'Test', description: 'Test',
    domains: [{ domain, difficulty: 5 }], impact: 100, tags: ['test'],
  };
  const a: ActiveEvent = { instanceId: 'A', card, allocations: { [domain]: { expertId: expert.id } } as any, isResolved: false };
  const b: ActiveEvent = { instanceId: 'B', card: { ...card, id: 'TEST-TWO' }, allocations: { [domain]: {} } as any, isResolved: false };
  session.activeEvents[company.id] = [a as any, b as any];
  session.phase = 'respond';
  const check = validateEventAllocationV2(session, company, b, domain, { expertId: expert.id });
  assert.equal(check.ok, false);
}

// 5. Enterprise event impacts really change company/site turnover.
{
  const { session, company } = makeSession();
  session.phase = 'respond';
  const before = company.turnover;
  const card: EventCard = {
    id: 'TEST-ENTERPRISE-LOSS', type: 'problem', scope: 'enterprise', title: 'Certain loss', description: 'Smoke test',
    domains: [{ domain: 'finance', difficulty: 99 }], impact: 120, tags: ['test'],
  };
  const event: ActiveEvent = { instanceId: 'LOSS', card, allocations: { finance: {} } as any, isResolved: false };
  const result = resolveSingleEventV2(session, company, event);
  assert.equal(result.success, false);
  assert.equal(company.turnover, before - 120);
  assert.equal(company.turnover, company.sites.reduce((sum, s) => sum + s.turnover, 0));
}

// 6. Knowledge actions are illegal outside Investment phase.
{
  const { session, company } = makeSession();
  session.phase = 'respond';
  const result = executeKnowledgeActionV2(session, company, { type: 'HORIZON_SCAN', companyId: company.id, domain: 'finance' });
  assert.equal(result.success, false);
}

// 7. Expert mode retains explicit Team / Local Codified / Intranet source selection.
{
  const { session, company } = makeSession('expert');
  session.phase = 'respond';
  const site = company.sites.find((candidate) => !candidate.isClosed)!;
  site.teamCapability.finance = 4;
  site.codifiedKnowledge.finance = 3;
  company.intranet.finance = 5;
  const card: EventCard = {
    id: 'TEST-EXPLICIT-SOURCES', type: 'problem', scope: 'local', title: 'Explicit source test', description: 'Smoke test',
    domains: [{ domain: 'finance', difficulty: 6 }], impact: 100, tags: ['test'],
  };
  const event: ActiveEvent = {
    instanceId: 'EXPLICIT',
    card,
    targetSiteId: site.id,
    allocations: { finance: {} } as any,
    isResolved: false,
  };

  const none = evaluateEventDomainKnowledgeExplicitV2(session, company, event, 'finance', session.config);
  assert.equal(none.baseKnowledge, 0);
  assert.equal(none.team, 0);
  assert.equal(none.localCodified, 0);
  assert.equal(none.usableIntranet, 0);

  (event.allocations.finance as any).useTeamCapability = true;
  const teamOnly = evaluateEventDomainKnowledgeExplicitV2(session, company, event, 'finance', session.config);
  assert.equal(teamOnly.baseKnowledge, 4);
  assert.equal(teamOnly.team, 4);
  assert.equal(teamOnly.localCodified, 0);

  (event.allocations.finance as any).useTeamCapability = false;
  (event.allocations.finance as any).useLocalCodified = true;
  const docsOnly = evaluateEventDomainKnowledgeExplicitV2(session, company, event, 'finance', session.config);
  assert.equal(docsOnly.baseKnowledge, 3);
  assert.equal(docsOnly.localCodified, 3);

  (event.allocations.finance as any).useLocalCodified = false;
  (event.allocations.finance as any).useCorporateIntranet = true;
  const intranetOnly = evaluateEventDomainKnowledgeExplicitV2(session, company, event, 'finance', session.config);
  assert.equal(intranetOnly.baseKnowledge, Math.min(company.intranet.finance, site.teamCapability.finance + session.config.absorptive_capacity_bonus));
}

// 8. Expert explicit-source resolution records deliberately selected Local Codified knowledge.
{
  const { session, company } = makeSession('expert');
  session.phase = 'respond';
  const site = company.sites.find((candidate) => !candidate.isClosed)!;
  site.teamCapability.finance = 5;
  site.codifiedKnowledge.finance = 4;
  company.intranet.finance = 5;
  const card: EventCard = {
    id: 'TEST-EXPLICIT-RESOLVE', type: 'problem', scope: 'local', title: 'Certain explicit loss', description: 'Smoke test',
    domains: [{ domain: 'finance', difficulty: 99 }], impact: 10, tags: ['test'],
  };
  const event: ActiveEvent = {
    instanceId: 'EXPLICIT-RESOLVE', card, targetSiteId: site.id,
    allocations: { finance: { useLocalCodified: true } } as any, isResolved: false,
  };
  const result = resolveSingleEventExplicitV2(session, company, event);
  assert.equal(result.success, false);
  assert.equal(result.domainResults[0].baseKnowledge, 4);
  assert.equal(result.domainResults[0].team, 0);
  assert.equal(result.domainResults[0].localCodified, 4);
  assert.equal(result.domainResults[0].difficulty, 99);
}

// 9. Newbie mode deliberately ignores Local Codified Knowledge as a selectable challenge source.
{
  const { session, company } = makeSession('newbie');
  session.phase='respond';
  const site=company.sites.find(candidate=>!candidate.isClosed)!;
  site.teamCapability.finance=2; site.codifiedKnowledge.finance=6;
  const card:EventCard={id:'NEWBIE-NO-DOCS',type:'problem',scope:'local',title:'Simplified Newbie source model',description:'Smoke test',domains:[{domain:'finance',difficulty:6}],impact:10,tags:['test']};
  const event:ActiveEvent={instanceId:'NEWBIE-NO-DOCS',card,targetSiteId:site.id,allocations:{finance:{useLocalCodified:true}} as any,isResolved:false};
  const value=evaluateEventDomainKnowledgeExplicitV2(session,company,event,'finance',session.config);
  assert.equal(value.localCodified,0);
  assert.equal(value.baseKnowledge,0);
}

console.log('Core V2 smoke tests passed.');
