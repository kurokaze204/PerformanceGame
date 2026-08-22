import { Response } from 'express';
import {
  GameSession,
  Participant,
  Company,
  ActiveEvent,
  ActionPayload,
  GamePhase,
  KnowledgeDomain,
  EventCard
} from '../types/game.ts';
import { DEFAULT_CONFIG } from '../engine/config.ts';
import {
  createInitialCompany,
  drawRoundEvents,
  evaluateEventDomainKnowledge,
  executeKnowledgeAction,
  executePhase5Attrition,
  recalculateCompanySPOF,
  resolveActiveEvent
} from '../engine/rules.ts';
import { FINAL_DISRUPTION_CARDS, getRandomEventCard } from '../engine/cards.ts';
import {
  getGameSession,
  saveGameSession,
  saveParticipant,
  logGameEvent,
  getGameEventLogs,
  listGameSessions,
  initDatabase,
  resetAllDatabaseData,
  deleteGameSession,
} from './db.ts';

// SSE Subscribers by Session ID
const sseClients: Map<string, Set<Response>> = new Map();

export async function deleteCurrentGame(sessionId: string) {
  const normId = sessionId.toUpperCase();
  await deleteGameSession(normId);
  sseClients.delete(normId);
  return { success: true, message: `Session ${normId} has been deleted.` };
}

export async function resetEntireDatabase() {
  await resetAllDatabaseData();
  sseClients.clear();
  return { success: true, message: 'All database sessions and state have been completely reset.' };
}


export function registerSSEClient(sessionId: string, res: Response) {
  if (!sseClients.has(sessionId)) {
    sseClients.set(sessionId, new Set());
  }
  sseClients.get(sessionId)!.add(res);

  res.on('close', () => {
    sseClients.get(sessionId)?.delete(res);
  });
}

export function broadcastSessionUpdate(session: GameSession, eventType: string = 'SESSION_UPDATE', extraData?: any) {
  const clients = sseClients.get(session.id);
  if (!clients || clients.size === 0) return;

  const payload = JSON.stringify({
    type: eventType,
    session,
    extraData,
    timestamp: new Date().toISOString(),
  });

  for (const client of clients) {
    try {
      client.write(`data: ${payload}\n\n`);
    } catch (err) {
      // client disconnected
    }
  }
}

/**
 * Initialize Default Session on startup if none exists
 */
export async function initializeDefaultSession(): Promise<GameSession> {
  await initDatabase();

  const existing = await getGameSession('KM2026');
  if (existing) return existing;

  const session = await createNewSession('KM2026', 'Executive Simulation 2026', [
    'Apex Technologies',
    'Vanguard Systems',
    'Horizon BioTech',
    'Stratos Engineering',
  ]);

  return session;
}

/**
 * Create a new Game Session with N companies
 */
