import crypto from 'node:crypto';
import pg from 'pg';

const { Pool } = pg;
const pool = process.env.DATABASE_URL ? new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
}) : null;

interface AccessRecord { isPublic:boolean; passwordHash:string|null; }
const memory = new Map<string,AccessRecord>();

function hashPassword(password:string,salt=crypto.randomBytes(16).toString('hex')){
  const hash=crypto.scryptSync(password,salt,64).toString('hex');
  return `${salt}:${hash}`;
}
function matchesPassword(password:string,stored:string|null){
  if(!stored)return false;
  const [salt,hash]=stored.split(':');
  if(!salt||!hash)return false;
  const candidate=crypto.scryptSync(password,salt,64);
  const expected=Buffer.from(hash,'hex');
  return candidate.length===expected.length&&crypto.timingSafeEqual(candidate,expected);
}

export async function initSessionAccessV1(){
  if(!pool)return;
  await pool.query(`
    CREATE SCHEMA IF NOT EXISTS performance_gap;
    CREATE TABLE IF NOT EXISTS performance_gap.session_access_v1 (
      session_id VARCHAR(64) PRIMARY KEY,
      is_public BOOLEAN NOT NULL DEFAULT FALSE,
      facilitator_password_hash TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);
}

export async function saveSessionAccessV1(sessionId:string,isPublic:boolean,facilitatorPassword?:string){
  const id=sessionId.toUpperCase();
  const passwordHash=facilitatorPassword?.trim()?hashPassword(facilitatorPassword.trim()):null;
  memory.set(id,{isPublic,passwordHash});
  if(!pool)return;
  await initSessionAccessV1();
  await pool.query(`
    INSERT INTO performance_gap.session_access_v1 (session_id,is_public,facilitator_password_hash,updated_at)
    VALUES ($1,$2,$3,NOW())
    ON CONFLICT (session_id) DO UPDATE SET
      is_public=EXCLUDED.is_public,
      facilitator_password_hash=COALESCE(EXCLUDED.facilitator_password_hash,performance_gap.session_access_v1.facilitator_password_hash),
      updated_at=NOW()
  `,[id,isPublic,passwordHash]);
}

export async function verifySessionFacilitatorPasswordV1(sessionId:string,password:string){
  const id=sessionId.toUpperCase();
  const cached=memory.get(id);
  if(cached?.passwordHash)return matchesPassword(password,cached.passwordHash);
  if(!pool)return false;
  await initSessionAccessV1();
  const result=await pool.query('SELECT is_public,facilitator_password_hash FROM performance_gap.session_access_v1 WHERE session_id=$1',[id]);
  if(!result.rows.length)return false;
  const record={isPublic:Boolean(result.rows[0].is_public),passwordHash:result.rows[0].facilitator_password_hash as string|null};
  memory.set(id,record);
  return matchesPassword(password,record.passwordHash);
}

export async function listPublicSessionsV1(archived=false){
  const cutoff=Date.now()-48*60*60*1000;
  if(!pool){
    return [];
  }
  await initSessionAccessV1();
  const result=await pool.query(`
    SELECT s.id,
      s.state->>'title' AS title,
      COALESCE((s.state->>'round')::int,1) AS round,
      s.state->>'phase' AS phase,
      COALESCE((s.state->>'createdAt')::timestamptz,s.updated_at) AS created_at,
      s.updated_at,
      jsonb_array_length(s.state->'companies') AS companies_count,
      COALESCE((s.state->>'finalDisruptionResolved')::boolean,false) AS completed
    FROM performance_gap.session_snapshots_v2 s
    JOIN performance_gap.session_access_v1 a ON a.session_id=s.id
    WHERE a.is_public=TRUE
    ORDER BY COALESCE((s.state->>'createdAt')::timestamptz,s.updated_at) DESC
  `);
  return result.rows.filter(row=>{
    const recent=new Date(row.created_at).getTime()>=cutoff;
    const complete=Boolean(row.completed);
    return archived ? (!recent||complete) : (recent&&!complete);
  }).map(row=>({
    id:row.id,title:row.title,round:row.round,phase:row.phase,
    companiesCount:row.companies_count,createdAt:row.created_at,updatedAt:row.updated_at,
    completed:Boolean(row.completed)
  }));
}
