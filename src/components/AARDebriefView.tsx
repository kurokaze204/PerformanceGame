import React from 'react';
import { GameSession, Company, DOMAIN_INFO } from '../types/game.ts';
import {
  BookOpen,
  TrendingUp,
  ShieldCheck,
  Building2,
  Users,
  Cpu,
  Radio,
  Network,
  ArrowLeft,
  Award,
  Flame
} from 'lucide-react';

interface AARDebriefViewProps {
  session: GameSession;
  company: Company;
  onClose: () => void;
}

export const AARDebriefView: React.FC<AARDebriefViewProps> = ({
  session,
  company,
  onClose,
}) => {
  const KNOWLEDGE_FORMS = [
    {
      form: 'Deep Expert',
      icon: Users,
      color: 'text-blue-400',
      strength: 'High depth, agile judgement and experience',
      limitation: 'Scarce, mobile, and fragile Single Point of Failure',
    },
    {
      form: 'Team Capability',
      icon: Users,
      color: 'text-indigo-400',
      strength: 'Available at point of work; determines absorptive capacity',
      limitation: 'Strictly local and costly to develop',
    },
    {
      form: 'Local Codified Knowledge',
      icon: BookOpen,
      color: 'text-sky-400',
      strength: 'Persistent through employee departure; highly contextual',
      limitation: 'Limited reach beyond the originating site',
    },
    {
      form: 'Corporate Intranet',
      icon: Building2,
      color: 'text-purple-400',
      strength: 'Persistent and organization-wide',
      limitation: 'Sites need local capability to absorb and use it',
    },
    {
      form: 'Community of Practice (CoP)',
      icon: Network,
      color: 'text-amber-400',
      strength: 'Low-cost access to expertise beyond organizational boundary',
      limitation: 'Requires sustained cross-company relationship investment',
    },
    {
      form: 'Automation',
      icon: Cpu,
      color: 'text-emerald-400',
      strength: 'Persistent, scalable, reliable nationwide',
      limitation: 'Expensive capital investment; less adaptable to edge cases',
    },
    {
      form: 'Horizon Scanning',
      icon: Radio,
      color: 'text-orange-400',
      strength: 'Creates warning, response time, and strategic options',
      limitation: 'Does not create knowledge capability itself',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-[#0a0c10]/90 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl max-w-4xl w-full h-[90vh] flex flex-col shadow-2xl overflow-hidden text-[#c9d1d9]">
        {/* Header */}
        <div className="p-4 border-b border-[#30363d] flex items-center justify-between bg-[#0d1117]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#21262d] border border-[#30363d] flex items-center justify-center text-blue-400 font-bold shadow-inner">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight font-mono">AFTER ACTION REVIEW & LEARNING DEBRIEF</h2>
              <p className="text-[11px] text-[#8b949e]">Knowledge, Expertise and Organisational Resilience Analysis</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#21262d] hover:bg-[#30363d] text-xs font-mono font-bold text-[#c9d1d9] hover:text-white transition border border-[#30363d]"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>RETURN TO GAME</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Executive Tension Box */}
          <div className="p-4 bg-[#0d1117] border border-indigo-500/30 rounded-lg space-y-2">
            <h3 className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider font-mono">
              THE STRATEGIC TENSION
            </h3>
            <p className="text-xs text-[#c9d1d9] leading-relaxed italic">
              "The objective is not to maximise knowledge. It is to build appropriate knowledge capability at an acceptable cost. Effective knowledge strategy balances current production against future production capacity and resilience."
            </p>
          </div>

          {/* 6 Forms of Knowledge Model Table */}
          <div className="space-y-2">
            <h3 className="text-[10px] font-bold text-[#8b949e] uppercase tracking-wider font-mono">
              Central Learning Model: The Forms of Knowledge
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#30363d] text-[#8b949e] uppercase font-mono text-[10px]">
                    <th className="pb-2 pl-2">Mechanism</th>
                    <th className="pb-2">Main Strength</th>
                    <th className="pb-2 pr-2">Main Limitation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#30363d]/60 text-[11px]">
                  {KNOWLEDGE_FORMS.map((k, idx) => {
                    const Icon = k.icon;
                    return (
                      <tr key={idx} className="hover:bg-[#21262d]/40 transition">
                        <td className="py-2.5 pl-2 flex items-center gap-2 font-bold text-white font-mono">
                          <Icon className={`w-3.5 h-3.5 ${k.color}`} />
                          <span>{k.form}</span>
                        </td>
                        <td className="py-2.5 text-[#c9d1d9]">{k.strength}</td>
                        <td className="py-2.5 pr-2 text-[#8b949e]">{k.limitation}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Key Principles Breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            <div className="p-3 bg-[#0d1117] rounded-lg border border-[#30363d] space-y-1 text-xs">
              <strong className="text-indigo-300 font-mono text-[11px]">1. ACCESS ≠ CAPABILITY</strong>
              <p className="text-[#8b949e] text-[11px] leading-relaxed">
                Having level-6 knowledge in the Corporate Intranet does not mean a weak site can use it. Local absorptive capacity sets the operational ceiling.
              </p>
            </div>

            <div className="p-3 bg-[#0d1117] rounded-lg border border-[#30363d] space-y-1 text-xs">
              <strong className="text-amber-300 font-mono text-[11px]">2. EXPERTISE IS FRAGILE</strong>
              <p className="text-[#8b949e] text-[11px] leading-relaxed">
                Deep Experts solve tough challenges, but when concentrated as Single Points of Failure, their loss permanently destroys uncodified institutional capability.
              </p>
            </div>

            <div className="p-3 bg-[#0d1117] rounded-lg border border-[#30363d] space-y-1 text-xs">
              <strong className="text-sky-300 font-mono text-[11px]">3. REFLECTION CREATES LEARNING</strong>
              <p className="text-[#8b949e] text-[11px] leading-relaxed">
                Operational failure or raw experience does not automatically generate knowledge. Deliberate After Action Review reflection converts events into capability.
              </p>
            </div>

            <div className="p-3 bg-[#0d1117] rounded-lg border border-[#30363d] space-y-1 text-xs">
              <strong className="text-emerald-300 font-mono text-[11px]">4. RELATIONSHIPS VS OWNERSHIP</strong>
              <p className="text-[#8b949e] text-[11px] leading-relaxed">
                Communities of Practice grant access to scarce industry expertise without fixed balance sheet overhead, but require continuous investment to remain active.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
