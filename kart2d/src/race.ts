export type RaceEvent =
  | { type: 'CHECKPOINT_PASSED'; kartId: string; checkpointIndex: number }
  | { type: 'FINISH_CROSSED'; kartId: string; forward: boolean }
  | { type: 'LAP_COMPLETED'; kartId: string; lap: number };

export interface KartRaceProgress {
  lapsCompleted: number;
  checkpointIndex: number; // next expected checkpoint index, 0..totalCheckpoints
}

export interface RaceState {
  totalCheckpoints: number;
  karts: Record<string, KartRaceProgress>;
}

export function createRaceState(kartIds: string[], totalCheckpoints: number): RaceState {
  const karts: Record<string, KartRaceProgress> = {};
  for (const id of kartIds) karts[id] = { lapsCompleted: 0, checkpointIndex: 0 };
  return { totalCheckpoints, karts };
}

export interface RaceReducerResult {
  state: RaceState;
  emitted: RaceEvent[];
}

function updateKart(state: RaceState, kartId: string, patch: Partial<KartRaceProgress>): RaceState {
  return { ...state, karts: { ...state.karts, [kartId]: { ...state.karts[kartId], ...patch } } };
}

/**
 * Reduces CHECKPOINT_PASSED and FINISH_CROSSED events into each kart's (lapsCompleted, checkpointIndex).
 * A checkpoint out of its expected order, or a finish crossed backwards or before all checkpoints are
 * covered, is a no-op. A legal finish crossing emits LAP_COMPLETED as the derived result; dispatching
 * LAP_COMPLETED directly is a no-op — it is an output of this reducer, not an external input.
 */
export function raceReducer(state: RaceState, event: RaceEvent): RaceReducerResult {
  const kart = state.karts[event.kartId];
  if (!kart) return { state, emitted: [] };

  if (event.type === 'CHECKPOINT_PASSED') {
    if (event.checkpointIndex !== kart.checkpointIndex) return { state, emitted: [] };
    return { state: updateKart(state, event.kartId, { checkpointIndex: kart.checkpointIndex + 1 }), emitted: [] };
  }

  if (event.type === 'FINISH_CROSSED') {
    if (!event.forward) return { state, emitted: [] };
    if (kart.checkpointIndex !== state.totalCheckpoints) return { state, emitted: [] };
    const lap = kart.lapsCompleted + 1;
    const nextState = updateKart(state, event.kartId, { checkpointIndex: 0, lapsCompleted: lap });
    return { state: nextState, emitted: [{ type: 'LAP_COMPLETED', kartId: event.kartId, lap }] };
  }

  return { state, emitted: [] };
}

export interface ProgressEntry {
  kartId: string;
  lapsCompleted: number;
  checkpointIndex: number;
  distanceAlongSegment: number;
}

/** Strict 1st-to-last order from (lapsCompleted, checkpointIndex, distanceAlongSegment); kartId breaks any remaining tie. */
export function rankKarts(entries: ProgressEntry[]): string[] {
  return [...entries]
    .sort(
      (a, b) =>
        b.lapsCompleted - a.lapsCompleted ||
        b.checkpointIndex - a.checkpointIndex ||
        b.distanceAlongSegment - a.distanceAlongSegment ||
        a.kartId.localeCompare(b.kartId),
    )
    .map((e) => e.kartId);
}
