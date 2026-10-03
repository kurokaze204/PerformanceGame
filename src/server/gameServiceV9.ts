import type { KnowledgeDomain, Participant } from '../types/game.ts';
import type { ActiveEventV2, CompanyRoundPhase, GameSessionV2 } from '../types/gameV2.ts';
import { executeRiskPhaseV4 } from '../engine/riskPhaseV4.ts';
import { drawRoundEventsV2, prepareCompanyNextRoundV2, recalculateCompanySPOFV2 } from '../engine/coreV2.ts';
import { EXPERT_RELOCATION_COST_V1, roundInvestmentMoneyV1 } from '../engine/investmentCapacityV1.ts';
import { advanceSoloCoPPeerV5, initialiseSoloCoPPeerV5, soloPeerAutoReplyV5 } from '../engine/copNetworkV5.ts';
import { isInvestmentActionV4 } from '../engine/investmentActionsV4.ts';
import { applyProgressionToCurrentEvents, PROGRAMMED_FAILURE_TAG } from '../engine/eventProgressionV5.ts';
import { applyInterfaceSimplificationV1 } from '../engine/interfaceSimplificationV1.ts';
import { claimCompanyOpenEventV1, clearCompanyOpenEventV1, serialiseCompanyEventOpenV1 } from '../engine/companyEventOpenV1.ts';
import { applyKMWeekActionV1, ensureKMWeekSessionV1 } from '../engine/kmWeekV1.ts';
import { resolveSingleEventExplicitV2 } from '../engine/challengeResponseV2.ts';
import { dealCompanyDisruptionsV1, swapDisruptionWithPeerV1 } from '../engine/disruptionPlusV1.ts';
import { deleteParticipant, saveParticipant, saveSessionV2 } from './dbV2.ts';
import { broadcastV2 } from './gameServiceV2.ts';
import {
  applyLearningV2 as baseApplyLearningV2,
  getSessionV2 as baseGetSessionV2,
  joinSessionV2 as baseJoinSessionV2,
  knowledgeActionV2 as baseKnowledgeActionV2,
  redrawEventV2 as baseRedrawEventV2,
  resolveEventV2 as baseResolveEventV2,
  setEventAllocationV2 as baseSetEventAllocationV2,
} from './gameServiceV7.ts';
import {
  companyPlayersV1,
  participantCanControlCompanyV1,
  reconcileCompanyControllersV1,
  transferCompanyControllerV1,
} from './companyControlV1.ts';

export * from './gameServiceV7.ts';
export { participantCanControlCompanyV1 } from './companyControlV1.ts';

/**
 * Multiplayer V9: companies are independent game loops. The workshop session
 * carries shared services (timer, facilitator, CoP), but never drives a company
 * browser into a phase. Exactly one participant is the company controller/CEO.
 */

const REPLACEMENT_NAMES = [
  'Alex Morgan','Priya Shah','Daniel Chen','Mia Thompson','Jordan Lee','Samira Patel','Liam Brooks','Nina Alvarez',
  'Marcus Reed','Sophie Nguyen','Ethan Walsh','Grace Kim','Owen Clarke','Aisha Rahman','Noah Bennett','Chloe Martin',
  'Lucas Ferreira','Emily Zhao','Jack Wilson','Hannah Singh','Leo Martinez','Zoe Campbell','Arjun Mehta','Isla Roberts',
  'Ben Carter','Amelia Scott','Kai Johnson','Ruby Evans','Thomas Green','Layla Hassan','Max Turner','Ella Foster',
];

const queues=new Map<string,Promise<any>>();
function serialiseSession<T>(sessionId:string,work:()=>Promise<T>):Promise<T>{
  const key=sessionId.toUpperCase();
  const prior=queues.get(key)||Promise.resolve();
  const run=prior.then(work,work);
  queues.set(key,run.finally(()=>{if(queues.get(key)===run)queues.delete(key);}));
  return run;
}

function phaseFromLegacy(session:GameSessionV2):CompanyRoundPhase{
  if(session.phase==='investment')return'investment';
  if(session.phase==='risk')return'risk';
  return'events';
}

function ensureCompanyState(session:GameSessionV2):boolean{
  let changed=false;
  const fallback=phaseFromLegacy(session);
  for(const company of session.companies){
    if(!Number.isFinite(company.round)||company.round<1){company.round=Math.max(1,Number(session.round||1));changed=true;}
    if(!['events','investment','risk'].includes(String(company.roundPhase))){
      // Old "waiting" snapshots are safest resumed at Events rather than
      // reintroducing the retired all-company barrier.
      company.roundPhase=fallback==='risk'?'risk':'events';
      changed=true;
    }
    if(company.controllerParticipantId===undefined){company.controllerParticipantId=null;changed=true;}
    if((company as any).autopilotEnabled!==undefined){delete (company as any).autopilotEnabled;changed=true;}
  }
  return changed;
}

function staffedCompanies(session:GameSessionV2){
  const staffed=session.companies.filter(company=>companyPlayersV1(session,company.id).length>0);
  return staffed.length?staffed:session.companies;
}

function syncSessionSummary(session:GameSessionV2){
  const active=staffedCompanies(session);
  session.round=Math.max(1,Math.min(...active.map(company=>company.round||1)));
  // Session phase is deliberately neutral. Player-facing phase always comes
  // from company.roundPhase. This prevents one company's transition navigating
  // every browser in the workshop.
  session.phase='respond';
}

function setLegacyCompanyContext(session:GameSessionV2,company:GameSessionV2['companies'][number],phase:CompanyRoundPhase=company.roundPhase){
  session.round=company.round;
  session.phase=phase==='events'?'respond':phase;
}

