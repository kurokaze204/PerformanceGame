import React from 'react';
import type { KnowledgeDomain } from '../types/game.ts';
import { DOMAIN_INFO } from '../types/game.ts';
import type { CompanyV2 } from '../types/gameV2.ts';

interface KnowledgeHubPanelProps {
  company: CompanyV2;
}

const NAV_ITEMS = ['Home', 'Departments', 'Directory', 'Calendar', 'Documents', 'eForms'];

const FEATURE_CARDS = [
  { label: 'Easy lunch ideas for busy teams', accent: 'bg-amber-100' },
  { label: 'Get to know our people', accent: 'bg-cyan-100' },
  { label: 'Volunteer opportunities', accent: 'bg-lime-100' },
  { label: 'Learning Academy', accent: 'bg-slate-200' },
];

const NEWS_ITEMS = [
  'Quarterly business update',
  'New starters and role changes',
  'Upcoming learning sessions',
  'Community and wellbeing news',
];

export const KnowledgeHubPanel: React.FC<KnowledgeHubPanelProps> = ({ company }) => {
  const domains = Object.keys(DOMAIN_INFO) as KnowledgeDomain[];

  return (
    <aside className="overflow-hidden rounded-2xl border border-slate-300 bg-[#f7f8f6] text-[#104a63] shadow-xl">
      <div className="flex items-center justify-between gap-3 bg-white px-3 py-2 border-b border-slate-200">
        <div className="text-[16px] font-black leading-tight text-[#1f7a35] truncate">{company.name}</div>
        <div className="text-[13px] font-bold uppercase tracking-[0.12em] text-slate-500">Intranet</div>
      </div>

      <div className="flex items-center gap-2 overflow-hidden whitespace-nowrap bg-[#58b77c] px-2 py-1 text-[6px] font-semibold text-white">
        {NAV_ITEMS.map((item) => <span key={item}>{item}</span>)}
      </div>

      <div className="px-2 pt-2">
        <div className="grid grid-cols-4 gap-1.5">
          {FEATURE_CARDS.map((card, idx) => (
            <div key={card.label} className="overflow-hidden rounded-sm border border-slate-200 bg-white shadow-sm">
              <div className={`h-12 ${card.accent} relative overflow-hidden`}>
                <div className="absolute inset-x-2 top-2 h-2 rounded bg-white/70" />
                <div className="absolute left-2 bottom-2 w-7 h-7 rounded-full bg-white/70 border border-white" />
                <div className="absolute right-2 bottom-2 w-8 h-5 rounded bg-white/50" />
              </div>
              <div className="min-h-9 px-1.5 py-1 text-[5px] leading-tight text-slate-600">{card.label}</div>
              <div className="flex items-center justify-between px-1.5 pb-1 text-[5px] text-slate-400"><span>◉ {idx + 1}</span><span>▰</span></div>
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 pt-3 pb-1">
        <div className="text-[18px] font-black tracking-wide text-[#0c4b68]">Knowledge Hub</div>
      </div>

      <div className="grid grid-cols-2 gap-2 px-4 pb-3">
        {domains.map((domain) => {
          const info = DOMAIN_INFO[domain];
          return (
            <div key={domain} className="rounded-lg border-2 border-[#123e52] bg-[#f8faf9] px-2.5 py-1.5 flex items-center justify-between gap-2 shadow-sm">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ backgroundColor: info.color }} />
                <span className="font-bold text-[12px] text-[#13465f] truncate">{info.label}</span>
              </div>
              <span className="text-[28px] leading-none font-black text-[#123e52] tabular-nums">{company.intranet[domain]}</span>
            </div>
          );
        })}
      </div>

      <div className="border-t border-slate-200 bg-white px-2 py-2">
        <div className="grid grid-cols-[64px_1fr_1fr] gap-2">
          <div className="border-r border-slate-200 pr-2">
            <div className="h-8 rounded bg-[#2f6680] px-1.5 py-1 text-[6px] font-bold text-white">My Bookmarks & Links</div>
            <div className="mt-1 space-y-1 text-[5px] leading-tight text-slate-500">
              <div>▸ Go to our website</div>
              <div>▸ HR & People</div>
              <div>▸ IT Services</div>
              <div>▸ Policies</div>
            </div>
          </div>
          <div>
            <div className="mb-1 text-[7px] font-black text-[#33748f]">News & Updates</div>
            <div className="space-y-1 text-[5px] leading-tight text-slate-500">
              {NEWS_ITEMS.map((item) => <div key={item}>{item}</div>)}
            </div>
          </div>
          <div>
            <div className="mb-1 text-[7px] font-black text-[#33748f]">Learning News</div>
            <div className="space-y-1 text-[5px] leading-tight text-slate-500">
              <div>New mentoring program</div>
              <div>Lunch and learn: resilience</div>
              <div>Leadership essentials</div>
              <div>Knowledge sharing forum</div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};
