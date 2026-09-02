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
 return <div className="w-full max-w-4xl mx-auto mt-8 rounded-3xl border-2 border-violet-400 bg-slate-950/98 p-6 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="transfer-unlock-title">
   <div className="text-xs uppercase tracking-[.18em] text-emerald-300 font-black">A knowledge gap is not always a knowledge shortage</div>
   <h2 id="transfer-unlock-title" className="mt-2 text-3xl font-black text-white">The company knew. {target?.name||'This site'} didn’t.</h2>
   <p className="mt-3 max-w-3xl text-base leading-relaxed text-slate-300">{source?.name||'Another site'} already had stronger {domainLabel} capability. The failure was not caused by the company knowing nothing — the knowledge was in the wrong place when it was needed.</p>
   <div className="mt-5 text-sm font-black uppercase tracking-[.14em] text-violet-200">Two ways to move knowledge are now available</div>
   <div className="mt-3 grid gap-4 md:grid-cols-2">
     <section className="rounded-2xl border-2 border-emerald-600 bg-emerald-950/35 p-5">
       <div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-900/70"><Route className="h-6 w-6 text-emerald-300"/></div><div><div className="text-xs font-black uppercase tracking-wider text-emerald-300">Direct transfer</div><h3 className="text-xl font-black text-white">Knowledge Transfer</h3></div></div>
       <p className="mt-3 text-sm leading-relaxed text-slate-300">Move proven practice directly from one site to another. This is targeted and practical: a strong team teaches a weaker team rather than publishing for everyone.</p>
       <div className="mt-3 rounded-xl border border-emerald-800 bg-slate-950/70 px-3 py-2 text-sm text-emerald-100"><b>{source?.name||'Source site'} → {target?.name||'receiving site'}</b><br/>Best when the knowledge is needed in a particular place.</div>
     </section>
     <section className="rounded-2xl border-2 border-violet-600 bg-violet-950/35 p-5">
       <div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-xl bg-violet-900/70"><Building2 className="h-6 w-6 text-violet-200"/></div><div><div className="text-xs font-black uppercase tracking-wider text-violet-300">Organisation-wide access</div><h3 className="text-xl font-black text-white">Corporate Intranet</h3></div></div>
       <p className="mt-3 text-sm leading-relaxed text-slate-300">Publish stronger organisational knowledge so it can be accessed across the company. It scales further, but teams still need enough local capability to understand and apply what they find.</p>
       <div className="mt-3 rounded-xl border border-violet-800 bg-slate-950/70 px-3 py-2 text-sm text-violet-100"><b>One source → many sites</b><br/>Best when knowledge should be reusable across the organisation.</div>
     </section>
   </div>
   <p className="mt-4 text-sm text-slate-400">You will be able to use both approaches during <b className="text-white">Invest</b>. For now, keep playing the remaining Event card.</p>
   <button type="button" onClick={onContinue} className="mt-5 w-full rounded-xl bg-violet-600 py-3.5 text-base font-black text-white hover:bg-violet-500">CONTINUE TO THE NEXT EVENT <ArrowRight className="ml-1 inline h-5 w-5"/></button>
 </div>;
};