function nextReplacementName(company:GameSessionV2['companies'][number]):string{
  company.retiredExpertNames??=[];
  const used=new Set<string>([
    ...company.retiredExpertNames,
    ...company.experts.map(expert=>expert.name),
    ...company.experts.map(expert=>expert.replacementName||'').filter(Boolean),
  ]);
  const available=REPLACEMENT_NAMES.find(name=>!used.has(name));
  if(available)return available;
  let n=1;while(used.has(`New Expert ${n}`))n+=1;return `New Expert ${n}`;
}

function nameRiskReplacements(session:GameSessionV2,company:GameSessionV2['companies'][number]){
  const summary=session.riskResults?.[company.id];
  if(!summary)return;
  company.retiredExpertNames??=[];
  for(const departure of summary.departedExperts||[]){
    const expert=company.experts.find(candidate=>candidate.id===departure.expertId);
    if(!expert)continue;
    if(!company.retiredExpertNames.includes(departure.expertName))company.retiredExpertNames.push(departure.expertName);
    if(!expert.replacementName)expert.replacementName=nextReplacementName(company);
    departure.replacementName=expert.replacementName||undefined;
  }
}

async function persistParticipantRoles(participants:Participant[]){
  for(const participant of participants)await saveParticipant(participant);
}

function repairPendingResolutionPointers(session:GameSessionV2):boolean{
  let changed=false;
  for(const company of session.companies){
    const pending=(session.activeEvents[company.id]||[]).filter(event=>!event.isResolved&&(event as any).uiResolutionData!=null);
    if(pending.length!==1)continue;
    const pendingId=pending[0].instanceId;
    if(String((company as any).uiOpenEventInstanceId||'')!==pendingId){
      (company as any).uiOpenEventInstanceId=pendingId;
      changed=true;
    }
  }
  return changed;
}

function freshAllocations(event:ActiveEventV2):ActiveEventV2['allocations']{
  const allocations:any={};
  for(const requirement of event.card.domains)allocations[requirement.domain]={};
  return allocations;
}

function timerRemainingSeconds(session:GameSessionV2){
  if(session.timerEndsAt)return Math.max(0,Math.ceil((new Date(session.timerEndsAt).getTime()-Date.now())/1000));
  return session.timerPausedSecondsRemaining??session.gameDurationMinutes*60;
}

function finalChallengeDue(session:GameSessionV2){
  if(session.experienceMode==='expert'&&session.gameEndMode==='rounds'){
    return staffedCompanies(session).every(company=>company.round>=session.finalRoundCount);
  }
  const timerHasRun=Boolean(session.timerStartedAt||session.timerEndsAt||(session.timerPausedSecondsRemaining!=null&&session.timerPausedSecondsRemaining<session.gameDurationMinutes*60));
  return timerHasRun&&timerRemainingSeconds(session)<=session.finalWindowMinutes*60;
}

async function startFinalChallenge(session:GameSessionV2){
  dealCompanyDisruptionsV1(session);
  session.isFinalDisruptionActive=true;
  const first=staffedCompanies(session)[0]?.disruptionCard||session.companies[0]?.disruptionCard;
  if(first)session.finalDisruptionCard={id:first.id,title:first.title,description:first.description,type:'problem',scope:'local',domains:first.domains,impact:first.impact,tags:['final-disruption','disruption-plus']};
  session.finalDisruptionResolved=false;
  syncSessionSummary(session);
  await saveSessionV2(session);
  broadcastV2(session,'FINAL_DISRUPTION_STARTED',{round:session.round});
  return{success:true,message:'Final disruption begins.',session};
}

async function healSession(session:GameSessionV2){
  let changed=ensureCompanyState(session);
  if(ensureKMWeekSessionV1(session))changed=true;
  if(repairPendingResolutionPointers(session))changed=true;
  if(session.soloMode&&!session.soloCopPeer){initialiseSoloCoPPeerV5(session);changed=true;}
  const roleChanges=reconcileCompanyControllersV1(session);
  if(roleChanges.length){await persistParticipantRoles(roleChanges);changed=true;}
  const previousRound=session.round,previousPhase=session.phase;
  syncSessionSummary(session);
  if(previousRound!==session.round||previousPhase!==session.phase)changed=true;
  if(changed)await saveSessionV2(session);
  return session;
}

export async function getSessionV2(sessionId:string):Promise<GameSessionV2|null>{
  const session=await baseGetSessionV2(sessionId.toUpperCase());
  if(!session)return null;
  return healSession(session);
}

export async function joinSessionV2(sessionId:string,name:string,companyId?:string,role:Participant['role']='participant'){
  return serialiseSession(sessionId,async()=>{
    const result:any=await baseJoinSessionV2(sessionId,name,companyId,role);
    const session=result.session as GameSessionV2;
    ensureCompanyState(session);
    const roleChanges=reconcileCompanyControllersV1(session);
    await persistParticipantRoles(roleChanges);
    const participant=session.participants.find(item=>item.id===result.participant?.id)||result.participant;
    if(participant&&participant.role!==result.participant?.role)await saveParticipant(participant);
    syncSessionSummary(session);
    await saveSessionV2(session);
    broadcastV2(session,'PARTICIPANT_JOINED_WITH_COMPANY_ROLE',{participantId:participant?.id,companyId:participant?.companyId,role:participant?.role});
    return{...result,session,participant};
  });
}

