import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, Lightbulb, Target } from 'lucide-react';
import type { BusinessStrategy, CompanyV2, GameSessionV2, KnowledgeStrategy } from '../types/gameV2.ts';
import { formatCurrency } from '../utils/format.ts';

type QuestionId = 'plan' | 'actual' | 'why' | 'improve';
type AnalyticsData = { available?: boolean; companies?: any[]; metrics?: any[]; events?: any[]; reason?: string };

type EvidenceCard = {
  title: string;
  value: string;
  detail: string;
  tone?: 'good' | 'warn' | 'neutral';
};

interface AARDebriefViewProps {
  session: GameSessionV2;
  company: CompanyV2;
  onClose: () => void;
  onOpenCharts?: () => void;
}

const QUESTIONS: { id: QuestionId; short: string; question: string; cue: string }[] = [
  { id: 'plan', short: '1 · Plan', question: 'What did you plan to happen?', cue: 'Start with what you were trying to achieve.' },
  { id: 'actual', short: '2 · Actual', question: 'What actually happened?', cue: 'Look at a few facts before explaining them.' },
  { id: 'why', short: '3 · Why', question: 'Why was it different?', cue: 'Focus on decisions, information and conditions — not blame.' },
  { id: 'improve', short: '4 · Improve', question: 'What would you change next time?', cue: 'Take one useful idea back to real work.' },
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
const display1 = (value: any) => value === null || value === undefined ? '—' : Number(value).toFixed(1);

export const AARDebriefView: React.FC<AARDebriefViewProps> = ({ session, company, onClose }) => {
  const [question, setQuestion] = useState<QuestionId>('plan');
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [note, setNote] = useState('');
  const noteKey = `tpg_aar_note_${session.id}_${company.id}`;

  useEffect(() => {
    try { setNote(localStorage.getItem(noteKey) || ''); } catch { /* browser storage may be unavailable */ }
    fetch(`/api/sessions/${session.id}/aar`)
      .then(r => r.ok ? r.json() : null)
      .then(data => data && setAnalytics(data))
      .catch(() => undefined);
  }, [session.id, company.id, noteKey]);

  const companyAnalytics = useMemo(
    () => analytics?.companies?.find((row: any) => row.company_id === company.id),
    [analytics, company.id],
  );

  const companyMetrics = useMemo(
    () => (analytics?.metrics || []).filter((row: any) => row.company_id === company.id),
    [analytics, company.id],
  );

  const preFinalMetric = useMemo(() => {
    const rows = [...companyMetrics];
    return rows.reverse().find((row: any) => row.trigger !== 'FINAL_DISRUPTION') || rows[0] || null;
  }, [companyMetrics]);

  const events = useMemo(
    () => (analytics?.events || []).filter((row: any) => row.company_id === company.id && row.success !== null && row.success !== undefined),
    [analytics, company.id],
  );

  const successes = events.filter((e: any) => e.success === true).length;
  const expectedSuccesses = events.reduce((sum: number, e: any) => sum + n(e.committed_probability_percent) / 100, 0);
  const startingTurnover = n(companyAnalytics?.starting_turnover || company.startingTurnover);
  const finalTurnover = n(companyAnalytics?.final_turnover ?? company.turnover);
  const finalSurvived = finalTurnover > 0 && company.sites.some(site => !site.isClosed);
  const showCodified = session.experienceMode === 'expert';

  const preFinalTeam = preFinalMetric?.avg_team_capability;
  const preFinalDocs = preFinalMetric?.avg_codified_knowledge;
  const preFinalCorp = preFinalMetric?.avg_corporate_intranet;
  const preFinalUsable = preFinalMetric?.avg_usable_intranet;

  const planCards: EvidenceCard[] = [
    {
      title: 'Business strategy',
      value: company.businessStrategyInitial ? BUSINESS_LABELS[company.businessStrategyInitial] : 'Not recorded',
      detail: 'What business outcome were you trying to protect or create?',
    },
    {
      title: 'Knowledge strategy',
      value: company.knowledgeStrategyInitial ? KNOWLEDGE_LABELS[company.knowledgeStrategyInitial] : 'Not recorded',
      detail: 'What did you expect this approach to make easier later?',
    },
  ];

  const actualCards: EvidenceCard[] = [
    {
      title: 'Turnover',
      value: `${formatCurrency(startingTurnover)} → ${formatCurrency(finalTurnover)}`,
      detail: finalTurnover >= startingTurnover ? 'The company finished above its starting turnover.' : 'The company finished below its starting turnover.',
      tone: finalTurnover >= startingTurnover ? 'good' : 'warn',
    },
    {
      title: 'Challenge outcomes',
      value: events.length ? `${successes}/${events.length} successful` : 'History unavailable',
      detail: events.length ? `Your choices implied about ${expectedSuccesses.toFixed(1)} successes. Chance still mattered.` : 'The analytics history was not available for this play.',
    },
    {
      title: 'Capability before the final disruption',
      value: preFinalMetric ? `Team ${display1(preFinalTeam)} · Corporate ${display1(preFinalCorp)}` : 'Snapshot unavailable',
      detail: 'This is the capability you had built before the climactic event — bankruptcy does not erase that history.',
    },
    {
      title: 'Final disruption',
      value: finalSurvived ? 'SURVIVED' : 'FAILED',
      detail: finalSurvived ? 'The organisation absorbed the final test.' : 'The final test exceeded the organisation’s available capability and financial resilience.',
      tone: finalSurvived ? 'good' : 'warn',
    },
  ];

  if (showCodified && preFinalMetric) {
    actualCards.splice(3, 0, {
      title: 'Codified knowledge before the final disruption',
      value: display1(preFinalDocs),
      detail: 'Advanced mode keeps local codified knowledge separate from team capability.',
    });
  }

  const whyPrompts = useMemo(() => {
    const prompts: string[] = [];
    if (!finalSurvived) prompts.push('What capability was missing when the final disruption arrived — and could you realistically have built it earlier?');
    if (events.length && Math.abs(successes - expectedSuccesses) >= 0.75) prompts.push(`Your probabilities suggested about ${expectedSuccesses.toFixed(1)} successes, but ${successes} occurred. Which differences were luck and which came from your choices?`);
    if (preFinalMetric && n(preFinalCorp) > n(preFinalUsable) + 0.25) prompts.push('You had more corporate knowledge than sites could readily use. Where did access exist without enough local capability or context?');
    if (company.knowledgeStrategyInitial && company.knowledgeStrategyFinal && company.knowledgeStrategyInitial !== company.knowledgeStrategyFinal) prompts.push(`Your knowledge strategy changed from “${KNOWLEDGE_LABELS[company.knowledgeStrategyInitial]}” to “${KNOWLEDGE_LABELS[company.knowledgeStrategyFinal]}”. What caused the shift?`);
    if (!prompts.length) prompts.push('Pick the moment that surprised you most. What did you assume beforehand that turned out not to be true?');
    return prompts.slice(0, 3);
  }, [finalSurvived, events.length, successes, expectedSuccesses, preFinalMetric, preFinalCorp, preFinalUsable, company.knowledgeStrategyInitial, company.knowledgeStrategyFinal]);

  const qIndex = QUESTIONS.findIndex(q => q.id === question);
  const current = QUESTIONS[qIndex];
  const goNext = () => qIndex < QUESTIONS.length - 1 && setQuestion(QUESTIONS[qIndex + 1].id);
  const saveNote = () => { try { localStorage.setItem(noteKey, note); } catch { /* ignore */ } };
  const finishGame = () => {
    saveNote();
    try {
      localStorage.removeItem('tpg_session_id');
      localStorage.removeItem('tpg_company_id');
      localStorage.removeItem('tpg_participant_id');
      localStorage.removeItem('tpg_participant');
    } catch { /* ignore */ }
    window.location.reload();
  };

  const toneClass = (tone?: EvidenceCard['tone']) => tone === 'warn'
    ? 'border-rose-800 bg-rose-950/20'
    : tone === 'good'
      ? 'border-emerald-800 bg-emerald-950/20'
      : 'border-slate-700 bg-slate-950/70';

  return (
    <div className="fixed inset-0 z-[220] bg-[#080b12]/[0.995] text-slate-200 p-3 md:p-5 overflow-auto">
      <div className="max-w-5xl mx-auto rounded-3xl border border-indigo-700 bg-slate-900 shadow-2xl overflow-hidden">
        <header className="px-5 py-4 border-b border-slate-700">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-indigo-300 font-black">After Action Review</div>
              <h2 className="text-2xl font-black text-white">Four questions. Keep the conversation simple.</h2>
              <p className="text-xs text-slate-400 mt-1">Use the evidence only when it helps the discussion. The goal is learning, not analysing every metric.</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={onClose} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-black text-slate-300 flex items-center gap-2"><ArrowLeft className="w-4 h-4"/>Final result</button>
              <button onClick={finishGame} className="rounded-xl bg-emerald-500 px-3 py-2 text-xs font-black text-slate-950 flex items-center gap-2"><CheckCircle2 className="w-4 h-4"/>Finish game</button>
            </div>
          </div>
          <nav className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4">
            {QUESTIONS.map(q => <button key={q.id} onClick={() => setQuestion(q.id)} className={`rounded-xl border px-3 py-2 text-left ${question === q.id ? 'border-indigo-400 bg-indigo-950/70' : 'border-slate-700 bg-slate-950/70 hover:border-slate-500'}`}><div className={`text-[10px] font-black uppercase ${question === q.id ? 'text-indigo-300' : 'text-slate-500'}`}>{q.short}</div><div className="text-xs font-bold text-white mt-0.5">{q.question}</div></button>)}
          </nav>
        </header>

        <main className="p-5">
          <section className="rounded-2xl border border-slate-700 bg-slate-950/55 p-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-950 border border-indigo-700 grid place-items-center shrink-0"><Target className="w-5 h-5 text-indigo-300"/></div>
              <div><div className="text-[10px] uppercase tracking-wider text-indigo-300 font-black">{current.short}</div><h3 className="text-3xl font-black text-white mt-1">{current.question}</h3><p className="text-sm text-slate-400 mt-1">{current.cue}</p></div>
            </div>

            {question === 'plan' && <div className="grid md:grid-cols-2 gap-3 mt-5">{planCards.map(card => <Evidence key={card.title} card={card} toneClass={toneClass}/>)}</div>}

            {question === 'actual' && <div className="grid md:grid-cols-2 gap-3 mt-5">{actualCards.map(card => <Evidence key={card.title} card={card} toneClass={toneClass}/>)}</div>}

            {question === 'why' && <div className="mt-5 space-y-3">{whyPrompts.map((prompt, index) => <div key={index} className="rounded-xl border border-amber-800/70 bg-amber-950/20 p-4"><div className="text-[10px] uppercase tracking-wider text-amber-300 font-black">Discuss</div><div className="text-base text-white font-bold mt-1">{prompt}</div></div>)}</div>}

            {question === 'improve' && <div className="mt-5">
              <div className="grid md:grid-cols-3 gap-3">
                <Takeaway title="Move knowledge" text="Use existing capability where it already exists instead of automatically buying or rebuilding it."/>
                <Takeaway title="Build access" text="When important knowledge keeps being needed, make it easier for the right people to find and use."/>
                <Takeaway title="Keep deep expertise" text="Reduce routine dependence on Experts without losing the expertise needed for genuinely exceptional problems."/>
              </div>
              <div className="mt-4 rounded-2xl border-2 border-emerald-700 bg-emerald-950/20 p-4">
                <div className="flex items-center gap-2"><Lightbulb className="w-5 h-5 text-emerald-300"/><div className="font-black text-white">One real-world commitment</div></div>
                <p className="text-xs text-slate-400 mt-1">What would you actually change at work because of what you noticed in the game?</p>
                <textarea value={note} onChange={e => setNote(e.target.value)} onBlur={saveNote} placeholder="In our real organisation, I would…" className="mt-3 w-full h-28 resize-none rounded-xl border border-emerald-800 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-emerald-400"/>
              </div>
            </div>}

            <div className="mt-5 flex justify-between items-center border-t border-slate-800 pt-4 gap-4">
              <span className="text-xs text-slate-500">People can pass on any question. The conversation matters more than completing every box.</span>
              {qIndex < QUESTIONS.length - 1
                ? <button onClick={goNext} className="rounded-xl bg-indigo-500 px-5 py-2.5 font-black text-white flex items-center gap-2 shrink-0">Next question <ArrowRight className="w-4 h-4"/></button>
                : <button onClick={finishGame} className="rounded-xl bg-emerald-500 px-5 py-2.5 font-black text-slate-950 flex items-center gap-2 shrink-0"><CheckCircle2 className="w-4 h-4"/>Finish game</button>}
            </div>
          </section>

          <div className="mt-4 flex items-start gap-2 rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-xs text-slate-400"><BookOpen className="w-4 h-4 shrink-0 mt-0.5"/><span>An AAR compares what you intended with what happened, asks why, then identifies one improvement. It is not a scorecard and it is not a blame exercise.</span></div>
        </main>
      </div>
    </div>
  );
};

const Evidence: React.FC<{card: EvidenceCard; toneClass: (tone?: EvidenceCard['tone']) => string}> = ({ card, toneClass }) => <div className={`rounded-xl border p-4 ${toneClass(card.tone)}`}><div className="text-[10px] uppercase tracking-wider text-slate-500 font-black">{card.title}</div><div className="text-xl font-black text-white mt-1">{card.value}</div><div className="text-xs text-slate-400 mt-2 leading-relaxed">{card.detail}</div></div>;

const Takeaway: React.FC<{title: string; text: string}> = ({ title, text }) => <div className="rounded-xl border border-slate-700 bg-slate-950/70 p-4"><div className="font-black text-white">{title}</div><div className="text-xs text-slate-400 mt-1 leading-relaxed">{text}</div></div>;
