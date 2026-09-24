import React from 'react';
import { motion } from 'motion/react';
import type { ActiveEventV2, CompanyV2, GameSessionV2 } from '../types/gameV2.ts';
import { evaluateEventDomainKnowledgeExplicitV2 } from '../engine/challengeResponseV2.ts';
import { DomainBadge } from './DomainBadge.tsx';

interface Props {
  session: GameSessionV2;
  company: CompanyV2;
  event: ActiveEventV2;
  onContinue: () => Promise<void>|void;
}

const enginePercent=(dieRoll:number,sides:number)=>Math.max(1,Math.min(100,101-Math.ceil((Math.max(1,dieRoll)/Math.max(1,sides))*100)));

/** Shared rendering of a resolved company Event for browsers that did not press GO. */
export const SharedEventResolutionV1:React.FC<Props>=({session,company,event,onContinue})=>{
  const shared=(event as any).uiResolutionData;
  if(!shared)return null;
  const result=shared.result||{};
  const domainResults=Array.isArray(result.domainResults)?result.domainResults:[];
  const success=Boolean(shared.eventSuccess??result.success);
  return <motion.div initial={{opacity:0,y:-10}} animate={{opacity:1,y:0}} className={`w-full rounded-2xl border-2 p-4 shadow-2xl ${success?'border-emerald-500 bg-emerald-950/95':'border-rose-500 bg-rose-950/95'}`}>
    <div className="flex justify-between gap-3"><div><div className="text-[10px] uppercase tracking-wider text-slate-400 font-black">Challenge resolved</div><div className="font-black text-white text-lg">{event.card.title}</div></div><div className={`text-2xl font-black ${success?'text-emerald-300':'text-rose-300'}`}>{success?'SUCCESS':'FAIL'}</div></div>
    <div className={`grid gap-2 mt-3 ${event.card.domains.length>1?'grid-cols-2':'grid-cols-1'}`}>{event.card.domains.map(req=>{
      const evaluation=evaluateEventDomainKnowledgeExplicitV2(session,company,event,req.domain,session.config);
      const resolved=domainResults.find((item:any)=>item.domain===req.domain);
      const domainSuccess=resolved?Boolean(resolved.domainSuccess):success;
      const roll=resolved?.dieRoll!=null?enginePercent(Number(resolved.dieRoll),session.config.event_die):100;
      return <div key={req.domain} className="rounded-xl border border-slate-700 bg-slate-950/80 p-3"><div className="flex justify-between"><DomainBadge domain={req.domain}/><b className={domainSuccess?'text-emerald-300':'text-rose-300'}>{domainSuccess?'SUCCESS':'FAIL'}</b></div><div className="grid grid-cols-2 gap-2 mt-2"><div className="rounded-lg bg-slate-900 p-2 text-center"><div className="text-[9px] uppercase text-slate-500 font-black">Chance</div><div className="text-xl font-black">{evaluation.winChancePercent}%</div></div><div className="rounded-lg bg-slate-900 border border-indigo-700 p-2 text-center"><div className="text-[9px] uppercase text-indigo-300 font-black">Roll</div><div className="text-2xl font-black tabular-nums">{String(roll).padStart(2,'0')}%</div></div></div></div>;
    })}</div>
    <button onClick={()=>void onContinue()} className="mt-3 w-full rounded-xl bg-white text-slate-950 py-3 font-black">CONTINUE</button>
  </motion.div>;
};
