import React,{useState}from'react';
import{ArrowRight,Network,RefreshCw}from'lucide-react';
import type{KnowledgeDomain}from'../types/game.ts';
import{DOMAIN_INFO}from'../types/game.ts';
import type{CompanyV2,GameSessionV2}from'../types/gameV2.ts';

const DomainLine:React.FC<{domain:KnowledgeDomain;difficulty:number}>=({domain,difficulty})=><div className="flex items-center justify-between gap-3 rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2"><div className="flex items-center gap-2 min-w-0"><span className="h-3 w-3 rounded-full shrink-0" style={{backgroundColor:DOMAIN_INFO[domain].color}}/><b className="text-xs text-white truncate">{DOMAIN_INFO[domain].label}</b></div><span className="text-lg font-black text-white">{difficulty}</span></div>;

export const DisruptionMiniCard:React.FC<{company:CompanyV2;aboveOverlay?:boolean;embedded?:boolean}>=({company,aboveOverlay=false,embedded=false})=>{
 const card=company.disruptionCard;
 if(!card)return null;
 const shell=embedded
  ?'relative w-[108px] min-h-[142px] rounded-[13px] border-[3px] border-amber-300 bg-[#171109] p-2 shadow-[0_8px_18px_rgba(0,0,0,.45)] pointer-events-auto'
  :`absolute left-4 bottom-[76px] ${aboveOverlay?'z-[38]':'z-[24]'} w-[132px] min-h-[176px] rounded-[15px] border-[4px] border-amber-300 bg-[#171109] p-2.5 shadow-[0_12px_24px_rgba(0,0,0,.55)] pointer-events-auto`;
 return <div className={shell} aria-label="Known disruption card">
  <div className={`${embedded?'text-[8px]':'text-[10px]'} font-black tracking-[.15em] text-amber-200`}>DISRUPTION</div>
  <div className={`mt-1 ${embedded?'text-[8px]':'text-[10px]'} font-black leading-tight text-white`}>{card.siteName}</div>
  <div className={`${embedded?'mt-1.5 space-y-1':'mt-2 space-y-1.5'}`}>{card.domains.map(req=><div key={req.domain} className={`rounded-md border border-amber-900/70 bg-black/25 ${embedded?'min-h-[39px] px-1.5 py-1':'min-h-[44px] p-1.5'}`}><div className="flex items-start gap-1"><span className="mt-0.5 h-2 w-2 shrink-0 rounded-full" style={{backgroundColor:DOMAIN_INFO[req.domain].color}}/><span className={`min-w-0 flex-1 break-words font-black leading-[1.05] text-slate-200 ${embedded?'text-[7px]':'text-[9px]'}`}>{DOMAIN_INFO[req.domain].label}</span></div><div className={`${embedded?'mt-0 text-sm':'mt-0.5 text-lg'} text-right leading-none font-black text-amber-100`}>{req.difficulty}</div></div>)}</div>
 </div>;
};

