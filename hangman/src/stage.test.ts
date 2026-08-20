import { describe, expect, it } from 'vitest';
import { MAX_STAGE, STAGE_NODE_NAMES, stageFromWrongGuesses, visibleNodesForStage } from './stage';

describe('stageFromWrongGuesses', () => {
  it('maps each in-range count to itself, deterministically across repeated calls', () => {
    for (let count = 0; count <= MAX_STAGE; count++) {
      const first = stageFromWrongGuesses(count);
      const second = stageFromWrongGuesses(count);
      const third = stageFromWrongGuesses(count);
      expect(first).toBe(count);
      expect(second).toBe(first);
      expect(third).toBe(first);
    }
  });

  it('clamps below zero and above the max', () => {
    expect(stageFromWrongGuesses(-3)).toBe(0);
    expect(stageFromWrongGuesses(7)).toBe(MAX_STAGE);
    expect(stageFromWrongGuesses(100)).toBe(MAX_STAGE);
  });

  it('truncates non-integer input', () => {
    expect(stageFromWrongGuesses(2.9)).toBe(2);
  });
});

describe('visibleNodesForStage', () => {
  it('is empty at stage 0 and grows cumulatively to all parts at MAX_STAGE', () => {
    expect(visibleNodesForStage(0)).toEqual([]);
    expect(visibleNodesForStage(MAX_STAGE)).toEqual(STAGE_NODE_NAMES);
  });

  it('each stage is a prefix of the next', () => {
    for (let stage = 0; stage < MAX_STAGE; stage++) {
      const current = visibleNodesForStage(stage);
      const next = visibleNodesForStage(stage + 1);
      expect(next.slice(0, current.length)).toEqual(current);
      expect(next.length).toBe(current.length + 1);
    }
  });
});
