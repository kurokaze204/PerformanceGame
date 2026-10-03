import React,{useMemo,useState}from'react';
import{ArrowLeft,ChevronDown,ChevronRight,Clock,Crown,Pause,Play,RotateCcw,Trash2,Users}from'lucide-react';
import type{GameEndMode,GameSessionV2}from'../types/gameV2.ts';
import{formatCurrency}from'../utils/format.ts';

interface Props{session:GameSessionV2;passcode:string;onSessionUpdate:(session:GameSessionV2)=>void;onToast:(message:string)=>void;}

export const FacilitatorControlRoomV2:React.FC<Props>=({session,passcode,onSessionUpdate,onToast})=>{
 const[showPlayers,setShowPlayers]=useState(true);
 const[duration,setDuration]=useState(session.gameDurationMinutes);
 const[maxPlayers,setMaxPlayers]=useState(session.maxPlayersPerCompany);
 const[gameEndMode,setGameEndMode]=useState<GameEndMode>(session.experienceMode==='expert'?session.gameEndMode:'time');
 const[finalRoundCount,setFinalRoundCount]=useState(session.finalRoundCount||30);
 const[busyId,setBusyId]=useState<string|null>(null);
 const players=(session.participants||[]).filter(participant=>participant.role!=='facilitator');
 const grouped=useMemo(()=>new Map(session.companies.map(company=>[company.id,players.filter(player=>player.companyId===company.id)])),[session.companies,players]);
 const isRunning=Boolean(session.timerEndsAt);
 const roundMode=session.experienceMode==='expert'&&gameEndMode==='rounds';

 const command=async(action:'start'|'pause'|'reset')=>{
  const response=await fetch(`/api/sessions/${session.id}/timer/${action}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({passcode})});
  const data=await response.json();
  if(!response.ok){onToast(data.error||`Could not ${action} the timer.`);return;}
  onSessionUpdate(data);
 };
 const saveSettings=async()=>{
  const response=await fetch(`/api/sessions/${session.id}/facilitator/settings`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({passcode,gameDurationMinutes:duration,maxPlayersPerCompany:maxPlayers,gameEndMode:session.experienceMode==='expert'?gameEndMode:'time',finalRoundCount})});
  const data=await response.json();
  if(!response.ok){onToast(data.error||'Could not save settings.');return;}
  onSessionUpdate(data.session);onToast('Game settings updated.');
 };
 const move=async(participantId:string,companyId:string)=>{
  setBusyId(participantId);
  try{
   const response=await fetch(`/api/sessions/${session.id}/facilitator/move-player`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({passcode,participantId,companyId})});
   const data=await response.json();
   if(!response.ok){onToast(data.error||'Could not move player.');return;}
   onSessionUpdate(data.session);onToast('Player moved.');
  }finally{setBusyId(null);}
 };
 const assignCeo=async(companyId:string,participantId:string)=>{
  setBusyId(participantId);
  try{
   const response=await fetch(`/api/sessions/${session.id}/facilitator/assign-ceo`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({passcode,companyId,participantId})});
   const data=await response.json();
   if(!response.ok||data.success===false){onToast(data.message||data.error||'Could not assign CEO.');return;}
   onSessionUpdate(data.session);onToast(data.message||'CEO assigned.');
  }finally{setBusyId(null);}
 };
 const removePlayer=async(participantId:string,name:string)=>{
  if(!window.confirm(`Remove ${name} from this game?`))return;
  setBusyId(participantId);
  try{
   const response=await fetch(`/api/sessions/${session.id}/facilitator/remove-player`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({passcode,participantId})});
   const data=await response.json();
   if(!response.ok||data.success===false){onToast(data.message||data.error||'Could not remove player.');return;}
   onSessionUpdate(data.session);onToast(data.message||'Player removed.');
  }finally{setBusyId(null);}
 };
 const removeCompany=async(companyId:string,name:string)=>{
  if(!window.confirm(`Remove empty company ${name}? This cannot be undone.`))return;
  setBusyId(companyId);
  try{
   const response=await fetch(`/api/sessions/${session.id}/facilitator/remove-company`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({passcode,companyId})});
   const data=await response.json();
   if(!response.ok||data.success===false){onToast(data.message||data.error||'Could not remove company.');return;}
   onSessionUpdate(data.session);onToast(data.message||'Company removed.');
  }finally{setBusyId(null);}
 };
 const returnToGame=()=>{
  try{
   const facilitatorRaw=localStorage.getItem('tpg_participant');
   if(facilitatorRaw)sessionStorage.setItem('tpg_facilitator_participant',facilitatorRaw);
   const playerRaw=sessionStorage.getItem('tpg_facilitator_game_player');
   if(playerRaw){
    const player=JSON.parse(playerRaw);
    localStorage.setItem('tpg_participant',playerRaw);
    if(player.companyId)localStorage.setItem('tpg_company_id',player.companyId);
   }
   sessionStorage.setItem('tpg_facilitator_game_view','1');
  }catch{}
  window.location.reload();
 };

 return <div className="space-y-4" aria-label="Facilitator control panel">
  <div className="flex justify-end"><button onClick={returnToGame} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-black text-slate-300 flex items-center gap-2"><ArrowLeft className="w-4 h-4"/>Return to game</button></div>

  <section className="rounded-2xl border border-indigo-800 bg-indigo-950/25 p-4">
   <div className="text-[10px] uppercase tracking-wider text-indigo-300 font-black">How multiplayer works</div>
   <div className="grid md:grid-cols-3 gap-3 mt-2 text-xs text-slate-300 leading-relaxed">
    <p><b className="text-white">1 · One company, one state.</b> Everyone in a company sees the same Events, River, investments and results.</p>
    <p><b className="text-white">2 · One CEO writes.</b> The CEO makes game decisions. Teammates follow live in read-only mode. Control can be handed over at any time.</p>
    <p><b className="text-white">3 · Companies are independent.</b> Teams can be on different rounds and phases. Nobody waits for another company to advance.</p>
   </div>
  </section>

  <div className="grid lg:grid-cols-[1fr_360px] gap-4">
   <section className="rounded-2xl border border-slate-700 bg-slate-900 p-4">
    <div className="flex items-center justify-between gap-3">
     <div><div className="text-[10px] uppercase text-slate-500 font-black">Companies</div><h2 className="text-lg font-black text-white">Live team status</h2></div>
     <button onClick={()=>setShowPlayers(value=>!value)} aria-expanded={showPlayers} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-black text-slate-300 flex items-center gap-2">{showPlayers?<ChevronDown className="w-4 h-4"/>:<ChevronRight className="w-4 h-4"/>}{showPlayers?'Hide':'Show'} player assignments</button>
    </div>
    <div className="mt-3 grid md:grid-cols-2 gap-2">{session.companies.map(company=>{
     const team=grouped.get(company.id)||[];
     const unresolved=(session.activeEvents[company.id]||[]).filter(event=>!event.isResolved).length;
     const phase=company.roundPhase||'events';
     const controller=team.find(player=>player.id===company.controllerParticipantId||player.role==='controller');
     const busy=busyId===company.id;
     return <div key={company.id} className="rounded-xl border border-slate-700 bg-slate-950 p-3">
      <div className="flex justify-between gap-3">
       <div><div className="flex flex-wrap items-center gap-2"><b className="text-white">{company.name}</b>{controller&&<span className="inline-flex items-center gap-1 rounded-full border border-amber-700 bg-amber-950/40 px-2 py-0.5 text-[8px] font-black uppercase text-amber-200"><Crown className="h-3 w-3"/>{controller.name} · CEO</span>}</div><div className="text-[10px] text-slate-500">{team.length}/{session.maxPlayersPerCompany} players · Round {company.round||1} · <span className="capitalize">{phase}</span>{phase==='events'?` · ${unresolved} task${unresolved===1?'':'s'} open`:''}</div></div>
       <div className="text-right"><div className="text-xs font-black text-emerald-300">{formatCurrency(company.turnover)}</div><div className="text-[9px] text-slate-600">turnover</div></div>
      </div>
      {showPlayers&&<div className="mt-2 space-y-1">{team.length?team.map(player=>{
       const isCeo=player.id===company.controllerParticipantId||player.role==='controller';
       const isBusy=busyId===player.id;
       return <div key={player.id} className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 ${isCeo?'border-amber-800 bg-amber-950/20':'border-slate-800 bg-slate-900'}`}>
        {isCeo?<Crown className="w-3.5 h-3.5 text-amber-300"/>:<Users className="w-3.5 h-3.5 text-indigo-300"/>}
        <span className="flex-1 text-xs text-white font-bold truncate">{player.name}{isCeo&&<span className="ml-2 text-[8px] uppercase text-amber-300">CEO</span>}</span>
        {!isCeo&&<button type="button" disabled={isBusy} onClick={()=>void assignCeo(company.id,player.id)} className="rounded-md border border-amber-800 bg-amber-950/25 px-2 py-1 text-[9px] font-black text-amber-200 disabled:opacity-40">Make CEO</button>}
        <label className="sr-only" htmlFor={`move-${player.id}`}>Move {player.name} to company</label>
        <select id={`move-${player.id}`} value={player.companyId} disabled={isBusy} onChange={event=>void move(player.id,event.target.value)} className="rounded-md border border-slate-700 bg-slate-950 px-1.5 py-1 text-[10px] text-slate-300 disabled:opacity-40">{session.companies.map(option=><option key={option.id} value={option.id}>{option.name}</option>)}</select>
        <button type="button" disabled={isBusy} onClick={()=>void removePlayer(player.id,player.name)} className="rounded-md border border-rose-900 bg-rose-950/30 p-1 text-rose-300 hover:bg-rose-950/60 disabled:opacity-40" title="Remove duplicate or abandoned player"><Trash2 className="h-3.5 w-3.5"/></button>
       </div>;
      }):<div className="rounded-lg border border-slate-800 bg-slate-900 px-2 py-1.5 text-[10px] text-slate-500">No players assigned. This company does not participate or block any other team.</div>}</div>}
      <div className="mt-2 flex justify-end border-t border-slate-800 pt-2"><button type="button" disabled={busy||team.length>0||session.companies.length<=1||session.isFinalDisruptionActive} onClick={()=>void removeCompany(company.id,company.name)} className="rounded-lg border border-rose-800 bg-rose-950/30 px-2 py-1.5 text-[10px] font-black text-rose-200 disabled:opacity-35"><Trash2 className="mr-1 inline h-3.5 w-3.5"/>Remove empty company</button></div>
     </div>;
    })}</div>
   </section>

   <aside className="space-y-3">
    <section className="rounded-2xl border border-slate-700 bg-slate-900 p-4">
     <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-indigo-300"/><h3 className="font-black text-white">Game timing</h3></div>
     {session.experienceMode==='expert'&&<div className="mt-3"><div className="text-[10px] uppercase text-slate-500 font-black">End game by</div><div className="mt-1 grid grid-cols-2 gap-2"><button onClick={()=>setGameEndMode('time')} className={`rounded-lg border py-2 text-xs font-black ${gameEndMode==='time'?'border-indigo-400 bg-indigo-950/60 text-white':'border-slate-700 bg-slate-950 text-slate-400'}`}>Time</button><button onClick={()=>setGameEndMode('rounds')} className={`rounded-lg border py-2 text-xs font-black ${gameEndMode==='rounds'?'border-indigo-400 bg-indigo-950/60 text-white':'border-slate-700 bg-slate-950 text-slate-400'}`}>Round count</button></div></div>}
     <div className="grid grid-cols-2 gap-2 mt-3">{roundMode?<label className="text-[10px] uppercase text-slate-500 font-black">Final after all teams reach round<input type="number" min={1} max={200} value={finalRoundCount} onChange={event=>setFinalRoundCount(Math.max(1,Number(event.target.value)))} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-sm text-white normal-case"/></label>:<label className="text-[10px] uppercase text-slate-500 font-black">Length (min)<input type="number" min={20} max={240} step={5} value={duration} onChange={event=>setDuration(Number(event.target.value))} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-sm text-white normal-case"/></label>}<label className="text-[10px] uppercase text-slate-500 font-black">Max/team<input type="number" min={1} max={20} value={maxPlayers} onChange={event=>setMaxPlayers(Number(event.target.value))} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-sm text-white normal-case"/></label></div>
     <button onClick={saveSettings} className="mt-2 w-full rounded-lg bg-indigo-600 py-2 text-xs font-black text-white">Save settings</button>
     {!roundMode&&<div className="mt-3 grid grid-cols-2 gap-2"><button onClick={()=>command(isRunning?'pause':'start')} className="rounded-lg border border-emerald-700 bg-emerald-950/40 py-2 text-xs font-black text-emerald-200 flex items-center justify-center gap-1">{isRunning?<Pause className="w-3.5 h-3.5"/>:<Play className="w-3.5 h-3.5"/>}{isRunning?'Pause':'Start'}</button><button onClick={()=>command('reset')} className="rounded-lg border border-slate-700 bg-slate-950 py-2 text-xs font-black text-slate-300 flex items-center justify-center gap-1"><RotateCcw className="w-3.5 h-3.5"/>Reset</button></div>}
     <p className="mt-3 text-[10px] text-slate-500 leading-relaxed">{roundMode?`The Final Challenge becomes available after every staffed company reaches Round ${finalRoundCount}. Teams can still progress independently before then.`:`Teams progress independently. The shared timer only determines when the Final Challenge becomes due; it does not synchronise normal rounds or phases.`}</p>
    </section>
    <section className="rounded-2xl border border-slate-700 bg-slate-900 p-4"><div className="text-[10px] uppercase text-slate-500 font-black">Experience mode</div><div className="text-lg font-black text-white capitalize mt-1">{session.experienceMode}</div><p className="text-[10px] text-slate-500 mt-1">{session.experienceMode==='newbie'?'Capabilities are introduced progressively for each company across its own rounds.':'All capabilities and Charts are available from each company’s first round.'}</p></section>
   </aside>
  </div>
 </div>;
};
