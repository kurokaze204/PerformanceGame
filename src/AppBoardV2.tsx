import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowRight, Building2, Shield } from 'lucide-react';
import type { KnowledgeDomain, Participant } from './types/game.ts';
import type { ActiveEventV2, BusinessStrategy, CompanyV2, GameSessionV2, KnowledgeStrategy } from './types/gameV2.ts';
import { AustraliaMap } from './components/AustraliaMap.tsx';
import type { SiteImpactEffect } from './components/AustraliaMap.tsx';
import { EventDecisionCardV3 } from './components/EventDecisionCardV3.tsx';
import { ActionTokens } from './components/ActionTokens.tsx';
import { SharedGameTimer } from './components/SharedGameTimer.tsx';
import { ActionsPanel } from './components/ActionsPanel.tsx';
import { AttritionModal } from './components/AttritionModal.tsx';
import { FinalDisruptionModal } from './components/FinalDisruptionModal.tsx';
import { SessionJoinModal } from './components/SessionJoinModal.tsx';
import { StrategyPromptV2 } from './components/StrategyPromptV2.tsx';
import { FacilitatorControlRoom } from './components/FacilitatorControlRoom.tsx';
import { BoardShell } from './components/BoardShell.tsx';
import { BoardSidePanel } from './components/BoardSidePanel.tsx';
import { GameStartOverlay } from './components/GameStartOverlay.tsx';
import { formatCurrency } from './utils/format.ts';

type StartStep = 'intro' | 'explore' | 'play';

const PHASE_LABELS: Record<GameSessionV2['phase'], string> = {
  events: 'Challenges', respond: 'Challenges', consequences: 'Results', investment: 'Invest', risk: 'Knowledge Risk',
};

function participantFromStorage(): Participant | null {
  const raw = localStorage.getItem('tpg_participant');
  if (!raw) return null;
  try { return JSON.parse(raw) as Participant; } catch { return null; }
}

