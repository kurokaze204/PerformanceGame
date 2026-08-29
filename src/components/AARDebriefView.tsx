import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, BarChart3, BookOpen, Building2, CheckCircle2, Cpu, Lightbulb, Network, ShieldCheck, Target, Users } from 'lucide-react';
import type { CompanyV2, GameSessionV2, BusinessStrategy, KnowledgeStrategy } from '../types/gameV2.ts';
import { formatCurrency } from '../utils/format.ts';

type QuestionId = 'plan' | 'actual' | 'why' | 'improve';
type LensId = 'whole' | 'challenges' | 'experts' | 'sites' | 'knowledge' | 'technology';
type AnalyticsData = { available?: boolean; companies?: any[]; metrics?: any[]; events?: any[]; reason?: string };
type Evidence = { title: string; value: string; detail: string; tone?: 'good' | 'warn' | 'neutral' };

interface AARDebriefViewProps {
  session: GameSessionV2;
  company: CompanyV2;
  onClose: () => void;
  onOpenCharts?: () => void;
}

const QUESTIONS: { id: QuestionId; short: string; question: string; cue: string }[] = [
  { id: 'plan', short: '1 · Plan', question: 'What did you plan to happen?', cue: 'Start with intent, not hindsight.' },
  { id: 'actual', short: '2 · Actual', question: 'What actually happened?', cue: 'Use evidence before interpretation.' },
  { id: 'why', short: '3 · Why', question: 'Why was it different?', cue: 'Discuss conditions and decisions, not blame.' },
  { id: 'improve', short: '4 · Improve', question: 'What would you improve next time — in real life?', cue: 'Transfer one useful idea back to work.' },
];

const LENSES: { id: LensId; label: string; icon: React.ElementType }[] = [
  { id: 'whole', label: 'Whole company', icon: Building2 },
  { id: 'challenges', label: 'Challenges', icon: Target },
  { id: 'experts', label: 'Experts', icon: Users },
  { id: 'sites', label: 'Sites', icon: ShieldCheck },
  { id: 'knowledge', label: 'Knowledge', icon: BookOpen },
  { id: 'technology', label: 'Networks & tech', icon: Cpu },
];

const BUSINESS_LABELS: Record<BusinessStrategy, string> = {
  short_term_profit: 'Maximise short-term profit',
  growth: 'Pursue growth opportunities',
  downside_protection: 'Protect the business from downside risk',
  balanced: 'Balance growth and resilience',
  adaptive: 'Wait and respond as circumstances develop',
};
const KNOWLEDGE_LABELS: Record<KnowledgeStrategy, string> = {
  rely_on_people: 'Rely on our people',
  build_team_capability: 'Build team capability',
  capture_knowledge: 'Capture what we know',
  build_networks: 'Build networks',
  automate_critical_knowledge: 'Automate critical knowledge',
  buy_expertise: 'Buy expertise when needed',
  no_particular_strategy: 'No particular knowledge strategy',
};

const n = (value: any) => Number(value || 0);
const signedMoney = (value: number) => `${value >= 0 ? '+' : '−'}${formatCurrency(Math.abs(Math.round(value)))}`;
const delta = (start: any, end: any) => n(end) - n(start);