export const DisruptionDealOverlay:React.FC<{session:GameSessionV2;company:CompanyV2;onContinue:()=>void}>=({session,company,onContinue})=>{
 const[revealed,setRevealed]=useState(false);
 const card=company.disruptionCard;
 if(!card)return <div className="w-full max-w-xl mx-auto mt-12 rounded-3xl border-2 border-amber-500 bg-slate-950 p-6 text-center"><h2 className="text-2xl font-black text-white">Preparing your Disruption…</h2></div>;
 return <div className="w-full max-w-2xl mx-auto mt-8 rounded-3xl border-2 border-amber-500 bg-[#0d0f15]/95 p-6 shadow-2xl">
   <div className="text-[11px] uppercase tracking-[.2em] text-amber-300 font-black">Before you choose your strategy</div>
   <h2 className="mt-1 text-3xl font-black text-white">Your known Disruption</h2>
   <p className="mt-2 text-sm text-slate-300">This is the major threat your company expects to face. You have the whole game to build the capability to handle it.</p>
   <div className="mt-6 flex items-center justify-center min-h-[300px]">
    {!revealed?<button onClick={()=>setRevealed(true)} className="relative h-[260px] w-[186px] rounded-[18px] border-[5px] border-amber-300 bg-[radial-gradient(circle_at_50%_24%,#6b4517_0%,#2a1808_55%,#0a0806_100%)] shadow-[0_20px_45px_rgba(0,0,0,.55)]"><div className="absolute inset-4 rounded-xl border-2 border-amber-200/30"/><div className="absolute -left-3 -top-3 h-full w-full rounded-[18px] border border-amber-700 bg-[#120d08] -z-10"/><b className="inline-block -rotate-45 text-xl tracking-[.16em] text-amber-100">DISRUPTION</b><span className="absolute left-0 right-0 bottom-5 text-[10px] font-black uppercase tracking-widest text-amber-300">Click to deal</span></button>
    :<div className="w-[360px] max-w-full rounded-[20px] border-[5px] border-amber-300 bg-[#171109] p-5 shadow-[0_20px_45px_rgba(0,0,0,.55)]">
      <div className="text-[11px] font-black tracking-[.18em] text-amber-200">DISRUPTION</div>
      <h3 className="mt-2 text-xl font-black leading-tight text-white">{card.title}</h3>
      <div className="mt-3 rounded-xl border border-amber-800 bg-black/25 px-3 py-2"><div className="text-[9px] uppercase tracking-wider text-amber-400 font-black">Site</div><div className="text-lg font-black text-white">{card.siteName}</div></div>
      <p className="mt-3 text-xs leading-relaxed text-slate-200">To survive this final challenge you need to increase your knowledge score in these domains:</p>
      <div className="mt-2 grid grid-cols-2 gap-2">{card.domains.map(req=><DomainLine key={req.domain} domain={req.domain} difficulty={req.difficulty}/>)}</div>
      <p className="mt-3 text-xs leading-relaxed text-slate-400">Build these capabilities deliberately. Your strategic environment may change during the game.</p>
     </div>}
   </div>
   {revealed&&<button onClick={onContinue} className="mt-5 w-full rounded-xl bg-amber-400 py-3.5 font-black text-slate-950 flex items-center justify-center gap-2">CHOOSE MY STRATEGY <ArrowRight className="h-4 w-4"/></button>}
   <div className="mt-3 text-center text-[10px] text-slate-500">{session.experienceMode==='newbie'?'Both domains match expertise already present in your company.':'Expert mode may test capability beyond your current experts.'}</div>
  </div>;
};

export const DisruptionSwapNotice:React.FC<{company:CompanyV2;onAcknowledge:()=>void}>=({company,onAcknowledge})=>{
 const notice=company.disruptionSwapNotice;
 const card=company.disruptionCard;
 if(!notice||!card)return null;
 return <div className="fixed left-0 right-0 top-[var(--tpg-header-height)] bottom-0 z-[280] grid place-items-center bg-black/70 p-4">
  <div className="w-full max-w-lg rounded-3xl border-2 border-amber-400 bg-slate-950 p-6 shadow-2xl">
   <div className="flex items-center gap-2 text-amber-300"><RefreshCw className="h-5 w-5"/><span className="text-[11px] uppercase tracking-[.18em] font-black">Strategic environment changed</span></div>
   <h2 className="mt-2 text-2xl font-black text-white">Your Disruption has changed.</h2>
   <p className="mt-2 text-sm text-slate-300">You now hold the Disruption previously being prepared for by <b className="text-white">{notice.fromCompanyName}</b>.</p>
   <div className="mt-4 rounded-2xl border border-amber-700 bg-amber-950/20 p-4"><div className="text-xs font-black text-amber-200">{card.siteName}</div><div className="mt-2 grid grid-cols-2 gap-2">{card.domains.map(req=><DomainLine key={req.domain} domain={req.domain} difficulty={req.difficulty}/>)}</div></div>
   <div className="mt-4 flex gap-3 rounded-2xl border border-emerald-800 bg-emerald-950/25 p-4"><Network className="h-5 w-5 shrink-0 text-emerald-300"/><p className="text-sm leading-relaxed text-slate-200"><b>Use the network.</b> The previous company may already have built knowledge you now need. Joining a Community of Practice in these domains can give you additive access to that knowledge.</p></div>
   <button onClick={onAcknowledge} className="mt-5 w-full rounded-xl bg-amber-400 py-3 font-black text-slate-950">REVIEW MY NEW GOAL</button>
  </div>
 </div>;
};
