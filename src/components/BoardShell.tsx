import React from 'react';

interface BoardShellProps {
  board: React.ReactNode;
  sidePanel: React.ReactNode;
  overlay?: React.ReactNode;
}

export const BoardShell: React.FC<BoardShellProps> = ({ board, sidePanel, overlay }) => (
  <section className="grid lg:grid-cols-[minmax(0,1fr)_360px] gap-4 items-stretch">
    <div className="relative min-h-[620px] rounded-3xl border border-slate-800 bg-slate-900/50 p-3 overflow-hidden">
      <div className="h-full">{board}</div>
      {overlay && (
        <div className="absolute inset-3 z-20 pointer-events-none overflow-auto rounded-2xl">
          <div className="min-h-full flex items-start pointer-events-none">
            <div className="pointer-events-auto w-full">{overlay}</div>
          </div>
        </div>
      )}
    </div>
    {sidePanel}
  </section>
);
