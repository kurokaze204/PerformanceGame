import React, { useMemo, useRef, useState } from 'react';
import type { KnowledgeDomain } from '../types/game.ts';
import type { ActiveEventV2, CompanyV2, GameSessionV2 } from '../types/gameV2.ts';
import { PROGRAMMED_ASSEMBLY_TAG, PROGRAMMED_FAILURE_TAG } from '../engine/eventProgressionV5.ts';
import { OptimisticEventDecisionCardV1 } from './OptimisticEventDecisionCardV1.tsx';
import { NewbieTransferUnlockOverlay } from './NewbieTransferUnlockOverlay.tsx';
import { SharedEventResolutionV1 } from './SharedEventResolutionV1.tsx';

interface Props {
  session: GameSessionV2;
  company: CompanyV2;
  event: ActiveEventV2;
  cardNumber: number;
  onSetAllocation: (eventId:string,domain:KnowledgeDomain,allocation:any)=>Promise<void>|void;
  onResolveEvent: (eventId:string)=>Promise<any>;
  onAcknowledgeResolution: (data:any)=>Promise<void>|void;
  onRedrawEvent?: (eventId:string)=>Promise<void>|void;
  canHorizonRedraw?: boolean;
  participantId?: string;
  readOnly?: boolean;
}

const OPENING_PROBLEMS:Record<KnowledgeDomain,{title:string;description:(site:string)=>string}>={
  engineering:{title:'Production Instrument Calibration Fault',description:site=>`A critical production instrument at ${site} has begun returning inconsistent readings. Operations can continue briefly, but the fault must be diagnosed before quality is compromised.`},
  hr:{title:'Unexpected Shift Supervisor Absence',description:site=>`Two experienced shift supervisors at ${site} call in sick just before a major production run. The site must reorganise coverage quickly without disrupting output or safety.`},
  marketing:{title:'Regional Customer Complaint Escalation',description:site=>`A major regional customer served by ${site} has escalated a product complaint and is threatening to move future orders to a competitor unless the issue is handled quickly.`},
  operations:{title:'Dispatch Backlog After Scheduling Failure',description:site=>`A scheduling failure at ${site} has created a growing dispatch backlog. Several customer deliveries are now at risk unless the site can rapidly reorganise the work.`},
  finance:{title:'Supplier Invoice Reconciliation Failure',description:site=>`A batch of supplier invoices at ${site} no longer reconciles with purchase records. Payments are due today and the discrepancy must be resolved before suppliers place the account on hold.`},
};

