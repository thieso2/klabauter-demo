import { describe, expect, it } from 'vitest';
import { TIERS, WORDS, tierOf, wordsInTier } from './words';

const ONLY_LETTERS = /^[A-Z]+$/;
const MIN_POOL_SIZE = 30;

describe('word list', () => {
  it('uses only A-Z letters, case-insensitively, for every word', () => {
    for (const entry of WORDS) {
      expect(entry.word.toUpperCase()).toMatch(ONLY_LETTERS);
    }
  });

  it('assigns every word to exactly one tier', () => {
    for (const entry of WORDS) {
      expect(TIERS).toContain(tierOf(entry));
    }
  });

  it('has no duplicate words', () => {
    const words = WORDS.map((entry) => entry.word);
    expect(new Set(words).size).toBe(words.length);
  });

  it('gives each tier a non-trivial pool', () => {
    for (const tier of TIERS) {
      const pool = wordsInTier(tier);
      expect(pool.length).toBeGreaterThanOrEqual(MIN_POOL_SIZE);
    }
  });

  it('partitions all words across the tiers with no overlap or gap', () => {
    const partitioned = TIERS.reduce((sum, tier) => sum + wordsInTier(tier).length, 0);
    expect(partitioned).toBe(WORDS.length);
  });
});
