import React from 'react';
import { motion } from 'motion/react';
import type { GamePhase } from '../types/game.ts';
import pawnSrc from '../image_ecc870e4.png';

interface Props {
  phase: GamePhase;
  eventProgress?: string;
}

const phases = [
  { number: '1.', label: 'EVENTS' },
  { number: '2.', label: 'INVEST' },
  { number: '3.', label: 'KNOWLEDGE RISK' },
] as const;

const indexForPhase = (phase: GamePhase) =>
  phase === 'investment' ? 1 : phase === 'risk' ? 2 : 0;

export const PhaseTrackV1: React.FC<Props> = ({ phase }) => {
  const active = indexForPhase(phase);

  return (
    <div
      className="relative w-full px-2 pb-1 pt-3"
      aria-label={`Current phase: ${phases[active].label}`}
    >
      <div className="relative h-[38px] rounded-lg border border-cyan-900/80 bg-slate-950/92 shadow-xl overflow-visible">
        <div className="grid h-full grid-cols-3 items-center">
          {phases.map((item, index) => (
            <div key={item.label} className="relative h-full min-w-0">
              <div className="absolute inset-0 flex items-center whitespace-nowrap pl-[38px]">
                <span className="inline-block w-[28px] shrink-0 text-sm font-black tracking-[0.12em] text-slate-500">
                  {item.number}
                </span>
                <span
                  className={`text-sm font-black tracking-[0.1em] ${
                    index === active ? 'text-white' : 'text-slate-500'
                  }`}
                >
                  {item.label}
                </span>
              </div>
            </div>
          ))}
        </div>

        <motion.div
          className="pointer-events-none absolute left-0 top-0 z-20 h-full w-1/3"
          animate={{ x: `${active * 100}%` }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <img
            src={pawnSrc}
            alt=""
            aria-hidden="true"
            draggable={false}
            className="absolute left-[37px] top-[-12px] h-[44px] w-auto max-w-none -translate-x-1/2 select-none drop-shadow-[0_5px_5px_rgba(0,0,0,.5)]"
          />
        </motion.div>
      </div>
    </div>
  );
};

export default PhaseTrackV1;
