import React,{useState}from'react';
import{AlertTriangle,ArrowRightLeft,X}from'lucide-react';
import type{CompanyV2,GameSessionV2}from'../types/gameV2.ts';
import type{Expert,KnowledgeDomain}from'../types/game.ts';
import{DomainBadge}from'./DomainBadge.tsx';
import{expertDisplayName}from'../utils/expertDisplay.ts';
import{formatCurrency}from'../utils/format.ts';
import{EXPERT_RELOCATION_COST_V1}from'../engine/investmentCapacityV1.ts';

interface Props{company:CompanyV2;domains:KnowledgeDomain[];session?:GameSessionV2;onSessionUpdate?:(session:GameSessionV2)=>void;onSelectExpert?:(expert:Expert)=>void;heading?:boolean;}
const busyStates=new Set(['Supporting Event','Travelling','Training','Knowledge Transfer','Expertise Capture','CoP Participant']);

export const ExpertReferenceList:React.FC<Props>=({company,domains,session,onSessionUpdate,onSelectExpert,heading=false})=>{
 const[showSpofHelp,setShowSpofHelp]=useState(false);
 const[moveTargets,setMoveTargets]=useState<Record<string,string>>({});
 const[moving,setMoving]=useState<string|null>(null);
 const[moveMessage,setMoveMessage]=useState('');
 const activeSites=company.sites.filter(site=>!site.isClosed);
 const relocationAvailable=company.strategicInvestmentFund+0.0001>=EXPERT_RELOCATION_COST_V1;

 const moveExpert=async(expert:Expert,targetLocation:string)=>{
  if(!session||!targetLocation||moving)return;
  setMoving(expert.id);setMoveMessage('');
  try{
   const response=await fetch(`/api/sessions/${session.id}/action`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({companyId:company.id,actionType:'MOVE_EXPERT',params:{expertId:expert.id,targetLocation}})});
   const data=await response.json();
   if(!response.ok||data.success===false)throw new Error(data.message||data.error||'Could not move this expert.');
   if(data.session)onSessionUpdate?.(data.session);
   setMoveMessage(data.message||`${expertDisplayName(expert)} moved successfully.`);
  }catch(error:any){setMoveMessage(error.message||'Could not move this expert.')}
  finally{setMoving(null)}
 };

 return <>
  <div className="flex items-center justify-between gap-3">
   {heading&&<h2 className="text-2xl font-black text-white">Experts</h2>}
   <div className="ml-auto flex items-center gap-2"><span className="text-[10px] font-bold text-slate-500">SIF {formatCurrency(company.strategicInvestmentFund)}</span><button onClick={()=>setShowSpofHelp(true)} className="rounded-lg border border-amber-700/60 bg-amber-950/30 px-2 py-1 text-[10px] font-black text-amber-200"><AlertTriangle className="inline h-3 w-3 mr-1"/>SPOF?</button></div>
  </div>
  {moveMessage&&<div className="mt-3 rounded-xl border border-indigo-700 bg-indigo-950/30 px-3 py-2 text-xs font-bold text-indigo-100">{moveMessage}</div>}
  <div className="space-y-3 mt-3">{company.experts.map(e=>{
   const visible=e.domains.filter(d=>domains.includes(d.domain));
   const spof=e.spofDomains.filter(d=>domains.includes(d));
   const location=e.location==='HQ'?'Corporate HQ':company.sites.find(s=>s.id===e.location)?.name||e.location;
   const unavailable=Boolean(e.isVacant||busyStates.has(e.state));
   const status=e.isVacant?'Vacant':e.state;
   const destinations=activeSites.filter(site=>site.id!==e.location);
   const target=moveTargets[e.id]||destinations[0]?.id||'';
   return <div key={e.id} className={`w-full rounded-2xl border-2 p-4 transition ${unavailable?'border-slate-800 bg-slate-950/70':'border-violet-800 bg-violet-950/25'}`}>
    <button type="button" onClick={()=>!e.isVacant&&onSelectExpert?.(e)} className={`w-full text-left ${unavailable?'opacity-60':''}`}>
     <div className="flex items-start justify-between gap-3"><div><div className="text-base font-black text-white">{e.isVacant?'VACANT':expertDisplayName(e)}</div><div className="mt-1 text-xs text-slate-400">{location} · <span className={unavailable?'text-amber-300':'text-emerald-300'}>{status}</span></div></div>{spof.length>0&&<span className="rounded-full border border-rose-700 bg-rose-950 px-2 py-1 text-[10px] font-black text-rose-200">SPOF</span>}</div>
     <div className="mt-3 flex flex-wrap gap-3">{visible.map(d=><span key={d.domain} className="inline-flex items-center gap-2"><DomainBadge domain={d.domain}/><b className="text-lg text-white">{d.score}</b></span>)}{!visible.length&&<span className="text-xs font-bold text-slate-500">Replacement pending</span>}</div>
     {spof.length>0&&<div className="mt-2 flex items-center gap-1.5 text-[10px] font-bold text-rose-300"><span>Single point of failure:</span>{spof.map(d=><DomainBadge key={d} domain={d}/>)}</div>}
    </button>
    {!e.isVacant&&session&&<div className="mt-3 border-t border-slate-800 pt-3"><div className="mb-1.5 flex items-center justify-between gap-2"><div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide text-slate-500"><ArrowRightLeft className="h-3.5 w-3.5"/>Permanent move</div><div className="text-[10px] font-black text-amber-300">{formatCurrency(EXPERT_RELOCATION_COST_V1)} · no Action</div></div><div className="flex gap-2"><select value={target} onChange={event=>setMoveTargets(current=>({...current,[e.id]:event.target.value}))} disabled={!destinations.length||moving===e.id} className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-xs font-bold text-white disabled:opacity-50">{destinations.map(site=><option key={site.id} value={site.id}>{site.name}</option>)}</select><button type="button" onClick={()=>void moveExpert(e,target)} disabled={!target||moving===e.id||!relocationAvailable} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-black text-white disabled:bg-slate-800 disabled:text-slate-600">{moving===e.id?'MOVING…':'MOVE'}</button></div>{!relocationAvailable&&<div className="mt-1 text-[10px] font-bold text-rose-300">Needs {formatCurrency(EXPERT_RELOCATION_COST_V1)} SIF.</div>}<div className="mt-1 text-[10px] text-slate-500">Can be done at any time. The expert’s permanent base changes immediately.</div></div>}
   </div>})}</div>
  {showSpofHelp&&<div className="fixed inset-0 z-[220] grid place-items-center bg-black/65 p-4" onClick={()=>setShowSpofHelp(false)}><div className="w-full max-w-md rounded-2xl border border-amber-600 bg-slate-950 p-4 shadow-2xl" onClick={e=>e.stopPropagation()}><div className="flex items-start justify-between gap-3"><div><div className="text-[10px] uppercase tracking-wider text-amber-300 font-black">Knowledge risk</div><h3 className="text-lg font-black text-white">Single Point of Failure</h3></div><button onClick={()=>setShowSpofHelp(false)} className="rounded-lg border border-slate-700 p-1.5 text-slate-300"><X className="h-4 w-4"/></button></div><p className="mt-2 text-sm leading-relaxed text-slate-300">Any experts with this icon hold substantially more knowledge than the organisation can access without them. Reduce the gap through transfer, codification or training so they are less likely to resign from over-work.</p></div></div>}
 </>;
};
