import pg from 'pg';
import { GameSession, KnowledgeDomain } from '../types/game.ts';
import { CompanyV2, GameSessionV2, asSessionV2 } from '../types/gameV2.ts';
import { initDatabase, logGameEvent, getGameEventLogs, saveParticipant } from './db.ts';

const { Pool } = pg;
const pool = process.env.DATABASE_URL ? new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
}) : null;

const memory = new Map<string, GameSessionV2>();
const DOMAINS: KnowledgeDomain[] = ['engineering', 'hr', 'marketing', 'operations', 'finance'];

export { logGameEvent, getGameEventLogs, saveParticipant };

export interface CompanyMetricSnapshot {
  avgTeamCapability: number;
  avgCodifiedKnowledge: number;
  avgCorporateIntranet: number;
  avgUsableIntranet: number;
}

function round2(n: number): number { return Math.round(n * 100) / 100; }

export function calculateCompanyMetrics(company: CompanyV2, session: GameSessionV2): CompanyMetricSnapshot {
  const activeSites = company.sites.filter((s) => !s.isClosed);
  if (!activeSites.length) return { avgTeamCapability: 0, avgCodifiedKnowledge: 0, avgCorporateIntranet: 0, avgUsableIntranet: 0 };

  let team = 0;
  let codified = 0;
  let usable = 0;
  for (const site of activeSites) {
    for (const domain of DOMAINS) {
      team += site.teamCapability[domain] || 0;
      codified += site.codifiedKnowledge[domain] || 0;
      usable += Math.min(company.intranet[domain] || 0, (site.teamCapability[domain] || 0) + session.config.absorptive_capacity_bonus);
    }
  }
  const siteDomainCount = activeSites.length * DOMAINS.length;
  const corporate = DOMAINS.reduce((sum, d) => sum + (company.intranet[d] || 0), 0) / DOMAINS.length;
  return {
    avgTeamCapability: round2(team / siteDomainCount),
    avgCodifiedKnowledge: round2(codified / siteDomainCount),
    avgCorporateIntranet: round2(corporate),
    avgUsableIntranet: round2(usable / siteDomainCount),
  };
}

function elapsedSeconds(session: GameSessionV2): number {
  if (session.timerStartedAt) return Math.max(0, Math.round((Date.now() - new Date(session.timerStartedAt).getTime()) / 1000));
  if (session.timerPausedSecondsRemaining != null) return Math.max(0, 50 * 60 - session.timerPausedSecondsRemaining);
  return 0;
}

