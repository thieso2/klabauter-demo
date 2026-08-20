import { randomWord, type Tier } from './words';

export type RoundStatus = 'in-progress' | 'won' | 'lost';

export const MAX_ATTEMPTS = 6;

export interface RoundState {
  tier: Tier;
  word: string;
  guessed: ReadonlySet<string>;
  remaining: number;
  status: RoundStatus;
}

const LETTER = /^[A-Z]$/;

/** Starts a fresh round: a word drawn from `tier`, no guesses, full attempts, stage 0. */
export function startRound(tier: Tier, rng: () => number = Math.random): RoundState {
  return {
    tier,
    word: randomWord(tier, rng).toUpperCase(),
    guessed: new Set(),
    remaining: MAX_ATTEMPTS,
    status: 'in-progress',
  };
}

/** Applies one letter guess. No-op (same reference) if the round has ended, the letter was
 * already guessed, or the input isn't a single A-Z letter. */
export function guess(state: RoundState, letter: string): RoundState {
  const upper = letter.toUpperCase();
  if (state.status !== 'in-progress' || !LETTER.test(upper) || state.guessed.has(upper)) {
    return state;
  }

  const guessed = new Set(state.guessed);
  guessed.add(upper);

  if (state.word.includes(upper)) {
    const won = [...new Set(state.word)].every((ch) => guessed.has(ch));
    return { ...state, guessed, status: won ? 'won' : 'in-progress' };
  }

  const remaining = state.remaining - 1;
  return { ...state, guessed, remaining, status: remaining <= 0 ? 'lost' : 'in-progress' };
}

/** The word as currently shown: guessed letters revealed, the rest hidden behind `_`.
 * On loss, the full word is revealed regardless of what was guessed. */
export function revealedWord(state: RoundState): string {
  if (state.status === 'lost') return state.word;
  return [...state.word].map((ch) => (state.guessed.has(ch) ? ch : '_')).join('');
}
