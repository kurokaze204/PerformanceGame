import React,{useState}from'react';
import{ArrowRight,Building2,Gauge,GraduationCap,Sparkles,UserRound,X}from'lucide-react';
import type{GameEndMode,GameSessionV2,ExperienceMode,PopulationMode}from'../types/gameV2.ts';
import{defaultActionsForMode}from'../engine/learningCurveBalanceV1.ts';
import{formatCurrency}from'../utils/format.ts';

interface CreateOptions{experienceMode:ExperienceMode;gameDurationMinutes:number;maxPlayersPerCompany:number;actionsPerRound:number;populationMode:PopulationMode;gameEndMode:GameEndMode;finalRoundCount:number;}
interface Props{
 currentSession:GameSessionV2|null;
 onJoinSession:(sessionId:string,companyId:string,playerName:string)=>void;
 onCreateNewSession:(sessionName:string,companyCount:number,options:CreateOptions)=>void;
 onSoloStart:(options:CreateOptions)=>void;
 initialMode?:'solo'|'join'|'current'|'create';
 onClose?:()=>void;
}

export const SessionJoinModalV2:React.FC<Props>=({currentSession,onJoinSession,initialMode='solo',onClose})=>{
 const[mode,setMode]=useState<'solo'|'join'|'current'|'create'>(initialMode==='join'?'solo':initialMode);
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
 const[gameEndMode,setGameEndMode]=useState<GameEndMode>('time');
 const[finalRoundCount,setFinalRoundCount]=useState(30);
 const[soloExperienceMode,setSoloExperienceMode]=useState<ExperienceMode>('newbie');
 const[soloDuration,setSoloDuration]=useState(45);
 const[soloActionsPerRound,setSoloActionsPerRound]=useState(defaultActionsForMode('newbie'));
 const[soloGameEndMode,setSoloGameEndMode]=useState<GameEndMode>('time');
 const[soloFinalRoundCount,setSoloFinalRoundCount]=useState(30);
 const[createError,setCreateError]=useState<string|null>(null);
 const[creating,setCreating]=useState(false);
 const selectExperienceMode=(next:ExperienceMode)=>{setExperienceMode(next);setActionsPerRound(defaultActionsForMode(next));if(next==='newbie')setGameEndMode('time')};
 const selectSoloExperienceMode=(next:ExperienceMode)=>{setSoloExperienceMode(next);setSoloActionsPerRound(defaultActionsForMode(next));setSoloDuration(next==='newbie'?45:60);if(next==='newbie')setSoloGameEndMode('time')};
 const options:CreateOptions={experienceMode,gameDurationMinutes:duration,maxPlayersPerCompany:maxPlayers,actionsPerRound,populationMode,gameEndMode:experienceMode==='expert'?gameEndMode:'time',finalRoundCount};
 const soloOptions:CreateOptions={experienceMode:soloExperienceMode,gameDurationMinutes:soloDuration,maxPlayersPerCompany:1,actionsPerRound:soloActionsPerRound,populationMode:'balanced',gameEndMode:soloExperienceMode==='expert'?soloGameEndMode:'time',finalRoundCount:soloFinalRoundCount};
 const hasName=playerName.trim().length>0;
 const rememberName=()=>{try{localStorage.setItem('tpg_entered_player_name',playerName.trim())}catch{}};
 const createAndJoin=async(count:number,gameName:string,selectedOptions:CreateOptions,autoStartTimer=false)=>{
  if(!hasName||creating)return;
  setCreating(true);setCreateError(null);rememberName();
  try{
   const res=await fetch('/api/sessions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:gameName,companyCount:count,...selectedOptions})});
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
   <div className="text-center"><div className="text-[10px] font-black uppercase tracking-[.2em] text-indigo-300">Organisational knowledge & resilience</div><h1 id="join-title" className="mt-1 text-2xl font-black text-white">The Performance Gap</h1><p className="mt-1 text-xs text-slate-500">Strategic business simulation</p></div>
   <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-1 rounded-xl border border-slate-700 bg-slate-950 p-1" role="tablist" aria-label="Game entry options"><Tab active={mode==='solo'} onClick={()=>setMode('solo')}>Solo game</Tab><Tab active={mode==='join'} onClick={()=>setMode('join')}>Join</Tab><Tab active={mode==='current'} disabled={!currentSession} onClick={()=>setMode('current')}>Current</Tab><Tab active={mode==='create'} onClick={()=>setMode('create')}>Create</Tab></div>

   {mode==='solo'&&<div className="mt-5 space-y-4">
    <div className="rounded-2xl border border-emerald-800 bg-emerald-950/25 p-4"><div className="flex items-start gap-3"><UserRound className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300"/><div><h2 className="font-black text-white">Play by yourself</h2><p className="mt-1 text-xs leading-relaxed text-slate-300">Run one company through a series of business Challenges. Each round, decide how to use the knowledge, people and resources available to you. The simulation introduces its mechanics progressively, so you can start without a facilitator briefing.</p></div></div></div>
    <Field label="Your name"><input required value={playerName} onChange={e=>setPlayerName(e.target.value)} className="control" placeholder="e.g. Sarah Jenkins"/></Field>
    <div><div className="label">How familiar are you with Knowledge Management?</div><div className="mt-1 grid grid-cols-2 gap-2"><button onClick={()=>selectSoloExperienceMode('newbie')} className={`mode-card ${soloExperienceMode==='newbie'?'selected':''}`}><GraduationCap className="h-5 w-5"/><span><b>Newbie</b><small>Recommended first game. Capabilities are introduced gradually.</small></span></button><button onClick={()=>selectSoloExperienceMode('expert')} className={`mode-card ${soloExperienceMode==='expert'?'selected':''}`}><Gauge className="h-5 w-5"/><span><b>Expert</b><small>Full KM model and Charts available from the start.</small></span></button></div></div>
    {soloExperienceMode==='expert'&&<EndMode value={soloGameEndMode} onChange={setSoloGameEndMode}/>} 
    <div className="grid grid-cols-2 gap-3">{soloGameEndMode==='rounds'&&soloExperienceMode==='expert'?<Field label="Rounds before Final Challenge"><input type="number" min={1} max={200} value={soloFinalRoundCount} onChange={e=>setSoloFinalRoundCount(Math.max(1,Math.min(200,Number(e.target.value))))} className="control"/></Field>:<Field label="Game length (minutes)"><input type="number" min={20} max={240} step={5} value={soloDuration} onChange={e=>setSoloDuration(Math.max(20,Number(e.target.value)))} className="control"/></Field>}<Field label="Actions available each round"><input type="number" min={1} max={10} value={soloActionsPerRound} onChange={e=>setSoloActionsPerRound(Math.max(1,Math.min(10,Number(e.target.value))))} className="control"/></Field></div>
    <div className="rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs leading-relaxed text-slate-300">{soloExperienceMode==='newbie'?`Newbie starts with ${soloActionsPerRound} Actions per round and a ${soloDuration}-minute clock. The Final Challenge begins in the last 10 minutes.`:soloGameEndMode==='rounds'?`Expert mode gives you the full model from Round 1. The Final Challenge begins after Knowledge Risk in Round ${soloFinalRoundCount}.`:`Expert mode gives you the full model from Round 1 with ${soloActionsPerRound} Actions per round. The Final Challenge begins in the last 10 minutes of the ${soloDuration}-minute game.`}</div>
    {!hasName&&<p className="text-[11px] text-amber-300">Enter your name before starting.</p>}{createError&&<p className="text-[11px] text-rose-300">{createError}</p>}<button disabled={!hasName||creating} onClick={()=>void createAndJoin(1,'Solo Performance Gap',soloOptions,soloOptions.gameEndMode==='time')} className="primary disabled:cursor-not-allowed disabled:opacity-40"><Sparkles className="h-4 w-4"/>{creating?'CREATING…':'START SOLO GAME'}</button>
   </div>}

   {mode==='join'&&<div className="mt-5 space-y-3"><Field label="Your name"><input required value={playerName} onChange={e=>setPlayerName(e.target.value)} className="control" placeholder="e.g. Sarah Jenkins"/></Field><Field label="Game code"><input value={sessionId} onChange={e=>setSessionId(e.target.value.toUpperCase())} className="control" placeholder="e.g. KM2026"/></Field><button disabled={!hasName||!sessionId.trim()} onClick={()=>{rememberName();onJoinSession(sessionId.trim(),' ',playerName.trim())}} className="primary disabled:cursor-not-allowed disabled:opacity-40">CONNECT TO GAME <ArrowRight className="h-4 w-4"/></button>{!hasName&&<p className="text-[11px] text-amber-300">Enter your name before connecting.</p>}<p className="text-[11px] text-slate-500">If you do not choose a company, the game assigns you according to the population rule selected by the game creator.</p></div>}

   {mode==='current'&&currentSession&&<div className="mt-5 space-y-3"><Field label="Your name"><input required value={playerName} onChange={e=>setPlayerName(e.target.value)} className="control" placeholder="e.g. Sarah Jenkins"/></Field><div><div className="label">Choose a company</div><div className="mt-1 max-h-48 space-y-1.5 overflow-auto">{currentSession.companies.map(c=><button key={c.id} onClick={()=>setCompanyId(c.id)} className={`flex w-full items-center justify-between rounded-xl border p-3 text-left ${companyId===c.id?'border-indigo-400 bg-indigo-950/60':'border-slate-700 bg-slate-950'}`}><span><b className="text-white">{c.name}</b><span className="block text-[10px] text-slate-500">{c.sites.length} sites · {c.experts.length} Experts · {formatCurrency(c.turnover)}</span></span><Building2 className="h-4 w-4 text-indigo-300"/></button>)}</div></div><button disabled={!hasName||!companyId} onClick={()=>{rememberName();onJoinSession(currentSession.id,companyId,playerName.trim())}} className="primary disabled:cursor-not-allowed disabled:opacity-40">ENTER GAME <ArrowRight className="h-4 w-4"/></button></div>}

   {mode==='create'&&<div className="mt-5 space-y-4"><Field label="Your name"><input required value={playerName} onChange={e=>setPlayerName(e.target.value)} className="control" placeholder="e.g. Sarah Jenkins"/></Field><div className="grid grid-cols-2 gap-3"><Field label="Game name"><input value={name} onChange={e=>setName(e.target.value)} className="control"/></Field><Field label="Companies"><select value={companyCount} disabled={populationMode==='expand'} onChange={e=>setCompanyCount(Number(e.target.value))} className="control disabled:opacity-45">{[1,2,3,4,5,6,7,8].map(n=><option key={n} value={n}>{n} {n===1?'company':'companies'}</option>)}</select></Field></div><div><div className="label">Player experience</div><div className="mt-1 grid grid-cols-2 gap-2"><button onClick={()=>selectExperienceMode('newbie')} className={`mode-card ${experienceMode==='newbie'?'selected':''}`}><GraduationCap className="h-5 w-5"/><span><b>Newbie</b><small>Guided reveal; simpler local capability model</small></span></button><button onClick={()=>selectExperienceMode('expert')} className={`mode-card ${experienceMode==='expert'?'selected':''}`}><Gauge className="h-5 w-5"/><span><b>Expert</b><small>Full KM model; default 3 Actions/round</small></span></button></div></div>{experienceMode==='expert'&&<EndMode value={gameEndMode} onChange={setGameEndMode}/>}<div className="grid grid-cols-3 gap-3">{experienceMode==='expert'&&gameEndMode==='rounds'?<Field label="Rounds before Final"><input type="number" min={1} max={200} value={finalRoundCount} onChange={e=>setFinalRoundCount(Math.max(1,Math.min(200,Number(e.target.value))))} className="control"/></Field>:<Field label="Game length (minutes)"><input type="number" min={20} max={240} step={5} value={duration} onChange={e=>setDuration(Math.max(20,Number(e.target.value)))} className="control"/></Field>}<Field label="Max players / company"><input type="number" min={1} max={20} value={maxPlayers} onChange={e=>setMaxPlayers(Math.max(1,Number(e.target.value)))} className="control"/></Field><Field label="Actions / company / round"><input type="number" min={1} max={10} value={actionsPerRound} onChange={e=>setActionsPerRound(Math.max(1,Math.min(10,Number(e.target.value))))} className="control"/></Field></div>
    <div><div className="label">How should players fill companies?</div><div className="mt-1 grid grid-cols-2 gap-2"><button type="button" onClick={()=>setPopulationMode('expand')} className={`rounded-xl border-2 p-3 text-left ${populationMode==='expand'?'border-indigo-400 bg-indigo-950/50':'border-slate-700 bg-slate-950'}`}><b className="text-sm text-white">Fill, then create</b><p className="mt-2 text-[11px] text-slate-400">Fill Company 1 to the maximum, then automatically create the next company as needed.</p></button><button type="button" onClick={()=>setPopulationMode('balanced')} className={`rounded-xl border-2 p-3 text-left ${populationMode==='balanced'?'border-indigo-400 bg-indigo-950/50':'border-slate-700 bg-slate-950'}`}><b className="text-sm text-white">Balance across companies</b><p className="mt-2 text-[11px] text-slate-400">Use the number in Companies and place each new player in the smallest team.</p></button></div></div>
    <div className="rounded-xl border border-indigo-800 bg-indigo-950/25 p-3 text-xs text-slate-300">Newbie defaults to 5 Actions per company per round; Expert defaults to 3 to create stronger portfolio trade-offs.</div>{!hasName&&<p className="text-[11px] text-amber-300">Enter your name before starting a game.</p>}{createError&&<p className="text-[11px] text-rose-300">{createError}</p>}<button disabled={!hasName||creating} onClick={()=>void createAndJoin(companyCount,name,options,false)} className="primary disabled:cursor-not-allowed disabled:opacity-40"><Sparkles className="h-4 w-4"/>{creating?'CREATING…':'LAUNCH NEW GAME'}</button></div>}
  </div>
 </div>;
};

const EndMode:React.FC<{value:GameEndMode;onChange:(value:GameEndMode)=>void}>=({value,onChange})=><div><div className="label">End game by</div><div className="mt-1 grid grid-cols-2 gap-2"><button type="button" onClick={()=>onChange('time')} className={`rounded-xl border-2 p-3 text-left ${value==='time'?'border-indigo-400 bg-indigo-950/50':'border-slate-700 bg-slate-950'}`}><b className="text-sm text-white">Time</b><p className="mt-1 text-[11px] text-slate-400">Final Challenge begins in the last 10 minutes.</p></button><button type="button" onClick={()=>onChange('rounds')} className={`rounded-xl border-2 p-3 text-left ${value==='rounds'?'border-indigo-400 bg-indigo-950/50':'border-slate-700 bg-slate-950'}`}><b className="text-sm text-white">Round count</b><p className="mt-1 text-[11px] text-slate-400">Final Challenge begins after a chosen round.</p></button></div></div>;
const Tab:React.FC<{active?:boolean;disabled?:boolean;onClick:()=>void;children:React.ReactNode}>=({active,disabled,onClick,children})=><button disabled={disabled} onClick={onClick} role="tab" aria-selected={active} className={`rounded-lg py-2 text-xs font-black disabled:opacity-30 ${active?'bg-indigo-600 text-white':'text-slate-400 hover:text-white'}`}>{children}</button>;
const Field:React.FC<{label:string;children:React.ReactNode}>=({label,children})=><label className="block"><span className="label">{label}</span>{children}</label>;