export async function initDatabaseV2(): Promise<void> {
  await initDatabase();
  if (!pool) return;
  await pool.query(`
    CREATE SCHEMA IF NOT EXISTS performance_gap;

    CREATE TABLE IF NOT EXISTS performance_gap.session_snapshots_v2 (
      id VARCHAR(64) PRIMARY KEY,
      state JSONB NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS performance_gap.game_runs_v2 (
      session_id VARCHAR(64) PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      rules_version VARCHAR(64) NOT NULL,
      deck_version VARCHAR(64) NOT NULL,
      balance_version VARCHAR(64) NOT NULL,
      companies_count INT NOT NULL,
      started_at TIMESTAMP WITH TIME ZONE NOT NULL,
      completed_at TIMESTAMP WITH TIME ZONE,
      rounds_completed INT DEFAULT 0,
      elapsed_seconds INT DEFAULT 0,
      final_disruption_card_id VARCHAR(128)
    );

    CREATE TABLE IF NOT EXISTS performance_gap.company_runs_v2 (
      session_id VARCHAR(64) NOT NULL,
      company_id VARCHAR(64) NOT NULL,
      company_name VARCHAR(128) NOT NULL,
      business_strategy_initial VARCHAR(64),
      knowledge_strategy_initial VARCHAR(64),
      business_strategy_final VARCHAR(64),
      knowledge_strategy_final VARCHAR(64),
      starting_turnover NUMERIC NOT NULL,
      final_turnover NUMERIC,
      starting_avg_team NUMERIC,
      final_avg_team NUMERIC,
      starting_avg_codified NUMERIC,
      final_avg_codified NUMERIC,
      starting_avg_intranet NUMERIC,
      final_avg_intranet NUMERIC,
      starting_avg_usable_intranet NUMERIC,
      final_avg_usable_intranet NUMERIC,
      expected_successes NUMERIC DEFAULT 0,
      actual_successes INT DEFAULT 0,
      knowledge_spend NUMERIC DEFAULT 0,
      consultant_spend NUMERIC DEFAULT 0,
      problems_drawn INT DEFAULT 0,
      opportunities_drawn INT DEFAULT 0,
      final_disruption_success BOOLEAN,
      final_disruption_probability NUMERIC,
      PRIMARY KEY (session_id, company_id)
    );

    CREATE TABLE IF NOT EXISTS performance_gap.event_decisions_v2 (
      event_instance_id VARCHAR(160) PRIMARY KEY,
      session_id VARCHAR(64) NOT NULL,
      company_id VARCHAR(64) NOT NULL,
      round INT NOT NULL,
      card_id VARCHAR(128) NOT NULL,
      card_title VARCHAR(255) NOT NULL,
      event_type VARCHAR(32) NOT NULL,
      event_scope VARCHAR(32) NOT NULL,
      target_site_id VARCHAR(64),
      financial_exposure NUMERIC NOT NULL,
      company_turnover_before NUMERIC,
      site_turnover_before NUMERIC,
      reveal_probability_percent NUMERIC,
      committed_probability_percent NUMERIC,
      intervention_cost NUMERIC DEFAULT 0,
      consultant_cost NUMERIC DEFAULT 0,
      gross_business_impact NUMERIC DEFAULT 0,
      net_financial_impact NUMERIC DEFAULT 0,
      success BOOLEAN,
      knowledge_requirements JSONB NOT NULL DEFAULT '[]'::jsonb,
      reveal_knowledge JSONB,
      committed_allocations JSONB,
      domain_results JSONB,
      revealed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      committed_at TIMESTAMP WITH TIME ZONE,
      resolved_at TIMESTAMP WITH TIME ZONE
    );

    CREATE TABLE IF NOT EXISTS performance_gap.company_metrics_v2 (
      id BIGSERIAL PRIMARY KEY,
      session_id VARCHAR(64) NOT NULL,
      company_id VARCHAR(64) NOT NULL,
      captured_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      elapsed_seconds INT NOT NULL,
      round INT NOT NULL,
      phase VARCHAR(32) NOT NULL,
      trigger VARCHAR(64) NOT NULL,
      turnover NUMERIC NOT NULL,
      avg_team_capability NUMERIC NOT NULL,
      avg_codified_knowledge NUMERIC NOT NULL,
      avg_corporate_intranet NUMERIC NOT NULL,
      avg_usable_intranet NUMERIC NOT NULL,
      knowledge_spend NUMERIC NOT NULL DEFAULT 0,
      consultant_spend NUMERIC NOT NULL DEFAULT 0,
      expected_successes NUMERIC NOT NULL DEFAULT 0,
      actual_successes INT NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS company_metrics_v2_session_company_idx
      ON performance_gap.company_metrics_v2(session_id, company_id, captured_at);
    CREATE INDEX IF NOT EXISTS event_decisions_v2_session_company_idx
      ON performance_gap.event_decisions_v2(session_id, company_id, round);
    CREATE INDEX IF NOT EXISTS company_runs_v2_versions_idx
      ON performance_gap.company_runs_v2(session_id, knowledge_strategy_initial);
  `);
}

export async function saveSessionV2(sessionInput: GameSession): Promise<void> {
  const session = asSessionV2(sessionInput);
  session.updatedAt = new Date().toISOString();
  memory.set(session.id, structuredClone(session));
  if (!pool) return;
  await pool.query(`
    INSERT INTO performance_gap.session_snapshots_v2 (id, state, updated_at)
    VALUES ($1, $2::jsonb, NOW())
    ON CONFLICT (id) DO UPDATE SET state = EXCLUDED.state, updated_at = NOW()
  `, [session.id, JSON.stringify(session)]);
}

export async function initialiseAnalyticsRun(session: GameSessionV2): Promise<void> {
  if (!pool) return;
  await pool.query(`
    INSERT INTO performance_gap.game_runs_v2
      (session_id,title,rules_version,deck_version,balance_version,companies_count,started_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7)
    ON CONFLICT (session_id) DO NOTHING
  `, [session.id, session.title, session.rulesVersion, session.deckVersion, session.balanceVersion, session.companies.length, session.createdAt]);

  for (const company of session.companies) {
    const m = calculateCompanyMetrics(company, session);
    await pool.query(`
      INSERT INTO performance_gap.company_runs_v2
        (session_id,company_id,company_name,starting_turnover,starting_avg_team,starting_avg_codified,starting_avg_intranet,starting_avg_usable_intranet)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT (session_id,company_id) DO NOTHING
    `, [session.id, company.id, company.name, company.startingTurnover, m.avgTeamCapability, m.avgCodifiedKnowledge, m.avgCorporateIntranet, m.avgUsableIntranet]);
    await recordCompanyMetric(session, company, 'GAME_START');
  }
}

