import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  BriefcaseBusiness,
  Building2,
  GraduationCap,
  Handshake,
  Network,
  Radar,
  Sparkles,
  Users,
} from 'lucide-react';
import type { Company, GameSession, KnowledgeDomain } from '../types/game.ts';
import { DOMAIN_INFO } from '../types/game.ts';

interface ActionsPanelProps {
  session: GameSession;
  company: Company;
  onPerformAction: (actionType: string, params: any) => void;
  onNextPhase: () => void;
}

type InterventionId =
  | 'transfer'
  | 'corporate-training'
  | 'codify-site'
  | 'train-expert'
  | 'update-intranet'
  | 'aar'
  | 'join-cop'
  | 'horizon-scan';

type AnchorId = 'existing' | 'external' | 'expert' | 'favour' | 'network' | 'risk';

type Intervention = {
  id: InterventionId;
  title: string;
  description: string;
  anchor: AnchorId;
  icon: React.ElementType;
};

const DOMAINS: KnowledgeDomain[] = ['engineering', 'hr', 'marketing', 'operations', 'finance'];

const INTERVENTIONS: Intervention[] = [
  { id: 'transfer', title: 'Knowledge Transfer', description: 'An expert at a site transfers domain expertise directly to the local team (+1 Team Capability).', anchor: 'existing', icon: Users },
  { id: 'corporate-training', title: 'Corporate Training', description: 'Raise Team Capability at all sites (+1) up to the Corporate Intranet score.', anchor: 'existing', icon: Building2 },
  { id: 'codify-site', title: 'Codify Site Knowledge', description: 'Document local operating knowledge at a site (+1 Local Codified up to Team level).', anchor: 'existing', icon: BookOpen },
  { id: 'train-expert', title: 'Train Expert', description: 'Formal training advances one expert domain score by +1. Cost is determined when committed.', anchor: 'expert', icon: GraduationCap },
  { id: 'update-intranet', title: 'Update Corporate Intranet Domain', description: 'Capture the strongest available organisational knowledge into the corporate knowledge environment.', anchor: 'expert', icon: Building2 },
  { id: 'aar', title: 'Lessons Learned / AAR', description: 'Spend an Action to review a relevant resolved challenge and convert experience into persistent local Team Capability or Codified Knowledge.', anchor: 'risk', icon: Sparkles },
  { id: 'join-cop', title: 'Join Community of Practice', description: 'Commit an eligible expert to a domain Community of Practice. Cost is determined when committed.', anchor: 'network', icon: Network },
  { id: 'horizon-scan', title: 'Horizon Scan', description: 'Scout one domain so one matching event next round can be rejected and redrawn.', anchor: 'risk', icon: Radar },
];

const ANCHORS: { id: AnchorId; title: string; description: string; disabled?: boolean; icon: React.ElementType }[] = [
  { id: 'existing', title: 'Use what we already know', description: 'Strengthen internal capability, codification and reuse.', icon: Building2 },
  { id: 'external', title: 'Engage external expertise', description: 'Challenge-response mechanism only.', disabled: true, icon: BriefcaseBusiness },
  { id: 'expert', title: 'Ask one of our experts to help', description: 'Develop or capture scarce deep expertise.', icon: Users },
  { id: 'favour', title: 'Call in a favour', description: 'Challenge-response mechanism only.', disabled: true, icon: Sparkles },
  { id: 'network', title: 'Ask our network for help', description: 'Invest in the relationships that make network help possible.', icon: Handshake },
  { id: 'risk', title: 'Accept the risk', description: 'Learn from outcomes and improve anticipation of future disruption.', icon: Radar },
];

