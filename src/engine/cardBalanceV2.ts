import { EVENT_CARDS_DECK } from './cards.ts';

/**
 * Compatibility shim retained temporarily because server-v2 still imports this
 * function. Card difficulties are now stored at their final values in cards.ts,
 * so NO runtime difficulty adjustment is performed here.
 *
 * This function can be deleted with its server import during the next cleanup.
 */
export function applyCardDifficultyBumpV2(): void {
  // Touch the import so TypeScript makes it obvious this shim belongs to the deck.
  void EVENT_CARDS_DECK;
}
