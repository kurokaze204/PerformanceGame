import React, { useMemo, useState } from 'react';
import { ArrowRightLeft, BarChart3, Building2, MapPin, Users, X } from 'lucide-react';
import type { Expert, KnowledgeDomain } from '../types/game.ts';
import type { CompanyV2, GameSessionV2 } from '../types/gameV2.ts';
import { PROGRAMMED_FAILURE_TAG } from '../engine/eventProgressionV5.ts';
import { BoardSidePanelV2 } from './BoardSidePanelV2.tsx';
import { DomainBadge, domainsForMode } from './DomainBadge.tsx';
import { RiverDiagramOverlay } from './RiverDiagramOverlay.tsx';
import { expertDisplayName } from '../utils/expertDisplay.ts';
import { formatCurrency } from '../utils/format.ts';

type Tool='sites'|'experts'|'hq'|'score'|null;
interface Props{session:GameSessionV2;company:CompanyV2;selectedSiteId:string;tool:Tool;onTool:(tool:Tool)=>void;onSelectSite:(id:string)=>void;onSelectHQ:()=>void;onSelectExpert?:(expert:Expert)=>void;}
const tabs=[['sites','Sites',MapPin],['experts','Experts',Users],['hq','HQ',Building2],['score','Score',BarChart3]] as const;
const short=(text:string,max=100)=>text.length<=max?text:`${text.slice(0,max-1).trim()}…`;