export async function recordCompanyMetric(session: GameSessionV2, company: CompanyV2, trigger: string): Promise<void> {
  if (!pool) return;
  const m = calculateCompanyMetrics(company, session);
  await pool.query(`
    INSERT INTO performance_gap.company_metrics_v2
      (session_id,company_id,elapsed_seconds,round,phase,trigger,turnover,avg_team_capability,avg_codified_knowledge,avg_corporate_intranet,avg_usable_intranet,knowledge_spend,consultant_spend,expected_successes,actual_successes)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
  `, [session.id, company.id, elapsedSeconds(session), session.round, session.phase, trigger, company.turnover, m.avgTeamCapability, m.avgCodifiedKnowledge, m.avgCorporateIntranet, m.avgUsableIntranet, company.cumulativeKnowledgeSpend, company.cumulativeConsultantSpend, company.expectedSuccesses, company.actualSuccesses]);

  await pool.query(`
    UPDATE performance_gap.company_runs_v2 SET
      business_strategy_initial=$3, knowledge_strategy_initial=$4,
      business_strategy_final=$5, knowledge_strategy_final=$6,
      final_turnover=$7, final_avg_team=$8, final_avg_codified=$9,
      final_avg_intranet=$10, final_avg_usable_intranet=$11,
      expected_successes=$12, actual_successes=$13,
      knowledge_spend=$14, consultant_spend=$15,
      problems_drawn=$16, opportunities_drawn=$17
    WHERE session_id=$1 AND company_id=$2
  `, [session.id, company.id, company.businessStrategyInitial, company.knowledgeStrategyInitial, company.businessStrategyFinal, company.knowledgeStrategyFinal, company.turnover, m.avgTeamCapability, m.avgCodifiedKnowledge, m.avgCorporateIntranet, m.avgUsableIntranet, company.expectedSuccesses, company.actualSuccesses, company.cumulativeKnowledgeSpend, company.cumulativeConsultantSpend, company.problemEventsDrawn, company.opportunityEventsDrawn]);
}

export async function recordStrategyResponse(session: GameSessionV2, company: CompanyV2, stage: 'initial' | 'final'): Promise<void> {
  await recordCompanyMetric(session, company, stage === 'initial' ? 'STRATEGY_INITIAL' : 'STRATEGY_FINAL');
}

export async function recordEventReveal(session: GameSessionV2, company: CompanyV2, event: any, revealProbabilityPercent: number, revealKnowledge: any): Promise<void> {
  if (!pool) return;
  const site = event.targetSiteId ? company.sites.find((s) => s.id === event.targetSiteId) : null;
  event.revealProbabilityPercent = revealProbabilityPercent;
  event.turnoverBefore = company.turnover;
  event.siteTurnoverBefore = site?.turnover ?? null;
  await pool.query(`
    INSERT INTO performance_gap.event_decisions_v2
      (event_instance_id,session_id,company_id,round,card_id,card_title,event_type,event_scope,target_site_id,financial_exposure,company_turnover_before,site_turnover_before,reveal_probability_percent,knowledge_requirements,reveal_knowledge)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15::jsonb)
    ON CONFLICT (event_instance_id) DO NOTHING
  `, [event.instanceId, session.id, company.id, session.round, event.card.id, event.card.title, event.card.type, event.card.scope, event.targetSiteId || null, event.card.impact, company.turnover, site?.turnover ?? null, revealProbabilityPercent, JSON.stringify(event.card.domains), JSON.stringify(revealKnowledge)]);
}

export async function recordEventResolution(session: GameSessionV2, company: CompanyV2, event: any, committedProbabilityPercent: number, result: any): Promise<void> {
  if (!pool) return;
  event.committedProbabilityPercent = committedProbabilityPercent;
  event.netFinancialImpact = result.turnoverChange - result.interventionCost;
  await pool.query(`
    UPDATE performance_gap.event_decisions_v2 SET
      committed_probability_percent=$2,
      intervention_cost=$3,
      consultant_cost=$4,
      gross_business_impact=$5,
      net_financial_impact=$6,
      success=$7,
      committed_allocations=$8::jsonb,
      domain_results=$9::jsonb,
      committed_at=COALESCE(committed_at,NOW()),
      resolved_at=NOW()
    WHERE event_instance_id=$1
  `, [event.instanceId, committedProbabilityPercent, result.interventionCost, event.consultantSpend || 0, result.turnoverChange, result.turnoverChange - result.interventionCost, result.success, JSON.stringify(event.allocations), JSON.stringify(result.domainResults || [])]);
}

export async function finaliseAnalyticsRun(session: GameSessionV2, finalResults: any[]): Promise<void> {
  if (!pool) return;
  await pool.query(`UPDATE performance_gap.game_runs_v2 SET completed_at=NOW(), rounds_completed=$2, elapsed_seconds=$3, final_disruption_card_id=$4 WHERE session_id=$1`, [session.id, Math.min(session.round, session.config.rounds), elapsedSeconds(session), session.finalDisruptionCard?.id || null]);
  for (const result of finalResults) {
    const company = session.companies.find((c) => c.id === result.companyId);
    if (!company) continue;
    await recordCompanyMetric(session, company, 'FINAL_DISRUPTION');
    await pool.query(`UPDATE performance_gap.company_runs_v2 SET final_disruption_success=$3, final_disruption_probability=$4 WHERE session_id=$1 AND company_id=$2`, [session.id, company.id, result.success ?? null, result.finalProbabilityPercent ?? null]);
  }
}

