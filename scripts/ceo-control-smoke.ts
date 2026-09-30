import assert from 'node:assert/strict';
import type { GameSessionV2 } from '../src/types/gameV2.ts';
import { participantCanControlCompanyV1, reconcileCompanyControllersV1, transferCompanyControllerV1 } from '../src/server/companyControlV1.ts';

const session={
  id:'CEO-CONTROL-SMOKE',
  companies:[
    {id:'a',name:'Company A',controllerParticipantId:null},
    {id:'b',name:'Company B',controllerParticipantId:null},
  ],
  participants:[
    {id:'alice',sessionId:'CEO-CONTROL-SMOKE',name:'Alice',companyId:'a',role:'participant',lastSeen:'2026-01-01T00:00:00.000Z'},
    {id:'bob',sessionId:'CEO-CONTROL-SMOKE',name:'Bob',companyId:'a',role:'participant',lastSeen:'2026-01-02T00:00:00.000Z'},
    {id:'charlie',sessionId:'CEO-CONTROL-SMOKE',name:'Charlie',companyId:'b',role:'participant',lastSeen:'2026-01-01T00:00:00.000Z'},
  ],
} as any as GameSessionV2;

const repaired=reconcileCompanyControllersV1(session);
assert.ok(repaired.length>=2);
assert.equal(session.companies[0].controllerParticipantId,'alice','first player in Company A becomes CEO');
assert.equal(session.companies[1].controllerParticipantId,'charlie','first player in Company B becomes CEO');
assert.equal(session.participants.find(player=>player.id==='alice')?.role,'controller');
assert.equal(session.participants.find(player=>player.id==='bob')?.role,'participant');
assert.equal(participantCanControlCompanyV1(session,'a','alice'),true);
assert.equal(participantCanControlCompanyV1(session,'a','bob'),false);
assert.equal(participantCanControlCompanyV1(session,'b','alice'),false);

const denied=transferCompanyControllerV1(session,'a','bob','charlie',false);
assert.equal(denied.success,false,'another company cannot hand over Company A');

const transfer=transferCompanyControllerV1(session,'a','bob','alice',false);
assert.equal(transfer.success,true);
assert.equal(session.companies[0].controllerParticipantId,'bob');
assert.equal(session.participants.find(player=>player.id==='alice')?.role,'participant');
assert.equal(session.participants.find(player=>player.id==='bob')?.role,'controller');
assert.equal(participantCanControlCompanyV1(session,'a','alice'),false,'old CEO loses write control atomically');
assert.equal(participantCanControlCompanyV1(session,'a','bob'),true,'new CEO gains write control atomically');

const crossCompany=transferCompanyControllerV1(session,'a','charlie','bob',false);
assert.equal(crossCompany.success,false,'CEO cannot assign a player from another company');

const facilitator=transferCompanyControllerV1(session,'a','alice',null,true);
assert.equal(facilitator.success,true,'facilitator can reassign CEO inside the company');
assert.equal(session.companies[0].controllerParticipantId,'alice');

console.log('CEO single-writer control smoke tests passed.');
