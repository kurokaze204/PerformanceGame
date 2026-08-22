import React, { useState, useEffect } from 'react';
import { GameSession, Company, GameEventLog, DOMAIN_INFO } from '../types/game.ts';
import { formatCurrency } from '../utils/format.ts';
import {
  Sliders,
  Play,
  Pause,
  ChevronRight,
  TrendingUp,
  ShieldAlert,
  Radio,
  FileText,
  HelpCircle,
  Sparkles,
  Flame,
  Search,
  Building2,
  DollarSign,
  Send,
  RotateCcw,
  AlertOctagon,
  Trash2
} from 'lucide-react';

interface FacilitatorDashboardProps {
  session: GameSession;
  onClose: () => void;
  onAdvancePhase: () => void;
  onFacilitatorOverride: (passcode: string, updates: any) => Promise<void>;
  onTriggerFinalDisruption: () => void;
  onDeleteCurrentGame?: (passcode: string) => Promise<void>;
  onResetDatabase?: (passcode: string) => Promise<void>;
}

export const FacilitatorDashboard: React.FC<FacilitatorDashboardProps> = ({
  session,
  onClose,
  onAdvancePhase,
  onFacilitatorOverride,
  onTriggerFinalDisruption,
  onDeleteCurrentGame,
  onResetDatabase,
}) => {
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'controls' | 'logs' | 'questions' | 'ai_debrief'>('leaderboard');
  const [passcode, setPasscode] = useState('facilitator2026');
  const [logs, setLogs] = useState<GameEventLog[]>([]);
  const [logFilter, setLogFilter] = useState('');
  const [aiDebriefResult, setAiDebriefResult] = useState<any>(null);
  const [isGeneratingDebrief, setIsGeneratingDebrief] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isDeletingSession, setIsDeletingSession] = useState(false);
  const [showDeleteSessionConfirm, setShowDeleteSessionConfirm] = useState(false);

  // Manual turnover override form
  const [overrideCompanyId, setOverrideCompanyId] = useState(session.companies[0]?.id || '');
  const [turnoverDelta, setTurnoverDelta] = useState(10);

  useEffect(() => {
    fetchLogs();
  }, [session.id]);

  const fetchLogs = async () => {
    try {
      const res = await fetch(`/api/sessions/${session.id}/logs`);
      if (res.ok) {
        const text = await res.text();
        try {
          const data = JSON.parse(text);
          if (Array.isArray(data)) {
            setLogs(data);
          }
        } catch {
          // ignore non-json response
        }
      }
    } catch (e) {
      console.error('Error loading logs:', e);
    }
  };

  const handleGenerateAIDebrief = async () => {
    setIsGeneratingDebrief(true);
    try {
      const res = await fetch('/api/ai/debrief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.id }),
      });
      if (res.ok) {
        const text = await res.text();
        try {
          const data = JSON.parse(text);
          setAiDebriefResult(data);
        } catch {
          console.error('Non-JSON response received from debrief');
        }
      }
    } catch (e) {
      console.error('Error generating AI debrief:', e);
    } finally {
      setIsGeneratingDebrief(false);
    }
  };

  const filteredLogs = logs.filter(
    (l) =>
      l.title.toLowerCase().includes(logFilter.toLowerCase()) ||
      l.description.toLowerCase().includes(logFilter.toLowerCase()) ||
      l.eventType.toLowerCase().includes(logFilter.toLowerCase())
  );

  const DISCUSSION_QUESTIONS = [
    '1. Where did your most valuable knowledge reside?',
    '2. Where were you most dependent upon individuals?',
    '3. Which knowledge risks did you knowingly accept?',
    '4. What prevented you from transferring vulnerable expertise?',
    '5. What did you gain and lose by moving experts to Headquarters?',
    '6. Did having knowledge on the Intranet mean every site could use it?',
    '7. Where did local capability limit the value of corporate knowledge?',
    '8. When was Team Capability more valuable than documentation?',
    '9. When was documentation more valuable than an expert?',
    '10. Did Corporate Training unlock value from knowledge you already possessed?',
    '11. What expertise did you gain through relationships rather than ownership?',
    '12. What happened when organisations stopped investing in their CoPs?',
    '13. What value did Horizon Scanning provide despite creating no knowledge?',
    '14. Did failure itself teach the organisation anything?',
    '15. When did short-term production conflict with future production capacity?',
    '16. Did you underinvest or overinvest in knowledge?',
    '17. What would you do differently if another disruption were coming?',
  ];

  return (
    <div className="fixed inset-0 z-50 bg-[#0a0c10]/85 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl max-w-5xl w-full h-[90vh] flex flex-col shadow-2xl overflow-hidden text-[#c9d1d9]">
        {/* Header */}
        <div className="p-3.5 sm:p-4 border-b border-[#30363d] flex items-center justify-between bg-[#0d1117]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#21262d] border border-[#30363d] flex items-center justify-center text-purple-400 font-bold shadow-inner">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white tracking-tight font-mono">
                  FACILITATOR MASTER COMMAND
                </h2>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-purple-950/80 border border-purple-800/60 text-purple-300">
                  {session.id}
                </span>
              </div>
              <p className="text-[11px] text-[#8b949e]">Strategic Orchestration & Multi-Company Analytics</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-7 h-7 rounded bg-[#21262d] hover:bg-[#30363d] text-[#8b949e] hover:text-white flex items-center justify-center transition border border-[#30363d] text-xs font-mono"
          >
            ✕
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 px-4 border-b border-[#30363d] bg-[#161b22] overflow-x-auto">
          {[
            { id: 'leaderboard', label: 'Company Overview' },
            { id: 'controls', label: 'Master Controls' },
            { id: 'logs', label: `Event Log (${logs.length})` },
            { id: 'questions', label: 'AAR Facilitation Questions' },
            { id: 'ai_debrief', label: 'AI Executive Debrief' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-2 text-xs font-mono border-b-2 transition whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-indigo-500 text-white font-bold'
                  : 'border-transparent text-[#8b949e] hover:text-[#c9d1d9]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Body Content Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* TAB 1: COMPANY OVERVIEW & LEADERBOARD */}
          {activeTab === 'leaderboard' && (
            <div className="space-y-3">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse font-mono">
                  <thead>
                    <tr className="border-b border-[#30363d] text-[#8b949e] uppercase text-[10px]">
                      <th className="pb-2 pl-2">Company</th>
                      <th className="pb-2">Turnover</th>
                      <th className="pb-2">Surviving Sites</th>
                      <th className="pb-2">SPOF Risks</th>
                      <th className="pb-2">Corporate Intranet (Eng/HR/Mkt/Ops/Fin)</th>
                      <th className="pb-2">Automated</th>
                      <th className="pb-2 pr-2">CoP Members</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#30363d]/60 text-[11px]">
                    {session.companies.map((comp) => {
                      const survivingSites = comp.sites.filter((s) => !s.isClosed).length;
                      const spofs = comp.experts.filter((e) => !e.isVacant && e.isSPOF).length;
                      const copMembers = session.copMemberships.filter((m) => m.companyId === comp.id).length;

                      return (
                        <tr key={comp.id} className="hover:bg-[#21262d]/50 transition">
                          <td className="py-2.5 pl-2 font-bold text-white font-sans">{comp.name}</td>
                          <td className="py-2.5 font-mono font-bold text-emerald-400">{formatCurrency(comp.turnover)}</td>
                          <td className="py-2.5">{survivingSites}/6 Active</td>
                          <td className="py-2.5">
                            {spofs > 0 ? (
                              <span className="text-amber-400 font-bold">⚠ {spofs} Exposed</span>
                            ) : (
                              <span className="text-emerald-400">0 Safe</span>
                            )}
                          </td>
                          <td className="py-2.5 font-mono text-[10px] text-purple-300">
                            {comp.intranet.engineering} / {comp.intranet.hr} / {comp.intranet.marketing} / {comp.intranet.operations} / {comp.intranet.finance}
                          </td>
                          <td className="py-2.5 text-[#8b949e]">{comp.automatedDomains.length} Domains</td>
                          <td className="py-2.5 pr-2 text-amber-300 font-bold">{copMembers} Enrolled</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: MASTER CONTROLS */}
          {activeTab === 'controls' && (
            <div className="space-y-4 max-w-2xl">
              <div className="p-3.5 bg-[#0d1117] rounded-lg border border-[#30363d] space-y-2.5">
                <h3 className="text-[10px] font-bold text-[#8b949e] uppercase tracking-wider font-mono">
                  Game Flow Orchestration
                </h3>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    onClick={onAdvancePhase}
                    className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-mono font-bold rounded-lg transition shadow-xs flex items-center gap-1.5"
                  >
                    <span>Advance Phase (Current: {session.phase})</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={onTriggerFinalDisruption}
                    className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-mono font-bold rounded-lg transition shadow-xs flex items-center gap-1.5"
                  >
                    <Flame className="w-3.5 h-3.5" />
                    <span>Trigger Final Disruption</span>
                  </button>
                </div>
              </div>

              {/* Adjust Company Turnover */}
              <div className="p-3.5 bg-[#0d1117] rounded-lg border border-[#30363d] space-y-2.5">
                <h3 className="text-[10px] font-bold text-[#8b949e] uppercase tracking-wider font-mono">
                  Manual Turnover Balance Adjustment
                </h3>

                <div className="flex items-center gap-2.5 text-xs font-mono">
                  <select
                    value={overrideCompanyId}
                    onChange={(e) => setOverrideCompanyId(e.target.value)}
                    className="bg-[#161b22] border border-[#30363d] rounded px-2 py-1 text-xs text-[#c9d1d9]"
                  >
                    {session.companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>

                  <input
                    type="number"
                    value={turnoverDelta}
                    onChange={(e) => setTurnoverDelta(Number(e.target.value))}
                    className="w-20 bg-[#161b22] border border-[#30363d] rounded px-2 py-1 text-xs text-[#c9d1d9] font-mono"
                    placeholder="Delta"
                  />

                  <button
                    onClick={() =>
                      onFacilitatorOverride(passcode, {
                        adjustCompanyTurnover: {
                          companyId: overrideCompanyId,
                          delta: turnoverDelta,
                        },
                      })
                    }
                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded transition"
                  >
                    Apply Delta
                  </button>
                </div>
              </div>

              {/* Danger Zone: Session Deletion & Factory Reset */}
              <div className="p-4 bg-rose-950/20 rounded-xl border border-rose-800/40 space-y-4">
                <div className="flex items-center gap-2 text-rose-400 font-mono text-xs font-bold tracking-wide">
                  <AlertOctagon className="w-4 h-4" />
                  <span>DANGER ZONE: SESSION MANAGEMENT & RESET</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* OPTION 1: DELETE CURRENT GAME ONLY */}
                  <div className="p-3 bg-[#0d1117] rounded-lg border border-[#30363d] space-y-2.5 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 text-amber-300 font-mono text-xs font-bold">
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete Current Game Only</span>
                      </div>
                      <p className="text-[11px] text-[#8b949e] mt-1 leading-relaxed">
                        Deletes session <span className="text-[#c9d1d9] font-mono font-semibold">"{session.name}" ({session.id})</span> without affecting other cohort sessions.
                      </p>
                    </div>

                    {!showDeleteSessionConfirm ? (
                      <button
                        type="button"
                        onClick={() => setShowDeleteSessionConfirm(true)}
                        className="w-full px-3 py-1.5 bg-amber-950/40 hover:bg-amber-900/60 text-amber-200 border border-amber-700/60 rounded-lg text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete Current Session</span>
                      </button>
                    ) : (
                      <div className="p-2.5 bg-amber-950/30 rounded border border-amber-600/70 space-y-2">
                        <p className="text-[11px] text-amber-200 font-mono font-bold">
                          Delete "{session.name}"?
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={isDeletingSession}
                            onClick={async () => {
                              if (onDeleteCurrentGame) {
                                setIsDeletingSession(true);
                                try {
                                  await onDeleteCurrentGame(passcode);
                                } finally {
                                  setIsDeletingSession(false);
                                  setShowDeleteSessionConfirm(false);
                                }
                              }
                            }}
                            className="flex-1 px-2.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-mono font-bold transition disabled:opacity-50"
                          >
                            {isDeletingSession ? 'Deleting...' : 'Yes, Delete Game'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowDeleteSessionConfirm(false)}
                            className="px-2.5 py-1.5 bg-[#21262d] hover:bg-[#30363d] text-[#c9d1d9] rounded text-xs font-mono transition"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* OPTION 2: FULL DATABASE FACTORY RESET */}
                  <div className="p-3 bg-[#0d1117] rounded-lg border border-[#30363d] space-y-2.5 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 text-rose-400 font-mono text-xs font-bold">
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Full Factory Reset (All Games)</span>
                      </div>
                      <p className="text-[11px] text-[#8b949e] mt-1 leading-relaxed">
                        Permanently wipes all sessions, enrolled participants, site allocations, and event history across the entire database.
                      </p>
                    </div>

                    {!showResetConfirm ? (
                      <button
                        type="button"
                        onClick={() => setShowResetConfirm(true)}
                        className="w-full px-3 py-1.5 bg-rose-950/40 hover:bg-rose-900/60 text-rose-200 border border-rose-700/60 rounded-lg text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition"
                      >
                        <AlertOctagon className="w-3.5 h-3.5" />
                        <span>Factory Reset Entire Database</span>
                      </button>
                    ) : (
                      <div className="p-2.5 bg-rose-950/30 rounded border border-rose-600/70 space-y-2">
                        <p className="text-[11px] text-rose-300 font-mono font-bold">
                          ⚠️ Wipe all sessions & data?
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={isResetting}
                            onClick={async () => {
                              if (onResetDatabase) {
                                setIsResetting(true);
                                try {
                                  await onResetDatabase(passcode);
                                } finally {
                                  setIsResetting(false);
                                  setShowResetConfirm(false);
                                }
                              }
                            }}
                            className="flex-1 px-2.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-mono font-bold transition disabled:opacity-50"
                          >
                            {isResetting ? 'Resetting...' : 'Yes, Wipe Everything'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowResetConfirm(false)}
                            className="px-2.5 py-1.5 bg-[#21262d] hover:bg-[#30363d] text-[#c9d1d9] rounded text-xs font-mono transition"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: EVENT LOGS */}
          {activeTab === 'logs' && (
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 bg-[#0d1117] px-3 py-1.5 rounded-lg border border-[#30363d] text-xs">
                <Search className="w-4 h-4 text-[#8b949e]" />
                <input
                  type="text"
                  placeholder="Filter logged strategic events..."
                  value={logFilter}
                  onChange={(e) => setLogFilter(e.target.value)}
                  className="w-full bg-transparent text-[#c9d1d9] focus:outline-hidden font-mono text-xs"
                />
              </div>

              <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                {filteredLogs.slice().reverse().map((log) => (
                  <div key={log.id} className="p-2.5 bg-[#0d1117] rounded-lg border border-[#30363d] text-xs space-y-1 font-mono">
                    <div className="flex items-center justify-between text-[#8b949e] text-[10px]">
                      <span>Round {log.round} • {log.phase.toUpperCase()}</span>
                      <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <div className="font-bold text-white font-sans text-xs">{log.title}</div>
                    <p className="text-[#8b949e] font-sans text-[11px] leading-relaxed">{log.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: FACILITATION DISCUSSION GUIDE */}
          {activeTab === 'questions' && (
            <div className="space-y-2.5">
              <h3 className="text-[10px] font-bold text-[#8b949e] uppercase tracking-wider font-mono">
                17 Core Debriefing Questions (Specification Section 51)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {DISCUSSION_QUESTIONS.map((q, idx) => (
                  <div key={idx} className="p-3 bg-[#0d1117] rounded-lg border border-[#30363d] text-xs text-[#c9d1d9] leading-relaxed">
                    {q}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: AI-POWERED EXECUTIVE DEBRIEF */}
          {activeTab === 'ai_debrief' && (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div>
                  <h3 className="text-[10px] font-bold text-[#8b949e] uppercase tracking-wider font-mono">
                    AI-Powered Executive Debrief Generator
                  </h3>
                  <p className="text-[11px] text-[#8b949e]">
                    Synthesizes real event log timestamps, turnover shocks, and SPOF vulnerabilities into an executive AAR summary.
                  </p>
                </div>

                <button
                  onClick={handleGenerateAIDebrief}
                  disabled={isGeneratingDebrief}
                  className="px-3.5 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-mono font-bold rounded-lg shadow-xs flex items-center gap-1.5 transition disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>{isGeneratingDebrief ? 'Analyzing Game Data...' : 'Generate Executive Debrief'}</span>
                </button>
              </div>

              {aiDebriefResult && (
                <div className="p-4 bg-[#0d1117] rounded-lg border border-indigo-500/40 space-y-3 text-xs animate-in fade-in">
                  <div className="space-y-1">
                    <h4 className="font-bold text-indigo-300 uppercase tracking-wide font-mono text-[11px]">Executive Summary</h4>
                    <p className="text-[#c9d1d9] leading-relaxed">{aiDebriefResult.summary}</p>
                  </div>

                  <div className="space-y-1.5">
                    <h4 className="font-bold text-indigo-300 uppercase tracking-wide font-mono text-[11px]">Key Strategic Insights</h4>
                    <ul className="space-y-1 list-disc list-inside text-[#c9d1d9]">
                      {aiDebriefResult.keyLearnings?.map((l: string, i: number) => (
                        <li key={i}>{l}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="space-y-1.5">
                    <h4 className="font-bold text-indigo-300 uppercase tracking-wide font-mono text-[11px]">Custom Tailored Facilitation Questions</h4>
                    <ul className="space-y-1 list-disc list-inside text-amber-300 font-medium">
                      {aiDebriefResult.facilitatorQuestions?.map((q: string, i: number) => (
                        <li key={i}>{q}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