export async function getAARData(sessionId: string): Promise<any> {
  if (!pool) return { available: false, reason: 'DATABASE_URL not configured' };
  const companies = await pool.query('SELECT * FROM performance_gap.company_runs_v2 WHERE session_id=$1 ORDER BY company_name', [sessionId.toUpperCase()]);
  const metrics = await pool.query('SELECT * FROM performance_gap.company_metrics_v2 WHERE session_id=$1 ORDER BY captured_at', [sessionId.toUpperCase()]);
  const events = await pool.query('SELECT * FROM performance_gap.event_decisions_v2 WHERE session_id=$1 ORDER BY round,revealed_at', [sessionId.toUpperCase()]);
  return { available: true, companies: companies.rows, metrics: metrics.rows, events: events.rows };
}

export async function getBenchmarkSummary(sessionId: string, companyId: string): Promise<any> {
  if (!pool) return { available: false, reason: 'DATABASE_URL not configured' };
  const current = await pool.query(`SELECT cr.*, gr.rules_version,gr.deck_version,gr.balance_version FROM performance_gap.company_runs_v2 cr JOIN performance_gap.game_runs_v2 gr USING(session_id) WHERE cr.session_id=$1 AND cr.company_id=$2`, [sessionId.toUpperCase(), companyId]);
  if (!current.rows.length) return { available: false, reason: 'Current company analytics not found' };
  const c = current.rows[0];
  const peers = await pool.query(`
    SELECT
      COUNT(*)::int AS n,
      AVG(final_turnover)::numeric(12,2) AS avg_final_turnover,
      AVG(final_avg_team)::numeric(12,2) AS avg_final_team,
      AVG(final_avg_codified)::numeric(12,2) AS avg_final_codified,
      AVG(final_avg_usable_intranet)::numeric(12,2) AS avg_final_usable_intranet,
      AVG(knowledge_spend)::numeric(12,2) AS avg_knowledge_spend,
      AVG(consultant_spend)::numeric(12,2) AS avg_consultant_spend,
      AVG(expected_successes)::numeric(12,2) AS avg_expected_successes,
      AVG(actual_successes)::numeric(12,2) AS avg_actual_successes,
      AVG(CASE WHEN final_disruption_success THEN 1 ELSE 0 END)::numeric(12,3) AS final_disruption_success_rate
    FROM performance_gap.company_runs_v2 cr
    JOIN performance_gap.game_runs_v2 gr USING(session_id)
    WHERE cr.session_id <> $1
      AND gr.rules_version=$2 AND gr.deck_version=$3 AND gr.balance_version=$4
  `, [sessionId.toUpperCase(), c.rules_version, c.deck_version, c.balance_version]);
  return { available: true, current: c, comparablePreviousGames: peers.rows[0] };
}

export async function getSessionV2(id: string): Promise<GameSessionV2 | null> {
  const key = id.toUpperCase();
  const cached = memory.get(key);
  if (cached) return asSessionV2(structuredClone(cached));
  if (!pool) return null;
  const result = await pool.query('SELECT state FROM performance_gap.session_snapshots_v2 WHERE id = $1', [key]);
  if (!result.rows.length) return null;
  const session = asSessionV2(result.rows[0].state as GameSession);
  memory.set(key, structuredClone(session));
  return session;
}

export async function listSessionsV2() {
  if (!pool) {
    return [...memory.values()].map((s) => ({ id: s.id, title: s.title, round: s.round, phase: s.phase, companiesCount: s.companies.length, updatedAt: s.updatedAt }));
  }
  const result = await pool.query(`
    SELECT id, state->>'title' AS title,
           COALESCE((state->>'round')::int,1) AS round,
           state->>'phase' AS phase,
           jsonb_array_length(state->'companies') AS companies_count,
           updated_at
    FROM performance_gap.session_snapshots_v2
    ORDER BY updated_at DESC
  `);
  return result.rows.map((r) => ({ id: r.id, title: r.title, round: r.round, phase: r.phase, companiesCount: r.companies_count, updatedAt: r.updated_at }));
}

export async function deleteSessionV2(id: string): Promise<void> {
  const key = id.toUpperCase();
  memory.delete(key);
  if (pool) await pool.query('DELETE FROM performance_gap.session_snapshots_v2 WHERE id = $1', [key]);
}

export async function resetSessionsV2(): Promise<void> {
  memory.clear();
  if (pool) await pool.query('TRUNCATE TABLE performance_gap.session_snapshots_v2');
}
