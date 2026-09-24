import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRightLeft, BarChart3, Building2, MapPin, Users, X } from 'lucide-react';
import type { Expert, KnowledgeDomain } from '../types/game.ts';
import type { CompanyV2, GameSessionV2 } from '../types/gameV2.ts';
import { PROGRAMMED_FAILURE_TAG } from '../engine/eventProgressionV5.ts';
import { BoardSidePanelV2 } from './BoardSidePanelV2.tsx';
import { ExpertReferenceList } from './ExpertReferenceList.tsx';
import { DomainBadge, domainsForMode } from './DomainBadge.tsx';
import { RiverDiagramOverlay } from './RiverDiagramOverlay.tsx';
import { AttritionModal } from './AttritionModal.tsx';
import { formatCurrency } from '../utils/format.ts';

type Tool='sites'|'experts'|'hq'|'score'|null;
type IntroStep='invest'|'river'|null;
type CompanyRoundPhase='events'|'investment'|'risk'|'waiting';
interface Props{session:GameSessionV2;company:CompanyV2;selectedSiteId:string;tool:Tool;onTool:(tool:Tool)=>void;onSelectSite:(id:string)=>void;onSelectHQ:()=>void;onSelectExpert?:(expert:Expert)=>void;chartsAvailable?:boolean;onOpenCharts?:()=>void;}
const tabs=[['sites','Sites',MapPin],['experts','Experts',Users],['hq','HQ',Building2],['score','Score',BarChart3]] as const;
const short=(text:string,max=100)=>text.length<=max?text:`${text.slice(0,max-1).trim()}…`;

