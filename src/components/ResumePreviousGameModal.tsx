import React from 'react';
import { ArrowRight, History, PlusCircle } from 'lucide-react';
import type { Participant } from '../types/game.ts';
import type { GameSessionV2 } from '../types/gameV2.ts';

interface Props {
  session: GameSessionV2;
  participant: Participant;
  onContinue: () => void;
  onStartNew: () => void;
}

export const ResumePreviousGameModal: React.FC<Props> = ({ session, participant, onContinue, onStartNew }) => {
  const company = session.companies.find(candidate => candidate.id === participant.companyId);
  return <div className="fixed inset-0 z-[510] grid place-items-center bg-[#080b12]/95 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="resume-game-title">
    <div className="w-full max-w-xl rounded-3xl border-2 border-indigo-600 bg-slate-950 p-6 shadow-2xl md:p-8">
      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.18em] text-indigo-300"><History className="h-4 w-4"/>Previous game found</div>
      <h2 id="resume-game-title" className="mt-2 text-3xl font-black text-white">You were playing a game previously.</h2>
      <p className="mt-3 text-base leading-relaxed text-slate-300">Would you like to continue where you left off, or start a new game?</p>

      <div className="mt-5 rounded-2xl border border-slate-700 bg-slate-900/80 p-4">
        <div className="text-[10px] font-black uppercase tracking-[.15em] text-slate-500">Previous game</div>
        <div className="mt-1 text-lg font-black text-white">{company?.name || session.title || 'The Performance Gap'}</div>
        <div className="mt-1 text-xs text-slate-400">Game <b className="text-indigo-300">{session.id}</b> · Round {session.round}</div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <button type="button" onClick={onContinue} className="rounded-2xl border-2 border-emerald-600 bg-emerald-700 px-4 py-4 text-left text-white hover:bg-emerald-600">
          <div className="flex items-center justify-between gap-3"><b className="text-base">Continue previous game</b><ArrowRight className="h-5 w-5"/></div>
          <div className="mt-1 text-xs text-emerald-100/80">Return to the game at its current point.</div>
        </button>
        <button type="button" onClick={onStartNew} className="rounded-2xl border-2 border-slate-600 bg-slate-900 px-4 py-4 text-left text-white hover:border-indigo-400">
          <div className="flex items-center justify-between gap-3"><b className="text-base">Start a new game</b><PlusCircle className="h-5 w-5 text-indigo-300"/></div>
          <div className="mt-1 text-xs text-slate-400">Return to the start screen and choose how to play.</div>
        </button>
      </div>
    </div>
  </div>;
};
