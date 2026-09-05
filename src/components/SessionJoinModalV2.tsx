import React,{useState}from'react';
import{ArrowRight,Building2,Gauge,GraduationCap,Sparkles,X}from'lucide-react';
import type{GameSessionV2,ExperienceMode,PopulationMode}from'../types/gameV2.ts';
import{defaultActionsForMode}from'../engine/learningCurveBalanceV1.ts';
import{formatCurrency}from'../utils/format.ts';

interface CreateOptions{experienceMode:ExperienceMode;gameDurationMinutes:number;maxPlayersPerCompany:number;actionsPerRound:number;populationMode:PopulationMode;}
interface Props{
 currentSession:GameSessionV2|null;
 onJoinSession:(sessionId:string,companyId:string,playerName:string)=>void;
 onCreateNewSession:(sessionName:string,companyCount:number,options:CreateOptions)=>void;
 onSoloStart:(options:CreateOptions)=>void;
 initialMode?:'join'|'current'|'create';
 onClose?:()=>void;
}

export const SessionJoinModalV2:React.FC<Props>=({currentSession,onJoinSession,initialMode='join',onClose})=>{
 const[mode,setMode]=useState<'join'|'current'|'create'>(initialMode);
 const[sessionId,setSessionId]=useState(currentSession?.id||'');
 const[playerName,setPlayerName]=useState(()=>{try{return localStorage.getItem('tpg_entered_player_name')||''}catch{return''}});
 const[companyId,setCompanyId]=useState(currentSession?.companies[0]?.id||'');
 const[name,setName]=useState('Executive Game 2026');
 const[companyCount,setCompanyCount]=useState(4);
 const[experienceMode,setExperienceMode]=useState<ExperienceMode>('newbie');
 const[duration,setDuration]=useState(60);
 const[maxPlayers,setMaxPlayers]=useState(6);
 const[populationMode,setPopulationMode]=useState<PopulationMode>('balanced');
 const[actionsPerRound,setActionsPerRound]=useState(defaultActionsForMode('newbie'));
 const[createError,setCreateError]=useState<string|null>(null);
 const[creating,setCreating]=useState(false);
 const selectExperienceMode=(next:ExperienceMode)=>{setExperienceMode(next);setActionsPerRound(defaultActionsForMode(next))};
 const options={experienceMode,gameDurationMinutes:duration,maxPlayersPerCompany:maxPlayers,actionsPerRound,populationMode};
 const hasName=playerName.trim().length>0;
 const rememberName=()=>{try{localStorage.setItem('tpg_entered_player_name',playerName.trim())}catch{}};
 const createAndJoin=async(count:number,autoStartTimer=false)=>{
  if(!hasName||creating)return;
  setCreating(true);setCreateError(null);rememberName();
  try{
   const res=await fetch('/api/sessions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,companyCount:count,...options})});
   const created=await res.json();
   if(!res.ok)throw new Error(created.error||'Could not create the game.');
   try{localStorage.setItem(`tpg_creator_${created.id}`,playerName.trim())}catch{}
   if(autoStartTimer){const timerResponse=await fetch(`/api/sessions/${created.id}/timer/start`,{method:'POST'});if(!timerResponse.ok)throw new Error('The solo game was created, but its clock could not be started.')}
   onJoinSession(created.id,created.companies?.[0]?.id||'',playerName.trim());
  }catch(error:any){setCreateError(error.message||'Could not create the game.');setCreating(false)}
 };
 return <div className="fixed inset-0 z-[250] grid place-items-center bg-[#080b12]/95 p-4" role="dialog" aria-modal="true" aria-labelledby="join-title">
  <div className="relative w-full max-w-xl rounded-3xl border border-slate-700 bg-slate-900 p-6 text-slate-200 shadow-2xl max-h-[94vh] overflow-y-auto">
   {onClose&&<button onClick={onClose} className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-xl border border-slate-700 text-slate-400 hover:text-white" aria-label="Close"><X className="h-4 w-4"/></button>}
   <div className="text-center"><div className="text-[10px] font-black uppercase tracking-[.2em] text-indigo-300">Organisational knowledge & resilience</div><h1 id="join-title" className="mt-1 text-2xl font-black text-white">The Performance Gap</h1><p className="mt-1 text-xs text-slate-500">Multiplayer strategic business simulation</p></div>
   <div className="mt-5 grid grid-cols-3 gap-1 rounded-xl border border-slate-700 bg-slate-950 p-1" role="tablist" aria-label="Game entry options"><Tab active={mode==='join'} onClick={()=>setMode('join')}>Join</Tab><Tab active={mode==='current'} disabled={!currentSession} onClick={()=>setMode('current')}>Current</Tab><Tab active={mode==='create'} onClick={()=>setMode('create')}>Create</Tab></div>
   {mode==='join'&&<div className="mt-5 space-y-3"><Field label="Your name"><input required value={playerName} onChange={e=>setPlayerName(e.target.value)} className="control" placeholder="e.g. Sarah Jenkins"/></Field><Field label="Game code"><input value={sessionId} onChange={e=>setSessionId(e.target.value.toUpperCase())} className="control" placeholder="e.g. KM2026"/></Field><button disabled={!hasName||!sessionId.trim()} onClick={()=>{rememberName();onJoinSession(sessionId.trim(),' ',playerName.trim())}} className="primary disabled:cursor-not-allowed disabled:opacity-40">CONNECT TO GAME <ArrowRight className="h-4 w-4"/></button>{!hasName&&<p className="text-[11px] text-amber-300">Enter your name before connecting. It is used to identify you to your team and in the game record.</p>}<p className="text-[11px] text-slate-500">If you do not choose a company, the game assigns you according to the population rule selected by the game creator.</p></div>}
   {mode==='current'&&currentSession&&<div className="mt-5 space-y-3"><Field label="Your name"><input required value={playerName} onChange={e=>setPlayerName(e.target.value)} className="control" placeholder="e.g. Sarah Jenkins"/></Field><div><div className="label">Choose a company</div><div className="mt-1 max-h-48 space-y-1.5 overflow-auto">{currentSession.companies.map(c=><button key={c.id} onClick={()=>setCompanyId(c.id)} className={`flex w-full items-center justify-between rounded-xl border p-3 text-left ${companyId===c.id?'border-indigo-400 bg-indigo-950/60':'border-slate-700 bg-slate-950'}`}><span><b className="text-white">{c.name}</b><span className="block text-[10px] text-slate-500">{c.sites.length} sites · {c.experts.length} Experts · {formatCurrency(c.turnover)}</span></span><Building2 className="h-4 w-4 text-indigo-300"/></button>)}</div></div><button disabled={!hasName||!companyId} onClick={()=>{rememberName();onJoinSession(currentSession.id,companyId,playerName.trim())}} className="primary disabled:cursor-not-allowed disabled:opacity-40">ENTER GAME <ArrowRight className="h-4 w-4"/></button>{!hasName&&<p className="text-[11px] text-amber-300">Enter your name before entering the game.</p>}</div>}
   {mode==='create'&&<div className="mt-5 space-y-4"><Field label="Your name"><input required value={playerName} onChange={e=>setPlayerName(e.target.value)} className="control" placeholder="e.g. Sarah Jenkins"/></Field><div className="grid grid-cols-2 gap-3"><Field label="Game name"><input value={name} onChange={e=>setName(e.target.value)} className="control"/></Field><Field label="Companies"><select value={companyCount} disabled={populationMode==='expand'} onChange={e=>setCompanyCount(Number(e.target.value))} className="control disabled:opacity-45">{[1,2,3,4,5,6,7,8].map(n=><option key={n} value={n}>{n} {n===1?'company':'companies'}</option>)}</select></Field></div><div><div className="label">Player experience</div><div className="mt-1 grid grid-cols-2 gap-2"><button onClick={()=>selectExperienceMode('newbie')} className={`mode-card ${experienceMode==='newbie'?'selected':''}`}><GraduationCap className="h-5 w-5"/><span><b>Newbie</b><small>Guided reveal; simpler local capability model</small></span></button><button onClick={()=>selectExperienceMode('expert')} className={`mode-card ${experienceMode==='expert'?'selected':''}`}><Gauge className="h-5 w-5"/><span><b>Expert</b><small>Full KM model; default 3 Actions/round</small></span></button></div></div><div className="grid grid-cols-3 gap-3"><Field label="Game length (minutes)"><input type="number" min={20} max={240} step={5} value={duration} onChange={e=>setDuration(Math.max(20,Number(e.target.value)))} className="control"/></Field><Field label="Max players / company"><input type="number" min={1} max={20} value={maxPlayers} onChange={e=>setMaxPlayers(Math.max(1,Number(e.target.value)))} className="control"/></Field><Field label="Actions / company / round"><input type="number" min={1} max={10} value={actionsPerRound} onChange={e=>setActionsPerRound(Math.max(1,Math.min(10,Number(e.target.value))))} className="control"/></Field></div>
    <div><div className="label">How should players fill companies?</div><div className="mt-1 grid grid-cols-2 gap-2"><button type="button" onClick={()=>setPopulationMode('expand')} className={`rounded-xl border-2 p-3 text-left ${populationMode==='expand'?'border-indigo-400 bg-indigo-950/50':'border-slate-700 bg-slate-950'}`}><div className="flex items-center gap-2"><span className={`h-4 w-4 rounded-full border-2 ${populationMode==='expand'?'border-indigo-300 bg-indigo-400':'border-slate-500'}`}/><b className="text-sm text-white">Fill, then create</b></div><div className="mt-2 flex gap-2"><MiniCompany people={5}/><MiniCompany people={3} muted/></div><p className="mt-2 text-[11px] text-slate-400">Fill Company 1 to the maximum, then automatically create Company 2, then Company 3, and so on.</p></button><button type="button" onClick={()=>setPopulationMode('balanced')} className={`rounded-xl border-2 p-3 text-left ${populationMode==='balanced'?'border-indigo-400 bg-indigo-950/50':'border-slate-700 bg-slate-950'}`}><div className="flex items-center gap-2"><span className={`h-4 w-4 rounded-full border-2 ${populationMode==='balanced'?'border-indigo-300 bg-indigo-400':'border-slate-500'}`}/><b className="text-sm text-white">Balance across companies</b></div><div className="mt-2 flex gap-1.5"><MiniCompany people={2}/><MiniCompany people={2}/><MiniCompany people={1}/></div><p className="mt-2 text-[11px] text-slate-400">Use the number in Companies and place each new player in the smallest team: C1, C2, C3, C1, C2…</p></button></div></div>
    <div className="rounded-xl border border-indigo-800 bg-indigo-950/25 p-3 text-xs text-slate-300">Defaults are tuned by mode: Newbie starts at 5 Actions per company per round; Expert starts at 3 to create stronger portfolio trade-offs.{populationMode==='expand'&&<span className="block mt-1 text-indigo-200">In Fill, then create mode the Companies field is not used; the game creates teams as they are needed.</span>}</div>{!hasName&&<p className="text-[11px] text-amber-300">Enter your name before starting a game.</p>}{createError&&<p className="text-[11px] text-rose-300">{createError}</p>}<button disabled={!hasName||creating} onClick={()=>void createAndJoin(companyCount,false)} className="primary disabled:cursor-not-allowed disabled:opacity-40"><Sparkles className="h-4 w-4"/>{creating?'CREATING…':'LAUNCH NEW GAME'}</button><button disabled={!hasName||creating} onClick={()=>void createAndJoin(1,true)} className="w-full rounded-xl border border-emerald-800 bg-emerald-950/25 py-2.5 text-xs font-black text-emerald-300 disabled:cursor-not-allowed disabled:opacity-40">LAUNCH 1-COMPANY SOLO GAME · CLOCK STARTS AUTOMATICALLY</button></div>}
  </div>
 </div>;
};
const MiniCompany:React.FC<{people:number;muted?:boolean}>=({people,muted})=><div className={`rounded-md border px-1.5 py-1 ${muted?'border-slate-700':'border-indigo-700'} bg-slate-900`}><div className="text-[8px] font-black text-slate-500">C</div><div className="flex gap-0.5">{Array.from({length:people},(_,i)=><span key={i} className={`h-2 w-2 rounded-full ${muted?'bg-slate-600':'bg-indigo-300'}`}/>)}</div></div>;
const Tab:React.FC<{active?:boolean;disabled?:boolean;onClick:()=>void;children:React.ReactNode}>=({active,disabled,onClick,children})=><button disabled={disabled} onClick={onClick} role="tab" aria-selected={active} className={`rounded-lg py-2 text-xs font-black disabled:opacity-30 ${active?'bg-indigo-600 text-white':'text-slate-400 hover:text-white'}`}>{children}</button>;
const Field:React.FC<{label:string;children:React.ReactNode}>=({label,children})=><label className="block"><span className="label">{label}</span>{children}</label>;