export async function transferCompanyCeoV1(sessionId:string,companyId:string,currentParticipantId:string,targetParticipantId:string){
  return serialiseSession(sessionId,async()=>{
    const session=await baseGetSessionV2(sessionId.toUpperCase());
    if(!session)return{success:false,message:'Session not found.'};
    ensureCompanyState(session);
    const result=transferCompanyControllerV1(session,companyId,targetParticipantId,currentParticipantId,false);
    if(!result.success)return{...result,session};
    await persistParticipantRoles(result.changedParticipants);
    await saveSessionV2(session);
    broadcastV2(session,'COMPANY_CEO_TRANSFERRED',{companyId,fromParticipantId:currentParticipantId,toParticipantId:targetParticipantId});
    return{...result,session};
  });
}

export async function facilitatorAssignCompanyCeoV1(sessionId:string,companyId:string,targetParticipantId:string){
  return serialiseSession(sessionId,async()=>{
    const session=await baseGetSessionV2(sessionId.toUpperCase());
    if(!session)return{success:false,message:'Session not found.'};
    ensureCompanyState(session);
    const result=transferCompanyControllerV1(session,companyId,targetParticipantId,null,true);
    if(!result.success)return{...result,session};
    await persistParticipantRoles(result.changedParticipants);
    await saveSessionV2(session);
    broadcastV2(session,'FACILITATOR_ASSIGNED_COMPANY_CEO',{companyId,toParticipantId:targetParticipantId});
    return{...result,session};
  });
}

export async function recoverParticipantV1(sessionId:string,payload:{id?:string;name?:string;companyId?:string}){
  return serialiseSession(sessionId,async()=>{
    const session=await baseGetSessionV2(sessionId.toUpperCase());
    if(!session)return{success:false,message:'Session not found.'};
    ensureCompanyState(session);
    const participantId=String(payload?.id||'').trim();
    const companyId=String(payload?.companyId||'').trim();
    const company=session.companies.find(candidate=>candidate.id===companyId);
    if(!participantId||participantId.startsWith('fac-view-')||!company)return{success:false,message:'Participant recovery details are invalid.',session};
    const existing=session.participants.find(participant=>participant.id===participantId);
    if(existing)return{success:true,message:'Participant already registered.',session,participant:existing};

    const firstForCompany=companyPlayersV1(session,company.id).length===0;
    const participant:Participant={
      id:participantId,
      sessionId:session.id,
      name:String(payload?.name||'Player').trim()||'Player',
      companyId:company.id,
      role:firstForCompany?'controller':'participant',
      lastSeen:new Date().toISOString(),
    };
    session.participants.push(participant);
    if(firstForCompany)company.controllerParticipantId=participant.id;
    const participantCountBefore=session.participants.filter(item=>item.role!=='facilitator'&&item.id!==participant.id).length;
    if(participantCountBefore===0&&!session.timerStartedAt&&!session.timerEndsAt){
      const remaining=session.timerPausedSecondsRemaining??session.gameDurationMinutes*60;
      session.timerStartedAt=new Date().toISOString();
      session.timerEndsAt=new Date(Date.now()+remaining*1000).toISOString();
      session.timerPausedSecondsRemaining=null;
    }
    await saveParticipant(participant);
    syncSessionSummary(session);
    await saveSessionV2(session);
    broadcastV2(session,'PARTICIPANT_RECOVERED',{participantId:participant.id,companyId:company.id,role:participant.role});
    return{success:true,message:`${participant.name} was restored to ${company.name}.`,session,participant};
  });
}

export async function moveParticipantV3(sessionId:string,participantId:string,companyId:string){
  return serialiseSession(sessionId,async()=>{
    const session=await baseGetSessionV2(sessionId.toUpperCase());
    if(!session)throw new Error('Session not found.');
    ensureCompanyState(session);
    const participant=session.participants.find(item=>item.id===participantId&&item.role!=='facilitator');
    const target=session.companies.find(company=>company.id===companyId);
    if(!participant||!target)throw new Error('Player or company not found.');
    const targetCount=companyPlayersV1(session,target.id).filter(player=>player.id!==participant.id).length;
    if(targetCount>=session.maxPlayersPerCompany)throw new Error(`${target.name} is already at the player limit.`);

    const oldCompany=session.companies.find(company=>company.id===participant.companyId);
    const wasController=oldCompany?.controllerParticipantId===participant.id;
    participant.companyId=target.id;
    participant.lastSeen=new Date().toISOString();
    participant.role='participant';

    const changed=new Map<string,Participant>([[participant.id,participant]]);
    if(oldCompany&&wasController){
      oldCompany.controllerParticipantId=null;
      const remaining=companyPlayersV1(session,oldCompany.id).filter(player=>player.id!==participant.id);
      const replacement=remaining[0];
      if(replacement){replacement.role='controller';oldCompany.controllerParticipantId=replacement.id;changed.set(replacement.id,replacement);}
    }
    if(!target.controllerParticipantId){
      participant.role='controller';
      target.controllerParticipantId=participant.id;
    }
    const repaired=reconcileCompanyControllersV1(session);
    repaired.forEach(player=>changed.set(player.id,player));
    await persistParticipantRoles([...changed.values()]);
    syncSessionSummary(session);
    await saveSessionV2(session);
    broadcastV2(session,'PARTICIPANT_MOVED',{participantId,companyId,role:participant.role});
    return session;
  });
}

