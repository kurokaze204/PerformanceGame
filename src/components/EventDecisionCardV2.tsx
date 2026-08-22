import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  BriefcaseBusiness,
  Building2,
  Check,
  CircleDollarSign,
  Dice5,
  Handshake,
  MapPin,
  ShieldQuestion,
  Sparkles,
  Users,
} from 'lucide-react';
import type { KnowledgeDomain } from '../types/game.ts';
import { DOMAIN_INFO } from '../types/game.ts';
import type { ActiveEventV2, CompanyV2, GameSessionV2 } from '../types/gameV2.ts';
import { currentConsultantRate, evaluateEventDomainKnowledgeV2 } from '../engine/coreV2.ts';
import { formatCurrency } from '../utils/format.ts';

type DecisionMode = 'existing' | 'expert' | 'network' | 'consultant' | 'reputation' | 'risk';

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

  useEffect(() => {
    setDomain(event.card.domains[0].domain);
    setMode('existing');
  }, [event.instanceId]);

  const targetSite = event.targetSiteId ? company.sites.find((s) => s.id === event.targetSiteId) : undefined;
  const evaluation = evaluateEventDomainKnowledgeV2(session, company, event, domain, session.config);
  const allocation = event.allocations[domain] || {};
  const consultantRate = currentConsultantRate(company);

  const riskPercent = useMemo(() => {
    const base = card.scope === 'local' && targetSite ? targetSite.turnover : company.turnover;
    return base > 0 ? Math.round((card.impact / base) * 100) : 100;
  }, [card.impact, card.scope, company.turnover, targetSite?.turnover]);

  const eligibleExperts = company.experts.filter((expert) =>
    !expert.isVacant && expert.domains.some((d) => d.domain === domain),
  );

  const activeCoPCompanies = new Set(
    session.copMemberships.filter((m) => m.domain === domain && m.activeRound === session.round).map((m) => m.companyId),
  );
  const networkAvailable = activeCoPCompanies.size >= 2;

  const clearOptional = async () => {
    await onSetAllocation(event.instanceId, domain, { expertId: '', useCoPSupport: false, consultantPoints: 0 });
  };

  const chooseMode = async (next: DecisionMode) => {
    setMode(next);
    if (next === 'existing' || next === 'risk' || next === 'reputation') await clearOptional();
  };

  const resolve = async () => {
    setIsResolving(true);
    try { await onResolveEvent(event.instanceId); }
    finally { setIsResolving(false); }
  };

  const useReputation = async () => {
    if (company.reputationPoints <= 0) return;
    setIsResolving(true);
    try {
      const res = await fetch(`/api/sessions/${session.id}/events/reputation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: company.id, eventInstanceId: event.instanceId }),
      });
      const data = await res.json();
      if (!res.ok || data.success === false) throw new Error(data.message || data.error || 'Could not use Reputation.');
      window.location.reload();
    } catch (error: any) {
      window.alert(error.message || 'Could not use Reputation.');
    } finally {
      setIsResolving(false);
    }
  };

  const decisions: { id: DecisionMode; label: string; sub: string; icon: React.ElementType }[] = [
    { id: 'existing', label: 'Use what we already know', sub: 'Rely on the capability already available here', icon: Building2 },
    { id: 'expert', label: 'Ask one of our experts to help', sub: 'Invite a deep expert to contribute; travel may cost money', icon: Users },
    { id: 'network', label: 'Ask our network for help', sub: 'Draw on an active Community of Practice', icon: Handshake },
    { id: 'consultant', label: 'Engage external expertise', sub: `Bring in temporary external capability from $${consultantRate}k per point`, icon: BriefcaseBusiness },
    { id: 'reputation', label: 'Call in a favour', sub: `Spend scarce reputation to guarantee the card (${company.reputationPoints} left)`, icon: Sparkles },
    { id: 'risk', label: 'Accept the risk', sub: 'Proceed without adding temporary knowledge', icon: ShieldQuestion },
  ];

  const problemSuccessMessage = card.scope === 'local' && targetSite
    ? `${targetSite.name} avoided a real hit to their bottom line. Well done!`
    : `${company.name} avoided a real hit to their bottom line. Well done!`;

  return (
    <motion.section
      layout
      className={`rounded-3xl overflow-hidden border-2 shadow-2xl ${card.type === 'problem' ? 'border-rose-700/70 bg-slate-950' : 'border-emerald-700/70 bg-slate-950'}`}
    >
      <div className={`px-6 py-5 ${card.type === 'problem' ? 'bg-gradient-to-r from-rose-950 to-slate-950' : 'bg-gradient-to-r from-emerald-950 to-slate-950'}`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-white/60">
              <span>Card {cardNumber}</span><span>•</span><span>{card.type === 'problem' ? 'Problem' : 'Opportunity'}</span><span>•</span>
              <span className="flex items-center gap-1">{card.scope === 'local' ? <MapPin className="w-3.5 h-3.5" /> : <Building2 className="w-3.5 h-3.5" />}{card.scope === 'local' ? targetSite?.name : 'Whole company'}</span>
            </div>
            <h2 className="text-2xl font-black text-white mt-2 leading-tight">{card.title}</h2>
            <p className="text-sm text-slate-300 mt-2 max-w-3xl leading-relaxed">{card.description}</p>
          </div>
          <div className={`shrink-0 rounded-2xl px-4 py-3 text-right border ${card.type === 'problem' ? 'bg-rose-950/70 border-rose-700 text-rose-100' : 'bg-emerald-950/70 border-emerald-700 text-emerald-100'}`}>
            <div className="text-[10px] uppercase tracking-widest font-bold opacity-65">{card.type === 'problem' ? 'Loss if failed' : 'Gain if successful'}</div>
            <div className="text-2xl font-black">{card.type === 'problem' ? '−' : '+'}{formatCurrency(card.impact)}</div>
            <div className="text-xs font-bold opacity-80">{riskPercent}% of {card.scope === 'local' ? `${targetSite?.name || 'site'} turnover` : 'company turnover'}</div>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-5">
        {canHorizonRedraw && !event.isResolved && (
          <div className="rounded-2xl bg-amber-950/50 border border-amber-500/60 p-4 flex items-center justify-between gap-4">
            <div><div className="font-bold text-amber-200">Your horizon scan saw this coming.</div><div className="text-sm text-amber-100/70">You can reject this card and draw another card of the same type.</div></div>
            <button className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-black" onClick={() => onRedrawEvent?.(event.instanceId)}>Draw another</button>
          </div>
        )}

        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-slate-500 font-bold mb-2">Knowledge needed</div>
          <div className="flex gap-2 flex-wrap">
            {card.domains.map((req) => {
              const info = DOMAIN_INFO[req.domain];
              const selected = req.domain === domain;
              const ev = evaluateEventDomainKnowledgeV2(session, company, event, req.domain, session.config);
              const gap = Math.max(0, req.difficulty - ev.totalKnowledge);
              return (
                <button key={req.domain} onClick={() => { setDomain(req.domain); setMode('existing'); }} className={`rounded-2xl border-2 px-4 py-3 text-left transition ${selected ? 'border-white bg-white/10' : 'border-slate-700 bg-slate-900 hover:border-slate-500'}`}>
                  <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full" style={{ backgroundColor: info.color }} /><span className="font-bold text-white">{info.label}</span></div>
                  <div className="mt-1 text-sm text-slate-400">Challenge {req.difficulty} · Knowledge {ev.totalKnowledge}</div>
                  <div className="text-xs text-slate-500 mt-1">Knowledge gap {gap}</div>
                  <div className={`text-xs font-bold mt-1 ${ev.winChancePercent >= 70 ? 'text-emerald-400' : ev.winChancePercent >= 40 ? 'text-amber-400' : 'text-rose-400'}`}>{ev.winChancePercent}% chance</div>
                </button>
              );
            })}
          </div>
        </div>

        {!event.isResolved && (
          <>
            <div>
              <div className="flex items-baseline justify-between gap-3 mb-3"><div><div className="text-lg font-black text-white">How will you handle {DOMAIN_INFO[domain].label}?</div><div className="text-sm text-slate-400">Build a response by turning options on and off until the risk feels acceptable.</div></div><div className="text-right"><div className="text-xs text-slate-500 uppercase font-bold">Current chance</div><div className="text-3xl font-black text-white">{evaluation.winChancePercent}%</div></div></div>
              <div className="grid md:grid-cols-3 xl:grid-cols-6 gap-2">
                {decisions.map((choice) => {
                  const Icon = choice.icon;
                  return <button key={choice.id} onClick={() => chooseMode(choice.id)} className={`min-h-28 rounded-2xl border-2 p-3 text-left transition ${mode === choice.id ? 'border-indigo-400 bg-indigo-950/70 shadow-lg shadow-indigo-950/50' : 'border-slate-700 bg-slate-900 hover:border-slate-500'}`}><Icon className="w-6 h-6 text-indigo-300"/><div className="font-black text-white mt-2 leading-tight">{choice.label}</div><div className="text-xs text-slate-400 mt-1 leading-snug">{choice.sub}</div></button>;
                })}
              </div>
            </div>

            <motion.div layout className="rounded-2xl border border-slate-700 bg-slate-900/80 p-4 min-h-24">
              {mode === 'existing' && <div><div className="font-bold text-white">Use existing organisational capability</div><div className="text-sm text-slate-400 mt-1">Team, local documents, usable corporate knowledge and any automation already in place are included automatically. No extra cost.</div></div>}
              {mode === 'expert' && <div><div className="font-bold text-white mb-2">Who could help?</div>{eligibleExperts.length ? <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">{eligibleExperts.map((expert) => { const skill = expert.domains.find((d) => d.domain === domain)!; const atTarget = card.scope === 'enterprise' || expert.location === event.targetSiteId; const selected = allocation.expertId === expert.id; return <button key={expert.id} onClick={() => onSetAllocation(event.instanceId, domain, { expertId: selected ? '' : expert.id })} className={`rounded-xl border p-3 text-left ${selected ? 'border-indigo-400 bg-indigo-950/60' : 'border-slate-700 bg-slate-950'}`}><div className="flex justify-between gap-2"><span className="font-bold text-white">{expert.name}</span>{selected && <Check className="w-4 h-4 text-emerald-400"/>}</div><div className="text-sm text-slate-400">{DOMAIN_INFO[domain].label} {skill.score} · {expert.location === 'HQ' ? 'HQ' : company.sites.find((s) => s.id === expert.location)?.name || expert.location}</div><div className={`text-xs font-bold mt-1 ${atTarget ? 'text-emerald-400' : 'text-amber-400'}`}>{atTarget ? '+2 · already at the location' : '+2 · travel cost applies'}</div><div className="text-[10px] text-slate-500 mt-1">{selected ? 'Click again to remove' : 'Click to add to the response'}</div></button>; })}</div> : <div className="text-sm text-rose-300">No Deep Expert in this domain is currently available within your company.</div>}</div>}
              {mode === 'network' && <div><div className="font-bold text-white">Community of Practice</div>{networkAvailable ? <button onClick={() => onSetAllocation(event.instanceId, domain, { useCoPSupport: !allocation.useCoPSupport })} className={`mt-3 rounded-xl px-4 py-3 font-bold border ${allocation.useCoPSupport ? 'bg-amber-500 text-slate-950 border-amber-300' : 'bg-slate-950 text-amber-200 border-amber-600'}`}>{allocation.useCoPSupport ? 'Network help selected (+2) · click to remove' : 'Ask the network for +2 support'}</button> : <div className="text-sm text-slate-400 mt-1">No active multi-company {DOMAIN_INFO[domain].label} CoP this round. The team may need to ask another company whether one of their experts can contribute.</div>}</div>}
              {mode === 'consultant' && <div><div className="flex items-center gap-2 font-bold text-white"><CircleDollarSign className="w-5 h-5 text-amber-400"/>External expertise: ${consultantRate}k per knowledge point</div><div className="text-sm text-slate-400 mt-1">Temporary capability for this event only. Your rate rises 35% after each consultant engagement. Click a selected amount again to remove it.</div><div className="flex gap-2 mt-3">{[1,2,3].map((points) => { const selected = allocation.consultantPoints === points; const enabled = selected || points <= evaluation.usefulConsultantGap; return <button key={points} disabled={!enabled} onClick={() => onSetAllocation(event.instanceId, domain, { consultantPoints: selected ? 0 : points })} className={`rounded-xl px-4 py-3 font-black border ${selected ? 'bg-amber-500 text-slate-950 border-amber-300' : enabled ? 'bg-slate-950 text-white border-slate-600 hover:border-amber-500' : 'bg-slate-900 text-slate-700 border-slate-800 cursor-not-allowed'}`}>+{points}<span className="block text-xs font-medium">${consultantRate * points}k</span>{selected && <span className="block text-[9px] mt-0.5">click to remove</span>}</button>; })}{evaluation.usefulConsultantGap === 0 && !allocation.consultantPoints && <span className="text-sm text-emerald-400 self-center">No consultant points are needed to close the knowledge gap.</span>}</div></div>}
              {mode === 'reputation' && <div><div className="font-black text-white flex items-center gap-2"><Sparkles className="w-5 h-5 text-fuchsia-300"/>Call in a favour</div><div className="text-sm text-slate-400 mt-1">Spend one of your three finite Reputation points to guarantee this whole card. The favour fixes the immediate business outcome but creates no Team Capability, codification or corporate knowledge.</div><div className="flex items-center gap-3 mt-3"><div className="flex gap-2">{Array.from({length: company.reputationPointsStarted}, (_, i) => <span key={i} className={`w-10 h-10 rounded-full border-2 grid place-items-center font-black ${i < company.reputationPoints ? 'border-fuchsia-400 bg-fuchsia-950 text-fuchsia-200' : 'border-slate-700 bg-slate-950 text-slate-700'}`}>{i < company.reputationPoints ? '★' : '×'}</span>)}</div><button disabled={company.reputationPoints <= 0 || isResolving} onClick={useReputation} className="rounded-xl px-5 py-3 font-black bg-fuchsia-600 text-white disabled:bg-slate-800 disabled:text-slate-600">{company.reputationPoints > 0 ? 'Spend 1 Reputation → guarantee success' : 'No Reputation remaining'}</button></div></div>}
              {mode === 'risk' && <div><div className="font-black text-white flex items-center gap-2"><Dice5 className="w-5 h-5 text-rose-300"/>Proceed without intervention</div><div className="grid sm:grid-cols-3 gap-3 mt-3"><div className="rounded-xl bg-slate-950 p-3"><div className="text-xs uppercase text-slate-500 font-bold">Chance of success</div><div className="text-2xl font-black text-white">{evaluation.winChancePercent}%</div></div><div className="rounded-xl bg-slate-950 p-3"><div className="text-xs uppercase text-slate-500 font-bold">At stake</div><div className={`text-2xl font-black ${card.type === 'problem' ? 'text-rose-300' : 'text-emerald-300'}`}>{card.type === 'problem' ? '−' : '+'}{formatCurrency(card.impact)}</div></div><div className="rounded-xl bg-slate-950 p-3"><div className="text-xs uppercase text-slate-500 font-bold">Relative impact</div><div className="text-2xl font-black text-white">{riskPercent}%</div><div className="text-xs text-slate-500">of {card.scope === 'local' ? 'site' : 'company'} turnover</div></div></div></div>}
            </motion.div>

            <div className="flex items-center justify-between gap-4 pt-2 border-t border-slate-800">
              <div className="text-sm text-slate-400">You can switch between the two event cards while planning. Resolving commits the choices on this card.</div>
              <button disabled={isResolving} onClick={resolve} className="shrink-0 rounded-2xl bg-white text-slate-950 px-6 py-4 font-black text-lg shadow-xl hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 flex items-center gap-2"><Dice5 className="w-5 h-5"/>{isResolving ? 'Resolving…' : 'Resolve this card'}</button>
            </div>
          </>
        )}

        {event.isResolved && (
          <div className={`rounded-2xl p-5 border ${event.success ? 'bg-emerald-950/50 border-emerald-600' : 'bg-rose-950/50 border-rose-600'}`}>
            <div className="text-2xl font-black text-white">{event.success ? 'Success' : 'Not resolved successfully'}</div>
            <div className="text-sm text-slate-300 mt-1">
              {event.success && card.type === 'problem'
                ? problemSuccessMessage
                : event.reputationUsed
                  ? `Resolved by calling in a favour. Reputation remaining: ${company.reputationPoints}.`
                  : event.turnoverChangeApplied
                    ? `Business impact: ${event.turnoverChangeApplied > 0 ? '+' : '−'}${formatCurrency(Math.abs(event.turnoverChangeApplied))}`
                    : 'No direct turnover change from the event outcome.'}
            </div>
          </div>
        )}
      </div>
    </motion.section>
  );
};
