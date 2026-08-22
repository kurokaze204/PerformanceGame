import React, { useState } from 'react';
import {
  ActiveEvent,
  Company,
  GameSession,
  KnowledgeDomain,
  DOMAIN_INFO,
  SimulationConfig
} from '../types/game.ts';
import { evaluateEventDomainKnowledge } from '../engine/rules.ts';
import { DEFAULT_CONFIG } from '../engine/config.ts';
import { formatCurrency } from '../utils/format.ts';
import {
  AlertOctagon,
  Sparkles,
  Radio,
  RefreshCw,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Dices,
  Shield,
  Users,
  Cpu,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  MapPin,
  Building2
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface EventResolutionModalProps {
  session: GameSession;
  company: Company;
  config?: SimulationConfig;
  onRedrawEvent: (eventInstanceId: string) => void;
  onSetAllocation: (eventInstanceId: string, domain: KnowledgeDomain, allocation: any) => void;
  onResolveEvents: () => void;
  onNextPhase: () => void;
}

export const EventResolutionModal: React.FC<EventResolutionModalProps> = ({
  session,
  company,
  config = DEFAULT_CONFIG,
  onRedrawEvent,
  onSetAllocation,
  onResolveEvents,
  onNextPhase,
}) => {
  const [selectedEventIndex, setSelectedEventIndex] = useState(0);
  const [expandedDomainWhy, setExpandedDomainWhy] = useState<string | null>(null);

  const companyEvents = session.activeEvents[company.id] || [];
  const activeEvent = companyEvents[selectedEventIndex];

  const allResolved = companyEvents.length > 0 && companyEvents.every((e) => e.isResolved);

  if (!activeEvent) {
    return (
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-8 text-center text-[#c9d1d9]">
        <h3 className="text-sm font-bold text-white mb-1 font-mono">NO ACTIVE EVENTS DRAWN</h3>
        <p className="text-xs text-[#8b949e]">Events will appear when Phase 1 begins.</p>
      </div>
    );
  }

  const card = activeEvent.card;
  const isProblem = card.type === 'problem';
  const targetSite = activeEvent.targetSiteId ? company.sites.find((s) => s.id === activeEvent.targetSiteId) : null;

  // Horizon scan match check
  const matchesHorizonScan =
    company.horizonScanDomain &&
    !company.horizonScanUsedThisRound &&
    card.domains.some((d) => d.domain === company.horizonScanDomain);

  // Available experts for assignment
  const availableExperts = company.experts.filter((e) => !e.isVacant && (e.state === 'Available' || e.state === 'HQ Assignment'));

  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4 shadow-sm space-y-4 text-[#c9d1d9]">
      {/* Top Event Selector Tabs */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-[#30363d] pb-3">
        <div className="flex items-center gap-1 bg-[#0d1117] p-1 rounded-lg border border-[#30363d]">
          {companyEvents.map((evt, idx) => (
            <button
              key={evt.instanceId}
              onClick={() => setSelectedEventIndex(idx)}
              className={`px-3 py-1 rounded text-xs font-mono font-semibold transition flex items-center gap-1.5 ${
                selectedEventIndex === idx
                  ? 'bg-[#21262d] text-white border border-[#484f58] shadow-xs'
                  : 'text-[#8b949e] hover:text-white hover:bg-[#161b22]'
              }`}
            >
              <span>EVENT_{idx + 1}</span>
              {evt.isResolved && (
                evt.success ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <XCircle className="w-3 h-3 text-rose-400" />
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {allResolved ? (
            <button
              onClick={onNextPhase}
              className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono font-semibold shadow-xs flex items-center gap-1.5 transition active:scale-95"
            >
              <span>PROCEED TO CONSEQUENCES</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={() => {
                onResolveEvents();
                confetti({ particleCount: 35, spread: 60, origin: { y: 0.7 } });
              }}
              className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-mono font-semibold shadow-xs flex items-center gap-1.5 transition active:scale-95"
            >
              <Dices className="w-3.5 h-3.5" />
              <span>RESOLVE EVENTS (ROLL DICE)</span>
            </button>
          )}
        </div>
      </div>

      {/* Horizon Scanning Redraw Option */}
      {matchesHorizonScan && !activeEvent.isResolved && (
        <div className="p-3 bg-amber-950/40 border border-amber-500/50 rounded-lg flex items-center justify-between gap-3 text-xs text-amber-200">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-amber-400 animate-pulse" />
            <div className="text-[11px]">
              <strong className="font-mono">HORIZON_SCAN_ALERT ({DOMAIN_INFO[company.horizonScanDomain!].label}):</strong> Early intelligence anticipated this challenge. You may redraw!
            </div>
          </div>
          <button
            onClick={() => onRedrawEvent(activeEvent.instanceId)}
            className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white font-mono text-xs font-bold flex items-center gap-1 transition shadow-xs whitespace-nowrap"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Redraw Event</span>
          </button>
        </div>
      )}

      {/* Main Event Card Presentation */}
      <div
        className={`p-4 rounded-lg border ${
          isProblem
            ? 'bg-[#0d1117] border-rose-900/60'
            : 'bg-[#0d1117] border-emerald-900/60'
        } space-y-3`}
      >
        {/* Scope, Type & Impact Header */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              className={`text-[10px] font-bold font-mono uppercase tracking-wider px-2 py-0.5 rounded ${
                isProblem
                  ? 'bg-rose-950/80 border border-rose-700/60 text-rose-300'
                  : 'bg-emerald-950/80 border border-emerald-700/60 text-emerald-300'
              }`}
            >
              {card.type}
            </span>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#161b22] border border-[#30363d] text-[#c9d1d9] flex items-center gap-1">
              {card.scope === 'local' ? (
                <>
                  <MapPin className="w-3 h-3 text-indigo-400" />
                  <span>LOCAL: {targetSite?.name} SITE</span>
                </>
              ) : (
                <>
                  <Building2 className="w-3 h-3 text-purple-400" />
                  <span>ENTERPRISE-WIDE</span>
                </>
              )}
            </span>
          </div>

          {/* Financial Impact */}
          <div className="flex items-center gap-1.5 font-bold font-mono text-xs">
            <span className="text-[#8b949e]">IMPACT:</span>
            <span className={isProblem ? 'text-rose-400' : 'text-emerald-400'}>
              {isProblem ? `-${formatCurrency(card.impact)} Turnover on Failure` : `+${formatCurrency(card.impact)} Turnover on Success`}
            </span>
          </div>
        </div>

        {/* Narrative Title and Story */}
        <div>
          <h3 className="text-sm font-bold text-white tracking-tight font-mono">{card.title}</h3>
          <p className="text-xs text-[#8b949e] leading-relaxed mt-0.5">{card.description}</p>
        </div>

        {/* Required Knowledge Domains & Resource Allocation */}
        <div className="space-y-2.5 pt-1">
          <h4 className="text-[10px] font-bold text-[#8b949e] uppercase tracking-wider font-mono">
            Required Knowledge Domains ({card.domains.length})
          </h4>

          <div className="space-y-2">
            {card.domains.map((dReq) => {
              const domain = dReq.domain;
              const dInfo = DOMAIN_INFO[domain];
              const allocation = activeEvent.allocations[domain] || {};
              const evaluation = evaluateEventDomainKnowledge(session, company, activeEvent, domain, config);

              const domainResult = activeEvent.domainResults?.find((r) => r.domain === domain);

              return (
                <div
                  key={domain}
                  className="p-3 bg-[#161b22] rounded-lg border border-[#30363d] space-y-2.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: dInfo.color }} />
                      <span className="text-xs font-semibold text-white">{dInfo.label}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#0d1117] text-indigo-300 border border-[#30363d]">
                        DIFFICULTY: {dReq.difficulty}
                      </span>
                    </div>

                    {/* Likelihood & Win Probability */}
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                          evaluation.likelihood === 'Very High' || evaluation.likelihood === 'High'
                            ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/60'
                            : evaluation.likelihood === 'Moderate'
                            ? 'bg-amber-950/60 text-amber-300 border border-amber-800/60'
                            : 'bg-rose-950/60 text-rose-300 border border-rose-800/60'
                        }`}
                      >
                        {evaluation.likelihood.toUpperCase()} ({evaluation.winChancePercent}%)
                      </span>

                      <button
                        onClick={() =>
                          setExpandedDomainWhy(
                            expandedDomainWhy === domain ? null : domain
                          )
                        }
                        className="text-[#8b949e] hover:text-white p-0.5 rounded hover:bg-[#0d1117] transition"
                        title="Calculation breakdown"
                      >
                        <HelpCircle className="w-3.5 h-3.5 text-indigo-400" />
                      </button>
                    </div>
                  </div>

                  {/* Resource Allocation Controls (if not resolved) */}
                  {!activeEvent.isResolved ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-[#30363d] text-xs">
                      {/* Expert Assignment */}
                      <div className="flex items-center gap-2">
                        <label className="text-[10px] text-[#8b949e] font-mono">Expert (+2):</label>
                        <select
                          value={allocation.expertId || ''}
                          onChange={(e) =>
                            onSetAllocation(activeEvent.instanceId, domain, {
                              expertId: e.target.value || undefined,
                            })
                          }
                          className="bg-[#0d1117] text-xs text-[#c9d1d9] font-mono border border-[#30363d] rounded px-2 py-0.5 flex-1 focus:border-indigo-500 focus:outline-hidden"
                        >
                          <option value="">None</option>
                          {availableExperts
                            .filter((exp) => exp.domains.some((d) => d.domain === domain))
                            .map((exp) => (
                              <option key={exp.id} value={exp.id}>
                                {exp.name} ({exp.location === 'HQ' ? 'HQ' : 'Site'})
                              </option>
                            ))}
                        </select>
                      </div>

                      {/* CoP External Support */}
                      <div className="flex items-center justify-between sm:justify-end gap-2">
                        <label className="text-[10px] text-[#8b949e] font-mono flex items-center gap-1">
                          <Users className="w-3 h-3 text-amber-400" />
                          <span>CoP Peer Assistance (+2):</span>
                        </label>
                        <input
                          type="checkbox"
                          checked={!!allocation.useCoPSupport}
                          onChange={(e) =>
                            onSetAllocation(activeEvent.instanceId, domain, {
                              useCoPSupport: e.target.checked,
                            })
                          }
                          className="w-3.5 h-3.5 rounded bg-[#0d1117] border-[#30363d] text-indigo-600 focus:ring-0 cursor-pointer"
                        />
                      </div>
                    </div>
                  ) : (
                    /* Resolution Result Display */
                    domainResult && (
                      <div className="p-2 rounded bg-[#0d1117] border border-[#30363d] flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5">
                          {domainResult.domainSuccess ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5 text-rose-400" />
                          )}
                          <span className="font-semibold font-mono text-xs text-white">
                            {domainResult.domainSuccess ? 'DOMAIN_PASSED' : 'DOMAIN_FAILED'}
                          </span>
                        </div>
                        <span className="font-mono text-[#8b949e] text-[10px]">
                          Roll {domainResult.dieRoll} + Knowledge {domainResult.totalKnowledge} = {domainResult.achievedTotal} (Need {domainResult.requiredTotal})
                        </span>
                      </div>
                    )
                  )}

                  {/* Expandable "Why?" Causal Breakdown */}
                  {expandedDomainWhy === domain && (
                    <div className="p-2.5 bg-[#0d1117] border border-indigo-500/30 rounded text-[10px] text-[#8b949e] space-y-1">
                      <div className="font-bold text-indigo-300 font-mono">// CALCULATION & CAUSAL BREAKDOWN</div>
                      <p className="leading-relaxed font-mono">{evaluation.explanation}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
