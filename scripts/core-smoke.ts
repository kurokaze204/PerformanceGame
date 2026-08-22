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
import { asSessionV2 } from '../src/types/gameV2.ts';
import type { ActiveEvent, EventCard, GameSession } from '../src/types/game.ts';

function makeSession() {
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

console.log('Core V2 smoke tests passed.');