export async function facilitatorRemoveParticipantV1(sessionId:string,participantId:string){
  return serialiseSession(sessionId,async()=>{
    const session=await baseGetSessionV2(sessionId.toUpperCase());
    if(!session)return{success:false,message:'Session not found.'};
    ensureCompanyState(session);
    const participant=session.participants.find(item=>item.id===participantId&&item.role!=='facilitator');
    if(!participant)return{success:false,message:'Player not found.',session};
    const company=session.companies.find(candidate=>candidate.id===participant.companyId);
    const wasController=company?.controllerParticipantId===participant.id;
    session.participants=session.participants.filter(item=>item.id!==participantId);
    await deleteParticipant(participantId);
    const changed:Participant[]=[];
    if(company&&wasController){
      company.controllerParticipantId=null;
      const replacement=companyPlayersV1(session,company.id)[0];
      if(replacement){replacement.role='controller';company.controllerParticipantId=replacement.id;changed.push(replacement);}
    }
    changed.push(...reconcileCompanyControllersV1(session));
    await persistParticipantRoles([...new Map(changed.map(player=>[player.id,player])).values()]);
    syncSessionSummary(session);
    await saveSessionV2(session);
    broadcastV2(session,'FACILITATOR_REMOVED_PARTICIPANT',{participantId,companyId:participant.companyId,name:participant.name});
    return{success:true,message:`${participant.name} was removed from the game.`,session};
  });
}

export async function facilitatorRemoveCompanyV1(sessionId:string,companyId:string){
  return serialiseSession(sessionId,async()=>{
    const session=await baseGetSessionV2(sessionId.toUpperCase());
    if(!session)return{success:false,message:'Session not found.'};
    if(session.isFinalDisruptionActive)return{success:false,message:'Companies cannot be removed during the Final Challenge.',session};
    if(session.companies.length<=1)return{success:false,message:'The game must keep at least one company.',session};
    const company=session.companies.find(candidate=>candidate.id===companyId);
    if(!company)return{success:false,message:'Company not found.',session};
    const assigned=companyPlayersV1(session,companyId).length;
    if(assigned>0)return{success:false,message:`Move the ${assigned} assigned player${assigned===1?'':'s'} to another company before removing ${company.name}.`,session};

    session.companies=session.companies.filter(candidate=>candidate.id!==companyId);
    delete session.activeEvents[companyId];
    if(session.riskResults)delete session.riskResults[companyId];
    session.copMemberships=(session.copMemberships||[]).filter(membership=>membership.companyId!==companyId);
    session.copMessages=(session.copMessages||[]).filter(message=>message.fromCompanyId!==companyId&&message.toCompanyId!==companyId);
    for(const remaining of session.companies)if(remaining.disruptionSwapNotice?.fromCompanyId===companyId)remaining.disruptionSwapNotice=null;
    if(Array.isArray((session as any).finalDisruptionResults)){
      (session as any).finalDisruptionResults=(session as any).finalDisruptionResults.filter((item:any)=>item.companyId!==companyId);
    }
    syncSessionSummary(session);
    applyInterfaceSimplificationV1(session);
    await saveSessionV2(session);
    broadcastV2(session,'FACILITATOR_REMOVED_COMPANY',{companyId,companyName:company.name,round:session.round});
    return{success:true,message:`${company.name} was removed from the game.`,session};
  });
}

export async function advancePhaseV2(sessionId:string){
  const session=await getSessionV2(sessionId);
  return{success:false,message:'Global phase advancement has been retired. Each company now advances independently.',session};
}

async function runLegacyCompanyMutation(
  sessionId:string,
  companyId:string,
  requiredPhase:CompanyRoundPhase,
  work:()=>Promise<any>,
){
  return serialiseSession(sessionId,async()=>{
    const session=await baseGetSessionV2(sessionId.toUpperCase());
    if(!session)return{success:false,message:'Session not found.'};
    ensureCompanyState(session);
    const company=session.companies.find(candidate=>candidate.id===companyId);
    if(!company)return{success:false,message:'Company not found.',session};
    if(company.roundPhase!==requiredPhase)return{success:false,message:`This action is not available during ${company.roundPhase}.`,session};
    setLegacyCompanyContext(session,company,requiredPhase);
    await saveSessionV2(session);
    const result:any=await work();
    const authoritative=(result?.session||await baseGetSessionV2(session.id)) as GameSessionV2|null;
    if(!authoritative)return result;
    ensureCompanyState(authoritative);
    syncSessionSummary(authoritative);
    await saveSessionV2(authoritative);
    broadcastV2(authoritative,'COMPANY_STATE_UPDATED',{companyId});
    return{...result,session:authoritative};
  });
}

export async function setEventAllocationV2(sessionId:string,companyId:string,eventInstanceId:string,domain:KnowledgeDomain,allocation:any){
  return runLegacyCompanyMutation(sessionId,companyId,'events',()=>baseSetEventAllocationV2(sessionId,companyId,eventInstanceId,domain,allocation));
}

export async function redrawEventV2(sessionId:string,companyId:string,eventInstanceId:string){
  return runLegacyCompanyMutation(sessionId,companyId,'events',()=>baseRedrawEventV2(sessionId,companyId,eventInstanceId));
}

export async function applyLearningV2(sessionId:string,companyId:string,eventInstanceId:string,domain:KnowledgeDomain,target:'team'|'expert',targetId?:string){
  // This legacy endpoint remains for compatibility. Current AAR learning uses
  // the investment action path; scope its old Consequences check to this company.
  return serialiseSession(sessionId,async()=>{
    const session=await baseGetSessionV2(sessionId.toUpperCase());
    if(!session)return{success:false,message:'Session not found.'};
    ensureCompanyState(session);
    const company=session.companies.find(candidate=>candidate.id===companyId);
    if(!company)return{success:false,message:'Company not found.',session};
    session.round=company.round;session.phase='consequences';
    await saveSessionV2(session);
    const result:any=await baseApplyLearningV2(sessionId,companyId,eventInstanceId,domain,target,targetId);
    const authoritative=(result?.session||await baseGetSessionV2(session.id)) as GameSessionV2;
    ensureCompanyState(authoritative);syncSessionSummary(authoritative);await saveSessionV2(authoritative);
    return{...result,session:authoritative};
  });
}

