import React,{useEffect,useState}from'react';

type Kind='expert'|'site';
interface Props{roll:number;threshold:number;sides:number;kind:Kind;onComplete?:()=>void;}

type Step={index:number;delay:number};

export const RiskRollTrack:React.FC<Props>=({roll,threshold,sides,kind,onComplete})=>{
 const[active,setActive]=useState(0),[done,setDone]=useState(false);
 useEffect(()=>{
  const safeSides=Math.max(2,sides||12),safeRoll=Math.max(1,Math.min(safeSides,roll||1));
  setActive(0);setDone(false);
  const timers:number[]=[];let elapsed=0;
  const schedulePass=(count:number,duration:number)=>{
   const stepMs=duration/Math.max(1,count);
   for(let i=1;i<=count;i++){elapsed+=stepMs;timers.push(window.setTimeout(()=>setActive(((i-1)%safeSides)+1),elapsed));}
  };
  schedulePass(safeSides,200);
  schedulePass(safeSides,400);
  schedulePass(safeSides,800);
  schedulePass(safeRoll,1600);
  timers.push(window.setTimeout(()=>{setActive(safeRoll);setDone(true);onComplete?.();},elapsed+25));
  return()=>timers.forEach(id=>window.clearTimeout(id));
 },[roll,threshold,sides,kind]);
 const safeSides=Math.max(2,sides||12),safeThreshold=Math.max(0,Math.min(safeSides,threshold||0));
 return <div className="rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-3">
  <div className="flex items-center justify-between gap-3"><div className="text-[10px] uppercase tracking-widest text-slate-400 font-black">Knowledge Risk · d{safeSides}</div><div className="text-xs text-slate-300">{done?<>Roll <b className="text-white">{roll}</b></>:<span className="text-sky-300 font-black">Rolling…</span>}</div></div>
  <div className="mt-2 grid gap-1" style={{gridTemplateColumns:`repeat(${safeSides},minmax(0,1fr))`}} aria-label={`Risk roll ${roll} on a d${safeSides}; threshold ${safeThreshold}`}>
   {Array.from({length:safeSides},(_,i)=>{const n=i+1,risky=n<=safeThreshold;let base='border-emerald-700 bg-emerald-700/80';if(risky)base=kind==='expert'?(n===1?'border-rose-500 bg-rose-600':'border-orange-400 bg-orange-500'):'border-rose-500 bg-rose-600';const isActive=active===n;return <div key={n} className={`aspect-square min-w-0 rounded-[3px] border grid place-items-center text-[9px] font-black transition-colors ${isActive?'border-sky-200 bg-sky-500 text-white ring-2 ring-sky-300/40':`${base} text-white/90`}`}>{n}</div>})}
  </div>
  <div className="mt-2 text-[10px] text-slate-400">{kind==='expert'?<><span className="text-rose-300 font-bold">Red</span> = retirement · <span className="text-orange-300 font-bold">orange</span> = burnout resignation · green = retained</>:<>Risk squares = local capability loss · green = stable</>}</div>
 </div>;
};
