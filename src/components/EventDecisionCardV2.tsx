import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  BookOpen,
  BriefcaseBusiness,
  Building2,
  Check,
  Handshake,
  MapPin,
  ShieldQuestion,
  Sparkles,
  UserRound,
  Users,
} from 'lucide-react';
import type { KnowledgeDomain } from '../types/game.ts';
import { DOMAIN_INFO } from '../types/game.ts';
import type { ActiveEventAllocationV2, ActiveEventV2, CompanyV2, GameSessionV2 } from '../types/gameV2.ts';
import { currentConsultantRate } from '../engine/coreV2.ts';
import { evaluateEventDomainKnowledgeExplicitV2 } from '../engine/challengeResponseV2.ts';
import { formatCurrency } from '../utils/format.ts';

type DecisionMode = 'existing' | 'consultant' | 'expert' | 'reputation' | 'network' | 'risk';

interface EventDecisionCardV2Props {
  session: GameSessionV2;
  company: CompanyV2;
  event: ActiveEventV2;
  cardNumber: number;
  onSetAllocation: (eventId: string, domain: KnowledgeDomain, allocation: any) => Promise<void> | void;
  onResolveEvent: (eventId: string) => Promise<void> | void;
  onRedrawEvent?: (eventId: string) => Promise<void> | void;
  canHorizonRedraw?: boolean;
}

const RESPONSE_MODES: { id: DecisionMode; label: string; sub: string; icon: React.ElementType }[] = [
  { id: 'existing', label: 'Use what we already know', sub: 'Choose the internal knowledge you intend to use', icon: Building2 },
  { id: 'consultant', label: 'Engage external expertise', sub: 'Buy temporary capability for this challenge', icon: BriefcaseBusiness },
  { id: 'expert', label: 'Ask one of our experts to help', sub: 'Deploy scarce deep expertise', icon: Users },
  { id: 'reputation', label: 'Call in a favour', sub: 'Spend reputation to guarantee the entire card', icon: Sparkles },
  { id: 'network', label: 'Ask our network for help', sub: 'Draw on an active Community of Practice', icon: Handshake },
  { id: 'risk', label: 'Accept the risk', sub: 'Proceed without deliberately adding knowledge', icon: ShieldQuestion },
];

