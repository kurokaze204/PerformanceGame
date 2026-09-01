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
export const BoardToolTabsV1:React.FC<Props>=({session,company,selectedSiteId,tool,onTool,onSelectSite,onSelectHQ,onSelectExpert})=>{if(session.phase!=='respond')return null;const domains=domainsForMode(session.experienceMode),site=company.sites.find(s=>s.id===selectedSiteId)||company.sites[0];return <aside className="relative z-40 flex shrink-0 self-stretch min-h-[560px] sm:min-h-[620px]">
 <nav className="flex w-[96px] sm:w-[116px] flex-col gap-2 pt-12" aria-label="Board tools">{tabs.map(([id,label,Icon])=><button key={id} onClick={()=>onTool(tool===id?null:id)} className={`min-h-16 rounded-l-2xl border-2 border-r-0 px-3 py-3 flex flex-col sm:flex-row items-center justify-center gap-2 text-base sm:text-lg font-black transition ${tool===id?'bg-violet-950 border-violet-300 text-white':'bg-[#10151f] border-slate-700 text-slate-100 hover:border-emerald-400'}`}><Icon className="w-5 h-5 shrink-0"/><span>{label}</span></button>)}</nav>
 {tool&&<div className="w-[min(440px,42vw)] min-w-[340px] bg-[#0b0f18] border-l-2 border-violet-500 overflow-y-auto p-5"><div className="flex justify-between items-center mb-4"><div className="text-sm uppercase tracking-[.18em] text-emerald-300 font-black">Board tool</div><button onClick={()=>onTool(null)} className="w-12 h-12 grid place-items-center rounded-xl border border-slate-700"><X className="w-6 h-6"/></button></div>
  {tool==='sites'&&<BoardSidePanelV2 session={session} company={company} selectedSiteId={selectedSiteId} isHQSelected={false} onSelectSite={onSelectSite} onSelectHQ={onSelectHQ}/>} 
  {tool==='experts'&&<div className="space-y-3"><h2 className="text-2xl font-black text-white">Experts</h2>{company.experts.map(e=><button key={e.id} onClick={()=>onSelectExpert?.(e)} className="w-full text-left rounded-2xl border-2 border-violet-800 bg-violet-950/25 p-4"><div className="text-lg font-black text-white">{e.isVacant?'VACANT':expertDisplayName(e)}</div><div className="flex flex-wrap gap-2 mt-3">{e.domains.filter(d=>domains.includes(d.domain)).map(d=><span key={d.domain} className="inline-flex gap-2 items-center"><DomainBadge domain={d.domain}/><b className="text-lg">{d.score}</b></span>)}</div></button>)}</div>}
  {tool==='hq'&&<div><h2 className="text-2xl font-black text-white">Corporate knowledge</h2><div className="space-y-3 mt-4">{domains.map(d=><div key={d} className="flex items-center justify-between rounded-2xl border-2 border-slate-800 p-4"><DomainBadge domain={d}/><b className="text-3xl text-emerald-300">{company.intranet[d]}</b></div>)}</div></div>}
  {tool==='score'&&<div><h2 className="text-2xl font-black text-white">Company position</h2><div className="grid grid-cols-2 gap-3 mt-4"><Stat label="Turnover" value={formatCurrency(company.turnover)}/><Stat label="Actions" value={String(company.actionsRemaining)}/><Stat label="Reputation" value={String(company.reputationPoints)}/><Stat label="Events" value={`${company.eventsDrawnCount}`}/></div>{site&&<div className="mt-5 text-base text-slate-400">Selected site: <b className="text-white">{site.name}</b></div>}</div>}
 </div>}
 </aside>};
const Stat:React.FC<{label:string;value:string}>=({label,value})=><div className="rounded-2xl border-2 border-slate-800 bg-slate-950 p-4"><div className="text-sm uppercase text-slate-500 font-black">{label}</div><div className="text-2xl font-black text-emerald-300">{value}</div></div>;