async function finishInvesting(sessionId:string,companyId:string){
  return serialiseSession(sessionId,async()=>{
    const session=await baseGetSessionV2(sessionId.toUpperCase());
    if(!session)return{success:false,message:'Session not found.'};
    ensureCompanyState(session);
    const company=session.companies.find(candidate=>candidate.id===companyId);
    if(!company)return{success:false,message:'Company not found.',session};
    if(company.roundPhase!=='investment')return{success:false,message:'This company has already finished investing.',session};

    setLegacyCompanyContext(session,company,'investment');
    session.riskResults??={};
    session.riskResults[company.id]=executeRiskPhaseV4(session,company);
    nameRiskReplacements(session,company);
    company.roundPhase='risk';
    syncSessionSummary(session);
    applyInterfaceSimplificationV1(session);
    await saveSessionV2(session);
    broadcastV2(session,'COMPANY_ENTERED_KNOWLEDGE_RISK',{companyId:company.id,round:company.round});
    return{success:true,message:'Investment complete. Continue to your Knowledge Risk checks.',session};
  });
}

async function finishRisk(sessionId:string,companyId:string){
  return serialiseSession(sessionId,async()=>{
    const session=await baseGetSessionV2(sessionId.toUpperCase());
    if(!session)return{success:false,message:'Session not found.'};
    ensureCompanyState(session);
    const company=session.companies.find(candidate=>candidate.id===companyId);
    if(!company)return{success:false,message:'Company not found.',session};
    if(company.roundPhase!=='risk')return{success:false,message:'Finish investing before completing Knowledge Risk.',session};

    if(finalChallengeDue(session))return startFinalChallenge(session);

    company.round+=1;
    setLegacyCompanyContext(session,company,'events');
    prepareCompanyNextRoundV2(session,company);
    const delayed=company.delayedEvent;
    session.activeEvents[company.id]=drawRoundEventsV2(session,company);
    if(delayed&&company.round>(delayed.delayedFromRound||0)){
      const returning:ActiveEventV2={
        ...delayed,
        instanceId:`delayed-${company.round}-${Math.random().toString(36).slice(2,8)}`,
        isResolved:false,
        success:undefined,
        domainResults:undefined,
        turnoverChangeApplied:undefined,
        resolvedAt:undefined,
        allocations:freshAllocations(delayed),
      };
      if(session.activeEvents[company.id].length)session.activeEvents[company.id][0]=returning;
      else session.activeEvents[company.id].push(returning);
      company.delayedEvent=null;
    }
    applyProgressionToCurrentEvents(session,company);
    company.roundPhase='events';
    delete (company as any).uiOpenEventInstanceId;
    if(session.soloMode){
      setLegacyCompanyContext(session,company,'events');
      advanceSoloCoPPeerV5(session);
    }
    syncSessionSummary(session);
    applyInterfaceSimplificationV1(session);
    await saveSessionV2(session);
    broadcastV2(session,'COMPANY_STARTED_NEXT_ROUND',{companyId:company.id,round:company.round});
    return{success:true,message:`Round ${company.round} has begun for ${company.name}.`,session};
  });
}

async function setReplacementLocation(sessionId:string,companyId:string,payload:any){
  return serialiseSession(sessionId,async()=>{
    const session=await baseGetSessionV2(sessionId.toUpperCase());
    if(!session)return{success:false,message:'Session not found.'};
    ensureCompanyState(session);
    const company=session.companies.find(candidate=>candidate.id===companyId);
    if(!company)return{success:false,message:'Company not found.',session};
    if(company.roundPhase!=='risk')return{success:false,message:'Replacement location is chosen during Knowledge Risk.',session};
    const expert=company.experts.find(candidate=>candidate.id===payload?.expertId);
    if(!expert||!expert.isVacant||expert.replacementDueRound==null)return{success:false,message:'No replacement is due for that expert.',session};
    const site=company.sites.find(candidate=>candidate.id===payload?.siteId&&!candidate.isClosed);
    if(!site)return{success:false,message:'Choose an active city office.',session};
    expert.location=site.id;expert.homeLocation=site.id;
    syncSessionSummary(session);
    await saveSessionV2(session);
    broadcastV2(session,'REPLACEMENT_LOCATION_UPDATED',{companyId,expertId:expert.id,siteId:site.id});
    return{success:true,message:'Replacement base updated.',session,expertId:expert.id,siteId:site.id};
  });
}

