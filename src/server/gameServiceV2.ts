import { Response } from 'express';
import {
  ActionPayload,
  ActiveEvent,
  EventCard,
  GamePhase,
  GameSession,
  KnowledgeDomain,
  Participant,
} from '../types/game.ts';
import { GameSessionV2, V2_BALANCE, asCompanyV2, asSessionV2 } from '../types/gameV2.ts';
import { DEFAULT_CONFIG } from '../engine/config.ts';
import { FINAL_DISRUPTION_CARDS } from '../engine/cards.ts';
import {
  applyExperientialLearningV2,
  canUseHorizonRedrawV2,
  createInitialCompanyV2,
  drawRoundEventsV2,
  executeKnowledgeActionV2,
  executeRiskPhaseV2,
  prepareNextRoundV2,
  recalculateCompanySPOFV2,
  redrawEventSameTypeV2,
  resolveSingleEventV2,
  validateEventAllocationV2,
} from '../engine/coreV2.ts';
import {
  deleteSessionV2,
  getGameEventLogs,
  getSessionV2,
  initDatabaseV2,
  listSessionsV2,
  logGameEvent,
  resetSessionsV2,
  saveParticipant,
  saveSessionV2,
} from './dbV2.ts';

const sseClients = new Map<string, Set<Response>>();

export function registerSSEClientV2(sessionId: string, res: Response) {
  const id = sessionId.toUpperCase();
  if (!sseClients.has(id)) sseClients.set(id, new Set());
  sseClients.get(id)!.add(res);
  res.on('close', () => sseClients.get(id)?.delete(res));
}

export function broadcastV2(session: GameSessionV2, type = 'SESSION_UPDATE', extraData?: any) {
  const payload = JSON.stringify({ type, session, extraData, timestamp: new Date().toISOString() });
  for (const client of sseClients.get(session.id) || []) {
    try { client.write(`data: ${payload}\n\n`); } catch { /* disconnected */ }
  }
}

async function saveAndBroadcast(session: GameSessionV2, type = 'SESSION_UPDATE', extraData?: any) {
  await saveSessionV2(session);
  broadcastV2(session, type, extraData);
}

async function log(session: GameSessionV2, eventType: string, title: string, description: string, companyId?: string, payload: any = {}) {
  await logGameEvent({ sessionId: session.id, companyId, eventType, round: session.round, phase: session.phase, title, description, payload });
}

