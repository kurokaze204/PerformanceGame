import pg from 'pg';
import { GameSession } from '../types/game.ts';
import { GameSessionV2, asSessionV2 } from '../types/gameV2.ts';
import { initDatabase, logGameEvent, getGameEventLogs, saveParticipant } from './db.ts';

const { Pool } = pg;
const pool = process.env.DATABASE_URL ? new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
}) : null;

const memory = new Map<string, GameSessionV2>();

export { logGameEvent, getGameEventLogs, saveParticipant };

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
