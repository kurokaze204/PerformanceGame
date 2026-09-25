import React,{useState}from'react';
import{createPortal}from'react-dom';
import type{KnowledgeDomain}from'../types/game.ts';
import{DOMAIN_INFO}from'../types/game.ts';
import type{ExperienceMode}from'../types/gameV2.ts';

const ABBREVIATION:Record<KnowledgeDomain,string>={engineering:'ENG',hr:'HR',marketing:'MKT',operations:'OPS',finance:'FIN'};
const DESCRIPTION:Record<KnowledgeDomain,string>={
 engineering:'Technical knowledge used to design, build, maintain and improve products, systems and infrastructure.',
 hr:'People and workforce knowledge used to recruit, develop, organise and support employees.',
 marketing:'Customer and market knowledge used to understand demand, position offerings and grow relationships.',
 operations:'Practical knowledge used to run day-to-day work reliably, safely and efficiently.',
 finance:'Financial knowledge used to understand value, cost, funding, performance and commercial risk.'
};
const DARK_STYLE:Record<KnowledgeDomain,string>={
 engineering:'bg-blue-950/75 text-blue-200 border-blue-500',
 hr:'bg-red-950/75 text-red-200 border-red-500',
 marketing:'bg-amber-950/75 text-amber-200 border-amber-500',
 operations:'bg-emerald-950/75 text-emerald-200 border-emerald-500',
 finance:'bg-purple-950/75 text-purple-200 border-purple-500',
};
const LIGHT_STYLE:Record<KnowledgeDomain,string>={
 engineering:'bg-blue-50 text-blue-900 border-blue-500',
 hr:'bg-red-50 text-red-900 border-red-500',
 marketing:'bg-amber-50 text-amber-950 border-amber-500',
 operations:'bg-emerald-50 text-emerald-900 border-emerald-500',
 finance:'bg-purple-50 text-purple-900 border-purple-500',
};
export const ALL_DOMAINS:KnowledgeDomain[]=['engineering','hr','marketing','operations','finance'];
export const domainsForMode=(mode:ExperienceMode|string):KnowledgeDomain[]=>mode==='newbie'?ALL_DOMAINS.filter(d=>d!=='finance'):ALL_DOMAINS;

type Surface='dark'|'light';
export const DomainBadge:React.FC<{domain:KnowledgeDomain;className?:string;surface?:Surface}>=({domain,className='',surface='dark'})=>{
 const[open,setOpen]=useState(false);
 const info=DOMAIN_INFO[domain];
 const visibleDomains=typeof document!=='undefined'&&!document.querySelector('[data-domain="finance"]')?ALL_DOMAINS.filter(d=>d!=='finance'):ALL_DOMAINS;
 const palette=surface==='light'?LIGHT_STYLE[domain]:DARK_STYLE[domain];
 return <><button type="button" data-domain={domain} onClick={event=>{event.stopPropagation();setOpen(true)}} title={`${info.label} — click for knowledge domain guide`} aria-label={`${info.label}. Open knowledge domain guide.`} className={`inline-flex min-w-[46px] items-center justify-center rounded-lg border-2 px-2.5 py-1.5 text-xs sm:text-sm font-black leading-none tracking-wide cursor-pointer shadow-sm hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-indigo-400/70 ${palette} ${className}`}>{ABBREVIATION[domain]}</button>{open&&createPortal(<div className="fixed inset-0 z-[650] bg-slate-950/94 backdrop-blur-sm grid place-items-center p-4 pt-[calc(var(--tpg-header-height)+1rem)]" onClick={()=>setOpen(false)} role="dialog" aria-modal="true" aria-label="Knowledge domains"><div className="w-full max-w-2xl rounded-2xl border-2 border-slate-600 bg-slate-900 p-6 shadow-2xl"><div className="text-sm uppercase tracking-[0.18em] text-slate-400 font-black">Knowledge domains</div><h2 className="text-2xl sm:text-3xl font-black text-white mt-1">What the icons mean</h2><div className="space-y-3 mt-5">{visibleDomains.map(item=><div key={item} className={`flex items-start gap-4 rounded-xl border p-4 ${item===domain?'border-white/70 bg-white/5':'border-slate-700 bg-slate-950/40'}`}><DomainBadgeStatic domain={item}/><div><div className="font-bold text-white text-lg">{DOMAIN_INFO[item].label}</div><div className="text-sm sm:text-base leading-relaxed text-slate-300 mt-1">{DESCRIPTION[item]}</div></div></div>)}</div><div className="text-center text-xs uppercase tracking-wider text-slate-500 mt-5">Click anywhere to return to play</div></div></div>,document.body)}</>
};
const DomainBadgeStatic:React.FC<{domain:KnowledgeDomain}>=({domain})=><span className={`inline-flex min-w-[52px] items-center justify-center rounded-lg border-2 px-2.5 py-2 text-sm font-black leading-none tracking-wide shadow-sm ${DARK_STYLE[domain]}`}>{ABBREVIATION[domain]}</span>;
