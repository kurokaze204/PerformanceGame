import assert from 'node:assert/strict';
import type { GameSessionV2 } from '../src/types/gameV2.ts';
import {
  claimCompanyOpenEventV1,
  clearCompanyOpenEventV1,
  companyOpenEventIdV1,
  serialiseCompanyEventOpenV1,
} from '../src/engine/companyEventOpenV1.ts';

const companyId='comp-a';
const makeEvent=(id:string)=>({
  instanceId:id,
  isResolved:false,
  card:{id, title:id, description:'', type:'problem', scope:'local', domains:[{domain:'engineering',difficulty:4}], impact:10, tags:[]},
  allocations:{engineering:{}},
}) as any;

const session={
  id:'EVENT-OPEN-SMOKE',
  companies:[{id:companyId,name:'Apex'}],
  activeEvents:{[companyId]:[makeEvent('event-1'),makeEvent('event-2')]},
} as any as GameSessionV2;

// Same-company propagation: first click becomes the sole authoritative open Event.
const first=claimCompanyOpenEventV1(session,companyId,'event-2');
assert.equal(first.success,true);
assert.equal(first.claimed,true);
assert.equal(first.winnerEventInstanceId,'event-2');
assert.equal(companyOpenEventIdV1(session,companyId),'event-2');

// A second player clicking the already-open card converges on exactly the same Event.
const same=claimCompanyOpenEventV1(session,companyId,'event-2');
assert.equal(same.success,true);
assert.equal(same.claimed,false);
assert.equal(same.winnerEventInstanceId,'event-2');
assert.equal(companyOpenEventIdV1(session,companyId),'event-2');

// Clear it as resolution would, then exercise the actual serialiser used by the server.
assert.equal(clearCompanyOpenEventV1(session,companyId,'event-2'),true);
assert.equal(companyOpenEventIdV1(session,companyId),null);

const clicks:string[]=[];
const click=(eventId:string,delay:number)=>serialiseCompanyEventOpenV1(session.id,companyId,async()=>{
  clicks.push(`start:${eventId}`);
  if(delay)await new Promise(resolve=>setTimeout(resolve,delay));
  const claim=claimCompanyOpenEventV1(session,companyId,eventId);
  clicks.push(`finish:${eventId}:${claim.winnerEventInstanceId}`);
  return claim;
});

// Two players click different cards effectively together. The queue makes the request
// that reaches the authoritative lock first the winner; the other receives that winner.
const [a,b]=await Promise.all([
  click('event-1',20),
  click('event-2',0),
]);
assert.equal(a.success,true);
assert.equal(b.success,true);
assert.equal(a.winnerEventInstanceId,'event-1');
assert.equal(b.winnerEventInstanceId,'event-1');
assert.equal(a.claimed,true);
assert.equal(b.claimed,false);
assert.equal(companyOpenEventIdV1(session,companyId),'event-1');
assert.deepEqual(clicks,[
  'start:event-1',
  'finish:event-1:event-1',
  'start:event-2',
  'finish:event-2:event-1',
]);

// There must never be a second authoritative open-card field for the company.
assert.equal(String((session.companies[0] as any).uiOpenEventInstanceId),'event-1');

console.log('Company Event-open synchronisation and race smoke tests passed.');
