import React, { useState } from 'react';
import {
  Company,
  GameSession,
  KnowledgeDomain,
  DOMAIN_INFO,
  ActionCategory,
  ActionType,
  Site,
  Expert
} from '../types/game.ts';
import {
  Users,
  GraduationCap,
  Building,
  BookOpen,
  Zap,
  RotateCcw,
  Network,
  Radio,
  Cpu,
  Info,
  CheckCircle,
  AlertTriangle,
  ArrowRight
} from 'lucide-react';

interface ActionsPanelProps {
  session: GameSession;
  company: Company;
  onPerformAction: (actionType: string, params: any) => void;
  onNextPhase: () => void;
}

const DOMAINS: KnowledgeDomain[] = ['engineering', 'hr', 'marketing', 'operations', 'finance'];

export const ActionsPanel: React.FC<ActionsPanelProps> = ({
  session,
  company,
  onPerformAction,
  onNextPhase,
}) => {
  const [activeCategory, setActiveCategory] = useState<ActionCategory>('DEVELOP');

  // Form states
  const [selectedSiteId, setSelectedSiteId] = useState<string>(company.sites[0]?.id || '');
  const [selectedExpertId, setSelectedExpertId] = useState<string>(company.experts[0]?.id || '');
  const [selectedDomain, setSelectedDomain] = useState<KnowledgeDomain>('engineering');
  const [selectedLearningTarget, setSelectedLearningTarget] = useState<'team' | 'codified'>('team');

  const activeSites = company.sites.filter((s) => !s.isClosed);
  const activeExperts = company.experts.filter((e) => !e.isVacant);

  const categories: { id: ActionCategory; label: string; icon: any; color: string }[] = [
    { id: 'DEVELOP', label: 'Develop Capability', icon: Users, color: 'text-indigo-400' },
    { id: 'CAPTURE', label: 'Capture & Codify', icon: BookOpen, color: 'text-sky-400' },
    { id: 'CONNECT', label: 'Connect & Relate', icon: Network, color: 'text-amber-400' },
    { id: 'EMBED', label: 'Embed Automation', icon: Cpu, color: 'text-emerald-400' },
    { id: 'DIAGNOSE', label: 'Diagnose & Audit', icon: Info, color: 'text-purple-400' },
  ];

  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4 shadow-sm space-y-4 text-[#c9d1d9]">
      {/* Header with Actions Remaining & Next Phase button */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-[#30363d]">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-white tracking-tight font-mono">PHASE 4: STRATEGIC KNOWLEDGE INVESTMENT</h2>
            <span className="px-2 py-0.5 rounded bg-indigo-950/60 border border-indigo-700/60 text-indigo-300 text-[11px] font-bold font-mono">
              {company.actionsRemaining}/4 ACTIONS REMAINING
            </span>
          </div>
          <p className="text-[11px] text-[#8b949e] mt-0.5">
            Build appropriate knowledge capability at an acceptable cost across human, organizational, and technological layers.
          </p>
        </div>

        <button
          onClick={onNextPhase}
          className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition active:scale-95 whitespace-nowrap"
        >
          <span>Complete Phase 4 → Attrition</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-1 bg-[#0d1117] p-1 rounded-lg border border-[#30363d] overflow-x-auto">
        {categories.map((cat) => {
          const Icon = cat.icon;
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition whitespace-nowrap ${
                isActive
                  ? 'bg-[#21262d] text-white border border-[#484f58] shadow-xs'
                  : 'text-[#8b949e] hover:text-white hover:bg-[#161b22]'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${cat.color}`} />
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Category Content Area */}
      <div className="p-3.5 bg-[#0d1117] border border-[#30363d] rounded-lg space-y-3">
        {/* DEVELOP CATEGORY */}
        {activeCategory === 'DEVELOP' && (
          <div className="space-y-3">
            <div className="text-[11px] text-[#8b949e] font-mono">
              // DEVELOP HUMAN & SOCIAL CAPITAL ACROSS SITES
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* 1. Knowledge Transfer */}
              <div className="p-3 bg-[#161b22] border border-[#30363d] rounded-lg space-y-2.5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-300 font-mono">
                    <Users className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Knowledge Transfer</span>
                  </div>
                  <p className="text-[11px] text-[#8b949e] mt-1">
                    An expert located at a site transfers domain expertise directly to the local team (+1 Team Capability).
                  </p>
                </div>

                <div className="space-y-2 text-xs">
                  <div>
                    <label className="text-[10px] text-[#8b949e] font-mono block">Site:</label>
                    <select
                      value={selectedSiteId}
                      onChange={(e) => setSelectedSiteId(e.target.value)}
                      className="w-full bg-[#0d1117] border border-[#30363d] rounded px-2 py-1 text-xs text-[#c9d1d9] font-mono"
                    >
                      {activeSites.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-[#8b949e] font-mono block">Expert:</label>
                    <select
                      value={selectedExpertId}
                      onChange={(e) => setSelectedExpertId(e.target.value)}
                      className="w-full bg-[#0d1117] border border-[#30363d] rounded px-2 py-1 text-xs text-[#c9d1d9] font-mono"
                    >
                      {activeExperts.map((exp) => (
                        <option key={exp.id} value={exp.id}>
                          {exp.name} ({exp.location === 'HQ' ? 'HQ' : exp.location})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-[#8b949e] font-mono block">Domain:</label>
                    <select
                      value={selectedDomain}
                      onChange={(e) => setSelectedDomain(e.target.value as KnowledgeDomain)}
                      className="w-full bg-[#0d1117] border border-[#30363d] rounded px-2 py-1 text-xs text-[#c9d1d9] font-mono"
                    >
                      {DOMAINS.map((d) => (
                        <option key={d} value={d}>
                          {DOMAIN_INFO[d].label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    onClick={() =>
                      onPerformAction('KNOWLEDGE_TRANSFER', {
                        siteId: selectedSiteId,
                        expertId: selectedExpertId,
                        domain: selectedDomain,
                      })
                    }
                    disabled={company.actionsRemaining <= 0}
                    className="w-full py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-mono text-xs font-bold transition shadow-xs"
                  >
                    Execute Transfer (1 Act)
                  </button>
                </div>
              </div>

              {/* 2. Train Expert */}
              <div className="p-3 bg-[#161b22] border border-[#30363d] rounded-lg space-y-2.5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-blue-300 font-mono">
                    <GraduationCap className="w-3.5 h-3.5 text-blue-400" />
                    <span>Train Expert</span>
                  </div>
                  <p className="text-[11px] text-[#8b949e] mt-1">
                    Formal training to advance an expert's domain score by +1. Costs 2d6 turnover.
                  </p>
                </div>

                <div className="space-y-2 text-xs">
                  <div>
                    <label className="text-[10px] text-[#8b949e] font-mono block">Expert:</label>
                    <select
                      value={selectedExpertId}
                      onChange={(e) => setSelectedExpertId(e.target.value)}
                      className="w-full bg-[#0d1117] border border-[#30363d] rounded px-2 py-1 text-xs text-[#c9d1d9] font-mono"
                    >
                      {activeExperts.map((exp) => (
                        <option key={exp.id} value={exp.id}>
                          {exp.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-[#8b949e] font-mono block">Domain:</label>
                    <select
                      value={selectedDomain}
                      onChange={(e) => setSelectedDomain(e.target.value as KnowledgeDomain)}
                      className="w-full bg-[#0d1117] border border-[#30363d] rounded px-2 py-1 text-xs text-[#c9d1d9] font-mono"
                    >
                      {DOMAINS.map((d) => (
                        <option key={d} value={d}>
                          {DOMAIN_INFO[d].label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    onClick={() =>
                      onPerformAction('TRAIN_EXPERT', {
                        expertId: selectedExpertId,
                        domain: selectedDomain,
                      })
                    }
                    disabled={company.actionsRemaining <= 0 || company.turnover < 12}
                    className="w-full py-1.5 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-mono text-xs font-bold transition shadow-xs"
                  >
                    Train Expert (1 Act + 2d6 $)
                  </button>
                </div>
              </div>

              {/* 3. Corporate Training */}
              <div className="p-3 bg-[#161b22] border border-[#30363d] rounded-lg space-y-2.5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-300 font-mono">
                    <Building className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Corporate Training</span>
                  </div>
                  <p className="text-[11px] text-[#8b949e] mt-1">
                    Deploy nationwide curriculum raising Team Capability at all sites (+1) up to the Corporate Intranet score.
                  </p>
                </div>

                <div className="space-y-2 text-xs">
                  <div>
                    <label className="text-[10px] text-[#8b949e] font-mono block">Curriculum Domain:</label>
                    <select
                      value={selectedDomain}
                      onChange={(e) => setSelectedDomain(e.target.value as KnowledgeDomain)}
                      className="w-full bg-[#0d1117] border border-[#30363d] rounded px-2 py-1 text-xs text-[#c9d1d9] font-mono"
                    >
                      {DOMAINS.map((d) => (
                        <option key={d} value={d}>
                          {DOMAIN_INFO[d].label} (Intranet: {company.intranet[d]})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="p-2 bg-[#0d1117] rounded border border-[#30363d] text-[10px] text-[#8b949e]">
                    Boosts absorptive capacity across all sites in {DOMAIN_INFO[selectedDomain].label}!
                  </div>

                  <button
                    onClick={() =>
                      onPerformAction('CORPORATE_TRAINING', {
                        domain: selectedDomain,
                      })
                    }
                    disabled={company.actionsRemaining <= 0}
                    className="w-full py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-mono text-xs font-bold transition shadow-xs"
                  >
                    Deploy Nationwide (1 Act)
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CAPTURE CATEGORY */}
        {activeCategory === 'CAPTURE' && (
          <div className="space-y-3">
            <div className="text-[11px] text-[#8b949e] font-mono">
              // CODIFY & PERSIST OPERATING KNOWLEDGE IN REPOSITORIES
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* 1. Codify Site Knowledge */}
              <div className="p-3 bg-[#161b22] border border-[#30363d] rounded-lg space-y-2.5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-sky-300 font-mono">
                    <BookOpen className="w-3.5 h-3.5 text-sky-400" />
                    <span>Codify Site Knowledge</span>
                  </div>
                  <p className="text-[11px] text-[#8b949e] mt-1">
                    Document local operating knowledge at a site (+1 Local Codified up to Team level).
                  </p>
                </div>

                <div className="space-y-2 text-xs">
                  <div>
                    <label className="text-[10px] text-[#8b949e] font-mono block">Site:</label>
                    <select
                      value={selectedSiteId}
                      onChange={(e) => setSelectedSiteId(e.target.value)}
                      className="w-full bg-[#0d1117] border border-[#30363d] rounded px-2 py-1 text-xs text-[#c9d1d9] font-mono"
                    >
                      {activeSites.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-[#8b949e] font-mono block">Domain:</label>
                    <select
                      value={selectedDomain}
                      onChange={(e) => setSelectedDomain(e.target.value as KnowledgeDomain)}
                      className="w-full bg-[#0d1117] border border-[#30363d] rounded px-2 py-1 text-xs text-[#c9d1d9] font-mono"
                    >
                      {DOMAINS.map((d) => (
                        <option key={d} value={d}>
                          {DOMAIN_INFO[d].label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    onClick={() =>
                      onPerformAction('CODIFY_SITE', {
                        siteId: selectedSiteId,
                        domain: selectedDomain,
                      })
                    }
                    disabled={company.actionsRemaining <= 0}
                    className="w-full py-1.5 rounded bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white font-mono text-xs font-bold transition shadow-xs"
                  >
                    Codify Locally (1 Act)
                  </button>
                </div>
              </div>

              {/* 2. Update Corporate Intranet */}
              <div className="p-3 bg-[#161b22] border border-[#30363d] rounded-lg space-y-2.5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-purple-300 font-mono">
                    <Building className="w-3.5 h-3.5 text-purple-400" />
                    <span>Update Corporate Intranet</span>
                  </div>
                  <p className="text-[11px] text-[#8b949e] mt-1">
                    Aggregate company knowledge into corporate intranet (+1 normal, +2 if HQ expert).
                  </p>
                </div>

                <div className="space-y-2 text-xs">
                  <div>
                    <label className="text-[10px] text-[#8b949e] font-mono block">Domain:</label>
                    <select
                      value={selectedDomain}
                      onChange={(e) => setSelectedDomain(e.target.value as KnowledgeDomain)}
                      className="w-full bg-[#0d1117] border border-[#30363d] rounded px-2 py-1 text-xs text-[#c9d1d9] font-mono"
                    >
                      {DOMAINS.map((d) => (
                        <option key={d} value={d}>
                          {DOMAIN_INFO[d].label} (Current: {company.intranet[d]})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="p-2 bg-[#0d1117] rounded border border-[#30363d] text-[10px] text-[#8b949e]">
                    {company.experts.some((e) => !e.isVacant && e.location === 'HQ' && e.domains.some((dm) => dm.domain === selectedDomain))
                      ? '⚡ HQ expert available: Grants +2 boost!'
                      : 'Standard update: +1 growth'}
                  </div>

                  <button
                    onClick={() =>
                      onPerformAction('UPDATE_INTRANET', {
                        domain: selectedDomain,
                      })
                    }
                    disabled={company.actionsRemaining <= 0 || (company.intranetRoundGrowth[selectedDomain] || 0) >= 2}
                    className="w-full py-1.5 rounded bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-mono text-xs font-bold transition shadow-xs"
                  >
                    Update Repository (1 Act)
                  </button>
                </div>
              </div>

              {/* 3. After Action Review / Lessons Learned */}
              <div className="p-3 bg-[#161b22] border border-[#30363d] rounded-lg space-y-2.5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300 font-mono">
                    <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                    <span>After Action Review (AAR)</span>
                  </div>
                  <p className="text-[11px] text-[#8b949e] mt-1">
                    Conduct deliberate post-event reflection to convert event experience into +1 capability.
                  </p>
                </div>

                <div className="space-y-2 text-xs">
                  <div>
                    <label className="text-[10px] text-[#8b949e] font-mono block">Site:</label>
                    <select
                      value={selectedSiteId}
                      onChange={(e) => setSelectedSiteId(e.target.value)}
                      className="w-full bg-[#0d1117] border border-[#30363d] rounded px-2 py-1 text-xs text-[#c9d1d9] font-mono"
                    >
                      {activeSites.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-[#8b949e] font-mono block">Target:</label>
                    <select
                      value={selectedLearningTarget}
                      onChange={(e) => setSelectedLearningTarget(e.target.value as any)}
                      className="w-full bg-[#0d1117] border border-[#30363d] rounded px-2 py-1 text-xs text-[#c9d1d9] font-mono"
                    >
                      <option value="team">Team Capability (+1)</option>
                      <option value="codified">Local Codified (+1)</option>
                    </select>
                  </div>

                  <button
                    onClick={() =>
                      onPerformAction('LESSONS_LEARNED', {
                        siteId: selectedSiteId,
                        domain: selectedDomain,
                        learningTarget: selectedLearningTarget,
                      })
                    }
                    disabled={company.actionsRemaining <= 0}
                    className="w-full py-1.5 rounded bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white font-mono text-xs font-bold transition shadow-xs"
                  >
                    Conduct AAR (1 Act)
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CONNECT CATEGORY */}
        {activeCategory === 'CONNECT' && (
          <div className="space-y-3">
            <div className="text-[11px] text-[#8b949e] font-mono">
              // INTER-FIRM SOCIAL CAPITAL & STRATEGIC HORIZON SCANNING
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* 1. Join / Maintain CoP */}
              <div className="p-3 bg-[#161b22] border border-[#30363d] rounded-lg space-y-2.5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300 font-mono">
                    <Network className="w-3.5 h-3.5 text-amber-400" />
                    <span>Join Community of Practice</span>
                  </div>
                  <p className="text-[11px] text-[#8b949e] mt-1">
                    Assign a Deep Expert to an industry CoP (Fee 1d6 $). Active when ≥2 companies participate.
                  </p>
                </div>

                <div className="space-y-2 text-xs">
                  <div>
                    <label className="text-[10px] text-[#8b949e] font-mono block">Expert:</label>
                    <select
                      value={selectedExpertId}
                      onChange={(e) => setSelectedExpertId(e.target.value)}
                      className="w-full bg-[#0d1117] border border-[#30363d] rounded px-2 py-1 text-xs text-[#c9d1d9] font-mono"
                    >
                      {activeExperts.map((exp) => (
                        <option key={exp.id} value={exp.id}>
                          {exp.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-[#8b949e] font-mono block">Domain:</label>
                    <select
                      value={selectedDomain}
                      onChange={(e) => setSelectedDomain(e.target.value as KnowledgeDomain)}
                      className="w-full bg-[#0d1117] border border-[#30363d] rounded px-2 py-1 text-xs text-[#c9d1d9] font-mono"
                    >
                      {DOMAINS.map((d) => (
                        <option key={d} value={d}>
                          {DOMAIN_INFO[d].label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    onClick={() =>
                      onPerformAction('JOIN_COP', {
                        expertId: selectedExpertId,
                        domain: selectedDomain,
                      })
                    }
                    disabled={company.actionsRemaining <= 0 || company.turnover < 6}
                    className="w-full py-1.5 rounded bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white font-mono text-xs font-bold transition shadow-xs"
                  >
                    Assign to CoP (1 Act + 1d6 $)
                  </button>
                </div>
              </div>

              {/* 2. Capture CoP Learning */}
              <div className="p-3 bg-[#161b22] border border-[#30363d] rounded-lg space-y-2.5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-sky-300 font-mono">
                    <BookOpen className="w-3.5 h-3.5 text-sky-400" />
                    <span>Capture CoP Learning</span>
                  </div>
                  <p className="text-[11px] text-[#8b949e] mt-1">
                    Convert relational insights from partner companies in active CoP into permanent intranet knowledge (+1).
                  </p>
                </div>

                <div className="space-y-2 text-xs">
                  <div>
                    <label className="text-[10px] text-[#8b949e] font-mono block">CoP Domain:</label>
                    <select
                      value={selectedDomain}
                      onChange={(e) => setSelectedDomain(e.target.value as KnowledgeDomain)}
                      className="w-full bg-[#0d1117] border border-[#30363d] rounded px-2 py-1 text-xs text-[#c9d1d9] font-mono"
                    >
                      {DOMAINS.map((d) => (
                        <option key={d} value={d}>
                          {DOMAIN_INFO[d].label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    onClick={() =>
                      onPerformAction('CAPTURE_COP_LEARNING', {
                        domain: selectedDomain,
                        learningTarget: 'intranet',
                      })
                    }
                    disabled={company.actionsRemaining <= 0}
                    className="w-full py-1.5 rounded bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white font-mono text-xs font-bold transition shadow-xs"
                  >
                    Capture into Intranet (1 Act)
                  </button>
                </div>
              </div>

              {/* 3. Horizon Scanning */}
              <div className="p-3 bg-[#161b22] border border-[#30363d] rounded-lg space-y-2.5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-300 font-mono">
                    <Radio className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Horizon Scanning Radar</span>
                  </div>
                  <p className="text-[11px] text-[#8b949e] mt-1">
                    Scout emerging trends. If a drawn event next round matches the scanned domain, you may redraw it once!
                  </p>
                </div>

                <div className="space-y-2 text-xs">
                  <div>
                    <label className="text-[10px] text-[#8b949e] font-mono block">Domain to Scout:</label>
                    <select
                      value={selectedDomain}
                      onChange={(e) => setSelectedDomain(e.target.value as KnowledgeDomain)}
                      className="w-full bg-[#0d1117] border border-[#30363d] rounded px-2 py-1 text-xs text-[#c9d1d9] font-mono"
                    >
                      {DOMAINS.map((d) => (
                        <option key={d} value={d}>
                          {DOMAIN_INFO[d].label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    onClick={() =>
                      onPerformAction('HORIZON_SCAN', {
                        domain: selectedDomain,
                      })
                    }
                    disabled={company.actionsRemaining <= 0}
                    className="w-full py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-mono text-xs font-bold transition shadow-xs"
                  >
                    Activate Radar (1 Act)
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* EMBED CATEGORY */}
        {activeCategory === 'EMBED' && (
          <div className="space-y-3">
            <div className="text-[11px] text-[#8b949e] font-mono">
              // EMBED CAPABILITY INTO ENTERPRISE AUTOMATION & WORKFLOWS
            </div>

            <div className="p-3.5 bg-[#161b22] border border-emerald-500/40 rounded-lg space-y-2.5 max-w-xl">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs font-mono">
                <Cpu className="w-4 h-4" />
                <span>ENTERPRISE DOMAIN AUTOMATION</span>
              </div>
              <p className="text-[11px] text-[#c9d1d9] leading-relaxed">
                Automation embeds knowledge permanently into enterprise software workflows.
                It provides <strong className="text-emerald-300 font-mono">+2 event support permanently across all 6 sites</strong> and survives employee attrition.
              </p>
              <div className="p-2 bg-[#0d1117] rounded text-[10px] text-amber-300 border border-amber-800/60 font-mono">
                <strong>CAPITAL_INVESTMENT:</strong> Costs 1d6 turnover from <em>every active site</em>.
              </div>

              <div className="flex items-center gap-2.5 pt-1">
                <select
                  value={selectedDomain}
                  onChange={(e) => setSelectedDomain(e.target.value as KnowledgeDomain)}
                  className="bg-[#0d1117] border border-[#30363d] rounded px-2.5 py-1.5 text-xs text-[#c9d1d9] font-mono"
                >
                  {DOMAINS.map((d) => (
                    <option key={d} value={d} disabled={company.automatedDomains.includes(d)}>
                      {DOMAIN_INFO[d].label} {company.automatedDomains.includes(d) ? '(Already Automated)' : ''}
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => onPerformAction('AUTOMATE', { domain: selectedDomain })}
                  disabled={company.actionsRemaining <= 0 || company.automatedDomains.includes(selectedDomain)}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold font-mono rounded transition shadow-xs"
                >
                  Automate Domain (1 Act + Cost)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* DIAGNOSE CATEGORY */}
        {activeCategory === 'DIAGNOSE' && (
          <div className="space-y-3">
            <div className="text-[11px] text-[#8b949e] font-mono">
              // FORENSIC AUDIT & ABSORPTIVE BOTTLENECK DISCOVERY
            </div>

            <div className="p-3.5 bg-[#161b22] border border-purple-500/40 rounded-lg space-y-2.5 max-w-xl">
              <div className="flex items-center gap-2 text-purple-400 font-bold text-xs font-mono">
                <Info className="w-4 h-4" />
                <span>SITE KNOWLEDGE AUDIT</span>
              </div>
              <p className="text-[11px] text-[#c9d1d9] leading-relaxed">
                Conducts a forensic audit of an operating site to reveal its weakest capability, largest expert-to-site SPOF gap, uncodified processes, and absorptive capacity bottlenecks.
              </p>

              <div className="flex items-center gap-2.5 pt-1">
                <select
                  value={selectedSiteId}
                  onChange={(e) => setSelectedSiteId(e.target.value)}
                  className="bg-[#0d1117] border border-[#30363d] rounded px-2.5 py-1.5 text-xs text-[#c9d1d9] font-mono"
                >
                  {activeSites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} Site
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => onPerformAction('KNOWLEDGE_AUDIT', { siteId: selectedSiteId })}
                  disabled={company.actionsRemaining <= 0}
                  className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-xs font-bold font-mono rounded transition shadow-xs"
                >
                  Audit Site (1 Act)
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
