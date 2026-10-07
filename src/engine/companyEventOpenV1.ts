import type { GameSessionV2 } from '../types/gameV2.ts';

export type CompanyEventOpenClaim = {
  success: boolean;
  winnerEventInstanceId?: string;
  claimed: boolean;
  message: string;
};

const openQueues = new Map<string, Promise<any>>();

export function serialiseCompanyEventOpenV1<T>(sessionId:string, companyId:string, work:()=>Promise<T>):Promise<T>{
  const key=`${sessionId.toUpperCase()}:${companyId}`;
  const prior=openQueues.get(key)||Promise.resolve();
  const run=prior.then(work,work);
  openQueues.set(key,run.finally(()=>{if(openQueues.get(key)===run)openQueues.delete(key);}));
  return run;
}

/**
 * Authoritative company-level Event-card claim.
 *
 * Exactly one unresolved Event may be open for a company at a time. Once an
 * unresolved Event has been claimed, later clicks (including simultaneous
 * clicks arriving after the first claim) return the existing winner rather
 * than opening another card.
 */
export function claimCompanyOpenEventV1(
  session: GameSessionV2,
  companyId: string,
  eventInstanceId: string,
): CompanyEventOpenClaim {
  const company = session.companies.find(candidate => candidate.id === companyId);
  if (!company) return { success: false, claimed: false, message: 'Company not found.' };

  const events = session.activeEvents[companyId] || [];
  const requested = events.find(event => event.instanceId === eventInstanceId);
  if (!requested || requested.isResolved) {
    return { success: false, claimed: false, message: 'That Event is no longer available.' };
  }

  const firstTutorial=company.round===1
    ?events.find(event=>!event.isResolved&&event.card.tags?.includes('tutorial-programmed-failure'))
    :undefined;
  const secondTutorial=company.round===1&&!firstTutorial
    ?events.find(event=>!event.isResolved&&event.card.tags?.includes('tutorial-knowledge-assembly'))
    :undefined;
  const requiredTutorial=firstTutorial||secondTutorial;
  const requestedEvent=requiredTutorial||requested;

  const currentId = String((company as any).uiOpenEventInstanceId || '');
  const current = events.find(event => event.instanceId === currentId && !event.isResolved);
  if (current) {
    return {
      success: true,
      claimed: false,
      winnerEventInstanceId: current.instanceId,
      message: current.instanceId === requested.instanceId
        ? 'This Event is already open for the company.'
        : 'Another player opened an Event first. Showing the company Event.',
    };
  }

  (company as any).uiOpenEventInstanceId = requestedEvent.instanceId;
  return {
    success: true,
    claimed: true,
    winnerEventInstanceId: requestedEvent.instanceId,
    message: requiredTutorial&&requiredTutorial.instanceId!==requested.instanceId
      ? 'Showing the next Round 1 teaching challenge first.'
      : 'Event opened for the company.',
  };
}

export function clearCompanyOpenEventV1(
  session: GameSessionV2,
  companyId: string,
  eventInstanceId?: string,
): boolean {
  const company = session.companies.find(candidate => candidate.id === companyId);
  if (!company) return false;
  const current = String((company as any).uiOpenEventInstanceId || '');
  if (!current) return false;
  if (eventInstanceId && current !== eventInstanceId) return false;
  delete (company as any).uiOpenEventInstanceId;
  return true;
}

export function companyOpenEventIdV1(session: GameSessionV2, companyId: string): string | null {
  const company = session.companies.find(candidate => candidate.id === companyId);
  if (!company) return null;
  const currentId = String((company as any).uiOpenEventInstanceId || '');
  const current = (session.activeEvents[companyId] || []).find(event => event.instanceId === currentId && !event.isResolved);
  return current?.instanceId || null;
}
