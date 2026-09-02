import React, { useEffect, useMemo, useState } from 'react';
import { Clock, RotateCcw } from 'lucide-react';
import type { GameSessionV2 } from '../types/gameV2.ts';

interface Props { session: GameSessionV2; }

function secondsFromSession(session: GameSessionV2) {
  if (session.timerEndsAt) return Math.max(0, Math.ceil((new Date(session.timerEndsAt).getTime() - Date.now()) / 1000));
  return session.timerPausedSecondsRemaining ?? session.gameDurationMinutes * 60;
}

export const SharedGameTimerV2: React.FC<Props> = ({ session }) => {
  const [remaining, setRemaining] = useState(() => secondsFromSession(session));
  const [resetting, setResetting] = useState(false);
  useEffect(() => {
    setRemaining(secondsFromSession(session));
    if (!session.timerEndsAt) return;
    const id = window.setInterval(() => setRemaining(secondsFromSession(session)), 1000);
    return () => window.clearInterval(id);
  }, [session.timerEndsAt, session.timerPausedSecondsRemaining, session.gameDurationMinutes]);

  const teamStatus = useMemo(() => {
    if (session.phase !== 'respond' || session.isFinalDisruptionActive) return null;
    const stored = localStorage.getItem('tpg_participant');
    let companyId = localStorage.getItem('tpg_company_id');
    try { companyId = stored ? JSON.parse(stored)?.companyId || companyId : companyId; } catch { /* ignore */ }
    const ownEvents = companyId ? (session.activeEvents[companyId] || []) : [];
    const ownComplete = ownEvents.length > 0 && ownEvents.every(event => event.isResolved);
    if (!ownComplete) return 'Complete tasks below';
    const otherTeamsWaiting = session.companies.filter(company => company.id !== companyId && (session.activeEvents[company.id] || []).some(event => !event.isResolved)).length;
    return otherTeamsWaiting ? `Waiting on ${otherTeamsWaiting} other team${otherTeamsWaiting === 1 ? '' : 's'}` : 'All teams complete';
  }, [session]);

  const resetTestGame = async () => {
    if (resetting) return;
    if (!window.confirm('Start a fresh test game in this tab? The current server game will remain available under its existing code.')) return;
    setResetting(true);
    try {
      let playerName = 'Game creator';
      try { playerName = JSON.parse(localStorage.getItem('tpg_participant') || '{}')?.name || playerName; } catch { /* ignore */ }
      const createResponse = await fetch('/api/sessions', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({
          name: 'Test Reset',
          companyNames: session.companies.map(company => company.name),
          experienceMode: session.experienceMode,
          gameDurationMinutes: session.gameDurationMinutes,
          maxPlayersPerCompany: session.maxPlayersPerCompany,
          actionsPerRound: session.config.actions_per_round,
        }),
      });
      const fresh = await createResponse.json();
      if (!createResponse.ok) throw new Error(fresh.error || 'Could not create a fresh game.');
      const companyId = fresh.companies?.[0]?.id;
      const joinResponse = await fetch(`/api/sessions/${fresh.id}/join`, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({name: playerName, companyId, role:'participant'}),
      });
      const joined = await joinResponse.json();
      if (!joinResponse.ok) throw new Error(joined.error || 'Could not join the fresh game.');
      localStorage.setItem('tpg_session_id', joined.session.id);
      localStorage.setItem('tpg_company_id', joined.participant.companyId);
      localStorage.setItem('tpg_participant', JSON.stringify(joined.participant));
      window.location.reload();
    } catch (error:any) {
      setResetting(false);
      window.alert(error?.message || 'Could not reset the test game.');
    }
  };

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const tone = remaining <= 5 * 60 ? 'border-rose-500 bg-rose-950/70' : remaining <= session.finalWindowMinutes * 60 ? 'border-amber-500 bg-amber-950/70' : 'border-emerald-500/70 bg-slate-900/90';

  return <div className="flex items-center justify-end gap-2">
    <button type="button" onClick={resetTestGame} disabled={resetting} title="Temporary playtest control: start a fresh game in this tab" className="flex min-h-11 items-center gap-2 rounded-xl border-2 border-amber-600/70 bg-amber-950/35 px-3 py-2 text-xs font-black uppercase tracking-wide text-amber-200 hover:border-amber-300 hover:bg-amber-950/60 disabled:opacity-50"><RotateCcw className="h-4 w-4"/>{resetting?'Resetting…':'Reset test game'}</button>
    {teamStatus && <div aria-live="polite" className={`rounded-xl border px-3 py-2 text-sm font-black ${teamStatus==='Complete tasks below'?'border-indigo-700 bg-indigo-950/60 text-indigo-200':teamStatus.startsWith('Waiting')?'border-amber-700 bg-amber-950/60 text-amber-200':'border-emerald-700 bg-emerald-950/60 text-emerald-200'}`}>{teamStatus}</div>}
    <div className={`flex items-center gap-3 rounded-2xl border-2 px-4 py-2 text-white shadow-lg ${tone}`} role="timer" aria-label={`${mins} minutes ${secs} seconds remaining`}>
      <Clock className="w-5 h-5" aria-hidden="true"/>
      <div className="leading-none"><div className="text-[10px] uppercase tracking-[0.16em] opacity-70 font-bold">Game time</div><div className="text-2xl font-black tabular-nums mt-1" aria-live="off">{String(mins).padStart(2,'0')}:{String(secs).padStart(2,'0')}</div></div>
    </div>
  </div>;
};
