import React from 'react';
import { BarChart3, Building2, MapPin, Users, X } from 'lucide-react';
import type { Expert } from '../types/game.ts';
import type { CompanyV2, GameSessionV2 } from '../types/gameV2.ts';
import { BoardSidePanelV2 } from './BoardSidePanelV2.tsx';
import { DomainBadge, domainsForMode } from './DomainBadge.tsx';
import { expertDisplayName } from '../utils/expertDisplay.ts';
import { formatCurrency } from '../utils/format.ts';

type Tool='sites'|'experts'|'hq'|'score'|null;
interface Props{
  session:GameSessionV2;
  company:CompanyV2;
  selectedSiteId:string;
  tool:Tool;
  onTool:(tool:Tool)=>void;
  onSelectSite:(id:string)=>void;
  onSelectHQ:()=>void;
  onSelectExpert?:(expert:Expert)=>void;
}
const tabs=[['sites','Sites',MapPin],['experts','Experts',Users],['hq','HQ',Building2],['score','Score',BarChart3]] as const;

export const InvestmentDecisionDockV1:React.FC<Props>=({session,company,selectedSiteId,tool,onTool,onSelectSite,onSelectHQ,onSelectExpert})=>{
  const domains=domainsForMode(session.experienceMode);
  const site=company.sites.find(s=>s.id===selectedSiteId)||company.sites[0];
  return <div className="fixed right-3 top-[172px] z-[145] flex items-start gap-2" aria-label="Investment decision support">
    {tool&&<aside className="max-h-[calc(100vh-190px)] w-[min(500px,calc(100vw-100px))] overflow-y-auto rounded-2xl border-2 border-violet-500 bg-[#0b0f18]/[0.99] p-5 shadow-2xl backdrop-blur-lg">
      <div className="sticky top-0 z-10 -mx-1 -mt-1 mb-4 flex items-center justify-between bg-[#0b0f18]/95 px-1 py-1 backdrop-blur-md"><div><div className="text-xs font-black uppercase tracking-[.16em] text-emerald-300">Decision support</div><div className="text-xl font-black text-white">{tool==='sites'?'Site capability':tool==='experts'?'Expert capability':tool==='hq'?'Corporate knowledge':'Company position'}</div></div><button onClick={()=>onTool(null)} className="grid h-11 w-11 place-items-center rounded-xl border-2 border-slate-700 hover:border-violet-400" aria-label="Close decision support"><X className="h-5 w-5"/></button></div>
      {tool==='sites'&&<BoardSidePanelV2 session={session} company={company} selectedSiteId={selectedSiteId} isHQSelected={false} onSelectSite={onSelectSite} onSelectHQ={onSelectHQ}/>} 
      {tool==='experts'&&<div className="space-y-3">{company.experts.map(e=><button key={e.id} onClick={()=>onSelectExpert?.(e)} className="w-full rounded-2xl border-2 border-violet-800 bg-violet-950/25 p-4 text-left hover:border-violet-400"><div className="flex items-start justify-between gap-3"><div className="text-lg font-black text-white">{e.isVacant?'VACANT':expertDisplayName(e)}</div>{e.isSPOF&&<span className="rounded-full border border-rose-700 bg-rose-950 px-2 py-1 text-xs font-black text-rose-200">SPOF</span>}</div><div className="mt-3 flex flex-wrap gap-3">{e.domains.filter(d=>domains.includes(d.domain)).map(d=><span key={d.domain} className="inline-flex items-center gap-2"><DomainBadge domain={d.domain}/><b className="text-xl text-white">{d.score}</b></span>)}</div><div className="mt-2 text-sm text-slate-400">{e.location==='HQ'?'Corporate HQ':company.sites.find(s=>s.id===e.location)?.name||e.location}</div></button>)}</div>}
      {tool==='hq'&&<div><p className="mb-4 text-sm leading-relaxed text-slate-400">Corporate knowledge is accessible across the organisation, subject to each site's ability to understand and apply it.</p><div className="space-y-3">{domains.map(d=><div key={d} className="flex items-center justify-between rounded-2xl border-2 border-slate-800 bg-slate-950 p-4"><DomainBadge domain={d}/><b className="text-3xl text-emerald-300">{company.intranet[d]}</b></div>)}</div></div>}
      {tool==='score'&&<div><div className="grid grid-cols-2 gap-3"><Stat label="Turnover" value={formatCurrency(company.turnover)}/><Stat label="Actions left" value={String(company.actionsRemaining)}/><Stat label="Reputation" value={String(company.reputationPoints)}/><Stat label="Events drawn" value={String(company.eventsDrawnCount)}/></div>{site&&<div className="mt-5 rounded-2xl border border-slate-700 bg-slate-950 p-4 text-base text-slate-400">Selected site: <b className="text-white">{site.name}</b><div className="mt-1">Turnover: <b className="text-emerald-300">{formatCurrency(site.turnover)}</b></div></div>}</div>}
    </aside>}
    <div className="w-[74px] rounded-2xl border-2 border-violet-700 bg-[#0b0f18]/95 p-2 shadow-2xl backdrop-blur-md">
      <div className="pb-2 text-center text-[10px] font-black uppercase tracking-[.12em] text-emerald-300">Reference</div>
      <nav className="flex flex-col gap-2" aria-label="Investment tools">
        {tabs.map(([id,label,Icon])=><button key={id} title={label} aria-label={label} onClick={()=>onTool(tool===id?null:id)} className={`min-h-14 rounded-xl border-2 px-1.5 py-2 flex flex-col items-center justify-center gap-1 text-[11px] font-black transition ${tool===id?'border-violet-300 bg-violet-950 text-white':'border-slate-700 bg-slate-950 text-slate-200 hover:border-emerald-400'}`}><Icon className="h-5 w-5"/><span>{label}</span></button>)}
      </nav>
    </div>
  </div>;
};

const Stat:React.FC<{label:string;value:string}>=({label,value})=><div className="rounded-2xl border-2 border-slate-800 bg-slate-950 p-4"><div className="text-xs font-black uppercase text-slate-500">{label}</div><div className="mt-1 text-2xl font-black text-emerald-300">{value}</div></div>;
