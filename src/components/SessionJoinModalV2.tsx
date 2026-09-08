import React,{useEffect,useMemo,useState}from'react';
import{ArrowRight,CheckCircle2,Copy,Gauge,GraduationCap,LockKeyhole,PlayCircle,RefreshCw,Sparkles,UsersRound,Video,X}from'lucide-react';
import type{GameEndMode,GameSessionV2,ExperienceMode,PopulationMode}from'../types/gameV2.ts';
import{defaultActionsForMode}from'../engine/learningCurveBalanceV1.ts';

interface CreateOptions{experienceMode:ExperienceMode;gameDurationMinutes:number;maxPlayersPerCompany:number;actionsPerRound:number;populationMode:PopulationMode;gameEndMode:GameEndMode;finalRoundCount:number;}
interface PublicGame{id:string;title:string;round:number;phase:string;companiesCount:number;createdAt:string;updatedAt:string;completed:boolean;}
interface Props{
 currentSession:GameSessionV2|null;
 onJoinSession:(sessionId:string,companyId:string,playerName:string)=>void;
 onCreateNewSession:(sessionName:string,companyCount:number,options:CreateOptions)=>void;
 onSoloStart:(options:CreateOptions)=>void;
 initialMode?:'solo'|'join'|'current'|'create';
 onClose?:()=>void;
}

const makeGameCode=()=>`KM${Math.random().toString(36).slice(2,7).toUpperCase()}`;
const ageLabel=(date:string)=>{const ms=Math.max(0,Date.now()-new Date(date).getTime()),hours=Math.floor(ms/3600000);return hours<1?'Started recently':hours<24?`Started ${hours}h ago`:`Started ${Math.floor(hours/24)}d ago`;};

