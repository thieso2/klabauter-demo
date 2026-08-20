import { describe, expect, it } from 'vitest';
import { MAX_ATTEMPTS, type RoundState, guess, revealedWord, startRound } from './game';
import { wordsInTier } from './words';

const roundOf = (word: string): RoundState => ({
  tier: 'easy',
  word,
  guessed: new Set(),
  remaining: MAX_ATTEMPTS,
  status: 'in-progress',
});

describe('guess', () => {
  it('reveals every occurrence of a correct letter and leaves attempts/status unchanged', () => {
    const state = guess(roundOf('LETTER'), 'E');
    expect(revealedWord(state)).toBe('_E__E_');
    expect(state.remaining).toBe(MAX_ATTEMPTS);
    expect(state.status).toBe('in-progress');
  });

  it('decrements remaining attempts by 1 on a wrong guess', () => {
    const state = guess(roundOf('CAT'), 'X');
    expect(state.remaining).toBe(MAX_ATTEMPTS - 1);
    expect(state.status).toBe('in-progress');
    expect(revealedWord(state)).toBe('___');
  });

  it('is a total no-op on a repeat guess, whether it was right or wrong', () => {
    const afterCorrect = guess(roundOf('CAT'), 'C');
    expect(guess(afterCorrect, 'C')).toBe(afterCorrect);

    const afterWrong = guess(roundOf('CAT'), 'X');
    expect(guess(afterWrong, 'X')).toBe(afterWrong);
  });

  it('ignores non-letter and multi-character input without changing state', () => {
    const state = roundOf('CAT');
    expect(guess(state, '1')).toBe(state);
    expect(guess(state, '')).toBe(state);
    expect(guess(state, 'CA')).toBe(state);
  });

  it('wins once every distinct letter has been guessed correctly, with attempts left', () => {
    let state = roundOf('CAT');
    state = guess(state, 'C');
    expect(state.status).toBe('in-progress');
    state = guess(state, 'A');
    expect(state.status).toBe('in-progress');
    state = guess(state, 'T');
    expect(state.status).toBe('won');
    expect(state.remaining).toBeGreaterThan(0);
    expect(revealedWord(state)).toBe('CAT');
  });

  it('loses on the 6th wrong guess, reveals the full word, and accepts no further guesses', () => {
    let state = roundOf('CAT');
    for (const letter of ['B', 'D', 'E', 'F', 'G']) {
      state = guess(state, letter);
      expect(state.status).toBe('in-progress');
    }
    state = guess(state, 'H');
    expect(state.status).toBe('lost');
    expect(state.remaining).toBe(0);
    expect(revealedWord(state)).toBe('CAT');

    const afterLoss = guess(state, 'C');
    expect(afterLoss).toBe(state);
  });
});

describe('startRound', () => {
  it('draws a word from the chosen tier, with attempts and stage reset', () => {
    for (const tier of ['easy', 'medium', 'hard'] as const) {
      const pool = new Set(wordsInTier(tier).map((entry) => entry.word.toUpperCase()));
      const state = startRound(tier, () => 0);
      expect(pool.has(state.word)).toBe(true);
      expect(state.tier).toBe(tier);
      expect(state.remaining).toBe(MAX_ATTEMPTS);
      expect(state.guessed.size).toBe(0);
      expect(state.status).toBe('in-progress');
    }
  });

  it('respects the injected rng across the full pool range', () => {
    const pool = wordsInTier('medium');
    const last = pool.length - 1;
    const state = startRound('medium', () => (last / pool.length) + 1e-9);
    expect(state.word).toBe(pool[last]!.word.toUpperCase());
  });
});