export function AppBoardV2() {
  const [session, setSession] = useState<GameSessionV2 | null>(null);
  const [participant, setParticipant] = useState<Participant | null>(() => participantFromStorage());
  const [showJoin, setShowJoin] = useState(() => !participantFromStorage());
  const [selectedSiteId, setSelectedSiteId] = useState('melbourne');
  const [isHQSelected, setIsHQSelected] = useState(false);
  const [selectedEventIndex, setSelectedEventIndex] = useState(0);
  const [notification, setNotification] = useState<string | null>(null);
  const [impactEffect, setImpactEffect] = useState<SiteImpactEffect | null>(null);
  const [showFacilitatorRoom, setShowFacilitatorRoom] = useState(false);
  const [startStep, setStartStep] = useState<StartStep>('intro');
  const deferSessionUpdates = useRef(false);

  const toast = (message: string) => {
    setNotification(message);
    window.setTimeout(() => setNotification((value) => value === message ? null : value), 4000);
  };

  const selectSite = (siteId: string) => { setSelectedSiteId(siteId); setIsHQSelected(false); };
  const setStart = (next: StartStep, sessionId = session?.id) => {
    setStartStep(next);
    if (sessionId) localStorage.setItem(`tpg_game_start_${sessionId}`, next);
  };

  const showFinancialImpact = (nextSession: GameSessionV2, extraData: any) => {
    const companyId = participant?.companyId || localStorage.getItem('tpg_company_id');
    if (!companyId || extraData?.companyId !== companyId) return;
    const amount = Number(extraData?.result?.turnoverChange || 0);
    if (!amount) return;
    const companyNow = nextSession.companies.find((candidate) => candidate.id === companyId);
    if (!companyNow) return;
    const enterprise = extraData?.scope === 'enterprise';
    const siteIds = enterprise ? companyNow.sites.filter((site) => !site.isClosed).map((site) => site.id) : extraData?.targetSiteId ? [String(extraData.targetSiteId)] : [];
    if (!siteIds.length) return;
    if (!enterprise) selectSite(siteIds[0]);
    const effect: SiteImpactEffect = { id: `${extraData.eventInstanceId}-${Date.now()}`, siteIds, amount, enterprise };
    window.setTimeout(() => setImpactEffect(effect), 250);
    window.setTimeout(() => setImpactEffect((current) => current?.id === effect.id ? null : current), 4450);
  };

  useEffect(() => {
    const storedSession = localStorage.getItem('tpg_session_id');
    const load = async () => {
      if (storedSession) {
        const res = await fetch(`/api/sessions/${storedSession}`);
        if (res.ok) { setSession(await res.json()); return; }
      }
      const res = await fetch('/api/sessions/default');
      if (res.ok) setSession(await res.json());
      setShowJoin(true);
    };
    load().catch(() => setShowJoin(true));
  }, []);

  useEffect(() => {
    if (!session?.id) return;
    const stored = localStorage.getItem(`tpg_game_start_${session.id}`);
    setStartStep(stored === 'explore' || stored === 'play' ? stored : 'intro');
  }, [session?.id]);

  useEffect(() => {
    if (!session?.id) return;
    const stream = new EventSource(`/api/sessions/${session.id}/stream`);
    stream.onmessage = (message) => {
      try {
        const data = JSON.parse(message.data);
        if (!data.session) return;
        if (deferSessionUpdates.current && ['EVENT_RESOLVED', 'CHALLENGES_COMPLETE', 'PHASE_ADVANCED'].includes(data.type)) return;
        if (data.type === 'EVENT_RESOLVED') showFinancialImpact(data.session, data.extraData);
        setSession(data.session);
      } catch { /* keepalive */ }
    };
    return () => stream.close();
  }, [session?.id, participant?.companyId]);

  const company: CompanyV2 | undefined = useMemo(() => {
    if (!session) return undefined;
    const companyId = participant?.companyId || localStorage.getItem('tpg_company_id');
    return session.companies.find((candidate) => candidate.id === companyId) || session.companies[0];
  }, [participant?.companyId, session]);

  useEffect(() => {
    if (!company) return;
    if (!company.sites.some((site) => site.id === selectedSiteId && !site.isClosed)) setSelectedSiteId(company.sites.find((site) => !site.isClosed)?.id || 'melbourne');
  }, [company, selectedSiteId]);

  useEffect(() => {
    if (!session || session.phase !== 'consequences' || deferSessionUpdates.current) return;
    fetch(`/api/sessions/${session.id}/advance-phase`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => { if (ok && data.success !== false) setSession(data.session); })
      .catch(() => undefined);
  }, [session?.id, session?.phase]);

  const join = async (sessionId: string, requestedCompanyId: string, playerName: string) => {
    const getRes = await fetch(`/api/sessions/${sessionId.toUpperCase()}`);
    if (!getRes.ok) { toast('Game code not found.'); return; }
    const found: GameSessionV2 = await getRes.json();
    const companyId = requestedCompanyId || found.companies[0]?.id;
    const res = await fetch(`/api/sessions/${found.id}/join`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: playerName || 'Player', companyId, role: 'participant' }) });
    if (!res.ok) { toast('Could not join this game.'); return; }
    const data = await res.json();
    setSession(data.session); setParticipant(data.participant); setShowJoin(false); setIsHQSelected(false); setShowFacilitatorRoom(false); setStartStep('intro');
    localStorage.setItem('tpg_session_id', data.session.id); localStorage.setItem('tpg_company_id', data.participant.companyId); localStorage.setItem('tpg_participant_id', data.participant.id); localStorage.setItem('tpg_participant', JSON.stringify(data.participant));
    localStorage.removeItem(`tpg_game_start_${data.session.id}`);
  };

  const create = async (name: string, companyCount: number) => {
    const res = await fetch('/api/sessions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, companyCount }) });
    if (!res.ok) { toast('Could not create the game.'); return; }
    const created: GameSessionV2 = await res.json();
    const joinRes = await fetch(`/api/sessions/${created.id}/join`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Facilitator', companyId: created.companies[0]?.id, role: 'facilitator' }) });
    const data = await joinRes.json();
    setSession(data.session); setParticipant(data.participant); setShowJoin(false); setIsHQSelected(false); setShowFacilitatorRoom(false); setStartStep('intro');
    localStorage.setItem('tpg_session_id', data.session.id); localStorage.setItem('tpg_company_id', data.participant.companyId); localStorage.setItem('tpg_participant_id', data.participant.id); localStorage.setItem('tpg_participant', JSON.stringify(data.participant));
    localStorage.removeItem(`tpg_game_start_${data.session.id}`);
  };

  const solo = () => create('Solo Performance Gap', 1);

  const enterFacilitatorMode = async () => {
    if (!session) return;
    const passcode = window.prompt('Facilitator passcode');
    if (!passcode) return;
    const res = await fetch(`/api/sessions/${session.id}/facilitator/override`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ passcode, updates: {} }) });
    const data = await res.json();
    if (!res.ok || data.success === false) { toast(data.error || data.message || 'Invalid facilitator passcode.'); return; }
    const facilitatorParticipant: Participant = participant ? { ...participant, role: 'facilitator', lastSeen: new Date().toISOString() } : { id: `fac-${Date.now()}`, sessionId: session.id, name: 'Facilitator', companyId: session.companies[0]?.id || '', role: 'facilitator', lastSeen: new Date().toISOString() };
    setParticipant(facilitatorParticipant); localStorage.setItem('tpg_participant', JSON.stringify(facilitatorParticipant)); setSession(data.session || session); setShowFacilitatorRoom(true);
  };

  const submitStrategy = async (stage: 'initial' | 'final', business: BusinessStrategy, knowledge: KnowledgeStrategy) => {
    if (!session || !company) return;
    const res = await fetch(`/api/sessions/${session.id}/strategy`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ companyId: company.id, stage, businessStrategy: business, knowledgeStrategy: knowledge }) });
    const data = await res.json(); if (!res.ok) { toast(data.error || 'Could not record strategy.'); return; } setSession(data.session);
  };

  const advancePhase = async () => {
    if (!session) return;
    const res = await fetch(`/api/sessions/${session.id}/advance-phase`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    const data = await res.json(); if (!res.ok || data.success === false) { toast(data.message || data.error || 'Cannot advance yet.'); return; } setSession(data.session); setSelectedEventIndex(0);
  };

  const setAllocation = async (eventId: string, domain: KnowledgeDomain, allocation: any) => {
    if (!session || !company) return;
    const res = await fetch(`/api/sessions/${session.id}/events/allocate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ companyId: company.id, eventInstanceId: eventId, domain, allocation }) });
    const data = await res.json(); if (!res.ok) { toast(data.message || data.error || 'That option is not available.'); return; } setSession(data.session);
  };

  const resolveEvent = async (eventId: string) => {
    if (!session || !company) return null;
    deferSessionUpdates.current = true;
    const res = await fetch(`/api/sessions/${session.id}/resolve-event`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ companyId: company.id, eventInstanceId: eventId }) });
    const data = await res.json();
    if (!res.ok) { deferSessionUpdates.current = false; toast(data.message || data.error || 'Event could not be resolved.'); throw new Error(data.message || data.error || 'Event could not be resolved.'); }
    const resolvedEvent = (data.session.activeEvents[company.id] || []).find((entry: ActiveEventV2) => entry.instanceId === eventId);
    if (resolvedEvent) showFinancialImpact(data.session, { companyId: company.id, eventInstanceId: eventId, targetSiteId: resolvedEvent.targetSiteId, scope: resolvedEvent.card.scope, result: data.result });
    setSession(data.session);
    return data;
  };

  const acknowledgeResolution = async () => {
    if (!session || !company) return;
    deferSessionUpdates.current = false;
    const refreshed = session.activeEvents[company.id] || [];
    const next = refreshed.findIndex((event) => !event.isResolved);
    if (next >= 0) {
      setSelectedEventIndex(next);
      const nextEvent = refreshed[next];
      if (nextEvent.targetSiteId) selectSite(nextEvent.targetSiteId);
      return;
    }
    if (session.phase === 'consequences') {
      const res = await fetch(`/api/sessions/${session.id}/advance-phase`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const data = await res.json();
      if (res.ok && data.success !== false) { setSession(data.session); setSelectedEventIndex(0); }
      else toast(data.message || data.error || 'Could not proceed to investment.');
    }
  };

  const redrawEvent = async (eventId: string) => {
    if (!session || !company) return;
    const res = await fetch(`/api/sessions/${session.id}/redraw-event`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ companyId: company.id, eventInstanceId: eventId }) });
    const data = await res.json(); if (!res.ok) { toast(data.message || data.error || 'Redraw not available.'); return; } setSession(data.session); toast(data.message || 'Event replaced.');
  };

  const performAction = async (actionType: string, params: any = {}) => {
    if (!session || !company) return;
    const res = await fetch(`/api/sessions/${session.id}/action`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ companyId: company.id, actionType, params }) });
    const data = await res.json(); if (!res.ok) { toast(data.message || data.error || 'Action unavailable.'); return; } setSession(data.session); toast(data.message || 'Action completed.');
  };

  if (!session || !company) return <div className="min-h-screen bg-slate-950 text-white grid place-items-center">Loading The Performance Gap…</div>;

  const events = session.activeEvents[company.id] || [];
  const selectedEvent = events[Math.min(selectedEventIndex, Math.max(0, events.length - 1))];
  const isFacilitator = participant?.role === 'facilitator';
  const playPhases = ['respond', 'investment', 'risk'] as const;
  const currentPhaseIndex = playPhases.indexOf(session.phase as typeof playPhases[number]);
  const horizonCanRedraw = selectedEvent && company.horizonScanAvailableRound === session.round && !company.horizonScanUsedThisRound && !!company.horizonScanDomain && selectedEvent.card.domains.some((requirement) => requirement.domain === company.horizonScanDomain);
  const needsInitialStrategy = !!participant && !isFacilitator && startStep === 'play' && !company.knowledgeStrategyInitial;
  const needsFinalStrategy = !!participant && !isFacilitator && !!session.finalDisruptionResolved && !company.knowledgeStrategyFinal;

  const teamCompletion = session.companies.map((team) => ({ id: team.id, complete: (session.activeEvents[team.id] || []).every((event) => event.isResolved) }));
  const currentTeamComplete = teamCompletion.find((team) => team.id === company.id)?.complete ?? false;
  const otherTeamsWaitingOn = teamCompletion.filter((team) => team.id !== company.id && !team.complete).length;
  const incompleteTeams = teamCompletion.filter((team) => !team.complete).length;
  const progressMessage = startStep !== 'play'
    ? startStep === 'intro' ? 'Welcome to the game' : 'Explore your organisation'
    : session.phase === 'respond'
      ? isFacilitator ? incompleteTeams === 0 ? 'All teams complete' : `${incompleteTeams} team${incompleteTeams === 1 ? '' : 's'} still responding` : !currentTeamComplete ? 'Complete your tasks below' : otherTeamsWaitingOn > 0 ? `Waiting on ${otherTeamsWaitingOn} other team${otherTeamsWaitingOn === 1 ? '' : 's'}` : 'All teams complete'
      : 'Complete your tasks below';

  const board = <AustraliaMap company={company} selectedSiteId={isHQSelected ? null : selectedSiteId} onSelectSite={selectSite} onSelectHQ={() => setIsHQSelected(true)} isHQSelected={isHQSelected} onSelectExpert={() => undefined} impactEffect={impactEffect} />;
  const sidePanel = <BoardSidePanel session={session} company={company} selectedSiteId={selectedSiteId} isHQSelected={isHQSelected} currentEvent={startStep === 'play' && session.phase === 'respond' ? selectedEvent : undefined} onSelectSite={selectSite} onSelectHQ={() => setIsHQSelected(true)} />;

  let phaseOverlay: React.ReactNode = null;
  if (startStep === 'intro') {
    phaseOverlay = <GameStartOverlay onStart={() => setStart('explore')} />;
  } else if (startStep === 'play' && session.phase === 'respond' && !session.isFinalDisruptionActive && selectedEvent) {
    phaseOverlay = <div className="w-full max-w-[940px] pr-2"><EventDecisionCardV3 session={session} company={company} event={selectedEvent} cardNumber={selectedEventIndex + 1} onSetAllocation={setAllocation} onResolveEvent={resolveEvent} onAcknowledgeResolution={acknowledgeResolution} onRedrawEvent={redrawEvent} canHorizonRedraw={!!horizonCanRedraw}/><div className="mt-2 text-[11px] font-black uppercase tracking-[0.16em] text-slate-400 bg-slate-950/80 border border-slate-800 rounded-full px-3 py-2 inline-block">Challenge {Math.min(selectedEventIndex + 1, events.length)} of {events.length}</div></div>;
  } else if (startStep === 'play' && session.phase === 'investment') {
    phaseOverlay = <div className="w-full rounded-3xl border border-slate-700 bg-slate-950/95 p-5 shadow-2xl"><div className="text-center"><h2 className="text-2xl font-black text-white">Invest in next round's capability</h2><p className="text-slate-400 mt-1">Use the same knowledge mechanisms deliberately to strengthen future capability.</p></div><div className="mt-5"><ActionTokens remaining={company.actionsRemaining} total={session.config.actions_per_round}/></div><div className="mt-5"><ActionsPanel session={session} company={company} onPerformAction={performAction} onNextPhase={advancePhase}/></div></div>;
  } else if (startStep === 'play' && session.phase === 'risk') {
    phaseOverlay = <div className="w-full"><AttritionModal session={session} company={company} phaseResult={{ attritionSummaries: session.riskResults || {} }} onAdvanceToNextRound={advancePhase}/></div>;
  }

  return (
    <div className="min-h-screen bg-[#080b12] text-slate-200">
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-[#0d111b]/95 backdrop-blur px-4 py-3">
        <div className="max-w-[1500px] mx-auto flex flex-wrap items-center justify-between gap-3">
          <div><div className="text-xs uppercase tracking-[0.22em] text-indigo-400 font-black">The Performance Gap</div><div className="flex items-center gap-2 mt-1"><Building2 className="w-5 h-5 text-slate-400"/><h1 className="text-xl font-black text-white">{isFacilitator && showFacilitatorRoom ? 'Facilitator Control Room' : company.name}</h1><span className="text-xs text-slate-500">Session {session.id}</span></div></div>
          <div className="flex items-center gap-3">
            {!isFacilitator && <button onClick={enterFacilitatorMode} className="rounded-xl border border-indigo-700 bg-indigo-950/50 px-3 py-2 text-xs font-black text-indigo-200 hover:bg-indigo-900/60 flex items-center gap-2"><Shield className="w-4 h-4"/>Facilitator</button>}
            {isFacilitator && <button onClick={() => setShowFacilitatorRoom((value) => !value)} className={`rounded-xl border px-3 py-2 text-xs font-black flex items-center gap-2 ${showFacilitatorRoom ? 'border-indigo-400 bg-indigo-600 text-white' : 'border-indigo-700 bg-indigo-950/50 text-indigo-200'}`}><Shield className="w-4 h-4"/>{showFacilitatorRoom ? 'Return to game' : 'Control Room'}</button>}
            {!showFacilitatorRoom && <div className="rounded-2xl bg-slate-900 border border-slate-700 px-4 py-2"><div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Turnover</div><div className="text-xl font-black text-white">{formatCurrency(company.turnover)}</div></div>}
            <SharedGameTimer session={session} isFacilitator={isFacilitator} onSessionUpdate={setSession}/>
          </div>
        </div>
      </header>

      <main className="max-w-[1500px] mx-auto px-4 py-4 space-y-4">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-wrap">
            <div className={`rounded-full px-4 py-2 text-sm font-black ${startStep !== 'play' ? 'bg-indigo-500 text-white' : 'bg-emerald-950 text-emerald-300 border border-emerald-800'}`}>Game Start</div><ArrowRight className="w-4 h-4 text-slate-700"/>
            {playPhases.map((phase, index) => <React.Fragment key={phase}><div className={`rounded-full px-4 py-2 text-sm font-black ${startStep === 'play' && phase === session.phase ? 'bg-indigo-500 text-white' : startStep === 'play' && index < currentPhaseIndex ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-slate-950 text-slate-600 border border-slate-800'}`}>{PHASE_LABELS[phase]}</div>{index < playPhases.length - 1 && <ArrowRight className="w-4 h-4 text-slate-700"/>}</React.Fragment>)}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {startStep === 'explore' ? <button onClick={() => setStart('play')} className="rounded-xl bg-white text-slate-950 px-5 py-2.5 font-black flex items-center gap-2">Next Step <ArrowRight className="w-4 h-4"/></button> : <span className="rounded-full px-3 py-1.5 text-xs font-black bg-slate-950 text-slate-300 border border-slate-700">{progressMessage}</span>}
            <span className="font-bold text-white">Round {Math.min(session.round, session.config.rounds)} of {session.config.rounds}</span>
            {isFacilitator && startStep === 'play' && !showFacilitatorRoom && session.phase !== 'respond' && session.round <= session.config.rounds && <button onClick={advancePhase} className="rounded-xl bg-white text-slate-950 px-4 py-2 font-black">Next stage</button>}
          </div>
        </section>

        {isFacilitator && showFacilitatorRoom ? <FacilitatorControlRoom session={session} onSessionUpdate={setSession} onToast={toast}/> : <BoardShell board={board} sidePanel={sidePanel} overlay={phaseOverlay}/>} 
      </main>

      {showJoin && <SessionJoinModal currentSession={session} onJoinSession={join} onCreateNewSession={create} onSoloStart={solo}/>} 
      {needsInitialStrategy && <StrategyPromptV2 stage="initial" onSubmit={(business, knowledge) => submitStrategy('initial', business, knowledge)}/>} 
      {needsFinalStrategy && <StrategyPromptV2 stage="final" originalBusinessStrategy={company.businessStrategyInitial} originalKnowledgeStrategy={company.knowledgeStrategyInitial} onSubmit={(business, knowledge) => submitStrategy('final', business, knowledge)}/>} 
      {startStep === 'play' && session.isFinalDisruptionActive && <FinalDisruptionModal session={session} company={company} onResolveFinalDisruption={async()=>{const res=await fetch(`/api/sessions/${session.id}/resolve-final-disruption`,{method:'POST'});const data=await res.json();if(data.session)setSession(data.session);}} onOpenAAR={()=>toast('AAR evidence is now being captured; chart presentation is the next UI pass.')}/>} 
      {notification && <div className="fixed bottom-5 right-5 z-[100] rounded-2xl bg-white text-slate-950 px-5 py-3 shadow-2xl font-bold max-w-md flex items-start gap-2"><AlertTriangle className="w-5 h-5 text-amber-600 shrink-0"/>{notification}</div>}
    </div>
  );
}

export default AppBoardV2;
