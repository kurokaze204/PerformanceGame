import React from 'react';
import { BarChart3, Building2, MapPin, Users, X } from 'lucide-react';
import type { CompanyV2, GameSessionV2 } from '../types/gameV2.ts';
import type { Expert } from '../types/game.ts';
import { BoardSidePanelV2 } from './BoardSidePanelV2.tsx';
import { expertDisplayName } from '../utils/expertDisplay.ts';
import { DomainBadge, domainsForMode } from './DomainBadge.tsx';
import { formatCurrency } from '../utils/format.ts';

type Tool='sites'|'experts'|'hq'|'score'|null;
interface Props{session:GameSessionV2;company:CompanyV2;selectedSiteId:string;tool:Tool;onTool:(tool:Tool)=>void;onSelectSite:(id:string)=>void;onSelectHQ:()=>void;onSelectExpert?:(expert:Expert)=>void;}
const tabs=[['sites','Sites',MapPin],['experts','Experts',Users],['hq','HQ',Building2],['score','Score',BarChart3]] as const;
export const BoardToolTabsV1:React.FC<Props>=({session,company,selectedSiteId,tool,onTool,onSelectSite,onSelectHQ,onSelectExpert})=>{
 const domains=domainsForMode(session.experienceMode);const site=company.sites.find(s=>s.id===selectedSiteId)||company.sites[0];
 return <>
  <nav className="absolute right-0 top-16 z-40 flex flex-col gap-1" aria-label="Board tools">{tabs.map(([id,label,Icon])=><button key={id} onClick={()=>onTool(tool===id?null:id)} className={`min-h-11 rounded-l-xl border border-r-0 px-2.5 py-2 flex items-center gap-1.5 text-xs font-black ${tool===id?'bg-violet-950 border-violet-300 text-white':'bg-[#10151f]/95 border-slate-700 text-slate-300 hover:border-emerald-400'}`}><Icon className="w-4 h-4"/><span className="hidden sm:inline">{label}</span></button>)}</nav>
  {tool&&<div className="absolute right-0 top-0 bottom-0 z-35 w-[min(420px,88%)] bg-[#0b0f18]/[.985] border-l-2 border-violet-500 shadow-2xl overflow-y-auto p-4 pt-3"><div className="flex justify-between items-center mb-3"><div className="text-[10px] uppercase tracking-[.18em] text-emerald-300 font-black">Board tool</div><button onClick={()=>onTool(null)} className="w-11 h-11 grid place-items-center rounded-xl border border-slate-700"><X className="w-5 h-5"/></button></div>
   {tool==='sites'&&<BoardSidePanelV2 session={session} company={company} selectedSiteId={selectedSiteId} isHQSelected={false} onSelectSite={onSelectSite} onSelectHQ={onSelectHQ}/>} 
   {tool==='experts'&&<div className="space-y-2"><h2 className="text-xl font-black text-white">Experts</h2>{company.experts.map(e=><button key={e.id} onClick={()=>onSelectExpert?.(e)} className="w-full text-left rounded-xl border border-violet-800 bg-violet-950/25 p-3"><div className="font-black text-white">{e.isVacant?'VACANT':expertDisplayName(e)}</div><div className="flex gap-2 mt-2">{e.domains.filter(d=>domains.includes(d.domain)).map(d=><span key={d.domain} className="inline-flex gap-1 items-center"><DomainBadge domain={d.domain}/><b>{d.score}</b></span>)}</div></button>)}</div>}
   {tool==='hq'&&<div><h2 className="text-xl font-black text-white">Corporate knowledge</h2><div className="space-y-2 mt-3">{domains.map(d=><div key={d} className="flex items-center justify-between rounded-xl border border-slate-800 p-3"><DomainBadge domain={d}/><b className="text-xl text-emerald-300">{company.intranet[d]}</b></div>)}</div></div>}
   {tool==='score'&&<div><h2 className="text-xl font-black text-white">Company position</h2><div className="grid grid-cols-2 gap-3 mt-3"><Stat label="Turnover" value={formatCurrency(company.turnover)}/><Stat label="Actions" value={String(company.actionsRemaining)}/><Stat label="Reputation" value={String(company.reputationPoints)}/><Stat label="Events" value={`${company.eventsDrawnCount}`}/></div>{site&&<div className="mt-4 text-sm text-slate-400">Selected site: <b className="text-white">{site.name}</b></div>}</div>}
  </div>}
 </>;
};
const Stat:React.FC<{label:string;value:string}>=({label,value})=><div className="rounded-xl border border-slate-800 bg-slate-950 p-3"><div className="text-[10px] uppercase text-slate-500 font-black">{label}</div><div className="text-xl font-black text-emerald-300">{value}</div></div>;
