import pg from 'pg';
import {
  GameSession,
  Participant,
  Company,
  Site,
  Expert,
  CoPMembership,
  ActiveEvent,
  GameEventLog
} from '../types/game.ts';

const { Pool } = pg;

let pool: pg.Pool | null = null;
const isPostgresConfigured = !!process.env.DATABASE_URL;

if (isPostgresConfigured) {
  try {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
    });
    console.log('[DB] Connecting to PostgreSQL / Neon database.');
  } catch (err) {
    console.error('[DB] PostgreSQL initialization error, falling back to in-memory store:', err);
  }
} else {
  console.log('[DB] DATABASE_URL not set; running with high-performance in-memory relational store.');
}

// In-Memory Fallback & Fast Cache Store
interface MemoryStore {
  sessions: Map<string, GameSession>;
  participants: Map<string, Participant>;
  eventLogs: GameEventLog[];
}

const memoryStore: MemoryStore = {
  sessions: new Map(),
  participants: new Map(),
  eventLogs: [],
};

/**
 * Initialize PostgreSQL Schema if connected
 */
export async function initDatabase(): Promise<void> {
  if (!pool) return;

  const client = await pool.connect();
  try {
    await client.query(`
      CREATE SCHEMA IF NOT EXISTS performance_gap;

      CREATE TABLE IF NOT EXISTS performance_gap.game_sessions (
        id VARCHAR(64) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        round INT NOT NULL DEFAULT 1,
        phase VARCHAR(32) NOT NULL DEFAULT 'events',
        is_paused BOOLEAN NOT NULL DEFAULT FALSE,
        is_final_disruption_active BOOLEAN NOT NULL DEFAULT FALSE,
        final_disruption_card JSONB,
        final_disruption_resolved BOOLEAN DEFAULT FALSE,
        cop_memberships JSONB DEFAULT '[]'::jsonb,
        config JSONB NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS performance_gap.participants (
        id VARCHAR(64) PRIMARY KEY,
        session_id VARCHAR(64) NOT NULL,
        name VARCHAR(128) NOT NULL,
        company_id VARCHAR(64) NOT NULL,
        role VARCHAR(32) NOT NULL DEFAULT 'participant',
        last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS performance_gap.companies (
        id VARCHAR(64) PRIMARY KEY,
        session_id VARCHAR(64) NOT NULL,
        name VARCHAR(128) NOT NULL,
        turnover NUMERIC NOT NULL,
        starting_turnover NUMERIC NOT NULL,
        intranet JSONB NOT NULL,
        intranet_round_growth JSONB NOT NULL,
        automated_domains JSONB DEFAULT '[]'::jsonb,
        horizon_scan_domain VARCHAR(32),
        horizon_scan_used_this_round BOOLEAN DEFAULT FALSE,
        actions_remaining INT NOT NULL DEFAULT 4,
        audited_site_id VARCHAR(64)
      );

      CREATE TABLE IF NOT EXISTS performance_gap.sites (
        id VARCHAR(64) NOT NULL,
        session_id VARCHAR(64) NOT NULL,
        company_id VARCHAR(64) NOT NULL,
        name VARCHAR(128) NOT NULL,
        turnover NUMERIC NOT NULL,
        is_rd_site BOOLEAN DEFAULT FALSE,
        is_closed BOOLEAN DEFAULT FALSE,
        team_capability JSONB NOT NULL,
        codified_knowledge JSONB NOT NULL,
        coordinates JSONB NOT NULL,
        PRIMARY KEY (session_id, company_id, id)
      );

      CREATE TABLE IF NOT EXISTS performance_gap.experts (
        id VARCHAR(64) NOT NULL,
        session_id VARCHAR(64) NOT NULL,
        company_id VARCHAR(64) NOT NULL,
        name VARCHAR(128) NOT NULL,
        domains JSONB NOT NULL,
        location VARCHAR(64) NOT NULL,
        home_location VARCHAR(64) NOT NULL,
        state VARCHAR(64) NOT NULL DEFAULT 'Available',
        is_spof BOOLEAN DEFAULT FALSE,
        spof_domains JSONB DEFAULT '[]'::jsonb,
        is_vacant BOOLEAN DEFAULT FALSE,
        PRIMARY KEY (session_id, company_id, id)
      );

      CREATE TABLE IF NOT EXISTS performance_gap.active_events (
        instance_id VARCHAR(64) PRIMARY KEY,
        session_id VARCHAR(64) NOT NULL,
        company_id VARCHAR(64) NOT NULL,
        card JSONB NOT NULL,
        target_site_id VARCHAR(64),
        allocations JSONB DEFAULT '{}'::jsonb,
        is_resolved BOOLEAN DEFAULT FALSE,
        success BOOLEAN,
        domain_results JSONB,
        turnover_change_applied NUMERIC,
        experiential_learning_awarded BOOLEAN DEFAULT FALSE
      );

      CREATE TABLE IF NOT EXISTS performance_gap.game_events (
        id VARCHAR(64) PRIMARY KEY,
        session_id VARCHAR(64) NOT NULL,
        company_id VARCHAR(64),
        participant_id VARCHAR(64),
        event_type VARCHAR(64) NOT NULL,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        round INT NOT NULL,
        phase VARCHAR(32) NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        payload JSONB DEFAULT '{}'::jsonb
      );
    `);
    console.log('[DB] Schema performance_gap initialized successfully in PostgreSQL.');
  } catch (err) {
    console.error('[DB] Error initializing PostgreSQL schema:', err);
  } finally {
    client.release();
  }
}

