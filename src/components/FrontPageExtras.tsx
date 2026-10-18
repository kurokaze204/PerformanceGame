import React,{useEffect,useState}from'react';
import{Coffee,ExternalLink,ShieldCheck,X}from'lucide-react';

export const FrontPageExtras:React.FC=()=>{
 const[visible,setVisible]=useState(false);
 const[expanded,setExpanded]=useState(false);
 useEffect(()=>{
  const check=()=>setVisible(Boolean(document.querySelector('[aria-labelledby="join-title"]')));
  check();
  const observer=new MutationObserver(check);
  observer.observe(document.body,{childList:true,subtree:true});
  return()=>observer.disconnect();
 },[]);
 if(!visible)return null;
 // A large floating card used to cover the right-hand How to Play instructions.
 // Keep support accessible without intercepting clicks on guide steps 2 and 4.
 if(!expanded)return <button type="button" aria-label="Support The Performance Gap" title="Buy me a Coffee" onClick={()=>setExpanded(true)} className="fixed z-[270] right-4 bottom-4 sm:right-6 sm:bottom-6 grid h-12 w-12 place-items-center rounded-full border-2 border-emerald-700 bg-slate-950 text-emerald-300 shadow-xl hover:border-emerald-400"><Coffee className="h-6 w-6"/></button>;
 return <div className="fixed z-[270] right-4 bottom-4 sm:right-6 sm:bottom-6 w-[min(310px,calc(100vw-2rem))] rounded-2xl border border-emerald-800 bg-slate-950/95 p-4 shadow-2xl backdrop-blur">
  <button type="button" aria-label="Close support panel" onClick={()=>setExpanded(false)} className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-lg border border-slate-700 bg-slate-900 text-slate-300 hover:text-white"><X className="h-4 w-4"/></button>
  <a href="https://ko-fi.com/deltaknowledge" target="_blank" rel="noreferrer" className="block text-center group">
   <div className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-emerald-700 bg-emerald-950/50 text-emerald-300 group-hover:border-emerald-400"><Coffee className="h-6 w-6"/></div>
   <div className="mt-2 text-base font-black text-white">Buy me a Coffee</div>
   <p className="mt-1 text-xs leading-relaxed text-slate-400">The game is free. If it was useful, you can support its continued development on Ko-fi.</p>
   <div className="mt-3 inline-flex items-center gap-1 text-xs font-black text-emerald-300">Support The Performance Gap <ExternalLink className="h-3.5 w-3.5"/></div>
  </a>
  <div className="mt-3 border-t border-slate-800 pt-3 text-center">
   <a href="/privacy" className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-white"><ShieldCheck className="h-3.5 w-3.5"/>Privacy Policy</a>
  </div>
 </div>;
};
