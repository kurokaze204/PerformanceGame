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

type ResolutionDisplay = {
  complete: boolean;
  overallSuccess?: boolean;
  domains: { domain: KnowledgeDomain; value: number; target: number; success?: boolean }[];
};

interface Props {
  session: GameSessionV2;
  company: CompanyV2;
  event: ActiveEventV2;
  cardNumber: number;
  onSetAllocation: (eventId: string, domain: KnowledgeDomain, allocation: any) => Promise<void> | void;
  onResolveEvent: (eventId: string) => Promise<any> | any;
  onAcknowledgeResolution: (eventId: string) => Promise<void> | void;
  onRedrawEvent?: (eventId: string) => Promise<void> | void;
  canHorizonRedraw?: boolean;
}

const RESPONSE_MODES: { id: DecisionMode; label: string; sub: string; icon: React.ElementType }[] = [
  { id: 'existing', label: 'Use what we already know', sub: 'Choose internal knowledge deliberately', icon: Building2 },
  { id: 'consultant', label: 'Engage external expertise', sub: 'Buy temporary capability', icon: BriefcaseBusiness },
  { id: 'expert', label: 'Ask one of our experts to help', sub: 'Deploy scarce deep expertise', icon: Users },
  { id: 'reputation', label: 'Call in a favour', sub: 'Spend reputation to guarantee the card', icon: Sparkles },
  { id: 'network', label: 'Ask our network for help', sub: 'Use an active Community of Practice', icon: Handshake },
  { id: 'risk', label: 'Accept the risk', sub: 'Proceed without deliberately adding knowledge', icon: ShieldQuestion },
];

function targetPercent(requiredDie: number, sides: number): number {
  if (requiredDie <= 1) return 0;
  if (requiredDie > sides) return 100;
  return Math.round(((requiredDie - 1) / Math.max(1, sides - 1)) * 99);
}

function rollPercent(dieRoll: number, sides: number): number {
  return Math.round(((Math.max(1, dieRoll) - 1) / Math.max(1, sides - 1)) * 99);
}

