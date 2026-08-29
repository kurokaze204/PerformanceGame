import React, { useState } from 'react';
import { ArrowRight, Building2, Gauge, GraduationCap, Sparkles } from 'lucide-react';
import type { GameSessionV2, ExperienceMode } from '../types/gameV2.ts';
import { formatCurrency } from '../utils/format.ts';

interface Props {
  currentSession: GameSessionV2 | null;
  onJoinSession: (sessionId: string, companyId: string, playerName: string) => void;
  onCreateNewSession: (sessionName: string, companyCount: number, options: { experienceMode: ExperienceMode; gameDurationMinutes: number; maxPlayersPerCompany: number }) => void;
  onSoloStart: (options: { experienceMode: ExperienceMode; gameDurationMinutes: number; maxPlayersPerCompany: number }) => void;
}

export const SessionJoinModalV2: React.FC<Props> = ({ currentSession, onJoinSession, onCreateNewSession, onSoloStart }) => {
  const [mode, setMode] = useState<'join'|'current'|'create'>('join');
  const [sessionId, setSessionId] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [companyId, setCompanyId] = useState(currentSession?.companies[0]?.id || '');
  const [name, setName] = useState('Executive Game 2026');
  const [companyCount, setCompanyCount] = useState(4);
  const [experienceMode, setExperienceMode] = useState<ExperienceMode>('newbie');
  const [duration, setDuration] = useState(60);
  const [maxPlayers, setMaxPlayers] = useState(6);
  const options = { experienceMode, gameDurationMinutes: duration, maxPlayersPerCompany: maxPlayers };

  return <div className="fixed inset-0 z-[250] bg-[#080b12]/95 grid place-items-center p-4" role="dialog" aria-modal="true" aria-labelledby="join-title">
    <div className="w-full max-w-xl rounded-3xl border border-slate-700 bg-slate-900 p-6 shadow-2xl text-slate-200">
      <div className="text-center"><div className="text-[10px] uppercase tracking-[.2em] font-black text-indigo-300">Organisational knowledge & resilience</div><h1 id="join-title" className="text-2xl font-black text-white mt-1">The Performance Gap</h1><p className="text-xs text-slate-500 mt-1">Multiplayer strategic business simulation</p></div>
      <div className="grid grid-cols-3 gap-1 mt-5 rounded-xl border border-slate-700 bg-slate-950 p-1" role="tablist" aria-label="Game entry options">
        <Tab active={mode==='join'} onClick={()=>setMode('join')}>Join by code</Tab>
        <Tab active={mode==='current'} disabled={!currentSession} onClick={()=>setMode('current')}>Current game</Tab>
        <Tab active={mode==='create'} onClick={()=>setMode('create')}>Create game</Tab>
      </div>

      {mode==='join'&&<div className="mt-5 space-y-3">
        <Field label="Your name"><input value={playerName} onChange={e=>setPlayerName(e.target.value)} className="control" placeholder="e.g. Sarah Jenkins"/></Field>
        <Field label="Game code"><input value={sessionId} onChange={e=>setSessionId(e.target.value.toUpperCase())} className="control" placeholder="e.g. KM2026"/></Field>
        <button onClick={()=>sessionId.trim()&&onJoinSession(sessionId.trim(),' ',playerName||'Player')} className="primary">CONNECT TO GAME <ArrowRight className="w-4 h-4"/></button>
        <p className="text-[11px] text-slate-500">If you do not choose a company, the game assigns you to the smallest available team.</p>
      </div>}

      {mode==='current'&&currentSession&&<div className="mt-5 space-y-3">
        <Field label="Your name"><input value={playerName} onChange={e=>setPlayerName(e.target.value)} className="control" placeholder="e.g. Sarah Jenkins"/></Field>
        <div><div className="label">Choose a company</div><div className="space-y-1.5 mt-1 max-h-48 overflow-auto">{currentSession.companies.map(c=><button key={c.id} onClick={()=>setCompanyId(c.id)} className={`w-full rounded-xl border p-3 text-left flex justify-between items-center ${companyId===c.id?'border-indigo-400 bg-indigo-950/60':'border-slate-700 bg-slate-950'}`}><span><b className="text-white">{c.name}</b><span className="block text-[10px] text-slate-500">{c.sites.length} sites · {c.experts.length} Experts · {formatCurrency(c.turnover)}</span></span><Building2 className="w-4 h-4 text-indigo-300"/></button>)}</div></div>
        <button onClick={()=>onJoinSession(currentSession.id,companyId,playerName||'Player')} className="primary">ENTER GAME <ArrowRight className="w-4 h-4"/></button>
      </div>}

      {mode==='create'&&<div className="mt-5 space-y-4">
        <div className="grid grid-cols-2 gap-3"><Field label="Game name"><input value={name} onChange={e=>setName(e.target.value)} className="control"/></Field><Field label="Companies"><select value={companyCount} onChange={e=>setCompanyCount(Number(e.target.value))} className="control">{[1,2,3,4,5,6,7,8].map(n=><option key={n} value={n}>{n} {n===1?'company':'companies'}</option>)}</select></Field></div>
        <div><div className="label">Player experience</div><div className="grid grid-cols-2 gap-2 mt-1">
          <button onClick={()=>setExperienceMode('newbie')} className={`mode-card ${experienceMode==='newbie'?'selected':''}`}><GraduationCap className="w-5 h-5"/><span><b>Newbie</b><small>Guided reveal over Rounds 1–3</small></span></button>
          <button onClick={()=>setExperienceMode('expert')} className={`mode-card ${experienceMode==='expert'?'selected':''}`}><Gauge className="w-5 h-5"/><span><b>Expert</b><small>All features available from Round 1</small></span></button>
        </div></div>
        <div className="grid grid-cols-2 gap-3"><Field label="Game length (minutes)"><input type="number" min={20} max={240} step={5} value={duration} onChange={e=>setDuration(Math.max(20,Number(e.target.value)))} className="control"/></Field><Field label="Max players / company"><input type="number" min={1} max={20} value={maxPlayers} onChange={e=>setMaxPlayers(Math.max(1,Number(e.target.value)))} className="control"/></Field></div>
        <div className="rounded-xl border border-indigo-800 bg-indigo-950/25 p-3 text-xs text-slate-300">The final climactic Challenge begins after the current round finishes once the game enters its last 10 minutes. Normal play assumes about one Challenge move every 8 minutes.</div>
        <button onClick={()=>onCreateNewSession(name,companyCount,options)} className="primary"><Sparkles className="w-4 h-4"/>LAUNCH NEW GAME</button>
        <button onClick={()=>onSoloStart(options)} className="w-full text-xs text-indigo-300 underline">Launch a 1-company solo game with these settings</button>
      </div>}
    </div>
  </div>;
};

const Tab:React.FC<{active?:boolean;disabled?:boolean;onClick:()=>void;children:React.ReactNode}>=({active,disabled,onClick,children})=><button disabled={disabled} onClick={onClick} role="tab" aria-selected={active} className={`rounded-lg py-2 text-xs font-black disabled:opacity-30 ${active?'bg-indigo-600 text-white':'text-slate-400 hover:text-white'}`}>{children}</button>;
const Field:React.FC<{label:string;children:React.ReactNode}>=({label,children})=><label className="block"><span className="label">{label}</span>{children}</label>;
