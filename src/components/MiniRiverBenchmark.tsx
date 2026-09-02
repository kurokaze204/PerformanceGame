import React from 'react';
import type { KnowledgeDomain } from '../types/game.ts';
import type { CompanyV2, ExperienceMode } from '../types/gameV2.ts';
import { riverSiteKnowledgeScore } from '../engine/riverKnowledgeV1.ts';

const NEWBIE_DOMAINS:KnowledgeDomain[]=['engineering','hr','marketing','operations'];
const EXPERT_DOMAINS:KnowledgeDomain[]=[...NEWBIE_DOMAINS,'finance'];
const DOMAIN_ABBR:Record<KnowledgeDomain,string>={engineering:'ENG',hr:'HR',marketing:'MKT',operations:'OPS',finance:'FIN'};
const initials=(name:string)=>name.replace(/\s\([A-Z]{2,3}\)$/,'').split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join('').toUpperCase();

interface Props{company:CompanyV2;mode:ExperienceMode;highlight?:boolean;}

export const MiniRiverBenchmark:React.FC<Props>=({company,mode,highlight=false})=>{
 const domains=mode==='expert'?EXPERT_DOMAINS:NEWBIE_DOMAINS;
 const openSites=company.sites.filter(site=>!site.isClosed);
 const sites=openSites.length?openSites:company.sites;
 const experts=company.experts.filter(expert=>!expert.isVacant);
 const data=domains.map(domain=>{
   const scores=sites.map(site=>({site,score:riverSiteKnowledgeScore(site,domain,mode)}));
   return{domain,scores,north:Math.max(0,...scores.map(item=>item.score)),south:Math.min(...scores.map(item=>item.score))};
 });
 const expertMarks=experts.flatMap(expert=>expert.domains.filter(skill=>domains.includes(skill.domain)).map(skill=>({expert,domain:skill.domain,score:skill.score})));
 const maxY=Math.max(6,...data.flatMap(item=>item.scores.map(score=>score.score)),...expertMarks.map(mark=>mark.score));
 const W=520,H=220,padL=30,padR=14,padT=16,padB=38;
 const x=(index:number)=>padL+index*((W-padL-padR)/Math.max(1,domains.length-1));
 const y=(value:number)=>padT+(maxY-value)*((H-padT-padB)/maxY);
 const northPath=data.map((item,index)=>`${index?'L':'M'} ${x(index)} ${y(item.north)}`).join(' ');
 const southPath=data.map((item,index)=>`${index?'L':'M'} ${x(index)} ${y(item.south)}`).join(' ');
 const fillPath=`${northPath} ${[...data].reverse().map((item,reverseIndex)=>`L ${x(data.length-1-reverseIndex)} ${y(item.south)}`).join(' ')} Z`;
 return <div className={`rounded-xl border p-3 ${highlight?'border-emerald-700 bg-emerald-950/10':'border-slate-700 bg-slate-950/70'}`}>
   <div className="flex items-center justify-between gap-3"><div><div className={`text-xs font-black ${highlight?'text-emerald-300':'text-white'}`}>{company.name}{highlight?' · YOU':''}</div><div className="text-[9px] text-slate-500 mt-0.5">White = sites · yellow = experts</div></div></div>
   <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 w-full h-auto" role="img" aria-label={`${company.name} knowledge River benchmark`}>
     {[0,2,4,6,8].filter(value=>value<=maxY).map(value=><g key={value}><line x1={padL} y1={y(value)} x2={W-padR} y2={y(value)} stroke="#263247" strokeWidth="1"/><text x={padL-6} y={y(value)+3} textAnchor="end" fill="#64748b" fontSize="8">{value}</text></g>)}
     <path d={fillPath} fill="#0c4a6e" fillOpacity="0.68"/>
     <path d={northPath} fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinejoin="round"/>
     <path d={southPath} fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinejoin="round"/>
     {data.map((item,index)=><g key={item.domain}>
       <text x={x(index)} y={H-10} textAnchor="middle" fill="#cbd5e1" fontSize="8" fontWeight="800">{DOMAIN_ABBR[item.domain]}</text>
       {item.scores.map(({site,score},siteIndex)=>{const jitter=(siteIndex-(item.scores.length-1)/2)*4;return <circle key={site.id} cx={x(index)+jitter} cy={y(score)} r="3.5" fill="#f8fafc" stroke="#0f172a" strokeWidth="1.2"/>})}
       {expertMarks.filter(mark=>mark.domain===item.domain).map((mark,expertIndex)=>{const same=expertMarks.filter(other=>other.domain===item.domain);const jitter=(expertIndex-(same.length-1)/2)*13;const px=x(index)+jitter,py=y(mark.score);return <g key={`${mark.expert.id}-${item.domain}`}><circle cx={px} cy={py-4} r="3.2" fill="#facc15" stroke="#713f12" strokeWidth="1"/><path d={`M ${px} ${py} L ${px} ${py+7} M ${px-4} ${py+3} L ${px+4} ${py+3} M ${px} ${py+7} L ${px-3} ${py+12} M ${px} ${py+7} L ${px+3} ${py+12}`} fill="none" stroke="#facc15" strokeWidth="2.2" strokeLinecap="round"/><text x={px+5} y={py-4} fill="#fde047" fontSize="6.5" fontWeight="900">{initials(mark.expert.name)}</text></g>})}
     </g>)}
   </svg>
 </div>;
};
