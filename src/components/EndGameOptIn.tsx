import React,{useEffect,useMemo,useState}from'react';
import{CheckCircle2,ExternalLink,Mail,ShieldCheck}from'lucide-react';

export const EndGameOptIn:React.FC=()=>{
 const[visible,setVisible]=useState(false);
 const[email,setEmail]=useState('');
 const[wantsResults,setWantsResults]=useState(false);
 const[wantsUpdates,setWantsUpdates]=useState(false);
 const[saving,setSaving]=useState(false);
 const[saved,setSaved]=useState(false);
 const[error,setError]=useState('');
 useEffect(()=>{
  const check=()=>{
   const headings=[...document.querySelectorAll('h1,h2,h3')];
   setVisible(headings.some(el=>el.textContent?.trim()==='Thank you for playing.'));
  };
  check();
  const observer=new MutationObserver(check);
  observer.observe(document.body,{childList:true,subtree:true,characterData:true});
  return()=>observer.disconnect();
 },[]);
 const context=useMemo(()=>{
  let playerName='';
  try{const raw=localStorage.getItem('tpg_participant');if(raw)playerName=JSON.parse(raw)?.name||'';}catch{}
  return{
   sessionId:localStorage.getItem('tpg_session_id')||'',
   companyId:localStorage.getItem('tpg_company_id')||'',
   playerName,
  };
 },[visible]);
 const submit=async()=>{
  if(saved||saving||(!wantsResults&&!wantsUpdates))return;
  setSaving(true);setError('');
  try{
   const r=await fetch('/api/player-opt-in',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...context,email,wantsResults,wantsUpdates})});
   const data=await r.json().catch(()=>({}));
   if(!r.ok)throw new Error(data.error||'Could not save your preferences.');
   setSaved(true);
  }catch(e:any){setError(e.message||'Could not save your preferences.');}
  finally{setSaving(false);}
 };
 if(!visible)return null;
 return <aside className="fixed z-[270] right-4 top-1/2 -translate-y-1/2 w-[340px] max-w-[calc(100vw-2rem)] rounded-2xl border border-indigo-700 bg-slate-950/95 p-5 shadow-2xl backdrop-blur max-md:top-auto max-md:bottom-4 max-md:translate-y-0 max-md:right-4 max-md:left-4 max-md:w-auto">
  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.18em] text-indigo-300"><Mail className="h-4 w-4"/>Stay in touch</div>
  <h3 className="mt-2 text-lg font-black text-white">Would you like anything from me?</h3>
  <p className="mt-1 text-xs leading-relaxed text-slate-400">Completely optional. You can finish the game without providing an email address.</p>

  {saved?<div className="mt-4 rounded-xl border border-emerald-700 bg-emerald-950/30 p-4 text-sm text-emerald-200"><div className="flex items-center gap-2 font-black"><CheckCircle2 className="h-4 w-4"/>Preferences saved</div><p className="mt-1 text-xs text-emerald-300/80">Thank you. Your choices and email address have been recorded.</p></div>:<>
   <label className="mt-4 block"><span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Email address</span><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-indigo-400"/></label>
   <label className={`mt-3 flex cursor-pointer gap-3 rounded-xl border p-3 ${wantsResults?'border-indigo-500 bg-indigo-950/35':'border-slate-700 bg-slate-900'}`}><input type="checkbox" checked={wantsResults} onChange={e=>setWantsResults(e.target.checked)} className="mt-1"/><span><b className="block text-sm text-white">Email me a copy of my game results</b><small className="mt-0.5 block text-xs leading-relaxed text-slate-400">This choice is only for your game results and does not subscribe you to marketing.</small></span></label>
   <label className={`mt-2 flex cursor-pointer gap-3 rounded-xl border p-3 ${wantsUpdates?'border-emerald-600 bg-emerald-950/25':'border-slate-700 bg-slate-900'}`}><input type="checkbox" checked={wantsUpdates} onChange={e=>setWantsUpdates(e.target.checked)} className="mt-1"/><span><b className="block text-sm text-white">Send me occasional KM insights and Delta Knowledge updates</b><small className="mt-0.5 block text-xs leading-relaxed text-slate-400">Separate, optional marketing consent. You can unsubscribe later.</small></span></label>
   {error&&<div className="mt-2 text-xs font-bold text-rose-300">{error}</div>}
   <button onClick={()=>void submit()} disabled={saving||!email.trim()||(!wantsResults&&!wantsUpdates)} className="mt-3 w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-black text-white disabled:opacity-40">{saving?'SAVING…':'SAVE MY CHOICES'}</button>
  </>}

  <div className="mt-4 border-t border-slate-800 pt-4">
   <div className="text-xs font-black text-white">Stuart French · Delta Knowledge</div>
   <div className="mt-2 grid gap-2 text-xs">
    <a href="https://www.deltaknowledge.net" target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-lg border border-slate-700 px-3 py-2 text-slate-300 hover:border-emerald-500"><span>www.DeltaKnowledge.net</span><ExternalLink className="h-3.5 w-3.5"/></a>
    <a href="https://www.linkedin.com/in/stuartfrench/" target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-lg border border-slate-700 px-3 py-2 text-slate-300 hover:border-indigo-500"><span>LinkedIn · Stuart French</span><ExternalLink className="h-3.5 w-3.5"/></a>
   </div>
   <a href="/privacy" className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-500 hover:text-white"><ShieldCheck className="h-3.5 w-3.5"/>Privacy Policy</a>
  </div>
 </aside>;
};
