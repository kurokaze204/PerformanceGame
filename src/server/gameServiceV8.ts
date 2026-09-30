import type { KnowledgeDomain, Participant } from '../types/game.ts';
import type { GameSessionV2 } from '../types/gameV2.ts';
import { executeRiskPhaseV4 } from '../engine/riskPhaseV4.ts';
import { recalculateCompanySPOFV2 } from '../engine/coreV2.ts';
import { EXPERT_RELOCATION_COST_V1, roundInvestmentMoneyV1 } from '../engine/investmentCapacityV1.ts';
import { advanceSoloCoPPeerV5, initialiseSoloCoPPeerV5, soloPeerAutoReplyV5 } from '../engine/copNetworkV5.ts';
import { isInvestmentActionV4 } from '../engine/investmentActionsV4.ts';
import { PROGRAMMED_FAILURE_TAG } from '../engine/eventProgressionV5.ts';
import { applyInterfaceSimplificationV1 } from '../engine/interfaceSimplificationV1.ts';
import { claimCompanyOpenEventV1, clearCompanyOpenEventV1, serialiseCompanyEventOpenV1 } from '../engine/companyEventOpenV1.ts';
import { resolveSingleEventExplicitV2 } from '../engine/challengeResponseV2.ts';
import { swapDisruptionWithPeerV1 } from '../engine/disruptionPlusV1.ts';
import { acceptPendingCopRequestsForAutopilotV1, autoplayCompanyToWaitingV1, autoplayEligibleEmptyCompaniesV1, companyAutopilotActiveV1, companyPlayerCountV1 } from '../engine/emptyCompanyAutopilotV1.ts';
import { deleteParticipant, saveParticipant, saveSessionV2 } from './dbV2.ts';
import { broadcastV2 } from './gameServiceV2.ts';
import {
  advancePhaseV2 as baseAdvancePhaseV2,
  getSessionV2 as baseGetSessionV2,
  joinSessionV2 as baseJoinSessionV2,
  knowledgeActionV2 as baseKnowledgeActionV2,
  resolveEventV2 as baseResolveEventV2,
} from './gameServiceV7.ts';

export * from './gameServiceV7.ts';

type CompanyRoundPhase = 'events' | 'investment' | 'risk' | 'waiting';

const REPLACEMENT_NAMES = [
  'Alex Morgan','Priya Shah','Daniel Chen','Mia Thompson','Jordan Lee','Samira Patel','Liam Brooks','Nina Alvarez',
  'Marcus Reed','Sophie Nguyen','Ethan Walsh','Grace Kim','Owen Clarke','Aisha Rahman','Noah Bennett','Chloe Martin',
  'Lucas Ferreira','Emily Zhao','Jack Wilson','Hannah Singh','Leo Martinez','Zoe Campbell','Arjun Mehta','Isla Roberts',
  'Ben Carter','Amelia Scott','Kai Johnson','Ruby Evans','Thomas Green','Layla Hassan','Max Turner','Ella Foster',
];

const roundPhase = (company:GameSessionV2['companies'][number], fallback:CompanyRoundPhase='events'):CompanyRoundPhase =>
  ((company as any).roundPhase as CompanyRoundPhase | undefined) || fallback;
const setRoundPhase = (company:GameSessionV2['companies'][number], phase:CompanyRoundPhase) => { (company as any).roundPhase = phase; };

function fallbackFromSession(session:GameSessionV2):CompanyRoundPhase {
  if(session.phase==='investment')return 'investment';
  if(session.phase==='risk')return 'risk';
  return 'events';
}

function ensureRoundPhases(session:GameSessionV2):boolean {
  let changed=false;
  const fallback=fallbackFromSession(session);
  for(const company of session.companies){
    if(!(company as any).roundPhase){setRoundPhase(company,fallback);changed=true;}
  }
  return changed;
}

