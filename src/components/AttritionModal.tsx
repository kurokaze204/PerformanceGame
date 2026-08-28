import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2, ShieldAlert, UserCheck, UserX, Users } from 'lucide-react';
import type { Company, GameSession, KnowledgeDomain } from '../types/game.ts';
import { DOMAIN_INFO } from '../types/game.ts';

interface AttritionModalProps {
  session: GameSession;
  company: Company;
  phaseResult: any;
  onAdvanceToNextRound: () => void;
}

type RiskCard = {
  id: string;
  kind: 'expert-departed' | 'expert-retained' | 'workforce-loss' | 'workforce-stable';
  title: string;
  location?: string;
  domainLines?: string[];
  detail: string;
  impact: string;
  roll?: number;
  warning?: string;
};

export const AttritionModal: React.FC<AttritionModalProps> = ({
  session,
  company,
  phaseResult,
  onAdvanceToNextRound,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const summary = phaseResult?.attritionSummaries?.[company.id] || {
    departedExperts: [],
    workforceAttrition: [],
    closedSites: [],
  };

  const cards = useMemo<RiskCard[]>(() => {
    const departedById = new Map(summary.departedExperts.map((entry: any) => [entry.expertId, entry]));

    // The engine currently performs one attrition check for each of the three Deep Experts,
    // followed by one general-workforce knowledge-loss check. The outcomes are already
    // committed server-side before this screen appears; this component only reveals them.
    const expertCards = company.experts.slice(0, 3).map((expert) => {
      const departure: any = departedById.get(expert.id);
      const location = expert.location === 'HQ'
        ? 'Corporate HQ'
        : company.sites.find((site) => site.id === expert.location)?.name || expert.location;
      const domainLines = expert.domains.map((skill) => `${DOMAIN_INFO[skill.domain].label} ${skill.score}`);

      if (departure) {
        return {
          id: `expert-${expert.id}`,
          kind: 'expert-departed' as const,
          title: `${departure.expertName} Resigned!`,
          location,
          domainLines,
          roll: departure.roll,
          warning: departure.wasSPOF
            ? 'Single Point of Failure: high workload and market poaching triggered departure.'
            : 'Standard career transition / relocation.',
          detail: 'A Deep Expert has left the organisation.',
          impact: 'Uncodified expertise is lost. The role remains VACANT until its replacement arrives next round at baseline score 4.',
        };
      }

      return {
        id: `expert-${expert.id}`,
        kind: 'expert-retained' as const,
        title: `${expert.name} Retained`,
        location,
        domainLines,
        detail: 'The expert attrition check did not trigger a departure.',
        impact: 'No expert capability is lost this round.',
      };
    });

    const loss = summary.workforceAttrition[0];
    const workforceCard: RiskCard = loss
      ? {
          id: 'workforce-loss',
          kind: 'workforce-loss',
          title: `${loss.siteName} Workforce Knowledge Loss`,
          location: loss.siteName,
          domainLines: [DOMAIN_INFO[loss.domain as KnowledgeDomain]?.label || String(loss.domain)],
          detail: `Routine staff turnover reduced local ${DOMAIN_INFO[loss.domain as KnowledgeDomain]?.label || loss.domain} capability.`,
          impact: `Team Capability ${loss.previousScore} → ${loss.newScore}. Codified and corporate knowledge are unaffected.`,
        }
      : {
          id: 'workforce-stable',
          kind: 'workforce-stable',
          title: 'Workforce Knowledge Stable',
          detail: 'No eligible local team capability was lost in the general workforce check.',
          impact: 'Site Team Capability remains unchanged.',
        };

    return [...expertCards, workforceCard];
  }, [company.experts, company.sites, summary.departedExperts, summary.workforceAttrition]);

  useEffect(() => setCurrentIndex(0), [session.round, company.id]);

  const card = cards[Math.min(currentIndex, cards.length - 1)];
  const isFinal = currentIndex >= cards.length - 1;
  const negative = card.kind === 'expert-departed' || card.kind === 'workforce-loss';
  const Icon = card.kind === 'expert-departed'
    ? UserX
    : card.kind === 'expert-retained'
      ? UserCheck
      : card.kind === 'workforce-loss'
        ? Users
        : CheckCircle2;

  const next = () => {
    if (isFinal) onAdvanceToNextRound();
    else setCurrentIndex((value) => Math.min(value + 1, cards.length - 1));
  };

  return (
    <div className="w-full min-h-[560px] flex items-start justify-center pt-5 px-4">
      <div className={`w-full max-w-3xl rounded-2xl border-2 shadow-2xl overflow-hidden ${negative ? 'border-rose-700 bg-slate-950' : 'border-emerald-800 bg-slate-950'}`}>
        <div className="px-5 py-3 border-b border-slate-800 bg-slate-900/95 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-indigo-300" />
            <div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-black">Knowledge Risk</div>
              <div className="text-sm font-black text-white">Risk event {currentIndex + 1} of {cards.length}</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {cards.map((item, index) => (
              <span key={item.id} className={`w-2.5 h-2.5 rounded-full ${index < currentIndex ? 'bg-emerald-500' : index === currentIndex ? 'bg-indigo-400 ring-2 ring-indigo-300/30' : 'bg-slate-700'}`} />
            ))}
          </div>
        </div>

        <div className="p-6 space-y-5">
          <div className="flex items-start justify-between gap-5">
            <div className="flex gap-4 min-w-0">
              <div className={`shrink-0 w-14 h-14 rounded-2xl grid place-items-center border ${negative ? 'bg-rose-950/70 border-rose-700 text-rose-300' : 'bg-emerald-950/60 border-emerald-700 text-emerald-300'}`}>
                <Icon className="w-7 h-7" />
              </div>
              <div className="min-w-0">
                <h2 className={`text-2xl font-black leading-tight ${negative ? 'text-rose-300' : 'text-emerald-300'}`}>{card.title}</h2>
                {card.location && <div className="text-sm text-slate-400 mt-1">{card.location}</div>}
                {card.domainLines?.length ? <div className="flex flex-wrap gap-2 mt-2">{card.domainLines.map((line) => <span key={line} className="rounded-full bg-slate-900 border border-slate-700 px-2.5 py-1 text-xs font-bold text-slate-300">{line}</span>)}</div> : null}
              </div>
            </div>
            {card.roll != null && <div className="rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-right shrink-0"><div className="text-[9px] uppercase tracking-widest text-slate-500 font-black">Roll</div><div className="text-2xl font-black text-white">{card.roll}</div></div>}
          </div>

          {card.warning && (
            <div className="rounded-xl border border-amber-800 bg-amber-950/35 px-4 py-3 flex items-start gap-2 text-sm text-amber-100">
              <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
              <span>{card.warning}</span>
            </div>
          )}

          <div className="rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3">
            <div className="text-sm text-slate-300">{card.detail}</div>
            <div className="mt-3 pt-3 border-t border-slate-800 text-sm">
              <span className="font-black text-white">Impact: </span>
              <span className="text-slate-400">{card.impact}</span>
            </div>
          </div>

          {isFinal && summary.closedSites.length > 0 && (
            <div className="rounded-xl border border-rose-700 bg-rose-950/40 p-4 text-sm text-rose-200">
              <div className="font-black text-rose-300">Site insolvency</div>
              <div className="mt-1">Closed this round: {summary.closedSites.join(', ')}. Corporate Intranet knowledge survives the closure.</div>
            </div>
          )}

          <div className="flex items-center justify-between gap-4 pt-1">
            <div className="text-xs text-slate-500">Outcomes were calculated once when Knowledge Risk began. Next only reveals the committed result.</div>
            <button onClick={next} className={`shrink-0 rounded-xl px-5 py-3 font-black flex items-center gap-2 transition active:scale-95 ${isFinal ? 'bg-indigo-500 hover:bg-indigo-400 text-white' : 'bg-white hover:bg-slate-100 text-slate-950'}`}>
              {isFinal ? (session.round >= session.config.rounds ? 'FINAL DISRUPTION' : 'NEXT ROUND') : 'NEXT'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
