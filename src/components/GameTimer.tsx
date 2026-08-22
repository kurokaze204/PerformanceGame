import React, { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, Clock } from 'lucide-react';

interface GameTimerProps {
  initialSeconds?: number;
  isFacilitator?: boolean;
  onTimeExpired?: () => void;
}

export const GameTimer: React.FC<GameTimerProps> = ({
  initialSeconds = 50 * 60, // 50 minutes default
  isFacilitator = false,
  onTimeExpired,
}) => {
  const [secondsRemaining, setSecondsRemaining] = useState<number>(() => {
    const saved = localStorage.getItem('tpg_timer_seconds');
    return saved ? parseInt(saved, 10) : initialSeconds;
  });
  const [isRunning, setIsRunning] = useState<boolean>(() => {
    return localStorage.getItem('tpg_timer_running') === 'true';
  });

  useEffect(() => {
    let interval: any = null;
    if (isRunning && secondsRemaining > 0) {
      interval = setInterval(() => {
        setSecondsRemaining((prev) => {
          const next = prev - 1;
          localStorage.setItem('tpg_timer_seconds', next.toString());
          if (next <= 0) {
            setIsRunning(false);
            localStorage.setItem('tpg_timer_running', 'false');
            if (onTimeExpired) onTimeExpired();
            return 0;
          }
          return next;
        });
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isRunning, secondsRemaining, onTimeExpired]);

  const toggleTimer = () => {
    const nextState = !isRunning;
    setIsRunning(nextState);
    localStorage.setItem('tpg_timer_running', nextState.toString());
  };

  const resetTimer = () => {
    setIsRunning(false);
    setSecondsRemaining(initialSeconds);
    localStorage.setItem('tpg_timer_seconds', initialSeconds.toString());
    localStorage.setItem('tpg_timer_running', 'false');
  };

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const isUrgent = secondsRemaining < 10 * 60; // < 10 mins
  const isCritical = secondsRemaining < 5 * 60; // < 5 mins

  return (
    <div
      id="game-timer-container"
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border font-mono transition-all ${
        isCritical
          ? 'bg-rose-950/60 border-rose-600 text-rose-300 animate-pulse ring-1 ring-rose-500'
          : isUrgent
          ? 'bg-amber-950/50 border-amber-600 text-amber-300'
          : 'bg-[#0d1117] border-[#30363d] text-emerald-400'
      }`}
    >
      <Clock className={`w-4 h-4 ${isCritical ? 'text-rose-400 animate-spin' : isUrgent ? 'text-amber-400' : 'text-emerald-400'}`} />
      <div className="flex flex-col">
        <span className="text-[9px] uppercase tracking-wider font-bold text-[#8b949e] leading-none">
          Simulation Clock
        </span>
        <span className="text-sm font-bold tracking-tight text-white">
          {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </span>
      </div>

      {isFacilitator && (
        <div className="flex items-center gap-1 ml-1 pl-1.5 border-l border-[#30363d]">
          <button
            onClick={toggleTimer}
            title={isRunning ? 'Pause Timer' : 'Start 50-Min Clock'}
            className="p-1 rounded bg-[#21262d] hover:bg-[#30363d] text-white hover:text-emerald-400 transition"
          >
            {isRunning ? <Pause className="w-3 h-3 text-amber-400" /> : <Play className="w-3 h-3 text-emerald-400" />}
          </button>
          <button
            onClick={resetTimer}
            title="Reset to 50:00"
            className="p-1 rounded bg-[#21262d] hover:bg-[#30363d] text-[#8b949e] hover:text-white transition"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
};