/**
 * Save complete GameSession state
 */
export async function saveGameSession(session: GameSession): Promise<void> {
  // Always update memory store for fast sub-millisecond retrieval & SSE
  memoryStore.sessions.set(session.id, session);

  if (!pool) return;

  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Upsert game_sessions
      await client.query(`
        INSERT INTO performance_gap.game_sessions 
        (id, title, round, phase, is_paused, is_final_disruption_active, final_disruption_card, final_disruption_resolved, cop_memberships, config, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          round = EXCLUDED.round,
          phase = EXCLUDED.phase,
          is_paused = EXCLUDED.is_paused,
          is_final_disruption_active = EXCLUDED.is_final_disruption_active,
          final_disruption_card = EXCLUDED.final_disruption_card,
          final_disruption_resolved = EXCLUDED.final_disruption_resolved,
          cop_memberships = EXCLUDED.cop_memberships,
          config = EXCLUDED.config,
          updated_at = NOW();
      `, [
        session.id,
        session.title,
        session.round,
        session.phase,
        session.isPaused,
        session.isFinalDisruptionActive,
        JSON.stringify(session.finalDisruptionCard || null),
        session.finalDisruptionResolved || false,
        JSON.stringify(session.copMemberships || []),
        JSON.stringify(session.config),
      ]);

      // Upsert companies, sites, experts
      for (const comp of session.companies) {
        await client.query(`
          INSERT INTO performance_gap.companies
          (id, session_id, name, turnover, starting_turnover, intranet, intranet_round_growth, automated_domains, horizon_scan_domain, horizon_scan_used_this_round, actions_remaining, audited_site_id)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            turnover = EXCLUDED.turnover,
            starting_turnover = EXCLUDED.starting_turnover,
            intranet = EXCLUDED.intranet,
            intranet_round_growth = EXCLUDED.intranet_round_growth,
            automated_domains = EXCLUDED.automated_domains,
            horizon_scan_domain = EXCLUDED.horizon_scan_domain,
            horizon_scan_used_this_round = EXCLUDED.horizon_scan_used_this_round,
            actions_remaining = EXCLUDED.actions_remaining,
            audited_site_id = EXCLUDED.audited_site_id;
        `, [
          comp.id,
          session.id,
          comp.name,
          comp.turnover,
          comp.startingTurnover,
          JSON.stringify(comp.intranet),
          JSON.stringify(comp.intranetRoundGrowth),
          JSON.stringify(comp.automatedDomains),
          comp.horizonScanDomain,
          comp.horizonScanUsedThisRound,
          comp.actionsRemaining,
          comp.auditedSiteId,
        ]);

        for (const site of comp.sites) {
          await client.query(`
            INSERT INTO performance_gap.sites
            (id, session_id, company_id, name, turnover, is_rd_site, is_closed, team_capability, codified_knowledge, coordinates)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (session_id, company_id, id) DO UPDATE SET
              turnover = EXCLUDED.turnover,
              is_closed = EXCLUDED.is_closed,
              team_capability = EXCLUDED.team_capability,
              codified_knowledge = EXCLUDED.codified_knowledge;
          `, [
            site.id,
            session.id,
            comp.id,
            site.name,
            site.turnover,
            site.isRDSite,
            site.isClosed,
            JSON.stringify(site.teamCapability),
            JSON.stringify(site.codifiedKnowledge),
            JSON.stringify(site.coordinates),
          ]);
        }

        for (const exp of comp.experts) {
          await client.query(`
            INSERT INTO performance_gap.experts
            (id, session_id, company_id, name, domains, location, home_location, state, is_spof, spof_domains, is_vacant)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            ON CONFLICT (session_id, company_id, id) DO UPDATE SET
              name = EXCLUDED.name,
              domains = EXCLUDED.domains,
              location = EXCLUDED.location,
              home_location = EXCLUDED.home_location,
              state = EXCLUDED.state,
              is_spof = EXCLUDED.is_spof,
              spof_domains = EXCLUDED.spof_domains,
              is_vacant = EXCLUDED.is_vacant;
          `, [
            exp.id,
            session.id,
            comp.id,
            exp.name,
            JSON.stringify(exp.domains),
            exp.location,
            exp.homeLocation,
            exp.state,
            exp.isSPOF,
            JSON.stringify(exp.spofDomains),
            exp.isVacant || false,
          ]);
        }
      }

      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      console.error('[DB] PostgreSQL save transaction error:', e);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[DB] PostgreSQL connection error:', err);
  }
}

