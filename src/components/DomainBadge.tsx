import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import type { KnowledgeDomain } from '../types/game.ts';
import { DOMAIN_INFO } from '../types/game.ts';
import type { ExperienceMode } from '../types/gameV2.ts';

const ABBREVIATION:Record<KnowledgeDomain,string>={
  engineering:'ENG',
  hr:'HR',
  marketing:'MKT',
  operations:'OPS',
  finance:'FIN',
};

const DESCRIPTION:Record<KnowledgeDomain,string>={
  engineering:'Technical knowledge used to design, build, maintain and improve products, systems and infrastructure.',
  hr:'People and workforce knowledge used to recruit, develop, organise and support employees.',
  marketing:'Customer and market knowledge used to understand demand, position offerings and grow relationships.',
  operations:'Practical knowledge used to run day-to-day work reliably, safely and efficiently.',
  finance:'Financial knowledge used to understand value, cost, funding, performance and commercial risk.',
};

export const ALL_DOMAINS:KnowledgeDomain[]=['engineering','hr','marketing','operations','finance'];
export const domainsForMode=(mode:ExperienceMode):KnowledgeDomain[]=>mode==='newbie'?ALL_DOMAINS.filter(d=>d!=='finance'):ALL_DOMAINS;

export const DomainBadge:React.FC<{domain:KnowledgeDomain;className?:string}>=({domain,className=''})=>{
  const [open,setOpen]=useState(false);
  const info=DOMAIN_INFO[domain];
  return <>
    <button
      type="button"
      onClick={(event)=>{event.stopPropagation();setOpen(true)}}
      title={`${info.label} — click for knowledge domain guide`}
      aria-label={`${info.label}. Open knowledge domain guide.`}
      className={`inline-flex items-center justify-center rounded-md border px-1.5 py-0.5 text-[10px] font-black leading-none tracking-wide cursor-pointer hover:brightness-125 focus:outline-none focus:ring-2 focus:ring-white/70 ${info.bgClass} ${info.borderClass} ${className}`}
    >{ABBREVIATION[domain]}</button>
    {open&&createPortal(
      <div className="fixed inset-0 z-[1000] bg-slate-950/94 backdrop-blur-sm grid place-items-center p-4" onClick={()=>setOpen(false)} role="dialog" aria-modal="true" aria-label="Knowledge domains">
        <div className="w-full max-w-xl rounded-2xl border border-slate-600 bg-slate-900 p-5 shadow-2xl" onClick={event=>event.stopPropagation()}>
          <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400 font-black">Knowledge domains</div>
          <h2 className="text-xl font-black text-white mt-1">What the icons mean</h2>
          <div className="space-y-2 mt-4">{ALL_DOMAINS.map(item=><div key={item} className={`flex items-start gap-3 rounded-xl border p-3 ${item===domain?'border-white/70 bg-white/5':'border-slate-700 bg-slate-950/40'}`}><DomainBadgeStatic domain={item}/><div><div className="font-bold text-white text-sm">{DOMAIN_INFO[item].label}</div><div className="text-xs leading-relaxed text-slate-300 mt-0.5">{DESCRIPTION[item]}</div></div></div>)}</div>
          <div className="text-center text-[10px] uppercase tracking-wider text-slate-500 mt-4">Click anywhere to return to play</div>
        </div>
      </div>,document.body)}
  </>;
};

const DomainBadgeStatic:React.FC<{domain:KnowledgeDomain}>=({domain})=>{
  const info=DOMAIN_INFO[domain];
  return <span className={`inline-flex min-w-[34px] items-center justify-center rounded-md border px-1.5 py-1 text-[10px] font-black leading-none tracking-wide ${info.bgClass} ${info.borderClass}`}>{ABBREVIATION[domain]}</span>;
};