export const InvestmentDecisionDockV1:React.FC<Props>=({session,company,selectedSiteId,tool,onTool,onSelectSite,onSelectHQ,onSelectExpert})=>{
 const [transferOpen,setTransferOpen]=useState(false);
 const domains=domainsForMode(session.experienceMode),site=company.sites.find(s=>s.id===selectedSiteId)||company.sites[0],delayed=company.delayedEvent;
 const transferUnlocked=useMemo(()=>session.experienceMode==='expert'||session.round>1||(session.activeEvents[company.id]||[]).some(event=>event.isResolved&&event.success===false&&event.card.tags?.includes(PROGRAMMED_FAILURE_TAG)),[session,company.id]);
 const share=async(sourceSiteId:string,targetSiteId:string,domain:KnowledgeDomain)=>{
  const res=await fetch(`/api/sessions/${session.id}/action`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({companyId:company.id,actionType:'SITE_KNOWLEDGE_SHARING',params:{sourceSiteId,siteId:targetSiteId,domain}})});
  const data=await res.json();
  return{success:res.ok&&data.success!==false,message:data.message||data.error};
 };
 return <>
 {transferOpen&&<RiverDiagramOverlay company={company} mode={session.experienceMode} phase={session.phase} onClose={()=>setTransferOpen(false)} onShare={share}/>} 
 <div className="fixed right-3 top-[104px] z-[145] hidden min-[1100px]:flex flex-col items-end gap-2" aria-label="Investment decision support">
  {delayed&&<div className="w-[420px] rounded-2xl border-[3px] border-violet-500 bg-[#0b0f18]/[0.99] p-3 shadow-2xl"><div className="flex items-center justify-between gap-3"><div className="text-[11px] font-black uppercase tracking-[.16em] text-violet-300">Delayed · first Event next round</div><div className="flex gap-1">{delayed.card.domains.slice(0,3).map(req=><DomainBadge key={req.domain} domain={req.domain}/>)}</div></div><div className="mt-2 text-base font-black leading-tight text-white">{short(delayed.card.title.replace(/^(LEARNING|MATERIAL|HIGH STAKES|CRITICAL):\s*/,''),64)}</div><p className="mt-1.5 text-xs leading-relaxed text-slate-400">{short(delayed.card.description,120)}</p></div>}
  <div className="flex items-start gap-2">
   {tool&&<aside className={`${delayed?'max-h-[calc(100vh-270px)]':'max-h-[calc(100vh-122px)]'} w-[420px] overflow-y-auto rounded-2xl border-2 border-violet-500 bg-[#0b0f18]/[0.99] p-4 shadow-2xl backdrop-blur-lg`}>
    <div className="sticky top-0 z-10 -mx-1 -mt-1 mb-4 flex items-center justify-between bg-[#0b0f18]/95 px-1 py-1 backdrop-blur-md"><div><div className="text-xs font-black uppercase tracking-[.16em] text-emerald-300">Decision support</div><div className="text-lg font-black text-white">{tool==='sites'?'Site capability':tool==='experts'?'Expert capability':tool==='hq'?'Corporate knowledge':'Company position'}</div></div><button onClick={()=>onTool(null)} className="grid h-10 w-10 place-items-center rounded-xl border-2 border-slate-700 hover:border-violet-400" aria-label="Close decision support"><X className="h-5 w-5"/></button></div>
    {tool==='sites'&&<BoardSidePanelV2 session={session} company={company} selectedSiteId={selectedSiteId} isHQSelected={false} onSelectSite={onSelectSite} onSelectHQ={onSelectHQ}/>} 
    {tool==='experts'&&<div className="space-y-3">{company.experts.map(e=>{const visible=e.domains.filter(d=>domains.includes(d.domain));return <button key={e.id} onClick={()=>onSelectExpert?.(e)} className="w-full rounded-2xl border-2 border-violet-800 bg-violet-950/25 p-4 text-left hover:border-violet-400"><div className="flex items-start justify-between gap-3"><div className="text-base font-black text-white">{e.isVacant?'VACANT':expertDisplayName(e)}</div>{e.isSPOF&&<span className="rounded-full border border-rose-700 bg-rose-950 px-2 py-1 text-[10px] font-black text-rose-200">SPOF</span>}</div><div className="mt-3 flex flex-wrap gap-3">{visible.map(d=><span key={d.domain} className="inline-flex items-center gap-2"><DomainBadge domain={d.domain}/><b className="text-lg text-white">{d.score}</b></span>)}{!visible.length&&<span className="text-xs font-bold text-amber-300">No Newbie-mode domain assigned</span>}</div><div className="mt-2 text-sm text-slate-400">{e.location==='HQ'?'Corporate HQ':company.sites.find(s=>s.id===e.location)?.name||e.location}</div></button>})}</div>}
    {tool==='hq'&&<div><p className="mb-4 text-sm leading-relaxed text-slate-400">Corporate knowledge is accessible across the organisation, subject to each site's ability to understand and apply it.</p><div className="space-y-3">{domains.map(d=><div key={d} className="flex items-center justify-between rounded-2xl border-2 border-slate-800 bg-slate-950 p-4"><DomainBadge domain={d}/><b className="text-3xl text-emerald-300">{company.intranet[d]}</b></div>)}</div></div>}
    {tool==='score'&&<div><div className="grid grid-cols-1 gap-3"><Stat label="Turnover" value={formatCurrency(company.turnover)}/><Stat label="Actions left" value={String(company.actionsRemaining)}/><Stat label="Reputation" value={String(company.reputationPoints)}/><Stat label="Events drawn" value={String(company.eventsDrawnCount)}/></div>{site&&<div className="mt-5 rounded-2xl border border-slate-700 bg-slate-950 p-4 text-sm text-slate-400">Selected site: <b className="text-white">{site.name}</b><div className="mt-1">Turnover: <b className="text-emerald-300">{formatCurrency(site.turnover)}</b></div></div>}</div>}
   </aside>}
   <div className="w-[82px] rounded-2xl border-2 border-violet-700 bg-[#0b0f18]/95 p-2 shadow-2xl backdrop-blur-md"><div className="pb-2 text-center text-[10px] font-black uppercase tracking-[.12em] text-emerald-300">Reference</div><nav className="flex flex-col gap-2" aria-label="Investment tools">{tabs.map(([id,label,Icon])=><button key={id} title={label} aria-label={label} onClick={()=>onTool(tool===id?null:id)} className={`min-h-14 rounded-xl border-2 px-1.5 py-2 flex flex-col items-center justify-center gap-1 text-[11px] font-black transition ${tool===id?'border-violet-300 bg-violet-950 text-white':'border-slate-700 bg-slate-950 text-slate-200 hover:border-emerald-400'}`}><Icon className="h-5 w-5"/><span>{label}</span></button>)}{transferUnlocked&&<button title="River diagram" aria-label="River diagram" onClick={()=>setTransferOpen(true)} className="min-h-14 rounded-xl border-2 border-slate-700 bg-slate-950 px-1 py-2 flex flex-col items-center justify-center gap-1 text-[10px] font-black text-slate-200 transition hover:border-emerald-400"><ArrowRightLeft className="h-5 w-5"/><span>River</span></button>}</nav></div>
  </div>
 </div>
 </>;
};
const Stat:React.FC<{label:string;value:string}>=({label,value})=><div className="rounded-2xl border-2 border-slate-800 bg-slate-950 p-4"><div className="text-xs font-black uppercase text-slate-500">{label}</div><div className="mt-1 text-2xl font-black text-emerald-300">{value}</div></div>;
