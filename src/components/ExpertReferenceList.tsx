import React,{useState}from'react';
import{AlertTriangle,X}from'lucide-react';
import type{CompanyV2}from'../types/gameV2.ts';
import type{Expert,KnowledgeDomain}from'../types/game.ts';
import{DomainBadge}from'./DomainBadge.tsx';
import{expertDisplayName}from'../utils/expertDisplay.ts';

interface Props{company:CompanyV2;domains:KnowledgeDomain[];onSelectExpert?:(expert:Expert)=>void;heading?:boolean;}
const busyStates=new Set(['Supporting Event','Travelling','Training','Knowledge Transfer','Expertise Capture','CoP Participant']);

export const ExpertReferenceList:React.FC<Props>=({company,domains,onSelectExpert,heading=false})=>{
 const[showSpofHelp,setShowSpofHelp]=useState(false);
 return <>
  <div className="flex items-center justify-between gap-3">
   {heading&&<h2 className="text-2xl font-black text-white">Experts</h2>}
   <button onClick={()=>setShowSpofHelp(true)} className="ml-auto rounded-lg border border-amber-700/60 bg-amber-950/30 px-2 py-1 text-[10px] font-black text-amber-200"><AlertTriangle className="inline h-3 w-3 mr-1"/>SPOF?</button>
  </div>
  <div className="space-y-3 mt-3">{company.experts.map(e=>{
   const visible=e.domains.filter(d=>domains.includes(d.domain));
   const spof=e.spofDomains.filter(d=>domains.includes(d));
   const location=e.location==='HQ'?'Corporate HQ':company.sites.find(s=>s.id===e.location)?.name||e.location;
   const unavailable=Boolean(e.isVacant||busyStates.has(e.state));
   const status=e.isVacant?'Vacant':e.state;
   return <button key={e.id} onClick={()=>!e.isVacant&&onSelectExpert?.(e)} className={`w-full rounded-2xl border-2 p-4 text-left transition ${unavailable?'border-slate-800 bg-slate-950/70 opacity-60':'border-violet-800 bg-violet-950/25 hover:border-violet-400'}`}>
    <div className="flex items-start justify-between gap-3"><div><div className="text-base font-black text-white">{e.isVacant?'VACANT':expertDisplayName(e)}</div><div className="mt-1 text-xs text-slate-400">{location} · <span className={unavailable?'text-amber-300':'text-emerald-300'}>{status}</span></div></div>{spof.length>0&&<span className="rounded-full border border-rose-700 bg-rose-950 px-2 py-1 text-[10px] font-black text-rose-200">SPOF</span>}</div>
    <div className="mt-3 flex flex-wrap gap-3">{visible.map(d=><span key={d.domain} className="inline-flex items-center gap-2"><DomainBadge domain={d.domain}/><b className="text-lg text-white">{d.score}</b></span>)}{!visible.length&&<span className="text-xs font-bold text-slate-500">Replacement pending</span>}</div>
    {spof.length>0&&<div className="mt-2 flex items-center gap-1.5 text-[10px] font-bold text-rose-300"><span>Single point of failure:</span>{spof.map(d=><DomainBadge key={d} domain={d}/>)}</div>}
   </button>})}</div>
  {showSpofHelp&&<div className="fixed inset-0 z-[220] grid place-items-center bg-black/65 p-4" onClick={()=>setShowSpofHelp(false)}><div className="w-full max-w-md rounded-2xl border border-amber-600 bg-slate-950 p-4 shadow-2xl" onClick={e=>e.stopPropagation()}><div className="flex items-start justify-between gap-3"><div><div className="text-[10px] uppercase tracking-wider text-amber-300 font-black">Knowledge risk</div><h3 className="text-lg font-black text-white">Single Point of Failure</h3></div><button onClick={()=>setShowSpofHelp(false)} className="rounded-lg border border-slate-700 p-1.5 text-slate-300"><X className="h-4 w-4"/></button></div><p className="mt-2 text-sm leading-relaxed text-slate-300">This expert holds substantially more knowledge than the organisation can access without them. Reduce the gap through transfer, codification or training.</p></div></div>}
 </>;
};
