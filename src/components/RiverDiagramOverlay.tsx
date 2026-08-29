import React, { useMemo } from 'react';
import { X } from 'lucide-react';
import type { KnowledgeDomain } from '../types/game.ts';
import { DOMAIN_INFO } from '../types/game.ts';
import type { CompanyV2 } from '../types/gameV2.ts';

interface Props { company: CompanyV2; onClose: () => void; }
const DOMAINS: KnowledgeDomain[] = ['engineering','hr','marketing','operations','finance'];
const ABBR: Record<string,string> = { melbourne:'MEL',sydney:'SYD',brisbane:'BNE',adelaide:'ADL',perth:'PER',darwin:'DRW' };

function siteScore(site:CompanyV2['sites'][number],domain:KnowledgeDomain){
  return Math.max(site.teamCapability[domain]||0,site.codifiedKnowledge[domain]||0);
}

export const RiverDiagramOverlay:React.FC<Props>=({company,onClose})=>{
 const sites=company.sites.filter(s=>!s.isClosed);
 const data=useMemo(()=>DOMAINS.map(domain=>{
   const scores=sites.map(site=>({site,score:siteScore(site,domain)}));
   return {domain,scores,south:Math.min(...scores.map(x=>x.score)),north:Math.max(...scores.map(x=>x.score))};
 }),[company]);
 const maxY=Math.max(6,...data.flatMap(d=>d.scores.map(x=>x.score)));
 const W=920,H=440,padL=58,padR=28,padT=26,padB=62;
 const x=(i:number)=>padL+i*((W-padL-padR)/(DOMAINS.length-1));
 const y=(v:number)=>padT+(maxY-v)*((H-padT-padB)/maxY);
 const northPath=data.map((d,i)=>`${i?'L':'M'} ${x(i)} ${y(d.north)}`).join(' ');
 const southPath=data.map((d,i)=>`${i?'L':'M'} ${x(i)} ${y(d.south)}`).join(' ');
 const riverFill=`${northPath} ${[...data].reverse().map((d,ri)=>`L ${x(data.length-1-ri)} ${y(d.south)}`).join(' ')} Z`;
 return <div className="fixed inset-0 z-[220] bg-black/75 backdrop-blur-sm p-4 grid place-items-center" role="dialog" aria-modal="true" aria-label="River diagram">
   <div className="w-full max-w-6xl rounded-3xl border border-slate-600 bg-[#0b1020] shadow-2xl p-5">
    <div className="flex items-start justify-between gap-4"><div><div className="text-[10px] uppercase tracking-[0.18em] text-sky-300 font-black">Business intelligence · River Diagram</div><h2 className="text-2xl font-black text-white">Where does knowledge already exist?</h2><p className="text-sm text-slate-300 mt-1 max-w-4xl">Each dot is a site’s strongest locally available knowledge in that domain (Team Capability or Local Codified Knowledge, whichever is higher). The green banks show the weakest and strongest site. The blue river is the internal sharing opportunity: move knowledge from the north bank toward the south bank before buying knowledge from outside.</p></div><button onClick={onClose} className="rounded-xl border border-slate-700 bg-slate-900 p-2 text-white" aria-label="Close river diagram"><X className="w-5 h-5"/></button></div>
    <div className="mt-4 rounded-2xl border border-slate-700 bg-slate-950 p-3 overflow-hidden">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[440px]" role="img" aria-label="River diagram showing site knowledge scores by domain">
       {[0,1,2,3,4,5,6,7,8].filter(v=>v<=maxY).map(v=><g key={v}><line x1={padL} y1={y(v)} x2={W-padR} y2={y(v)} stroke="#243047" strokeWidth="1"/><text x={padL-12} y={y(v)+4} textAnchor="end" fill="#94a3b8" fontSize="12">{v}</text></g>)}
       <path d={riverFill} fill="#0c4a6e" fillOpacity="0.72"/>
       <path d={northPath} fill="none" stroke="#22c55e" strokeWidth="4" strokeLinejoin="round"/>
       <path d={southPath} fill="none" stroke="#22c55e" strokeWidth="4" strokeLinejoin="round"/>
       {data.map((d,i)=><g key={d.domain}>
         <text x={x(i)} y={H-24} textAnchor="middle" fill="#e2e8f0" fontSize="13" fontWeight="700">{DOMAIN_INFO[d.domain].label}</text>
         {d.scores.map(({site,score},si)=>{
           const jitter=(si-(d.scores.length-1)/2)*7;
           return <g key={site.id}><circle cx={x(i)+jitter} cy={y(score)} r="5" fill="#f8fafc" stroke="#0f172a" strokeWidth="2"/><text x={x(i)+jitter+7} y={y(score)-7} fill="#f8fafc" fontSize="10" fontWeight="800">{ABBR[site.id]||site.name.slice(0,3).toUpperCase()}</text></g>
         })}
       </g>)}
       <text x="16" y={padT+10} fill="#94a3b8" fontSize="12" transform={`rotate(-90 16 ${padT+10})`}>Knowledge level</text>
      </svg>
    </div>
    <div className="mt-3 grid md:grid-cols-3 gap-3 text-xs"><div className="rounded-xl border border-emerald-800 bg-emerald-950/30 p-3"><b className="text-emerald-300">North bank</b><div className="text-slate-300 mt-1">The most your organisation currently knows in each domain. A site on this bank is a natural teacher.</div></div><div className="rounded-xl border border-sky-800 bg-sky-950/30 p-3"><b className="text-sky-300">The river</b><div className="text-slate-300 mt-1">The gap between strongest and weakest sites. Knowledge Sharing can lift a receiving site to about 80% of the teaching site’s current score.</div></div><div className="rounded-xl border border-emerald-800 bg-emerald-950/30 p-3"><b className="text-emerald-300">South bank</b><div className="text-slate-300 mt-1">The weakest current site in each domain. These are priority candidates for internal transfer.</div></div></div>
   </div>
 </div>;
};
