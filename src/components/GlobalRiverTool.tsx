import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRightLeft } from 'lucide-react';
import type { KnowledgeDomain } from '../types/game.ts';
import type { GameSessionV2 } from '../types/gameV2.ts';
import { PROGRAMMED_FAILURE_TAG } from '../engine/eventProgressionV5.ts';
import { RiverDiagramOverlay } from './RiverDiagramOverlay.tsx';

export const GlobalRiverTool:React.FC=()=>{
 const [session,setSession]=useState<GameSessionV2|null>(null);
 const [open,setOpen]=useState(false);
 const [portalTarget,setPortalTarget]=useState<HTMLElement|null>(null);
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
 const transferUnlocked=useMemo(()=>{
  if(!session||!company)return false;
  if(session.experienceMode==='expert'||session.round>1)return true;
  return (session.activeEvents[company.id]||[]).some(event=>event.isResolved&&event.success===false&&event.card.tags?.includes(PROGRAMMED_FAILURE_TAG));
 },[session,company]);

 useEffect(()=>{
  if(!session)return;
  const locate=()=>{
   const phrase=`Round ${session.round} Turnover`;
   const candidates=Array.from(document.querySelectorAll('header div')).filter(el=>el.textContent?.includes(phrase));
   candidates.sort((a,b)=>(a.textContent?.length||9999)-(b.textContent?.length||9999));
   const turnoverBox=candidates[0] as HTMLElement|undefined;
   setPortalTarget((turnoverBox?.parentElement as HTMLElement|null)||null);
  };
  locate();
  const observer=new MutationObserver(locate);
  observer.observe(document.body,{childList:true,subtree:true});
  return()=>observer.disconnect();
 },[session?.id,session?.round]);

 if(!session||!company||!transferUnlocked)return null;

 const share=async(sourceSiteId:string,targetSiteId:string,domain:KnowledgeDomain)=>{
  const res=await fetch(`/api/sessions/${session.id}/action`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({companyId:company.id,actionType:'SITE_KNOWLEDGE_SHARING',params:{sourceSiteId,siteId:targetSiteId,domain}})});
  const data=await res.json();
  if(data.session)setSession(data.session);
  return{success:res.ok&&data.success!==false,message:data.message||data.error};
 };

 const button=<button onClick={()=>setOpen(true)} className="order-[-1] rounded-xl border border-emerald-700 bg-emerald-950/50 px-3 py-2 text-xs font-black text-emerald-100 flex items-center gap-2" aria-label="Open Knowledge Transfer"><ArrowRightLeft className="w-4 h-4"/>Knowledge Transfer</button>;

 return <>
  {portalTarget?createPortal(button,portalTarget):null}
  {open&&<RiverDiagramOverlay company={company} mode={session.experienceMode} phase={session.phase} onClose={()=>setOpen(false)} onShare={share}/>} 
 </>;
};
