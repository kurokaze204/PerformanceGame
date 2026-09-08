import pg from 'pg';

const { Pool } = pg;
const pool = process.env.DATABASE_URL ? new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
}) : null;

export interface PlayerOptInInput {
  sessionId:string;
  companyId:string;
  playerName?:string;
  email:string;
  wantsResults:boolean;
  wantsUpdates:boolean;
}

const memory:any[]=[];

export async function initPlayerOptInV1(){
  if(!pool)return;
  await pool.query(`
    CREATE SCHEMA IF NOT EXISTS performance_gap;
    CREATE TABLE IF NOT EXISTS performance_gap.player_opt_in_v1 (
      id BIGSERIAL PRIMARY KEY,
      session_id VARCHAR(64) NOT NULL,
      company_id VARCHAR(128) NOT NULL,
      player_name TEXT,
      email TEXT NOT NULL,
      wants_results BOOLEAN NOT NULL DEFAULT FALSE,
      wants_updates BOOLEAN NOT NULL DEFAULT FALSE,
      consented_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS player_opt_in_v1_email_idx ON performance_gap.player_opt_in_v1 (LOWER(email));
  `);
}

export async function savePlayerOptInV1(input:PlayerOptInInput){
  const email=String(input.email||'').trim().toLowerCase();
  if(!email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('Enter a valid email address.');
  if(!input.wantsResults&&!input.wantsUpdates)throw new Error('Choose at least one email option.');
  const row={
    sessionId:String(input.sessionId||'').toUpperCase(),
    companyId:String(input.companyId||''),
    playerName:String(input.playerName||'').trim(),
    email,
    wantsResults:Boolean(input.wantsResults),
    wantsUpdates:Boolean(input.wantsUpdates),
    consentedAt:new Date().toISOString(),
  };
  memory.push(row);
  if(pool){
    await initPlayerOptInV1();
    await pool.query(`
      INSERT INTO performance_gap.player_opt_in_v1
        (session_id,company_id,player_name,email,wants_results,wants_updates,consented_at)
      VALUES ($1,$2,$3,$4,$5,$6,NOW())
    `,[row.sessionId,row.companyId,row.playerName||null,row.email,row.wantsResults,row.wantsUpdates]);
  }
  return row;
}
