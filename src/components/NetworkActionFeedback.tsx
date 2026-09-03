import React,{useEffect,useState}from'react';

export const NetworkActionFeedback:React.FC=()=>{
 const [busy,setBusy]=useState(0);
 useEffect(()=>{
  const original=window.fetch.bind(window);
  const pending=new Map<string,Promise<Response>>();
  const keyFor=(input:RequestInfo|URL,init?:RequestInit)=>{
   const url=typeof input==='string'?input:input instanceof URL?input.toString():input.url;
   const method=String(init?.method||(input instanceof Request?input.method:'GET')).toUpperCase();
   const body=typeof init?.body==='string'?init.body:'';
   return `${method}|${url}|${body}`;
  };
  const wrapped:typeof window.fetch=async(input,init)=>{
   const method=String(init?.method||(input instanceof Request?input.method:'GET')).toUpperCase();
   if(['GET','HEAD','OPTIONS'].includes(method))return original(input,init);
   const key=keyFor(input,init);
   const existing=pending.get(key);
   if(existing)return (await existing).clone();
   setBusy(v=>v+1);
   const request=original(input,init);
   pending.set(key,request);
   try{return (await request).clone();}
   finally{pending.delete(key);setBusy(v=>Math.max(0,v-1));}
  };
  window.fetch=wrapped;
  const acknowledge=(event:PointerEvent)=>{
   const el=(event.target as HTMLElement|null)?.closest('button,[role="button"]') as HTMLElement|null;
   if(!el||el.getAttribute('aria-disabled')==='true'||(el as HTMLButtonElement).disabled)return;
   el.classList.add('tpg-click-ack');
   window.setTimeout(()=>el.classList.remove('tpg-click-ack'),320);
  };
  window.addEventListener('pointerdown',acknowledge,true);
  return()=>{window.fetch=original;window.removeEventListener('pointerdown',acknowledge,true)};
 },[]);
 if(!busy)return null;
 return <div className="fixed top-[calc(var(--tpg-header-height,88px)+8px)] left-1/2 -translate-x-1/2 z-[300] pointer-events-none rounded-full border border-emerald-600/70 bg-slate-950/95 px-3 py-1.5 text-xs font-black text-emerald-200 shadow-lg" role="status" aria-live="polite"><span className="inline-block mr-2 h-2 w-2 rounded-full bg-emerald-400 animate-pulse"/>Working…</div>;
};
