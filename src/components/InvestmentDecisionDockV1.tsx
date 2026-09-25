import React, { useEffect, useState } from 'react';
import { BarChart3, Building2, MapPin, Users, X } from 'lucide-react';
import type { Expert } from '../types/game.ts';
import type { CompanyV2, GameSessionV2 } from '../types/gameV2.ts';
import { BoardSidePanelV2 } from './BoardSidePanelV2.tsx';
import { ExpertReferenceList } from './ExpertReferenceList.tsx';
import { DomainBadge, domainsForMode } from './DomainBadge.tsx';
import { KnowledgeHubPanel } from './KnowledgeHubPanel.tsx';
import { ScorePanelV2 } from './ScorePanelV2.tsx';
import { AttritionModal } from './AttritionModal.tsx';

type Tool='sites'|'experts'|'hq'|'score'|null;
type IntroStep='invest'|'river'|null;
type CompanyRoundPhase='events'|'investment'|'risk'|'waiting';
interface Props{session:GameSessionV2;company:CompanyV2;selectedSiteId:string;tool:Tool;onTool:(tool:Tool)=>void;onSelectSite:(id:string)=>void;onSelectHQ:()=>void;onSelectExpert?:(expert:Expert)=>void;onOpenCharts?:()=>void;onSessionUpdate?:(session:GameSessionV2)=>void;}
const tabs=[['sites','Sites',MapPin],['experts','Experts',Users],['hq','HQ',Building2],['score','Score',BarChart3]] as const;
const short=(text:string,max=100)=>text.length<=max?text:`${text.slice(0,max-1).trim()}…`;