/**
 * Get complete GameSession state
 */
export async function getGameSession(sessionId: string): Promise<GameSession | null> {
  const cached = memoryStore.sessions.get(sessionId);
  if (cached) return cached;

  if (!pool) return null;

  try {
    const client = await pool.connect();
    try {
      const sessRes = await client.query('SELECT * FROM performance_gap.game_sessions WHERE id = $1', [sessionId]);
      if (sessRes.rows.length === 0) return null;
      const sRow = sessRes.rows[0];

      const compRes = await client.query('SELECT * FROM performance_gap.companies WHERE session_id = $1', [sessionId]);
      const companies: Company[] = [];

      for (const cRow of compRes.rows) {
        const sitesRes = await client.query('SELECT * FROM performance_gap.sites WHERE session_id = $1 AND company_id = $2', [sessionId, cRow.id]);
        const expertsRes = await client.query('SELECT * FROM performance_gap.experts WHERE session_id = $1 AND company_id = $2', [sessionId, cRow.id]);

        const sites: Site[] = sitesRes.rows.map((r) => ({
          id: r.id,
          name: r.name,
          turnover: Number(r.turnover),
          isRDSite: r.is_rd_site,
          isClosed: r.is_closed,
          teamCapability: r.team_capability,
          codifiedKnowledge: r.codified_knowledge,
          coordinates: r.coordinates,
        }));

        const experts: Expert[] = expertsRes.rows.map((r) => ({
          id: r.id,
          name: r.name,
          domains: r.domains,
          location: r.location,
          homeLocation: r.home_location,
          state: r.state,
          isSPOF: r.is_spof,
          spofDomains: r.spof_domains,
          isVacant: r.is_vacant,
        }));

        companies.push({
          id: cRow.id,
          name: cRow.name,
          turnover: Number(cRow.turnover),
          startingTurnover: Number(cRow.starting_turnover),
          intranet: cRow.intranet,
          intranetRoundGrowth: cRow.intranet_round_growth,
          automatedDomains: cRow.automated_domains || [],
          horizonScanDomain: cRow.horizon_scan_domain,
          horizonScanUsedThisRound: cRow.horizon_scan_used_this_round,
          actionsRemaining: cRow.actions_remaining,
          sites,
          experts,
          auditedSiteId: cRow.audited_site_id,
        });
      }

      const session: GameSession = {
        id: sRow.id,
        title: sRow.title,
        round: sRow.round,
        phase: sRow.phase,
        isPaused: sRow.is_paused,
        isFinalDisruptionActive: sRow.is_final_disruption_active,
        finalDisruptionCard: sRow.final_disruption_card,
        finalDisruptionResolved: sRow.final_disruption_resolved,
        companies,
        activeEvents: {},
        copMemberships: sRow.cop_memberships || [],
        config: sRow.config,
        createdAt: sRow.created_at,
        updatedAt: sRow.updated_at,
      };

      memoryStore.sessions.set(sessionId, session);
      return session;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[DB] PostgreSQL read error:', err);
    return null;
  }
}

/**
 * List all active sessions
 */
export async function listGameSessions(): Promise<{ id: string; title: string; round: number; phase: string; companiesCount: number; updatedAt: string }[]> {
  const list: { id: string; title: string; round: number; phase: string; companiesCount: number; updatedAt: string }[] = [];
  for (const s of memoryStore.sessions.values()) {
    list.push({
      id: s.id,
      title: s.title,
      round: s.round,
      phase: s.phase,
      companiesCount: s.companies.length,
      updatedAt: s.updatedAt,
    });
  }
  return list;
}

/**
 * Append-only Game Event Log write
 */
export async function logGameEvent(event: Omit<GameEventLog, 'id' | 'timestamp'>): Promise<GameEventLog> {
  const fullLog: GameEventLog = {
    ...event,
    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toISOString(),
  };

  memoryStore.eventLogs.push(fullLog);

  if (pool) {
    try {
      await pool.query(`
        INSERT INTO performance_gap.game_events
        (id, session_id, company_id, participant_id, event_type, timestamp, round, phase, title, description, payload)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [
        fullLog.id,
        fullLog.sessionId,
        fullLog.companyId || null,
        fullLog.participantId || null,
        fullLog.eventType,
        fullLog.timestamp,
        fullLog.round,
        fullLog.phase,
        fullLog.title,
        fullLog.description,
        JSON.stringify(fullLog.payload || {}),
      ]);
    } catch (e) {
      console.error('[DB] Failed to persist game event log to Postgres:', e);
    }
  }

  return fullLog;
}

/**
 * Retrieve Event Logs for a session (for After Action Review and Live Activity Feed)
 */
export async function getGameEventLogs(sessionId: string): Promise<GameEventLog[]> {
  return memoryStore.eventLogs.filter((l) => l.sessionId === sessionId);
}

/**
 * Register or update Participant
 */
export async function saveParticipant(participant: Participant): Promise<void> {
  memoryStore.participants.set(participant.id, participant);

  if (pool) {
    try {
      await pool.query(`
        INSERT INTO performance_gap.participants
        (id, session_id, name, company_id, role, last_seen)
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          company_id = EXCLUDED.company_id,
          role = EXCLUDED.role,
          last_seen = NOW();
      `, [
        participant.id,
        participant.sessionId,
        participant.name,
        participant.companyId,
        participant.role,
      ]);
    } catch (e) {
      console.error('[DB] Error saving participant to Postgres:', e);
    }
  }
}

/**
 * Delete a specific Game Session
 */
export async function deleteGameSession(sessionId: string): Promise<boolean> {
  const normId = sessionId.toUpperCase();
  memoryStore.sessions.delete(normId);
  memoryStore.eventLogs = memoryStore.eventLogs.filter((l) => l.sessionId !== normId);

  if (pool) {
    try {
      await pool.query(`DELETE FROM performance_gap.game_sessions WHERE id = $1`, [normId]);
    } catch (e) {
      console.error('[DB] Error deleting session from PostgreSQL:', e);
    }
  }
  return true;
}

/**
 * Reset all database sessions, participants, and event logs
 */
export async function resetAllDatabaseData(): Promise<void> {
  memoryStore.sessions.clear();
  memoryStore.participants.clear();
  memoryStore.eventLogs = [];

  if (pool) {
    try {
      await pool.query(`
        TRUNCATE TABLE performance_gap.active_events,
                       performance_gap.experts,
                       performance_gap.sites,
                       performance_gap.companies,
                       performance_gap.participants,
                       performance_gap.event_logs,
                       performance_gap.game_sessions CASCADE;
      `);
      console.log('[DB] Database tables truncated successfully.');
    } catch (e) {
      console.error('[DB] Error truncating PostgreSQL tables:', e);
    }
  }
}


