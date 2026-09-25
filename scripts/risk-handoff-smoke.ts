import assert from 'node:assert/strict';
import { createNewSessionV2, getSessionV2, knowledgeActionV2 } from '../src/server/gameServiceV8.ts';
import { saveSessionV2 } from '../src/server/dbV2.ts';

async function expiredSolo(id:string){
  const session=await createNewSessionV2(id,'Risk handoff smoke',['Alpha'],{experienceMode:'newbie',gameDurationMinutes:30});
  session.timerStartedAt=new Date(Date.now()-31*60*1000).toISOString();
  session.timerEndsAt=new Date(Date.now()-1000).toISOString();
  session.timerPausedSecondsRemaining=null;
  session.phase='investment';
  (session.companies[0] as any).roundPhase='risk';
  await saveSessionV2(session);
  return session;
}

const direct=await expiredSolo('RISK-HANDOFF-DIRECT');
const result:any=await knowledgeActionV2(direct.id,direct.companies[0].id,{type:'FINISH_RISK'});
assert.equal(result.success,true);
assert.equal(result.session.isFinalDisruptionActive,true,'expired timer must enter Final Disruption when Knowledge Risk finishes');
assert.equal(result.session.phase,'respond');

const stranded=await expiredSolo('RISK-HANDOFF-RECOVERY');
(stranded.companies[0] as any).roundPhase='waiting';
stranded.phase='risk';
await saveSessionV2(stranded);
const recovered=await getSessionV2(stranded.id);
assert.ok(recovered);
assert.equal(recovered!.isFinalDisruptionActive,true,'GET must self-heal an all-waiting Knowledge Risk session');
assert.equal(recovered!.phase,'respond');

console.log('Knowledge Risk handoff smoke tests passed.');
