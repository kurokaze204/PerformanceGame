import React, { useEffect, useMemo, useState } from 'react';
import { Clock, Pause, Play, RotateCcw } from 'lucide-react';
import type { GameSessionV2 } from '../types/gameV2.ts';

interface SharedGameTimerProps {
  session: GameSessionV2;
  isFacilitator?: boolean;
  onSessionUpdate?: (session: GameSessionV2) => void;
}

function secondsFromSession(session: GameSessionV2): number {
  if (session.timerEndsAt) {
    return Math.max(0, Math.ceil((new Date(session.timerEndsAt).getTime() - Date.now()) / 1000));
  }
  return session.timerPausedSecondsRemaining ?? 50 * 60;
}

export const SharedGameTimer: React.FC<SharedGameTimerProps> = ({ session, isFacilitator = false, onSessionUpdate }) => {
  const [remaining, setRemaining] = useState(() => secondsFromSession(session));

  useEffect(() => {
    setRemaining(secondsFromSession(session));
    if (!session.timerEndsAt) return;
    const id = window.setInterval(() => setRemaining(secondsFromSession(session)), 1000);
    return () => window.clearInterval(id);
  }, [session.timerEndsAt, session.timerPausedSecondsRemaining]);

  const isRunning = !!session.timerEndsAt;
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const tone = useMemo(() => remaining <= 5 * 60 ? 'rose' : remaining <= 10 * 60 ? 'amber' : 'emerald', [remaining]);

  const command = async (action: 'start' | 'pause' | 'reset') => {
    const res = await fetch(`/api/sessions/${session.id}/timer/${action}`, { method: 'POST' });
    if (!res.ok) return;
    const updated = await res.json();
    onSessionUpdate?.(updated);
  };

  const toneClasses = tone === 'rose'
    ? 'bg-rose-950/70 border-rose-500 text-rose-100'
    : tone === 'amber'
      ? 'bg-amber-950/70 border-amber-500 text-amber-100'
      : 'bg-slate-900/90 border-emerald-500/70 text-white';

  return (
    <div className={`flex items-center gap-3 rounded-2xl border-2 px-4 py-2 shadow-lg ${toneClasses}`}>
      <Clock className={`w-5 h-5 ${tone === 'rose' ? 'animate-pulse' : ''}`} />
      <div className="leading-none">
        <div className="text-[10px] uppercase tracking-[0.16em] opacity-70 font-bold">Game time</div>
        <div className="text-2xl font-black tabular-nums mt-1">{String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}</div>
      </div>
      {isFacilitator && (
        <div className="flex gap-1 pl-2 border-l border-white/15">
          <button className="p-2 rounded-full hover:bg-white/10" onClick={() => command(isRunning ? 'pause' : 'start')} title={isRunning ? 'Pause shared timer' : 'Start shared timer'}>
            {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
          <button className="p-2 rounded-full hover:bg-white/10" onClick={() => command('reset')} title="Reset to 50 minutes">
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