function nextReplacementName(company:GameSessionV2['companies'][number]):string {
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

function nameRiskReplacements(session:GameSessionV2, company:GameSessionV2['companies'][number]){
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

const phaseQueues=new Map<string,Promise<any>>();
function serialisePhaseChange<T>(sessionId:string, work:()=>Promise<T>):Promise<T>{
  const key=sessionId.toUpperCase();
  const prior=phaseQueues.get(key)||Promise.resolve();
  const run=prior.then(work,work);
  phaseQueues.set(key,run.finally(()=>{if(phaseQueues.get(key)===run)phaseQueues.delete(key);}));
  return run;
}

export async function joinSessionV2(sessionId:string,name:string,companyId?:string,role:Participant['role']='participant'){
  return serialisePhaseChange(sessionId,()=>baseJoinSessionV2(sessionId,name,companyId,role));
}

function allCompanyEventsResolved(session:GameSessionV2):boolean{
  return session.companies.every(company=>(session.activeEvents[company.id]||[]).every(event=>event.isResolved));
}

function allCompaniesWaiting(session:GameSessionV2):boolean{
  return session.companies.length>0&&session.companies.every(company=>roundPhase(company,fallbackFromSession(session))==='waiting');
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

function runEligibleAutopilot(session:GameSessionV2){
  const results=autoplayEligibleEmptyCompaniesV1(session);
  for(const result of results){
    const company=session.companies.find(candidate=>candidate.id===result.companyId);
    if(company)nameRiskReplacements(session,company);
  }
  if(results.length)applyInterfaceSimplificationV1(session);
  return results;
}

async function advanceAfterKnowledgeRisk(session:GameSessionV2){
  // Put the shared session into the legacy risk state only for the atomic
  // hand-off into the next round/final disruption. Company-specific risk
  // progress remains in roundPhase.
  session.phase='risk';
  await saveSessionV2(session);
  const advanced:any=await baseAdvancePhaseV2(session.id,'respond');
  if(!advanced?.success||!advanced.session)return advanced;
  if(!advanced.session.isFinalDisruptionActive){
    advanceSoloCoPPeerV5(advanced.session);
    for(const nextCompany of advanced.session.companies)setRoundPhase(nextCompany,'events');
    const autopilotResults=runEligibleAutopilot(advanced.session);
    await saveSessionV2(advanced.session);
    broadcastV2(advanced.session,'ALL_COMPANIES_STARTED_NEXT_ROUND',{round:advanced.session.round,autopilotCompanies:autopilotResults.map(item=>item.companyId)});
  }
  return{
    ...advanced,
    message:advanced.session.isFinalDisruptionActive
      ?'All companies finished Knowledge Risk. Final disruption begins.'
      :'All companies finished Knowledge Risk. The next Event round has begun.',
  };
}

export async function getSessionV2(sessionId:string):Promise<GameSessionV2|null>{
  const id=sessionId.toUpperCase();
  const session=await baseGetSessionV2(id);
  if(!session)return null;
  let healed=ensureRoundPhases(session);
  if(repairPendingResolutionPointers(session))healed=true;
  if(session.soloMode&&!session.soloCopPeer){initialiseSoloCoPPeerV5(session);healed=true;}
  const autopilotResults=runEligibleAutopilot(session);
  if(autopilotResults.length)healed=true;
  if(healed)await saveSessionV2(session);
  if(session.isFinalDisruptionActive||!allCompaniesWaiting(session))return session;

  // Self-heal a session if the last FINISH_RISK request was interrupted after
  // everybody had been marked waiting but before the round/final hand-off.
  return serialisePhaseChange(id,async()=>{
    const fresh=await baseGetSessionV2(id);
    if(!fresh)return null;
    ensureRoundPhases(fresh);
    if(fresh.isFinalDisruptionActive||!allCompaniesWaiting(fresh))return fresh;
    const recovered:any=await advanceAfterKnowledgeRisk(fresh);
    return recovered?.success&&recovered.session?recovered.session:fresh;
  });
}

export async function advancePhaseV2(sessionId:string,requested?:any){
  const result:any=await baseAdvancePhaseV2(sessionId,requested);
  if(!result?.success||!result.session)return result;
  if(result.session.phase==='investment'){
    for(const company of result.session.companies)if(roundPhase(company,fallbackFromSession(result.session))!=='waiting')setRoundPhase(company,'investment');
    const autopilotResults=runEligibleAutopilot(result.session);
    await saveSessionV2(result.session);
    broadcastV2(result.session,'COMPANIES_ENTERED_INVESTMENT',{round:result.session.round,autopilotCompanies:autopilotResults.map(item=>item.companyId)});
  }else if(result.session.phase==='respond'&&!result.session.isFinalDisruptionActive){
    for(const company of result.session.companies)setRoundPhase(company,'events');
    await saveSessionV2(result.session);
  }
  return result;
}

async function finishInvesting(sessionId:string,companyId:string){
  return serialisePhaseChange(sessionId,async()=>{
    const session=await baseGetSessionV2(sessionId.toUpperCase());
    if(!session)return{success:false,message:'Session not found.'};
    ensureRoundPhases(session);
    const company=session.companies.find(candidate=>candidate.id===companyId);
    if(!company)return{success:false,message:'Company not found.',session};
    if(roundPhase(company,fallbackFromSession(session))!=='investment')return{success:false,message:'This company has already finished investing.',session};

    session.riskResults??={};
    session.riskResults[company.id]=executeRiskPhaseV4(session,company);
    nameRiskReplacements(session,company);
    setRoundPhase(company,'risk');
    applyInterfaceSimplificationV1(session);
    await saveSessionV2(session);
    broadcastV2(session,'COMPANY_ENTERED_KNOWLEDGE_RISK',{companyId:company.id,round:session.round});
    return{success:true,message:'Investment complete. Continue to your Knowledge Risk checks.',session};
  });
}

async function finishRisk(sessionId:string,companyId:string){
  return serialisePhaseChange(sessionId,async()=>{
    const session=await baseGetSessionV2(sessionId.toUpperCase());
    if(!session)return{success:false,message:'Session not found.'};
    ensureRoundPhases(session);
    const company=session.companies.find(candidate=>candidate.id===companyId);
    if(!company)return{success:false,message:'Company not found.',session};
    if(roundPhase(company,fallbackFromSession(session))==='waiting'){
      if(allCompaniesWaiting(session))return advanceAfterKnowledgeRisk(session);
      return{success:true,message:'Waiting for the other companies to finish Knowledge Risk.',session};
    }
    if(roundPhase(company,fallbackFromSession(session))!=='risk')return{success:false,message:'Finish investing before completing Knowledge Risk.',session};

    setRoundPhase(company,'waiting');
    const autopilotResults=runEligibleAutopilot(session);
    if(!allCompaniesWaiting(session)){
      await saveSessionV2(session);
      broadcastV2(session,'COMPANY_WAITING_FOR_NEXT_ROUND',{companyId:company.id,round:session.round,autopilotCompanies:autopilotResults.map(item=>item.companyId)});
      const waiting=session.companies.filter(candidate=>roundPhase(candidate,fallbackFromSession(session))==='waiting').length;
      return{success:true,message:`Knowledge Risk complete. Waiting for the other companies (${waiting}/${session.companies.length} finished).`,session};
    }

    return advanceAfterKnowledgeRisk(session);
  });
}

export async function recoverParticipantV1(sessionId:string,payload:{id?:string;name?:string;companyId?:string}){
  return serialisePhaseChange(sessionId,async()=>{
    const session=await baseGetSessionV2(sessionId.toUpperCase());
    if(!session)return{success:false,message:'Session not found.'};
    const participantId=String(payload?.id||'').trim();
    const companyId=String(payload?.companyId||'').trim();
    const company=session.companies.find(candidate=>candidate.id===companyId);
    if(!participantId||participantId.startsWith('fac-view-')||!company)return{success:false,message:'Participant recovery details are invalid.',session};
    const existing=session.participants.find(participant=>participant.id===participantId);
    if(existing)return{success:true,message:'Participant already registered.',session,participant:existing};

    const participant:Participant={
      id:participantId,
      sessionId:session.id,
      name:String(payload?.name||'Player').trim()||'Player',
      companyId:company.id,
      role:'participant',
      lastSeen:new Date().toISOString(),
    };
    const participantCountBefore=session.participants.filter(item=>item.role==='participant').length;
    session.participants.push(participant);
    company.autopilotEnabled=false;
    if(participantCountBefore===0&&!session.timerStartedAt&&!session.timerEndsAt){
      const remaining=session.timerPausedSecondsRemaining??session.gameDurationMinutes*60;
      session.timerStartedAt=new Date().toISOString();
      session.timerEndsAt=new Date(Date.now()+remaining*1000).toISOString();
      session.timerPausedSecondsRemaining=null;
    }
    await saveParticipant(participant);
    await saveSessionV2(session);
    broadcastV2(session,'PARTICIPANT_RECOVERED',{participantId:participant.id,companyId:company.id});
    return{success:true,message:`${participant.name} was restored to ${company.name}.`,session,participant};
  });
}

export async function facilitatorRemoveParticipantV1(sessionId:string,participantId:string){
  return serialisePhaseChange(sessionId,async()=>{
    const session=await baseGetSessionV2(sessionId.toUpperCase());
    if(!session)return{success:false,message:'Session not found.'};
    const participant=session.participants.find(item=>item.id===participantId&&item.role==='participant');
    if(!participant)return{success:false,message:'Player not found.',session};
    session.participants=session.participants.filter(item=>item.id!==participantId);
    await deleteParticipant(participantId);
    await saveSessionV2(session);
    broadcastV2(session,'FACILITATOR_REMOVED_PARTICIPANT',{participantId,companyId:participant.companyId,name:participant.name});
    return{success:true,message:`${participant.name} was removed from the game.`,session};
  });
}

export async function facilitatorSetCompanyAutopilotV1(sessionId:string,companyId:string,enabled:boolean){
  return serialisePhaseChange(sessionId,async()=>{
    const session=await baseGetSessionV2(sessionId.toUpperCase());
    if(!session)return{success:false,message:'Session not found.'};
    ensureRoundPhases(session);
    const index=session.companies.findIndex(candidate=>candidate.id===companyId);
    const company=index>=0?session.companies[index]:undefined;
    if(!company)return{success:false,message:'Company not found.',session};
    if(index===0){
      company.autopilotEnabled=false;
      await saveSessionV2(session);
      return{success:enabled?false:true,message:'Company 1 is the human anchor and cannot be put on autopilot.',session};
    }
    if(enabled&&companyPlayerCountV1(session,companyId)>0)return{success:false,message:'Autopilot cannot be enabled while players are assigned to this company.',session};
    company.autopilotEnabled=Boolean(enabled);
    const autopilotResults=enabled?runEligibleAutopilot(session):[];
    await saveSessionV2(session);
    broadcastV2(session,'FACILITATOR_AUTOPILOT_UPDATED',{companyId,enabled:company.autopilotEnabled,autopilotCompanies:autopilotResults.map(item=>item.companyId)});
    return{
      success:true,
      message:company.autopilotEnabled
        ?`${company.name} autopilot is enabled.`
        :`${company.name} autopilot is off.`,
      session,
    };
  });
}

export async function facilitatorFinishCompanyRoundV1(sessionId:string,companyId:string){
  return serialisePhaseChange(sessionId,async()=>{
    const session=await baseGetSessionV2(sessionId.toUpperCase());
    if(!session)return{success:false,message:'Session not found.'};
    ensureRoundPhases(session);
    if(session.isFinalDisruptionActive)return{success:false,message:'Company rounds cannot be force-finished during the Final Challenge.',session};
    const company=session.companies.find(candidate=>candidate.id===companyId);
    if(!company)return{success:false,message:'Company not found.',session};
    if(roundPhase(company,fallbackFromSession(session))==='waiting')return{success:true,message:`${company.name} has already finished this round.`,session};
    const result=autoplayCompanyToWaitingV1(session,company);
    nameRiskReplacements(session,company);
    applyInterfaceSimplificationV1(session);
    if(allCompaniesWaiting(session)){
      const advanced:any=await advanceAfterKnowledgeRisk(session);
      if(advanced?.success&&advanced.session)return{...advanced,message:`${company.name} was finished by the facilitator. All companies were ready, so Round ${advanced.session.round} has begun.`};
      return advanced;
    }
    await saveSessionV2(session);
    broadcastV2(session,'FACILITATOR_FINISHED_COMPANY_ROUND',{companyId,round:session.round,result});
    return{success:true,message:`${company.name} was finished for Round ${session.round}.`,session,result};
  });
}

export async function facilitatorRemoveCompanyV1(sessionId:string,companyId:string){
  return serialisePhaseChange(sessionId,async()=>{
    const session=await baseGetSessionV2(sessionId.toUpperCase());
    if(!session)return{success:false,message:'Session not found.'};
    if(session.isFinalDisruptionActive)return{success:false,message:'Companies cannot be removed during the Final Challenge.',session};
    if(session.companies.length<=1)return{success:false,message:'The game must keep at least one company.',session};
    const company=session.companies.find(candidate=>candidate.id===companyId);
    if(!company)return{success:false,message:'Company not found.',session};
    const assigned=companyPlayerCountV1(session,companyId);
    if(assigned>0)return{success:false,message:`Move the ${assigned} assigned player${assigned===1?'':'s'} to another company before removing ${company.name}.`,session};

    session.companies=session.companies.filter(candidate=>candidate.id!==companyId);
    if(session.companies[0])session.companies[0].autopilotEnabled=false;
    delete session.activeEvents[companyId];
    if(session.riskResults)delete session.riskResults[companyId];
    session.copMemberships=(session.copMemberships||[]).filter(membership=>membership.companyId!==companyId);
    session.copMessages=(session.copMessages||[]).filter(message=>message.fromCompanyId!==companyId&&message.toCompanyId!==companyId);
    for(const remaining of session.companies){
      if(remaining.disruptionSwapNotice?.fromCompanyId===companyId)remaining.disruptionSwapNotice=null;
    }
    if(Array.isArray((session as any).finalDisruptionResults)){
      (session as any).finalDisruptionResults=(session as any).finalDisruptionResults.filter((item:any)=>item.companyId!==companyId);
    }
    applyInterfaceSimplificationV1(session);

    if(allCompaniesWaiting(session)){
      const advanced:any=await advanceAfterKnowledgeRisk(session);
      if(advanced?.success&&advanced.session)return{...advanced,message:`${company.name} was removed. All remaining companies were ready, so the next round has begun.`};
      return advanced;
    }

    await saveSessionV2(session);
    broadcastV2(session,'FACILITATOR_REMOVED_COMPANY',{companyId,companyName:company.name,round:session.round});
    return{success:true,message:`${company.name} was removed from the game.`,session};
  });
}

async function setReplacementLocation(sessionId:string,companyId:string,payload:any){
  const session=await baseGetSessionV2(sessionId.toUpperCase());
  if(!session)return{success:false,message:'Session not found.'};
  ensureRoundPhases(session);
  const company=session.companies.find(candidate=>candidate.id===companyId);
  if(!company)return{success:false,message:'Company not found.',session};
  if(roundPhase(company,fallbackFromSession(session))!=='risk')return{success:false,message:'Replacement location is chosen during Knowledge Risk.',session};
  const expert=company.experts.find(candidate=>candidate.id===payload?.expertId);
  if(!expert||!expert.isVacant||expert.replacementDueRound==null)return{success:false,message:'No replacement is due for that expert.',session};
  const site=company.sites.find(candidate=>candidate.id===payload?.siteId&&!candidate.isClosed);
  if(!site)return{success:false,message:'Choose an active city office.',session};
  expert.location=site.id;expert.homeLocation=site.id;
  await saveSessionV2(session);
  broadcastV2(session,'REPLACEMENT_LOCATION_UPDATED',{companyId,expertId:expert.id,siteId:site.id});
  return{success:true,message:'Replacement base updated.',session,expertId:expert.id,siteId:site.id};
}

async function moveExpertPermanently(sessionId:string,companyId:string,payload:any){
  return serialiseCompanyEventOpenV1(sessionId,companyId,async()=>{
    const session=await baseGetSessionV2(sessionId.toUpperCase());
    if(!session)return{success:false,message:'Session not found.'};
    const company=session.companies.find(candidate=>candidate.id===companyId);
    if(!company)return{success:false,message:'Company not found.',session};
    const expert=company.experts.find(candidate=>candidate.id===String(payload?.expertId||'')&&!candidate.isVacant);
    if(!expert)return{success:false,message:'Choose an employed expert.',session};
    const target=company.sites.find(site=>site.id===String(payload?.targetLocation||'')&&!site.isClosed);
    if(!target)return{success:false,message:'Choose an active site.',session};
    if(expert.location===target.id)return{success:false,message:`${expert.name} is already based at ${target.name}.`,session};
    if(company.strategicInvestmentFund+0.0001<EXPERT_RELOCATION_COST_V1)return{success:false,message:`The Strategic Investment Fund has ${company.strategicInvestmentFund}k available. Permanent relocation costs ${EXPERT_RELOCATION_COST_V1}k.`,session};

    company.strategicInvestmentFund=roundInvestmentMoneyV1(company.strategicInvestmentFund-EXPERT_RELOCATION_COST_V1);
    expert.location=target.id;
    expert.homeLocation=target.id;
    if(expert.state==='HQ Assignment')expert.state='Available';
    recalculateCompanySPOFV2(company,session.config);
    await saveSessionV2(session);
    broadcastV2(session,'EXPERT_PERMANENTLY_RELOCATED',{companyId,expertId:expert.id,siteId:target.id,cost:EXPERT_RELOCATION_COST_V1});
    return{
      success:true,
      message:`${expert.name} permanently moved to ${target.name}. Cost ${EXPERT_RELOCATION_COST_V1}k from SIF. No Action used.`,
      session,
      costTurnover:EXPERT_RELOCATION_COST_V1,
      investmentAttribution:{siteId:target.id,siteCost:0,corporateCost:0,sifCost:EXPERT_RELOCATION_COST_V1},
    };
  });
}

async function sendCopMessage(sessionId:string,companyId:string,payload:any){
  return serialisePhaseChange(sessionId,async()=>{
    const session=await baseGetSessionV2(sessionId.toUpperCase());
    if(!session)return{success:false,message:'Session not found.'};
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
    const now=new Date().toISOString();
    session.copMessages.push({
      id:`cop-msg-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
      fromCompanyId:company.id,
      toCompanyId:targetCompanyId,
      domain,
      message,
      round:session.round,
      createdAt:now,
      kind:'request',
    });
    if(soloTarget){
      session.copMessages.push({
        id:`cop-msg-${Date.now()}-${Math.random().toString(36).slice(2,7)}-reply`,
        fromCompanyId:soloTarget.id,
        toCompanyId:company.id,
        domain,
        message:soloPeerAutoReplyV5(session,domain),
        round:session.round,
        createdAt:new Date(Date.now()+1).toISOString(),
        kind:'response',
        response:'accepted',
      });
    }
    const autoAccepted=target&&companyAutopilotActiveV1(session,target.id)
      ? acceptPendingCopRequestsForAutopilotV1(session,target)
      : 0;
    await saveSessionV2(session);
    broadcastV2(session,'COP_MESSAGE_SENT',{fromCompanyId:company.id,toCompanyId:targetCompanyId,domain,autoAccepted:Boolean(autoAccepted)});
    return{
      success:true,
      message:soloTarget
        ?'Message sent. Meridian Partners replied.'
        :autoAccepted
          ?`Message sent. ${target?.name||'The autopilot company'} accepted the CoP request.`
          :'Message sent to the other company.',
      session,
    };
  });
}

async function respondCopMessage(sessionId:string,companyId:string,payload:any){
  return serialisePhaseChange(sessionId,async()=>{
    const session=await baseGetSessionV2(sessionId.toUpperCase());
    if(!session)return{success:false,message:'Session not found.'};
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
    session.copMessages.push({
      id:`cop-msg-${Date.now()}-${Math.random().toString(36).slice(2,7)}-response`,
      fromCompanyId:company.id,
      toCompanyId:request.fromCompanyId,
      domain:request.domain,
      message,
      round:session.round,
      createdAt:new Date().toISOString(),
      kind:'response',
      response,
      replyToId:request.id,
    });
    await saveSessionV2(session);
    broadcastV2(session,'COP_MESSAGE_RESPONSE',{fromCompanyId:company.id,toCompanyId:request.fromCompanyId,response,domain:request.domain});
    return{success:true,message:response==='accepted'?`You told ${other?.name||'the other company'} you are willing to join.`:`You declined the request from ${other?.name||'the other company'}.`,session};
  });
}
async function openCompanyEventCard(sessionId:string,companyId:string,eventInstanceId:string){
  return serialiseCompanyEventOpenV1(sessionId,companyId,async()=>{
    const session=await baseGetSessionV2(sessionId.toUpperCase());
    if(!session)return{success:false,message:'Session not found.'};
    const claim=claimCompanyOpenEventV1(session,companyId,eventInstanceId);
    if(!claim.success)return{...claim,session};
    if(claim.claimed){
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
    if(session.phase!=='respond')return{success:false,message:'Challenges can only be resolved during the challenge phase.',session};
    const company=session.companies.find(candidate=>candidate.id===companyId);
    if(!company)return{success:false,message:'Company not found.',session};
    const event=(session.activeEvents[company.id]||[]).find(candidate=>candidate.instanceId===eventInstanceId);
    if(!event)return{success:false,message:'Event not found.',session};
    if(event.isResolved)return{success:false,message:'That Event has already been resolved.',session};
    const existing=(event as any).uiResolutionData;
    if(existing)return{success:true,eventSuccess:Boolean(existing.eventSuccess),result:existing.result,session};
    const openId=String((company as any).uiOpenEventInstanceId||'');
    if(openId&&openId!==event.instanceId)return{success:false,message:'Another Event is currently open for this company.',session};
    if(!openId)(company as any).uiOpenEventInstanceId=event.instanceId;

    const isProgrammedFailure=event.card.tags?.includes(PROGRAMMED_FAILURE_TAG);
    let result:any;
    let authoritativeSession=session;
    if(isProgrammedFailure){
      // Preserve the long-standing Newbie teaching mechanic. The V8 multiplayer
      // synchronisation layer must not bypass V5's deliberately forced opening
      // failure by resolving the Event directly.
      const legacyResult:any=await baseResolveEventV2(sessionId,companyId,event.instanceId);
      if(!legacyResult?.session)return legacyResult;
      authoritativeSession=legacyResult.session;
      const authoritativeCompany=authoritativeSession.companies.find(candidate=>candidate.id===companyId);
      const authoritativeEvent=authoritativeCompany?(authoritativeSession.activeEvents[authoritativeCompany.id]||[]).find(candidate=>candidate.instanceId===event.instanceId):undefined;
      if(!authoritativeCompany||!authoritativeEvent)return legacyResult;
      result=legacyResult.result||{};
      authoritativeEvent.isResolved=false;
      (authoritativeEvent as any).uiResolutionData={eventSuccess:false,result};
      (authoritativeCompany as any).uiOpenEventInstanceId=authoritativeEvent.instanceId;
      await saveSessionV2(authoritativeSession);
      broadcastV2(authoritativeSession,'COMPANY_EVENT_RESOLVED_SHARED',{companyId,eventInstanceId:authoritativeEvent.instanceId,result});
      return{success:true,eventSuccess:false,result,session:authoritativeSession};
    }

    result=resolveSingleEventExplicitV2(session,company,event);
    if(event.card.tags?.includes('disruption-swap')){
      const swap=swapDisruptionWithPeerV1(session,company.id);
      if(swap){
        result.disruptionSwap=swap;
        broadcastV2(session,'DISRUPTION_CARDS_SWAPPED',swap);
      }else{
        result.disruptionSwapUnavailable=true;
      }
    }
    // Keep the card logically open until someone acknowledges the shared result.
    // The business impact has already been applied; isResolved becomes true on ACK.
    event.isResolved=false;
    (event as any).uiResolutionData={eventSuccess:result.success,result};
    await saveSessionV2(session);
    broadcastV2(session,'COMPANY_EVENT_RESOLVED_SHARED',{companyId,eventInstanceId:event.instanceId,result});
    return{success:true,eventSuccess:result.success,result,session};
  });
}

async function acknowledgeEventResolution(sessionId:string,companyId:string,eventInstanceId:string){
  return serialiseCompanyEventOpenV1(sessionId,companyId,async()=>{
    const session=await baseGetSessionV2(sessionId.toUpperCase());
    if(!session)return{success:false,message:'Session not found.'};
    const company=session.companies.find(candidate=>candidate.id===companyId);
    if(!company)return{success:false,message:'Company not found.',session};
    const event=(session.activeEvents[company.id]||[]).find(candidate=>candidate.instanceId===eventInstanceId);
    if(!event)return{success:false,message:'Event not found.',session};
    // Multiple browsers can share one company. If another teammate has already
    // acknowledged this result, converge on the authoritative session instead of
    // trapping the later browser on a stale result screen.
    if(event.isResolved)return{success:true,message:'Event already acknowledged.',session};
    if((event as any).uiResolutionData==null)return{success:false,message:'There is no resolved Event waiting for acknowledgement.',session};

    // uiResolutionData is the authoritative proof that this Event has already
    // been resolved and is waiting only for acknowledgement. A stale/missing
    // shared-open pointer must never trap a company on the result/teaching screen.
    event.isResolved=true;
    const currentId=String((company as any).uiOpenEventInstanceId||'');
    if(currentId===eventInstanceId)clearCompanyOpenEventV1(session,companyId,eventInstanceId);
    else if(!currentId||(session.activeEvents[company.id]||[]).every(candidate=>candidate.instanceId!==currentId||candidate.isResolved)){
      delete (company as any).uiOpenEventInstanceId;
    }
    // Do not claim or open the next Event automatically. The company must
    // deliberately click a face-down card. OPEN_EVENT_CARD then claims that
    // card for the whole company so every player sees the same Event.
    if(allCompanyEventsResolved(session))session.phase='consequences';
    await saveSessionV2(session);
    broadcastV2(session,'COMPANY_EVENT_ACKNOWLEDGED',{companyId,eventInstanceId});
    return{success:true,message:'Event complete. Choose the next Event card when you are ready.',session};
  });
}

export async function knowledgeActionV2(sessionId:string,companyId:string,payload:any){
  if(payload?.type==='ACK_DISRUPTION_SWAP_NOTICE'){
    const session=await baseGetSessionV2(sessionId.toUpperCase());
    if(!session)return{success:false,message:'Session not found.'};
    const company=session.companies.find(candidate=>candidate.id===companyId);
    if(!company)return{success:false,message:'Company not found.',session};
    company.disruptionSwapNotice=null;
    await saveSessionV2(session);
    broadcastV2(session,'DISRUPTION_SWAP_NOTICE_ACKNOWLEDGED',{companyId});
    return{success:true,message:'Strategic change acknowledged.',session};
  }
  if(payload?.type==='FINISH_INVESTING')return finishInvesting(sessionId,companyId);
  if(payload?.type==='FINISH_RISK')return finishRisk(sessionId,companyId);
  if(payload?.type==='FINAL_DISRUPTION_RESOLVE')return serialisePhaseChange(sessionId,()=>baseKnowledgeActionV2(sessionId,companyId,payload));
  if(payload?.type==='SITE_KNOWLEDGE_SHARING')return serialisePhaseChange(sessionId,()=>baseKnowledgeActionV2(sessionId,companyId,payload));
  if(payload?.type==='MOVE_EXPERT')return moveExpertPermanently(sessionId,companyId,payload);
  if(payload?.type==='COP_MESSAGE')return sendCopMessage(sessionId,companyId,payload);
  if(payload?.type==='COP_RESPONSE')return respondCopMessage(sessionId,companyId,payload);
  if(payload?.type==='SET_REPLACEMENT_LOCATION')return setReplacementLocation(sessionId,companyId,payload);
  if(payload?.type==='OPEN_EVENT_CARD')return openCompanyEventCard(sessionId,companyId,String(payload?.eventInstanceId||''));
  if(payload?.type==='ACK_EVENT_RESOLUTION')return acknowledgeEventResolution(sessionId,companyId,String(payload?.eventInstanceId||''));

  const session=await baseGetSessionV2(sessionId.toUpperCase());
  if(session){
    ensureRoundPhases(session);
    const company=session.companies.find(candidate=>candidate.id===companyId);
    const investmentAction=isInvestmentActionV4(String(payload?.type||''))||payload?.type==='SITE_KNOWLEDGE_SHARING';
    if(company&&investmentAction&&roundPhase(company,fallbackFromSession(session))!=='investment'){
      return{success:false,message:'This company has already finished its Invest phase.',session};
    }
  }
  return baseKnowledgeActionV2(sessionId,companyId,payload);
}
