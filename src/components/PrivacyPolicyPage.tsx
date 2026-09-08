import React from 'react';
import { ArrowLeft, ExternalLink, ShieldCheck } from 'lucide-react';

export const PrivacyPolicyPage:React.FC=()=>{
 const back=()=>{if(window.history.length>1)window.history.back();else window.location.href='/';};
 return <main className="min-h-screen bg-[#080b12] text-slate-200 px-4 py-8 sm:py-12">
  <div className="mx-auto max-w-3xl">
   <button onClick={back} className="mb-5 inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-bold text-slate-300 hover:border-emerald-500"><ArrowLeft className="h-4 w-4"/>Back to The Performance Gap</button>
   <article className="rounded-3xl border border-slate-700 bg-slate-900 p-6 sm:p-9 shadow-2xl">
    <div className="flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-2xl border border-emerald-700 bg-emerald-950/40"><ShieldCheck className="h-6 w-6 text-emerald-300"/></div><div><div className="text-[10px] uppercase tracking-[.2em] font-black text-emerald-300">Delta Knowledge</div><h1 className="text-3xl font-black text-white">Privacy Policy</h1></div></div>
    <p className="mt-5 text-sm leading-7 text-slate-300">This policy explains how personal information is handled when you use <b>The Performance Gap</b>, a free strategic knowledge-management simulation provided by Delta Knowledge. The aim is to collect only what is useful for running and improving the simulation and for contacting you where you explicitly ask us to.</p>

    <Section title="Information we collect">
     <p>When you play, the simulation may record your entered player name, game/session identifiers, company assignment, gameplay decisions, scores, timing and outcomes. If you choose one of the optional email choices at the end of the game, we also collect your email address and a record of which choices you selected and when you selected them.</p>
     <p>You do not need to provide an email address to play the game. You may also use a preferred name rather than your legal name.</p>
    </Section>

    <Section title="Why we collect it">
     <p>Game information is used to operate the simulation, show results and debrief information, diagnose problems, understand how the simulation is used, and improve its design and balance.</p>
     <p>If you ask for a copy of your results, your email address is collected for that purpose. If you separately opt in to occasional Knowledge Management insights and Delta Knowledge updates, your email may also be used for those communications. The two choices are independent and unticked by default.</p>
    </Section>

    <Section title="How information is stored and shared">
     <p>The Performance Gap is hosted using third-party technology providers, including Render for application hosting and Neon for database services. Information may therefore be processed or stored on infrastructure operated by those providers, including infrastructure outside Australia.</p>
     <p>Delta Knowledge does not sell player information. Information may be disclosed where reasonably necessary to operate the service, comply with law, investigate security or technical issues, or protect the rights and safety of users and the service.</p>
    </Section>

    <Section title="Email and marketing consent">
     <p>Choosing to receive your game results does not automatically subscribe you to marketing. The optional updates choice is separate. If you opt in to updates, you can ask to stop receiving them at any time using the unsubscribe method in the communication or by contacting Delta Knowledge.</p>
    </Section>

    <Section title="Analytics, retention and de-identification">
     <p>Gameplay information may be retained for operational, research, balancing and improvement purposes. Where practical, Delta Knowledge may aggregate or de-identify gameplay information so it can be analysed without needing to identify individual players. Personal information is not intended to be kept longer than reasonably necessary for the purpose for which it was collected.</p>
    </Section>

    <Section title="Security">
     <p>Reasonable technical measures are used to protect information. Per-game facilitator passwords are stored as one-way password hashes rather than plain text. No internet service can guarantee absolute security, so please do not enter sensitive personal information into player names, game names or free-text fields.</p>
    </Section>

    <Section title="Access, correction, deletion and questions">
     <p>You can ask what personal information Delta Knowledge holds about you, request correction or deletion where appropriate, withdraw marketing consent, or raise a privacy concern by contacting Stuart French through the Delta Knowledge website contact form.</p>
     <div className="mt-3 grid sm:grid-cols-2 gap-2">
      <a href="https://www.deltaknowledge.net" target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm hover:border-emerald-500"><span>www.DeltaKnowledge.net</span><ExternalLink className="h-4 w-4"/></a>
      <a href="https://www.linkedin.com/in/stuartfrench/" target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm hover:border-indigo-500"><span>Stuart French on LinkedIn</span><ExternalLink className="h-4 w-4"/></a>
     </div>
    </Section>

    <Section title="Ko-fi">
     <p>The setup screen contains an optional Ko-fi support link/widget. Ko-fi is a separate service with its own privacy practices. Delta Knowledge does not require a donation to use The Performance Gap.</p>
    </Section>

    <div className="mt-8 border-t border-slate-700 pt-4 text-xs text-slate-500">Last updated: 8 September 2026. This policy may be updated as the simulation and its supporting services change.</div>
   </article>
  </div>
 </main>;
};

const Section:React.FC<{title:string;children:React.ReactNode}>=({title,children})=><section className="mt-7"><h2 className="text-lg font-black text-white">{title}</h2><div className="mt-2 space-y-3 text-sm leading-7 text-slate-300">{children}</div></section>;
