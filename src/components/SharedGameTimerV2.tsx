import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Clock, LogIn, Pause, Play, RotateCcw, Settings2, Users, X } from 'lucide-react';
import type { GameSessionV2 } from '../types/gameV2.ts';

interface Props { session: GameSessionV2; onResetGame?: () => void | Promise<void>; resetting?: boolean; onFacilitatorLogin?:()=>void; onBreakoutRooms?:()=>void; }

function secondsFromSession(session: GameSessionV2) {
  if (session.timerEndsAt) return Math.max(0, Math.ceil((new Date(session.timerEndsAt).getTime() - Date.now()) / 1000));
  return session.timerPausedSecondsRemaining ?? session.gameDurationMinutes * 60;
}

export const SharedGameTimerV2: React.FC<Props> = ({ session, onResetGame, resetting=false, onFacilitatorLogin, onBreakoutRooms }) => {
  const [remaining, setRemaining] = useState(() => secondsFromSession(session));
  const [open,setOpen]=useState(false);
  const [timerBusy,setTimerBusy]=useState(false);
  const wrapperRef=useRef<HTMLDivElement|null>(null);
  useEffect(() => {
    setRemaining(secondsFromSession(session));
    if (!session.timerEndsAt) return;
    const id = window.setInterval(() => setRemaining(secondsFromSession(session)), 1000);
    return () => window.clearInterval(id);
  }, [session.timerEndsAt, session.timerPausedSecondsRemaining, session.gameDurationMinutes]);
  useEffect(()=>{
    if(!open)return;
    const close=(event:MouseEvent)=>{if(wrapperRef.current&&!wrapperRef.current.contains(event.target as Node))setOpen(false)};
    window.addEventListener('mousedown',close);
    return()=>window.removeEventListener('mousedown',close);
  },[open]);

  const teamStatus = useMemo(() => {
    if (session.phase !== 'respond' || session.isFinalDisruptionActive) return null;
    const stored = localStorage.getItem('tpg_participant');
    let companyId = localStorage.getItem('tpg_company_id');
    try { companyId = stored ? JSON.parse(stored)?.companyId || companyId : companyId; } catch { /* ignore */ }
    const ownEvents = companyId ? (session.activeEvents[companyId] || []) : [];
    const ownComplete = ownEvents.length > 0 && ownEvents.every(event => event.isResolved);
    if (!ownComplete) return 'Complete tasks below';
    const otherTeamsWaiting = session.companies.filter(company => company.id !== companyId && (session.activeEvents[company.id] || []).some(event => !event.isResolved)).length;
    return otherTeamsWaiting ? `Waiting on ${otherTeamsWaiting} other team${otherTeamsWaiting === 1 ? '' : 's'}` : 'All teams complete';
  }, [session]);

  const timerCommand=async(action:'start'|'pause')=>{
    if(timerBusy)return;
    setTimerBusy(true);
    try{await fetch(`/api/sessions/${session.id}/timer/${action}`,{method:'POST'});}finally{setTimerBusy(false)}
  };
  const facilitatorGameView=typeof window!=='undefined'&&sessionStorage.getItem('tpg_facilitator_game_view')==='1'&&Boolean(sessionStorage.getItem('tpg_facilitator_participant'));
  const reopenControlRoom=()=>{const currentPlayer=localStorage.getItem('tpg_participant');if(currentPlayer)sessionStorage.setItem('tpg_facilitator_game_player',currentPlayer);const facilitator=sessionStorage.getItem('tpg_facilitator_participant');if(facilitator){localStorage.setItem('tpg_participant',facilitator);try{const parsed=JSON.parse(facilitator);if(parsed.companyId)localStorage.setItem('tpg_company_id',parsed.companyId)}catch{}}sessionStorage.removeItem('tpg_facilitator_game_view');window.location.reload()};

  const roundMode=session.experienceMode==='expert'&&session.gameEndMode==='rounds';
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const tone = roundMode?'border-indigo-500/70 bg-slate-900/90':remaining <= 5 * 60 ? 'border-rose-500 bg-rose-950/70' : remaining <= session.finalWindowMinutes * 60 ? 'border-amber-500 bg-amber-950/70' : 'border-emerald-500/70 bg-slate-900/90';
  const isSolo=session.companies.length===1;
  const isRunning=Boolean(session.timerEndsAt);
  const clockLabel=roundMode?`Round ${session.round} of ${session.finalRoundCount}. Open game controls.`:`${mins} minutes ${secs} seconds remaining. Open game clock controls.`;

  return <div className="flex items-center justify-end gap-2">
    {teamStatus && <div aria-live="polite" className={`rounded-xl border px-3 py-2 text-sm font-black ${teamStatus==='Complete tasks below'?'border-indigo-700 bg-indigo-950/60 text-indigo-200':teamStatus.startsWith('Waiting')?'border-amber-700 bg-amber-950/60 text-amber-200':'border-emerald-700 bg-emerald-950/60 text-emerald-200'}`}>{teamStatus}</div>}
    <div ref={wrapperRef} className="relative">
      <button type="button" onClick={()=>setOpen(v=>!v)} className={`flex items-center gap-3 rounded-2xl border-2 px-4 py-2 text-white shadow-lg ${tone}`} aria-expanded={open} aria-haspopup="menu" aria-label={clockLabel}>
        <Clock className="w-5 h-5" aria-hidden="true"/>
        <div className="leading-none text-left"><div className="text-[10px] uppercase tracking-[0.16em] opacity-70 font-bold">{roundMode?'Game rounds':'Game time'}</div><div className="text-2xl font-black tabular-nums mt-1" aria-live="off">{roundMode?`${session.round} / ${session.finalRoundCount}`:`${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`}</div></div>
      </button>
      {open&&<div role="menu" className="absolute right-0 top-full mt-2 z-[120] w-56 rounded-2xl border border-slate-700 bg-slate-950/98 p-2 shadow-2xl">
        <div className="flex items-center justify-between px-2 py-1"><div className="text-[10px] uppercase tracking-wider text-slate-500 font-black">Game controls</div><button onClick={()=>setOpen(false)} className="w-7 h-7 rounded-lg grid place-items-center text-slate-500 hover:text-white" aria-label="Close game controls"><X className="w-4 h-4"/></button></div>
        {facilitatorGameView?<button role="menuitem" onClick={reopenControlRoom} className="mt-1 w-full rounded-xl border border-violet-800 bg-violet-950/35 px-3 py-2.5 text-xs font-black text-violet-200 flex items-center justify-center gap-2"><Settings2 className="w-4 h-4"/>Control room</button>:onFacilitatorLogin&&<button role="menuitem" onClick={()=>{setOpen(false);onFacilitatorLogin()}} className="mt-1 w-full rounded-xl border border-violet-800 bg-violet-950/35 px-3 py-2.5 text-xs font-black text-violet-200 flex items-center justify-center gap-2"><LogIn className="w-4 h-4"/>Facilitator login</button>}
        {onBreakoutRooms&&<button role="menuitem" onClick={()=>{setOpen(false);onBreakoutRooms()}} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-xs font-black text-slate-200 flex items-center justify-center gap-2"><Users className="w-4 h-4"/>Breakout rooms</button>}
        {isSolo&&!roundMode&&<button role="menuitem" disabled={timerBusy} onClick={()=>void timerCommand(isRunning?'pause':'start')} className="mt-1 w-full rounded-xl border border-emerald-800 bg-emerald-950/35 px-3 py-2.5 text-xs font-black text-emerald-200 flex items-center justify-center gap-2 disabled:opacity-50">{isRunning?<Pause className="w-4 h-4"/>:<Play className="w-4 h-4"/>}{isRunning?'Pause clock':'Play clock'}</button>}
        {onResetGame&&<button role="menuitem" disabled={resetting} onClick={()=>void onResetGame()} className="mt-2 w-full rounded-xl border border-amber-700 bg-amber-950/30 px-3 py-2.5 text-xs font-black text-amber-200 flex items-center justify-center gap-2 disabled:opacity-50"><RotateCcw className="w-4 h-4"/>{resetting?'Resetting…':'Reset game'}</button>}
      </div>}
    </div>
  </div>;
};
