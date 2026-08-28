import React, { useEffect, useMemo, useState } from 'react';
import { Clock, Pause, Play, RotateCcw, Settings2, Shield, X } from 'lucide-react';
import type { GameSessionV2 } from '../types/gameV2.ts';
import type { Participant } from '../types/game.ts';
import { FacilitatorControlRoom } from './FacilitatorControlRoom.tsx';

interface SharedGameTimerProps {
  session: GameSessionV2;
  isFacilitator?: boolean;
  onSessionUpdate?: (session: GameSessionV2) => void;
}

function secondsFromSession(session: GameSessionV2): number {
  if (session.timerEndsAt) {
    return Math.max(0, Math.ceil((new Date(session.timerEndsAt).getTime() - Date.now()) / 1000));
  }
  return session.timerPausedSecondsRemaining ?? 50 * 60;
}

export const SharedGameTimer: React.FC<SharedGameTimerProps> = ({ session, isFacilitator = false, onSessionUpdate }) => {
  const [remaining, setRemaining] = useState(() => secondsFromSession(session));
  const [showControlRoom, setShowControlRoom] = useState(false);
  const [controlToast, setControlToast] = useState<string | null>(null);
  const [restarting, setRestarting] = useState(false);

  useEffect(() => {
    setRemaining(secondsFromSession(session));
    if (!session.timerEndsAt) return;
    const id = window.setInterval(() => setRemaining(secondsFromSession(session)), 1000);
    return () => window.clearInterval(id);
  }, [session.timerEndsAt, session.timerPausedSecondsRemaining]);

  const isRunning = !!session.timerEndsAt;
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const tone = useMemo(() => remaining <= 5 * 60 ? 'rose' : remaining <= 10 * 60 ? 'amber' : 'emerald', [remaining]);

  const teamStatus = useMemo(() => {
    if (isFacilitator) {
      const waiting = session.companies.filter((company) => {
        const events = session.activeEvents[company.id] || [];
        return session.phase === 'respond' && events.some((event) => !event.isResolved);
      }).length;
      return waiting > 0 ? `${waiting} team${waiting === 1 ? '' : 's'} still responding` : 'All teams ready';
    }

    if (session.phase !== 'respond') return null;
    const companyId = localStorage.getItem('tpg_company_id');
    const ownEvents = companyId ? (session.activeEvents[companyId] || []) : [];
    const ownComplete = ownEvents.length > 0 && ownEvents.every((event) => event.isResolved);
    if (!ownComplete) return 'Complete your tasks below';

    const otherTeamsWaiting = session.companies.filter((company) => {
      if (company.id === companyId) return false;
      const events = session.activeEvents[company.id] || [];
      return events.some((event) => !event.isResolved);
    }).length;

    if (otherTeamsWaiting > 0) return `Waiting on ${otherTeamsWaiting} other team${otherTeamsWaiting === 1 ? '' : 's'}`;
    return 'All teams complete';
  }, [isFacilitator, session]);

  const command = async (action: 'start' | 'pause' | 'reset') => {
    const res = await fetch(`/api/sessions/${session.id}/timer/${action}`, { method: 'POST' });
    if (!res.ok) return;
    const updated = await res.json();
    onSessionUpdate?.(updated);
  };

  const enterFacilitator = async () => {
    const passcode = window.prompt('Facilitator passcode');
    if (!passcode) return;
    const res = await fetch(`/api/sessions/${session.id}/facilitator/override`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passcode, updates: {} }),
    });
    const data = await res.json();
    if (!res.ok || data.success === false) {
      window.alert(data.error || data.message || 'Invalid facilitator passcode.');
      return;
    }

    const storedRaw = localStorage.getItem('tpg_participant');
    let stored: Participant | null = null;
    try { stored = storedRaw ? JSON.parse(storedRaw) as Participant : null; } catch { stored = null; }
    const facilitator: Participant = stored
      ? { ...stored, role: 'facilitator', lastSeen: new Date().toISOString() }
      : {
          id: `fac-${Date.now()}`,
          sessionId: session.id,
          name: 'Facilitator',
          companyId: session.companies[0]?.id || '',
          role: 'facilitator',
          lastSeen: new Date().toISOString(),
        };
    localStorage.setItem('tpg_participant', JSON.stringify(facilitator));
    localStorage.setItem('tpg_session_id', session.id);
    localStorage.setItem('tpg_company_id', facilitator.companyId);
    window.location.reload();
  };

  const restartGame = async () => {
    if (restarting) return;
    const confirmed = window.confirm('End this game and start a fresh one with the same teams? The current game will remain in the database for later AAR analysis.');
    if (!confirmed) return;
    setRestarting(true);
    try {
      const sessionId = `KM${Math.floor(1000 + Math.random() * 9000)}`;
      const createRes = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, title: session.title || 'The Performance Gap', companyNames: session.companies.map((company) => company.name) }),
      });
      const created = await createRes.json();
      if (!createRes.ok) throw new Error(created.error || 'Could not create a fresh game.');

      const joinRes = await fetch(`/api/sessions/${created.id}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Facilitator', companyId: created.companies[0]?.id, role: 'facilitator' }),
      });
      const joined = await joinRes.json();
      if (!joinRes.ok) throw new Error(joined.error || 'Fresh game was created but facilitator could not join it.');

      localStorage.setItem('tpg_session_id', joined.session.id);
      localStorage.setItem('tpg_company_id', joined.participant.companyId);
      localStorage.setItem('tpg_participant_id', joined.participant.id);
      localStorage.setItem('tpg_participant', JSON.stringify(joined.participant));
      window.location.reload();
    } catch (error: any) {
      setRestarting(false);
      window.alert(error.message || 'Could not restart the game.');
    }
  };

  const toneClasses = tone === 'rose'
    ? 'bg-rose-950/70 border-rose-500 text-rose-100'
    : tone === 'amber'
      ? 'bg-amber-950/70 border-amber-500 text-amber-100'
      : 'bg-slate-900/90 border-emerald-500/70 text-white';

  const showToast = (message: string) => {
    setControlToast(message);
    window.setTimeout(() => setControlToast((current) => current === message ? null : current), 4500);
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {teamStatus && (
          <div className={`rounded-xl border px-3 py-2 text-sm font-black ${teamStatus.startsWith('Waiting') || teamStatus.includes('still responding') ? 'border-amber-700 bg-amber-950/60 text-amber-200' : teamStatus.includes('Complete your') ? 'border-indigo-700 bg-indigo-950/60 text-indigo-200' : 'border-emerald-700 bg-emerald-950/60 text-emerald-200'}`}>
            {teamStatus}
          </div>
        )}

        {!isFacilitator && (
          <button onClick={enterFacilitator} className="rounded-xl border border-indigo-700 bg-indigo-950/60 px-3 py-2 text-xs font-black text-indigo-200 hover:bg-indigo-900/70 flex items-center gap-2">
            <Shield className="w-4 h-4" />Facilitator
          </button>
        )}

        {isFacilitator && (
          <button onClick={() => setShowControlRoom(true)} className="rounded-xl border border-indigo-500 bg-indigo-600 px-3 py-2 text-xs font-black text-white hover:bg-indigo-500 flex items-center gap-2">
            <Shield className="w-4 h-4" />Facilitator
          </button>
        )}

        <div className={`flex items-center gap-3 rounded-2xl border-2 px-4 py-2 shadow-lg ${toneClasses}`}>
          <Clock className={`w-5 h-5 ${tone === 'rose' ? 'animate-pulse' : ''}`} />
          <div className="leading-none">
            <div className="text-[10px] uppercase tracking-[0.16em] opacity-70 font-bold">Game time</div>
            <div className="text-2xl font-black tabular-nums mt-1">{String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}</div>
          </div>
          {isFacilitator && (
            <div className="flex gap-1 pl-2 border-l border-white/15">
              <button className="rounded-lg bg-white/10 hover:bg-white/20 px-2.5 py-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide" onClick={() => command(isRunning ? 'pause' : 'start')} title={isRunning ? 'Pause shared timer' : 'Start shared timer'}>
                {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {isRunning ? 'Pause' : 'Start'}
              </button>
              <button className="p-2 rounded-full hover:bg-white/10" onClick={() => command('reset')} title="Reset to 50 minutes">
                <RotateCcw className="w-4 h-4" />
              </button>
              <button className="p-2 rounded-full hover:bg-white/10" onClick={() => setShowControlRoom(true)} title="Open facilitator control room">
                <Settings2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {isFacilitator && showControlRoom && (
        <div className="fixed inset-0 z-[200] overflow-y-auto bg-[#080b12]/98 p-4 md:p-6">
          <div className="mx-auto max-w-[1500px]">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div><div className="text-xs font-black uppercase tracking-[0.18em] text-indigo-400">The Performance Gap</div><div className="text-xl font-black text-white">Facilitator view</div></div>
              <div className="flex items-center gap-2">
                <button onClick={restartGame} disabled={restarting} className="rounded-xl border border-rose-700 bg-rose-950/60 px-4 py-3 text-xs font-black text-rose-200 hover:bg-rose-900/70 disabled:opacity-50">
                  {restarting ? 'Starting new game…' : 'End & restart game'}
                </button>
                <button onClick={() => setShowControlRoom(false)} className="rounded-xl border border-slate-700 bg-slate-900 p-3 text-white hover:bg-slate-800" title="Close control room"><X className="h-5 w-5"/></button>
              </div>
            </div>
            <FacilitatorControlRoom session={session} onSessionUpdate={(next) => onSessionUpdate?.(next)} onToast={showToast} />
          </div>
          {controlToast && <div className="fixed bottom-5 right-5 z-[220] max-w-md rounded-2xl bg-white px-5 py-3 font-bold text-slate-950 shadow-2xl">{controlToast}</div>}
        </div>
      )}
    </>
  );
};
