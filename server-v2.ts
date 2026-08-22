import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import {
  advancePhaseV2,
  applyLearningV2,
  createNewSessionV2,
  deleteSessionAndSelectNextV2,
  facilitatorUpdateV2,
  getGameEventLogs,
  getSessionV2,
  initializeDefaultSessionV2,
  joinSessionV2,
  knowledgeActionV2,
  listSessionsV2,
  redrawEventV2,
  registerSSEClientV2,
  resetAllV2,
  resolveEventV2,
  resolveFinalDisruptionV2,
  setEventAllocationV2,
  timerPauseV2,
  timerResetV2,
  timerStartV2,
} from './src/server/gameServiceV2.ts';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3000);
  app.use(express.json());
  await initializeDefaultSessionV2();

  app.get('/api/health', (_req, res) => res.json({ status: 'ok', engine: 'core-v2', time: new Date().toISOString() }));
  app.get('/api/sessions', async (_req, res) => res.json(await listSessionsV2()));
  app.get('/api/sessions/default', async (_req, res) => res.json(await initializeDefaultSessionV2()));

  app.post('/api/sessions', async (req, res) => {
    try {
      const { sessionId, title, name, companyNames, companyCount } = req.body || {};
      const code = String(sessionId || `KM${Math.floor(1000 + Math.random() * 9000)}`).toUpperCase();
      let names: string[] = Array.isArray(companyNames) ? companyNames : [];
      if (!names.length) {
        const defaults = ['Apex Technologies', 'Vanguard Systems', 'Horizon BioTech', 'Stratos Engineering', 'Northstar Manufacturing', 'Southern Cross Industries', 'Meridian Group', 'Summit Systems'];
        const count = Math.max(1, Math.min(8, Number(companyCount || 1)));
        names = defaults.slice(0, count);
      }
      res.json(await createNewSessionV2(code, title || name || `The Performance Gap ${code}`, names));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/sessions/:id', async (req, res) => {
    const session = await getSessionV2(req.params.id.toUpperCase());
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json(session);
  });

  app.post('/api/sessions/:id/join', async (req, res) => {
    try { res.json(await joinSessionV2(req.params.id, req.body?.name, req.body?.companyId, req.body?.role)); }
    catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  app.get('/api/sessions/:id/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    registerSSEClientV2(req.params.id, res);
    res.write(`data: ${JSON.stringify({ type: 'CONNECTED', sessionId: req.params.id.toUpperCase() })}\n\n`);
  });

  app.get('/api/sessions/:id/logs', async (req, res) => res.json(await getGameEventLogs(req.params.id.toUpperCase())));

  const allocationHandler = async (req: express.Request, res: express.Response) => {
    try {
      const { companyId, eventInstanceId, domain, allocation, expertId, useCoPSupport, consultantPoints } = req.body || {};
      const proposed = allocation || { expertId, useCoPSupport, consultantPoints };
      const result = await setEventAllocationV2(req.params.id, companyId, eventInstanceId, domain, proposed);
      res.status(result.success ? 200 : 400).json(result);
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  };
  app.post('/api/sessions/:id/events/allocate', allocationHandler);
  app.post('/api/sessions/:id/allocate-resources', allocationHandler);

  const redrawHandler = async (req: express.Request, res: express.Response) => {
    try {
      const result = await redrawEventV2(req.params.id, req.body?.companyId, req.body?.eventInstanceId);
      res.status(result.success ? 200 : 400).json(result);
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  };
  app.post('/api/sessions/:id/events/redraw', redrawHandler);
  app.post('/api/sessions/:id/redraw-event', redrawHandler);

  const resolveHandler = async (req: express.Request, res: express.Response) => {
    try {
      const result = await resolveEventV2(req.params.id, req.body?.companyId, req.body?.eventInstanceId);
      res.status(result.success ? 200 : 400).json(result);
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  };
  app.post('/api/sessions/:id/events/resolve', resolveHandler);
  app.post('/api/sessions/:id/resolve-event', resolveHandler);
  app.post('/api/sessions/:id/resolve-events', resolveHandler); // Legacy UI: resolves the next unresolved card only.

  const learningHandler = async (req: express.Request, res: express.Response) => {
    try {
      const { companyId, eventInstanceId, domain, target, targetId } = req.body || {};
      const result = await applyLearningV2(req.params.id, companyId, eventInstanceId, domain, target, targetId);
      res.status(result.success ? 200 : 400).json(result);
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  };
  app.post('/api/sessions/:id/events/learning', learningHandler);
  app.post('/api/sessions/:id/apply-learning', learningHandler);

  const actionHandler = async (req: express.Request, res: express.Response) => {
    try {
      const { companyId, payload, actionType, params, type, siteId, expertId, domain, targetLocation, learningTarget } = req.body || {};
      const normalized = payload || { type: actionType || type, siteId: params?.siteId || siteId, expertId: params?.expertId || expertId, domain: params?.domain || domain, targetLocation: params?.targetLocation || targetLocation, learningTarget: params?.learningTarget || learningTarget, ...(params || {}) };
      if (!normalized.type) return res.status(400).json({ error: 'Action type is required.' });
      const result = await knowledgeActionV2(req.params.id, companyId, normalized);
      res.status(result.success ? 200 : 400).json(result);
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  };
  app.post('/api/sessions/:id/action', actionHandler);
  app.post('/api/sessions/:id/actions', actionHandler);

  const advanceHandler = async (req: express.Request, res: express.Response) => {
    try {
      const result = await advancePhaseV2(req.params.id, req.body?.targetPhase);
      res.status(result.success ? 200 : 400).json(result);
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  };
  app.post('/api/sessions/:id/advance', advanceHandler);
  app.post('/api/sessions/:id/advance-phase', advanceHandler);

  app.post('/api/sessions/:id/final-disruption', async (req, res) => res.json(await resolveFinalDisruptionV2(req.params.id)));
  app.post('/api/sessions/:id/resolve-final-disruption', async (req, res) => res.json(await resolveFinalDisruptionV2(req.params.id)));

  app.post('/api/sessions/:id/timer/start', async (req, res) => res.json(await timerStartV2(req.params.id)));
  app.post('/api/sessions/:id/timer/pause', async (req, res) => res.json(await timerPauseV2(req.params.id)));
  app.post('/api/sessions/:id/timer/reset', async (req, res) => res.json(await timerResetV2(req.params.id)));

  const facilitatorHandler = async (req: express.Request, res: express.Response) => {
    const secret = process.env.FACILITATOR_SECRET;
    if (!secret) return res.status(503).json({ error: 'FACILITATOR_SECRET is not configured.' });
    if (req.body?.passcode !== secret) return res.status(403).json({ error: 'Invalid facilitator passcode.' });
    try { res.json({ success: true, session: await facilitatorUpdateV2(req.params.id, req.body?.updates || req.body) }); }
    catch (e: any) { res.status(400).json({ error: e.message }); }
  };
  app.post('/api/sessions/:id/facilitator/override', facilitatorHandler);
  app.post('/api/sessions/:id/facilitator-override', facilitatorHandler);

  app.post('/api/sessions/:id/delete', async (req, res) => {
    const secret = process.env.FACILITATOR_SECRET;
    if (!secret || req.body?.passcode !== secret) return res.status(403).json({ error: 'Valid facilitator passcode required.' });
    res.json(await deleteSessionAndSelectNextV2(req.params.id));
  });

  app.post('/api/admin/reset-database', async (req, res) => {
    const secret = process.env.FACILITATOR_SECRET;
    if (!secret || req.body?.passcode !== secret) return res.status(403).json({ error: 'Valid facilitator passcode required.' });
    res.json({ success: true, defaultSession: await resetAllV2() });
  });

  // Runtime AI is deliberately optional. V1 debrief remains deterministic from event logs.
  app.post('/api/ai/debrief', async (req, res) => {
    const logs = await getGameEventLogs(String(req.body?.sessionId || 'KM2026').toUpperCase());
    res.json({
      summary: 'Review the decisions that traded short-term turnover against organisational capability and knowledge risk.',
      keyLearnings: [
        'External expertise solved immediate gaps but did not build internal capability.',
        'Expert concentration increased SPOF risk and the cost of inaction.',
        'Codified knowledge only delivered its full value where local teams could absorb and apply it.'
      ],
      facilitatorQuestions: [
        'Where did you repeatedly rent capability instead of building it?',
        'Which known knowledge risk did you choose to carry, and what did that decision cost?',
        `What changed in your strategy after the first ${Math.min(logs.length, 10)} recorded decisions?`
      ]
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  app.listen(PORT, '0.0.0.0', () => console.log(`The Performance Gap V2 server running on http://0.0.0.0:${PORT}`));
}

startServer().catch((err) => { console.error(err); process.exitCode = 1; });
