import assert from 'node:assert/strict';
import { saveSessionAccessV1, verifySessionFacilitatorPasswordV1 } from '../src/server/sessionAccessV1.ts';

const sessionId='SESSION-ACCESS-SMOKE';
await saveSessionAccessV1(sessionId,false,'sample-passphrase-123');
assert.equal(await verifySessionFacilitatorPasswordV1(sessionId,'sample-passphrase-123'),true);
assert.equal(await verifySessionFacilitatorPasswordV1(sessionId,'incorrect-passphrase'),false);

console.log('Session access password smoke tests passed.');
