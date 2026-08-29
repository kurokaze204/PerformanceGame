import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2, Lightbulb, ShieldAlert, UserCheck, UserX, Users } from 'lucide-react';
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
  detailDomain?: string;
  impact: string;
  roll?: number;
  warning?: string;
  hint?: string;
};

export const AttritionModal: React.FC<AttritionModalProps> = ({
  session,
  company,
  phaseResult,
  onAdvanceToNextRound,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const summary = phaseResult?.attritionSummaries?.[company.id] || {
    expertChecks: [],
    siteChecks: [],
    departedExperts: [],
    workforceAttrition: [],
    closedSites: [],
  };

  const cards = useMemo<RiskCard[]>(() => {
    const departedById = new Map(summary.departedExperts.map((entry: any) => [entry.expertId, entry]));

    const recordedExpertChecks = Array.isArray(summary.expertChecks) && summary.expertChecks.length
      ? summary.expertChecks.slice(0, 2)
      : company.experts.filter((expert) => !expert.isVacant || departedById.has(expert.id)).slice(0, 2).map((expert) => {
          const departure: any = departedById.get(expert.id);
          return {
            expertId: expert.id,
            expertName: departure?.expertName || expert.name,
            domains: expert.domains.map((skill) => skill.domain),
            wasSPOF: departure?.wasSPOF ?? expert.isSPOF,
            roll: departure?.roll,
            departed: Boolean(departure),
            location: expert.location === 'HQ' ? 'Corporate HQ' : company.sites.find((site) => site.id === expert.location)?.name || expert.location,
          };
        });

    const expertCards: RiskCard[] = recordedExpertChecks.map((check: any, index: number) => {
      const expert = company.experts.find((candidate) => candidate.id === check.expertId);
      const domainLines = expert?.domains.map((skill) => `${DOMAIN_INFO[skill.domain].label} ${skill.score}`)
        || (check.domains || []).map((domain: KnowledgeDomain) => DOMAIN_INFO[domain]?.label || domain);

      if (check.departed) {
        return {
          id: `expert-${check.expertId}-${index}`,
          kind: 'expert-departed',
          title: `${check.expertName} Resigned!`,
          location: check.location,
          domainLines,
          roll: check.roll,
          warning: check.wasSPOF
            ? 'Single Point of Failure: high workload and market poaching triggered departure.'
            : 'Standard career transition / relocation.',
          detail: 'A Deep Expert has left the organisation.',
          impact: 'Uncodified expertise is lost. The role remains VACANT until its replacement arrives next round at baseline score 4.',
          hint: 'Reduce the probability next time by dealing with Single Point of Failure pressure: share the workload, build backup expertise and capture critical expert knowledge before it walks out the door.',
        };
      }

      return {
        id: `expert-${check.expertId}-${index}`,
        kind: 'expert-retained',
        title: `${check.expertName} Retained`,
        location: check.location,
        domainLines,
        roll: check.roll,
        detail: 'The expert attrition check did not trigger a departure.',
        impact: 'No expert capability is lost this round.',
      };
    });

    const activeSites = company.sites.filter((site) => !site.isClosed);
    const recordedSiteChecks = Array.isArray(summary.siteChecks) && summary.siteChecks.length
      ? summary.siteChecks.slice(0, 2)
      : activeSites.slice(0, 2).map((site, index) => {
          const loss = summary.workforceAttrition[index];
          const matchingLoss = loss?.siteName === site.name ? loss : summary.workforceAttrition.find((entry: any) => entry.siteName === site.name);
          return matchingLoss
            ? { siteId: site.id, siteName: site.name, domain: matchingLoss.domain, previousScore: matchingLoss.previousScore, newScore: matchingLoss.newScore, knowledgeLost: true }
            : { siteId: site.id, siteName: site.name, domain: null, previousScore: null, newScore: null, knowledgeLost: false };
        });

    const officeCards: RiskCard[] = recordedSiteChecks.map((check: any, index: number) => {
      const domainLabel = check.domain ? DOMAIN_INFO[check.domain as KnowledgeDomain]?.label || String(check.domain) : null;
      if (check.knowledgeLost) {
        return {
          id: `office-${check.siteId}-${index}`,
          kind: 'workforce-loss',
          title: `${check.siteName} Workforce Knowledge Loss`,
          location: check.siteName,
          domainLines: domainLabel ? [domainLabel] : undefined,
          detail: `Routine staff turnover reduced local ${domainLabel || 'team'} capability.`,
          detailDomain: domainLabel || undefined,
          impact: `Team Capability ${check.previousScore} → ${check.newScore}. Codified and corporate knowledge are unaffected.`,
          hint: 'Reduce the impact next time by codifying important local knowledge so routine staff turnover does not take capability with it.',
        };
      }

      return {
        id: `office-${check.siteId}-${index}`,
        kind: 'workforce-stable',
        title: `${check.siteName} Workforce Knowledge Stable`,
        location: check.siteName,
        detail: 'This city office had no vulnerable uncodified team knowledge to lose in the workforce check.',
        impact: 'Site Team Capability remains unchanged.',
      };
    });

    return [...expertCards, ...officeCards].slice(0, 4);
  }, [company.experts, company.sites, summary.departedExperts, summary.expertChecks, summary.siteChecks, summary.workforceAttrition]);

  useEffect(() => setCurrentIndex(0), [session.round, company.id]);

  const card = cards[Math.min(currentIndex, Math.max(0, cards.length - 1))];
  if (!card) return null;
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

  const renderDetail = () => {
    if (!card.detailDomain || !card.detail.includes(card.detailDomain)) return card.detail;
    const [before, after] = card.detail.split(card.detailDomain);
    return <>{before}<strong className="font-black text-white">{card.detailDomain}</strong>{after}</>;
  };

  return (
    <div className="w-full min-h-[560px] flex items-start justify-center pt-5 px-4">
      <div className={`w-full max-w-3xl rounded-2xl border-2 shadow-2xl overflow-hidden ${negative ? 'border-rose-700 bg-slate-950' : 'border-emerald-800 bg-slate-950'}`}>
        <div className="px-5 py-3 border-b border-slate-800 bg-slate-900/95 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-indigo-300" />
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500 font-black">Knowledge Risk</div>
              <div className="text-base font-black text-white">{currentIndex < 2 ? 'Expert risk' : 'City office risk'} · test {currentIndex + 1} of {cards.length}</div>
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
                {card.location && <div className="text-base text-slate-400 mt-1">{card.location}</div>}
                {card.domainLines?.length ? <div className="flex flex-wrap gap-2 mt-2">{card.domainLines.map((line) => <span key={line} className="rounded-full bg-slate-900 border border-slate-700 px-2.5 py-1 text-sm font-bold text-slate-300">{line}</span>)}</div> : null}
              </div>
            </div>
            {card.roll != null && <div className="rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-right shrink-0"><div className="text-[11px] uppercase tracking-widest text-slate-500 font-black">Roll</div><div className="text-2xl font-black text-white">{card.roll}</div></div>}
          </div>

          {card.warning && (
            <div className="rounded-xl border border-amber-800 bg-amber-950/35 px-4 py-3 flex items-start gap-2 text-base text-amber-100">
              <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
              <span>{card.warning}</span>
            </div>
          )}

          <div className="rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3">
            <div className="text-base text-slate-300">{renderDetail()}</div>
            <div className="mt-3 pt-3 border-t border-slate-800 text-base">
              <span className="font-black text-white">Impact: </span>
              <span className="text-slate-400">{card.impact}</span>
            </div>
          </div>

          {card.hint && (
            <div className="rounded-xl border border-indigo-700 bg-indigo-950/35 px-4 py-3 flex items-start gap-3 text-base text-indigo-100">
              <Lightbulb className="w-5 h-5 text-amber-300 mt-0.5 shrink-0" />
              <div><span className="font-black text-white">How to reduce this risk: </span>{card.hint}</div>
            </div>
          )}

          {isFinal && summary.closedSites.length > 0 && (
            <div className="rounded-xl border border-rose-700 bg-rose-950/40 p-4 text-base text-rose-200">
              <div className="font-black text-rose-300">Site insolvency</div>
              <div className="mt-1">Closed this round: {summary.closedSites.join(', ')}. Corporate Intranet knowledge survives the closure.</div>
            </div>
          )}

          <div className="flex items-center justify-between gap-4 pt-1">
            <div className="text-sm text-slate-400 max-w-xl">Staff retire and resign from time to time, taking valuable knowledge with them. Experts take the most and a more likely to leave if they are under pressure as a Single Point of Failure.</div>
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
