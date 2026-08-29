import { PROGRAMMED_FAILURE_TAG } from '../engine/eventProgressionV5.ts';
import { captureResolvedEvent } from './analyticsHooksV2.ts';
import { getSessionV2, logGameEvent, saveSessionV2 } from './dbV2.ts';

function recalcCompanyTurnover(company: any): void {
  company.turnover = Math.round(company.sites.reduce((sum: number, s: any) => sum + (s.isClosed ? 0 : s.turnover), 0));
}

function applySiteDelta(company: any, site: any, delta: number): void {
  site.turnover = Math.max(0, Math.round(site.turnover + delta));
  recalcCompanyTurnover(company);
}

function applyCompanyDelta(company: any, delta: number): void {
  const active = company.sites.filter((s: any) => !s.isClosed);
  if (!active.length || delta === 0) return;
  const total = active.reduce((sum: number, s: any) => sum + s.turnover, 0);
  let remaining = Math.round(delta);
  active.forEach((site: any, idx: number) => {
    const share = idx === active.length - 1
      ? remaining
      : Math.round(delta * (total > 0 ? site.turnover / total : 1 / active.length));
    site.turnover = Math.max(0, site.turnover + share);
    remaining -= share;
  });
  recalcCompanyTurnover(company);
}

export async function resolveWithReputationV2(sessionId: string, companyId: string, eventInstanceId: string) {
  const session = await getSessionV2(sessionId.toUpperCase());
  if (!session) return { success: false, message: 'Session not found.' };
  if (session.phase !== 'respond') return { success: false, message: 'Reputation can only be used while responding to an event.', session };

  const company = session.companies.find((c) => c.id === companyId);
  if (!company) return { success: false, message: 'Company not found.', session };
  if (company.reputationPoints <= 0) return { success: false, message: 'No reputation points remain.', session };

  const event = (session.activeEvents[company.id] || []).find((e) => e.instanceId === eventInstanceId);
  if (!event) return { success: false, message: 'Event not found.', session };
  if (event.isResolved) return { success: false, message: 'This event is already resolved.', session };
  if (event.card.tags?.includes(PROGRAMMED_FAILURE_TAG)) {
    return { success: false, message: 'This opening learning challenge is intentionally limited to knowledge already accessible at the site. Other rescue routes become part of play after this learning step.', session };
  }

  company.reputationPoints -= 1;
  event.reputationUsed = true;
  event.isResolved = true;
  event.success = true;
  event.committedProbabilityPercent = 100;
  event.resolvedAt = new Date().toISOString();
  event.experientialLearningAwarded = true;

  let turnoverChange = 0;
  if (event.card.type === 'opportunity') turnoverChange = event.card.impact;
  if (turnoverChange !== 0) {
    if (event.card.scope === 'local' && event.targetSiteId) {
      const target = company.sites.find((s) => s.id === event.targetSiteId);
      if (target) applySiteDelta(company, target, turnoverChange);
    } else {
      applyCompanyDelta(company, turnoverChange);
    }
  }
  event.turnoverChangeApplied = turnoverChange;
  event.netFinancialImpact = turnoverChange;

  event.domainResults = event.card.domains.map((r) => ({
    domain: r.domain,
    baseKnowledge: 0,
    usableIntranet: 0,
    team: 0,
    localCodified: 0,
    expertBonus: 0,
    copBonus: 0,
    automationBonus: 0,
    consultantBonus: 0,
    totalKnowledge: 0,
    difficulty: r.difficulty,
    dieRoll: 0,
    requiredTotal: r.difficulty,
    achievedTotal: r.difficulty,
    domainSuccess: true,
    reputationOverride: true,
    explanation: 'Resolved by spending one Reputation point; the knowledge challenge was bypassed and no knowledge capability was created.',
  }));

  await saveSessionV2(session);
  const result = {
    success: true,
    turnoverChange,
    interventionCost: 0,
    consultantDetails: [],
    domainResults: event.domainResults,
    reputationUsed: true,
    reputationRemaining: company.reputationPoints,
  };
  await captureResolvedEvent(session, company, event, 100, result);
  await logGameEvent({
    sessionId: session.id,
    companyId: company.id,
    eventType: 'REPUTATION_USED',
    round: session.round,
    phase: session.phase,
    title: 'Called in a favour',
    description: `${company.name} spent one Reputation point to guarantee “${event.card.title}”. ${company.reputationPoints} point(s) remain.`,
    payload: { eventInstanceId, cardId: event.card.id, reputationRemaining: company.reputationPoints },
  });

  // Deliberately do not broadcast EVENT_RESOLVED here. Unlike a normal challenge,
  // the reputation path resolves inside EventDecisionCardV4 and does not first set
  // AppBoardV5's deferUpdates flag. Broadcasting at this point can replace the
  // event underneath the acknowledgement screen, leaving CONTINUE stuck in its
  // busy state. The saved session returned below is applied when the player clicks
  // CONTINUE; subsequent normal session broadcasts keep other clients in sync.
  return { success: true, session, result };
}
