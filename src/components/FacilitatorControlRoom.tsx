import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, Database, Play, RefreshCw, Shield, Trash2, Users } from 'lucide-react';
import type { GameSessionV2 } from '../types/gameV2.ts';
import { formatCurrency } from '../utils/format.ts';

interface FacilitatorControlRoomProps {
  session: GameSessionV2;
  onSessionUpdate: (session: GameSessionV2) => void;
  onToast: (message: string) => void;
}

interface GameLogRow {
  id: string;
  timestamp: string;
  companyId?: string;
  eventType: string;
  title: string;
  description: string;
}

export const FacilitatorControlRoom: React.FC<FacilitatorControlRoomProps> = ({ session, onSessionUpdate, onToast }) => {
  const [passcode, setPasscode] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [wipeConfirm, setWipeConfirm] = useState('');
  const [logs, setLogs] = useState<GameLogRow[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`/api/sessions/${session.id}/logs`)
      .then((r) => r.ok ? r.json() : [])
      .then((rows) => setLogs(Array.isArray(rows) ? rows.slice(-30).reverse() : []))
      .catch(() => undefined);
  }, [session.id, session.updatedAt]);

  const rows = useMemo(() => session.companies.map((company) => {
    const events = session.activeEvents[company.id] || [];
    const resolved = events.filter((event) => event.isResolved).length;
    const total = events.length;
    return {
      company,
      resolved,
      total,
      ready: total > 0 && resolved === total,
    };
  }), [session]);

  const readyCount = rows.filter((row) => row.ready).length;
  const unfinishedCount = rows.length - readyCount;

  const post = async (url: string, body: any = {}) => {
    setBusy(true);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || data.success === false) throw new Error(data.message || data.error || 'Request failed.');
      return data;
    } finally {
      setBusy(false);
    }
  };

  const nextStage = async () => {
    try {
      const data = await post(`/api/sessions/${session.id}/advance-phase`);
      if (data.session) onSessionUpdate(data.session);
    } catch (error: any) { onToast(error.message || 'Could not advance the game.'); }
  };

  const timerAction = async (action: 'start' | 'pause' | 'reset') => {
    try {
      const next = await post(`/api/sessions/${session.id}/timer/${action}`);
      onSessionUpdate(next);
    } catch (error: any) { onToast(error.message || 'Timer action failed.'); }
  };

  const deleteCurrentGame = async () => {
    if (deleteConfirm !== session.id) return onToast(`Type ${session.id} to confirm deletion.`);
    try {
      const data = await post(`/api/sessions/${session.id}/delete`, { passcode });
      if (data.nextSession) {
        onSessionUpdate(data.nextSession);
        localStorage.setItem('tpg_session_id', data.nextSession.id);
      }
      setDeleteConfirm('');
      onToast(`${session.id} was permanently deleted.`);
    } catch (error: any) { onToast(error.message || 'Could not delete the game.'); }
  };

  const wipeAllTestData = async () => {
    if (wipeConfirm !== 'WIPE') return onToast('Type WIPE to confirm the full test-data reset.');
    try {
      const data = await post('/api/admin/reset-database', { passcode });
      if (data.defaultSession) {
        onSessionUpdate(data.defaultSession);
        localStorage.setItem('tpg_session_id', data.defaultSession.id);
      }
      setWipeConfirm('');
      onToast('All Performance Gap test data was wiped and a fresh default game was created.');
    } catch (error: any) { onToast(error.message || 'Could not wipe test data.'); }
  };

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-indigo-800/60 bg-slate-900/70 p-5 shadow-xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-indigo-300"><Shield className="h-4 w-4"/>Facilitator control room</div>
            <h2 className="mt-2 text-2xl font-black text-white">{session.title}</h2>
            <div className="mt-1 text-sm text-slate-400">Session {session.id} · Round {Math.min(session.round, session.config.rounds)} of {session.config.rounds} · {session.phase}</div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <Stat label="Teams" value={String(rows.length)} />
            <Stat label="Ready" value={String(readyCount)} good={readyCount > 0} />
            <Stat label="Waiting" value={String(unfinishedCount)} warn={unfinishedCount > 0} />
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/60">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <div><h3 className="font-black text-white">Live teams</h3><p className="text-xs text-slate-500">See immediately who is holding up the shared phase.</p></div>
          <Users className="h-5 w-5 text-slate-500" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-slate-950/70 text-left text-[10px] uppercase tracking-widest text-slate-500"><tr><th className="px-4 py-3">Company</th><th className="px-4 py-3">Challenges</th><th className="px-4 py-3">Turnover</th><th className="px-4 py-3">Actions</th><th className="px-4 py-3">Reputation</th><th className="px-4 py-3">Status</th></tr></thead>
            <tbody>
              {rows.map(({ company, resolved, total, ready }) => (
                <tr key={company.id} className="border-t border-slate-800/80">
                  <td className="px-4 py-3 font-bold text-white">{company.name}</td>
                  <td className="px-4 py-3"><span className="font-black text-white">{resolved}/{total}</span></td>
                  <td className="px-4 py-3 font-mono text-slate-300">{formatCurrency(company.turnover)}</td>
                  <td className="px-4 py-3 text-slate-300">{company.actionsRemaining}</td>
                  <td className="px-4 py-3 text-slate-300">{company.reputationPoints}</td>
                  <td className="px-4 py-3">{ready ? <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-950 px-2.5 py-1 text-xs font-bold text-emerald-300"><CheckCircle2 className="h-3.5 w-3.5"/>Ready for Results</span> : <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-950 px-2.5 py-1 text-xs font-bold text-amber-300"><Clock3 className="h-3.5 w-3.5"/>Still responding</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-5">
          <h3 className="font-black text-white">Selected game controls</h3>
          <p className="mt-1 text-xs text-slate-500">Use these to recover a workshop without editing company decisions.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button disabled={busy} onClick={nextStage} className="rounded-xl bg-white px-4 py-2 font-black text-slate-950 disabled:opacity-50"><Play className="mr-2 inline h-4 w-4"/>Next stage</button>
            <button disabled={busy} onClick={() => timerAction(session.timerEndsAt ? 'pause' : 'start')} className="rounded-xl border border-slate-600 bg-slate-950 px-4 py-2 font-bold text-white disabled:opacity-50">{session.timerEndsAt ? 'Pause timer' : 'Start timer'}</button>
            <button disabled={busy} onClick={() => timerAction('reset')} className="rounded-xl border border-slate-600 bg-slate-950 px-4 py-2 font-bold text-white disabled:opacity-50"><RefreshCw className="mr-2 inline h-4 w-4"/>Reset timer</button>
          </div>
          {session.phase === 'respond' && unfinishedCount > 0 && <div className="mt-4 rounded-xl border border-amber-800 bg-amber-950/40 p-3 text-sm text-amber-200"><AlertTriangle className="mr-2 inline h-4 w-4"/>Results are waiting on {unfinishedCount} team{unfinishedCount === 1 ? '' : 's'}.</div>}
        </div>

        <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-5">
          <h3 className="font-black text-white">Activity feed</h3>
          <div className="mt-3 max-h-64 space-y-2 overflow-auto pr-1">
            {logs.length === 0 && <div className="text-sm text-slate-500">No recorded activity yet.</div>}
            {logs.map((log) => (
              <div key={log.id} className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2">
                <div className="flex justify-between gap-3"><span className="text-xs font-bold text-white">{log.title}</span><span className="shrink-0 text-[10px] text-slate-600">{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div>
                <div className="mt-1 text-[11px] leading-snug text-slate-500">{log.description}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-rose-900/70 bg-rose-950/20 p-5">
        <div className="flex items-center gap-2"><Database className="h-5 w-5 text-rose-300"/><h3 className="font-black text-white">Data management</h3></div>
        <p className="mt-1 text-xs text-slate-500">Destructive operations require the facilitator secret. Delete removes the session, participants, logs and analytics for that run.</p>
        <label className="mt-4 block max-w-sm"><span className="text-xs font-bold text-slate-400">Facilitator passcode</span><input type="password" value={passcode} onChange={(e) => setPasscode(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-indigo-500" /></label>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-rose-900/60 bg-slate-950/60 p-4">
            <div className="font-black text-white">Delete this game</div><div className="mt-1 text-xs text-slate-500">Type <b className="text-rose-300">{session.id}</b> to permanently remove this run.</div>
            <div className="mt-3 flex gap-2"><input value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value.toUpperCase())} placeholder={session.id} className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white"/><button disabled={busy || deleteConfirm !== session.id || !passcode} onClick={deleteCurrentGame} className="rounded-xl bg-rose-700 px-4 py-2 font-black text-white disabled:opacity-30"><Trash2 className="mr-1 inline h-4 w-4"/>Delete</button></div>
          </div>
          <div className="rounded-2xl border border-rose-900/60 bg-slate-950/60 p-4">
            <div className="font-black text-white">Wipe all test data</div><div className="mt-1 text-xs text-slate-500">Removes every Performance Gap run and recreates a clean default session. Type <b className="text-rose-300">WIPE</b>.</div>
            <div className="mt-3 flex gap-2"><input value={wipeConfirm} onChange={(e) => setWipeConfirm(e.target.value.toUpperCase())} placeholder="WIPE" className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white"/><button disabled={busy || wipeConfirm !== 'WIPE' || !passcode} onClick={wipeAllTestData} className="rounded-xl bg-rose-900 px-4 py-2 font-black text-white disabled:opacity-30">Wipe all</button></div>
          </div>
        </div>
      </section>
    </div>
  );
};

const Stat: React.FC<{ label: string; value: string; good?: boolean; warn?: boolean }> = ({ label, value, good, warn }) => (
  <div className={`min-w-20 rounded-2xl border px-3 py-2 ${good ? 'border-emerald-800 bg-emerald-950/40' : warn ? 'border-amber-800 bg-amber-950/40' : 'border-slate-700 bg-slate-950/60'}`}><div className="text-[9px] font-bold uppercase tracking-widest text-slate-500">{label}</div><div className="text-xl font-black text-white">{value}</div></div>
);
