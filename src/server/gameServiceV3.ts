import {
  getSessionV2 as baseGetSessionV2,
  knowledgeActionV2 as baseKnowledgeActionV2,
  registerSSEClientV2 as baseRegisterSSEClientV2,
} from './gameServiceV8.ts';

export * from './gameServiceV8.ts';

/**
 * Keep Event acknowledgement idempotent across multiple browsers in one company.
 * If another player has already acknowledged the resolved Event, a late CONTINUE
 * is a request to catch up, not an error. Return the authoritative current
 * session so the stale browser immediately converges on the company's next Event.
 */
export async function knowledgeActionV2(sessionId:string,companyId:string,payload:any){
  const result:any=await baseKnowledgeActionV2(sessionId,companyId,payload);
  if(
    payload?.type==='ACK_EVENT_RESOLUTION'&&
    result?.success===false&&
    result?.message==='That Event is no longer the company Event.'
  ){
    const session=result.session||await baseGetSessionV2(sessionId.toUpperCase());
    if(!session)return result;
    const company=session.companies.find((candidate:any)=>candidate.id===companyId);
    if(!company)return result;
    const winnerEventInstanceId=String((company as any).uiOpenEventInstanceId||'')||undefined;
    return{
      success:true,
      staleAcknowledgement:true,
      message:winnerEventInstanceId
        ?'Another player already continued. Showing the current company Event.'
        :'Another player already continued. Your game is now up to date.',
      winnerEventInstanceId,
      session,
    };
  }
  return result;
}

/**
 * SSE is the multiplayer state bus. A reconnect must therefore send a complete
 * authoritative snapshot, not just a CONNECTED heartbeat; otherwise a browser
 * that missed one broadcast can remain permanently out of sync.
 */
export function registerSSEClientV2(sessionId:string,res:any){
  baseRegisterSSEClientV2(sessionId,res);
  void baseGetSessionV2(sessionId.toUpperCase()).then(session=>{
    if(!session||res.writableEnded||res.destroyed)return;
    res.write(`data: ${JSON.stringify({type:'SESSION_SYNC',session})}\n\n`);
  }).catch(()=>{
    // The normal REST/session calls remain available if an initial sync fails.
  });
}