export const EventDecisionCardV3: React.FC<Props> = ({
  session,
  company,
  event,
  cardNumber,
  onSetAllocation,
  onResolveEvent,
  onAcknowledgeResolution,
  onRedrawEvent,
  canHorizonRedraw = false,
}) => {
  const [domain, setDomain] = useState<KnowledgeDomain>(event.card.domains[0].domain);
  const [mode, setMode] = useState<DecisionMode>('existing');
  const [isResolving, setIsResolving] = useState(false);
  const [resolutionDisplay, setResolutionDisplay] = useState<ResolutionDisplay | null>(null);
  const card = event.card;
  const targetSite = event.targetSiteId ? company.sites.find((site) => site.id === event.targetSiteId) : undefined;

  useEffect(() => {
    setDomain(event.card.domains[0].domain);
    setMode('existing');
    setResolutionDisplay(null);
    setIsResolving(false);
  }, [event.instanceId]);

  const allocation: ActiveEventAllocationV2 = event.allocations[domain] || {};
  const evaluations = useMemo(() => card.domains.map((requirement) => ({
    domain: requirement.domain,
    value: evaluateEventDomainKnowledgeExplicitV2(session, company, event, requirement.domain, session.config),
  })), [card.domains, company, event, session]);
  const evaluation = evaluations.find((entry) => entry.domain === domain)?.value || evaluateEventDomainKnowledgeExplicitV2(session, company, event, domain, session.config);
  const cardChance = Math.round(evaluations.reduce((probability, entry) => probability * (entry.value.winChancePercent / 100), 1) * 100);
  const consultantRate = currentConsultantRate(company);
  const riskBase = card.scope === 'local' && targetSite ? targetSite.turnover : company.turnover;
  const riskPercent = riskBase > 0 ? Math.round((card.impact / riskBase) * 100) : 100;

  const activeAllocations = Object.values(event.allocations) as ActiveEventAllocationV2[];
  const hasExisting = activeAllocations.some((item) => item.useTeamCapability || item.useLocalCodified || item.useCorporateIntranet);
  const hasConsultant = activeAllocations.some((item) => (item.consultantPoints || 0) > 0);
  const hasExpert = activeAllocations.some((item) => Boolean(item.expertId));
  const hasNetwork = activeAllocations.some((item) => Boolean(item.useCoPSupport));
  const acceptRisk = activeAllocations.some((item) => Boolean(item.acceptRisk));
  const selectedByMode: Record<DecisionMode, boolean> = { existing: hasExisting, consultant: hasConsultant, expert: hasExpert, reputation: false, network: hasNetwork, risk: acceptRisk };

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

  const eligibleExperts = company.experts.filter((expert) =>
    !expert.isVacant &&
    (expert.state === 'Available' || expert.state === 'HQ Assignment' || expert.state === 'Supporting Event') &&
    expert.domains.some((entry) => entry.domain === domain),
  );
  const currentCoPCompanies = new Set(session.copMemberships.filter((m) => m.domain === domain && m.activeRound === session.round).map((m) => m.companyId));
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
    const response = await fetch(`/api/sessions/${session.id}/events/reputation`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId: company.id, eventInstanceId: event.instanceId }),
    });
    const data = await response.json();
    if (!response.ok || data.success === false) window.alert(data.message || data.error || 'Could not use Reputation.');
    else window.location.reload();
  };

  const resolve = async () => {
    if (isResolving) return;
    setIsResolving(true);
    const sides = session.config.event_die || 12;
    setResolutionDisplay({ complete: false, domains: evaluations.map((entry) => ({ domain: entry.domain, value: Math.floor(Math.random() * 100), target: targetPercent(entry.value.requiredDie, sides) })) });
    const spinner = window.setInterval(() => setResolutionDisplay((current) => current ? { ...current, domains: current.domains.map((item) => ({ ...item, value: Math.floor(Math.random() * 100) })) } : current), 70);

    try {
      const [data] = await Promise.all([
        Promise.resolve(onResolveEvent(event.instanceId)),
        new Promise((done) => window.setTimeout(done, 1300)),
      ]);
      window.clearInterval(spinner);
      const results = data?.result?.domainResults || [];
      const domains = card.domains.map((requirement) => {
        const result = results.find((candidate: any) => candidate.domain === requirement.domain);
        const fallback = evaluations.find((entry) => entry.domain === requirement.domain)!.value;
        if (!result) return { domain: requirement.domain, value: Math.floor(Math.random() * 100), target: targetPercent(fallback.requiredDie, sides), success: undefined };
        const requiredDie = Number(result.requiredTotal) - Number(result.totalKnowledge);
        return { domain: requirement.domain, value: rollPercent(Number(result.dieRoll), sides), target: targetPercent(requiredDie, sides), success: Boolean(result.domainSuccess) };
      });
      setResolutionDisplay({ complete: true, overallSuccess: Boolean(data?.eventSuccess ?? data?.result?.success), domains });
    } catch (error: any) {
      window.clearInterval(spinner);
      setResolutionDisplay(null);
      setIsResolving(false);
      window.alert(error?.message || 'Challenge could not be resolved.');
    }
  };

  const EventSummary = () => (
    <section className={`rounded-2xl overflow-hidden border-2 shadow-xl ${card.type === 'problem' ? 'border-rose-700/80 bg-slate-950' : 'border-emerald-700/80 bg-slate-950'}`}>
      <div className={`px-4 py-3 ${card.type === 'problem' ? 'bg-gradient-to-r from-rose-950 to-slate-950' : 'bg-gradient-to-r from-emerald-950 to-slate-950'}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-[9px] font-black uppercase tracking-[0.15em] text-white/60">
              <span>Card {cardNumber}</span><span>•</span><span>{card.type}</span><span>•</span>
              <span className="flex items-center gap-1">{card.scope === 'local' ? <MapPin className="w-3 h-3" /> : <Building2 className="w-3 h-3" />}{card.scope === 'local' ? targetSite?.name : 'Whole company'}</span>
            </div>
            <h2 className="text-xl font-black text-white mt-1 leading-tight">{card.title}</h2>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">{card.description}</p>
          </div>
          <div className={`shrink-0 rounded-xl px-3 py-2 text-right border ${card.type === 'problem' ? 'bg-rose-950/70 border-rose-700 text-rose-100' : 'bg-emerald-950/70 border-emerald-700 text-emerald-100'}`}>
            <div className="text-[8px] uppercase tracking-widest font-black opacity-70">{card.type === 'problem' ? 'Loss if failed' : 'Gain if successful'}</div>
            <div className="text-lg font-black">{card.type === 'problem' ? '−' : '+'}{formatCurrency(card.impact)}</div>
            <div className="text-[9px] font-bold opacity-75">{riskPercent}% of turnover</div>
          </div>
        </div>
      </div>
    </section>
  );

  if (resolutionDisplay) {
    return (
      <div className="space-y-3">
        <motion.section initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className={`rounded-2xl border-2 p-4 shadow-2xl ${resolutionDisplay.complete ? resolutionDisplay.overallSuccess ? 'border-emerald-500 bg-emerald-950/45' : 'border-rose-500 bg-rose-950/45' : 'border-indigo-500 bg-slate-950'}`}>
          <div className="flex items-center justify-between gap-4 mb-3">
            <div><div className="text-[10px] uppercase tracking-[0.18em] text-slate-400 font-black">Resolution</div><div className="text-lg font-black text-white">{resolutionDisplay.complete ? 'Challenge resolved' : 'Testing your response…'}</div></div>
            {resolutionDisplay.complete && <div className={`text-2xl font-black ${resolutionDisplay.overallSuccess ? 'text-emerald-300' : 'text-rose-300'}`}>{resolutionDisplay.overallSuccess ? 'SUCCESS' : 'FAIL'}</div>}
          </div>
          <div className={`grid gap-3 ${resolutionDisplay.domains.length > 1 ? 'sm:grid-cols-2' : 'grid-cols-1'}`}>
            {resolutionDisplay.domains.map((item) => (
              <div key={item.domain} className="rounded-xl border border-slate-700 bg-slate-950/85 p-3">
                <div className="flex items-center justify-between gap-3"><span className="font-black text-white">{DOMAIN_INFO[item.domain].label}</span>{resolutionDisplay.complete && item.success != null && <span className={`text-sm font-black ${item.success ? 'text-emerald-400' : 'text-rose-400'}`}>{item.success ? 'SUCCESS' : 'FAIL'}</span>}</div>
                <div className="grid grid-cols-2 gap-3 mt-2 text-center">
                  <div className="rounded-lg bg-slate-900 border border-slate-700 p-2"><div className="text-[8px] uppercase tracking-widest text-slate-500 font-black">Target</div><div className="text-xl font-black text-white">≥ {String(item.target).padStart(2, '0')}%</div></div>
                  <div className="rounded-lg bg-slate-900 border border-indigo-700 p-2"><div className="text-[8px] uppercase tracking-widest text-indigo-300 font-black">Roll</div><div className={`text-2xl font-black tabular-nums ${resolutionDisplay.complete ? item.success ? 'text-emerald-300' : 'text-rose-300' : 'text-white'}`}>{String(item.value).padStart(2, '0')}%</div></div>
                </div>
              </div>
            ))}
          </div>
          {resolutionDisplay.complete && <button onClick={() => onAcknowledgeResolution(event.instanceId)} className="mt-3 w-full rounded-xl bg-white text-slate-950 px-4 py-3 font-black hover:bg-slate-100">CONTINUE</button>}
        </motion.section>
        <EventSummary />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="w-full grid lg:grid-cols-[minmax(0,1.35fr)_330px] gap-3 items-start">
      <div className="space-y-3">
        <EventSummary />
        {canHorizonRedraw && !event.isResolved && <button onClick={() => onRedrawEvent?.(event.instanceId)} className="w-full rounded-xl border border-amber-600 bg-amber-950/45 px-3 py-2 text-xs font-black text-amber-200">HORIZON SCAN: DRAW ANOTHER</button>}

        <section className="rounded-2xl border border-slate-700 bg-slate-900/80 p-3">
          <div className="text-[9px] uppercase tracking-[0.18em] text-slate-500 font-black mb-2">Knowledge needed</div>
          <div className="grid sm:grid-cols-2 gap-2">
            {card.domains.map((requirement) => {
              const info = DOMAIN_INFO[requirement.domain];
              const entry = evaluations.find((item) => item.domain === requirement.domain)!.value;
              return <button key={requirement.domain} onClick={() => { setDomain(requirement.domain); setMode('existing'); }} className={`rounded-xl border px-3 py-2 text-left ${domain === requirement.domain ? 'border-white bg-white/10' : 'border-slate-700 bg-slate-950'}`}><div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: info.color }} /><span className="font-black text-white text-sm">{info.label}</span></div><div className="mt-1 text-[10px] text-slate-400">Challenge {requirement.difficulty} · Knowledge {entry.totalKnowledge} · <b className={entry.winChancePercent >= 70 ? 'text-emerald-400' : entry.winChancePercent >= 40 ? 'text-amber-400' : 'text-rose-400'}>{entry.winChancePercent}%</b></div></button>;
            })}
          </div>
        </section>

        {!event.isResolved && (
          <section className="rounded-2xl border border-slate-700 bg-[#11162a]/95 p-3 min-h-[108px]">
            {mode === 'existing' && <div><div className="font-black text-white text-sm">Use what we already know — {DOMAIN_INFO[domain].label}</div><div className="grid sm:grid-cols-3 gap-2 mt-2"><SourceButton icon={Users} label="Team" value={evaluation.availableSources.team} selected={!!allocation.useTeamCapability} onClick={() => setCurrent({ useTeamCapability: !allocation.useTeamCapability })}/><SourceButton icon={BookOpen} label="Local Docs" value={evaluation.availableSources.localCodified} selected={!!allocation.useLocalCodified} onClick={() => setCurrent({ useLocalCodified: !allocation.useLocalCodified })}/><SourceButton icon={Building2} label="Corporate" value={evaluation.availableSources.usableIntranet} selected={!!allocation.useCorporateIntranet} onClick={() => setCurrent({ useCorporateIntranet: !allocation.useCorporateIntranet })}/></div></div>}
            {mode === 'consultant' && <div><div className="font-black text-white text-sm">External expertise — {DOMAIN_INFO[domain].label}</div><div className="flex gap-2 mt-2">{[1,2,3].map((points) => { const selected = allocation.consultantPoints === points; const enabled = selected || points <= evaluation.usefulConsultantGap; return <button key={points} disabled={!enabled} onClick={() => setCurrent({ consultantPoints: selected ? 0 : points })} className={`rounded-xl px-4 py-2 font-black border ${selected ? 'bg-amber-400 text-slate-950 border-amber-200' : enabled ? 'bg-slate-950 text-white border-slate-600' : 'bg-slate-900 text-slate-700 border-slate-800'}`}>+{points}<span className="block text-[9px]">${consultantRate * points}k+</span></button>; })}</div></div>}
            {mode === 'expert' && <div><div className="font-black text-white text-sm">Ask one of our experts — {DOMAIN_INFO[domain].label}</div><div className="grid sm:grid-cols-2 gap-2 mt-2">{eligibleExperts.length ? eligibleExperts.map((expert) => { const skill = expert.domains.find((entry) => entry.domain === domain)!; const selected = allocation.expertId === expert.id; return <button key={expert.id} onClick={() => setCurrent({ expertId: selected ? '' : expert.id })} className={`rounded-xl border p-2 text-left ${selected ? 'border-amber-300 bg-amber-400 text-slate-950' : 'border-slate-700 bg-slate-950 text-white'}`}><div className="font-black text-sm">{expert.name}</div><div className="text-[10px] opacity-70">{DOMAIN_INFO[domain].label} {skill.score}</div></button>; }) : <div className="text-xs text-rose-300">No eligible expert holds this domain.</div>}</div></div>}
            {mode === 'network' && <div><div className="font-black text-white text-sm">Ask our network — {DOMAIN_INFO[domain].label}</div>{networkAvailable ? <button onClick={() => setCurrent({ useCoPSupport: !allocation.useCoPSupport })} className={`mt-2 rounded-xl border px-4 py-2 font-black ${allocation.useCoPSupport ? 'bg-amber-400 text-slate-950 border-amber-200' : 'bg-slate-950 text-amber-200 border-amber-700'}`}>{allocation.useCoPSupport ? 'Network support selected (+2)' : 'Use Community of Practice (+2)'}</button> : <div className="text-xs text-slate-400 mt-2">No active multi-company Community of Practice.</div>}</div>}
            {mode === 'reputation' && <div className="flex items-center justify-between gap-3"><div><div className="font-black text-white text-sm">Call in a favour</div><div className="text-xs text-slate-400">{company.reputationPoints} reputation left. Guarantees the whole card.</div></div><button onClick={useReputation} disabled={company.reputationPoints <= 0} className="rounded-xl bg-amber-400 text-slate-950 px-4 py-2 font-black disabled:bg-slate-800 disabled:text-slate-600">USE 1</button></div>}
            {mode === 'risk' && <div><div className="font-black text-white text-sm">Accept the risk</div><div className="text-xs text-slate-400 mt-1">Probability {cardChance}% · exposure {card.type === 'problem' ? '−' : '+'}{formatCurrency(card.impact)} ({riskPercent}% of turnover).</div></div>}
          </section>
        )}
      </div>

      <aside className="space-y-2">
        <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400 font-black px-1">Knowledge Suite</div>
        {RESPONSE_MODES.map((choice) => { const Icon = choice.icon; const active = mode === choice.id; const selected = selectedByMode[choice.id]; return <button key={choice.id} disabled={isResolving || event.isResolved} onClick={() => chooseMode(choice.id)} className={`relative w-full min-h-[67px] rounded-xl border-2 p-2.5 text-left transition ${active ? 'border-indigo-300 bg-indigo-950/90' : 'border-slate-700 bg-slate-900/95'} disabled:opacity-60`}><div className="flex items-start gap-2"><Icon className="w-4 h-4 text-indigo-300 mt-0.5 shrink-0"/><div><div className="font-black text-white text-xs leading-tight">{choice.label}</div><div className="text-[9px] text-slate-400 mt-1">{choice.id === 'consultant' ? `From $${consultantRate}k/point` : choice.id === 'reputation' ? `${choice.sub} (${company.reputationPoints} left)` : choice.sub}</div></div></div>{selected && <span className="absolute -right-2 -top-2 w-7 h-7 rounded-full bg-emerald-400 border-4 border-slate-950 grid place-items-center text-emerald-950"><Check className="w-3 h-3 stroke-[4]"/></span>}</button>; })}
        {!event.isResolved && <button onClick={resolve} disabled={isResolving} className="w-full rounded-xl bg-indigo-500 hover:bg-indigo-400 disabled:opacity-60 text-white px-5 py-3 text-lg font-black shadow-xl">{isResolving ? 'ROLLING…' : 'GO'}</button>}
        <div className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 flex items-center justify-between text-xs"><span className="text-slate-500">Current chance</span><b className={cardChance >= 70 ? 'text-emerald-400' : cardChance >= 40 ? 'text-amber-400' : 'text-rose-400'}>{cardChance}%</b></div>
        {knownConsultantCost > 0 && <div className="text-[10px] text-amber-300 text-center">Known response cost: ${knownConsultantCost}k</div>}
      </aside>
    </motion.div>
  );
};

const SourceButton: React.FC<{ icon: React.ElementType; label: string; value: number; selected: boolean; onClick: () => void }> = ({ icon: Icon, label, value, selected, onClick }) => (
  <button onClick={onClick} className={`rounded-xl border p-2 text-left ${selected ? 'border-emerald-300 bg-emerald-950/80' : 'border-slate-700 bg-slate-950'}`}><div className="flex items-center justify-between"><Icon className={`w-4 h-4 ${selected ? 'text-emerald-300' : 'text-slate-400'}`}/>{selected && <Check className="w-3 h-3 text-emerald-300"/>}</div><div className="font-black text-white text-xs mt-1">{label}</div><div className="text-lg font-black text-white">{value}</div></button>
);