export const EventDecisionCardPlaytestV1:React.FC<Props>=(props)=>{
  const {session,company,event,onAcknowledgeResolution,participantId,readOnly=false}=props;
  const [pendingContinue,setPendingContinue]=useState<any|null>(null);
  const [ackBusy,setAckBusy]=useState(false);
  const decisionRootRef=useRef<HTMLDivElement|null>(null);
  const isOpeningDiagnostic=session.round===1&&event.card.tags?.includes(PROGRAMMED_FAILURE_TAG);
  const isAssemblyLesson=session.round===1&&event.card.tags?.includes(PROGRAMMED_ASSEMBLY_TAG);
  const isNewbieOpeningLesson=session.experienceMode==='newbie'&&Boolean(isOpeningDiagnostic);
  const lessonKey=`tpg_transfer_unlock_${session.id}_${company.id}`;
  const sharedResolution=(event as any).uiResolutionData;
  const displayEvent=useMemo<ActiveEventV2>(()=>{
    if(!isOpeningDiagnostic)return event;
    const domain=event.card.domains[0]?.domain;
    const problem=domain?OPENING_PROBLEMS[domain]:undefined;
    if(!problem)return event;
    const site=company.sites.find(candidate=>candidate.id===event.targetSiteId)?.name||'the local site';
    return {...event,card:{...event.card,title:problem.title,description:problem.description(site)}};
  },[company.sites,event,isOpeningDiagnostic]);

  const acknowledgeCompanyResolution=async(data:any)=>{
    if(ackBusy||readOnly)return;
    setAckBusy(true);
    const recoverFromAuthoritativeState=async()=>{
      const refresh=await fetch(`/api/sessions/${session.id}`,{cache:'no-store'});
      if(!refresh.ok)return false;
      const refreshed=await refresh.json();
      const refreshedEvent=(refreshed.activeEvents?.[company.id]||[]).find((candidate:any)=>candidate.instanceId===event.instanceId);
      if(refreshedEvent?.isResolved||(refreshedEvent as any)?.uiResolutionData==null){
        await onAcknowledgeResolution({success:true,session:refreshed});
        setPendingContinue(null);
        return true;
      }
      return false;
    };
    try{
      const controller=new AbortController();
      const timeout=window.setTimeout(()=>controller.abort(),7000);
      let response:Response;
      try{
        response=await fetch(`/api/sessions/${session.id}/action`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({companyId:company.id,participantId,actionType:'ACK_EVENT_RESOLUTION',params:{eventInstanceId:event.instanceId}}),signal:controller.signal});
      }catch(error){
        window.clearTimeout(timeout);
        if(await recoverFromAuthoritativeState())return;
        throw error;
      }
      window.clearTimeout(timeout);
      const raw=await response.text();
      let authoritative:any=null;
      if(raw){try{authoritative=JSON.parse(raw)}catch{}}
      if(!authoritative){
        if(await recoverFromAuthoritativeState())return;
        throw new Error(response.ok?'The server did not return a response. Please try Continue again.':'Could not continue.');
      }
      if(!response.ok||authoritative.success===false){
        if(await recoverFromAuthoritativeState())return;
        throw new Error(authoritative.message||authoritative.error||'Could not continue.');
      }
      await onAcknowledgeResolution(authoritative);
      setPendingContinue(null);
    }finally{setAckBusy(false);}
  };

  const interceptContinue=async(data:any)=>{
    if(isNewbieOpeningLesson&&!localStorage.getItem(lessonKey)){setPendingContinue(data);return;}
    await acknowledgeCompanyResolution(data);
  };

  const finishLesson=async()=>{
    const data=pendingContinue;
    if(!data||ackBusy)return;
    localStorage.setItem(lessonKey,'1');
    localStorage.setItem(`tpg_intranet_unlock_${session.id}_${company.id}`,'1');
    // Keep the teaching overlay mounted until the server has acknowledged the
    // resolved Event. Clearing it first briefly exposes the stale pre-resolution
    // decision card while the acknowledgement request is in flight.
    await acknowledgeCompanyResolution(data);
  };

  if(pendingContinue){
    const resolvedSession=(pendingContinue?.session||session) as GameSessionV2;
    const resolvedCompany=resolvedSession.companies.find(c=>c.id===company.id)||company;
    return <NewbieTransferUnlockOverlay session={resolvedSession} company={resolvedCompany} onContinue={finishLesson}/>;
  }

  if(sharedResolution){
    return <SharedEventResolutionV1 session={session} company={company} event={displayEvent} onContinue={()=>acknowledgeCompanyResolution({session})}/>;
  }

  const availableModes=isOpeningDiagnostic?['existing'] as const:isAssemblyLesson?['existing','expert'] as const:undefined;
  const teachingHint=isAssemblyLesson?'Click each domain. Use Team Capability; add the relevant expert where local knowledge is not enough.':undefined;
  return <div ref={decisionRootRef}>{readOnly&&<div className="mb-2 rounded-xl border border-amber-700 bg-amber-950/35 px-3 py-2 text-center text-xs font-black text-amber-200">READ ONLY · Your CEO controls this company</div>}<OptimisticEventDecisionCardV1 {...props} event={displayEvent} diagnostic={Boolean(isOpeningDiagnostic)} availableModes={availableModes?[...availableModes]:undefined} teamOnlyExisting={Boolean(isAssemblyLesson)} teachingHint={teachingHint} onAcknowledgeResolution={interceptContinue}/></div>;
};
