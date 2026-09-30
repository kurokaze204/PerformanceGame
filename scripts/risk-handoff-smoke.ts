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

// Permanent expert relocation is available outside Invest, costs SIF only, and does not consume an Action.
{
  const relocation=await createNewSessionV2('EXPERT-RELOCATION-SMOKE','Expert relocation smoke',['Alpha'],{experienceMode:'expert',gameDurationMinutes:30});
  const company=relocation.companies[0];
  relocation.phase='respond';
  (company as any).roundPhase='events';
  const expert=company.experts.find(candidate=>!candidate.isVacant)!;
  expert.state='Supporting Event';
  const target=company.sites.find(site=>!site.isClosed&&site.id!==expert.location)!;
  const actionsBefore=company.actionsRemaining;
  const sifBefore=company.strategicInvestmentFund;
  await saveSessionV2(relocation);
  const moved:any=await knowledgeActionV2(relocation.id,company.id,{type:'MOVE_EXPERT',expertId:expert.id,targetLocation:target.id});
  assert.equal(moved.success,true,'expert relocation must work during the Event phase, even while the expert is supporting an Event');
  assert.equal(moved.session.companies[0].experts.find((candidate:any)=>candidate.id===expert.id).location,target.id);
  assert.equal(moved.session.companies[0].strategicInvestmentFund,sifBefore-20);
  assert.equal(moved.session.companies[0].actionsRemaining,actionsBefore,'permanent relocation must not consume an Action');
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
