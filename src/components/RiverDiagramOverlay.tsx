import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, X } from 'lucide-react';
import type { GamePhase, KnowledgeDomain } from '../types/game.ts';
import { DOMAIN_INFO } from '../types/game.ts';
import type { CompanyV2, ExperienceMode } from '../types/gameV2.ts';
import { riverSiteKnowledgeScore, riverTransferTarget } from '../engine/riverKnowledgeV1.ts';
import { formatCurrency } from '../utils/format.ts';

interface Props { company: CompanyV2; mode:ExperienceMode; phase:GamePhase; onClose: () => void; onShare:(sourceSiteId:string,targetSiteId:string,domain:KnowledgeDomain)=>Promise<{success:boolean;message?:string}>; }
const DOMAINS: KnowledgeDomain[] = ['engineering','hr','marketing','operations','finance'];
const ABBR: Record<string,string> = { melbourne:'MEL',sydney:'SYD',brisbane:'BNE',adelaide:'ADL',perth:'PER',darwin:'DRW' };

export const RiverDiagramOverlay:React.FC<Props>=({company,mode,phase,onClose,onShare})=>{
 const sites=company.sites.filter(s=>!s.isClosed);
 const [domain,setDomain]=useState<KnowledgeDomain>('engineering');
 const [sourceSiteId,setSourceSiteId]=useState('');
 const [targetSiteId,setTargetSiteId]=useState('');
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 const data=useMemo(()=>DOMAINS.map(d=>{
   const scores=sites.map(site=>({site,score:riverSiteKnowledgeScore(site,d,mode)}));
   return {domain:d,scores,south:Math.min(...scores.map(x=>x.score)),north:Math.max(...scores.map(x=>x.score))};
 }),[company,mode]);
 const selectedData=data.find(d=>d.domain===domain)!;
 useEffect(()=>{
   if(!selectedData?.scores.length)return;
   const sorted=[...selectedData.scores].sort((a,b)=>b.score-a.score);
   setSourceSiteId(current=>selectedData.scores.some(x=>x.site.id===current)?current:sorted[0].site.id);
   setTargetSiteId(current=>selectedData.scores.some(x=>x.site.id===current)?current:sorted[sorted.length-1].site.id);
 },[domain,company,mode]);
 const source=sites.find(s=>s.id===sourceSiteId);
 const target=sites.find(s=>s.id===targetSiteId);
 const sourceScore=source?riverSiteKnowledgeScore(source,domain,mode):0;
 const currentTarget=target?.teamCapability[domain]||0;
 const transferTarget=riverTransferTarget(sourceScore);
 const canBenefit=Boolean(source&&target&&source.id!==target.id&&transferTarget>currentTarget);
 const maxY=Math.max(6,...data.flatMap(d=>d.scores.map(x=>x.score)));
 const W=920,H=440,padL=58,padR=28,padT=26,padB=62;
 const x=(i:number)=>padL+i*((W-padL-padR)/(DOMAINS.length-1));
 const y=(v:number)=>padT+(maxY-v)*((H-padT-padB)/maxY);
 const northPath=data.map((d,i)=>`${i?'L':'M'} ${x(i)} ${y(d.north)}`).join(' ');
 const southPath=data.map((d,i)=>`${i?'L':'M'} ${x(i)} ${y(d.south)}`).join(' ');
 const gapFill=`${northPath} ${[...data].reverse().map((d,ri)=>`L ${x(data.length-1-ri)} ${y(d.south)}`).join(' ')} Z`;
 const share=async()=>{if(!canBenefit||phase!=='investment'||busy)return;setBusy(true);setMessage('');try{const result=await onShare(sourceSiteId,targetSiteId,domain);setMessage(result.message||'Knowledge transferred.');}finally{setBusy(false)}};
 const knowledgeExplanation=mode==='newbie'
   ? 'Each dot is that site’s Team Capability in the domain. The green lines show the weakest and strongest sites. The shaded area is the internal performance gap: knowledge the company already has, but has not yet moved to every place that needs it.'
   : 'Each dot is a site’s strongest locally available knowledge in that domain — Team Capability or Local Codified Knowledge, whichever is higher. The green lines show the weakest and strongest sites. The shaded area highlights where internal transfer may close a performance gap before outside expertise is required.';
 return <div className="fixed inset-0 z-[220] bg-black/75 backdrop-blur-sm p-4 grid place-items-center" role="dialog" aria-modal="true" aria-label="Knowledge Transfer">
   <div className="w-full max-w-6xl max-h-[96vh] overflow-auto rounded-3xl border border-slate-600 bg-[#0b1020] shadow-2xl p-5">
    <div className="flex items-start justify-between gap-4"><div><div className="text-xs uppercase tracking-[0.18em] text-emerald-300 font-black">Knowledge Transfer · Internal capability map</div><h2 className="text-2xl font-black text-white">Where does knowledge already exist?</h2><p className="text-sm text-slate-300 mt-1 max-w-4xl">{knowledgeExplanation}</p></div><button onClick={onClose} className="rounded-xl border border-slate-700 bg-slate-900 p-2 text-white" aria-label="Close Knowledge Transfer"><X className="w-5 h-5"/></button></div>
    <div className="mt-4 grid lg:grid-cols-[minmax(0,1fr)_300px] gap-4">
     <div className="rounded-2xl border border-slate-700 bg-slate-950 p-3 overflow-hidden">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[440px]" role="img" aria-label="Knowledge Transfer map showing site knowledge scores by domain">
       {[0,1,2,3,4,5,6,7,8].filter(v=>v<=maxY).map(v=><g key={v}><line x1={padL} y1={y(v)} x2={W-padR} y2={y(v)} stroke="#243047" strokeWidth="1"/><text x={padL-12} y={y(v)+4} textAnchor="end" fill="#94a3b8" fontSize="12">{v}</text></g>)}
       <path d={gapFill} fill="#0c4a6e" fillOpacity="0.78"/>
       <path d={northPath} fill="none" stroke="#22c55e" strokeWidth="4" strokeLinejoin="round"/>
       <path d={southPath} fill="none" stroke="#22c55e" strokeWidth="4" strokeLinejoin="round"/>
       {data.map((d,i)=><g key={d.domain}>
         <text x={x(i)} y={H-24} textAnchor="middle" fill="#e2e8f0" fontSize="13" fontWeight="700">{DOMAIN_INFO[d.domain].label}</text>
         {d.scores.map(({site,score},si)=>{const jitter=(si-(d.scores.length-1)/2)*7;return <g key={site.id}><circle cx={x(i)+jitter} cy={y(score)} r="5.5" fill="#f8fafc" stroke="#0f172a" strokeWidth="2"/><text x={x(i)+jitter+7} y={y(score)-7} fill="#f8fafc" fontSize="10" fontWeight="800">{ABBR[site.id]||site.name.slice(0,3).toUpperCase()}</text></g>})}
       </g>)}
       <text x="18" y={H/2} textAnchor="middle" fill="#94a3b8" fontSize="12" transform={`rotate(-90 18 ${H/2})`}>Knowledge level</text>
      </svg>
     </div>
     <aside className="rounded-2xl border border-emerald-800 bg-emerald-950/20 p-4"><div className="text-xs uppercase tracking-wider text-emerald-300 font-black">Knowledge Transfer</div><h3 className="text-lg font-black text-white mt-1">Move knowledge to where it is needed</h3><p className="text-sm text-slate-300 mt-1">Use a stronger site as the teacher. The receiving site can reach about <b>80%</b> of what that teaching site currently knows in the selected domain. This is more targeted than publishing the knowledge to the Corporate Intranet.</p>
      <label className="block mt-3 text-xs uppercase text-slate-400 font-black">Domain<select value={domain} onChange={e=>{setDomain(e.target.value as KnowledgeDomain);setMessage('')}} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-sm text-white normal-case">{DOMAINS.map(d=><option key={d} value={d}>{DOMAIN_INFO[d].label}</option>)}</select></label>
      <label className="block mt-2 text-xs uppercase text-slate-400 font-black">Teaching site<select value={sourceSiteId} onChange={e=>{setSourceSiteId(e.target.value);setMessage('')}} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-sm text-white normal-case">{[...selectedData.scores].sort((a,b)=>b.score-a.score).map(({site,score})=><option key={site.id} value={site.id}>{site.name} · {score}</option>)}</select></label>
      <div className="my-2 flex justify-center text-emerald-300"><ArrowRight className="w-5 h-5"/></div>
      <label className="block text-xs uppercase text-slate-400 font-black">Receiving site<select value={targetSiteId} onChange={e=>{setTargetSiteId(e.target.value);setMessage('')}} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-sm text-white normal-case">{[...selectedData.scores].sort((a,b)=>a.score-b.score).map(({site,score})=><option key={site.id} value={site.id}>{site.name} · {score}</option>)}</select></label>
      <div className="mt-3 grid grid-cols-3 gap-1 text-center"><Metric label="Teacher" value={sourceScore}/><Metric label="Team now" value={currentTarget}/><Metric label="After" value={transferTarget}/></div>
      {phase==='investment'?<button onClick={share} disabled={!canBenefit||busy} className="mt-3 w-full rounded-xl bg-amber-400 py-2.5 font-black text-slate-950 disabled:bg-slate-800 disabled:text-slate-500">{busy?'TRANSFERRING…':`TRANSFER · 1 ACTION · ${formatCurrency(18)}`}</button>:<div className="mt-3 rounded-xl border border-slate-700 bg-slate-950 p-2 text-center text-xs text-slate-400">Planning view available now. Execute Knowledge Transfer during the <b className="text-white">Invest</b> phase.</div>}
      {!canBenefit&&source&&target&&<div className="mt-2 text-xs text-amber-300">Choose a stronger teaching site or a weaker receiving site; this pairing would not lift Team Capability.</div>}{message&&<div className="mt-2 rounded-lg border border-emerald-800 bg-emerald-950/30 p-2 text-xs text-emerald-200">{message}</div>}
     </aside>
    </div>
    <div className="mt-3 grid md:grid-cols-3 gap-3 text-xs"><div className="rounded-xl border border-emerald-800 bg-emerald-950/30 p-3"><b className="text-emerald-300">Strongest site</b><div className="text-slate-300 mt-1">The most your organisation currently knows in each domain. These sites are natural teachers. Beyond this level, genuinely new expertise may be needed.</div></div><div className="rounded-xl border border-sky-800 bg-sky-950/30 p-3"><b className="text-sky-300">Transfer gap</b><div className="text-slate-300 mt-1">The internal performance gap. Deliberately narrow it by moving proven knowledge from stronger sites to weaker sites.</div></div><div className="rounded-xl border border-emerald-800 bg-emerald-950/30 p-3"><b className="text-emerald-300">Weakest site</b><div className="text-slate-300 mt-1">The lowest current site score in each domain — often the best place to target internal Knowledge Transfer first.</div></div></div>
   </div>
 </div>;
};

const Metric:React.FC<{label:string;value:number|string}>=({label,value})=><div className="rounded-lg border border-emerald-900 bg-slate-950 p-2"><div className="text-[10px] uppercase text-slate-500 font-black">{label}</div><div className="text-xl font-black text-white">{value}</div></div>;