export const SessionJoinModalV2:React.FC<Props>=({onJoinSession,initialMode='solo',onClose})=>{
 const resolvedInitialMode:'solo'|'join'|'create'=initialMode==='create'?'create':'solo';
 const[mode,setMode]=useState<'solo'|'join'|'create'>(resolvedInitialMode);
 const[playerName,setPlayerName]=useState(()=>{try{return localStorage.getItem('tpg_entered_player_name')||''}catch{return''}});
 const[joinCode,setJoinCode]=useState('');
 const[publicGames,setPublicGames]=useState<PublicGame[]>([]);
 const[archiveGames,setArchiveGames]=useState<PublicGame[]>([]);
 const[showArchive,setShowArchive]=useState(false);
 const[loadingGames,setLoadingGames]=useState(false);
 const[gameName,setGameName]=useState('Executive Game 2026');
 const[gameCode,setGameCode]=useState(makeGameCode);
 const[facilitatorPassword,setFacilitatorPassword]=useState('');
 const[isPublic,setIsPublic]=useState(false);
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
 const hasName=playerName.trim().length>0;
 const rememberName=()=>{try{localStorage.setItem('tpg_entered_player_name',playerName.trim())}catch{}};
 const multiplayerOptions:CreateOptions={experienceMode,gameDurationMinutes:duration,maxPlayersPerCompany:maxPlayers,actionsPerRound,populationMode,gameEndMode:experienceMode==='expert'?gameEndMode:'time',finalRoundCount};
 const soloOptions:CreateOptions={experienceMode:soloExperienceMode,gameDurationMinutes:soloDuration,maxPlayersPerCompany:1,actionsPerRound:soloActionsPerRound,populationMode:'balanced',gameEndMode:soloExperienceMode==='expert'?soloGameEndMode:'time',finalRoundCount:soloFinalRoundCount};

 const loadPublicGames=async(archive=false)=>{
  setLoadingGames(true);
  try{const r=await fetch(`/api/public-games${archive?'?archived=true':''}`);if(r.ok){const data=await r.json();archive?setArchiveGames(data):setPublicGames(data)}}finally{setLoadingGames(false)}
 };
 useEffect(()=>{if(mode==='join')void loadPublicGames(false)},[mode]);

 const selectExperience=(next:ExperienceMode)=>{setExperienceMode(next);setActionsPerRound(defaultActionsForMode(next));if(next==='newbie')setGameEndMode('time')};
 const selectSoloExperience=(next:ExperienceMode)=>{setSoloExperienceMode(next);setSoloActionsPerRound(defaultActionsForMode(next));setSoloDuration(next==='newbie'?45:60);if(next==='newbie')setSoloGameEndMode('time')};
 const copyCode=()=>navigator.clipboard?.writeText(gameCode);

 const createAndJoin=async(args:{code:string;name:string;count:number;options:CreateOptions;publicGame:boolean;password?:string;autoStart?:boolean})=>{
  if(!hasName||creating)return;
  setCreating(true);setCreateError(null);rememberName();
  try{
   const res=await fetch('/api/sessions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:args.code,name:args.name,companyCount:args.count,...args.options,isPublic:args.publicGame,facilitatorPassword:args.password||''})});
   const created=await res.json();
   if(!res.ok)throw new Error(created.error||'Could not create the game.');
   try{localStorage.setItem(`tpg_creator_${created.id}`,playerName.trim())}catch{}
   if(args.autoStart){const timerResponse=await fetch(`/api/sessions/${created.id}/timer/start`,{method:'POST'});if(!timerResponse.ok)throw new Error('The game was created, but its clock could not be started.')}
   onJoinSession(created.id,created.companies?.[0]?.id||'',playerName.trim());
  }catch(error:any){setCreateError(error.message||'Could not create the game.');setCreating(false)}
 };

 const activeArchive=useMemo(()=>archiveGames,[archiveGames]);
 return <div className="fixed inset-0 z-[250] bg-[#080b12]/95 p-3 sm:p-5 overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="join-title">
  <div className="relative mx-auto w-full max-w-6xl rounded-3xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden">
   {onClose&&<button onClick={onClose} className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-xl border border-slate-700 bg-slate-950 text-slate-400 hover:text-white" aria-label="Close"><X className="h-4 w-4"/></button>}
   <div className="grid lg:grid-cols-[minmax(0,1fr)_360px]">
    <section className="p-5 sm:p-7">
     <div><div className="text-[10px] font-black uppercase tracking-[.2em] text-indigo-300">Organisational knowledge & resilience</div><h1 id="join-title" className="mt-1 text-3xl font-black text-white">The Performance Gap</h1><p className="mt-1 text-sm text-slate-400">Choose how you want to play. You can start alone, join someone else, or set up a game for a group.</p></div>

     <div className="mt-6 grid sm:grid-cols-3 gap-2" role="tablist" aria-label="How do you want to play?">
      <ModeChoice active={mode==='solo'} icon={<PlayCircle className="h-5 w-5"/>} title="Play solo" subtitle="Best place to start" onClick={()=>setMode('solo')}/>
      <ModeChoice active={mode==='join'} icon={<ArrowRight className="h-5 w-5"/>} title="Join a game" subtitle="Use a code or public game" onClick={()=>setMode('join')}/>
      <ModeChoice active={mode==='create'} icon={<UsersRound className="h-5 w-5"/>} title="Create multiplayer" subtitle="Set up a group session" onClick={()=>setMode('create')}/>
     </div>

     {mode==='solo'&&<div className="mt-6 space-y-5">
      <Intro title="Play by yourself" text="Run one company and learn the simulation as you go. No facilitator or game code is needed."/>
      <Field label="Your name"><input value={playerName} onChange={e=>setPlayerName(e.target.value)} className="control" placeholder="e.g. Sarah Jenkins"/></Field>
      <ExperiencePicker value={soloExperienceMode} onChange={selectSoloExperience}/>
      {soloExperienceMode==='expert'&&<EndMode value={soloGameEndMode} onChange={setSoloGameEndMode}/>} 
      <div className="grid sm:grid-cols-2 gap-3">{soloExperienceMode==='expert'&&soloGameEndMode==='rounds'?<Field label="Rounds before Final Challenge"><input type="number" min={1} max={200} value={soloFinalRoundCount} onChange={e=>setSoloFinalRoundCount(Math.max(1,Math.min(200,Number(e.target.value))))} className="control"/></Field>:<Field label="Game length"><select value={soloDuration} onChange={e=>setSoloDuration(Number(e.target.value))} className="control"><option value={30}>30 minutes</option><option value={45}>45 minutes</option><option value={60}>60 minutes</option><option value={90}>90 minutes</option></select></Field>}<Field label="Actions each round"><input type="number" min={1} max={10} value={soloActionsPerRound} onChange={e=>setSoloActionsPerRound(Math.max(1,Math.min(10,Number(e.target.value))))} className="control"/></Field></div>
      <Summary>{soloExperienceMode==='newbie'?`Recommended first game: ${soloDuration} minutes with ${soloActionsPerRound} Actions per round. Knowledge-management capabilities are introduced gradually.`:soloGameEndMode==='rounds'?`Expert game: full model from Round 1, with the Final Challenge after Round ${soloFinalRoundCount}.`:`Expert game: full model from Round 1, ${soloDuration} minutes, ${soloActionsPerRound} Actions per round.`}</Summary>
      {!hasName&&<Hint>Enter your name to start.</Hint>}{createError&&<ErrorText>{createError}</ErrorText>}
      <button disabled={!hasName||creating} onClick={()=>void createAndJoin({code:makeGameCode(),name:'Solo Performance Gap',count:1,options:soloOptions,publicGame:false,autoStart:soloOptions.gameEndMode==='time'})} className="primary text-base disabled:opacity-40"><Sparkles className="h-5 w-5"/>{creating?'STARTING…':'START SOLO GAME'}</button>
     </div>}

     {mode==='join'&&<div className="mt-6 space-y-5">
      <Intro title="Join a game" text="If somebody gave you a game code, enter it below. Or choose one of the public games currently accepting players."/>
      <Field label="Your name"><input value={playerName} onChange={e=>setPlayerName(e.target.value)} className="control" placeholder="e.g. Sarah Jenkins"/></Field>
      <div className="rounded-2xl border border-indigo-700 bg-indigo-950/25 p-4"><div className="text-sm font-black text-white">I have a game code</div><div className="mt-2 flex gap-2"><input value={joinCode} onChange={e=>setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g,''))} className="control font-black tracking-wider" placeholder="e.g. KM7Q2X"/><button disabled={!hasName||!joinCode.trim()} onClick={()=>{rememberName();onJoinSession(joinCode.trim(),' ',playerName.trim())}} className="rounded-xl bg-indigo-600 px-5 text-xs font-black text-white disabled:opacity-40">JOIN</button></div></div>
      <div><div className="flex items-center justify-between gap-3"><div><h2 className="font-black text-white">Public games running now</h2><p className="text-xs text-slate-500">Public games started in the last 48 hours disappear from this list when they finish.</p></div><button onClick={()=>void loadPublicGames(false)} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-700 text-slate-400" aria-label="Refresh public games"><RefreshCw className={`h-4 w-4 ${loadingGames?'animate-spin':''}`}/></button></div>
       <div className="mt-3 space-y-2">{publicGames.length?publicGames.map(game=><PublicGameCard key={game.id} game={game} canJoin={hasName} onJoin={()=>{rememberName();onJoinSession(game.id,' ',playerName.trim())}}/>):<EmptyGames loading={loadingGames}/>}</div>
      </div>
      <button onClick={()=>{const next=!showArchive;setShowArchive(next);if(next&&!archiveGames.length)void loadPublicGames(true)}} className="w-full rounded-xl border border-slate-700 bg-slate-950 py-3 text-xs font-black text-slate-300">{showArchive?'HIDE ARCHIVED GAMES':'SHOW ARCHIVED PUBLIC GAMES'}</button>
      {showArchive&&<div className="space-y-2"><p className="text-xs text-slate-500">Older open games and completed public games.</p>{activeArchive.length?activeArchive.map(game=><PublicGameCard key={game.id} game={game} canJoin={hasName&&!game.completed} onJoin={()=>{rememberName();onJoinSession(game.id,' ',playerName.trim())}}/>):<EmptyGames loading={loadingGames}/>}</div>}
     </div>}

     {mode==='create'&&<div className="mt-6 space-y-5">
      <Intro title="Create a multiplayer game" text="Set the game up here, then share the game code with your players. You can control the session later using the facilitator password you choose below."/>
      <Field label="Your name"><input value={playerName} onChange={e=>setPlayerName(e.target.value)} className="control" placeholder="e.g. Sarah Jenkins"/></Field>
      <div className="grid sm:grid-cols-2 gap-3"><Field label="Game name"><input value={gameName} onChange={e=>setGameName(e.target.value)} className="control"/></Field><Field label="Game code"><div className="flex gap-2"><div className="control flex items-center font-black tracking-wider text-indigo-200">{gameCode}</div><button onClick={copyCode} className="grid w-11 place-items-center rounded-xl border border-slate-700 bg-slate-950 text-slate-300" title="Copy game code"><Copy className="h-4 w-4"/></button><button onClick={()=>setGameCode(makeGameCode())} className="grid w-11 place-items-center rounded-xl border border-slate-700 bg-slate-950 text-slate-300" title="Generate another code"><RefreshCw className="h-4 w-4"/></button></div></Field></div>
      <div className="rounded-2xl border border-amber-800 bg-amber-950/20 p-4"><div className="flex items-center gap-2 text-sm font-black text-white"><LockKeyhole className="h-4 w-4 text-amber-300"/>Facilitator access</div><p className="mt-1 text-xs text-slate-400">Choose a password for this game. It can open the facilitator control room. Your master facilitator password will also continue to work.</p><div className="mt-3"><Field label="Facilitator password"><input type="password" value={facilitatorPassword} onChange={e=>setFacilitatorPassword(e.target.value)} className="control" autoComplete="new-password" placeholder="Choose a password for this game"/></Field></div></div>
      <label className={`flex cursor-pointer gap-3 rounded-2xl border p-4 ${isPublic?'border-emerald-600 bg-emerald-950/25':'border-slate-700 bg-slate-950'}`}><input type="checkbox" checked={isPublic} onChange={e=>setIsPublic(e.target.checked)} className="mt-1 h-4 w-4"/><span><b className="text-sm text-white">Make this game public</b><small className="mt-1 block text-xs leading-relaxed text-slate-400">Public games appear on the Join screen for 48 hours while they are running. Finished games move to the archive. Private games can only be joined with the code.</small></span></label>
      <div className="grid sm:grid-cols-2 gap-3"><Field label="Companies"><select value={companyCount} disabled={populationMode==='expand'} onChange={e=>setCompanyCount(Number(e.target.value))} className="control disabled:opacity-45">{[1,2,3,4,5,6,7,8].map(n=><option key={n} value={n}>{n} {n===1?'company':'companies'}</option>)}</select></Field><Field label="Max players per company"><input type="number" min={1} max={20} value={maxPlayers} onChange={e=>setMaxPlayers(Math.max(1,Number(e.target.value)))} className="control"/></Field></div>
      <ExperiencePicker value={experienceMode} onChange={selectExperience}/>
      {experienceMode==='expert'&&<EndMode value={gameEndMode} onChange={setGameEndMode}/>} 
      <div className="grid sm:grid-cols-2 gap-3">{experienceMode==='expert'&&gameEndMode==='rounds'?<Field label="Rounds before Final Challenge"><input type="number" min={1} max={200} value={finalRoundCount} onChange={e=>setFinalRoundCount(Math.max(1,Math.min(200,Number(e.target.value))))} className="control"/></Field>:<Field label="Game length"><input type="number" min={20} max={240} step={5} value={duration} onChange={e=>setDuration(Math.max(20,Number(e.target.value)))} className="control"/></Field>}<Field label="Actions per company per round"><input type="number" min={1} max={10} value={actionsPerRound} onChange={e=>setActionsPerRound(Math.max(1,Math.min(10,Number(e.target.value))))} className="control"/></Field></div>
      <div><div className="label">How should players fill companies?</div><div className="mt-1 grid sm:grid-cols-2 gap-2"><ChoiceCard selected={populationMode==='expand'} title="Fill one, then create another" text="Start with Company 1. When it reaches the player limit, the game creates Company 2, then Company 3." onClick={()=>setPopulationMode('expand')}/><ChoiceCard selected={populationMode==='balanced'} title="Balance across companies" text="Create the chosen number of companies now and place each new player into the smallest team." onClick={()=>setPopulationMode('balanced')}/></div></div>
      <Summary>Share code <b className="text-white">{gameCode}</b> with players. {isPublic?'It will also appear in the public games list while active.':'It will remain private and only people with the code can find it.'}</Summary>
      {!hasName&&<Hint>Enter your name.</Hint>}{!facilitatorPassword.trim()&&<Hint>Choose a facilitator password before creating the game.</Hint>}{createError&&<ErrorText>{createError}</ErrorText>}
      <button disabled={!hasName||!facilitatorPassword.trim()||creating} onClick={()=>void createAndJoin({code:gameCode,name:gameName,count:companyCount,options:multiplayerOptions,publicGame:isPublic,password:facilitatorPassword})} className="primary text-base disabled:opacity-40"><UsersRound className="h-5 w-5"/>{creating?'CREATING…':'CREATE MULTIPLAYER GAME'}</button>
     </div>}
    </section>

    <aside className="border-t lg:border-t-0 lg:border-l border-slate-700 bg-slate-950/70 p-5 sm:p-6">
     <div className="sticky top-5"><div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.18em] text-violet-300"><Video className="h-4 w-4"/>How to play</div><h2 className="mt-2 text-xl font-black text-white">New to The Performance Gap?</h2><p className="mt-2 text-sm leading-relaxed text-slate-400">A short tutorial video will live here and remain visible whichever way you choose to play.</p>
      <div className="mt-5 aspect-video rounded-2xl border-2 border-dashed border-slate-700 bg-slate-900 grid place-items-center text-center p-5"><div><div className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-violet-700 bg-violet-950/40 text-violet-300"><PlayCircle className="h-6 w-6"/></div><div className="mt-3 text-sm font-black text-white">Tutorial video coming soon</div><div className="mt-1 text-xs text-slate-500">This space is ready for your recorded introduction.</div></div></div>
      <div className="mt-5 space-y-3 text-xs text-slate-400"><Step n="1" text="You run a business facing changing Challenges."/><Step n="2" text="You decide how to use expertise, knowledge and resources."/><Step n="3" text="Your choices change the organisation's capability and resilience."/></div>
     </div>
    </aside>
   </div>
  </div>
 </div>;
};

