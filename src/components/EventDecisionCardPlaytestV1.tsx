import React, { useState } from 'react';
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

export const EventDecisionCardPlaytestV1:React.FC<Props>=(props)=>{
  const {session,company,event,cardNumber,onAcknowledgeResolution}=props;
  const [pendingContinue,setPendingContinue]=useState<any|null>(null);
  const isOpeningLesson=session.experienceMode==='newbie'&&cardNumber===1&&event.card.tags?.includes(PROGRAMMED_FAILURE_TAG);
  const lessonKey=`tpg_transfer_unlock_${session.id}_${company.id}`;

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

  return <EventDecisionCardV4 {...props} onAcknowledgeResolution={interceptContinue}/>;
};