export const InvestmentDecisionDockV1:React.FC<Props>=({session,company,selectedSiteId,tool,onTool,onSelectSite,onSelectHQ,onSelectExpert,chartsAvailable=false,onOpenCharts})=>{
 const [transferOpen,setTransferOpen]=useState(false);
 const [transitioning,setTransitioning]=useState(false);
 const [transitionError,setTransitionError]=useState('');
 const introKey=`tpg_first_invest_intro_${session.id}`;
 const [introStep,setIntroStep]=useState<IntroStep>(()=>{try{return localStorage.getItem(introKey)?null:'invest'}catch{return'invest'}});
 const companyRoundPhase=((company as any).roundPhase as CompanyRoundPhase|undefined)||'investment';
 const domains=domainsForMode(session.experienceMode),site=company.sites.find(s=>s.id===selectedSiteId)||company.sites[0],delayed=company.delayedEvent;
 const transferUnlocked=useMemo(()=>session.experienceMode==='expert'||session.round>1||(session.activeEvents[company.id]||[]).some(event=>event.isResolved&&event.success===false&&event.card.tags?.includes(PROGRAMMED_FAILURE_TAG)),[session,company.id]);

 const runRoundAction=async(type:'FINISH_INVESTING'|'FINISH_RISK')=>{
  if(transitioning)return;
  setTransitioning(true);setTransitionError('');
  try{
   const response=await fetch(`/api/sessions/${session.id}/action`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({companyId:company.id,actionType:type,params:{}})});
   const data=await response.json();
   if(!response.ok||data.success===false)throw new Error(data.message||data.error||'Could not advance your company.');
  }catch(error:any){setTransitionError(error.message||'Could not advance your company.');setTransitioning(false);}
 };

 useEffect(()=>{
  const visualPhase=companyRoundPhase==='risk'||companyRoundPhase==='waiting'?'risk':'investment';
  window.dispatchEvent(new CustomEvent('tpg-company-phase',{detail:{phase:visualPhase}}));
 },[companyRoundPhase]);

 useEffect(()=>{
  const interceptFinish=(event:MouseEvent)=>{
   if(companyRoundPhase!=='investment'||transitioning)return;
   const button=(event.target as HTMLElement|null)?.closest('button');
   const panel=button?.closest('[aria-label="Investment actions"]');
   if(!panel||!button?.textContent?.toLowerCase().includes('finish investing'))return;
   event.preventDefault();event.stopPropagation();
   void runRoundAction('FINISH_INVESTING');
  };
  document.addEventListener('click',interceptFinish,true);
  return()=>document.removeEventListener('click',interceptFinish,true);
 },[companyRoundPhase,transitioning,session.id,company.id]);

 useEffect(()=>{const openFromTransferCard=(event:MouseEvent)=>{const button=(event.target as HTMLElement|null)?.closest('button');const panel=button?.closest('[aria-label="Investment actions"]');if(panel&&button?.textContent?.includes('Knowledge Transfer')){event.preventDefault();setTransferOpen(true)}};document.addEventListener('click',openFromTransferCard,true);return()=>document.removeEventListener('click',openFromTransferCard,true)},[]);
 const share=async(sourceSiteId:string,targetSiteId:string,domain:KnowledgeDomain)=>{const res=await fetch(`/api/sessions/${session.id}/action`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({companyId:company.id,actionType:'SITE_KNOWLEDGE_SHARING',params:{sourceSiteId,siteId:targetSiteId,domain}})});const data=await res.json();return{success:res.ok&&data.success!==false,message:data.message||data.error};};
 const finishIntro=()=>{try{localStorage.setItem(introKey,'1')}catch{}setIntroStep(null);setTransferOpen(true)};

 if(companyRoundPhase==='risk'){
  const riskSession={...session,phase:'risk' as const};
  return <>
   <AttritionModal session={riskSession} company={company} phaseResult={{attritionSummaries:session.riskResults||{}}} onAdvanceToNextRound={()=>void runRoundAction('FINISH_RISK')}/>
   {transitionError&&<div className="fixed bottom-5 right-5 z-[260] rounded-xl bg-rose-100 px-4 py-3 text-sm font-bold text-rose-950">{transitionError}</div>}
  </>;
 }

 if(companyRoundPhase==='waiting'){
  const finished=session.companies.filter(candidate=>((candidate as any).roundPhase as CompanyRoundPhase|undefined)==='waiting').length;
  return <div className="fixed left-3 right-3 top-[94px] bottom-3 z-[150] grid place-items-center rounded-3xl border-2 border-indigo-700 bg-[#080b12]/[0.99] p-6 shadow-2xl"><div className="max-w-xl text-center"><div className="text-xs font-black uppercase tracking-[0.18em] text-indigo-300">Knowledge Risk complete</div><h2 className="mt-2 text-3xl font-black text-white">Waiting for the other companies</h2><p className="mt-3 text-base leading-relaxed text-slate-300">Your company has finished this round. The next Event round will begin for everyone when every company has completed its Knowledge Risk checks.</p><div className="mt-5 text-lg font-black text-emerald-300">{finished} / {session.companies.length} companies ready</div></div></div>;
 }

 return <>
 {introStep&&<div className="fixed inset-0 z-[190] grid place-items-center bg-black/75 p-5" role="dialog" aria-modal="true" aria-labelledby="invest-intro-title"><div className="w-full max-w-2xl rounded-3xl border-2 border-violet-500 bg-[#0b0f18] p-6 shadow-2xl">{introStep==='invest'?<><div className="text-xs font-black uppercase tracking-[.18em] text-emerald-300">Invest phase</div><h2 id="invest-intro-title" className="mt-2 text-3xl font-black text-white">Improve the company's knowledge capability</h2><p className="mt-4 text-base leading-relaxed text-slate-300">This phase is your opportunity to make the company better prepared for what comes next. Use your Actions to strengthen, move, preserve and extend knowledge across the organisation.</p><p className="mt-3 text-sm leading-relaxed text-slate-400">The aim is not simply to spend Actions. It is to improve the knowledge capability of the company where it will make the greatest difference.</p><button onClick={()=>setIntroStep('river')} className="mt-6 w-full rounded-xl bg-violet-600 py-3.5 text-sm font-black text-white">NEXT: UNDERSTAND THE RIVER</button></>:<><div className="text-xs font-black uppercase tracking-[.18em] text-emerald-300">The River diagram</div><h2 id="invest-intro-title" className="mt-2 text-3xl font-black text-white">See where knowledge is strong, weak or stranded</h2><p className="mt-4 text-base leading-relaxed text-slate-300">The River diagram gives you a whole-of-company view of knowledge capability across sites. It helps you see where capability is strongest, where it is weakest, and where useful knowledge already exists somewhere in the organisation but has not yet reached the places that need it.</p><p className="mt-3 text-sm leading-relaxed text-slate-400">Use it as a diagnostic before choosing your investments: look for gaps between sites, scarce expert knowledge and opportunities to transfer capability to where it will have the most value.</p><button onClick={finishIntro} className="mt-6 w-full rounded-xl bg-emerald-600 py-3.5 text-sm font-black text-white">OPEN THE RIVER</button></>}</div></div>}
 {transferOpen&&<RiverDiagramOverlay company={company} mode={session.experienceMode} phase={session.phase} totalActions={session.config.actions_per_round} onClose={()=>setTransferOpen(false)} onShare={share}/>} 
 <div className="fixed right-3 top-[104px] z-[145] hidden min-[1100px]:flex flex-col items-end gap-2" aria-label="Investment decision support">
  {delayed&&<div className="w-[420px] rounded-2xl border-[3px] border-violet-500 bg-[#0b0f18]/[0.99] p-3 shadow-2xl"><div className="flex items-center justify-between gap-3"><div className="text-[11px] font-black uppercase tracking-[.16em] text-violet-300">Delayed · first Event next round</div><div className="flex gap-1">{delayed.card.domains.slice(0,3).map(req=><DomainBadge key={req.domain} domain={req.domain}/>)}</div></div><div className="mt-2 text-base font-black leading-tight text-white">{short(delayed.card.title.replace(/^(LEARNING|MATERIAL|HIGH STAKES|CRITICAL):\s*/,''),64)}</div><p className="mt-1.5 text-xs leading-relaxed text-slate-400">{short(delayed.card.description,120)}</p></div>}
  <div className="flex items-start gap-2">{tool&&<aside className={`${delayed?'max-h-[calc(100vh-270px)]':'max-h-[calc(100vh-122px)]'} w-[420px] overflow-y-auto rounded-2xl border-2 border-violet-500 bg-[#0b0f18]/[0.99] p-4 shadow-2xl backdrop-blur-lg`}><div className="sticky top-0 z-10 -mx-1 -mt-1 mb-4 flex items-center justify-between bg-[#0b0f18]/95 px-1 py-1 backdrop-blur-md"><div><div className="text-xs font-black uppercase tracking-[.16em] text-emerald-300">Decision support</div><div className="text-lg font-black text-white">{tool==='sites'?'Site capability':tool==='experts'?'Expert capability':tool==='hq'?'Corporate knowledge':'Company position'}</div></div><button onClick={()=>onTool(null)} className="grid h-10 w-10 place-items-center rounded-xl border-2 border-slate-700 hover:border-violet-400"><X className="h-5 w-5"/></button></div>{tool==='sites'&&<BoardSidePanelV2 session={session} company={company} selectedSiteId={selectedSiteId} isHQSelected={false} onSelectSite={onSelectSite} onSelectHQ={onSelectHQ}/>} {tool==='experts'&&<ExpertReferenceList company={company} domains={domains} onSelectExpert={onSelectExpert}/>} {tool==='hq'&&<div><p className="mb-4 text-sm leading-relaxed text-slate-400">Corporate knowledge is accessible across the organisation, subject to each site's ability to understand and apply it.</p><div className="space-y-3">{domains.map(d=><div key={d} className="flex items-center justify-between rounded-2xl border-2 border-slate-800 bg-slate-950 p-4"><DomainBadge domain={d}/><b className="text-3xl text-emerald-300">{company.intranet[d]}</b></div>)}</div></div>}{tool==='score'&&<div><div className="grid grid-cols-1 gap-3"><Stat label="Turnover" value={formatCurrency(company.turnover)}/><Stat label="Actions left" value={String(company.actionsRemaining)}/><Stat label="Reputation" value={String(company.reputationPoints)}/><Stat label="Events drawn" value={String(company.eventsDrawnCount)}/></div>{site&&<div className="mt-5 rounded-2xl border border-slate-700 bg-slate-950 p-4 text-sm text-slate-400">Selected site: <b className="text-white">{site.name}</b><div className="mt-1">Turnover: <b className="text-emerald-300">{formatCurrency(site.turnover)}</b></div></div>}</div>}</aside>}
   <div className="w-[82px] rounded-2xl border-2 border-violet-700 bg-[#0b0f18]/95 p-2 shadow-2xl backdrop-blur-md"><div className="pb-2 text-center text-[10px] font-black uppercase tracking-[.12em] text-emerald-300">Reference</div><nav className="flex flex-col gap-2">{tabs.map(([id,label,Icon])=><button key={id} onClick={()=>onTool(tool===id?null:id)} className={`min-h-14 rounded-xl border-2 px-1.5 py-2 flex flex-col items-center justify-center gap-1 text-[11px] font-black ${tool===id?'border-violet-300 bg-violet-950 text-white':'border-slate-700 bg-slate-950 text-slate-200 hover:border-emerald-400'}`}><Icon className="h-5 w-5"/><span>{label}</span></button>)}{transferUnlocked&&<button onClick={()=>setTransferOpen(true)} className="min-h-14 rounded-xl border-2 border-slate-700 bg-slate-950 px-1 py-2 flex flex-col items-center justify-center gap-1 text-[10px] font-black text-slate-200 hover:border-emerald-400"><ArrowRightLeft className="h-5 w-5"/><span>River</span></button>}{chartsAvailable&&onOpenCharts&&<button onClick={onOpenCharts} className="min-h-14 rounded-xl border-2 border-slate-700 bg-slate-950 px-1 py-2 flex flex-col items-center justify-center gap-1 text-[10px] font-black text-slate-200 hover:border-emerald-400"><BarChart3 className="h-5 w-5"/><span>Charts</span></button>}</nav></div>
  </div>
 </div>
 {transitioning&&<div className="fixed bottom-5 right-5 z-[260] rounded-xl bg-white px-4 py-3 text-sm font-bold text-slate-950">Preparing Knowledge Risk…</div>}
 {transitionError&&<div className="fixed bottom-5 right-5 z-[260] rounded-xl bg-rose-100 px-4 py-3 text-sm font-bold text-rose-950">{transitionError}</div>}
 </>;
};
const Stat:React.FC<{label:string;value:string}>=({label,value})=><div className="rounded-2xl border-2 border-slate-800 bg-slate-950 p-4"><div className="text-xs font-black uppercase text-slate-500">{label}</div><div className="mt-1 text-2xl font-black text-emerald-300">{value}</div></div>;
