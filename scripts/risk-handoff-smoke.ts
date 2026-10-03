import assert from 'node:assert/strict';
import { createNewSessionV2, getSessionV2, knowledgeActionV2 } from '../src/server/gameServiceV9.ts';
import { saveSessionV2 } from '../src/server/dbV2.ts';

// Permanent expert relocation is available outside Invest, costs SIF only, and does not consume an Action.
{
  const relocation=await createNewSessionV2('EXPERT-RELOCATION-SMOKE','Expert relocation smoke',['Alpha'],{experienceMode:'expert',gameDurationMinutes:30});
  const company=relocation.companies[0];
  company.roundPhase='events';
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

// One company finishing Knowledge Risk advances only that company. There is no
// waiting barrier and no phase/round change for another company.
{
  const session=await createNewSessionV2('INDEPENDENT-ROUND-SMOKE','Independent rounds',['Alpha','Beta'],{experienceMode:'newbie',gameDurationMinutes:60});
  const alpha=session.companies[0],beta=session.companies[1];
  alpha.roundPhase='risk';
  beta.roundPhase='events';
  const alphaRound=alpha.round;
  const betaRound=beta.round;
  await saveSessionV2(session);

  const result:any=await knowledgeActionV2(session.id,alpha.id,{type:'FINISH_RISK'});
  assert.equal(result.success,true);
  const nextAlpha=result.session.companies.find((company:any)=>company.id===alpha.id)!;
  const sameBeta=result.session.companies.find((company:any)=>company.id===beta.id)!;
  assert.equal(nextAlpha.round,alphaRound+1,'the company finishing risk starts its own next round');
  assert.equal(nextAlpha.roundPhase,'events');
  assert.equal(sameBeta.round,betaRound,'another company must not be advanced');
  assert.equal(sameBeta.roundPhase,'events','another company phase must not be changed');
  assert.equal(result.session.round,Math.min(nextAlpha.round,sameBeta.round),'session round is a compatibility summary, not a driver');
  assert.equal(result.session.companies.some((company:any)=>company.roundPhase==='waiting'),false,'waiting is retired from multiplayer');
}

// The shared timer may still make the Final Challenge due, but it is started
// from a company boundary without reintroducing a normal-round barrier.
{
  const session=await createNewSessionV2('RISK-HANDOFF-DIRECT','Risk final smoke',['Alpha'],{experienceMode:'newbie',gameDurationMinutes:30});
  const company=session.companies[0];
  session.timerStartedAt=new Date(Date.now()-31*60*1000).toISOString();
  session.timerEndsAt=new Date(Date.now()-1000).toISOString();
  session.timerPausedSecondsRemaining=null;
  company.roundPhase='risk';
  await saveSessionV2(session);
  const result:any=await knowledgeActionV2(session.id,company.id,{type:'FINISH_RISK'});
  assert.equal(result.success,true);
  assert.equal(result.session.isFinalDisruptionActive,true,'expired timer must make the Final Challenge available when a company reaches its boundary');
  assert.equal(result.session.phase,'respond');
}

// Persisted waiting snapshots from the abandoned synchronous model are
// normalised back into a real company phase rather than resurrecting the old barrier.
{
  const session=await createNewSessionV2('RISK-HANDOFF-RECOVERY','Waiting migration',['Alpha'],{experienceMode:'newbie',gameDurationMinutes:30});
  (session.companies[0] as any).roundPhase='waiting';
  session.phase='risk';
  await saveSessionV2(session);
  const recovered=await getSessionV2(session.id);
  assert.ok(recovered);
  assert.equal(recovered!.companies[0].roundPhase,'risk');
  assert.equal(recovered!.companies.some((company:any)=>company.roundPhase==='waiting'),false);
  assert.equal(recovered!.phase,'respond');
}

console.log('Independent Knowledge Risk handoff smoke tests passed.');
