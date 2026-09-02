import type { GameSessionV2 } from '../types/gameV2.ts';
import {
  advancePhaseV2 as baseAdvancePhaseV2,
  getSessionV2 as baseGetSessionV2,
} from './gameServiceV5.ts';

export * from './gameServiceV5.ts';

function allEventsResolved(session: GameSessionV2): boolean {
  return session.companies.every(company =>
    (session.activeEvents[company.id] || []).every(event => event.isResolved),
  );
}

/**
 * Compatibility recovery for sessions stranded in the legacy Consequences phase.
 * The redesigned board no longer exposes a Consequences screen, so once every
 * Event is resolved the only valid player-facing destination is Invest.
 */
export async function getSessionV2(sessionId: string): Promise<GameSessionV2 | null> {
  const session = await baseGetSessionV2(sessionId.toUpperCase());
  if (!session) return null;

  if (session.phase === 'consequences' && allEventsResolved(session)) {
    const recovered = await baseAdvancePhaseV2(session.id, 'investment');
    return recovered.session;
  }

  return session;
}
