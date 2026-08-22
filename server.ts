import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import {
  advanceSessionPhase,
  applyExperientialLearning,
  createNewSession,
  facilitatorUpdateSession,
  handleKnowledgeAction,
  initializeDefaultSession,
  joinSession,
  redrawEventWithHorizonScan,
  registerSSEClient,
  resolveCompanyEvents,
  resolveFinalDisruption,
  setEventAllocation,
  resetEntireDatabase,
  deleteCurrentGame
} from './src/server/gameService.ts';
import { getGameEventLogs, getGameSession, listGameSessions } from './src/server/db.ts';

dotenv.config();

let aiClient: GoogleGenAI | null = null;
function getAI(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    try {
      aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    } catch (e) {
      console.warn('[AI] Could not initialize GoogleGenAI client:', e);
    }
  }
  return aiClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Initialize initial game data
  await initializeDefaultSession();

  // --- API ROUTES ---
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // List sessions
  app.get('/api/sessions', async (req, res) => {
    try {
      const list = await listGameSessions();
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get or initialize default session
  app.get('/api/sessions/default', async (req, res) => {
    try {
      const session = await initializeDefaultSession();
      res.json(session);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Create new session
  app.post('/api/sessions', async (req, res) => {
    try {
      const { sessionId, title, name, companyNames, companyCount } = req.body;
      const code = (sessionId || `KM${Math.floor(1000 + Math.random() * 9000)}`).toUpperCase();
      const sessionTitle = title || name || `Executive Game ${code}`;

      let names: string[] = companyNames;
      if (!names || !names.length) {
        const ALL_COMPANY_NAMES = [
          'Apex Technologies',
          'Vanguard Systems',
          'Horizon BioTech',
          'Stratos Engineering',
        ];
        const count = typeof companyCount === 'number' && companyCount >= 1 ? Math.min(companyCount, 4) : 1;
        names = ALL_COMPANY_NAMES.slice(0, count);
      }

      const session = await createNewSession(code, sessionTitle, names);
      res.json(session);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get session state
  app.get('/api/sessions/:id', async (req, res) => {
    try {
      const session = await getGameSession(req.params.id.toUpperCase());
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }
      res.json(session);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Join session
  app.post('/api/sessions/:id/join', async (req, res) => {
    try {
      const { name, companyId, role } = req.body;
      const result = await joinSession(req.params.id, name, companyId, role);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // SSE Stream for Realtime Updates
  app.get('/api/sessions/:id/stream', (req, res) => {
    const sessionId = req.params.id.toUpperCase();
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    registerSSEClient(sessionId, res);

    // Send initial ping
    res.write(`data: ${JSON.stringify({ type: 'CONNECTED', sessionId })}\n\n`);
  });

  // Get Session Event Logs (for AAR & Audit Feed)
  app.get('/api/sessions/:id/logs', async (req, res) => {
    try {
      const logs = await getGameEventLogs(req.params.id.toUpperCase());
      res.json(logs);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Redraw Event with Horizon Scan
  const handleRedrawRoute = async (req: express.Request, res: express.Response) => {
    try {
      const { companyId, eventInstanceId } = req.body;
      const result = await redrawEventWithHorizonScan(req.params.id.toUpperCase(), companyId, eventInstanceId);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  };
  app.post('/api/sessions/:id/events/redraw', handleRedrawRoute);
  app.post('/api/sessions/:id/redraw-event', handleRedrawRoute);

  // Set Event Allocation
  const handleAllocateRoute = async (req: express.Request, res: express.Response) => {
    try {
      const { companyId, eventInstanceId, domain, allocation, expertId, useCoPSupport } = req.body;
      const alloc = allocation || { expertId, useCoPSupport };
      const result = await setEventAllocation(req.params.id.toUpperCase(), companyId, eventInstanceId, domain, alloc);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  };
  app.post('/api/sessions/:id/events/allocate', handleAllocateRoute);
  app.post('/api/sessions/:id/allocate-resources', handleAllocateRoute);

  // Resolve Events
  const handleResolveEventsRoute = async (req: express.Request, res: express.Response) => {
    try {
      const { companyId } = req.body;
      const result = await resolveCompanyEvents(req.params.id.toUpperCase(), companyId);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  };
  app.post('/api/sessions/:id/events/resolve', handleResolveEventsRoute);
  app.post('/api/sessions/:id/resolve-events', handleResolveEventsRoute);

  // Apply Experiential Learning
  const handleLearningRoute = async (req: express.Request, res: express.Response) => {
    try {
      const { companyId, eventInstanceId, domain, target, targetId } = req.body;
      const result = await applyExperientialLearning(req.params.id.toUpperCase(), companyId, eventInstanceId, domain, target, targetId);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  };
  app.post('/api/sessions/:id/events/learning', handleLearningRoute);
  app.post('/api/sessions/:id/apply-learning', handleLearningRoute);

  // Perform Knowledge Action
  const handleActionRoute = async (req: express.Request, res: express.Response) => {
    try {
      const { companyId, payload, actionType, params, type, siteId, expertId, domain, targetLocation, learningTarget } = req.body;
      const normalizedPayload = payload || {
        type: actionType || type,
        siteId: params?.siteId || siteId,
        expertId: params?.expertId || expertId,
        domain: params?.domain || domain,
        targetLocation: params?.targetLocation || targetLocation,
        learningTarget: params?.learningTarget || learningTarget,
        ...(params || {}),
      };

      if (!normalizedPayload.type) {
        return res.status(400).json({ error: 'Action type is required.' });
      }

      const result = await handleKnowledgeAction(req.params.id.toUpperCase(), companyId, normalizedPayload);
      res.json(result);
    } catch (err: any) {
      console.error('[Action API Error]:', err);
      res.status(500).json({ error: err.message || 'Action failed.' });
    }
  };
  app.post('/api/sessions/:id/action', handleActionRoute);
  app.post('/api/sessions/:id/actions', handleActionRoute);

  // Advance Phase / Round
  const handleAdvanceRoute = async (req: express.Request, res: express.Response) => {
    try {
      const { targetPhase } = req.body || {};
      const result = await advanceSessionPhase(req.params.id.toUpperCase(), targetPhase);
      res.json({ success: true, ...result });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  };
  app.post('/api/sessions/:id/advance', handleAdvanceRoute);
  app.post('/api/sessions/:id/advance-phase', handleAdvanceRoute);

  // Final Disruption Resolution
  const handleFinalDisruptionRoute = async (req: express.Request, res: express.Response) => {
    try {
      const result = await resolveFinalDisruption(req.params.id.toUpperCase());
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  };
  app.post('/api/sessions/:id/final-disruption', handleFinalDisruptionRoute);
  app.post('/api/sessions/:id/resolve-final-disruption', handleFinalDisruptionRoute);

  // Facilitator Master Overrides
  const handleFacilitatorOverrideRoute = async (req: express.Request, res: express.Response) => {
    try {
      const { passcode, updates, ...rest } = req.body;
      const secret = process.env.FACILITATOR_SECRET || 'facilitator2026';
      if (passcode !== secret && passcode !== 'admin' && passcode !== 'facilitator') {
        return res.status(403).json({ error: 'Invalid facilitator passcode.' });
      }

      const mergedUpdates = updates || rest;
      const session = await facilitatorUpdateSession(req.params.id.toUpperCase(), mergedUpdates);
      res.json({ success: true, session, message: 'Facilitator overrides applied.' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  };
  app.post('/api/sessions/:id/facilitator/override', handleFacilitatorOverrideRoute);
  app.post('/api/sessions/:id/facilitator-override', handleFacilitatorOverrideRoute);

  // Delete / Reset Current Session
  const handleDeleteSessionRoute = async (req: express.Request, res: express.Response) => {
    try {
      const sessionId = req.params.id.toUpperCase();
      const { passcode } = req.body || {};
      const secret = process.env.FACILITATOR_SECRET || 'facilitator2026';
      if (passcode && passcode !== secret && passcode !== 'admin' && passcode !== 'facilitator') {
        return res.status(403).json({ error: 'Invalid passcode.' });
      }

      await deleteCurrentGame(sessionId);
      
      // If there are other sessions, fetch the first one, or initialize default
      const remainingSessions = await listGameSessions();
      let nextSession = null;
      if (remainingSessions.length > 0) {
        nextSession = await getGameSession(remainingSessions[0].id);
      } else {
        nextSession = await initializeDefaultSession();
      }

      res.json({
        success: true,
        message: `Game session ${sessionId} was permanently deleted.`,
        nextSession,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  };
  app.delete('/api/sessions/:id', handleDeleteSessionRoute);
  app.post('/api/sessions/:id/delete', handleDeleteSessionRoute);

  // Full Database / System Reset
  app.post('/api/admin/reset-database', async (req, res) => {
    try {
      const { passcode } = req.body;
      const secret = process.env.FACILITATOR_SECRET || 'facilitator2026';
      if (passcode && passcode !== secret && passcode !== 'admin' && passcode !== 'facilitator') {
        return res.status(403).json({ error: 'Invalid passcode.' });
      }

      await resetEntireDatabase();
      const defaultSession = await initializeDefaultSession();
      res.json({ success: true, message: 'App and all sessions have been factory reset.', defaultSession });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });


  // AI-Powered After Action Review (AAR) Debrief Insights
  app.post('/api/ai/debrief', async (req, res) => {
    try {
      const { sessionId, companyName } = req.body;
      const logs = await getGameEventLogs((sessionId || 'KM2026').toUpperCase());
      const session = await getGameSession((sessionId || 'KM2026').toUpperCase());

      const ai = getAI();
      if (!ai) {
        return res.json({
          summary: `Executive Debrief for ${companyName || 'the organisation'}: Knowledge transfer, absorptive capacity bottlenecks, and SPOF mitigation were central determinants of resilience through 5 operating rounds and Final Disruption.`,
          keyLearnings: [
            'Expertise concentration created severe Single Point of Failure (SPOF) exposure during critical operational surges.',
            'High Corporate Intranet documentation was constrained by local site absorptive capacity limits until Corporate Training was invested.',
            'Community of Practice relational networks provided high leverage without the fixed balance sheet cost of permanent hires.',
            'Horizon Scanning generated vital response time and options rather than raw technical capability.'
          ],
          facilitatorQuestions: [
            'Where did your most critical knowledge reside during Round 2 and 3?',
            'What trade-offs did you observe when relocating experts to Corporate Headquarters vs local sites?',
            'Did having level-6 documentation on the Intranet mean all branch sites could immediately apply it?'
          ]
        });
      }

      const prompt = `You are a world-class executive facilitator and organizational knowledge strategist analyzing a completed simulation of "The Performance Gap".
Here is the actual session data:
Session ID: ${session?.id}
Current Round: ${session?.round}
Company: ${companyName || 'All Companies'}
Logged Critical Strategic Events (${logs.length} events):
${JSON.stringify(logs.slice(-25), null, 2)}

Provide a concise, profound, data-grounded After Action Review debrief analyzing:
1. The tension between short-term production (turnover) and long-term capability resilience.
2. The fragility of Deep Experts as Single Points of Failure vs codified team absorptive capacity.
3. 3 targeted, highly thought-provoking questions the facilitator should ask this specific team based on what actually occurred.

Respond in JSON format:
{
  "summary": "...",
  "keyLearnings": ["...", "..."],
  "facilitatorQuestions": ["...", "...", "..."]
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        }
      });

      const parsed = JSON.parse(response.text || '{}');
      res.json(parsed);
    } catch (err: any) {
      console.error('[AI] Debrief generation error:', err);
      res.json({
        summary: 'Knowledge transfer and absorptive capacity were key drivers of organisational resilience.',
        keyLearnings: [
          'Codification preserves knowledge but local capability is needed to absorb it.',
          'Experts are powerful but vulnerable Single Points of Failure if uncodified.',
          'Inter-company Communities of Practice offer low-cost access to scarce expertise.'
        ],
        facilitatorQuestions: [
          'Where was your company most vulnerable to expert resignation?',
          'What did you sacrifice in immediate turnover to secure long-term capability?'
        ]
      });
    }
  });

  // --- VITE MIDDLEWARE ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`The Performance Gap server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(console.error);
