import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { KnowledgeDomain } from '../types/game.ts';
import type { ActiveEventV2, CompanyV2, GameSessionV2 } from '../types/gameV2.ts';
import { PROGRAMMED_FAILURE_TAG } from '../engine/eventProgressionV5.ts';
import { OptimisticEventDecisionCardV1 } from './OptimisticEventDecisionCardV1.tsx';
import { NewbieTransferUnlockOverlay } from './NewbieTransferUnlockOverlay.tsx';

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
}

const ROUND_ONE_DISABLED_LABELS = [
  'Ask one of our experts to help',
  'Ask our network for help',
  'Call in a favour',
  'Engage external expertise',
];

const OPENING_PROBLEMS:Record<KnowledgeDomain,{title:string;description:(site:string)=>string}>={
  engineering:{
    title:'Production Instrument Calibration Fault',
    description:site=>`A critical production instrument at ${site} has begun returning inconsistent readings. Operations can continue briefly, but the fault must be diagnosed before quality is compromised.`,
  },
  hr:{
    title:'Unexpected Shift Supervisor Absence',
    description:site=>`Two experienced shift supervisors at ${site} call in sick just before a major production run. The site must reorganise coverage quickly without disrupting output or safety.`,
  },
  marketing:{
    title:'Regional Customer Complaint Escalation',
    description:site=>`A major regional customer served by ${site} has escalated a product complaint and is threatening to move future orders to a competitor unless the issue is handled quickly.`,
  },
  operations:{
    title:'Dispatch Backlog After Scheduling Failure',
    description:site=>`A scheduling failure at ${site} has created a growing dispatch backlog. Several customer deliveries are now at risk unless the site can rapidly reorganise the work.`,
  },
  finance:{
    title:'Supplier Invoice Reconciliation Failure',
    description:site=>`A batch of supplier invoices at ${site} no longer reconciles with purchase records. Payments are due today and the discrepancy must be resolved before suppliers place the account on hold.`,
  },
};

export const EventDecisionCardPlaytestV1:React.FC<Props>=(props)=>{
  const {session,company,event,onAcknowledgeResolution}=props;
  const [pendingContinue,setPendingContinue]=useState<any|null>(null);
  const decisionRootRef=useRef<HTMLDivElement|null>(null);
  // The programmed tutorial event may be played in either dealt-card position.
  // Identify it by its tag, never by cardNumber.
  const isOpeningLesson=session.experienceMode==='newbie'&&session.round===1&&event.card.tags?.includes(PROGRAMMED_FAILURE_TAG);
  const lessonKey=`tpg_transfer_unlock_${session.id}_${company.id}`;
  const simplifyRoundOne=session.experienceMode==='newbie'&&session.round===1;
  const displayEvent=useMemo<ActiveEventV2>(()=>{
    if(!isOpeningLesson)return event;
    const domain=event.card.domains[0]?.domain;
    const problem=domain?OPENING_PROBLEMS[domain]:undefined;
    if(!problem)return event;
    const site=company.sites.find(candidate=>candidate.id===event.targetSiteId)?.name||'the local site';
    return {...event,card:{...event.card,title:problem.title,description:problem.description(site)}};
  },[company.sites,event,isOpeningLesson]);

  useEffect(()=>{
    const root=decisionRootRef.current;
    if(!root)return;

    const applyRoundOneLocks=()=>{
      root.querySelectorAll('button').forEach(button=>{
        const label=button.textContent?.trim()||'';
        const locked=simplifyRoundOne&&ROUND_ONE_DISABLED_LABELS.some(target=>label.startsWith(target));
        if(locked){
          button.disabled=true;
          button.setAttribute('aria-disabled','true');
          button.classList.add('opacity-35','grayscale','cursor-not-allowed');
          button.classList.remove('hover:border-violet-300','hover:bg-violet-950');
        }
      });
    };

    applyRoundOneLocks();
    const observer=new MutationObserver(applyRoundOneLocks);
    observer.observe(root,{childList:true,subtree:true});
    return()=>observer.disconnect();
  },[simplifyRoundOne,event.instanceId]);

  const interceptContinue=async(data:any)=>{
    if(isOpeningLesson&&!localStorage.getItem(lessonKey)){
      setPendingContinue(data);
      return;
    }
    await onAcknowledgeResolution(data);
  };

  const finishLesson=async()=>{
    const data=pendingContinue;
    localStorage.setItem(lessonKey,'1');
    // Backwards-compatible marker for any older Round 1 investment code still
    // looking for the original Corporate Intranet-only tutorial key.
    localStorage.setItem(`tpg_intranet_unlock_${session.id}_${company.id}`,'1');
    setPendingContinue(null);
    await onAcknowledgeResolution(data);
  };

  if(pendingContinue){
    const resolvedSession=(pendingContinue?.session||session) as GameSessionV2;
    const resolvedCompany=resolvedSession.companies.find(c=>c.id===company.id)||company;
    return <NewbieTransferUnlockOverlay session={resolvedSession} company={resolvedCompany} onContinue={finishLesson}/>;
  }

  return <div ref={decisionRootRef}><OptimisticEventDecisionCardV1 {...props} event={displayEvent} onAcknowledgeResolution={interceptContinue}/></div>;
};
