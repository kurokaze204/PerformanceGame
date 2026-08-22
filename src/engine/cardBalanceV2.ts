import { EVENT_CARDS_DECK } from './cards.ts';

let applied = false;

/**
 * V2.1 balance adjustment: all normal event-card domain difficulties are one
 * point higher than the original deck. This makes the opening rounds harder
 * while allowing persistent capability investments to make later events
 * progressively cheaper and more reliable.
 *
 * The deck is a shared in-memory array, so this is intentionally idempotent.
 */
export function applyCardDifficultyBumpV2(): void {
  if (applied) return;
  for (const card of EVENT_CARDS_DECK) {
    for (const requirement of card.domains) requirement.difficulty += 1;
  }
  applied = true;
}