export const InvestmentDecisionDockV1:React.FC<Props>=({session,company,selectedSiteId,tool,onTool,onSelectSite,onSelectHQ,onSelectExpert,onOpenCharts,onSessionUpdate})=>{
 const [transitioning,setTransitioning]=useState(false);
 const [transitionError,setTransitionError]=useState('');
 const introKey=`tpg_first_invest_intro_${session.id}`;
 const [introStep,setIntroStep]=useState<IntroStep>(()=>{try{return localStorage.getItem(introKey)?null:'invest'}catch{return'invest'}});
 const companyRoundPhase=((company as any).roundPhase as CompanyRoundPhase|undefined)||'investment';
 const domains=domainsForMode(session.experienceMode),site=company.sites.find(s=>s.id===selectedSiteId)||company.sites[0],delayed=company.delayedEvent;

 const runRoundAction=async(type:'FINISH_INVESTING'|'FINISH_RISK')=>{
  if(transitioning)return;
  setTransitioning(true);setTransitionError('');
  try{
   const response=await fetch(`/api/sessions/${session.id}/action`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({companyId:company.id,actionType:type,params:{}})});
   const data=await response.json();
   if(!response.ok||data.success===false)throw new Error(data.message||data.error||'Could not advance your company.');
   if(data.session){
    onSessionUpdate?.(data.session);
   }else{
    const refresh=await fetch(`/api/sessions/${session.id}`);
    if(refresh.ok)onSessionUpdate?.(await refresh.json());
   }
   setTransitioning(false);
  }catch(error:any){
   setTransitionError(error.message||'Could not advance your company.');
   setTransitioning(false);
   try{
    const refresh=await fetch(`/api/sessions/${session.id}`);
    if(refresh.ok)onSessionUpdate?.(await refresh.json());
   }catch{}
  }
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

 const finishIntro=()=>{try{localStorage.setItem(introKey,'1')}catch{}setIntroStep(null)};

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
 {introStep&&<div className="fixed inset-0 z-[190] grid place-items-center bg-black/75 p-5" role="dialog" aria-modal="true" aria-labelledby="invest-intro-title"><div className="w-full max-w-xl rounded-3xl border-2 border-violet-500 bg-[#0b0f18] p-6 shadow-2xl">{introStep==='invest'?<><div className="text-xs font-black uppercase tracking-[.18em] text-emerald-300">Invest phase</div><h2 id="invest-intro-title" className="mt-2 text-3xl font-black text-white">Build the knowledge you will need.</h2><p className="mt-3 text-base text-slate-300">You have a limited number of Actions. Choose where they will make the biggest difference.</p><button onClick={()=>setIntroStep('river')} className="mt-5 w-full rounded-xl bg-violet-600 py-3.5 text-sm font-black text-white">SHOW ME HOW</button></>:<><div className="text-xs font-black uppercase tracking-[.18em] text-emerald-300">Knowledge River</div><h2 id="invest-intro-title" className="mt-2 text-3xl font-black text-white">See the gap. Choose an investment.</h2><p className="mt-3 text-base text-slate-300">The River stays visible while you invest. Your selections will light up the knowledge they affect.</p><button onClick={finishIntro} className="mt-5 w-full rounded-xl bg-emerald-600 py-3.5 text-sm font-black text-white">START INVESTING</button></>}</div></div>}
 <div className="fixed right-3 top-[104px] z-[145] hidden min-[1100px]:flex flex-col items-end gap-2" aria-label="Investment decision support">
  {delayed&&<div className="w-[420px] rounded-2xl border-[3px] border-violet-500 bg-[#0b0f18]/[0.99] p-3 shadow-2xl"><div className="flex items-center justify-between gap-3"><div className="text-[11px] font-black uppercase tracking-[.16em] text-violet-300">Delayed · first Event next round</div><div className="flex gap-1">{delayed.card.domains.slice(0,3).map(req=><DomainBadge key={req.domain} domain={req.domain}/>)}</div></div><div className="mt-2 text-base font-black leading-tight text-white">{short(delayed.card.title.replace(/^(LEARNING|MATERIAL|HIGH STAKES|CRITICAL):\s*/,''),64)}</div><p className="mt-1.5 text-xs leading-relaxed text-slate-400">{short(delayed.card.description,120)}</p></div>}
  <div className="flex items-start gap-2">{tool&&<aside className={`${delayed?'max-h-[calc(100vh-270px)]':'max-h-[calc(100vh-122px)]'} w-[420px] overflow-y-auto rounded-2xl border-2 border-violet-500 bg-[#0b0f18]/[0.99] p-4 shadow-2xl backdrop-blur-lg`}><div className="sticky top-0 z-10 -mx-1 -mt-1 mb-4 flex items-center justify-between bg-[#0b0f18]/95 px-1 py-1 backdrop-blur-md"><div><div className="text-xs font-black uppercase tracking-[.16em] text-emerald-300">Decision support</div><div className="text-lg font-black text-white">{tool==='sites'?'Site capability':tool==='experts'?'Expert capability':tool==='hq'?'Corporate knowledge':'Company position'}</div></div><button onClick={()=>onTool(null)} className="tpg-close-button"><X className="h-5 w-5"/></button></div>{tool==='sites'&&<BoardSidePanelV2 session={session} company={company} selectedSiteId={selectedSiteId} isHQSelected={false} onSelectSite={onSelectSite} onSelectHQ={onSelectHQ}/>} {tool==='experts'&&<ExpertReferenceList company={company} domains={domains} onSelectExpert={onSelectExpert}/>} {tool==='hq'&&<KnowledgeHubPanel company={company} experienceMode={session.experienceMode}/>}{tool==='score'&&<ScorePanelV2 session={session} company={company} selectedSiteName={site?.name} onOpenCharts={onOpenCharts}/>}</aside>}
   <div className="w-[82px] rounded-2xl border-2 border-violet-700 bg-[#0b0f18]/95 p-2 shadow-2xl backdrop-blur-md"><div className="pb-2 text-center text-[10px] font-black uppercase tracking-[.12em] text-emerald-300">Reference</div><nav className="flex flex-col gap-2">{tabs.map(([id,label,Icon])=><button key={id} onClick={()=>onTool(tool===id?null:id)} className={`tpg-tool-button ${tool===id?'tpg-tool-button-active':''}`}><Icon className="h-5 w-5"/><span>{label}</span></button>)}</nav></div>
  </div>
 </div>
 {transitioning&&<div className="fixed bottom-5 right-5 z-[260] rounded-xl bg-white px-4 py-3 text-sm font-bold text-slate-950">Preparing Knowledge Risk…</div>}
 {transitionError&&<div className="fixed bottom-5 right-5 z-[260] rounded-xl bg-rose-100 px-4 py-3 text-sm font-bold text-rose-950">{transitionError}</div>}
 </>;
};
