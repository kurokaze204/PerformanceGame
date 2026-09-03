import React, { useState } from 'react';
import { ArrowRight, Building2, Gauge, GraduationCap, Settings2, Sparkles } from 'lucide-react';
import type { GameSessionV2, ExperienceMode } from '../types/gameV2.ts';
import { defaultActionsForMode } from '../engine/learningCurveBalanceV1.ts';
import { formatCurrency } from '../utils/format.ts';

interface CreateOptions { experienceMode: ExperienceMode; gameDurationMinutes: number; maxPlayersPerCompany: number; actionsPerRound: number; }
interface Props {
  currentSession: GameSessionV2 | null;
  onJoinSession: (sessionId: string, companyId: string, playerName: string) => void;
  onCreateNewSession: (sessionName: string, companyCount: number, options: CreateOptions) => void;
  onSoloStart: (options: CreateOptions) => void;
  initialMode?: 'join'|'current'|'create'|'facilitator';
}

export const SessionJoinModalV2: React.FC<Props> = ({ currentSession, onJoinSession, initialMode='join' }) => {
  const [mode, setMode] = useState<'join'|'current'|'create'|'facilitator'>(initialMode);
  const [sessionId, setSessionId] = useState(currentSession?.id || '');
  const [playerName, setPlayerName] = useState(()=>{try{return localStorage.getItem('tpg_entered_player_name')||''}catch{return''}});
  const [companyId, setCompanyId] = useState(currentSession?.companies[0]?.id || '');
  const [name, setName] = useState('Executive Game 2026');
  const [companyCount, setCompanyCount] = useState(4);
  const [experienceMode, setExperienceMode] = useState<ExperienceMode>('newbie');
  const [duration, setDuration] = useState(60);
  const [maxPlayers, setMaxPlayers] = useState(6);
  const [actionsPerRound, setActionsPerRound] = useState(defaultActionsForMode('newbie'));
  const [facilitatorPasscode,setFacilitatorPasscode]=useState('');
  const [createError, setCreateError] = useState<string|null>(null);
  const [facilitatorError,setFacilitatorError]=useState<string|null>(null);
  const [creating, setCreating] = useState(false);
  const selectExperienceMode=(next:ExperienceMode)=>{setExperienceMode(next);setActionsPerRound(defaultActionsForMode(next));};
  const options = { experienceMode, gameDurationMinutes: duration, maxPlayersPerCompany: maxPlayers, actionsPerRound };
  const hasName = playerName.trim().length > 0;
  const rememberName = () => { try { localStorage.setItem('tpg_entered_player_name', playerName.trim()); } catch { /* ignore */ } };

  const persistFacilitator=(joined:any,passcode:string)=>{
    localStorage.setItem('tpg_session_id',joined.session.id);
    localStorage.setItem('tpg_company_id',joined.participant.companyId);
    localStorage.setItem('tpg_participant',JSON.stringify(joined.participant));
    sessionStorage.setItem('tpg_facilitator_passcode',passcode);
  };

  const enterFacilitator=async(code:string)=>{
    const resolvedCode=code.trim().toUpperCase();
    if(!hasName||!resolvedCode||!facilitatorPasscode.trim())return;
    setCreating(true);setFacilitatorError(null);rememberName();
    try{
      const verify=await fetch(`/api/sessions/${resolvedCode}/facilitator/settings`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({passcode:facilitatorPasscode})});
      const verified=await verify.json();
      if(!verify.ok)throw new Error(verified.error||'Could not verify facilitator access.');
      const joinResponse=await fetch(`/api/sessions/${resolvedCode}/join`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:playerName.trim()||'Facilitator',role:'facilitator'})});
      const joined=await joinResponse.json();
      if(!joinResponse.ok)throw new Error(joined.error||'Could not enter the facilitator control room.');
      persistFacilitator(joined,facilitatorPasscode);
      window.location.reload();
    }catch(error:any){setFacilitatorError(error.message||'Could not enter facilitator mode.');setCreating(false);}
  };

  const createAndJoin = async (count:number,autoStartTimer=false) => {
    if (!hasName || creating) return;
    setCreating(true); setCreateError(null); rememberName();
    try {
      const res=await fetch('/api/sessions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,companyCount:count,...options})});
      const created=await res.json();
      if(!res.ok) throw new Error(created.error||'Could not create the game.');
      if(autoStartTimer){
        const timerResponse=await fetch(`/api/sessions/${created.id}/timer/start`,{method:'POST'});
        if(!timerResponse.ok)throw new Error('The solo game was created, but its clock could not be started.');
      }
      onJoinSession(created.id,created.companies?.[0]?.id||'',playerName.trim());
    } catch (error:any) { setCreateError(error.message||'Could not create the game.'); setCreating(false); }
  };

  const createAndFacilitate=async()=>{
    if(!hasName||creating||!facilitatorPasscode.trim())return;
    setCreating(true);setCreateError(null);setFacilitatorError(null);rememberName();
    try{
      const res=await fetch('/api/sessions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,companyCount,...options})});
      const created=await res.json();
      if(!res.ok)throw new Error(created.error||'Could not create the game.');
      const verify=await fetch(`/api/sessions/${created.id}/facilitator/settings`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({passcode:facilitatorPasscode})});
      const verified=await verify.json();
      if(!verify.ok)throw new Error(verified.error||'The game was created, but facilitator access could not be verified.');
      const joinResponse=await fetch(`/api/sessions/${created.id}/join`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:playerName.trim()||'Facilitator',role:'facilitator'})});
      const joined=await joinResponse.json();
      if(!joinResponse.ok)throw new Error(joined.error||'Could not enter the facilitator control room.');
      persistFacilitator(joined,facilitatorPasscode);
      window.location.reload();
    }catch(error:any){setCreateError(error.message||'Could not create the facilitated game.');setCreating(false);}
  };

  return <div className="fixed inset-0 z-[250] bg-[#080b12]/95 grid place-items-center p-4" role="dialog" aria-modal="true" aria-labelledby="join-title">
    <div className="w-full max-w-xl rounded-3xl border border-slate-700 bg-slate-900 p-6 shadow-2xl text-slate-200">
      <div className="text-center"><div className="text-[10px] uppercase tracking-[.2em] font-black text-indigo-300">Organisational knowledge & resilience</div><h1 id="join-title" className="text-2xl font-black text-white mt-1">The Performance Gap</h1><p className="text-xs text-slate-500 mt-1">Multiplayer strategic business simulation</p></div>
      <div className="grid grid-cols-4 gap-1 mt-5 rounded-xl border border-slate-700 bg-slate-950 p-1" role="tablist" aria-label="Game entry options">
        <Tab active={mode==='join'} onClick={()=>setMode('join')}>Join</Tab>
        <Tab active={mode==='current'} disabled={!currentSession} onClick={()=>setMode('current')}>Current</Tab>
        <Tab active={mode==='create'} onClick={()=>setMode('create')}>Create</Tab>
        <Tab active={mode==='facilitator'} onClick={()=>setMode('facilitator')}>Facilitate</Tab>
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

      {mode==='facilitator'&&<div className="mt-5 space-y-3">
        <div className="rounded-xl border border-indigo-800 bg-indigo-950/25 p-3 text-xs text-slate-300"><b className="text-indigo-200">Facilitator mode</b> opens the session-level control room rather than joining a company. From there you can watch team progress and manage the shared game clock.</div>
        <Field label="Your name"><input required value={playerName} onChange={e=>setPlayerName(e.target.value)} className="control" placeholder="e.g. Stuart French"/></Field>
        <Field label="Game code"><input value={sessionId} onChange={e=>setSessionId(e.target.value.toUpperCase())} className="control" placeholder="e.g. KM2026"/></Field>
        <Field label="Facilitator passcode"><input type="password" value={facilitatorPasscode} onChange={e=>setFacilitatorPasscode(e.target.value)} className="control" autoComplete="current-password"/></Field>
        {facilitatorError&&<p className="text-[11px] text-rose-300">{facilitatorError}</p>}
        <button disabled={!hasName||!sessionId.trim()||!facilitatorPasscode.trim()||creating} onClick={()=>void enterFacilitator(sessionId)} className="primary disabled:opacity-40 disabled:cursor-not-allowed"><Settings2 className="w-4 h-4"/>{creating?'VERIFYING…':'ENTER CONTROL ROOM'}</button>
      </div>}

      {mode==='create'&&<div className="mt-5 space-y-4">
        <Field label="Your name"><input required value={playerName} onChange={e=>setPlayerName(e.target.value)} className="control" placeholder="e.g. Sarah Jenkins"/></Field>
        <div className="grid grid-cols-2 gap-3"><Field label="Game name"><input value={name} onChange={e=>setName(e.target.value)} className="control"/></Field><Field label="Companies"><select value={companyCount} onChange={e=>setCompanyCount(Number(e.target.value))} className="control">{[1,2,3,4,5,6,7,8].map(n=><option key={n} value={n}>{n} {n===1?'company':'companies'}</option>)}</select></Field></div>
        <div><div className="label">Player experience</div><div className="grid grid-cols-2 gap-2 mt-1">
          <button onClick={()=>selectExperienceMode('newbie')} className={`mode-card ${experienceMode==='newbie'?'selected':''}`}><GraduationCap className="w-5 h-5"/><span><b>Newbie</b><small>Guided reveal; simpler local capability model</small></span></button>
          <button onClick={()=>selectExperienceMode('expert')} className={`mode-card ${experienceMode==='expert'?'selected':''}`}><Gauge className="w-5 h-5"/><span><b>Expert</b><small>Full KM model; default 3 Actions/round</small></span></button>
        </div></div>
        <div className="grid grid-cols-3 gap-3"><Field label="Game length (minutes)"><input type="number" min={20} max={240} step={5} value={duration} onChange={e=>setDuration(Math.max(20,Number(e.target.value)))} className="control"/></Field><Field label="Max players / company"><input type="number" min={1} max={20} value={maxPlayers} onChange={e=>setMaxPlayers(Math.max(1,Number(e.target.value)))} className="control"/></Field><Field label="Actions / company / round"><input type="number" min={1} max={10} value={actionsPerRound} onChange={e=>setActionsPerRound(Math.max(1,Math.min(10,Number(e.target.value))))} className="control"/></Field></div>
        <div className="rounded-xl border border-indigo-800 bg-indigo-950/25 p-3 text-xs text-slate-300">Defaults are tuned by mode: Newbie starts at 5 Actions per company per round; Expert starts at 3 to create stronger portfolio trade-offs. The facilitator can override either value here.</div>
        {!hasName&&<p className="text-[11px] text-amber-300">Enter your name before starting a game.</p>}
        {createError&&<p className="text-[11px] text-rose-300">{createError}</p>}
        <button disabled={!hasName||creating} onClick={()=>void createAndJoin(companyCount,false)} className="primary disabled:opacity-40 disabled:cursor-not-allowed"><Sparkles className="w-4 h-4"/>{creating?'CREATING…':'LAUNCH NEW GAME'}</button>
        <button disabled={!hasName||creating} onClick={()=>void createAndJoin(1,true)} className="w-full rounded-xl border border-emerald-800 bg-emerald-950/25 py-2.5 text-xs font-black text-emerald-300 disabled:opacity-40 disabled:cursor-not-allowed">LAUNCH 1-COMPANY SOLO GAME · CLOCK STARTS AUTOMATICALLY</button>
        <div className="border-t border-slate-800 pt-3"><Field label="Facilitator passcode"><input type="password" value={facilitatorPasscode} onChange={e=>setFacilitatorPasscode(e.target.value)} className="control" autoComplete="current-password"/></Field><button disabled={!hasName||!facilitatorPasscode.trim()||creating} onClick={()=>void createAndFacilitate()} className="mt-2 w-full rounded-xl border border-indigo-600 bg-indigo-950/50 py-2.5 text-xs font-black text-indigo-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"><Settings2 className="w-4 h-4"/>CREATE &amp; FACILITATE</button></div>
      </div>}
    </div>
  </div>;
};

const Tab:React.FC<{active?:boolean;disabled?:boolean;onClick:()=>void;children:React.ReactNode}>=({active,disabled,onClick,children})=><button disabled={disabled} onClick={onClick} role="tab" aria-selected={active} className={`rounded-lg py-2 text-xs font-black disabled:opacity-30 ${active?'bg-indigo-600 text-white':'text-slate-400 hover:text-white'}`}>{children}</button>;
const Field:React.FC<{label:string;children:React.ReactNode}>=({label,children})=><label className="block"><span className="label">{label}</span>{children}</label>;