export async function createNewSessionV2(sessionId: string, title: string, companyNames: string[] = ['Apex Technologies']): Promise<GameSessionV2> {
  const id = sessionId.toUpperCase();
  const companies = companyNames.map((name, idx) => createInitialCompanyV2(name, `comp-${idx + 1}-${id.toLowerCase()}`, DEFAULT_CONFIG));
  const session = asSessionV2({
    id,
    title,
    round: 1,
    phase: 'respond',
    isPaused: false,
    isFinalDisruptionActive: false,
    companies,
    activeEvents: {},
    copMemberships: [],
    config: { ...DEFAULT_CONFIG },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as GameSession);
  session.timerStartedAt = null;
  session.timerEndsAt = null;
  session.timerPausedSecondsRemaining = V2_BALANCE.timerDurationSeconds;
  session.riskResults = null;
  for (const company of session.companies) session.activeEvents[company.id] = drawRoundEventsV2(session, company);
  await saveSessionV2(session);
  await log(session, 'SESSION_CREATED', 'Session created', `${title} created with ${companies.length} company team(s).`, undefined, { companies: companies.map((c) => c.name) });
  return session;
}

export async function initializeDefaultSessionV2(): Promise<GameSessionV2> {
  await initDatabaseV2();
  const existing = await getSessionV2('KM2026');
  if (existing) {
    const legacyPlaceholderSession =
      existing.companies.length === 2 &&
      existing.companies.some((c) => c.name === 'Apex Technologies') &&
      existing.companies.some((c) => c.name === 'Vanguard Systems');

    // KM2026 is the built-in local/test session. Older builds created a second
    // placeholder company (Vanguard Systems), which meant Apex could finish both
    // challenge cards and still be blocked waiting for a company nobody was
    // actually controlling. Migrate that legacy test session to a true one-team
    // session. Explicitly created multiplayer sessions are not affected.
    if (!legacyPlaceholderSession) return existing;
    return createNewSessionV2('KM2026', 'The Performance Gap', ['Apex Technologies']);
  }
  return createNewSessionV2('KM2026', 'The Performance Gap', ['Apex Technologies']);
}

export async function getSessionOrThrow(id: string): Promise<GameSessionV2> {
  const session = await getSessionV2(id.toUpperCase());
  if (!session) throw new Error('Session not found.');
  return session;
}

export async function joinSessionV2(sessionId: string, name: string, companyId?: string, role: Participant['role'] = 'participant') {
  const session = await getSessionOrThrow(sessionId);
  const targetCompany = session.companies.find((c) => c.id === companyId) || session.companies[0];
  const participant: Participant = {
    id: `part-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    sessionId: session.id,
    name: name || 'Player',
    companyId: targetCompany.id,
    role,
    lastSeen: new Date().toISOString(),
  };
  await saveParticipant(participant);
  await log(session, 'PARTICIPANT_JOINED', `${participant.name} joined`, `${participant.name} joined ${targetCompany.name}.`, targetCompany.id, { participantId: participant.id, role });
  broadcastV2(session, 'PARTICIPANT_JOINED', { participant });
  return { session, participant };
}

export async function setEventAllocationV2(sessionId: string, companyId: string, eventInstanceId: string, domain: KnowledgeDomain, allocation: any) {
  const session = await getSessionOrThrow(sessionId);
  const company = session.companies.find((c) => c.id === companyId); if (!company) throw new Error('Company not found.');
  const event = (session.activeEvents[company.id] || []).find((e) => e.instanceId === eventInstanceId); if (!event) throw new Error('Event not found.');
  const proposed = { ...event.allocations[domain], ...allocation };
  const validation = validateEventAllocationV2(session, company, event, domain, proposed);
  if (!validation.ok) return { success: false, message: validation.message, session };
  event.allocations[domain] = proposed;
  await saveAndBroadcast(session, 'EVENT_ALLOCATION_UPDATED', { companyId, eventInstanceId, domain });
  return { success: true, session };
}

export async function redrawEventV2(sessionId: string, companyId: string, eventInstanceId: string) {
  const session = await getSessionOrThrow(sessionId);
  const company = session.companies.find((c) => c.id === companyId); if (!company) throw new Error('Company not found.');
  const list = session.activeEvents[company.id] || [];
  const idx = list.findIndex((e) => e.instanceId === eventInstanceId); if (idx < 0) throw new Error('Event not found.');
  if (!canUseHorizonRedrawV2(session, company, list[idx])) return { success: false, message: 'Horizon Scan does not apply to this card.', session };
  const previous = list[idx].card.title;
  list[idx] = redrawEventSameTypeV2(session, company, list[idx]);
  await saveAndBroadcast(session, 'HORIZON_SCAN_REDRAW');
  await log(session, 'HORIZON_SCAN_REDRAW', 'Horizon Scan used', `${previous} was replaced by ${list[idx].card.title}.`, company.id, { previous, replacement: list[idx].card.title });
  return { success: true, message: `Replaced “${previous}” with “${list[idx].card.title}”.`, session };
}

function allCompanyEventsResolved(session: GameSessionV2): boolean {
  return session.companies.every((company) => (session.activeEvents[company.id] || []).every((e) => e.isResolved));
}

export async function resolveEventV2(sessionId: string, companyId: string, eventInstanceId?: string) {
  const session = await getSessionOrThrow(sessionId);
  if (session.phase !== 'respond') return { success: false, message: 'Challenges can only be resolved during the challenge phase.', session };
  const company = session.companies.find((c) => c.id === companyId); if (!company) throw new Error('Company not found.');
  const events = session.activeEvents[company.id] || [];
  const event = eventInstanceId ? events.find((e) => e.instanceId === eventInstanceId) : events.find((e) => !e.isResolved);
  if (!event) return { success: false, message: 'No unresolved event found.', session };
  const result = resolveSingleEventV2(session, company, event);
  await saveAndBroadcast(session, 'EVENT_RESOLVED', { companyId, eventInstanceId: event.instanceId, targetSiteId: event.targetSiteId, scope: event.card.scope, result });
  await log(session, result.success ? 'EVENT_SUCCESS' : 'EVENT_FAILURE', `${event.card.title}: ${result.success ? 'Success' : 'Failure'}`, `Business impact ${result.turnoverChange >= 0 ? '+' : ''}$${result.turnoverChange}k; intervention cost $${result.interventionCost}k.`, company.id, { ...result, eventTitle: event.card.title });
  for (const c of result.consultantDetails) await log(session, 'CONSULTANT_ENGAGED', `External expertise: ${c.domain}`, `${c.points} consultant point(s) at $${c.rate}k/point cost $${c.cost}k.`, company.id, c);

  if (allCompanyEventsResolved(session)) {
    session.phase = 'consequences';
    await saveAndBroadcast(session, 'CHALLENGES_COMPLETE', { round: session.round });
  }

  return { success: true, eventSuccess: result.success, result, session };
}

export async function applyLearningV2(sessionId: string, companyId: string, eventInstanceId: string, domain: KnowledgeDomain, target: 'team' | 'expert', targetId?: string) {
  const session = await getSessionOrThrow(sessionId);
  if (session.phase !== 'consequences') return { success: false, message: 'Experiential learning is claimed during Consequences.', session };
  const company = session.companies.find((c) => c.id === companyId); if (!company) throw new Error('Company not found.');
  const event = (session.activeEvents[company.id] || []).find((e) => e.instanceId === eventInstanceId); if (!event) throw new Error('Event not found.');
  const result = applyExperientialLearningV2(session, company, event, domain, target, targetId);
  if (result.success) {
    await saveAndBroadcast(session, 'EXPERIENTIAL_LEARNING_APPLIED');
    await log(session, 'EXPERIENTIAL_LEARNING', 'Opportunity learning captured', result.message, company.id, { eventInstanceId, domain, target, targetId });
  }
  return { ...result, session };
}

export async function knowledgeActionV2(sessionId: string, companyId: string, payload: ActionPayload) {
  const session = await getSessionOrThrow(sessionId);
  const company = session.companies.find((c) => c.id === companyId); if (!company) throw new Error('Company not found.');
  const result: any = executeKnowledgeActionV2(session, company, payload);
  if (!result.success) return { ...result, session };
  await saveAndBroadcast(session, 'ACTION_EXECUTED', { actionType: payload.type, message: result.message });
  await log(session, payload.type, payload.type.replaceAll('_', ' '), result.message, company.id, { ...payload, costTurnover: result.costTurnover });
  return { ...result, session };
}

export async function advancePhaseV2(sessionId: string, requested?: GamePhase) {
  const session = await getSessionOrThrow(sessionId);
  let next: GamePhase | null = requested || null;
  if (!next) {
    if (session.phase === 'events') next = 'respond';
    else if (session.phase === 'respond') next = 'consequences';
    else if (session.phase === 'consequences') next = 'investment';
    else if (session.phase === 'investment') next = 'risk';
    else next = 'respond';
  }

  if (session.phase === 'respond' && next === 'consequences' && !allCompanyEventsResolved(session)) {
    return { success: false, message: 'Every company must resolve both challenges before Results.', session };
  }

  if (next === 'risk' && session.phase === 'investment') {
    const summaries: any = {};
    for (const company of session.companies) {
      summaries[company.id] = executeRiskPhaseV2(session, company);
      await log(session, 'KNOWLEDGE_RISK', 'Knowledge risk resolved', `${summaries[company.id].departedExperts.length} expert departure(s), ${summaries[company.id].workforceAttrition.length} workforce knowledge loss(es).`, company.id, summaries[company.id]);
    }
    session.riskResults = summaries;
    session.phase = 'risk';
    await saveAndBroadcast(session, 'RISK_RESOLVED', summaries);
    return { success: true, session, phaseResult: { attritionSummaries: summaries } };
  }

  if (session.phase === 'risk' && next === 'respond') {
    session.round += 1;
    session.riskResults = null;
    if (session.round > session.config.rounds) {
      session.isFinalDisruptionActive = true;
      session.finalDisruptionCard = FINAL_DISRUPTION_CARDS[0];
      session.finalDisruptionResolved = false;
      session.phase = 'respond';
      await saveAndBroadcast(session, 'FINAL_DISRUPTION_STARTED');
      return { success: true, session };
    }
    prepareNextRoundV2(session);
    for (const company of session.companies) session.activeEvents[company.id] = drawRoundEventsV2(session, company);
    session.phase = 'respond';
    await saveAndBroadcast(session, 'ROUND_STARTED', { round: session.round });
    return { success: true, session };
  }

  session.phase = next;
  await saveAndBroadcast(session, 'PHASE_ADVANCED', { phase: next });
  return { success: true, session };
}

export async function resolveFinalDisruptionV2(sessionId: string) {
  const session = await getSessionOrThrow(sessionId);
  const card = session.finalDisruptionCard || FINAL_DISRUPTION_CARDS[0];
  const results: any[] = [];
  for (const company of session.companies) {
    const allocations: any = {}; card.domains.forEach((r) => { allocations[r.domain] = {}; });
    const active: ActiveEvent = { instanceId: `final-${company.id}`, card, allocations, isResolved: false };
    const priorPhase = session.phase; session.phase = 'respond';
    const result = resolveSingleEventV2(session, company, active); session.phase = priorPhase;
    results.push({ companyId: company.id, companyName: company.name, finalTurnover: company.turnover, ...result });
    await log(session, 'FINAL_DISRUPTION_RESOLVED', `${company.name}: ${result.success ? 'Resilient' : 'Disrupted'}`, `Final turnover $${company.turnover}k.`, company.id, result);
  }
  session.finalDisruptionResolved = true;
  await saveAndBroadcast(session, 'FINAL_DISRUPTION_RESOLVED', { results });
  return { success: true, session, results };
}

export async function timerStartV2(sessionId: string) {
  const session = await getSessionOrThrow(sessionId);
  const remaining = session.timerPausedSecondsRemaining ?? V2_BALANCE.timerDurationSeconds;
  session.timerStartedAt = new Date().toISOString();
  session.timerEndsAt = new Date(Date.now() + remaining * 1000).toISOString();
  session.timerPausedSecondsRemaining = null;
  await saveAndBroadcast(session, 'TIMER_STARTED');
  return session;
}

export async function timerPauseV2(sessionId: string) {
  const session = await getSessionOrThrow(sessionId);
  const remaining = session.timerEndsAt ? Math.max(0, Math.round((new Date(session.timerEndsAt).getTime() - Date.now()) / 1000)) : V2_BALANCE.timerDurationSeconds;
  session.timerPausedSecondsRemaining = remaining;
  session.timerStartedAt = null;
  session.timerEndsAt = null;
  await saveAndBroadcast(session, 'TIMER_PAUSED');
  return session;
}

export async function timerResetV2(sessionId: string) {
  const session = await getSessionOrThrow(sessionId);
  session.timerStartedAt = null;
  session.timerEndsAt = null;
  session.timerPausedSecondsRemaining = V2_BALANCE.timerDurationSeconds;
  await saveAndBroadcast(session, 'TIMER_RESET');
  return session;
}

export async function facilitatorUpdateV2(sessionId: string, updates: any) {
  const session = await getSessionOrThrow(sessionId);
  if (updates.round != null) session.round = Number(updates.round);
  if (updates.phase) session.phase = updates.phase;
  if (updates.isPaused != null) session.isPaused = !!updates.isPaused;
  if (updates.config) session.config = { ...session.config, ...updates.config };
  if (updates.adjustCompanyTurnover) {
    const company = session.companies.find((c) => c.id === updates.adjustCompanyTurnover.companyId);
    if (company) {
      const active = company.sites.filter((s) => !s.isClosed);
      if (active.length) active[0].turnover = Math.max(0, active[0].turnover + Number(updates.adjustCompanyTurnover.delta || 0));
      company.turnover = company.sites.reduce((sum, s) => sum + (s.isClosed ? 0 : s.turnover), 0);
    }
  }
  session.companies.forEach((c) => recalculateCompanySPOFV2(c, session.config));
  await saveAndBroadcast(session, 'FACILITATOR_OVERRIDE');
  return session;
}

export async function deleteSessionAndSelectNextV2(sessionId: string) {
  await deleteSessionV2(sessionId);
  sseClients.delete(sessionId.toUpperCase());
  const remaining = await listSessionsV2();
  const nextSession = remaining.length ? await getSessionV2(remaining[0].id) : await initializeDefaultSessionV2();
  return { success: true, nextSession };
}

export async function resetAllV2() {
  await resetSessionsV2();
  sseClients.clear();
  return initializeDefaultSessionV2();
}

export { getSessionV2, listSessionsV2, getGameEventLogs };
