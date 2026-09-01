import React,{useState}from'react';
import { motion } from 'motion/react';
import type { ActiveEventV2 } from '../types/gameV2.ts';

interface Props { events:ActiveEventV2[]; activeIndex:number; horizonScan:boolean; onDraw:()=>void; onAdvance?:()=>void; }
export const EventDeckV1:React.FC<Props>=({events,activeIndex,horizonScan,onDraw,onAdvance})=>{
 const remaining=events.filter(e=>!e.isResolved).length;
 const [advancing,setAdvancing]=useState(false);
 const advance=async()=>{
  if(advancing)return;
  if(onAdvance){onAdvance();return;}
  const sessionId=localStorage.getItem('tpg_session_id');
  if(!sessionId)return;
  setAdvancing(true);
  try{
   let response=await fetch(`/api/sessions/${sessionId}/advance-phase`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
   let data=await response.json();
   if(!response.ok||data.success===false)throw new Error(data.message||data.error||'Could not advance the game.');
   if(data.session?.phase==='consequences'){
    response=await fetch(`/api/sessions/${sessionId}/advance-phase`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
    data=await response.json();
    if(!response.ok||data.success===false)throw new Error(data.message||data.error||'Could not move to Invest.');
   }
   window.location.reload();
  }catch(error:any){setAdvancing(false);window.alert(error.message||'Could not advance the game.');}
 };
 if(!remaining)return <div className="absolute left-5 top-5 z-50 w-[190px] sm:w-[230px] select-none pointer-events-auto"><div className="rounded-2xl border-[4px] border-emerald-300 bg-emerald-950/95 p-4 shadow-[0_0_30px_rgba(52,211,153,.3)]"><div className="text-sm uppercase tracking-wider text-emerald-200 font-black">Events complete</div><div className="mt-1 text-xl sm:text-2xl font-black text-white">All {events.length} cards resolved</div><button type="button" disabled={advancing} onClick={advance} className="mt-4 w-full min-h-14 rounded-xl border-[3px] border-violet-300 bg-violet-700 px-3 py-2 text-base sm:text-lg font-black text-white hover:bg-violet-600 focus:outline-none focus:ring-4 focus:ring-violet-300 disabled:opacity-60">{advancing?'MOVING TO INVEST…':'CONTINUE TO INVEST'}</button></div></div>;
 return <div className="absolute left-5 top-5 z-50 w-[140px] sm:w-[168px] select-none pointer-events-auto">
  <button type="button" onClick={onDraw} aria-label={`Draw event card ${activeIndex+1}. ${remaining} cards remaining.`} className="relative block w-full aspect-[5/7] focus:outline-none focus:ring-4 focus:ring-violet-300 rounded-2xl pointer-events-auto cursor-pointer">
   {[2,1].map(n=><span key={n} className="absolute inset-0 rounded-2xl border-[3px] border-violet-500/60 bg-[#100b1e] pointer-events-none" style={{transform:`translate(${n*5}px,${n*5}px) rotate(${n*.7}deg)`}}/>)}
   <motion.span whileHover={{y:-7,rotate:-1}} whileTap={{scale:.96}} className="absolute inset-0 rounded-2xl border-[4px] border-violet-300 bg-[radial-gradient(circle_at_50%_25%,#35205b_0%,#160d2d_45%,#080b12_100%)] shadow-[0_0_28px_rgba(168,85,247,.38)] grid place-items-center overflow-hidden pointer-events-none">
    <span className="absolute inset-3 rounded-xl border-2 border-emerald-400/25"/><span className="font-black tracking-[.16em] text-violet-100 text-xl sm:text-2xl -rotate-6">EVENT</span>
   </motion.span>
  </button>
  <div className="mt-3 text-center text-sm sm:text-base font-black text-slate-200 pointer-events-none">{remaining} card{remaining===1?'':'s'} remaining</div>
  {horizonScan&&<div className="mt-1 text-center text-xs sm:text-sm font-black uppercase tracking-wider text-emerald-300 pointer-events-none">Horizon scan ready</div>}
 </div>;
};
