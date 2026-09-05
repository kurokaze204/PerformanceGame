import React, { useEffect, useRef, useState } from 'react';
import type { KnowledgeDomain } from '../types/game.ts';
import type { ActiveEventAllocationV2, ActiveEventV2, CompanyV2, GameSessionV2 } from '../types/gameV2.ts';
import { EventDecisionCardV4 } from './EventDecisionCardV4.tsx';

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

type AllocationMap = ActiveEventV2['allocations'];

const cloneAllocations=(allocations:AllocationMap):AllocationMap=>Object.fromEntries(
  Object.entries(allocations).map(([domain,allocation])=>[domain,{...(allocation||{})}]),
) as AllocationMap;

/**
 * Keeps tentative Event selections in the browser so ticks, Chance and costs
 * redraw immediately. The server remains authoritative: writes are sent in the
 * exact order the player made them, and the local view reconciles to the latest
 * server state after the queue drains.
 */
export const OptimisticEventDecisionCardV1:React.FC<Props>=(props)=>{
  const {event,onSetAllocation}=props;
  const [optimisticAllocations,setOptimisticAllocations]=useState<AllocationMap>(()=>cloneAllocations(event.allocations));
  const [pendingWrites,setPendingWrites]=useState(0);
  const eventIdRef=useRef(event.instanceId);
  const serverAllocationsRef=useRef<AllocationMap>(event.allocations);
  const writeQueueRef=useRef<Promise<void>>(Promise.resolve());

  serverAllocationsRef.current=event.allocations;

  useEffect(()=>{
    if(eventIdRef.current===event.instanceId)return;
    eventIdRef.current=event.instanceId;
    writeQueueRef.current=Promise.resolve();
    setPendingWrites(0);
    setOptimisticAllocations(cloneAllocations(event.allocations));
  },[event.instanceId,event.allocations]);

  useEffect(()=>{
    if(pendingWrites===0)setOptimisticAllocations(cloneAllocations(event.allocations));
  },[event.allocations,pendingWrites]);

  const setAllocationOptimistically=(eventId:string,domain:KnowledgeDomain,change:Partial<ActiveEventAllocationV2>)=>{
    // Paint first. EventDecisionCardV4 recalculates visible Chance/cost from this
    // local event on the very next React render rather than waiting for Render.
    setOptimisticAllocations(current=>({
      ...current,
      [domain]:{...(current[domain]||{}),...change},
    }));

    setPendingWrites(count=>count+1);
    writeQueueRef.current=writeQueueRef.current
      .then(()=>Promise.resolve(onSetAllocation(eventId,domain,change)))
      .catch(()=>{
        // AppBoard already surfaces the server error. Reconciliation below
        // restores the authoritative allocation once outstanding writes finish.
      })
      .finally(()=>setPendingWrites(count=>Math.max(0,count-1)));

    // Deliberately return immediately. Existing V4 handlers may `await` this
    // callback; returning void means linked local selections are not held up by
    // network/database latency while the write queue continues in background.
  };

  const optimisticEvent:ActiveEventV2={...event,allocations:optimisticAllocations};

  return <EventDecisionCardV4 {...props} event={optimisticEvent} onSetAllocation={setAllocationOptimistically}/>;
};
