import React, { useState } from 'react';
import type { BusinessStrategy, KnowledgeStrategy } from '../types/gameV2.ts';

const BUSINESS_OPTIONS: { value: BusinessStrategy; label: string }[] = [
  { value: 'short_term_profit', label: 'Maximise short-term profit' },
  { value: 'growth', label: 'Pursue growth opportunities' },
  { value: 'downside_protection', label: 'Protect the business from downside risk' },
  { value: 'balanced', label: 'Balance growth and resilience' },
  { value: 'adaptive', label: 'Wait and respond as circumstances develop' },
];

const KNOWLEDGE_OPTIONS: { value: KnowledgeStrategy; label: string; hint: string }[] = [
  { value: 'rely_on_people', label: 'Rely on our people', hint: 'Keep critical expertise with capable individuals.' },
  { value: 'build_team_capability', label: 'Build team capability', hint: 'Spread skills and practical know-how through the workforce.' },
  { value: 'capture_knowledge', label: 'Capture what we know', hint: 'Document and share important organisational knowledge.' },
  { value: 'build_networks', label: 'Build networks', hint: 'Use relationships and communities to access expertise.' },
  { value: 'automate_critical_knowledge', label: 'Automate critical knowledge', hint: 'Embed important know-how into systems and processes.' },
  { value: 'buy_expertise', label: 'Buy expertise when needed', hint: 'Use external specialists rather than build everything internally.' },
  { value: 'transfer_best_practice', label: 'Transfer Best Practice around the organisation', hint: 'Move proven practice from stronger parts of the organisation to places that need it.' },
  { value: 'no_particular_strategy', label: 'No particular knowledge strategy', hint: 'Respond to knowledge needs as they arise.' },
];

function knowledgeLabel(value: KnowledgeStrategy | null | undefined) {
  return KNOWLEDGE_OPTIONS.find((x) => x.value === value)?.label || 'Not selected';
}

interface Props {
  stage: 'initial' | 'final';
  originalKnowledgeStrategy?: KnowledgeStrategy | null;
  originalBusinessStrategy?: BusinessStrategy | null;
  onSubmit: (business: BusinessStrategy, knowledge: KnowledgeStrategy) => Promise<void>;
}

export function StrategyPromptV2({ stage, originalKnowledgeStrategy, originalBusinessStrategy, onSubmit }: Props) {
  const [business, setBusiness] = useState<BusinessStrategy>(originalBusinessStrategy || 'balanced');
  const [knowledge, setKnowledge] = useState<KnowledgeStrategy>(originalKnowledgeStrategy || 'no_particular_strategy');
  const [saving, setSaving] = useState(false);
  const initial = stage === 'initial';

  return (
    <div className="fixed bottom-0 left-0 right-0 top-[var(--tpg-header-height)] z-[190] flex items-start justify-center overflow-y-auto overscroll-contain touch-pan-y bg-slate-950/90 p-2 backdrop-blur-sm [-webkit-overflow-scrolling:touch] sm:p-3 xl:items-center xl:p-4">
      <div className="my-2 w-full max-w-2xl rounded-3xl border border-slate-700 bg-slate-900 p-4 shadow-2xl sm:p-5 xl:my-4 xl:p-8">
        <div className="text-xs uppercase tracking-[0.22em] text-indigo-400 font-black">The Performance Gap</div>
        <h2 className="mt-1 text-2xl font-black text-white xl:mt-2 xl:text-3xl">{initial ? 'Before we begin…' : 'Having run the company…'}</h2>
        <p className="mt-1 text-sm leading-relaxed text-slate-400 xl:mt-2 xl:text-base">
          {initial
            ? 'Choose the approach your team intends to take. There is no correct answer — this simply records what you planned.'
            : 'At the start you chose the knowledge strategy shown below. Knowing what you know now, what would you choose?' }
        </p>
        {initial && (
          <div className="mt-2 rounded-xl border border-emerald-700 bg-emerald-950/35 px-3 py-2 text-xs font-black text-emerald-300 xl:mt-3 xl:px-4 xl:py-3 xl:text-sm">
            This choice does not change how your game plays.
          </div>
        )}

        {initial ? (
          <div className="mt-4 space-y-4 xl:mt-7 xl:space-y-6">
            <label className="block">
              <span className="text-sm font-black text-white">What is your business strategy?</span>
              <select value={business} onChange={(e) => setBusiness(e.target.value as BusinessStrategy)} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white xl:mt-2 xl:rounded-2xl xl:px-4 xl:py-3 xl:text-base">
                {BUSINESS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-black text-white">How will you manage the knowledge your business needs?</span>
              <select value={knowledge} onChange={(e) => setKnowledge(e.target.value as KnowledgeStrategy)} className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white">
                {KNOWLEDGE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <div className="mt-1.5 text-xs leading-relaxed text-slate-400 xl:mt-2 xl:text-sm">{KNOWLEDGE_OPTIONS.find((x) => x.value === knowledge)?.hint}</div>
            </label>
          </div>
        ) : (
          <div className="mt-4 space-y-4 xl:mt-7 xl:space-y-5">
            <div className="rounded-2xl border border-slate-700 bg-slate-950/70 p-4">
              <div className="text-xs uppercase tracking-widest text-slate-500 font-bold">Your original knowledge strategy</div>
              <div className="text-xl font-black text-white mt-1">{knowledgeLabel(originalKnowledgeStrategy)}</div>
            </div>
            <label className="block">
              <span className="text-sm font-black text-white">How would you manage the knowledge your business needs now?</span>
              <select value={knowledge} onChange={(e) => setKnowledge(e.target.value as KnowledgeStrategy)} className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white">
                {KNOWLEDGE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <div className="mt-2 text-sm text-slate-400">{KNOWLEDGE_OPTIONS.find((x) => x.value === knowledge)?.hint}</div>
            </label>
          </div>
        )}

        <button
          disabled={saving}
          onClick={async () => { setSaving(true); try { await onSubmit(initial ? business : (originalBusinessStrategy || business), knowledge); } finally { setSaving(false); } }}
          className="tpg-action tpg-action-primary mt-5 w-full !h-12 !text-base disabled:opacity-50 xl:mt-8 xl:!h-14 xl:!text-lg"
        >
          {saving ? 'Saving…' : initial ? 'Lock in our starting strategy' : 'Record our new choice'}
        </button>
      </div>
    </div>
  );
}