async function moveExpertPermanently(sessionId:string,companyId:string,payload:any){
  return serialiseSession(sessionId,async()=>{
    const session=await baseGetSessionV2(sessionId.toUpperCase());
    if(!session)return{success:false,message:'Session not found.'};
    ensureCompanyState(session);
    const company=session.companies.find(candidate=>candidate.id===companyId);
    if(!company)return{success:false,message:'Company not found.',session};
    const expert=company.experts.find(candidate=>candidate.id===String(payload?.expertId||'')&&!candidate.isVacant);
    if(!expert)return{success:false,message:'Choose an employed expert.',session};
    const target=company.sites.find(site=>site.id===String(payload?.targetLocation||'')&&!site.isClosed);
    if(!target)return{success:false,message:'Choose an active site.',session};
    if(expert.location===target.id)return{success:false,message:`${expert.name} is already based at ${target.name}.`,session};
    if(company.strategicInvestmentFund+0.0001<EXPERT_RELOCATION_COST_V1)return{success:false,message:`The Strategic Investment Fund has ${company.strategicInvestmentFund}k available. Permanent relocation costs ${EXPERT_RELOCATION_COST_V1}k.`,session};

    company.strategicInvestmentFund=roundInvestmentMoneyV1(company.strategicInvestmentFund-EXPERT_RELOCATION_COST_V1);
    expert.location=target.id;expert.homeLocation=target.id;
    if(expert.state==='HQ Assignment')expert.state='Available';
    recalculateCompanySPOFV2(company,session.config);
    syncSessionSummary(session);
    await saveSessionV2(session);
    broadcastV2(session,'EXPERT_PERMANENTLY_RELOCATED',{companyId,expertId:expert.id,siteId:target.id,cost:EXPERT_RELOCATION_COST_V1});
    return{success:true,message:`${expert.name} permanently moved to ${target.name}. Cost ${EXPERT_RELOCATION_COST_V1}k from SIF. No Action used.`,session,costTurnover:EXPERT_RELOCATION_COST_V1,investmentAttribution:{siteId:target.id,siteCost:0,corporateCost:0,sifCost:EXPERT_RELOCATION_COST_V1}};
  });
}