export const EventDecisionCardV2: React.FC<EventDecisionCardV2Props> = ({
  session,
  company,
  event,
  cardNumber,
  onSetAllocation,
  onResolveEvent,
  onRedrawEvent,
  canHorizonRedraw = false,
}) => {
  const [domain, setDomain] = useState<KnowledgeDomain>(event.card.domains[0].domain);
  const [mode, setMode] = useState<DecisionMode>('existing');
  const [isResolving, setIsResolving] = useState(false);
  const card = event.card;
  const targetSite = event.targetSiteId ? company.sites.find((site) => site.id === event.targetSiteId) : undefined;

  useEffect(() => {
    setDomain(event.card.domains[0].domain);
    setMode('existing');
  }, [event.instanceId]);

  const allocation: ActiveEventAllocationV2 = event.allocations[domain] || {};
  const evaluations = useMemo(() => card.domains.map((requirement) => ({
    domain: requirement.domain,
    value: evaluateEventDomainKnowledgeExplicitV2(session, company, event, requirement.domain, session.config),
  })), [card.domains, company, event, session]);
  const evaluation = evaluations.find((entry) => entry.domain === domain)?.value || evaluateEventDomainKnowledgeExplicitV2(session, company, event, domain, session.config);
  const cardChance = Math.round(evaluations.reduce((probability, entry) => probability * (entry.value.winChancePercent / 100), 1) * 100);
  const consultantRate = currentConsultantRate(company);

  const riskPercent = useMemo(() => {
    const base = card.scope === 'local' && targetSite ? targetSite.turnover : company.turnover;
    return base > 0 ? Math.round((card.impact / base) * 100) : 100;
  }, [card.impact, card.scope, company.turnover, targetSite?.turnover]);

  const activeAllocations = Object.values(event.allocations) as ActiveEventAllocationV2[];
  const hasExisting = activeAllocations.some((item) => item.useTeamCapability || item.useLocalCodified || item.useCorporateIntranet);
  const hasConsultant = activeAllocations.some((item) => (item.consultantPoints || 0) > 0);
  const hasExpert = activeAllocations.some((item) => Boolean(item.expertId));
  const hasNetwork = activeAllocations.some((item) => Boolean(item.useCoPSupport));
  const acceptRisk = activeAllocations.some((item) => Boolean(item.acceptRisk));

  const selectedByMode: Record<DecisionMode, boolean> = {
    existing: hasExisting,
    consultant: hasConsultant,
    expert: hasExpert,
    reputation: false,
    network: hasNetwork,
    risk: acceptRisk,
  };

  const knownConsultantCost = useMemo(() => {
    let engagementOffset = 0;
    let total = 0;
    for (const requirement of card.domains) {
      const points = event.allocations[requirement.domain]?.consultantPoints || 0;
      if (points <= 0) continue;
      const rate = Math.round(consultantRate * Math.pow(1.35, engagementOffset));
      total += rate * points;
      engagementOffset += 1;
    }
    return total;
  }, [card.domains, consultantRate, event.allocations]);

  const travellingExperts = useMemo(() => {
    if (card.scope !== 'local' || !event.targetSiteId) return [] as string[];
    const ids = new Set<string>();
    for (const item of activeAllocations) {
      if (!item.expertId) continue;
      const expert = company.experts.find((candidate) => candidate.id === item.expertId);
      if (expert && expert.location !== event.targetSiteId) ids.add(expert.id);
    }
    return [...ids];
  }, [activeAllocations, card.scope, company.experts, event.targetSiteId]);

  const eligibleExperts = company.experts.filter((expert) =>
    !expert.isVacant &&
    (expert.state === 'Available' || expert.state === 'HQ Assignment' || expert.state === 'Supporting Event') &&
    expert.domains.some((entry) => entry.domain === domain),
  );
  const currentCoPCompanies = new Set(
    session.copMemberships.filter((membership) => membership.domain === domain && membership.activeRound === session.round).map((membership) => membership.companyId),
  );
  const networkAvailable = currentCoPCompanies.size >= 2;

  const clearRisk = async () => {
    if (!acceptRisk) return;
    await Promise.all(card.domains.map((requirement) => onSetAllocation(event.instanceId, requirement.domain, { acceptRisk: false })));
  };

  const chooseMode = async (next: DecisionMode) => {
    setMode(next);
    if (next !== 'risk') await clearRisk();
    if (next === 'risk') {
      await Promise.all(card.domains.map((requirement, index) => onSetAllocation(event.instanceId, requirement.domain, {
        useTeamCapability: false,
        useLocalCodified: false,
        useCorporateIntranet: false,
        expertId: '',
        useCoPSupport: false,
        consultantPoints: 0,
        acceptRisk: index === 0,
      })));
    }
  };

  const setCurrent = async (change: Partial<ActiveEventAllocationV2>) => {
    await clearRisk();
    await onSetAllocation(event.instanceId, domain, { ...change, acceptRisk: false });
  };

  const useReputation = async () => {
    if (company.reputationPoints <= 0 || isResolving) return;
    setIsResolving(true);
    try {
      await Promise.all(card.domains.map((requirement) => onSetAllocation(event.instanceId, requirement.domain, {
        useTeamCapability: false,
        useLocalCodified: false,
        useCorporateIntranet: false,
        expertId: '',
        useCoPSupport: false,
        consultantPoints: 0,
        acceptRisk: false,
      })));
      const response = await fetch(`/api/sessions/${session.id}/events/reputation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: company.id, eventInstanceId: event.instanceId }),
      });
      const data = await response.json();
      if (!response.ok || data.success === false) throw new Error(data.message || data.error || 'Could not use Reputation.');
    } catch (error: any) {
      window.alert(error.message || 'Could not use Reputation.');
    } finally {
      setIsResolving(false);
    }
  };

  const resolve = async () => {
    if (isResolving) return;
    setIsResolving(true);
    try { await onResolveEvent(event.instanceId); }
    finally { setIsResolving(false); }
  };

  const solutionItems = [
    hasExisting && { label: 'Internal knowledge', icon: Building2 },
    hasConsultant && { label: 'External expertise', icon: BriefcaseBusiness },
    hasExpert && { label: 'Deep Expert', icon: UserRound },
    hasNetwork && { label: 'Community of Practice', icon: Handshake },
    acceptRisk && { label: 'Risk accepted', icon: ShieldQuestion },
  ].filter(Boolean) as { label: string; icon: React.ElementType }[];

  return (
    <motion.div initial={{ opacity: 0, y: 24, rotate: -0.4 }} animate={{ opacity: 1, y: 0, rotate: 0 }} className="w-full grid lg:grid-cols-[minmax(0,1.35fr)_330px] gap-3 items-start">
      <div className="space-y-3">
        <section className={`rounded-2xl overflow-hidden border-2 shadow-2xl ${card.type === 'problem' ? 'border-rose-700/80 bg-slate-950' : 'border-emerald-700/80 bg-slate-950'}`}>
          <div className={`px-5 py-4 ${card.type === 'problem' ? 'bg-gradient-to-r from-rose-950 to-slate-950' : 'bg-gradient-to-r from-emerald-950 to-slate-950'}`}>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-white/60">
                  <span>Card {cardNumber}</span><span>•</span><span>{card.type === 'problem' ? 'Problem' : 'Opportunity'}</span><span>•</span>
                  <span className="flex items-center gap-1">{card.scope === 'local' ? <MapPin className="w-3 h-3" /> : <Building2 className="w-3 h-3" />}{card.scope === 'local' ? targetSite?.name : 'Whole company'}</span>
                </div>
                <h2 className="text-xl lg:text-2xl font-black text-white mt-2 leading-tight">{card.title}</h2>
                <p className="text-xs lg:text-sm text-slate-300 mt-2 leading-relaxed">{card.description}</p>
              </div>
              <div className={`shrink-0 rounded-xl px-3 py-2.5 text-right border ${card.type === 'problem' ? 'bg-rose-950/70 border-rose-700 text-rose-100' : 'bg-emerald-950/70 border-emerald-700 text-emerald-100'}`}>
                <div className="text-[9px] uppercase tracking-widest font-black opacity-70">{card.type === 'problem' ? 'Loss if failed' : 'Gain if successful'}</div>
                <div className="text-xl font-black">{card.type === 'problem' ? '−' : '+'}{formatCurrency(card.impact)}</div>
                <div className="text-[10px] font-bold opacity-75">{riskPercent}% of {card.scope === 'local' ? `${targetSite?.name || 'site'} turnover` : 'company turnover'}</div>
              </div>
            </div>
          </div>

          <div className="p-4 space-y-4">
            {canHorizonRedraw && !event.isResolved && (
              <div className="rounded-xl bg-amber-950/45 border border-amber-600/60 px-3 py-2.5 flex items-center justify-between gap-3">
                <div><div className="font-black text-amber-200 text-sm">Your Horizon Scan saw this coming.</div><div className="text-[11px] text-amber-100/65">Reject this card and draw another of the same type.</div></div>
                <button onClick={() => onRedrawEvent?.(event.instanceId)} className="rounded-lg bg-amber-400 text-slate-950 px-3 py-2 text-xs font-black">DRAW ANOTHER</button>
              </div>
            )}

            <div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-black mb-2">Knowledge needed</div>
              <div className="grid sm:grid-cols-2 gap-2">
                {card.domains.map((requirement) => {
                  const info = DOMAIN_INFO[requirement.domain];
                  const entry = evaluations.find((item) => item.domain === requirement.domain)!.value;
                  const gap = Math.max(0, requirement.difficulty - entry.totalKnowledge);
                  const selected = domain === requirement.domain;
                  return (
                    <button key={requirement.domain} onClick={() => { setDomain(requirement.domain); setMode('existing'); }} className={`rounded-xl border-2 px-3 py-2.5 text-left transition ${selected ? 'border-white bg-white/10' : 'border-slate-700 bg-slate-900/80 hover:border-slate-500'}`}>
                      <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: info.color }} /><span className="font-black text-white text-sm">{info.label}</span></div>
                      <div className="mt-1 text-[11px] text-slate-400">Challenge {requirement.difficulty} · Knowledge {entry.totalKnowledge}</div>
                      <div className="text-[10px] text-slate-500">Knowledge gap {gap}</div>
                      <div className={`text-[11px] font-black mt-1 ${entry.winChancePercent >= 70 ? 'text-emerald-400' : entry.winChancePercent >= 40 ? 'text-amber-400' : 'text-rose-400'}`}>{entry.winChancePercent}% chance</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid sm:grid-cols-[1fr_auto] gap-3 items-end border-t border-slate-800 pt-3">
              <div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-black">Your solution</div>
                <div className="flex flex-wrap gap-2 mt-2 min-h-8 items-center">
                  {solutionItems.length ? solutionItems.map((item) => { const Icon = item.icon; return <span key={item.label} title={item.label} className="w-8 h-8 rounded-lg grid place-items-center border border-indigo-500/60 bg-indigo-950/70 text-indigo-200"><Icon className="w-4 h-4" /></span>; }) : <span className="text-xs text-slate-600">No knowledge sources selected yet.</span>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-x-5 gap-y-1 text-right">
                <div><div className="text-[9px] uppercase tracking-wider text-slate-500 font-black">Response cost</div><div className="text-lg font-black text-white">{knownConsultantCost ? `$${knownConsultantCost}k` : '$0k'}{travellingExperts.length ? <span className="block text-[9px] font-bold text-amber-400">+ expert travel roll</span> : null}</div></div>
                <div><div className="text-[9px] uppercase tracking-wider text-slate-500 font-black">Current chance</div><div className={`text-2xl font-black ${cardChance >= 70 ? 'text-emerald-400' : cardChance >= 40 ? 'text-amber-400' : 'text-rose-400'}`}>{cardChance}%</div></div>
              </div>
            </div>
          </div>
        </section>

        {!event.isResolved && (
          <motion.section layout className="rounded-2xl border border-slate-700 bg-[#11162a]/95 p-4 shadow-2xl min-h-28">
            {mode === 'existing' && (
              <div>
                <div className="font-black text-white">Use what we already know — {DOMAIN_INFO[domain].label}</div>
                <div className="text-xs text-slate-400 mt-1">Nothing is assumed. Select the organisational knowledge you deliberately want in this response.</div>
                <div className="grid sm:grid-cols-3 gap-2 mt-3">
                  <SourceButton icon={Users} label="Team Capability" value={evaluation.availableSources.team} selected={!!allocation.useTeamCapability} onClick={() => setCurrent({ useTeamCapability: !allocation.useTeamCapability })} />
                  <SourceButton icon={BookOpen} label="Local Codified" value={evaluation.availableSources.localCodified} selected={!!allocation.useLocalCodified} onClick={() => setCurrent({ useLocalCodified: !allocation.useLocalCodified })} />
                  <SourceButton icon={Building2} label="Corporate Intranet" value={evaluation.availableSources.usableIntranet} note={`Corporate score ${company.intranet[domain]}`} selected={!!allocation.useCorporateIntranet} onClick={() => setCurrent({ useCorporateIntranet: !allocation.useCorporateIntranet })} />
                </div>
              </div>
            )}

            {mode === 'consultant' && (
              <div>
                <div className="font-black text-white">External expertise — {DOMAIN_INFO[domain].label}</div>
                <div className="text-xs text-slate-400 mt-1">Temporary capability for this challenge only. Current rate starts at ${consultantRate}k per useful knowledge point and escalates after engagements.</div>
                <div className="flex gap-2 mt-3">
                  {[1, 2, 3].map((points) => {
                    const selected = allocation.consultantPoints === points;
                    const enabled = selected || points <= evaluation.usefulConsultantGap;
                    return <button key={points} disabled={!enabled} onClick={() => setCurrent({ consultantPoints: selected ? 0 : points })} className={`rounded-xl min-w-20 px-4 py-2.5 font-black border ${selected ? 'bg-amber-400 border-amber-200 text-slate-950' : enabled ? 'bg-slate-950 border-slate-600 text-white hover:border-amber-400' : 'bg-slate-900 border-slate-800 text-slate-700 cursor-not-allowed'}`}>+{points}<span className="block text-[10px] font-medium">from ${consultantRate * points}k</span></button>;
                  })}
                  {evaluation.usefulConsultantGap === 0 && !allocation.consultantPoints && <span className="text-xs text-emerald-400 self-center">No additional consultant knowledge is useful for this domain.</span>}
                </div>
              </div>
            )}

            {mode === 'expert' && (
              <div>
                <div className="font-black text-white">Ask one of our experts — {DOMAIN_INFO[domain].label}</div>
                <div className="grid sm:grid-cols-2 gap-2 mt-3">
                  {eligibleExperts.length ? eligibleExperts.map((expert) => {
                    const skill = expert.domains.find((entry) => entry.domain === domain)!;
                    const location = expert.location === 'HQ' ? 'Corporate HQ' : company.sites.find((site) => site.id === expert.location)?.name || expert.location;
                    const atTarget = card.scope === 'enterprise' || expert.location === event.targetSiteId;
                    const selected = allocation.expertId === expert.id;
                    return <button key={expert.id} onClick={() => setCurrent({ expertId: selected ? '' : expert.id })} className={`rounded-xl border p-3 text-left ${selected ? 'border-amber-300 bg-amber-400 text-slate-950' : 'border-slate-700 bg-slate-950 text-white'}`}><div className="flex justify-between gap-2"><span className="font-black">{expert.name}</span>{selected && <Check className="w-4 h-4" />}</div><div className={`text-xs mt-1 ${selected ? 'text-slate-800' : 'text-slate-400'}`}>{DOMAIN_INFO[domain].label} {skill.score} · {location}</div><div className={`text-[10px] mt-1 font-bold ${selected ? 'text-slate-800' : atTarget ? 'text-emerald-400' : 'text-amber-400'}`}>{atTarget ? 'Already in position' : 'Travel cost will be rolled on commitment'}</div></button>;
                  }) : <div className="text-xs text-rose-300">No eligible Deep Expert currently holds this domain.</div>}
                </div>
              </div>
            )}

            {mode === 'network' && (
              <div>
                <div className="font-black text-white">Ask our network — {DOMAIN_INFO[domain].label}</div>
                {networkAvailable ? <button onClick={() => setCurrent({ useCoPSupport: !allocation.useCoPSupport })} className={`mt-3 rounded-xl border px-4 py-3 font-black ${allocation.useCoPSupport ? 'bg-amber-400 border-amber-200 text-slate-950' : 'bg-slate-950 border-amber-700 text-amber-200'}`}>{allocation.useCoPSupport ? 'Network support selected (+2) · click to remove' : 'Use active Community of Practice (+2)'}</button> : <div className="text-xs text-slate-400 mt-2">No active multi-company {DOMAIN_INFO[domain].label} Community of Practice can support this challenge.</div>}
              </div>
            )}

            {mode === 'reputation' && (
              <div className="flex items-center justify-between gap-4">
                <div><div className="font-black text-white">Call in a favour</div><div className="text-xs text-slate-400 mt-1">Reputation remaining: {company.reputationPoints}. Guarantees the entire Challenge and clears other response resources. It creates no knowledge capability.</div></div>
                <button disabled={company.reputationPoints <= 0 || isResolving} onClick={useReputation} className="shrink-0 rounded-xl bg-amber-400 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 px-4 py-3 font-black">USE 1 REPUTATION</button>
              </div>
            )}

            {mode === 'risk' && (
              <div className="flex items-center justify-between gap-4">
                <div><div className="font-black text-white">Accept the risk</div><div className="text-xs text-slate-400 mt-1">All deliberate response resources have been cleared. Persistent automation, if any, still applies.</div><div className="mt-2 text-sm"><span className="text-slate-500">Current probability:</span> <b className="text-white">{cardChance}%</b> · <span className="text-slate-500">Financial exposure:</span> <b className={card.type === 'problem' ? 'text-rose-300' : 'text-emerald-300'}>{card.type === 'problem' ? '−' : '+'}{formatCurrency(card.impact)}</b> ({riskPercent}% of {card.scope === 'local' ? targetSite?.name : 'company'} turnover)</div></div>
                <ShieldQuestion className="w-10 h-10 text-amber-400 shrink-0" />
              </div>
            )}
          </motion.section>
        )}

        {!event.isResolved && (
          <button onClick={resolve} disabled={isResolving} className="w-full rounded-xl bg-indigo-500 hover:bg-indigo-400 disabled:opacity-60 text-white px-5 py-3.5 text-lg font-black shadow-xl shadow-indigo-950/40 transition active:scale-[0.995]">{isResolving ? 'COMMITTING…' : 'COMMIT RESPONSE'}</button>
        )}
      </div>

      <aside className="space-y-2">
        <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400 font-black px-1">Knowledge Suite</div>
        {RESPONSE_MODES.map((choice) => {
          const Icon = choice.icon;
          const active = mode === choice.id;
          const selected = selectedByMode[choice.id];
          return <button key={choice.id} onClick={() => chooseMode(choice.id)} className={`relative w-full min-h-[86px] rounded-xl border-2 p-3 text-left transition ${active ? 'border-indigo-300 bg-indigo-950/90 shadow-lg shadow-indigo-950/50' : 'border-slate-700 bg-slate-900/95 hover:border-slate-500'}`}><div className="flex items-start gap-3"><Icon className="w-5 h-5 text-indigo-300 mt-0.5 shrink-0" /><div><div className="font-black text-white text-sm leading-tight">{choice.label}</div><div className="text-[10px] text-slate-400 mt-1 leading-snug">{choice.id === 'consultant' ? `Bring in temporary capability from $${consultantRate}k per point` : choice.id === 'reputation' ? `${choice.sub} (${company.reputationPoints} left)` : choice.sub}</div></div></div>{selected && <span className="absolute -right-2 -top-2 w-8 h-8 rounded-full bg-emerald-400 border-4 border-slate-950 grid place-items-center text-emerald-950 shadow-lg"><Check className="w-4 h-4 stroke-[4]" /></span>}</button>;
        })}
      </aside>
    </motion.div>
  );
};

const SourceButton: React.FC<{
  icon: React.ElementType;
  label: string;
  value: number;
  note?: string;
  selected: boolean;
  onClick: () => void;
}> = ({ icon: Icon, label, value, note, selected, onClick }) => (
  <button onClick={onClick} className={`rounded-xl border-2 p-3 text-left transition ${selected ? 'border-emerald-300 bg-emerald-950/80' : 'border-slate-700 bg-slate-950 hover:border-slate-500'}`}>
    <div className="flex items-start justify-between gap-2"><Icon className={`w-5 h-5 ${selected ? 'text-emerald-300' : 'text-slate-400'}`} />{selected && <Check className="w-4 h-4 text-emerald-300 stroke-[3]" />}</div>
    <div className="font-black text-white text-sm mt-2">{label}</div>
    <div className="text-xl font-black text-white mt-0.5">{value}</div>
    {note && <div className="text-[9px] text-slate-500 mt-0.5">{note}</div>}
  </button>
);
