import React from 'react';
import { GameSession, Company, GamePhase, Participant } from '../types/game.ts';
import { formatCurrency, formatDeltaCurrency } from '../utils/format.ts';
import { GameTimer } from './GameTimer.tsx';
import {
  TrendingUp,
  Zap,
  ShieldAlert,
  Users,
  Compass,
  Award,
  Radio,
  BookOpen,
  ChevronRight,
  Sparkles,
  Sliders,
  DollarSign,
  Building2
} from 'lucide-react';

interface HeaderProps {
  session: GameSession;
  activeCompany: Company;
  participant: Participant | null;
  onSelectCompany: (companyId: string) => void;
  onOpenFacilitator: () => void;
  onOpenAAR: () => void;
  onOpenCoP: () => void;
  onAdvancePhase: () => void;
  isFacilitator: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  session,
  activeCompany,
  participant,
  onSelectCompany,
  onOpenFacilitator,
  onOpenAAR,
  onOpenCoP,
  onAdvancePhase,
  isFacilitator,
}) => {
  if (!activeCompany) return null;

  const turnoverDelta = activeCompany.turnover - activeCompany.startingTurnover;
  const activeSPOFs = activeCompany.experts.filter((e) => !e.isVacant && e.isSPOF).length;

  return (
    <header className="bg-[#161b22] border-b border-[#30363d] text-[#c9d1d9] sticky top-0 z-40 shadow-md">
      <div className="max-w-7xl mx-auto px-3 sm:px-5 py-2 flex flex-col md:flex-row items-center justify-between gap-2.5">
        {/* Left: Brand & Company Identity */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-black text-white shadow-sm text-xs tracking-tighter">
              KM
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-sm sm:text-base tracking-tight text-white">The Performance Gap</h1>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#0d1117] text-indigo-400 border border-[#30363d]">
                  {session.id}
                </span>
              </div>
              <p className="text-[10px] text-[#8b949e]">Knowledge, Deep Expertise & Resilience Engine</p>
            </div>
          </div>

          {/* Explicit Company Representation Selector */}
          <div className="flex items-center gap-1.5 bg-[#0d1117] px-2.5 py-1 rounded-lg border border-[#30363d]">
            <Building2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <div className="flex flex-col">
              <span className="text-[8px] uppercase font-mono font-bold text-[#8b949e] leading-none">Your Enterprise</span>
              <select
                value={activeCompany.id}
                onChange={(e) => onSelectCompany(e.target.value)}
                className="bg-transparent text-xs font-semibold text-white focus:outline-hidden font-sans cursor-pointer pr-1"
              >
                {session.companies.map((c) => (
                  <option key={c.id} value={c.id} className="bg-[#161b22] text-white">
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Center: 50-Minute Simulation Countdown Clock & Vital Stats */}
        <div className="flex items-center flex-wrap justify-center gap-2 w-full md:w-auto">
          {/* 50-Minute Game Timer */}
          <GameTimer isFacilitator={true} />

          {/* Enterprise Turnover Metric */}
          <div className="bg-[#0d1117] border border-[#30363d] rounded-lg px-2.5 py-1 flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-emerald-950/60 border border-emerald-800/60 flex items-center justify-center text-emerald-400">
              <DollarSign className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="text-[9px] uppercase font-bold text-[#8b949e] tracking-widest leading-none">Turnover</div>
              <div className="flex items-baseline gap-1 font-mono mt-0.5">
                <span className="text-xs font-bold text-white">{formatCurrency(activeCompany.turnover)}</span>
                <span
                  className={`text-[9.5px] font-semibold ${
                    turnoverDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {formatDeltaCurrency(turnoverDelta)}
                </span>
              </div>
            </div>
          </div>

          {/* Actions Remaining */}
          <div className="bg-[#0d1117] border border-[#30363d] rounded-lg px-2.5 py-1 flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-indigo-950/60 border border-indigo-800/60 flex items-center justify-center text-indigo-400">
              <Zap className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="text-[9px] uppercase font-bold text-[#8b949e] tracking-widest leading-none">Actions</div>
              <div className="flex items-center gap-1 mt-0.5">
                {[1, 2, 3, 4].map((idx) => (
                  <span
                    key={idx}
                    className={`w-1.5 h-2.5 rounded-xs transition-all ${
                      idx <= activeCompany.actionsRemaining
                        ? 'bg-indigo-500 shadow-xs'
                        : 'bg-[#30363d] opacity-50'
                    }`}
                  />
                ))}
                <span className="text-xs font-mono font-bold text-indigo-400 ml-0.5">
                  {activeCompany.actionsRemaining}/4
                </span>
              </div>
            </div>
          </div>

          {/* SPOF Alert Badge */}
          {activeSPOFs > 0 && (
            <div className="bg-amber-900/30 border border-amber-800/60 text-amber-300 rounded-lg px-2 py-1 flex items-center gap-1.5 text-xs animate-pulse">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
              <span className="font-bold text-[10px] uppercase font-mono">{activeSPOFs} SPOF Risk</span>
            </div>
          )}
        </div>

        {/* Right: Facilitator, CoPs & After Action Review */}
        <div className="flex items-center gap-1.5 w-full md:w-auto justify-end">
          {/* Communities of Practice */}
          <button
            onClick={onOpenCoP}
            className="flex items-center gap-1 px-2 py-1 rounded-md bg-[#21262d] hover:bg-[#30363d] text-[#c9d1d9] hover:text-white text-xs font-semibold border border-[#30363d] transition"
            title="Communities of Practice (Cross-company network)"
          >
            <Users className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">CoPs</span>
            {session.copMemberships.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-mono">
                {session.copMemberships.length}
              </span>
            )}
          </button>

          {/* AAR Debrief Button */}
          <button
            onClick={onOpenAAR}
            className="flex items-center gap-1 px-2 py-1 rounded-md bg-[#21262d] hover:bg-[#30363d] text-[#c9d1d9] hover:text-white text-xs font-semibold border border-[#30363d] transition"
            title="After Action Review & Debrief"
          >
            <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden sm:inline">AAR Debrief</span>
          </button>

          {/* Facilitator Master Panel */}
          <button
            onClick={onOpenFacilitator}
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold border transition ${
              isFacilitator
                ? 'bg-purple-900/30 border-purple-700/60 text-purple-300 hover:bg-purple-900/50'
                : 'bg-[#21262d] border-[#30363d] text-[#c9d1d9] hover:text-white hover:bg-[#30363d]'
            }`}
            title="Facilitator Master Controls"
          >
            <Sliders className="w-3.5 h-3.5 text-purple-400" />
            <span className="hidden sm:inline">Facilitator</span>
          </button>
        </div>
      </div>
    </header>
  );
};


