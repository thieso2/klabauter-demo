import { describe, expect, it } from 'vitest';
import { type RaceState, createRaceState, raceReducer, rankKarts } from './race';

const TOTAL_CHECKPOINTS = 3;

function passAllCheckpoints(state: RaceState, kartId: string): RaceState {
  for (let i = 0; i < TOTAL_CHECKPOINTS; i++) {
    state = raceReducer(state, { type: 'CHECKPOINT_PASSED', kartId, checkpointIndex: i }).state;
  }
  return state;
}

describe('raceReducer', () => {
  it('advances checkpointIndex on an in-order checkpoint pass', () => {
    const state = createRaceState(['p1'], TOTAL_CHECKPOINTS);
    const result = raceReducer(state, { type: 'CHECKPOINT_PASSED', kartId: 'p1', checkpointIndex: 0 });
    expect(result.state.karts.p1.checkpointIndex).toBe(1);
    expect(result.emitted).toEqual([]);
  });

  it('is a no-op when a checkpoint is passed out of order', () => {
    const state = createRaceState(['p1'], TOTAL_CHECKPOINTS);
    const result = raceReducer(state, { type: 'CHECKPOINT_PASSED', kartId: 'p1', checkpointIndex: 1 });
    expect(result.state.karts.p1.checkpointIndex).toBe(0);
  });

  it('completes a lap and emits LAP_COMPLETED when the finish is crossed forward after all checkpoints', () => {
    let state = createRaceState(['p1'], TOTAL_CHECKPOINTS);
    state = passAllCheckpoints(state, 'p1');
    const result = raceReducer(state, { type: 'FINISH_CROSSED', kartId: 'p1', forward: true });
    expect(result.state.karts.p1).toEqual({ lapsCompleted: 1, checkpointIndex: 0 });
    expect(result.emitted).toEqual([{ type: 'LAP_COMPLETED', kartId: 'p1', lap: 1 }]);
  });

  it('does not increment the lap counter when the finish is crossed before all checkpoints', () => {
    let state = createRaceState(['p1'], TOTAL_CHECKPOINTS);
    state = raceReducer(state, { type: 'CHECKPOINT_PASSED', kartId: 'p1', checkpointIndex: 0 }).state;
    const result = raceReducer(state, { type: 'FINISH_CROSSED', kartId: 'p1', forward: true });
    expect(result.state.karts.p1.lapsCompleted).toBe(0);
    expect(result.emitted).toEqual([]);
  });

  it('does not increment the lap counter when the finish is crossed backwards', () => {
    let state = createRaceState(['p1'], TOTAL_CHECKPOINTS);
    state = passAllCheckpoints(state, 'p1');
    const result = raceReducer(state, { type: 'FINISH_CROSSED', kartId: 'p1', forward: false });
    expect(result.state.karts.p1.lapsCompleted).toBe(0);
    expect(result.state.karts.p1.checkpointIndex).toBe(TOTAL_CHECKPOINTS);
    expect(result.emitted).toEqual([]);
  });

  it('dispatching LAP_COMPLETED directly is a no-op', () => {
    const state = createRaceState(['p1'], TOTAL_CHECKPOINTS);
    const result = raceReducer(state, { type: 'LAP_COMPLETED', kartId: 'p1', lap: 1 });
    expect(result.state).toEqual(state);
    expect(result.emitted).toEqual([]);
  });

  it('tracks multiple karts independently', () => {
    let state = createRaceState(['p1', 'p2'], TOTAL_CHECKPOINTS);
    state = raceReducer(state, { type: 'CHECKPOINT_PASSED', kartId: 'p1', checkpointIndex: 0 }).state;
    expect(state.karts.p1.checkpointIndex).toBe(1);
    expect(state.karts.p2.checkpointIndex).toBe(0);
  });
});

describe('rankKarts', () => {
  it('orders primarily by lapsCompleted', () => {
    const order = rankKarts([
      { kartId: 'a', lapsCompleted: 1, checkpointIndex: 0, distanceAlongSegment: 0 },
      { kartId: 'b', lapsCompleted: 2, checkpointIndex: 0, distanceAlongSegment: 0 },
    ]);
    expect(order).toEqual(['b', 'a']);
  });

  it('breaks ties on lapsCompleted using checkpointIndex, then distanceAlongSegment', () => {
    const order = rankKarts([
      { kartId: 'a', lapsCompleted: 1, checkpointIndex: 2, distanceAlongSegment: 500 },
      { kartId: 'b', lapsCompleted: 1, checkpointIndex: 2, distanceAlongSegment: 900 },
      { kartId: 'c', lapsCompleted: 1, checkpointIndex: 1, distanceAlongSegment: 999 },
    ]);
    expect(order).toEqual(['b', 'a', 'c']);
  });

  it('produces a full strict order for a four-kart field', () => {
    const order = rankKarts([
      { kartId: 'p1', lapsCompleted: 2, checkpointIndex: 3, distanceAlongSegment: 50 },
      { kartId: 'ai1', lapsCompleted: 2, checkpointIndex: 3, distanceAlongSegment: 80 },
      { kartId: 'ai2', lapsCompleted: 2, checkpointIndex: 1, distanceAlongSegment: 900 },
      { kartId: 'ai3', lapsCompleted: 1, checkpointIndex: 5, distanceAlongSegment: 900 },
    ]);
    expect(order).toEqual(['ai1', 'p1', 'ai2', 'ai3']);
  });
});
