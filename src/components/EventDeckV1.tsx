import React from 'react';
import { motion } from 'motion/react';
import type { ActiveEventV2 } from '../types/gameV2.ts';

interface Props { events:ActiveEventV2[]; activeIndex:number; horizonScan:boolean; onDraw:()=>void; }
export const EventDeckV1:React.FC<Props>=({events,activeIndex,horizonScan,onDraw})=>{
 const remaining=events.filter(e=>!e.isResolved).length;
 return <div className="absolute left-4 top-4 z-30 w-[116px] sm:w-[138px] select-none">
  <button type="button" onClick={onDraw} disabled={!remaining} aria-label={remaining?`Draw event card ${activeIndex+1}. ${remaining} cards remaining.`:'No event cards remaining'} className="relative block w-full aspect-[5/7] disabled:opacity-45 focus:outline-none focus:ring-2 focus:ring-violet-300 rounded-xl">
   {[2,1].map(n=><span key={n} className="absolute inset-0 rounded-xl border-2 border-violet-500/60 bg-[#100b1e]" style={{transform:`translate(${n*4}px,${n*4}px) rotate(${n*.7}deg)`}}/>)}
   <motion.span whileHover={{y:-5,rotate:-1}} whileTap={{scale:.96}} className="absolute inset-0 rounded-xl border-[3px] border-violet-300 bg-[radial-gradient(circle_at_50%_25%,#35205b_0%,#160d2d_45%,#080b12_100%)] shadow-[0_0_22px_rgba(168,85,247,.32)] grid place-items-center overflow-hidden">
    <span className="absolute inset-2 rounded-lg border border-emerald-400/25"/><span className="font-black tracking-[.18em] text-violet-200 text-sm sm:text-base -rotate-6">EVENT</span>
   </motion.span>
  </button>
  <div className="mt-2 text-center text-[10px] sm:text-xs font-bold text-slate-300">{remaining} card{remaining===1?'':'s'} remaining</div>
  {horizonScan&&<div className="mt-1 text-center text-[9px] font-black uppercase tracking-wider text-emerald-300">Horizon scan ready</div>}
 </div>;
};
