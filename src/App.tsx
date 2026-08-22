import React, { useState, useEffect } from 'react';
import { GameSession, Company, Site, Expert, KnowledgeDomain } from './types/game.ts';
import { Header } from './components/Header.tsx';
import { TurnPhaseGuide } from './components/TurnPhaseGuide.tsx';
import { AustraliaMap } from './components/AustraliaMap.tsx';
import { SiteKnowledgePanel } from './components/SiteKnowledgePanel.tsx';
import { CorporateHQPanel } from './components/CorporateHQPanel.tsx';
import { ExpertModal } from './components/ExpertModal.tsx';
import { EventResolutionModal } from './components/EventResolutionModal.tsx';
import { ConsequencesModal } from './components/ConsequencesModal.tsx';
import { ActionsPanel } from './components/ActionsPanel.tsx';
import { CommunitiesOfPracticeModal } from './components/CommunitiesOfPracticeModal.tsx';
import { AttritionModal } from './components/AttritionModal.tsx';
import { FinalDisruptionModal } from './components/FinalDisruptionModal.tsx';
import { KnowledgeAuditModal } from './components/KnowledgeAuditModal.tsx';
import { FacilitatorDashboard } from './components/FacilitatorDashboard.tsx';
import { AARDebriefView } from './components/AARDebriefView.tsx';
import { SessionJoinModal } from './components/SessionJoinModal.tsx';
import {
  MapPin,
  Building2,
  Users,
  Cpu,
  BookOpen,
  Sparkles,
  Sliders,
  ShieldAlert,
  AlertCircle
} from 'lucide-react';