export const AARDebriefView: React.FC<AARDebriefViewProps> = ({ session, company, onClose, onOpenCharts }) => {
  const [question, setQuestion] = useState<QuestionId>('plan');
  const [lens, setLens] = useState<LensId>('whole');
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [note, setNote] = useState('');
  const noteKey = `tpg_aar_note_${session.id}_${company.id}`;

  useEffect(() => {
    try { setNote(localStorage.getItem(noteKey) || ''); } catch { /* browser storage may be unavailable */ }
    fetch(`/api/sessions/${session.id}/aar`).then(r => r.ok ? r.json() : null).then(data => data && setAnalytics(data)).catch(() => undefined);
  }, [session.id, company.id, noteKey]);

  const companyAnalytics = useMemo(() => analytics?.companies?.find((row: any) => row.company_id === company.id), [analytics, company.id]);
  const events = useMemo(() => (analytics?.events || []).filter((row: any) => row.company_id === company.id), [analytics, company.id]);
  const resolvedEvents = events.filter((e: any) => e.success !== null && e.success !== undefined);
  const successes = resolvedEvents.filter((e: any) => e.success === true).length;
  const expectedSuccesses = resolvedEvents.reduce((sum: number, e: any) => sum + n(e.committed_probability_percent) / 100, 0);
  const eventNet = resolvedEvents.reduce((sum: number, e: any) => sum + n(e.net_financial_impact), 0);
  const interventionSpend = resolvedEvents.reduce((sum: number, e: any) => sum + n(e.intervention_cost), 0);
  const consultantSpend = resolvedEvents.reduce((sum: number, e: any) => sum + n(e.consultant_cost), 0);
  const startingTurnover = n(companyAnalytics?.starting_turnover || company.startingTurnover);
  const finalTurnover = n(companyAnalytics?.final_turnover || company.turnover);
  const vacantExperts = company.experts.filter(e => e.isVacant).length;
  const spofExperts = company.experts.filter(e => !e.isVacant && e.isSPOF).length;
  const closedSites = company.sites.filter(s => s.isClosed).length;

  const topEvents = [...resolvedEvents].sort((a: any, b: any) => Math.abs(n(b.net_financial_impact)) - Math.abs(n(a.net_financial_impact))).slice(0, 4);
  const siteScores = company.sites.filter(s => !s.isClosed).map(site => ({
    name: site.name,
    team: (Object.values(site.teamCapability) as number[]).reduce((a, b) => a + b, 0),
    docs: (Object.values(site.codifiedKnowledge) as number[]).reduce((a, b) => a + b, 0),
    turnover: site.turnover,
  })).sort((a, b) => a.team - b.team);

  const evidence = useMemo<Evidence[]>(() => {
    if (lens === 'challenges') {
      if (!topEvents.length) return [{ title: 'Challenge evidence', value: 'No full history', detail: 'The analytics database did not return earlier Challenge records for this play.' }];
      return topEvents.map((e: any) => ({
        title: `R${e.round} · ${e.card_title}`,
        value: `${e.success ? 'SUCCESS' : 'FAIL'} · ${signedMoney(n(e.net_financial_impact))}`,
        detail: `Committed chance ${Math.round(n(e.committed_probability_percent))}% · intervention ${formatCurrency(n(e.intervention_cost))} · exposure ${formatCurrency(n(e.financial_exposure))}`,
        tone: e.success ? 'good' : 'warn',
      }));
    }
    if (lens === 'experts') return [
      { title: 'Experts remaining', value: `${company.experts.length - vacantExperts}/${company.experts.length}`, detail: `${vacantExperts} vacant role(s) at the end of the simulation.` },
      { title: 'Single Points of Failure', value: String(spofExperts), detail: spofExperts ? 'Deep expertise still depends heavily on particular people.' : 'No current Expert is flagged as a Single Point of Failure.', tone: spofExperts ? 'warn' : 'good' },
      { title: 'External expertise purchased', value: formatCurrency(consultantSpend || company.cumulativeConsultantSpend), detail: 'Useful temporary capability, but it does not leave the same organisational capability behind.' },
    ];
    if (lens === 'sites') return [
      { title: 'Sites still operating', value: `${company.sites.length - closedSites}/${company.sites.length}`, detail: closedSites ? `${closedSites} site(s) closed during play.` : 'All sites remain open.', tone: closedSites ? 'warn' : 'good' },
      ...siteScores.slice(0, 3).map(s => ({ title: s.name, value: `Team ${s.team} · Docs ${s.docs}`, detail: `Turnover ${formatCurrency(s.turnover)}. Compare local capability with what the site needs to do.` })),
    ];
    if (lens === 'knowledge') {
      const startTeam = n(companyAnalytics?.starting_avg_team); const finalTeam = n(companyAnalytics?.final_avg_team);
      const startDocs = n(companyAnalytics?.starting_avg_codified); const finalDocs = n(companyAnalytics?.final_avg_codified);
      const startCorp = n(companyAnalytics?.starting_avg_intranet); const finalCorp = n(companyAnalytics?.final_avg_intranet);
      const startUsable = n(companyAnalytics?.starting_avg_usable_intranet); const finalUsable = n(companyAnalytics?.final_avg_usable_intranet);
      return [
        { title: 'Average team capability', value: companyAnalytics ? `${startTeam.toFixed(1)} → ${finalTeam.toFixed(1)}` : 'See company map', detail: companyAnalytics ? `Change ${delta(startTeam, finalTeam) >= 0 ? '+' : ''}${delta(startTeam, finalTeam).toFixed(1)}` : 'Detailed starting averages require the analytics database.' },
        { title: 'Average codified knowledge', value: companyAnalytics ? `${startDocs.toFixed(1)} → ${finalDocs.toFixed(1)}` : 'See company map', detail: 'Codified knowledge survives normal staff turnover and can be reused.' },
        { title: 'Corporate knowledge', value: companyAnalytics ? `${startCorp.toFixed(1)} → ${finalCorp.toFixed(1)}` : 'See HQ', detail: 'Corporate knowledge only helps when people at the point of work can absorb and use it.' },
        { title: 'Usable corporate knowledge', value: companyAnalytics ? `${startUsable.toFixed(1)} → ${finalUsable.toFixed(1)}` : 'See sites', detail: finalCorp > finalUsable ? 'A gap remains between what the organisation has recorded and what sites can actually use.' : 'Access and local capability are broadly aligned.', tone: finalCorp > finalUsable ? 'warn' : 'good' },
      ];
    }
    if (lens === 'technology') return [
      { title: 'Automation', value: `${company.automatedDomains.length}/5 domains`, detail: company.automatedDomains.length ? `Embedded in: ${company.automatedDomains.join(', ')}.` : 'No domain was automated.' },
      { title: 'Communities of Practice', value: `${session.copMemberships.filter(m => m.companyId === company.id).length} membership(s)`, detail: 'Networks gave access to capability without requiring the company to own all of it.' },
      { title: 'Corporate knowledge base', value: `${(Object.values(company.intranet) as number[]).reduce((a, b) => a + b, 0)} total points`, detail: 'Technology stores and distributes knowledge; it does not by itself create local judgement or capability.' },
    ];
    return [
      { title: 'Turnover', value: `${formatCurrency(startingTurnover)} → ${formatCurrency(finalTurnover)}`, detail: `Net change ${signedMoney(finalTurnover - startingTurnover)} across the simulation.`, tone: finalTurnover >= startingTurnover ? 'good' : 'warn' },
      { title: 'Challenge outcomes', value: `${successes}/${resolvedEvents.length || '—'} successful`, detail: resolvedEvents.length ? `Your committed probabilities implied about ${expectedSuccesses.toFixed(1)} successes. Actual outcomes also contain chance.` : 'Full Challenge history requires analytics data.' },
      { title: 'Knowledge investment', value: formatCurrency(n(companyAnalytics?.knowledge_spend || company.cumulativeKnowledgeSpend)), detail: `Challenge intervention spend recorded: ${formatCurrency(interventionSpend)}. The useful question is what capability that spend left behind.` },
      { title: 'Net Challenge impact', value: signedMoney(eventNet), detail: 'Business impact minus intervention costs across recorded Challenges.' },
    ];
  }, [lens, topEvents, company, vacantExperts, spofExperts, consultantSpend, closedSites, siteScores, companyAnalytics, session.copMemberships, startingTurnover, finalTurnover, successes, resolvedEvents.length, expectedSuccesses, interventionSpend, eventNet]);

  const whyPrompts = useMemo(() => {
    const prompts: string[] = [];
    if (resolvedEvents.length && Math.abs(successes - expectedSuccesses) >= 0.75) prompts.push(`Outcomes differed from the probabilities: about ${expectedSuccesses.toFixed(1)} successes were expected, and ${successes} occurred. Which differences were luck, and which came from your decisions?`);
    if (n(companyAnalytics?.final_avg_intranet) > n(companyAnalytics?.final_avg_usable_intranet) + 0.25) prompts.push('Corporate knowledge grew faster than usable knowledge. Where did access exist without enough local capability to use it?');
    if (spofExperts > 0 || vacantExperts > 0) prompts.push('Expertise remained concentrated or was lost. Where did relying on an individual create value, and where did it create fragility?');
    if (consultantSpend > 0) prompts.push(`You spent ${formatCurrency(consultantSpend)} on consultants during Challenges. Which of that spend solved an immediate problem without building future capability?`);
    if (company.knowledgeStrategyInitial && company.knowledgeStrategyFinal && company.knowledgeStrategyInitial !== company.knowledgeStrategyFinal) prompts.push(`Your knowledge strategy changed from “${KNOWLEDGE_LABELS[company.knowledgeStrategyInitial]}” to “${KNOWLEDGE_LABELS[company.knowledgeStrategyFinal]}”. What experience changed your mind?`);
    if (!prompts.length) prompts.push('Pick one moment where the result surprised you. What was different about the knowledge available, the way it was accessed, or the timing of the decision?');
    return prompts.slice(0, 4);
  }, [resolvedEvents.length, successes, expectedSuccesses, companyAnalytics, spofExperts, vacantExperts, consultantSpend, company.knowledgeStrategyInitial, company.knowledgeStrategyFinal]);

  const qIndex = QUESTIONS.findIndex(q => q.id === question);
  const current = QUESTIONS[qIndex];
  const goNext = () => qIndex < QUESTIONS.length - 1 && setQuestion(QUESTIONS[qIndex + 1].id);

  return (
    <div className="fixed inset-0 z-[220] bg-[#080b12]/[0.995] text-slate-200 p-3 md:p-5 overflow-hidden">
      <div className="h-full max-w-[1500px] mx-auto rounded-3xl border border-indigo-700 bg-slate-900 shadow-2xl flex flex-col overflow-hidden">
        <header className="px-5 py-3 border-b border-slate-700 shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div><div className="text-[10px] uppercase tracking-[0.2em] text-indigo-300 font-black">After Action Review</div><h2 className="text-2xl font-black text-white">Turn the game into learning</h2><p className="text-xs text-slate-400 mt-1">Go left-to-right if AAR is new to you. Jump between questions whenever the conversation naturally moves. This is about decisions and conditions — not blame.</p></div>
            <div className="flex gap-2">{onOpenCharts && <button onClick={onOpenCharts} className="rounded-xl border border-indigo-700 bg-indigo-950 px-3 py-2 text-xs font-black text-indigo-100 flex items-center gap-2"><BarChart3 className="w-4 h-4"/>Charts</button>}<button onClick={onClose} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-black text-slate-300 flex items-center gap-2"><ArrowLeft className="w-4 h-4"/>Final result</button></div>
          </div>
          <nav className="grid grid-cols-4 gap-2 mt-3">{QUESTIONS.map(q => <button key={q.id} onClick={() => setQuestion(q.id)} className={`rounded-xl border px-3 py-2 text-left ${question === q.id ? 'border-indigo-400 bg-indigo-950/70' : 'border-slate-700 bg-slate-950/70 hover:border-slate-500'}`}><div className={`text-[10px] font-black uppercase ${question === q.id ? 'text-indigo-300' : 'text-slate-500'}`}>{q.short}</div><div className="text-xs font-black text-white mt-0.5 leading-tight">{q.question}</div></button>)}</nav>
        </header>

        <main className="flex-1 min-h-0 p-4 grid grid-cols-[minmax(0,1fr)_330px] gap-4">
          <section className="min-h-0 overflow-auto rounded-2xl border border-slate-700 bg-slate-950/65 p-5">
            <div className="flex items-start justify-between gap-4"><div><div className="text-xs uppercase tracking-wider text-indigo-300 font-black">{current.short}</div><h3 className="text-3xl font-black text-white mt-1">{current.question}</h3><p className="text-sm text-slate-400 mt-1">{current.cue}</p></div>{question !== 'plan' && <div className="rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-[10px] text-slate-400 max-w-xs"><b className="text-white">AAR rule:</b> describe what happened before explaining why.</div>}</div>

            {question === 'plan' && <div className="mt-5 grid grid-cols-2 gap-3">
              <PlanCard label="Business strategy" value={company.businessStrategyInitial ? BUSINESS_LABELS[company.businessStrategyInitial] : 'Not recorded'} prompt="What did you expect this choice to optimise or protect?" />
              <PlanCard label="Knowledge strategy" value={company.knowledgeStrategyInitial ? KNOWLEDGE_LABELS[company.knowledgeStrategyInitial] : 'Not recorded'} prompt="How did you expect the organisation to get the knowledge it needed?" />
              <div className="col-span-2 rounded-2xl border border-indigo-800 bg-indigo-950/25 p-4"><div className="flex gap-3"><Target className="w-5 h-5 text-indigo-300 shrink-0"/><div><div className="font-black text-white">Say the plan out loud before looking at the result.</div><p className="text-sm text-slate-300 mt-1">“We planned to <b>___</b>, because we thought <b>___</b> would matter most.” Keep it to one minute. Do not defend the plan yet.</p></div></div></div>
            </div>}

            {question === 'actual' && <><LensBar lens={lens} setLens={setLens}/><div className="grid grid-cols-2 gap-3 mt-4">{evidence.map((item, i) => <EvidenceCard key={`${item.title}-${i}`} item={item}/>)}</div>{analytics?.available === false && <div className="mt-3 rounded-xl border border-amber-800 bg-amber-950/25 px-3 py-2 text-xs text-amber-200">Detailed historical Challenge evidence is unavailable because the analytics database is not connected. The end-state evidence above is still usable.</div>}</>}

            {question === 'why' && <><LensBar lens={lens} setLens={setLens}/><div className="mt-4 grid grid-cols-2 gap-3">{whyPrompts.map((prompt, i) => <div key={i} className="rounded-2xl border border-violet-800 bg-violet-950/25 p-4"><div className="text-[10px] uppercase tracking-wider text-violet-300 font-black">Possible explanation to test</div><p className="text-sm text-white mt-2 leading-relaxed">{prompt}</p><div className="text-[10px] text-slate-500 mt-3">Ask: “What evidence supports that? What else could explain it?”</div></div>)}</div></>}

            {question === 'improve' && <div className="mt-5"><div className="grid grid-cols-3 gap-3">
              <TransferCard title="Make knowledge visible" text="Know where critical knowledge sits, who can use it, and where the gaps are." />
              <TransferCard title="Reduce fragile dependence" text="Build backup capability around critical experts rather than treating expertise itself as the problem." />
              <TransferCard title="Learn deliberately" text="Use AARs and lessons processes to convert experience into changed capability." />
              <TransferCard title="Build access, not just content" text="Combine corporate knowledge with local capability so people can actually use what is available." />
              <TransferCard title="Use networks intentionally" text="Maintain communities and relationships that give access to expertise you do not need to own." />
              <TransferCard title="Embed where it fits" text="Automate repeatable knowledge where reliability and scale matter; keep humans for judgement and edge cases." />
            </div><div className="mt-4 rounded-2xl border-2 border-emerald-600 bg-emerald-950/25 p-4"><div className="flex items-center gap-2"><Lightbulb className="w-5 h-5 text-emerald-300"/><div className="font-black text-white">One real-world commitment</div></div><p className="text-xs text-slate-400 mt-1">Not “what would we do differently in the game?” What would you change at work because of what you noticed here?</p><textarea value={note} onChange={e => setNote(e.target.value)} onBlur={() => { try { localStorage.setItem(noteKey, note); } catch { /* ignore */ } }} placeholder="In our real organisation, I would…" className="mt-3 w-full h-28 resize-none rounded-xl border border-emerald-800 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-emerald-400"/></div></div>}

            <div className="mt-5 flex justify-between items-center border-t border-slate-800 pt-4"><span className="text-xs text-slate-500">People can pass on any question. Silence for 20–30 seconds before discussion is often useful.</span>{qIndex < QUESTIONS.length - 1 ? <button onClick={goNext} className="rounded-xl bg-indigo-500 px-5 py-2.5 font-black text-white flex items-center gap-2">Next question <ArrowRight className="w-4 h-4"/></button> : <button onClick={onClose} className="rounded-xl bg-emerald-500 px-5 py-2.5 font-black text-slate-950 flex items-center gap-2"><CheckCircle2 className="w-4 h-4"/>Finish AAR</button>}</div>
          </section>

          <aside className="rounded-2xl border border-slate-700 bg-slate-950/80 p-4 overflow-auto">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-black">What an AAR is for</div><h4 className="text-lg font-black text-white mt-1">Learn, don’t judge</h4><p className="text-xs text-slate-400 mt-2 leading-relaxed">An AAR compares intent with evidence so a group can improve its mental model. Successes are reviewed too. A failure is useful evidence when it reveals a condition the group did not understand.</p>
            <div className="mt-4 space-y-2"><Rule icon={Target} title="Plan first" text="Hindsight makes the original plan look more obvious than it was."/><Rule icon={BookOpen} title="Evidence before stories" text="Use the game record to anchor the conversation."/><Rule icon={Users} title="No blame" text="Talk about choices, information, constraints and timing — not who was at fault."/><Rule icon={Network} title="Multiple views help" text="A CEO, operator, KMer and technologist may notice different parts of the same system."/></div>
            <div className="mt-4 rounded-xl border border-indigo-800 bg-indigo-950/30 p-3"><div className="text-[10px] uppercase text-indigo-300 font-black">Facilitation cue</div><p className="text-xs text-indigo-100/80 mt-1">If discussion stalls, pick a component — one Expert, site, Challenge or investment — and run all four questions against just that component. Then zoom back out.</p></div>
          </aside>
        </main>
      </div>
    </div>
  );
};