export async function createNewSession(
  sessionId: string,
  title: string,
  companyNames: string[] = ['Apex Technologies']
): Promise<GameSession> {
  const companies: Company[] = companyNames.map((name, idx) =>
    createInitialCompany(name, `comp-${idx + 1}-${sessionId.toLowerCase()}`, DEFAULT_CONFIG)
  );

  const activeEvents: Record<string, ActiveEvent[]> = {};
  for (const c of companies) {
    activeEvents[c.id] = drawRoundEvents(c, DEFAULT_CONFIG);
  }

  const session: GameSession = {
    id: sessionId.toUpperCase(),
    title,
    round: 1,
    phase: 'events',
    isPaused: false,
    isFinalDisruptionActive: false,
    companies,
    activeEvents,
    copMemberships: [],
    config: { ...DEFAULT_CONFIG },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await saveGameSession(session);

  await logGameEvent({
    sessionId: session.id,
    eventType: 'SESSION_CREATED',
    round: 1,
    phase: 'events',
    title: `Game Session ${session.id} Initialized`,
    description: `Session created with ${companies.length} operating companies.`,
    payload: { companies: companies.map((c) => c.name) },
  });

  return session;
}

/**
 * Join Session
 */
export async function joinSession(
  sessionId: string,
  participantName: string,
  companyId: string,
  role: 'participant' | 'controller' | 'facilitator' = 'participant'
): Promise<{ session: GameSession; participant: Participant }> {
  let session = await getGameSession(sessionId.toUpperCase());
  if (!session) {
    // If not found, automatically initialize session
    session = await createNewSession(sessionId.toUpperCase(), `Workshop Session ${sessionId.toUpperCase()}`, ['Apex Technologies', 'Vanguard Industrial']);
  }

  const participant: Participant = {
    id: `part-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    sessionId: session.id,
    name: participantName || 'Strategist',
    companyId: companyId || session.companies[0]?.id || 'comp-1',
    role,
    lastSeen: new Date().toISOString(),
  };

  await saveParticipant(participant);

  await logGameEvent({
    sessionId: session.id,
    companyId: participant.companyId,
    participantId: participant.id,
    eventType: 'PARTICIPANT_JOINED',
    round: session.round,
    phase: session.phase,
    title: `${participant.name} Joined Session`,
    description: `${participant.name} joined as ${role} for ${session.companies.find((c) => c.id === participant.companyId)?.name || 'HQ'}.`,
    payload: { participantId: participant.id, role },
  });

  broadcastSessionUpdate(session, 'PARTICIPANT_JOINED', { participantName: participant.name });
  return { session, participant };
}

/**
 * Redraw Event with Horizon Scan
 */
export async function redrawEventWithHorizonScan(
  sessionId: string,
  companyId: string,
  eventInstanceId: string
): Promise<{ success: boolean; message: string; session: GameSession }> {
  const session = await getGameSession(sessionId);
  if (!session) throw new Error('Session not found');

  const company = session.companies.find((c) => c.id === companyId);
  if (!company) throw new Error('Company not found');

  if (!company.horizonScanDomain) {
    return { success: false, message: 'No active Horizon Scan domain set for this company.', session };
  }
  if (company.horizonScanUsedThisRound) {
    return { success: false, message: 'Horizon Scan redraw has already been used this round.', session };
  }

  const companyEvents = session.activeEvents[companyId] || [];
  const eventIdx = companyEvents.findIndex((e) => e.instanceId === eventInstanceId);
  if (eventIdx === -1) return { success: false, message: 'Event not found.', session };

  const currentEvent = companyEvents[eventIdx];
  const matchesDomain = currentEvent.card.domains.some((d) => d.domain === company.horizonScanDomain);
  if (!matchesDomain) {
    return { success: false, message: `Current event does not match scanned domain (${company.horizonScanDomain}).`, session };
  }

  // Draw replacement
  const replacementCard = getRandomEventCard(currentEvent.card.scope, currentEvent.card.type);
  const newAllocations: Record<KnowledgeDomain, any> = {} as any;
  for (const d of replacementCard.domains) {
    newAllocations[d.domain] = {};
  }

  companyEvents[eventIdx] = {
    instanceId: `evt-inst-${Math.random().toString(36).substring(2, 8)}`,
    card: replacementCard,
    targetSiteId: currentEvent.targetSiteId,
    allocations: newAllocations,
    isResolved: false,
  };

  company.horizonScanUsedThisRound = true;
  await saveGameSession(session);

  await logGameEvent({
    sessionId: session.id,
    companyId: company.id,
    eventType: 'HORIZON_SCAN_REDRAW',
    round: session.round,
    phase: session.phase,
    title: 'Horizon Scan Early Warning Invoked',
    description: `${company.name} used early intelligence in ${company.horizonScanDomain} to discard "${currentEvent.card.title}" and anticipate "${replacementCard.title}".`,
    payload: { previousEvent: currentEvent.card.title, newEvent: replacementCard.title },
  });

  broadcastSessionUpdate(session, 'HORIZON_SCAN_REDRAW');
  return { success: true, message: `Event discarded and replaced with "${replacementCard.title}".`, session };
}

/**
 * Set Event Allocation (Expert or CoP Support)
 */
export async function setEventAllocation(
  sessionId: string,
  companyId: string,
  eventInstanceId: string,
  domain: KnowledgeDomain,
  allocation: { expertId?: string; useCoPSupport?: boolean }
): Promise<{ success: boolean; session: GameSession }> {
  const session = await getGameSession(sessionId);
  if (!session) throw new Error('Session not found');

  const company = session.companies.find((c) => c.id === companyId);
  if (!company) throw new Error('Company not found');

  const companyEvents = session.activeEvents[companyId] || [];
  const event = companyEvents.find((e) => e.instanceId === eventInstanceId);
  if (!event) throw new Error('Event not found');

  if (!event.allocations[domain]) {
    event.allocations[domain] = {};
  }

  if (allocation.expertId !== undefined) {
    event.allocations[domain].expertId = allocation.expertId || undefined;
  }
  if (allocation.useCoPSupport !== undefined) {
    event.allocations[domain].useCoPSupport = allocation.useCoPSupport;
  }

  await saveGameSession(session);
  broadcastSessionUpdate(session, 'EVENT_ALLOCATION_UPDATED');
  return { success: true, session };
}

/**
 * Resolve Events for Company
 */
export async function resolveCompanyEvents(
  sessionId: string,
  companyId: string
): Promise<{ success: boolean; session: GameSession; results: any[] }> {
  const session = await getGameSession(sessionId);
  if (!session) throw new Error('Session not found');

  const company = session.companies.find((c) => c.id === companyId);
  if (!company) throw new Error('Company not found');

  const companyEvents = session.activeEvents[companyId] || [];
  const results: any[] = [];

  for (const event of companyEvents) {
    if (!event.isResolved) {
      const res = resolveActiveEvent(session, company, event, session.config);
      event.isResolved = true;
      event.success = res.success;
      event.domainResults = res.domainResults;
      event.turnoverChangeApplied = res.turnoverChange;

      // Apply turnover change
      if (res.turnoverChange !== 0) {
        if (event.card.scope === 'local' && event.targetSiteId) {
          const site = company.sites.find((s) => s.id === event.targetSiteId);
          if (site) {
            site.turnover = Math.max(0, site.turnover + res.turnoverChange);
          }
        }
        company.turnover = company.sites.reduce((sum, s) => sum + s.turnover, 0);
      }

      results.push({
        eventTitle: event.card.title,
        success: res.success,
        turnoverChange: res.turnoverChange,
        domainResults: res.domainResults,
      });

      await logGameEvent({
        sessionId: session.id,
        companyId: company.id,
        eventType: res.success ? 'EVENT_SUCCESS' : 'EVENT_FAILURE',
        round: session.round,
        phase: session.phase,
        title: `${event.card.title}: ${res.success ? 'Success' : 'Failure'}`,
        description: `${company.name} ${res.success ? 'successfully managed' : 'failed'} "${event.card.title}". Turnover change: ${res.turnoverChange >= 0 ? '+' : ''}$${res.turnoverChange}.`,
        payload: { eventTitle: event.card.title, success: res.success, turnoverChange: res.turnoverChange, domainResults: res.domainResults },
      });
    }
  }

  await saveGameSession(session);
  broadcastSessionUpdate(session, 'EVENTS_RESOLVED', { results });
  return { success: true, session, results };
}

/**
 * Apply Experiential Learning from Successful Opportunity
 */
export async function applyExperientialLearning(
  sessionId: string,
  companyId: string,
  eventInstanceId: string,
  domain: KnowledgeDomain,
  target: 'team' | 'expert',
  targetId?: string // SiteId if team, expertId if expert
): Promise<{ success: boolean; message: string; session: GameSession }> {
  const session = await getGameSession(sessionId);
  if (!session) throw new Error('Session not found');

  const company = session.companies.find((c) => c.id === companyId);
  if (!company) throw new Error('Company not found');

  const companyEvents = session.activeEvents[companyId] || [];
  const event = companyEvents.find((e) => e.instanceId === eventInstanceId);
  if (!event || !event.success || event.card.type !== 'opportunity') {
    return { success: false, message: 'Invalid or unsuccessful opportunity event.', session };
  }
  if (event.experientialLearningAwarded) {
    return { success: false, message: 'Experiential learning already claimed for this event.', session };
  }

  if (target === 'team') {
    const site = company.sites.find((s) => s.id === (targetId || event.targetSiteId));
    if (!site || site.isClosed) return { success: false, message: 'Valid site not found.', session };
    site.teamCapability[domain] = Math.min(6, (site.teamCapability[domain] || 0) + 1);
  } else {
    const expert = company.experts.find((e) => e.id === targetId && !e.isVacant);
    if (!expert) return { success: false, message: 'Valid expert not found.', session };
    const domainObj = expert.domains.find((d) => d.domain === domain);
    if (domainObj) {
      domainObj.score = Math.min(8, domainObj.score + 1);
    } else {
      expert.domains.push({ domain, score: 4 });
    }
  }

  event.experientialLearningAwarded = true;
  recalculateCompanySPOF(company, session.config);
  await saveGameSession(session);

  await logGameEvent({
    sessionId: session.id,
    companyId: company.id,
    eventType: 'EXPERIENTIAL_LEARNING',
    round: session.round,
    phase: session.phase,
    title: 'Experiential Learning Absorbed',
    description: `${company.name} converted opportunity success into +1 ${domain} ${target === 'team' ? 'Team Capability' : 'Deep Expertise'}.`,
    payload: { domain, target, targetId },
  });

  broadcastSessionUpdate(session, 'EXPERIENTIAL_LEARNING_APPLIED');
  return { success: true, message: `Experiential learning awarded: +1 ${domain} ${target}.`, session };
}

/**
 * Execute Knowledge Action
 */
export async function handleKnowledgeAction(
  sessionId: string,
  companyId: string,
  payload: ActionPayload
): Promise<{ success: boolean; message: string; session: GameSession }> {
  const session = await getGameSession(sessionId);
  if (!session) throw new Error('Session not found');

  const company = session.companies.find((c) => c.id === companyId);
  if (!company) throw new Error('Company not found');

  const actionResult = executeKnowledgeAction(session, company, payload, session.config);
  if (!actionResult.success) {
    return { success: false, message: actionResult.message, session };
  }

  await logGameEvent({
    sessionId: session.id,
    companyId: company.id,
    eventType: payload.type,
    round: session.round,
    phase: session.phase,
    title: actionResult.eventLogTitle,
    description: actionResult.eventLogDesc,
    payload: { actionType: payload.type, ...payload, costTurnover: actionResult.costTurnover },
  });

  await saveGameSession(session);
  broadcastSessionUpdate(session, 'ACTION_EXECUTED', { actionType: payload.type, message: actionResult.message });
  return { success: true, message: actionResult.message, session };
}

/**
 * Advance Phase
 */
export async function advanceSessionPhase(
  sessionId: string,
  targetPhase?: GamePhase
): Promise<{ session: GameSession; phaseResult?: any }> {
  const session = await getGameSession(sessionId);
  if (!session) throw new Error('Session not found');

  const phaseOrder: GamePhase[] = ['events', 'respond', 'consequences', 'investment', 'risk'];
  const currentIndex = phaseOrder.indexOf(session.phase);
  const nextPhase = targetPhase || phaseOrder[(currentIndex + 1) % phaseOrder.length];

  let phaseResult: any = null;

  // Phase 5 Attrition Execution
  if (session.phase === 'risk' && nextPhase === 'events') {
    // Advance Round!
    session.round += 1;

    // Check if Final Disruption (Round 6)
    if (session.round > session.config.rounds) {
      session.isFinalDisruptionActive = true;
      session.finalDisruptionCard = FINAL_DISRUPTION_CARDS[0];
      session.finalDisruptionResolved = false;
    }

    // Execute attrition & resets for all companies
    const attritionSummaries: Record<string, any> = {};
    for (const comp of session.companies) {
      const att = executePhase5Attrition(session, comp, session.config);
      attritionSummaries[comp.id] = att;

      // Draw new events for next round if not final disruption
      if (!session.isFinalDisruptionActive) {
        session.activeEvents[comp.id] = drawRoundEvents(comp, session.config);
      }

      await logGameEvent({
        sessionId: session.id,
        companyId: comp.id,
        eventType: 'ROUND_ATTRITION',
        round: session.round - 1,
        phase: 'risk',
        title: `Round ${session.round - 1} Attrition & Workforce Review`,
        description: `Resolved expert attrition (${att.departedExperts.length} departed), workforce shifts (${att.workforceAttrition.length}), and site solvency.`,
        payload: att,
      });
    }

    phaseResult = { attritionSummaries };
  }

  session.phase = nextPhase;
  session.updatedAt = new Date().toISOString();

  await logGameEvent({
    sessionId: session.id,
    eventType: 'PHASE_ADVANCED',
    round: session.round,
    phase: session.phase,
    title: `Phase Advanced: ${session.phase.toUpperCase()} (Round ${session.round})`,
    description: `Session transitioned to ${session.phase} phase.`,
    payload: { round: session.round, phase: session.phase },
  });

  await saveGameSession(session);
  broadcastSessionUpdate(session, 'PHASE_ADVANCED', { phase: session.phase, round: session.round, phaseResult });
  return { session, phaseResult };
}

/**
 * Trigger or Resolve Final Disruption (Round 6)
 */
export async function resolveFinalDisruption(sessionId: string): Promise<{ session: GameSession; results: any[] }> {
  const session = await getGameSession(sessionId);
  if (!session) throw new Error('Session not found');

  if (!session.finalDisruptionCard) {
    session.finalDisruptionCard = FINAL_DISRUPTION_CARDS[0];
  }

  const results: any[] = [];
  for (const comp of session.companies) {
    const activeEvent: ActiveEvent = {
      instanceId: `final-disrupt-${comp.id}`,
      card: session.finalDisruptionCard,
      allocations: {} as any,
      isResolved: false,
    };

    const res = resolveActiveEvent(session, comp, activeEvent, session.config);
    if (!res.success) {
      comp.turnover = Math.max(0, comp.turnover - session.finalDisruptionCard.impact);
    }

    results.push({
      companyId: comp.id,
      companyName: comp.name,
      finalTurnover: comp.turnover,
      success: res.success,
      domainResults: res.domainResults,
    });

    await logGameEvent({
      sessionId: session.id,
      companyId: comp.id,
      eventType: 'FINAL_DISRUPTION_RESOLVED',
      round: session.round,
      phase: session.phase,
      title: `Final Disruption: ${comp.name} ${res.success ? 'Survives Intact' : 'Suffers Impact'}`,
      description: `${comp.name} tested against "${session.finalDisruptionCard.title}". Final turnover: $${comp.turnover}.`,
      payload: { success: res.success, domainResults: res.domainResults, finalTurnover: comp.turnover },
    });
  }

  session.finalDisruptionResolved = true;
  await saveGameSession(session);
  broadcastSessionUpdate(session, 'FINAL_DISRUPTION_RESOLVED', { results });
  return { session, results };
}

/**
 * Facilitator Overrides & Customizations
 */
export async function facilitatorUpdateSession(
  sessionId: string,
  updates: {
    round?: number;
    phase?: GamePhase;
    isPaused?: boolean;
    config?: any;
    adjustCompanyTurnover?: { companyId: string; delta: number };
    triggerCustomEvent?: { companyId: string; card: EventCard };
  }
): Promise<GameSession> {
  const session = await getGameSession(sessionId);
  if (!session) throw new Error('Session not found');

  if (updates.round !== undefined) session.round = updates.round;
  if (updates.phase !== undefined) session.phase = updates.phase;
  if (updates.isPaused !== undefined) session.isPaused = updates.isPaused;
  if (updates.config) session.config = { ...session.config, ...updates.config };

  if (updates.adjustCompanyTurnover) {
    const comp = session.companies.find((c) => c.id === updates.adjustCompanyTurnover!.companyId);
    if (comp) {
      comp.turnover = Math.max(0, comp.turnover + updates.adjustCompanyTurnover.delta);
    }
  }

  if (updates.triggerCustomEvent) {
    const compEvents = session.activeEvents[updates.triggerCustomEvent.companyId] || [];
    compEvents.push({
      instanceId: `custom-evt-${Date.now()}`,
      card: updates.triggerCustomEvent.card,
      allocations: {} as any,
      isResolved: false,
    });
    session.activeEvents[updates.triggerCustomEvent.companyId] = compEvents;
  }

  await saveGameSession(session);
  broadcastSessionUpdate(session, 'FACILITATOR_OVERRIDE');
  return session;
}
