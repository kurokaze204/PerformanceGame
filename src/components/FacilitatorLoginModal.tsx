import React,{useState}from'react';
import{LockKeyhole,X}from'lucide-react';
import type{GameSessionV2}from'../types/gameV2.ts';

interface Props{session:GameSessionV2;playerName?:string;onClose:()=>void;onEntered:(session:GameSessionV2,participant:any,passcode:string)=>void;}

export const FacilitatorLoginModal:React.FC<Props>=({session,playerName,onClose,onEntered})=>{
 const[passcode,setPasscode]=useState('');
 const[busy,setBusy]=useState(false);
 const[error,setError]=useState<string|null>(null);
 const enter=async()=>{
  const code=passcode.trim();if(!code||busy)return;
  setBusy(true);setError(null);
  try{
   const verify=await fetch(`/api/sessions/${session.id}/facilitator/settings`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({passcode:code})});
   const verified=await verify.json();
   if(!verify.ok)throw new Error(verified.error||'Incorrect facilitator passcode.');
   const join=await fetch(`/api/sessions/${session.id}/join`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:playerName?.trim()||'Facilitator',role:'facilitator'})});
   const joined=await join.json();
   if(!join.ok)throw new Error(joined.error||'Could not enter the facilitator control room.');
   onEntered(joined.session,joined.participant,code);
  }catch(err:any){setError(err.message||'Could not enter facilitator mode.');setBusy(false)}
 };
 return <div className="fixed inset-0 z-[255] grid place-items-center bg-black/75 p-4" role="dialog" aria-modal="true" aria-labelledby="fac-login-title">
  <div className="relative w-full max-w-sm rounded-3xl border-2 border-violet-700 bg-slate-950 p-5 shadow-2xl">
   <button onClick={onClose} className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-xl border border-slate-700 text-slate-400 hover:text-white" aria-label="Close facilitator login"><X className="h-4 w-4"/></button>
   <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-violet-700 bg-violet-950/50 text-violet-200"><LockKeyhole className="h-5 w-5"/></div>
   <div className="mt-3 text-[10px] font-black uppercase tracking-[.18em] text-violet-300">Current game · {session.id}</div>
   <h2 id="fac-login-title" className="mt-1 text-xl font-black text-white">Facilitator login</h2>
   <p className="mt-1 text-sm leading-relaxed text-slate-400">Enter the facilitator passcode to open the control room for this game.</p>
   <label className="mt-4 block"><span className="label">Facilitator passcode</span><input autoFocus type="password" value={passcode} onChange={e=>setPasscode(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')void enter()}} className="control" autoComplete="current-password"/></label>
   {error&&<p className="mt-2 text-xs text-rose-300">{error}</p>}
   <button disabled={!passcode.trim()||busy} onClick={()=>void enter()} className="primary mt-4 disabled:cursor-not-allowed disabled:opacity-40">{busy?'VERIFYING…':'ENTER CONTROL ROOM'}</button>
  </div>
 </div>;
};
