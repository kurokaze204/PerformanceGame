import React from 'react';
import { ArrowRight, Building2, Route } from 'lucide-react';
import { DOMAIN_INFO } from '../types/game.ts';
import type { CompanyV2, GameSessionV2 } from '../types/gameV2.ts';
import { PROGRAMMED_FAILURE_TAG } from '../engine/eventProgressionV5.ts';

interface Props { session:GameSessionV2; company:CompanyV2; onContinue:()=>void; }

export const NewbieTransferUnlockOverlay:React.FC<Props>=({session,company,onContinue})=>{
 const event=(session.activeEvents[company.id]||[]).find(e=>e.card.tags?.includes(PROGRAMMED_FAILURE_TAG));
 const domain=event?.card.domains[0]?.domain;
 const sourceId=event?.card.tags?.find(tag=>tag.startsWith('tutorial-source:'))?.slice('tutorial-source:'.length);
 const targetId=event?.card.tags?.find(tag=>tag.startsWith('tutorial-target:'))?.slice('tutorial-target:'.length);
 const source=company.sites.find(site=>site.id===sourceId);
 const target=company.sites.find(site=>site.id===targetId);
 const domainLabel=domain?DOMAIN_INFO[domain].label:'the required knowledge';
 return <div className="w-full max-w-3xl mx-auto mt-8 rounded-3xl border-2 border-violet-400 bg-slate-950/98 p-6 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="transfer-unlock-title">
   <div className="text-xs uppercase tracking-[.18em] text-emerald-300 font-black">Knowledge location matters</div>
   <h2 id="transfer-unlock-title" className="mt-2 text-3xl font-black text-white">The company knew. {target?.name||'This site'} didn’t.</h2>
   <p className="mt-3 text-base leading-relaxed text-slate-300">{source?.name||'Another site'} already had stronger {domainLabel} knowledge. The problem was access, not absence.</p>
   <div className="mt-4 grid gap-3 sm:grid-cols-2">
     <div className="rounded-2xl border border-emerald-700 bg-emerald-950/25 px-4 py-3"><div className="flex items-center gap-2"><Route className="h-4 w-4 text-emerald-300"/><b className="text-sm text-white">Knowledge Transfer</b></div><div className="mt-1 text-xs text-slate-400">Move knowledge to the site that needs it.</div></div>
     <div className="rounded-2xl border border-violet-700 bg-violet-950/25 px-4 py-3"><div className="flex items-center gap-2"><Building2 className="h-4 w-4 text-violet-300"/><b className="text-sm text-white">Corporate Intranet</b></div><div className="mt-1 text-xs text-slate-400">Make knowledge available across the company.</div></div>
   </div>
   <button type="button" onClick={onContinue} className="mt-5 w-full rounded-xl bg-violet-600 py-3.5 text-base font-black text-white hover:bg-violet-500">NEXT CHALLENGE <ArrowRight className="ml-1 inline h-5 w-5"/></button>
 </div></div>;
};
