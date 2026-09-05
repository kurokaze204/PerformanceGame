import React, { useState } from 'react';
import { ArrowRight, Building2, Gauge, GraduationCap, Sparkles } from 'lucide-react';
import type { GameEndMode, GameSessionV2, ExperienceMode } from '../types/gameV2.ts';
import { defaultActionsForMode } from '../engine/learningCurveBalanceV1.ts';
import { formatCurrency } from '../utils/format.ts';

interface CreateOptions { experienceMode: ExperienceMode; gameDurationMinutes: number; maxPlayersPerCompany: number; actionsPerRound: number; gameEndMode: GameEndMode; finalRoundCount: number; }
interface Props {
  currentSession: GameSessionV2 | null;
  onJoinSession: (sessionId: string, companyId: string, playerName: string) => void;
  onCreateNewSession: (sessionName: string, companyCount: number, options: CreateOptions) => void;
  onSoloStart: (options: CreateOptions) => void;
}

export const SessionJoinModalV2: React.FC<Props> = ({ currentSession, onJoinSession }) => {
  const [mode, setMode] = useState<'join'|'current'|'create'>('join');
  const [sessionId, setSessionId] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [companyId, setCompanyId] = useState(currentSession?.companies[0]?.id || '');
  const [name, setName] = useState('Executive Game 2026');
  const [companyCount, setCompanyCount] = useState(4);
  const [experienceMode, setExperienceMode] = useState<ExperienceMode>('newbie');
  const [duration, setDuration] = useState(60);
  const [maxPlayers, setMaxPlayers] = useState(6);
  const [actionsPerRound, setActionsPerRound] = useState(defaultActionsForMode('newbie'));
  const [gameEndMode, setGameEndMode] = useState<GameEndMode>('time');
  const [finalRoundCount, setFinalRoundCount] = useState(30);
  const [createError, setCreateError] = useState<string|null>(null);
  const [creating, setCreating] = useState(false);
  const selectExperienceMode=(next:ExperienceMode)=>{setExperienceMode(next);setActionsPerRound(defaultActionsForMode(next));if(next==='newbie')setGameEndMode('time');};
  const options = { experienceMode, gameDurationMinutes: duration, maxPlayersPerCompany: maxPlayers, actionsPerRound, gameEndMode: experienceMode==='expert'?gameEndMode:'time' as GameEndMode, finalRoundCount };
  const hasName = playerName.trim().length > 0;
  const rememberName = () => { try { localStorage.setItem('tpg_entered_player_name', playerName.trim()); } catch { /* ignore */ } };
  const createAndJoin = async (count:number) => {
    if (!hasName || creating) return;
    setCreating(true); setCreateError(null); rememberName();
    try {
      const res=await fetch('/api/sessions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,companyCount:count,...options})});
      const created=await res.json();
      if(!res.ok) throw new Error(created.error||'Could not create the game.');
      onJoinSession(created.id,created.companies?.[0]?.id||'',playerName.trim());
    } catch (error:any) { setCreateError(error.message||'Could not create the game.'); setCreating(false); }
  };

  return <div className="fixed inset-0 z-[250] bg-[#080b12]/95 grid place-items-center p-4" role="dialog" aria-modal="true" aria-labelledby="join-title">
    <div className="w-full max-w-xl rounded-3xl border border-slate-700 bg-slate-900 p-6 shadow-2xl text-slate-200 max-h-[95vh] overflow-y-auto">
      <div className="text-center"><div className="text-[10px] uppercase tracking-[.2em] font-black text-indigo-300">Organisational knowledge & resilience</div><h1 id="join-title" className="text-2xl font-black text-white mt-1">The Performance Gap</h1><p className="text-xs text-slate-500 mt-1">Multiplayer strategic business simulation</p></div>
      <div className="grid grid-cols-3 gap-1 mt-5 rounded-xl border border-slate-700 bg-slate-950 p-1" role="tablist" aria-label="Game entry options">
        <Tab active={mode==='join'} onClick={()=>setMode('join')}>Join by code</Tab>
        <Tab active={mode==='current'} disabled={!currentSession} onClick={()=>setMode('current')}>Current game</Tab>
        <Tab active={mode==='create'} onClick={()=>setMode('create')}>Create game</Tab>
      </div>

      {mode==='join'&&<div className="mt-5 space-y-3">
        <Field label="Your name"><input required value={playerName} onChange={e=>setPlayerName(e.target.value)} className="control" placeholder="e.g. Sarah Jenkins"/></Field>
        <Field label="Game code"><input value={sessionId} onChange={e=>setSessionId(e.target.value.toUpperCase())} className="control" placeholder="e.g. KM2026"/></Field>
        <button disabled={!hasName||!sessionId.trim()} onClick={()=>{rememberName();onJoinSession(sessionId.trim(),' ',playerName.trim())}} className="primary disabled:opacity-40 disabled:cursor-not-allowed">CONNECT TO GAME <ArrowRight className="w-4 h-4"/></button>
        {!hasName&&<p className="text-[11px] text-amber-300">Enter your name before connecting. It is used to identify you to your team and in the game record.</p>}
        <p className="text-[11px] text-slate-500">If you do not choose a company, the game assigns you to the smallest available team.</p>
      </div>}

      {mode==='current'&&currentSession&&<div className="mt-5 space-y-3">
        <Field label="Your name"><input required value={playerName} onChange={e=>setPlayerName(e.target.value)} className="control" placeholder="e.g. Sarah Jenkins"/></Field>
        <div><div className="label">Choose a company</div><div className="space-y-1.5 mt-1 max-h-48 overflow-auto">{currentSession.companies.map(c=><button key={c.id} onClick={()=>setCompanyId(c.id)} className={`w-full rounded-xl border p-3 text-left flex justify-between items-center ${companyId===c.id?'border-indigo-400 bg-indigo-950/60':'border-slate-700 bg-slate-950'}`}><span><b className="text-white">{c.name}</b><span className="block text-[10px] text-slate-500">{c.sites.length} sites · {c.experts.length} Experts · {formatCurrency(c.turnover)}</span></span><Building2 className="w-4 h-4 text-indigo-300"/></button>)}</div></div>
        <button disabled={!hasName||!companyId} onClick={()=>{rememberName();onJoinSession(currentSession.id,companyId,playerName.trim())}} className="primary disabled:opacity-40 disabled:cursor-not-allowed">ENTER GAME <ArrowRight className="w-4 h-4"/></button>
        {!hasName&&<p className="text-[11px] text-amber-300">Enter your name before entering the game.</p>}
      </div>}

      {mode==='create'&&<div className="mt-5 space-y-4">
        <Field label="Your name"><input required value={playerName} onChange={e=>setPlayerName(e.target.value)} className="control" placeholder="e.g. Sarah Jenkins"/></Field>
        <div className="grid grid-cols-2 gap-3"><Field label="Game name"><input value={name} onChange={e=>setName(e.target.value)} className="control"/></Field><Field label="Companies"><select value={companyCount} onChange={e=>setCompanyCount(Number(e.target.value))} className="control">{[1,2,3,4,5,6,7,8].map(n=><option key={n} value={n}>{n} {n===1?'company':'companies'}</option>)}</select></Field></div>
        <div><div className="label">Player experience</div><div className="grid grid-cols-2 gap-2 mt-1">
          <button onClick={()=>selectExperienceMode('newbie')} className={`mode-card ${experienceMode==='newbie'?'selected':''}`}><GraduationCap className="w-5 h-5"/><span><b>Newbie</b><small>Guided reveal; simpler local capability model</small></span></button>
          <button onClick={()=>selectExperienceMode('expert')} className={`mode-card ${experienceMode==='expert'?'selected':''}`}><Gauge className="w-5 h-5"/><span><b>Expert</b><small>Full KM model; default 3 Actions/round</small></span></button>
        </div></div>
        {experienceMode==='expert'&&<div className="rounded-xl border border-slate-700 bg-slate-950/70 p-3"><div className="label">End game by</div><div className="grid grid-cols-2 gap-2 mt-1"><button onClick={()=>setGameEndMode('time')} className={`mode-card ${gameEndMode==='time'?'selected':''}`}><span><b>Time</b><small>Final Challenge when the timer reaches T−10</small></span></button><button onClick={()=>setGameEndMode('rounds')} className={`mode-card ${gameEndMode==='rounds'?'selected':''}`}><span><b>Round count</b><small>Final Challenge after the chosen round finishes</small></span></button></div>{gameEndMode==='rounds'&&<div className="mt-3"><Field label="Normal rounds before final Challenge"><input type="number" min={1} max={200} value={finalRoundCount} onChange={e=>setFinalRoundCount(Math.max(1,Math.min(200,Number(e.target.value))))} className="control"/></Field></div>}</div>}
        <div className={`grid ${experienceMode==='expert'&&gameEndMode==='rounds'?'grid-cols-2':'grid-cols-3'} gap-3`}>{!(experienceMode==='expert'&&gameEndMode==='rounds')&&<Field label="Game length (minutes)"><input type="number" min={20} max={240} step={5} value={duration} onChange={e=>setDuration(Math.max(20,Number(e.target.value)))} className="control"/></Field>}<Field label="Max players / company"><input type="number" min={1} max={20} value={maxPlayers} onChange={e=>setMaxPlayers(Math.max(1,Number(e.target.value)))} className="control"/></Field><Field label="Actions / company / round"><input type="number" min={1} max={10} value={actionsPerRound} onChange={e=>setActionsPerRound(Math.max(1,Math.min(10,Number(e.target.value))))} className="control"/></Field></div>
        <div className="rounded-xl border border-indigo-800 bg-indigo-950/25 p-3 text-xs text-slate-300">{experienceMode==='expert'&&gameEndMode==='rounds'?`This Expert game will play ${finalRoundCount} normal rounds, then enter the final Challenge after Round ${finalRoundCount} is completed.`:'Time-based games enter the final Challenge only after the timer has actually been started and reaches the final 10-minute window. There is no round-count fallback.'}</div>
        {!hasName&&<p className="text-[11px] text-amber-300">Enter your name before starting a game.</p>}
        {createError&&<p className="text-[11px] text-rose-300">{createError}</p>}
        <button disabled={!hasName||creating} onClick={()=>void createAndJoin(companyCount)} className="primary disabled:opacity-40 disabled:cursor-not-allowed"><Sparkles className="w-4 h-4"/>{creating?'CREATING…':'LAUNCH NEW GAME'}</button>
        <button disabled={!hasName||creating} onClick={()=>void createAndJoin(1)} className="w-full text-xs text-indigo-300 underline disabled:opacity-40 disabled:no-underline disabled:cursor-not-allowed">Launch a 1-company solo game with these settings</button>
      </div>}
    </div>
  </div>;
};

const Tab:React.FC<{active?:boolean;disabled?:boolean;onClick:()=>void;children:React.ReactNode}>=({active,disabled,onClick,children})=><button disabled={disabled} onClick={onClick} role="tab" aria-selected={active} className={`rounded-lg py-2 text-xs font-black disabled:opacity-30 ${active?'bg-indigo-600 text-white':'text-slate-400 hover:text-white'}`}>{children}</button>;
const Field:React.FC<{label:string;children:React.ReactNode}>=({label,children})=><label className="block"><span className="label">{label}</span>{children}</label>;
