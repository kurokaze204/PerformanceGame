import React, { useState } from 'react';
import { GameSession, Company } from '../types/game.ts';
import { formatCurrency } from '../utils/format.ts';
import {
  Building2,
  Users,
  Play,
  Key,
  ShieldAlert,
  Sparkles,
  ArrowRight
} from 'lucide-react';

interface SessionJoinModalProps {
  currentSession: GameSession | null;
  onJoinSession: (sessionId: string, companyId: string, playerName: string) => void;
  onCreateNewSession: (sessionName: string, companyCount: number) => void;
  onSoloStart: () => void;
}

export const SessionJoinModal: React.FC<SessionJoinModalProps> = ({
  currentSession,
  onJoinSession,
  onCreateNewSession,
  onSoloStart,
}) => {
  const [mode, setMode] = useState<'select_company' | 'join_by_code' | 'create_session'>('join_by_code');
  const [sessionIdInput, setSessionIdInput] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState(
    currentSession?.companies[0]?.id || ''
  );
  const [newSessionName, setNewSessionName] = useState('Executive Game 2026');
  const [companyCount, setCompanyCount] = useState(4);

  return (
    <div className="fixed inset-0 z-50 bg-[#0a0c10]/90 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-5 text-[#c9d1d9] animate-in zoom-in-95">
        {/* Title */}
        <div className="text-center space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-indigo-950/80 border border-indigo-700/60 text-indigo-300 text-[10px] font-bold font-mono">
            <span>ORGANIZATIONAL KNOWLEDGE & RESILIENCE</span>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight font-mono">THE PERFORMANCE GAP</h1>
          <p className="text-[11px] text-[#8b949e]">
            Multiplayer Strategic Business Game
          </p>
        </div>

        {/* Mode Selector */}
        <div className="flex bg-[#0d1117] p-1 rounded-lg border border-[#30363d] text-xs font-mono">
          <button
            onClick={() => setMode('join_by_code')}
            className={`flex-1 py-1.5 rounded transition ${
              mode === 'join_by_code'
                ? 'bg-indigo-600 text-white font-bold'
                : 'text-[#8b949e] hover:text-white'
            }`}
          >
            Join by Code
          </button>
          {currentSession && (
            <button
              onClick={() => setMode('select_company')}
              className={`flex-1 py-1.5 rounded transition ${
                mode === 'select_company'
                  ? 'bg-indigo-600 text-white font-bold'
                  : 'text-[#8b949e] hover:text-white'
              }`}
            >
              Current Game
            </button>
          )}
          <button
            onClick={() => setMode('create_session')}
            className={`flex-1 py-1.5 rounded transition ${
              mode === 'create_session'
                ? 'bg-indigo-600 text-white font-bold'
                : 'text-[#8b949e] hover:text-white'
            }`}
          >
            Create Game
          </button>
        </div>

        {/* 1. JOIN BY CODE (DEFAULT) */}
        {mode === 'join_by_code' && (
          <div className="space-y-3.5">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-[#8b949e] uppercase font-mono">Your Name / Title</label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="e.g. Sarah Jenkins (CEO)"
                className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-xs text-white focus:outline-hidden focus:border-indigo-500 font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-[#8b949e] uppercase font-mono">Game Code / Session ID</label>
              <input
                type="text"
                value={sessionIdInput}
                onChange={(e) => setSessionIdInput(e.target.value)}
                placeholder="e.g. KM2026"
                className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-xs text-white focus:outline-hidden font-mono focus:border-indigo-500"
              />
            </div>

            <button
              onClick={() => {
                if (sessionIdInput.trim()) {
                  onJoinSession(sessionIdInput.trim(), '', playerName || 'Player');
                }
              }}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-mono font-bold rounded-lg shadow-xs flex items-center justify-center gap-2 transition"
            >
              <span>CONNECT TO GAME</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* 2. SELECT COMPANY (Active Session) */}
        {mode === 'select_company' && currentSession && (
          <div className="space-y-3.5">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-[#8b949e] uppercase font-mono">Your Name</label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="e.g. Sarah Jenkins (CEO)"
                className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-xs text-white focus:outline-hidden focus:border-indigo-500 font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-[#8b949e] uppercase font-mono">Select Your Enterprise</label>
              <div className="grid grid-cols-1 gap-1.5 max-h-48 overflow-y-auto font-mono">
                {currentSession.companies.map((comp) => (
                  <div
                    key={comp.id}
                    onClick={() => setSelectedCompanyId(comp.id)}
                    className={`p-2.5 rounded-lg border cursor-pointer transition flex items-center justify-between ${
                      selectedCompanyId === comp.id
                        ? 'bg-[#21262d] border-indigo-500 text-white ring-1 ring-indigo-500'
                        : 'bg-[#0d1117] border-[#30363d] text-[#c9d1d9] hover:border-[#484f58]'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-xs font-sans text-white">{comp.name}</div>
                      <div className="text-[10px] text-[#8b949e]">
                        {comp.sites.length} Sites • {comp.experts.length} Experts • {formatCurrency(comp.turnover)} Turnover
                      </div>
                    </div>
                    <Building2 className="w-4 h-4 text-indigo-400" />
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => onJoinSession(currentSession.id, selectedCompanyId, playerName || 'Player')}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-mono font-bold rounded-lg shadow-xs flex items-center justify-center gap-2 transition"
            >
              <span>ENTER GAME COCKPIT</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* 3. CREATE NEW GAME */}
        {mode === 'create_session' && (
          <div className="space-y-3.5">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-[#8b949e] uppercase font-mono">Cohort / Game Name</label>
              <input
                type="text"
                value={newSessionName}
                onChange={(e) => setNewSessionName(e.target.value)}
                className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-xs text-white focus:outline-hidden focus:border-indigo-500 font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-[#8b949e] uppercase font-mono">Competing Companies</label>
              <select
                value={companyCount}
                onChange={(e) => setCompanyCount(Number(e.target.value))}
                className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-xs text-white focus:outline-hidden focus:border-indigo-500 font-mono"
              >
                <option value={1}>1 Company (Solo Single-Player Game)</option>
                <option value={2}>2 Competing Companies</option>
                <option value={3}>3 Competing Companies</option>
                <option value={4}>4 Competing Companies (Standard Cohort)</option>
                <option value={5}>5 Competing Companies</option>
                <option value={6}>6 Competing Companies</option>
              </select>
            </div>

            <button
              onClick={() => onCreateNewSession(newSessionName, companyCount)}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-mono font-bold rounded-lg shadow-xs flex items-center justify-center gap-2 transition"
            >
              <Sparkles className="w-4 h-4" />
              <span>LAUNCH NEW GAME</span>
            </button>
          </div>
        )}

        {/* Quick 1-click Solo start shortcut */}
        <div className="pt-2 border-t border-[#30363d] text-center">
          <button
            onClick={onSoloStart}
            className="text-xs text-indigo-400 hover:text-indigo-300 font-mono font-semibold underline"
          >
            Or launch Instant 1-Player Solo Game
          </button>
        </div>
      </div>
    </div>
  );
};

