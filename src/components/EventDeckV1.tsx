import React,{useEffect,useState}from'react';
import{AnimatePresence,motion}from'motion/react';
import type{ActiveEventV2}from'../types/gameV2.ts';

interface Props{events:ActiveEventV2[];activeIndex:number;horizonScan:boolean;onDraw:()=>void;onAdvance?:()=>void;cardOpen?:boolean;}

export const EventDeckV1:React.FC<Props>=({events,activeIndex,horizonScan,onDraw,onAdvance,cardOpen=false})=>{
 const remaining=events.filter(e=>!e.isResolved).length;
 const deckRemaining=Math.max(0,remaining-(cardOpen?1:0));
 const[drawing,setDrawing]=useState(false),[advancing,setAdvancing]=useState(false);
 useEffect(()=>{if(!cardOpen)setDrawing(false)},[cardOpen,activeIndex]);
 const draw=()=>{
  if(drawing||cardOpen||remaining<=0)return;
  setDrawing(true);
  window.setTimeout(()=>onDraw(),430);
 };
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

 if(!remaining&&!cardOpen)return <div className="absolute left-5 top-5 z-50 w-[190px] sm:w-[230px] select-none pointer-events-auto"><div className="rounded-2xl border-[4px] border-emerald-300 bg-emerald-950/95 p-4 shadow-[0_0_30px_rgba(52,211,153,.3)]"><div className="text-sm uppercase tracking-wider text-emerald-200 font-black">Events complete</div><div className="mt-1 text-xl sm:text-2xl font-black text-white">All {events.length} cards resolved</div><button type="button" disabled={advancing} onClick={advance} className="mt-4 w-full min-h-14 rounded-xl border-[3px] border-violet-300 bg-violet-700 px-3 py-2 text-base sm:text-lg font-black text-white hover:bg-violet-600 focus:outline-none focus:ring-4 focus:ring-violet-300 disabled:opacity-60">{advancing?'MOVING TO INVEST…':'CONTINUE TO INVEST'}</button></div></div>;

 return <div className="absolute left-5 top-5 z-50 w-[140px] sm:w-[168px] select-none pointer-events-auto">
  <div className="relative w-full aspect-[5/7]">
   <span className="absolute inset-0 translate-x-[10px] translate-y-[10px] rotate-[1.4deg] rounded-2xl border-[3px] border-violet-500/35 bg-[#0d0917] pointer-events-none"/>
   <span className="absolute inset-0 translate-x-[5px] translate-y-[5px] rotate-[.7deg] rounded-2xl border-[3px] border-violet-500/55 bg-[#100b1e] pointer-events-none"/>
   {cardOpen||drawing?<div className="absolute inset-0 rounded-2xl border-[3px] border-violet-600/55 bg-[radial-gradient(circle_at_50%_25%,#24163c_0%,#100b1e_58%,#080b12_100%)] shadow-[0_0_18px_rgba(168,85,247,.2)] grid place-items-center pointer-events-none"><span className="absolute inset-3 rounded-xl border-2 border-violet-400/15"/><span className="text-center"><b className="block text-sm font-black tracking-[.14em] text-violet-300/70">EVENT DECK</b><span className="mt-2 block text-xs font-bold text-slate-500">{deckRemaining>0?`${deckRemaining} waiting`:'card in play'}</span></span></div>:<button type="button" onClick={draw} aria-label={`Draw event card ${activeIndex+1}. ${remaining} cards remaining.`} className="absolute inset-0 block w-full rounded-2xl focus:outline-none focus:ring-4 focus:ring-violet-300 pointer-events-auto cursor-pointer">
    <motion.span whileHover={{y:-8,rotate:-1.5}} whileTap={{scale:.96}} className="absolute inset-0 rounded-2xl border-[4px] border-violet-300 bg-[radial-gradient(circle_at_50%_25%,#35205b_0%,#160d2d_45%,#080b12_100%)] shadow-[0_0_28px_rgba(168,85,247,.38)] grid place-items-center overflow-hidden pointer-events-none"><span className="absolute inset-3 rounded-xl border-2 border-emerald-400/25"/><span className="font-black tracking-[.16em] text-violet-100 text-xl sm:text-2xl -rotate-6">EVENT</span></motion.span>
   </button>}
   <AnimatePresence>{drawing&&!cardOpen&&<motion.div key={`draw-${activeIndex}`} initial={{x:0,y:0,scale:1,rotate:0,opacity:1}} animate={{x:'clamp(260px,32vw,520px)',y:'clamp(70px,10vh,130px)',scale:1.32,rotate:4,opacity:[1,1,.18]}} exit={{opacity:0}} transition={{duration:.44,ease:[.22,.9,.28,1]}} className="absolute inset-0 z-[80] rounded-2xl border-[4px] border-violet-200 bg-[radial-gradient(circle_at_50%_25%,#4b2a78_0%,#1d1037_48%,#080b12_100%)] shadow-[0_20px_55px_rgba(0,0,0,.55)] grid place-items-center pointer-events-none"><span className="absolute inset-3 rounded-xl border-2 border-emerald-300/35"/><span className="font-black tracking-[.16em] text-white text-xl sm:text-2xl -rotate-6">EVENT</span></motion.div>}</AnimatePresence>
  </div>
  <div className="mt-3 text-center text-sm sm:text-base font-black text-slate-200 pointer-events-none">{cardOpen?`${deckRemaining} card${deckRemaining===1?'':'s'} still in deck`:`${remaining} card${remaining===1?'':'s'} remaining`}</div>
  {horizonScan&&!cardOpen&&<div className="mt-1 text-center text-xs sm:text-sm font-black uppercase tracking-wider text-emerald-300 pointer-events-none">Horizon scan ready</div>}
 </div>;
};
