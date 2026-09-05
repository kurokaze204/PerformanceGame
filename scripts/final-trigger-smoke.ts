import assert from 'node:assert/strict';
import { finalChallengeDue } from '../src/server/gameServiceV4.ts';
import type { GameSessionV2 } from '../src/types/gameV2.ts';

function session(overrides: Partial<GameSessionV2> = {}): GameSessionV2 {
  return {
    id: 'FINAL-TRIGGER-SMOKE',
    title: 'Final trigger smoke',
    round: 1,
    phase: 'risk',
    isPaused: false,
    isFinalDisruptionActive: false,
    finalDisruptionCard: undefined,
    finalDisruptionResolved: false,
    companies: [],
    activeEvents: {},
    copMemberships: [],
    config: {} as any,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    timerStartedAt: null,
    timerEndsAt: null,
    timerPausedSecondsRemaining: 60 * 60,
    riskResults: null,
    rulesVersion: 'test',
    deckVersion: 'test',
    balanceVersion: 'test',
    experienceMode: 'newbie',
    gameDurationMinutes: 60,
    finalWindowMinutes: 10,
    minutesPerMove: 8,
    maxPlayersPerCompany: 6,
    participants: [],
    gameEndMode: 'time',
    finalRoundCount: 30,
    ...overrides,
  } as GameSessionV2;
}

// Timed games never use round count as a fallback, even at very high rounds.
assert.equal(finalChallengeDue(session({ round: 99 })), false);

// A running timed game is not due outside the final window.
assert.equal(finalChallengeDue(session({
  timerStartedAt: new Date().toISOString(),
  timerEndsAt: new Date(Date.now() + 11 * 60 * 1000).toISOString(),
  timerPausedSecondsRemaining: null,
})), false);

// A running timed game is due inside the final window.
assert.equal(finalChallengeDue(session({
  timerStartedAt: new Date().toISOString(),
  timerEndsAt: new Date(Date.now() + 9 * 60 * 1000).toISOString(),
  timerPausedSecondsRemaining: null,
})), true);

// Resetting the timer removes automatic final eligibility until it is started again.
assert.equal(finalChallengeDue(session({
  round: 99,
  timerStartedAt: null,
  timerEndsAt: null,
  timerPausedSecondsRemaining: 60 * 60,
})), false);

// Expert round-count games enter the final after the configured normal round completes.
assert.equal(finalChallengeDue(session({
  experienceMode: 'expert',
  gameEndMode: 'rounds',
  finalRoundCount: 30,
  round: 29,
})), false);
assert.equal(finalChallengeDue(session({
  experienceMode: 'expert',
  gameEndMode: 'rounds',
  finalRoundCount: 30,
  round: 30,
})), true);

// Newbie mode remains time-only even if malformed state says rounds.
assert.equal(finalChallengeDue(session({
  experienceMode: 'newbie',
  gameEndMode: 'rounds',
  finalRoundCount: 1,
  round: 99,
})), false);

console.log('Final challenge trigger smoke tests passed.');
