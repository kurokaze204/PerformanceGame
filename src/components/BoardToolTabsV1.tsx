import React from'react';
import { BarChart3, Building2, MapPin, Users, X } from 'lucide-react';
import type { CompanyV2, GameSessionV2 } from '../types/gameV2.ts';
import type { Expert } from '../types/game.ts';
import { BoardSidePanelV2 } from './BoardSidePanelV2.tsx';
import { ExpertReferenceList } from './ExpertReferenceList.tsx';
import { domainsForMode } from './DomainBadge.tsx';
import { KnowledgeHubPanel } from './KnowledgeHubPanel.tsx';
import { ScorePanelV2 } from './ScorePanelV2.tsx';

type Tool='sites'|'experts'|'hq'|'score'|null;
interface Props{session:GameSessionV2;company:CompanyV2;participantId?:string;readOnly?:boolean;selectedSiteId:string;isHQSelected:boolean;tool:Tool;onTool:(tool:Tool)=>void;onSelectSite:(id:string)=>void;onSelectHQ:()=>void;onSelectExpert?:(expert:Expert)=>void;onOpenCharts?:()=>void;onSessionUpdate?:(session:GameSessionV2)=>void;}
const tabs=[['sites','Sites',MapPin],['experts','Experts',Users],['hq','HQ',Building2],['score','Score',BarChart3]] as const;
export const BoardToolTabsV1:React.FC<Props>=({session,company,participantId,readOnly=false,selectedSiteId,isHQSelected,tool,onTool,onSelectSite,onSelectHQ,onSelectExpert,onOpenCharts,onSessionUpdate})=>{
 const companyRoundPhase=company.roundPhase||'events'; if(companyRoundPhase!=='events')return null;
 const domains=domainsForMode(session.experienceMode),site=company.sites.find(s=>s.id===selectedSiteId)||company.sites[0];
 return <>
 <aside className="relative z-40 flex shrink-0 self-stretch h-full min-h-0">
 <nav className="flex w-[78px] sm:w-[88px] flex-col gap-1.5 pt-8" aria-label="Board tools">{tabs.map(([id,label,Icon])=><button key={id} onClick={()=>onTool(tool===id?null:id)} className={`tpg-tool-button !rounded-r-none !border-r-0 ${tool===id?'tpg-tool-button-active':''}`}><Icon className="w-5 h-5 shrink-0"/><span>{label}</span></button>)}</nav>
 {tool&&<div className="w-[min(400px,42vw)] min-w-[300px] bg-[#0b0f18] border-l-2 border-violet-500 overflow-y-auto p-4"><div className="flex justify-between items-center mb-4"><div className="text-xs uppercase tracking-[.18em] text-emerald-300 font-black">Board tool</div><button onClick={()=>onTool(null)} className="tpg-close-button"><X className="w-5 h-5"/></button></div>
  {tool==='sites'&&<BoardSidePanelV2 session={session} company={company} selectedSiteId={selectedSiteId} isHQSelected={isHQSelected} onSelectSite={onSelectSite} onSelectHQ={onSelectHQ}/>} 
  {tool==='experts'&&<ExpertReferenceList session={session} company={company} participantId={participantId} readOnly={readOnly} domains={domains} onSelectExpert={onSelectExpert} onSessionUpdate={onSessionUpdate} heading/>}
  {tool==='hq'&&<KnowledgeHubPanel company={company} experienceMode={session.experienceMode}/>}
  {tool==='score'&&<ScorePanelV2 session={session} company={company} selectedSiteName={site?.name} onOpenCharts={onOpenCharts}/>}
 </div>}
 </aside></>};