async function sendCopMessage(sessionId:string,companyId:string,payload:any){
  return serialiseSession(sessionId,async()=>{
    const session=await baseGetSessionV2(sessionId.toUpperCase());
    if(!session)return{success:false,message:'Session not found.'};
    ensureCompanyState(session);
    const company=session.companies.find(candidate=>candidate.id===companyId);
    if(!company)return{success:false,message:'Company not found.',session};
    const targetCompanyId=String(payload?.targetCompanyId||'');
    const target=session.companies.find(candidate=>candidate.id===targetCompanyId);
    const soloTarget=session.soloMode&&session.soloCopPeer?.id===targetCompanyId?session.soloCopPeer:null;
    if(!target&&!soloTarget)return{success:false,message:'The company you are trying to contact is no longer available.',session};
    const raw=String(payload?.message||'').trim();
    if(!raw)return{success:false,message:'Write a message before sending it.',session};
    const message=raw.slice(0,600);
    const domain=(['engineering','hr','marketing','operations','finance'] as string[]).includes(String(payload?.domain||''))?payload.domain as KnowledgeDomain:undefined;
    session.copMessages??=[];
    session.copMessages.push({id:`cop-msg-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,fromCompanyId:company.id,toCompanyId:targetCompanyId,domain,message,round:company.round,createdAt:new Date().toISOString(),kind:'request'});
    if(soloTarget){
      const scoped={...session,round:company.round} as GameSessionV2;
      session.copMessages.push({id:`cop-msg-${Date.now()}-${Math.random().toString(36).slice(2,7)}-reply`,fromCompanyId:soloTarget.id,toCompanyId:company.id,domain,message:soloPeerAutoReplyV5(scoped,domain),round:company.round,createdAt:new Date(Date.now()+1).toISOString(),kind:'response',response:'accepted'});
    }
    syncSessionSummary(session);
    await saveSessionV2(session);
    broadcastV2(session,'COP_MESSAGE_SENT',{fromCompanyId:company.id,toCompanyId:targetCompanyId,domain});
    return{success:true,message:soloTarget?'Message sent. Meridian Partners replied.':'Message sent to the other company.',session};
  });
}

async function respondCopMessage(sessionId:string,companyId:string,payload:any){
  return serialiseSession(sessionId,async()=>{
    const session=await baseGetSessionV2(sessionId.toUpperCase());
    if(!session)return{success:false,message:'Session not found.'};
    ensureCompanyState(session);
    const company=session.companies.find(candidate=>candidate.id===companyId);
    if(!company)return{success:false,message:'Company not found.',session};
    const requestId=String(payload?.messageId||'');
    const request=(session.copMessages||[]).find(message=>message.id===requestId&&message.toCompanyId===company.id);
    if(!request)return{success:false,message:'That CoP request is no longer available.',session};
    const response=payload?.response==='accepted'?'accepted':payload?.response==='declined'?'declined':null;
    if(!response)return{success:false,message:'Choose whether your company is willing to join.',session};
    const already=(session.copMessages||[]).some(message=>message.replyToId===request.id&&message.fromCompanyId===company.id&&message.kind==='response');
    if(already)return{success:false,message:'Your company has already answered this request.',session};
    const other=session.companies.find(candidate=>candidate.id===request.fromCompanyId);
    const domainLabel=request.domain?request.domain:'general business';
    const message=response==='accepted'
      ?`Yes — we are willing to join the ${domainLabel} Community of Practice and share what we know. We still need to register our membership in Invest.`
      :`Not this round — we are not joining the ${domainLabel} Community of Practice.`;
    session.copMessages.push({id:`cop-msg-${Date.now()}-${Math.random().toString(36).slice(2,7)}-response`,fromCompanyId:company.id,toCompanyId:request.fromCompanyId,domain:request.domain,message,round:company.round,createdAt:new Date().toISOString(),kind:'response',response,replyToId:request.id});
    syncSessionSummary(session);
    await saveSessionV2(session);
    broadcastV2(session,'COP_MESSAGE_RESPONSE',{fromCompanyId:company.id,toCompanyId:request.fromCompanyId,response,domain:request.domain});
    return{success:true,message:response==='accepted'?`You told ${other?.name||'the other company'} you are willing to join.`:`You declined the request from ${other?.name||'the other company'}.`,session};
  });
}

async function openCompanyEventCard(sessionId:string,companyId:string,eventInstanceId:string){
  return serialiseCompanyEventOpenV1(sessionId,companyId,async()=>{
    const session=await baseGetSessionV2(sessionId.toUpperCase());
    if(!session)return{success:false,message:'Session not found.'};
    ensureCompanyState(session);
    const company=session.companies.find(candidate=>candidate.id===companyId);
    if(!company||company.roundPhase!=='events')return{success:false,message:'Events are not active for this company.',session};
    const claim=claimCompanyOpenEventV1(session,companyId,eventInstanceId);
    if(!claim.success)return{...claim,session};
    if(claim.claimed){
      syncSessionSummary(session);
      await saveSessionV2(session);
      broadcastV2(session,'COMPANY_EVENT_OPENED',{companyId,eventInstanceId:claim.winnerEventInstanceId});
    }
    return{...claim,session};
  });
}

export async function resolveEventV2(sessionId:string,companyId:string,eventInstanceId?:string){
  return serialiseCompanyEventOpenV1(sessionId,companyId,async()=>{
    const session=await baseGetSessionV2(sessionId.toUpperCase());
    if(!session)return{success:false,message:'Session not found.',session};
    ensureCompanyState(session);
    const company=session.companies.find(candidate=>candidate.id===companyId);
    if(!company)return{success:false,message:'Company not found.',session};
    if(company.roundPhase!=='events')return{success:false,message:'Challenges can only be resolved during this company’s Event phase.',session};
    const event=(session.activeEvents[company.id]||[]).find(candidate=>candidate.instanceId===eventInstanceId);
    if(!event)return{success:false,message:'Event not found.',session};
    if(event.isResolved)return{success:false,message:'That Event has already been resolved.',session};
    const existing=(event as any).uiResolutionData;
    if(existing)return{success:true,eventSuccess:Boolean(existing.eventSuccess),result:existing.result,session};
    const openId=String((company as any).uiOpenEventInstanceId||'');
    if(openId&&openId!==event.instanceId)return{success:false,message:'Another Event is currently open for this company.',session};
    if(!openId)(company as any).uiOpenEventInstanceId=event.instanceId;

    setLegacyCompanyContext(session,company,'events');
    const isProgrammedFailure=event.card.tags?.includes(PROGRAMMED_FAILURE_TAG);
    let result:any;
    let authoritativeSession=session;
    if(isProgrammedFailure){
      await saveSessionV2(session);
      const legacyResult:any=await baseResolveEventV2(sessionId,companyId,event.instanceId);
      if(!legacyResult?.session)return legacyResult;
      authoritativeSession=legacyResult.session;
      ensureCompanyState(authoritativeSession);
      const authoritativeCompany=authoritativeSession.companies.find(candidate=>candidate.id===companyId);
      const authoritativeEvent=authoritativeCompany?(authoritativeSession.activeEvents[authoritativeCompany.id]||[]).find(candidate=>candidate.instanceId===event.instanceId):undefined;
      if(!authoritativeCompany||!authoritativeEvent)return legacyResult;
      result=legacyResult.result||{};
      authoritativeEvent.isResolved=false;
      (authoritativeEvent as any).uiResolutionData={eventSuccess:false,result};
      (authoritativeCompany as any).uiOpenEventInstanceId=authoritativeEvent.instanceId;
      syncSessionSummary(authoritativeSession);
      await saveSessionV2(authoritativeSession);
      broadcastV2(authoritativeSession,'COMPANY_EVENT_RESOLVED_SHARED',{companyId,eventInstanceId:authoritativeEvent.instanceId,result});
      return{success:true,eventSuccess:false,result,session:authoritativeSession};
    }

    result=resolveSingleEventExplicitV2(session,company,event);
    if(event.card.tags?.includes('disruption-swap')){
      const swap=swapDisruptionWithPeerV1(session,company.id);
      if(swap){result.disruptionSwap=swap;broadcastV2(session,'DISRUPTION_CARDS_SWAPPED',swap);}
      else result.disruptionSwapUnavailable=true;
    }
    event.isResolved=false;
    (event as any).uiResolutionData={eventSuccess:result.success,result};
    syncSessionSummary(session);
    await saveSessionV2(session);
    broadcastV2(session,'COMPANY_EVENT_RESOLVED_SHARED',{companyId,eventInstanceId:event.instanceId,result});
    return{success:true,eventSuccess:result.success,result,session};
  });
}

async function acknowledgeEventResolution(sessionId:string,companyId:string,eventInstanceId:string){
  return serialiseCompanyEventOpenV1(sessionId,companyId,async()=>{
    const session=await baseGetSessionV2(sessionId.toUpperCase());
    if(!session)return{success:false,message:'Session not found.'};
    ensureCompanyState(session);
    const company=session.companies.find(candidate=>candidate.id===companyId);
    if(!company)return{success:false,message:'Company not found.',session};
    const event=(session.activeEvents[company.id]||[]).find(candidate=>candidate.instanceId===eventInstanceId);
    if(!event)return{success:false,message:'Event not found.',session};
    if(event.isResolved)return{success:true,message:'Event already acknowledged.',session};
    if((event as any).uiResolutionData==null)return{success:false,message:'There is no resolved Event waiting for acknowledgement.',session};

    event.isResolved=true;
    const currentId=String((company as any).uiOpenEventInstanceId||'');
    if(currentId===eventInstanceId)clearCompanyOpenEventV1(session,companyId,eventInstanceId);
    else if(!currentId||(session.activeEvents[company.id]||[]).every(candidate=>candidate.instanceId!==currentId||candidate.isResolved))delete (company as any).uiOpenEventInstanceId;

    const companyEvents=session.activeEvents[company.id]||[];
    const companyFinished=companyEvents.every(candidate=>candidate.isResolved);
    if(companyFinished)company.roundPhase='investment';
    syncSessionSummary(session);
    await saveSessionV2(session);
    broadcastV2(session,companyFinished?'COMPANY_ENTERED_INVESTMENT':'COMPANY_EVENT_ACKNOWLEDGED',{companyId,eventInstanceId,round:company.round});
    return{success:true,message:companyFinished?'Events complete. Begin investing for the next round.':'Event complete. Choose the next Event card when you are ready.',session};
  });
}

async function normaliseFinalResolution(session:GameSessionV2){
  const results=((session as any).finalDisruptionResults||[]) as any[];
  const active=staffedCompanies(session);
  session.finalDisruptionResolved=active.every(company=>results.some(result=>result.companyId===company.id));
  syncSessionSummary(session);
  await saveSessionV2(session);
  broadcastV2(session,'FINAL_DISRUPTION_PROGRESS',{resolved:results.length,required:active.length,complete:session.finalDisruptionResolved});
}

export async function knowledgeActionV2(sessionId:string,companyId:string,payload:any){
  if(String(payload?.type||'').startsWith('KM_WEEK_')){
    return serialiseSession(sessionId,async()=>{
      const session=await baseGetSessionV2(sessionId.toUpperCase());
      if(!session)return{success:false,message:'Session not found.'};
      ensureCompanyState(session);
      ensureKMWeekSessionV1(session);
      const result:any=applyKMWeekActionV1(session,companyId,payload);
      if(result.success){
        syncSessionSummary(session);
        await saveSessionV2(session);
        broadcastV2(session,'KM_WEEK_UPDATED',{companyId,actionType:payload?.type});
      }
      return{...result,session};
    });
  }
  if(payload?.type==='ACK_DISRUPTION_SWAP_NOTICE'){
    return serialiseSession(sessionId,async()=>{
      const session=await baseGetSessionV2(sessionId.toUpperCase());
      if(!session)return{success:false,message:'Session not found.'};
      const company=session.companies.find(candidate=>candidate.id===companyId);
      if(!company)return{success:false,message:'Company not found.',session};
      company.disruptionSwapNotice=null;syncSessionSummary(session);await saveSessionV2(session);broadcastV2(session,'DISRUPTION_SWAP_NOTICE_ACKNOWLEDGED',{companyId});
      return{success:true,message:'Strategic change acknowledged.',session};
    });
  }
  if(payload?.type==='FINISH_INVESTING')return finishInvesting(sessionId,companyId);
  if(payload?.type==='FINISH_RISK')return finishRisk(sessionId,companyId);
  if(payload?.type==='MOVE_EXPERT')return moveExpertPermanently(sessionId,companyId,payload);
  if(payload?.type==='COP_MESSAGE')return sendCopMessage(sessionId,companyId,payload);
  if(payload?.type==='COP_RESPONSE')return respondCopMessage(sessionId,companyId,payload);
  if(payload?.type==='SET_REPLACEMENT_LOCATION')return setReplacementLocation(sessionId,companyId,payload);
  if(payload?.type==='OPEN_EVENT_CARD')return openCompanyEventCard(sessionId,companyId,String(payload?.eventInstanceId||''));
  if(payload?.type==='ACK_EVENT_RESOLUTION')return acknowledgeEventResolution(sessionId,companyId,String(payload?.eventInstanceId||''));

  if(payload?.type==='FINAL_DISRUPTION_RESOLVE'){
    return serialiseSession(sessionId,async()=>{
      const session=await baseGetSessionV2(sessionId.toUpperCase());
      if(!session)return{success:false,message:'Session not found.'};
      ensureCompanyState(session);
      const company=session.companies.find(candidate=>candidate.id===companyId);
      if(!company)return{success:false,message:'Company not found.',session};
      if(!session.isFinalDisruptionActive)return{success:false,message:'The Final Challenge has not started.',session};
      // Final Challenge is shared workshop timing, but each company resolves only
      // its own card. Do not require or alter the company's normal round phase.
      session.round=company.round;
      session.phase='respond';
      await saveSessionV2(session);
      const result:any=await baseKnowledgeActionV2(sessionId,companyId,payload);
      const authoritative=(result?.session||await baseGetSessionV2(session.id)) as GameSessionV2|null;
      if(authoritative){
        ensureCompanyState(authoritative);
        await normaliseFinalResolution(authoritative);
        return{...result,session:authoritative};
      }
      return result;
    });
  }

  const session=await baseGetSessionV2(sessionId.toUpperCase());
  if(!session)return{success:false,message:'Session not found.'};
  ensureCompanyState(session);
  const company=session.companies.find(candidate=>candidate.id===companyId);
  if(!company)return{success:false,message:'Company not found.',session};
  const investmentAction=isInvestmentActionV4(String(payload?.type||''))||payload?.type==='SITE_KNOWLEDGE_SHARING';
  const required:CompanyRoundPhase=investmentAction?'investment':'events';
  return runLegacyCompanyMutation(sessionId,companyId,required,()=>baseKnowledgeActionV2(sessionId,companyId,payload));
}