const ModeChoice:React.FC<{active:boolean;icon:React.ReactNode;title:string;subtitle:string;onClick:()=>void}>=({active,icon,title,subtitle,onClick})=><button onClick={onClick} role="tab" aria-selected={active} className={`rounded-2xl border-2 p-4 text-left transition ${active?'border-indigo-400 bg-indigo-950/50':'border-slate-700 bg-slate-950 hover:border-slate-500'}`}><div className={`flex h-9 w-9 items-center justify-center rounded-xl ${active?'bg-indigo-600 text-white':'bg-slate-900 text-slate-400'}`}>{icon}</div><div className="mt-3 font-black text-white">{title}</div><div className="mt-0.5 text-[11px] text-slate-500">{subtitle}</div></button>;
const Intro:React.FC<{title:string;text:string}>=({title,text})=><div className="rounded-2xl border border-slate-700 bg-slate-950 p-4"><h2 className="text-lg font-black text-white">{title}</h2><p className="mt-1 text-sm leading-relaxed text-slate-400">{text}</p></div>;
const Field:React.FC<{label:string;children:React.ReactNode}>=({label,children})=><label className="block"><span className="label">{label}</span>{children}</label>;
const ExperiencePicker:React.FC<{value:ExperienceMode;onChange:(v:ExperienceMode)=>void}>=({value,onChange})=><div><div className="label">Knowledge Management experience</div><div className="mt-1 grid sm:grid-cols-2 gap-2"><button onClick={()=>onChange('newbie')} className={`mode-card ${value==='newbie'?'selected':''}`}><GraduationCap className="h-5 w-5"/><span><b>Newbie</b><small>Recommended first game. Features are introduced gradually.</small></span></button><button onClick={()=>onChange('expert')} className={`mode-card ${value==='expert'?'selected':''}`}><Gauge className="h-5 w-5"/><span><b>Expert</b><small>Full KM model and Charts from the start.</small></span></button></div></div>;
const EndMode:React.FC<{value:GameEndMode;onChange:(v:GameEndMode)=>void}>=({value,onChange})=><div><div className="label">When should the Final Challenge begin?</div><div className="mt-1 grid grid-cols-2 gap-2"><ChoiceCard selected={value==='time'} title="By time" text="Use a game clock and finish in the final 10-minute window." onClick={()=>onChange('time')}/><ChoiceCard selected={value==='rounds'} title="By round count" text="Play a fixed number of normal rounds, then begin the Final Challenge." onClick={()=>onChange('rounds')}/></div></div>;
const ChoiceCard:React.FC<{selected:boolean;title:string;text:string;onClick:()=>void}>=({selected,title,text,onClick})=><button type="button" onClick={onClick} className={`rounded-xl border-2 p-3 text-left ${selected?'border-indigo-400 bg-indigo-950/40':'border-slate-700 bg-slate-950'}`}><div className="flex items-start gap-2"><span className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 ${selected?'border-indigo-300 bg-indigo-400':'border-slate-500'}`}/><span><b className="text-sm text-white">{title}</b><small className="mt-1 block text-[11px] leading-relaxed text-slate-400">{text}</small></span></div></button>;
const Summary:React.FC<{children:React.ReactNode}>=({children})=><div className="rounded-xl border border-indigo-800 bg-indigo-950/25 p-3 text-xs leading-relaxed text-slate-300">{children}</div>;
const Hint:React.FC<{children:React.ReactNode}>=({children})=><p className="text-[11px] text-amber-300">{children}</p>;
const ErrorText:React.FC<{children:React.ReactNode}>=({children})=><p className="text-[11px] text-rose-300">{children}</p>;
const Step:React.FC<{n:string;text:string}>=({n,text})=><div className="flex gap-3"><div className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-slate-700 bg-slate-900 font-black text-slate-300">{n}</div><p className="pt-1 leading-relaxed">{text}</p></div>;
const EmptyGames:React.FC<{loading:boolean}>=({loading})=><div className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-center text-xs text-slate-500">{loading?'Checking for public games…':'No public games are available in this section right now.'}</div>;
const PublicGameCard:React.FC<{game:PublicGame;canJoin:boolean;onJoin:()=>void}>=({game,canJoin,onJoin})=><div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-slate-700 bg-slate-950 p-3"><div className="flex-1 min-w-0"><div className="flex flex-wrap items-center gap-2"><b className="text-sm text-white truncate">{game.title}</b>{game.completed?<span className="rounded-full border border-slate-600 px-2 py-0.5 text-[9px] font-black uppercase text-slate-400">Finished</span>:<span className="rounded-full border border-emerald-700 px-2 py-0.5 text-[9px] font-black uppercase text-emerald-300">Open</span>}</div><div className="mt-1 text-[11px] text-slate-500"><span className="font-black text-indigo-300">{game.id}</span> · {game.companiesCount} {game.companiesCount===1?'company':'companies'} · Round {game.round} · {ageLabel(game.createdAt)}</div></div>{game.completed?<div className="flex items-center gap-1 text-[11px] font-black text-slate-500"><CheckCircle2 className="h-4 w-4"/>COMPLETED</div>:<button disabled={!canJoin} onClick={onJoin} className="rounded-lg bg-indigo-600 px-4 py-2 text-[11px] font-black text-white disabled:opacity-35">JOIN GAME</button>}</div>;
