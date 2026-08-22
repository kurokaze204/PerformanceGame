import React from 'react';
import type { KnowledgeDomain } from '../types/game.ts';
import { DOMAIN_INFO } from '../types/game.ts';
import type { CompanyV2 } from '../types/gameV2.ts';

interface KnowledgeHubPanelProps {
  company: CompanyV2;
}

const NAV_ITEMS = ['Home', 'Departments', 'Directory', 'Calendar', 'Documents', 'Learning', 'News'];

const NEWS_CARDS = [
  {
    title: 'Quarterly leadership briefing',
    meta: 'Company news · 2 days ago',
    image: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=420&q=42',
    alt: 'Colleagues collaborating around a table',
  },
  {
    title: 'Meet our newest team members',
    meta: 'People & culture · This week',
    image: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=420&q=42',
    alt: 'A group of colleagues talking together',
  },
  {
    title: 'Learning Academy enrolments open',
    meta: 'Learning · New',
    image: 'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=420&q=42',
    alt: 'Team members taking part in a workshop',
  },
];

const BOOKMARKS = ['HR forms & policies', 'Expense claims', 'Procurement portal', 'Safety reporting', 'IT service desk'];
const LEARNING = ['Knowledge sharing forum', 'Leadership essentials', 'Field guide update', 'Mentoring program', 'Lunch & learn series'];
const CONTACTS = ['IT Help Desk', 'People & Culture', 'Legal Support', 'Learning & Development', 'Facilities'];
const FILE_ROWS = [
  ['Business planning toolkit', 'DOCX · Updated yesterday'],
  ['Enterprise risk register', 'XLSX · Updated Fri'],
  ['Supplier onboarding guide', 'PDF · Updated 3 Aug'],
  ['Operational governance pack', 'PPTX · Updated 29 Jul'],
  ['Project assurance checklist', 'DOCX · Updated 25 Jul'],
  ['Records and information guide', 'PDF · Updated 18 Jul'],
];

export const KnowledgeHubPanel: React.FC<KnowledgeHubPanelProps> = ({ company }) => {
  const domains = Object.keys(DOMAIN_INFO) as KnowledgeDomain[];

  return (
    <aside className="overflow-hidden rounded-2xl border border-slate-300 bg-[#f3f5f2] text-slate-700 shadow-xl">
      <div className="flex items-center justify-between gap-3 bg-white px-4 py-3 border-b border-slate-200">
        <div className="text-[17px] font-black leading-tight text-[#1f6f43] truncate">{company.name}</div>
        <div className="text-[13px] font-bold uppercase tracking-[0.16em] text-slate-500">Intranet</div>
      </div>

      <nav className="flex items-center gap-3 overflow-hidden whitespace-nowrap bg-[#438d67] px-3 py-2 text-[8px] font-semibold text-white shadow-sm">
        {NAV_ITEMS.map((item) => <span key={item}>{item}</span>)}
      </nav>

      <div className="bg-white px-3 pt-3 pb-2">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-[12px] font-black text-[#245d47]">Latest news</h3>
          <span className="text-[6px] font-semibold text-[#438d67]">View all news →</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {NEWS_CARDS.map((card) => (
            <article key={card.title} className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
              <img src={card.image} alt={card.alt} className="h-16 w-full object-cover saturate-[0.85] contrast-[0.92]" loading="lazy" />
              <div className="px-1.5 py-1.5">
                <div className="text-[6px] font-bold leading-[1.2] text-slate-700">{card.title}</div>
                <div className="mt-1 text-[4.5px] leading-none text-slate-400">{card.meta}</div>
              </div>
            </article>
          ))}
        </div>
      </div>

      <section className="border-y border-slate-200 bg-[#eef3ef] px-3 py-3">
        <div className="mb-2 flex items-end justify-between">
          <div>
            <div className="text-[18px] font-black tracking-wide text-[#245d47]">Knowledge Hub</div>
            <div className="text-[6px] text-slate-500">Corporate knowledge available across the organisation</div>
          </div>
          <span className="text-[5px] text-slate-400">Knowledge services</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {domains.map((domain) => {
            const info = DOMAIN_INFO[domain];
            return (
              <div key={domain} className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 flex items-center justify-between gap-2 shadow-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-3.5 h-3.5 rounded-full shrink-0 ring-2 ring-white shadow-sm" style={{ backgroundColor: info.color }} />
                  <span className="font-bold text-[11px] text-slate-700 truncate">{info.label}</span>
                </div>
                <span className="text-[28px] leading-none font-black text-[#245d47] tabular-nums">{company.intranet[domain]}</span>
              </div>
            );
          })}
        </div>
      </section>

      <div className="bg-white px-3 py-3">
        <div className="grid grid-cols-3 gap-2">
          <UtilityBlock title="Bookmarks & Links" items={BOOKMARKS} />
          <UtilityBlock title="Learning news" items={LEARNING} />
          <UtilityBlock title="Key contacts" items={CONTACTS} />
        </div>
      </div>

      <div className="border-t border-slate-200 bg-[#f7f8f6] px-3 py-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-[10px] font-black text-[#245d47]">Recently updated files</div>
          <span className="text-[5px] text-slate-400">Browse document libraries →</span>
        </div>
        <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
          {FILE_ROWS.map(([name, meta], idx) => (
            <div key={name} className={`flex items-center gap-2 px-2 py-1.5 ${idx ? 'border-t border-slate-100' : ''}`}>
              <span className="grid h-4 w-4 shrink-0 place-items-center rounded-sm bg-[#e6efe9] text-[6px] font-black text-[#438d67]">▤</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[6px] font-semibold text-[#356d84] underline decoration-[#9ebfc9]">{name}</div>
                <div className="mt-0.5 truncate text-[4.5px] text-slate-400">{meta}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 opacity-80">
          <AmbiguousTile title="Policies & procedures" />
          <AmbiguousTile title="Project workspaces" />
          <AmbiguousTile title="People resources" />
          <AmbiguousTile title="Operational reference" />
        </div>
      </div>
    </aside>
  );
};

const UtilityBlock: React.FC<{ title: string; items: string[] }> = ({ title, items }) => (
  <section className="min-w-0 rounded-md border border-slate-200 bg-[#fbfcfb] p-2">
    <h4 className="mb-1.5 text-[7px] font-black text-[#245d47]">{title}</h4>
    <div className="space-y-1">
      {items.map((item) => <div key={item} className="truncate text-[5px] font-medium text-[#40758a] underline decoration-[#b8cdd5]">› {item}</div>)}
    </div>
  </section>
);

const AmbiguousTile: React.FC<{ title: string }> = ({ title }) => (
  <section className="rounded-md border border-slate-200 bg-white p-2">
    <div className="mb-1.5 text-[7px] font-black text-slate-500">{title}</div>
    <div className="space-y-1 text-[4.5px] text-[#5f8897]">
      <div className="truncate underline decoration-slate-300">› Updated internal information and resources...</div>
      <div className="truncate underline decoration-slate-300">› Reference material and supporting documentation...</div>
      <div className="truncate underline decoration-slate-300">› Team information, forms and quick links...</div>
    </div>
  </section>
);
