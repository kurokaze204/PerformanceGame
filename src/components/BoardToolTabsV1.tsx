import React,{useMemo,useState}from'react';
import { ArrowRightLeft, BarChart3, Building2, MapPin, Users, X } from 'lucide-react';
import type { CompanyV2, GameSessionV2 } from '../types/gameV2.ts';
import type { Expert,KnowledgeDomain } from '../types/game.ts';
import { BoardSidePanelV2 } from './BoardSidePanelV2.tsx';
import { InvestmentDecisionDockV1 } from './InvestmentDecisionDockV1.tsx';
import { ExpertReferenceList } from './ExpertReferenceList.tsx';
import { DomainBadge, domainsForMode } from './DomainBadge.tsx';
import { RiverDiagramOverlay } from './RiverDiagramOverlay.tsx';
import { PROGRAMMED_FAILURE_TAG } from '../engine/eventProgressionV5.ts';
import { formatCurrency } from '../utils/format.ts';

type Tool='sites'|'experts'|'hq'|'score'|null;
interface Props{session:GameSessionV2;company:CompanyV2;selectedSiteId:string;tool:Tool;onTool:(tool:Tool)=>void;onSelectSite:(id:string)=>void;onSelectHQ:()=>void;onSelectExpert?:(expert:Expert)=>void;chartsAvailable?:boolean;onOpenCharts?:()=>void;}
const tabs=[['sites','Sites',MapPin],['experts','Experts',Users],['hq','HQ',Building2],['score','Score',BarChart3]] as const;
export const BoardToolTabsV1:React.FC<Props>=({session,company,selectedSiteId,tool,onTool,onSelectSite,onSelectHQ,onSelectExpert,chartsAvailable=false,onOpenCharts})=>{
 const [riverOpen,setRiverOpen]=useState(false);
 const transferUnlocked=useMemo(()=>session.experienceMode==='expert'||session.round>1||(session.activeEvents[company.id]||[]).some(event=>event.isResolved&&event.success===false&&event.card.tags?.includes(PROGRAMMED_FAILURE_TAG)),[session,company.id]);
 const share=async(sourceSiteId:string,targetSiteId:string,domain:KnowledgeDomain)=>{const res=await fetch(`/api/sessions/${session.id}/action`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({companyId:company.id,actionType:'SITE_KNOWLEDGE_SHARING',params:{sourceSiteId,siteId:targetSiteId,domain}})});const data=await res.json();return{success:res.ok&&data.success!==false,message:data.message||data.error}};
 if(session.phase==='investment')return <InvestmentDecisionDockV1 session={session} company={company} selectedSiteId={selectedSiteId} tool={tool} onTool={onTool} onSelectSite={onSelectSite} onSelectHQ={onSelectHQ} onSelectExpert={onSelectExpert} chartsAvailable={chartsAvailable} onOpenCharts={onOpenCharts}/>;
 if(session.phase!=='respond')return null;
 const domains=domainsForMode(session.experienceMode),site=company.sites.find(s=>s.id===selectedSiteId)||company.sites[0];
 return <>
 {riverOpen&&<RiverDiagramOverlay company={company} mode={session.experienceMode} phase={session.phase} onClose={()=>setRiverOpen(false)} onShare={share}/>} 
 <aside className="relative z-40 flex shrink-0 self-stretch h-full min-h-0">
 <nav className="flex w-[78px] sm:w-[88px] flex-col gap-1.5 pt-8" aria-label="Board tools">{tabs.map(([id,label,Icon])=><button key={id} onClick={()=>onTool(tool===id?null:id)} className={`min-h-14 rounded-l-xl border-2 border-r-0 px-1.5 py-2 flex flex-col items-center justify-center gap-1 text-xs font-black transition ${tool===id?'bg-violet-950 border-violet-300 text-white':'bg-[#10151f] border-slate-700 text-slate-100 hover:border-emerald-400'}`}><Icon className="w-5 h-5 shrink-0"/><span>{label}</span></button>)}{transferUnlocked&&<button onClick={()=>setRiverOpen(true)} className="min-h-14 rounded-l-xl border-2 border-r-0 border-slate-700 bg-[#10151f] px-1.5 py-2 flex flex-col items-center justify-center gap-1 text-xs font-black text-slate-100 hover:border-emerald-400"><ArrowRightLeft className="w-5 h-5"/><span>River</span></button>}{chartsAvailable&&onOpenCharts&&<button onClick={onOpenCharts} className="min-h-14 rounded-l-xl border-2 border-r-0 border-slate-700 bg-[#10151f] px-1.5 py-2 flex flex-col items-center justify-center gap-1 text-xs font-black text-slate-100 hover:border-emerald-400"><BarChart3 className="w-5 h-5"/><span>Charts</span></button>}</nav>
 {tool&&<div className="w-[min(400px,42vw)] min-w-[300px] bg-[#0b0f18] border-l-2 border-violet-500 overflow-y-auto p-4"><div className="flex justify-between items-center mb-4"><div className="text-xs uppercase tracking-[.18em] text-emerald-300 font-black">Board tool</div><button onClick={()=>onTool(null)} className="w-10 h-10 grid place-items-center rounded-xl border border-slate-700"><X className="w-5 h-5"/></button></div>
  {tool==='sites'&&<BoardSidePanelV2 session={session} company={company} selectedSiteId={selectedSiteId} isHQSelected={false} onSelectSite={onSelectSite} onSelectHQ={onSelectHQ}/>} 
  {tool==='experts'&&<ExpertReferenceList company={company} domains={domains} onSelectExpert={onSelectExpert} heading/>}
  {tool==='hq'&&<div><h2 className="text-xl font-black text-white">Corporate knowledge</h2><div className="space-y-2 mt-3">{domains.map(d=><div key={d} className="flex items-center justify-between rounded-xl border-2 border-slate-800 p-3"><DomainBadge domain={d}/><b className="text-2xl text-emerald-300">{company.intranet[d]}</b></div>)}</div></div>}
  {tool==='score'&&<div><h2 className="text-xl font-black text-white">Company position</h2><div className="grid grid-cols-2 gap-2 mt-3"><Stat label="Turnover" value={formatCurrency(company.turnover)}/><Stat label="Actions" value={String(company.actionsRemaining)}/><Stat label="Reputation" value={String(company.reputationPoints)}/><Stat label="Events" value={`${company.eventsDrawnCount}`}/></div>{site&&<div className="mt-4 text-sm text-slate-400">Selected site: <b className="text-white">{site.name}</b></div>}</div>}
 </div>}
 </aside></>};
const Stat:React.FC<{label:string;value:string}>=({label,value})=><div className="rounded-xl border-2 border-slate-800 bg-slate-950 p-3"><div className="text-xs uppercase text-slate-500 font-black">{label}</div><div className="text-xl font-black text-emerald-300">{value}</div></div>;
