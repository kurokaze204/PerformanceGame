import React from 'react';

export const GameStartOverlay: React.FC<{ onStart: () => void }> = ({ onStart }) => (
  <div className="absolute inset-0 z-20 grid place-items-center bg-slate-950/45 backdrop-blur-[1px] p-5">
    <div className="max-w-2xl rounded-3xl border-2 border-indigo-400 bg-[#11162a]/95 p-6 shadow-2xl">
      <div className="text-xs uppercase tracking-[0.2em] text-indigo-300 font-black">Game Start</div>
      <h2 className="text-2xl font-black text-white mt-2">Welcome to the Performance Gap Game</h2>
      <div className="mt-4 space-y-3 text-sm leading-relaxed text-slate-200">
        <p>Knowledge Management Is about way more than knowledge hubs and call centre articles. Good KM helps an organisation preserve and build capability over time. Investing in training and plant helps increase capacity but local knowledge, resigning experts and low frequency, high impact problems sap an organisation's effectiveness. This game lets you find ways to overcome them.</p>
        <p>Build your knowledge capability through multiple rounds, and prepare for the final challenge round to see who can build the strongest company.</p>
      </div>
      <button onClick={onStart} className="mt-5 w-full rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white px-5 py-3.5 text-lg font-black">START GAME</button>
    </div>
  </div>
);