export function App() {
  const [session, setSession] = useState<GameSession | null>(null);
  const [currentCompanyId, setCurrentCompanyId] = useState<string>('');
  const [selectedSiteId, setSelectedSiteId] = useState<string>('melbourne');
  const [selectedExpert, setSelectedExpert] = useState<Expert | null>(null);
  const [auditSiteId, setAuditSiteId] = useState<string | null>(null);
  const [showCoPModal, setShowCoPModal] = useState(false);
  const [showFacilitatorDashboard, setShowFacilitatorDashboard] = useState(false);
  const [showAARDebrief, setShowAARDebrief] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [currentView, setCurrentView] = useState<'map' | 'sites' | 'hq' | 'actions' | 'events'>('map');
  const [lastPhaseResult, setLastPhaseResult] = useState<any>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'info' | 'success' | 'warning' | 'error' } | null>(null);

  // Initialize or fetch default session
  useEffect(() => {
    fetchDefaultSession();
  }, []);

  // SSE Subscription for real-time multiplayer updates
  useEffect(() => {
    if (!session?.id) return;

    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource(`/api/sessions/${session.id}/stream`);
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'INITIAL_STATE' || data.type === 'SESSION_UPDATE') {
            setSession(data.session);
          }
        } catch (err) {
          console.error('Error parsing SSE event:', err);
        }
      };
    } catch (e) {
      console.warn('SSE not available in this environment; falling back to periodic refresh', e);
    }

    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [session?.id]);

  const showToast = (message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification((curr) => (curr?.message === message ? null : curr));
    }, 4500);
  };

  const safeParseJson = async (res: Response) => {
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      return { error: `Server returned unexpected response (${res.status})` };
    }
  };

  const fetchDefaultSession = async () => {
    try {
      const res = await fetch('/api/sessions/default');
      if (res.ok) {
        const data = await safeParseJson(res);
        if (data && data.id) {
          setSession(data);
          if (data.companies?.length > 0 && !currentCompanyId) {
            setCurrentCompanyId(data.companies[0].id);
          }
          return;
        }
      }
      setShowJoinModal(true);
    } catch (e) {
      setShowJoinModal(true);
    }
  };

  const handleJoinSession = async (sessionId: string, companyId: string, playerName: string) => {
    try {
      const res = await fetch(`/api/sessions/${sessionId}`);
      if (res.ok) {
        const data = await safeParseJson(res);
        if (data && data.id) {
          setSession(data);
          setCurrentCompanyId(companyId || data.companies?.[0]?.id || '');
          setShowJoinModal(false);
          showToast(`Connected to session: ${data.name}`, 'success');
          return;
        }
      }
      showToast('Session not found or invalid response', 'error');
    } catch (e) {
      showToast('Error connecting to session', 'error');
    }
  };

  const handleCreateNewSession = async (sessionName: string, companyCount: number) => {
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: sessionName, companyCount }),
      });
      const data = await safeParseJson(res);
      if (res.ok && data?.id) {
        setSession(data);
        setCurrentCompanyId(data.companies?.[0]?.id || '');
        setShowJoinModal(false);
        showToast(`Created new session: ${sessionName}`, 'success');
      } else {
        showToast(data?.error || 'Error creating session', 'error');
      }
    } catch (e) {
      showToast('Error creating session', 'error');
    }
  };

  const handleSoloStart = async () => {
    await handleCreateNewSession('Solo Sandbox Simulation', 1);
  };

  const handlePerformAction = async (actionType: string, params: any = {}) => {
    if (!session || !currentCompanyId) return;

    try {
      const res = await fetch(`/api/sessions/${session.id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: currentCompanyId,
          actionType,
          params,
          payload: {
            type: actionType,
            ...params,
          },
        }),
      });

      const data = await safeParseJson(res);
      if (res.ok && data?.success) {
        setSession(data.session);
        showToast(data.message || 'Action executed successfully', 'success');

        if (actionType === 'KNOWLEDGE_AUDIT' && (params?.siteId || params?.targetSiteId)) {
          setAuditSiteId(params?.siteId || params?.targetSiteId);
        }
      } else {
        showToast(data?.error || data?.message || 'Action failed', 'error');
      }
    } catch (e: any) {
      showToast(e.message || 'Error executing action', 'error');
    }
  };

  const handleAdvancePhase = async () => {
    if (!session) return;

    try {
      const res = await fetch(`/api/sessions/${session.id}/advance-phase`, {
        method: 'POST',
      });
      const data = await safeParseJson(res);
      if (res.ok && data?.success) {
        setSession(data.session);
        setLastPhaseResult(data);
        showToast(`Advanced to Phase ${data.session.phase}`, 'info');
      } else {
        showToast(data?.error || 'Failed to advance phase', 'error');
      }
    } catch (e) {
      showToast('Error advancing phase', 'error');
    }
  };

  const handleSetAllocation = async (eventInstanceId: string, domain: KnowledgeDomain, allocation: any) => {
    if (!session || !currentCompanyId) return;
    try {
      const res = await fetch(`/api/sessions/${session.id}/allocate-resources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: currentCompanyId,
          eventInstanceId,
          domain,
          expertId: allocation.expertId,
          useCoPSupport: allocation.useCoPSupport,
        }),
      });
      const data = await safeParseJson(res);
      if (res.ok && data?.success) {
        setSession(data.session);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleRedrawEvent = async (eventInstanceId: string) => {
    if (!session || !currentCompanyId) return;
    try {
      const res = await fetch(`/api/sessions/${session.id}/redraw-event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: currentCompanyId,
          eventInstanceId,
        }),
      });
      const data = await safeParseJson(res);
      if (res.ok && data?.success) {
        setSession(data.session);
        showToast(data.message, 'success');
      } else {
        showToast(data?.error || 'Redraw failed', 'error');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleResolveEvents = async () => {
    if (!session || !currentCompanyId) return;
    try {
      const res = await fetch(`/api/sessions/${session.id}/resolve-events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: currentCompanyId,
        }),
      });
      const data = await safeParseJson(res);
      if (res.ok && data?.success) {
        setSession(data.session);
        showToast('Events resolved! Review results.', 'info');
      } else {
        showToast(data?.error || 'Resolution failed', 'error');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleApplyExperientialLearning = async (
    eventInstanceId: string,
    domain: KnowledgeDomain,
    target: 'team' | 'expert',
    targetId?: string
  ) => {
    if (!session || !currentCompanyId) return;
    try {
      const res = await fetch(`/api/sessions/${session.id}/apply-learning`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: currentCompanyId,
          eventInstanceId,
          domain,
          target,
          targetId,
        }),
      });
      const data = await safeParseJson(res);
      if (res.ok && data?.success) {
        setSession(data.session);
        showToast(data.message, 'success');
      } else {
        showToast(data?.error || 'Learning application failed', 'error');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleFacilitatorOverride = async (passcode: string, updates: any) => {
    if (!session) return;
    try {
      const res = await fetch(`/api/sessions/${session.id}/facilitator-override`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          passcode,
          ...updates,
        }),
      });
      const data = await safeParseJson(res);
      if (res.ok && data?.success) {
        setSession(data.session);
        showToast(data.message || 'Override applied', 'success');
      } else {
        showToast(data?.error || 'Override failed', 'error');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteCurrentGame = async (passcode: string) => {
    if (!session) return;
    try {
      const res = await fetch(`/api/sessions/${session.id}/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode }),
      });
      const data = await safeParseJson(res);
      if (res.ok && data?.success) {
        localStorage.removeItem('tpg_session_id');
        localStorage.removeItem('tpg_company_id');
        localStorage.removeItem('tpg_participant_id');

        if (data.nextSession) {
          setSession(data.nextSession);
          setCurrentCompanyId(data.nextSession.companies[0]?.id || null);
          localStorage.setItem('tpg_session_id', data.nextSession.id);
          if (data.nextSession.companies[0]) {
            localStorage.setItem('tpg_company_id', data.nextSession.companies[0].id);
          }
          showToast(`Game session was deleted. Switched to ${data.nextSession.name}.`, 'info');
        } else {
          setSession(null);
          setShowJoinModal(true);
          showToast('Game session deleted.', 'info');
        }
        setShowFacilitatorDashboard(false);
      } else {
        showToast(data?.error || 'Failed to delete session', 'error');
      }
    } catch (e: any) {
      showToast(e.message || 'Error deleting session', 'error');
    }
  };

  const handleFactoryReset = async (passcode: string) => {
    try {
      const res = await fetch('/api/admin/reset-database', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode }),
      });
      const data = await safeParseJson(res);
      if (res.ok && data?.success) {
        // Clear local cached participant / company bindings
        localStorage.removeItem('tpg_session_id');
        localStorage.removeItem('tpg_company_id');
        localStorage.removeItem('tpg_participant_id');

        if (data.defaultSession) {
          setSession(data.defaultSession);
          setCurrentCompanyId(data.defaultSession.companies[0]?.id || null);
          localStorage.setItem('tpg_session_id', data.defaultSession.id);
          if (data.defaultSession.companies[0]) {
            localStorage.setItem('tpg_company_id', data.defaultSession.companies[0].id);
          }
        }
        setShowFacilitatorDashboard(false);
        showToast('System and database successfully reset to factory defaults.', 'success');
      } else {
        showToast(data?.error || 'Reset failed', 'error');
      }
    } catch (e: any) {
      showToast(e.message || 'Error during system reset', 'error');
    }
  };


  const handleResolveFinalDisruption = async () => {
    if (!session) return;
    try {
      const res = await fetch(`/api/sessions/${session.id}/resolve-final-disruption`, {
        method: 'POST',
      });
      const data = await safeParseJson(res);
      if (res.ok && data?.success) {
        setSession(data.session);
        showToast('Final Disruption resolved!', 'warning');
      } else {
        showToast(data?.error || 'Disruption resolution failed', 'error');
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (!session) {
    return (
      <div className="min-h-screen bg-[#0a0c10] flex items-center justify-center text-[#c9d1d9]">
        <SessionJoinModal
          currentSession={null}
          onJoinSession={handleJoinSession}
          onCreateNewSession={handleCreateNewSession}
          onSoloStart={handleSoloStart}
        />
      </div>
    );
  }

  const currentCompany = session.companies.find((c) => c.id === currentCompanyId) || session.companies[0];
  const companyEvents = session.activeEvents[currentCompany?.id || ''] || [];
  const activeEventsCount = companyEvents.length;

  return (
    <div className="min-h-screen bg-[#0a0c10] text-[#c9d1d9] flex flex-col font-sans selection:bg-indigo-600 selection:text-white">
      {/* Global Header */}
      <Header
        session={session}
        activeCompany={currentCompany}
        participant={null}
        onSelectCompany={setCurrentCompanyId}
        onOpenFacilitator={() => setShowFacilitatorDashboard(true)}
        onOpenAAR={() => setShowAARDebrief(true)}
        onOpenCoP={() => setShowCoPModal(true)}
        onAdvancePhase={handleAdvancePhase}
        isFacilitator={showFacilitatorDashboard}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-5 space-y-4">
        {/* Central Turn Phase Guide & Next Action Directive */}
        <TurnPhaseGuide
          round={session.round}
          maxRounds={session.config.rounds}
          currentPhase={session.phase}
          actionsRemaining={currentCompany.actionsRemaining}
          activeEventsCount={activeEventsCount}
          resolvedEventsCount={companyEvents.filter(e => e.isResolved).length}
          onSelectPhaseView={(v) => setCurrentView(v as any)}
          onAdvancePhase={handleAdvancePhase}
        />

        {/* Decision-Making Tool Views Navigation */}
        <div className="flex items-center justify-between flex-wrap gap-2.5 bg-[#0d1117] p-2 rounded-xl border border-[#30363d]">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-mono uppercase font-bold text-[#8b949e] px-2">Decision Tools:</span>
            {[
              { id: 'map', label: '1. Map & Sites', icon: MapPin },
              { id: 'hq', label: '2. Corporate HQ', icon: Building2 },
              { id: 'events', label: `3. Events & Challenges (${activeEventsCount})`, icon: Sparkles },
              { id: 'actions', label: `4. Invest Actions (${currentCompany?.actionsRemaining}/4)`, icon: Cpu },
            ].map((v) => {
              const Icon = v.icon;
              const isActive = currentView === v.id;
              return (
                <button
                  key={v.id}
                  onClick={() => setCurrentView(v.id as any)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-sm ring-1 ring-indigo-400'
                      : 'text-[#8b949e] hover:text-white hover:bg-[#161b22]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{v.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowJoinModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#161b22] border border-[#30363d] hover:border-indigo-500/60 text-[#c9d1d9] hover:text-white text-xs font-semibold font-mono transition"
            >
              <span>Session: {session.id}</span>
            </button>
            <button
              onClick={() => setShowCoPModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#161b22] border border-[#30363d] hover:border-amber-500/60 text-amber-400 text-xs font-semibold transition"
            >
              <Users className="w-3.5 h-3.5 text-amber-400" />
              <span>CoPs ({session.copMemberships.filter(m => m.companyId === currentCompany.id).length})</span>
            </button>
          </div>
        </div>

        {/* VIEW 1: GEOGRAPHIC MAP VIEW */}
        {currentView === 'map' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-8">
              <AustraliaMap
                company={currentCompany}
                selectedSiteId={selectedSiteId}
                onSelectSite={(siteId) => setSelectedSiteId(siteId)}
                onSelectHQ={() => setSelectedSiteId('HQ')}
                isHQSelected={selectedSiteId === 'HQ'}
                onSelectExpert={setSelectedExpert}
              />
            </div>

            <div className="lg:col-span-4 space-y-3">
              <SiteKnowledgePanel
                company={currentCompany}
                site={currentCompany.sites.find((s) => s.id === selectedSiteId) || currentCompany.sites[0]}
                onPerformAction={handlePerformAction}
                onSelectExpert={setSelectedExpert}
              />
            </div>
          </div>
        )}

        {/* VIEW 2: SITE OPERATIONS VIEW */}
        {currentView === 'sites' && (
          <div className="space-y-3">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {currentCompany.sites.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelectedSiteId(s.id)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap border ${
                    selectedSiteId === s.id
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow-xs'
                      : 'bg-[#161b22] border-[#30363d] text-[#8b949e] hover:text-white hover:bg-[#21262d]'
                  }`}
                >
                  {s.name} Site {s.isClosed ? '(Closed)' : `($${s.turnover})`}
                </button>
              ))}
            </div>

            <SiteKnowledgePanel
              company={currentCompany}
              site={currentCompany.sites.find((s) => s.id === selectedSiteId) || currentCompany.sites[0]}
              onPerformAction={handlePerformAction}
              onSelectExpert={setSelectedExpert}
            />
          </div>
        )}

        {/* VIEW 3: CORPORATE HEADQUARTERS VIEW */}
        {currentView === 'hq' && (
          <CorporateHQPanel
            session={session}
            company={currentCompany}
            onPerformAction={handlePerformAction}
            onSelectExpert={setSelectedExpert}
            onOpenCoP={() => setShowCoPModal(true)}
          />
        )}

        {/* VIEW 4: ACTIONS / INVESTMENT VIEW */}
        {currentView === 'actions' && (
          <ActionsPanel
            session={session}
            company={currentCompany}
            onPerformAction={handlePerformAction}
            onNextPhase={handleAdvancePhase}
          />
        )}

        {/* VIEW 5: EVENTS / RESOLUTION VIEW */}
        {currentView === 'events' && (
          session.phase === 'consequences' ? (
            <ConsequencesModal
              session={session}
              company={currentCompany}
              onApplyLearning={handleApplyExperientialLearning}
              onNextPhase={handleAdvancePhase}
            />
          ) : (
            <EventResolutionModal
              session={session}
              company={currentCompany}
              config={session.config}
              onRedrawEvent={handleRedrawEvent}
              onSetAllocation={handleSetAllocation}
              onResolveEvents={handleResolveEvents}
              onNextPhase={handleAdvancePhase}
            />
          )
        )}

        {/* Phase 5 Attrition View Trigger (if in phase 'risk') */}
        {session.phase === 'risk' && (
          <AttritionModal
            session={session}
            company={currentCompany}
            phaseResult={lastPhaseResult}
            onAdvanceToNextRound={handleAdvancePhase}
          />
        )}

        {/* Final Disruption Climax Trigger (if round 6 and phase is 'respond' or later) */}
        {session.round >= 6 && session.phase !== 'events' && (
          <FinalDisruptionModal
            session={session}
            company={currentCompany}
            onResolveFinalDisruption={handleResolveFinalDisruption}
            onOpenAAR={() => setShowAARDebrief(true)}
          />
        )}
      </main>

      {/* High Density Status Footer */}
      <footer className="h-8 bg-[#161b22] border-t border-[#30363d] flex items-center justify-between px-6 shrink-0 text-[10px] text-[#484f58] font-mono select-none">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          <span className="text-[#8b949e]">SECURE_TUNNEL: ESTABLISHED</span>
        </div>
        <div className="flex items-center gap-4">
          <span>LATENCY: 12ms</span>
          <span>ROUND: {session.round}/{session.config.rounds}</span>
          <span>PHASE: {session.phase.toUpperCase()}</span>
          <span className="text-[#8b949e]">SESSION: {session.id}</span>
        </div>
      </footer>

      {/* Global Modals */}
      {selectedExpert && (
        <ExpertModal
          expert={selectedExpert}
          company={currentCompany}
          config={session.config}
          onClose={() => setSelectedExpert(null)}
          onPerformAction={handlePerformAction}
        />
      )}

      {showCoPModal && (
        <CommunitiesOfPracticeModal
          session={session}
          company={currentCompany}
          onClose={() => setShowCoPModal(false)}
          onPerformAction={handlePerformAction}
        />
      )}

      {auditSiteId && (
        <KnowledgeAuditModal
          company={currentCompany}
          siteId={auditSiteId}
          config={session.config}
          onClose={() => setAuditSiteId(null)}
        />
      )}

      {showFacilitatorDashboard && (
        <FacilitatorDashboard
          session={session}
          onClose={() => setShowFacilitatorDashboard(false)}
          onAdvancePhase={handleAdvancePhase}
          onFacilitatorOverride={handleFacilitatorOverride}
          onTriggerFinalDisruption={() => handlePerformAction('TRIGGER_FINAL_DISRUPTION', {})}
          onDeleteCurrentGame={handleDeleteCurrentGame}
          onResetDatabase={handleFactoryReset}
        />
      )}

      {showAARDebrief && (
        <AARDebriefView
          session={session}
          company={currentCompany}
          onClose={() => setShowAARDebrief(false)}
        />
      )}

      {showJoinModal && (
        <SessionJoinModal
          currentSession={session}
          onJoinSession={handleJoinSession}
          onCreateNewSession={handleCreateNewSession}
          onSoloStart={handleSoloStart}
        />
      )}

      {/* Toast Notification Banner */}
      {notification && (
        <div
          className={`fixed bottom-10 right-5 z-50 px-4 py-2.5 rounded-lg shadow-xl border text-xs font-mono flex items-center gap-2 animate-in slide-in-from-bottom duration-200 ${
            notification.type === 'error'
              ? 'bg-[#161b22] border-rose-600/70 text-rose-300'
              : notification.type === 'warning'
              ? 'bg-[#161b22] border-amber-600/70 text-amber-300'
              : notification.type === 'success'
              ? 'bg-[#161b22] border-emerald-600/70 text-emerald-300'
              : 'bg-[#161b22] border-indigo-600/70 text-indigo-300'
          }`}
        >
          <span>{notification.message}</span>
        </div>
      )}
    </div>
  );
}

export default App;
