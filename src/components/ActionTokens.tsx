import React from 'react';
import { motion } from 'motion/react';
import { Zap, X } from 'lucide-react';

interface ActionTokensProps {
  remaining: number;
  total?: number;
  compact?: boolean;
}

export const ActionTokens: React.FC<ActionTokensProps> = ({ remaining, total = 4, compact = false }) => {
  const size = compact ? 'w-12 h-12' : 'w-[90px] h-[90px]';
  const used = Math.max(0, total - remaining);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center justify-center gap-3 flex-wrap" aria-label={`${remaining} of ${total} knowledge actions remaining`}>
        {Array.from({ length: total }, (_, index) => {
          const isUsed = index < used;
          return (
            <motion.div
              key={index}
              initial={false}
              animate={isUsed ? { scale: [1, 1.08, 1], rotate: [0, -4, 0] } : { scale: 1, rotate: 0 }}
              transition={{ duration: 0.28 }}
              className={`${size} rounded-full border-4 flex items-center justify-center relative shadow-lg select-none ${
                isUsed
                  ? 'bg-slate-900 border-slate-600 text-slate-500'
                  : 'bg-indigo-600 border-indigo-300 text-white shadow-indigo-950/40'
              }`}
            >
              {isUsed ? (
                <X className={compact ? 'w-8 h-8 stroke-[4]' : 'w-16 h-16 stroke-[4]'} />
              ) : (
                <Zap className={compact ? 'w-6 h-6 fill-current' : 'w-11 h-11 fill-current'} />
              )}
              {!compact && (
                <span className="absolute -bottom-7 text-xs font-bold tracking-wide whitespace-nowrap text-slate-300">
                  Action {index + 1}
                </span>
              )}
            </motion.div>
          );
        })}
      </div>
      {!compact && <div className="mt-6 text-lg font-bold text-white">{remaining} action{remaining === 1 ? '' : 's'} left</div>}
    </div>
  );
};
