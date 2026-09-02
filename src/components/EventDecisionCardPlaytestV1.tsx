import React, { useEffect, useRef, useState } from 'react';
import type { KnowledgeDomain } from '../types/game.ts';
import type { ActiveEventV2, CompanyV2, GameSessionV2 } from '../types/gameV2.ts';
import { PROGRAMMED_FAILURE_TAG } from '../engine/eventProgressionV5.ts';
import { EventDecisionCardV4 } from './EventDecisionCardV4.tsx';
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

export const EventDecisionCardPlaytestV1:React.FC<Props>=(props)=>{
  const {session,company,event,onAcknowledgeResolution}=props;
  const [pendingContinue,setPendingContinue]=useState<any|null>(null);
  const decisionRootRef=useRef<HTMLDivElement|null>(null);
  // The programmed tutorial event may be played in either dealt-card position.
  // Identify it by its tag, never by cardNumber.
  const isOpeningLesson=session.experienceMode==='newbie'&&session.round===1&&event.card.tags?.includes(PROGRAMMED_FAILURE_TAG);
  const lessonKey=`tpg_transfer_unlock_${session.id}_${company.id}`;
  const simplifyRoundOne=session.experienceMode==='newbie'&&session.round===1;

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

  return <div ref={decisionRootRef}><EventDecisionCardV4 {...props} onAcknowledgeResolution={interceptContinue}/></div>;
};