export const ActionsPanel: React.FC<ActionsPanelProps> = ({ session, company, onPerformAction, onNextPhase }) => {
  const [selectedId, setSelectedId] = useState<InterventionId>('transfer');
  const [siteId, setSiteId] = useState(company.sites.find((site) => !site.isClosed)?.id || '');
  const [expertId, setExpertId] = useState(company.experts.find((expert) => !expert.isVacant)?.id || '');
  const [domain, setDomain] = useState<KnowledgeDomain>('engineering');
  const [learningTarget, setLearningTarget] = useState<'team' | 'codified'>('team');

  const activeSites = company.sites.filter((site) => !site.isClosed);
  const activeExperts = company.experts.filter((expert) => !expert.isVacant && (expert.state === 'Available' || expert.state === 'HQ Assignment'));
  const selected = INTERVENTIONS.find((item) => item.id === selectedId) || INTERVENTIONS[0];
  const selectedSite = activeSites.find((site) => site.id === siteId) || activeSites[0];
  const selectedExpert = activeExperts.find((expert) => expert.id === expertId) || activeExperts[0];

  const learningDomains = useMemo<KnowledgeDomain[]>(() => {
    if (selectedId !== 'aar' || !selectedSite) return DOMAINS;
    const relevant = new Set<KnowledgeDomain>();
    for (const event of session.activeEvents[company.id] || []) {
      if (!event.isResolved) continue;
      if (event.card.scope === 'local' && event.targetSiteId !== selectedSite.id) continue;
      for (const requirement of event.card.domains) relevant.add(requirement.domain);
    }
    return DOMAINS.filter((candidate) => relevant.has(candidate));
  }, [company.id, selectedId, selectedSite?.id, session.activeEvents]);

  useEffect(() => {
    if (selectedSite && selectedSite.id !== siteId) setSiteId(selectedSite.id);
  }, [selectedSite?.id]);

  useEffect(() => {
    if (selectedExpert && selectedExpert.id !== expertId) setExpertId(selectedExpert.id);
  }, [selectedExpert?.id]);

  useEffect(() => {
    if (selectedId === 'aar' && learningDomains.length && !learningDomains.includes(domain)) setDomain(learningDomains[0]);
  }, [domain, learningDomains, selectedId]);

  const expectedEffect = useMemo(() => {
    if (selectedId === 'transfer') {
      const before = selectedSite?.teamCapability[domain] ?? 0;
      return selectedSite ? `${selectedSite.name} ${DOMAIN_INFO[domain].label} Team Capability ${before} → ${Math.min(6, before + 1)}` : 'Choose an active site.';
    }
    if (selectedId === 'corporate-training') {
      const eligible = activeSites.filter((site) => site.teamCapability[domain] < company.intranet[domain]).length;
      return `${eligible} site${eligible === 1 ? '' : 's'} can gain +1 ${DOMAIN_INFO[domain].label} Team Capability`;
    }
    if (selectedId === 'codify-site') {
      const before = selectedSite?.codifiedKnowledge[domain] ?? 0;
      return selectedSite ? `${selectedSite.name} ${DOMAIN_INFO[domain].label} Local Codified ${before} → ${Math.min(6, before + 1)}` : 'Choose an active site.';
    }
    if (selectedId === 'train-expert') {
      const skill = selectedExpert?.domains.find((entry) => entry.domain === domain);
      return skill ? `${selectedExpert?.name} ${DOMAIN_INFO[domain].label} ${skill.score} → ${Math.min(8, skill.score + 1)}` : 'Choose a domain already held by the expert.';
    }
    if (selectedId === 'update-intranet') {
      return `${DOMAIN_INFO[domain].label} Corporate Intranet ${company.intranet[domain]} → higher if deeper source knowledge is available`;
    }
    if (selectedId === 'aar') {
      if (!learningDomains.length) return 'No resolved challenge this round provides learning that can be applied at this site.';
      const before = learningTarget === 'team' ? selectedSite?.teamCapability[domain] ?? 0 : selectedSite?.codifiedKnowledge[domain] ?? 0;
      return selectedSite ? `${selectedSite.name} ${DOMAIN_INFO[domain].label} ${learningTarget === 'team' ? 'Team Capability' : 'Local Codified'} ${before} → ${Math.min(6, before + 1)}` : 'Choose an active site.';
    }
    if (selectedId === 'join-cop') return `Commit ${selectedExpert?.name || 'an eligible expert'} to the ${DOMAIN_INFO[domain].label} CoP for this round`;
    return `Arm ${DOMAIN_INFO[domain].label} Horizon Scan for round ${session.round + 1}`;
  }, [activeSites, company.intranet, domain, learningDomains.length, learningTarget, selectedExpert, selectedId, selectedSite, session.round]);

  const actionParams = () => {
    if (selectedId === 'transfer') return ['KNOWLEDGE_TRANSFER', { siteId, expertId, domain }] as const;
    if (selectedId === 'corporate-training') return ['CORPORATE_TRAINING', { domain }] as const;
    if (selectedId === 'codify-site') return ['CODIFY_SITE', { siteId, domain }] as const;
    if (selectedId === 'train-expert') return ['TRAIN_EXPERT', { expertId, domain }] as const;
    if (selectedId === 'update-intranet') return ['UPDATE_INTRANET', { domain }] as const;
    if (selectedId === 'aar') return ['LESSONS_LEARNED', { siteId, domain, learningTarget }] as const;
    if (selectedId === 'join-cop') return ['JOIN_COP', { expertId, domain }] as const;
    return ['HORIZON_SCAN', { domain }] as const;
  };

  const commit = () => {
    const [type, params] = actionParams();
    onPerformAction(type, params);
  };

  const needsSite = selectedId === 'transfer' || selectedId === 'codify-site' || selectedId === 'aar';
  const needsExpert = selectedId === 'transfer' || selectedId === 'train-expert' || selectedId === 'join-cop';
  const noActions = company.actionsRemaining <= 0;
  const noLearningAvailable = selectedId === 'aar' && learningDomains.length === 0;
  const domainOptions = selectedId === 'aar' ? learningDomains : DOMAINS;

  return (
    <div className="space-y-4">
      <div className="grid xl:grid-cols-[270px_28px_minmax(280px,1fr)_minmax(300px,0.9fr)] gap-3 items-start">
        <div className="space-y-2">
          <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-black px-1">Knowledge Suite</div>
          {ANCHORS.map((anchor) => {
            const Icon = anchor.icon;
            const related = INTERVENTIONS.some((item) => item.anchor === anchor.id && item.id === selectedId);
            return (
              <div key={anchor.id} className={`rounded-xl border px-3 py-3 ${anchor.disabled ? 'border-slate-800 bg-slate-950/55 text-slate-600' : related ? 'border-indigo-400 bg-indigo-950/70 text-white shadow-lg shadow-indigo-950/40' : 'border-slate-700 bg-slate-900 text-slate-200'}`}>
                <div className="flex items-center gap-2"><Icon className="w-4 h-4" /><span className="font-black text-sm">{anchor.title}</span></div>
                <div className="text-[10px] mt-1 opacity-70 leading-snug">{anchor.description}</div>
              </div>
            );
          })}
        </div>

        <div className="hidden xl:flex min-h-[520px] items-center justify-center text-amber-400 text-2xl font-black">→</div>

        <div className="space-y-2">
          <div className="text-[10px] uppercase tracking-[0.18em] text-emerald-400 font-black px-1">Knowledge-building interventions</div>
          {INTERVENTIONS.map((item) => {
            const Icon = item.icon;
            const isSelected = item.id === selectedId;
            return (
              <button key={item.id} onClick={() => setSelectedId(item.id)} className={`w-full rounded-xl border-2 px-4 py-3 text-left transition ${isSelected ? 'border-white bg-emerald-800/90 shadow-xl shadow-emerald-950/40' : 'border-emerald-800 bg-emerald-950/70 hover:border-emerald-500'}`}>
                <div className="flex items-start gap-3">
                  <Icon className="w-5 h-5 text-emerald-300 mt-0.5 shrink-0" />
                  <div><div className="font-black text-white">{item.title}</div><div className="text-xs text-emerald-100/75 mt-0.5 leading-snug">{item.description}</div></div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="xl:sticky xl:top-24 rounded-2xl border-2 border-slate-600 bg-slate-900/95 p-4 shadow-2xl">
          <div className="text-[10px] uppercase tracking-[0.18em] text-indigo-300 font-black">Investment action</div>
          <h3 className="text-xl font-black text-white mt-1">{selected.title}</h3>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">{selected.description}</p>

          <div className="mt-4 space-y-3">
            {needsSite && (
              <label className="block"><span className="text-[10px] uppercase tracking-wider text-slate-500 font-black">Site</span><select value={siteId} onChange={(event) => setSiteId(event.target.value)} className="mt-1 w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-white">{activeSites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}</select></label>
            )}
            {needsExpert && (
              <label className="block"><span className="text-[10px] uppercase tracking-wider text-slate-500 font-black">Expert</span><select value={expertId} onChange={(event) => setExpertId(event.target.value)} className="mt-1 w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-white">{activeExperts.map((expert) => <option key={expert.id} value={expert.id}>{expert.name} · {expert.location === 'HQ' ? 'HQ' : company.sites.find((site) => site.id === expert.location)?.name || expert.location}</option>)}</select></label>
            )}
            <label className="block"><span className="text-[10px] uppercase tracking-wider text-slate-500 font-black">Domain</span><select value={domainOptions.includes(domain) ? domain : domainOptions[0] || ''} onChange={(event) => setDomain(event.target.value as KnowledgeDomain)} disabled={!domainOptions.length} className="mt-1 w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-white disabled:text-slate-600">{domainOptions.map((item) => <option key={item} value={item}>{DOMAIN_INFO[item].label}</option>)}</select></label>
            {selectedId === 'aar' && (
              <label className="block"><span className="text-[10px] uppercase tracking-wider text-slate-500 font-black">Capture learning as</span><select value={learningTarget} onChange={(event) => setLearningTarget(event.target.value as 'team' | 'codified')} className="mt-1 w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-white"><option value="team">Team Capability</option><option value="codified">Local Codified Knowledge</option></select></label>
            )}
          </div>

          <div className="mt-4 rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-3">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-black">Expected effect</div>
            <div className="text-sm text-slate-200 mt-1 leading-snug">{expectedEffect}</div>
          </div>

          <div className="mt-3 flex items-center justify-between text-xs"><span className="text-slate-500 font-black uppercase tracking-wider">Cost</span><span className="font-black text-white">1 Action{selectedId === 'train-expert' || selectedId === 'join-cop' ? ' + variable turnover' : ''}</span></div>

          <button onClick={commit} disabled={noActions || noLearningAvailable || (needsExpert && !selectedExpert) || (needsSite && !selectedSite)} className="mt-4 w-full rounded-xl bg-amber-400 hover:bg-amber-300 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 px-4 py-3 font-black transition active:scale-[0.99]">
            RUN {selected.title.toUpperCase()} · 1 ACTION
          </button>
          <div className="text-[10px] text-slate-500 mt-2 text-center">Execution is immediate and cannot be undone.</div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 pt-3 border-t border-slate-800">
        <div className="text-xs text-slate-500">{company.actionsRemaining} of {session.config.actions_per_round} Actions remain this round.</div>
        <button onClick={onNextPhase} className="rounded-xl border border-indigo-500 bg-indigo-950/70 hover:bg-indigo-900 text-indigo-100 px-4 py-2.5 font-black text-sm flex items-center gap-2">Finish investing <ArrowRight className="w-4 h-4" /></button>
      </div>
    </div>
  );
};
