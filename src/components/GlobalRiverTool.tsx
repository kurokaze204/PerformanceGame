import React, { useEffect, useMemo, useState } from 'react';
import { Waves } from 'lucide-react';
import type { KnowledgeDomain } from '../types/game.ts';
import type { GameSessionV2 } from '../types/gameV2.ts';
import { RiverDiagramOverlay } from './RiverDiagramOverlay.tsx';

export const GlobalRiverTool:React.FC=()=>{
 const [session,setSession]=useState<GameSessionV2|null>(null);
 const [open,setOpen]=useState(false);
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
 if(!session||!company)return null;
 const share=async(sourceSiteId:string,targetSiteId:string,domain:KnowledgeDomain)=>{
  const res=await fetch(`/api/sessions/${session.id}/action`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({companyId:company.id,actionType:'SITE_KNOWLEDGE_SHARING',params:{sourceSiteId,siteId:targetSiteId,domain}})});
  const data=await res.json();
  if(data.session)setSession(data.session);
  return{success:res.ok&&data.success!==false,message:data.message||data.error};
 };
 return <><button onClick={()=>setOpen(true)} className="fixed bottom-4 left-4 z-[125] rounded-xl border border-sky-500 bg-sky-950/95 px-4 py-2.5 text-xs font-black text-sky-100 shadow-xl flex items-center gap-2" aria-label="Open River Diagram"><Waves className="w-4 h-4"/>River Diagram</button>{open&&<RiverDiagramOverlay company={company} mode={session.experienceMode} phase={session.phase} onClose={()=>setOpen(false)} onShare={share}/>}</>;
};
