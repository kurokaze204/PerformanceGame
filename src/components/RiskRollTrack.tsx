import React,{useEffect,useRef,useState}from'react';
import d12Src from'../d12grn.png';

type Kind='expert'|'site';
interface Props{roll:number;threshold:number;sides:number;kind:Kind;isSPOF?:boolean;onComplete?:()=>void;}

const sleep=(ms:number)=>new Promise<void>(resolve=>window.setTimeout(resolve,ms));

export const RiskRollTrack:React.FC<Props>=({roll,threshold,sides,kind,isSPOF=false,onComplete})=>{
 const safeSides=Math.max(2,sides||12),safeRoll=Math.max(1,Math.min(safeSides,roll||1));
 const[active,setActive]=useState<number|null>(null),[rolling,setRolling]=useState(false),[done,setDone]=useState(false),[started,setStarted]=useState(false);
 const runId=useRef(0);
 useEffect(()=>{runId.current+=1;setActive(null);setRolling(false);setDone(false);setStarted(false);},[roll,threshold,sides,kind,isSPOF]);
 const pushToRoll=async()=>{
  if(rolling||done)return;
  const myRun=++runId.current;
  setStarted(true);setRolling(true);setDone(false);
  let index=Math.floor(Math.random()*safeSides);
  let delay=0.01;
  setActive(index+1);
  await sleep(delay*1000);
  while(myRun===runId.current){
   delay*=1.15;
   if(delay>0.32)break;
   index=(index+1)%safeSides;
   setActive(index+1);
   await sleep(delay*1000);
  }
  if(myRun!==runId.current)return;
  setActive(safeRoll);
  setRolling(false);setDone(true);onComplete?.();
 };
 const squareBase=(n:number)=>{
  if(kind==='expert'){
   if(n===1)return'border-rose-500 bg-rose-600';
   if(n===2&&isSPOF)return'border-amber-400 bg-amber-500';
   return'border-sky-700 bg-sky-700';
  }
  if(n<=Math.max(0,Math.min(safeSides,threshold||0)))return'border-rose-500 bg-rose-600';
  return'border-sky-700 bg-sky-700';
 };
 return <div className="w-[350px] max-w-full rounded-2xl border-2 border-emerald-700 bg-slate-950 px-3 py-2.5 shadow-lg">
  <div className="flex items-center gap-3">
   <img src={d12Src} alt="Twelve-sided die" className="h-[72px] w-[72px] shrink-0 object-contain" draggable={false}/>
   <div className="min-w-0 flex-1">
    <div className="flex justify-end"><button type="button" onClick={()=>void pushToRoll()} disabled={rolling||done} className="rounded-lg border border-sky-800 bg-sky-700 px-4 py-2 text-base font-black text-white shadow-md transition active:scale-95 disabled:cursor-default disabled:opacity-70">{rolling?'Rolling…':done?`Roll ${safeRoll}`:'Push to Roll'}</button></div>
    <div className="mt-2 flex gap-1" aria-label={`Risk roll ${safeRoll} on a d${safeSides}`}>
     {Array.from({length:safeSides},(_,i)=>{const n=i+1,isActive=active===n;return <span key={n} className={`h-[18px] min-w-0 flex-1 rounded-[3px] border transition-[filter,box-shadow] duration-75 ${squareBase(n)} ${started&&!isActive?'brightness-50':isActive?'brightness-110 ring-1 ring-sky-200 shadow-[0_0_7px_rgba(125,211,252,.75)]':'brightness-100'}`}/>})}
    </div>
   </div>
  </div>
 </div>;
};
