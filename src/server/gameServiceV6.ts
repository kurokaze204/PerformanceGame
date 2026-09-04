import type { GameSessionV2 } from '../types/gameV2.ts';
import {
  advancePhaseV2 as baseAdvancePhaseV2,
  getSessionV2 as baseGetSessionV2,
  knowledgeActionV2 as baseKnowledgeActionV2,
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

/**
 * A delayed Event is removed from the current round's active Event list. If that
 * was the company's last unresolved Event, follow the same player-facing flow as
 * resolving the last Event and move immediately into Invest.
 */
export async function knowledgeActionV2(sessionId:string,companyId:string,payload:any){
  const result:any=await baseKnowledgeActionV2(sessionId,companyId,payload);
  if(!result?.success||payload?.type!=='DELAY_EVENT'||!result.session)return result;
  const remaining=result.session.activeEvents[companyId]||[];
  if(remaining.some((event:any)=>!event.isResolved))return result;
  const advanced:any=await baseAdvancePhaseV2(result.session.id,'investment');
  if(!advanced?.success||!advanced.session)return result;
  return{...result,session:advanced.session};
}
