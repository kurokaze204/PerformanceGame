import React from 'react';
import { GamePhase } from '../types/game.ts';
import {
  Sparkles,
  Dices,
  TrendingUp,
  Zap,
  ShieldAlert,
  ChevronRight,
  CheckCircle2
} from 'lucide-react';

interface TurnPhaseGuideProps {
  round: number;
  maxRounds: number;
  currentPhase: GamePhase;
  actionsRemaining: number;
  activeEventsCount: number;
  resolvedEventsCount: number;
  onSelectPhaseView: (view: 'events' | 'actions' | 'consequences' | 'attrition' | 'map') => void;
  onAdvancePhase: () => void;
  isFacilitator?: boolean;
}

export const TurnPhaseGuide: React.FC<TurnPhaseGuideProps> = ({
  round,
  maxRounds,
  currentPhase,
  actionsRemaining,
  activeEventsCount,
  resolvedEventsCount,
  onSelectPhaseView,
  onAdvancePhase,
}) => {
  const PHASES: {
    id: GamePhase;
    step: number;
    title: string;
    actionLabel: string;
    instruction: string;
    icon: any;
    targetView: 'events' | 'actions' | 'consequences' | 'attrition';
  }[] = [
    {
      id: 'events',
      step: 1,
      title: 'Events Drawn',
      actionLabel: 'Inspect Events',
      instruction: `Review the ${activeEventsCount} challenges or opportunities drawn this round. Use Horizon Scanning redraw if domain matches.`,
      icon: Sparkles,
      targetView: 'events',
    },
    {
      id: 'respond',
      step: 2,
      title: 'Respond & Roll',
      actionLabel: 'Resolve Events',
      instruction: 'Assign available Deep Experts or seek CoP peer assistance to satisfy minimum domain knowledge, then roll dice.',
      icon: Dices,
      targetView: 'events',
    },
    {
      id: 'consequences',
      step: 3,
      title: 'Consequences',
      actionLabel: 'Claim Learning',
      instruction: 'Observe turnover gains or losses. Convert successful opportunities into experiential learning for your team or experts.',
      icon: TrendingUp,
      targetView: 'consequences',
    },
    {
      id: 'investment',
      step: 4,
      title: 'Invest Actions',
      actionLabel: `Invest (${actionsRemaining}/4)`,
      instruction: `Spend your 4 strategic actions to build capability: develop teams, train experts, codify knowledge, or embed systems.`,
      icon: Zap,
      targetView: 'actions',
    },
    {
      id: 'risk',
      step: 5,
      title: 'Knowledge Risk',
      actionLabel: 'Review Attrition',
      instruction: 'Check if high-risk Single Points of Failure (SPOFs) or general workforce attrition caused critical knowledge loss.',
      icon: ShieldAlert,
      targetView: 'attrition',
    },
  ];

  const currentPhaseIndex = PHASES.findIndex((p) => p.id === currentPhase);
  const activePhaseConfig = PHASES[currentPhaseIndex] || PHASES[0];

  return (
    <div id="turn-phase-central-guide" className="w-full bg-[#161b22] border border-[#30363d] rounded-xl p-3.5 shadow-md space-y-3">
      {/* 5-Step Visual Pipeline */}
      <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
        {PHASES.map((p, idx) => {
          const Icon = p.icon;
          const isCurrent = p.id === currentPhase;
          const isCompleted = idx < currentPhaseIndex;
          const isPending = idx > currentPhaseIndex;

          return (
            <button
              key={p.id}
              onClick={() => onSelectPhaseView(p.targetView)}
              className={`relative flex flex-col items-center justify-center p-2 rounded-lg border text-center transition-all ${
                isCurrent
                  ? 'bg-indigo-950/70 border-indigo-500 ring-2 ring-indigo-500/40 text-white shadow-md'
                  : isCompleted
                  ? 'bg-[#0d1117] border-emerald-900/60 text-[#8b949e] hover:border-emerald-500 hover:text-[#c9d1d9]'
                  : 'bg-[#0d1117]/60 border-[#30363d] text-[#6e7681] hover:text-[#c9d1d9]'
              }`}
            >
              <div className="flex items-center gap-1 mb-0.5">
                <span className={`text-[10px] font-mono font-bold ${isCurrent ? 'text-indigo-400' : isCompleted ? 'text-emerald-400' : 'text-[#6e7681]'}`}>
                  {isCompleted ? <CheckCircle2 className="w-3 h-3 text-emerald-400 inline" /> : `PHASE ${p.step}`}
                </span>
              </div>
              <div className="flex items-center gap-1 font-bold text-xs truncate max-w-full">
                <Icon className={`w-3.5 h-3.5 shrink-0 ${isCurrent ? 'text-indigo-400 animate-pulse' : isCompleted ? 'text-emerald-400' : 'text-[#6e7681]'}`} />
                <span className="hidden sm:inline truncate">{p.title}</span>
              </div>
              {isCurrent && (
                <span className="absolute -bottom-1 w-2 h-2 rotate-45 bg-indigo-500 rounded-xs" />
              )}
            </button>
          );
        })}
      </div>

      {/* Prominent "What Do I Do Next?" Directive Banner */}
      <div className="bg-[#0d1117] border border-[#30363d] rounded-lg p-3 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/50 flex items-center justify-center text-indigo-400 shrink-0 mt-0.5">
            <activePhaseConfig.icon className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-950 border border-indigo-800 text-indigo-300">
                CURRENT TASK • PHASE {activePhaseConfig.step}: {activePhaseConfig.title.toUpperCase()}
              </span>
              <span className="text-xs font-semibold text-[#8b949e]">Round {round}/{maxRounds}</span>
            </div>
            <p className="text-xs font-medium text-white mt-1 leading-snug">
              {activePhaseConfig.instruction}
            </p>
          </div>
        </div>

        {/* Action Button for Current Phase */}
        <div className="flex items-center gap-2 self-end md:self-center">
          <button
            onClick={() => onSelectPhaseView(activePhaseConfig.targetView)}
            className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md flex items-center gap-1.5 transition active:scale-95"
          >
            <span>{activePhaseConfig.actionLabel}</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
          
          <button
            onClick={onAdvancePhase}
            title="Advance to Next Phase"
            className="px-3 py-2 rounded-lg bg-[#21262d] hover:bg-[#30363d] text-[#c9d1d9] hover:text-white text-xs font-semibold border border-[#30363d] transition flex items-center gap-1"
          >
            <span>Next Phase</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
