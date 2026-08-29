import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { BarChart3, BriefcaseBusiness, Waves } from 'lucide-react';
import type { KnowledgeDomain } from '../types/game.ts';
import type { GameSessionV2 } from '../types/gameV2.ts';
import { chartsUnlocked } from '../engine/experienceModeV3.ts';
import { CompanyChartsOverlay, captureRoundSnapshot, type RoundSnapshot } from './CompanyChartsOverlay.tsx';
import { RiverDiagramOverlay } from './RiverDiagramOverlay.tsx';

type BITab = 'river' | 'charts';

export const GlobalRiverTool:React.FC=()=>{
 const [session,setSession]=useState<GameSessionV2|null>(null);
 const [open,setOpen]=useState(false);
 const [tab,setTab]=useState<BITab>('river');
 const [portalTarget,setPortalTarget]=useState<HTMLElement|null>(null);
 const [snapshots,setSnapshots]=useState<RoundSnapshot[]>([]);
 const [sessionId,setSessionId]=useState<string|null>(()=>typeof window!=='undefined'?localStorage.getItem('tpg_session_id'):null);
 const [companyId,setCompanyId]=useState<string|null>(()=>typeof window!=='undefined'?localStorage.getItem('tpg_company_id'):null);

 useEffect(()=>{
  const sync=()=>{
   const nextSession=localStorage.getItem('tpg_session_id');
   const nextCompany=localStorage.getItem('tpg_company_id');
   setSessionId(current=>current===nextSession?current:nextSession);
   setCompanyId(current=>current===nextCompany?current:nextCompany);
  };
  sync();
  const timer=window.setInterval(sync,500);
  window.addEventListener('storage',sync);
  return()=>{window.clearInterval(timer);window.removeEventListener('storage',sync)};
 },[]);

 useEffect(()=>{
  if(!sessionId){setSession(null);return;}
  let cancelled=false;
  fetch(`/api/sessions/${sessionId}`).then(r=>r.ok?r.json():null).then(data=>{if(!cancelled&&data)setSession(data)}).catch(()=>undefined);
  const stream=new EventSource(`/api/sessions/${sessionId}/stream`);
  stream.onmessage=message=>{try{const data=JSON.parse(message.data);if(data.session&&!cancelled)setSession(data.session)}catch{}};
  return()=>{cancelled=true;stream.close()};
 },[sessionId]);

 const company=useMemo(()=>session?.companies.find(c=>c.id===companyId)||session?.companies[0],[session,companyId]);
 const chartsAvailable=Boolean(session&&chartsUnlocked(session.experienceMode,session.round));

 useEffect(()=>{
  if(!session||!company)return;
  const key=`tpg_chart_snapshots_${session.id}_${company.id}`;
  let history:RoundSnapshot[]=[];
  try{history=JSON.parse(localStorage.getItem(key)||'[]')}catch{}
  if(!history.some(s=>s.round===session.round)){
   history=[...history,captureRoundSnapshot(company,session.round)].sort((a,b)=>a.round-b.round);
   try{localStorage.setItem(key,JSON.stringify(history))}catch{}
  }
  setSnapshots(history);
 },[session?.id,session?.round,company?.id,company]);

 useEffect(()=>{
  if(!session)return;
  const locate=()=>{
   const phrase=`Round ${session.round} Turnover`;
   const candidates=Array.from(document.querySelectorAll('header div')).filter(el=>el.textContent?.includes(phrase));
   candidates.sort((a,b)=>(a.textContent?.length||9999)-(b.textContent?.length||9999));
   const turnoverBox=candidates[0] as HTMLElement|undefined;
   const target=turnoverBox?.parentElement as HTMLElement|null;
   setPortalTarget(target||null);
   if(target){
    Array.from(target.querySelectorAll('button')).forEach(button=>{
     const el=button as HTMLButtonElement;
     if(el.textContent?.trim()==='Charts')el.style.display='none';
    });
   }
  };
  locate();
  const observer=new MutationObserver(locate);
  observer.observe(document.body,{childList:true,subtree:true});
  return()=>observer.disconnect();
 },[session?.id,session?.round]);

 if(!session||!company)return null;

 const share=async(sourceSiteId:string,targetSiteId:string,domain:KnowledgeDomain)=>{
  const res=await fetch(`/api/sessions/${session.id}/action`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({companyId:company.id,actionType:'SITE_KNOWLEDGE_SHARING',params:{sourceSiteId,siteId:targetSiteId,domain}})});
  const data=await res.json();
  if(data.session)setSession(data.session);
  return{success:res.ok&&data.success!==false,message:data.message||data.error};
 };

 const openBI=()=>{if(tab==='charts'&&!chartsAvailable)setTab('river');setOpen(true)};
 const button=<button onClick={openBI} className="order-[-1] rounded-xl border border-sky-700 bg-sky-950/50 px-3 py-2 text-xs font-black text-sky-100 flex items-center gap-2" aria-label="Open Business Intelligence"><BriefcaseBusiness className="w-4 h-4"/>Business Intelligence</button>;

 return <>
  {portalTarget?createPortal(button,portalTarget):null}
  {open&&<>
   <div className="fixed top-[100px] left-1/2 -translate-x-1/2 z-[260] rounded-xl border border-slate-600 bg-slate-950/95 p-1 shadow-2xl flex gap-1" role="tablist" aria-label="Business Intelligence views">
    <button onClick={()=>setTab('river')} role="tab" aria-selected={tab==='river'} className={`rounded-lg px-4 py-2 text-xs font-black flex items-center gap-2 ${tab==='river'?'bg-sky-600 text-white':'text-slate-400 hover:text-white'}`}><Waves className="w-4 h-4"/>River Diagram</button>
    {chartsAvailable&&<button onClick={()=>setTab('charts')} role="tab" aria-selected={tab==='charts'} className={`rounded-lg px-4 py-2 text-xs font-black flex items-center gap-2 ${tab==='charts'?'bg-indigo-600 text-white':'text-slate-400 hover:text-white'}`}><BarChart3 className="w-4 h-4"/>Charts</button>}
   </div>
   {tab==='river'?<RiverDiagramOverlay company={company} mode={session.experienceMode} phase={session.phase} onClose={()=>setOpen(false)} onShare={share}/>:<CompanyChartsOverlay company={company} snapshots={snapshots} onClose={()=>setOpen(false)}/>} 
  </>}
 </>;
};