const LensBar: React.FC<{ lens: LensId; setLens: (lens: LensId) => void }> = ({ lens, setLens }) => <div className="mt-5"><div className="text-[10px] uppercase tracking-wider text-slate-500 font-black mb-2">Look at one component</div><div className="flex flex-wrap gap-2">{LENSES.map(item => { const Icon = item.icon; return <button key={item.id} onClick={() => setLens(item.id)} className={`rounded-full border px-3 py-1.5 text-xs font-black flex items-center gap-1.5 ${lens === item.id ? 'border-indigo-400 bg-indigo-950 text-indigo-100' : 'border-slate-700 bg-slate-900 text-slate-400'}`}><Icon className="w-3.5 h-3.5"/>{item.label}</button>; })}</div></div>;

const PlanCard: React.FC<{ label: string; value: string; prompt: string }> = ({ label, value, prompt }) => <div className="rounded-2xl border border-indigo-800 bg-slate-900 p-4"><div className="text-[10px] uppercase tracking-wider text-slate-500 font-black">{label}</div><div className="text-xl font-black text-white mt-1">{value}</div><div className="text-xs text-indigo-200/70 mt-3">{prompt}</div></div>;

const EvidenceCard: React.FC<{ item: Evidence }> = ({ item }) => <div className={`rounded-2xl border p-4 ${item.tone === 'good' ? 'border-emerald-800 bg-emerald-950/20' : item.tone === 'warn' ? 'border-amber-800 bg-amber-950/20' : 'border-slate-700 bg-slate-900'}`}><div className="text-[10px] uppercase tracking-wider text-slate-500 font-black">{item.title}</div><div className="text-xl font-black text-white mt-1">{item.value}</div><p className="text-xs text-slate-400 mt-2 leading-relaxed">{item.detail}</p></div>;

const TransferCard: React.FC<{ title: string; text: string }> = ({ title, text }) => <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4"><div className="font-black text-white text-sm">{title}</div><p className="text-xs text-slate-400 mt-1 leading-relaxed">{text}</p></div>;

const Rule: React.FC<{ icon: React.ElementType; title: string; text: string }> = ({ icon: Icon, title, text }) => <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3"><div className="flex items-center gap-2"><Icon className="w-4 h-4 text-indigo-300"/><b className="text-xs text-white">{title}</b></div><p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{text}</p></div>;
