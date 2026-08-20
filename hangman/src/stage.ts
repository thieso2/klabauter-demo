export const MAX_STAGE = 6;

/** Cumulative, ordered reveal of the loaded glTF figure's named part nodes: stage N shows the
 * first N of these. Order doubles as anatomical build-up (torso, then head, then limbs). */
export const STAGE_NODE_NAMES: readonly string[] = [
  'torso',
  'head',
  'arm-left',
  'arm-right',
  'leg-left',
  'leg-right',
];

/** Pure mapping from a wrong-guess count to which stage (0-6) is shown. Same count always
 * produces the same stage: no hidden state, no side effects. */
export function stageFromWrongGuesses(wrongGuesses: number): number {
  return Math.max(0, Math.min(MAX_STAGE, Math.trunc(wrongGuesses)));
}

/** The part-node names that should be visible at a given stage, in reveal order. */
export function visibleNodesForStage(stage: number): readonly string[] {
  const clamped = Math.max(0, Math.min(MAX_STAGE, Math.trunc(stage)));
  return STAGE_NODE_NAMES.slice(0, clamped);
}
