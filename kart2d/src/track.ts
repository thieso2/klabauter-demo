import { type Vec2, add, cross, distance, dot, normalize, perp, scale, sub } from './vec2';

/** A gate the kart must cross: a line segment `a`-`b` plus the unit direction counted as a forward crossing. */
export interface Gate {
  a: Vec2;
  b: Vec2;
  forward: Vec2;
}

/** Colors used to draw a track's surface and finish gate; the only per-track visual theming. */
export interface TrackTheme {
  background: string;
  wall: string;
  paved: string;
  laneMarking: string;
  checkerA: string;
  checkerB: string;
}

export interface Track {
  name: string;
  theme: TrackTheme;
  centerline: Vec2[]; // closed loop, driving direction is index-ascending
  /** Paved surface half-width: inside this, full speed. Beyond it and up to hardWallHalfWidth, speed is capped. */
  pavedHalfWidth: number;
  /** Canyon wall half-width: karts cannot cross beyond this distance from the centerline. */
  hardWallHalfWidth: number;
  checkpoints: Gate[]; // ordered gates around the loop, excludes the finish line
  finishLine: Gate;
  totalCheckpoints: number;
  itemBoxes: Vec2[]; // pickup locations, roughly on the driving line so a lap reliably crosses several
  startPositions: Vec2[];
  startHeading: number; // radians
  segmentStart: number[]; // arc length at centerline[i], same length as centerline
  totalLength: number;
  checkpointArc: number[]; // arc length of each checkpoint gate, length totalCheckpoints
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

function closestPointOnSegment(p: Vec2, a: Vec2, b: Vec2): { point: Vec2; t: number } {
  const ab = sub(b, a);
  const abLenSq = dot(ab, ab);
  const t = abLenSq > 1e-9 ? clamp01(dot(sub(p, a), ab) / abLenSq) : 0;
  return { point: add(a, scale(ab, t)), t };
}

function projectOntoPolyline(
  centerline: Vec2[],
  segmentStart: number[],
  point: Vec2,
): { arcLength: number; distanceFromCenter: number; closestPoint: Vec2 } {
  const n = centerline.length;
  let bestDistSq = Infinity;
  let bestArc = 0;
  let bestPoint = centerline[0];
  for (let i = 0; i < n; i++) {
    const a = centerline[i];
    const b = centerline[(i + 1) % n];
    const { point: closest, t } = closestPointOnSegment(point, a, b);
    const distSq = (point.x - closest.x) ** 2 + (point.y - closest.y) ** 2;
    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      bestArc = segmentStart[i] + t * distance(a, b);
      bestPoint = closest;
    }
  }
  return { arcLength: bestArc, distanceFromCenter: Math.sqrt(bestDistSq), closestPoint: bestPoint };
}

/** Projects a world point onto the track centerline: arc-length position and perpendicular distance. */
export function projectToTrack(track: Track, point: Vec2): { arcLength: number; distanceFromCenter: number } {
  return projectOntoPolyline(track.centerline, track.segmentStart, point);
}

/** Like `projectToTrack` but also returns the nearest centerline point, for wall-clamping. */
export function projectToTrackDetailed(
  track: Track,
  point: Vec2,
): { arcLength: number; distanceFromCenter: number; closestPoint: Vec2 } {
  return projectOntoPolyline(track.centerline, track.segmentStart, point);
}

/** Fine-grained progress (0..segment length) between the checkpoint gate before `checkpointIndex` and the one at it. */
export function distanceAlongSegment(track: Track, position: Vec2, checkpointIndex: number): number {
  const { arcLength } = projectToTrack(track, position);
  const segStart = checkpointIndex === 0 ? 0 : track.checkpointArc[checkpointIndex - 1];
  const segEnd = checkpointIndex === track.totalCheckpoints ? track.totalLength : track.checkpointArc[checkpointIndex];
  let arc = arcLength;
  if (arc < segStart - track.totalLength / 2) arc += track.totalLength;
  return Math.max(0, Math.min(segEnd - segStart, arc - segStart));
}

function segmentsIntersect(p1: Vec2, p2: Vec2, a: Vec2, b: Vec2): boolean {
  const d1 = sub(p2, p1);
  const d2 = sub(b, a);
  const denom = cross(d1, d2);
  if (Math.abs(denom) < 1e-9) return false;
  const diff = sub(a, p1);
  const t = cross(diff, d2) / denom;
  const u = cross(diff, d1) / denom;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

/** Whether, and in which direction, the kart's move from `prev` to `curr` this frame crossed `gate`. */
export function crossGateDirection(gate: Gate, prev: Vec2, curr: Vec2): 'forward' | 'backward' | null {
  if (prev.x === curr.x && prev.y === curr.y) return null;
  if (!segmentsIntersect(prev, curr, gate.a, gate.b)) return null;
  return dot(sub(curr, prev), gate.forward) > 0 ? 'forward' : 'backward';
}

/** True if the kart's move from `prev` to `curr` this frame crossed `gate` in its forward direction. */
export function crossedGateForward(gate: Gate, prev: Vec2, curr: Vec2): boolean {
  return crossGateDirection(gate, prev, curr) === 'forward';
}

function segmentAtArc(track: Track, arc: number): { a: Vec2; b: Vec2; t: number } {
  const wrapped = ((arc % track.totalLength) + track.totalLength) % track.totalLength;
  const n = track.centerline.length;
  for (let i = 0; i < n; i++) {
    const segStart = track.segmentStart[i];
    const segEnd = i + 1 < n ? track.segmentStart[i + 1] : track.totalLength;
    if (wrapped >= segStart && wrapped <= segEnd) {
      const segLen = segEnd - segStart;
      return { a: track.centerline[i], b: track.centerline[(i + 1) % n], t: segLen > 1e-9 ? (wrapped - segStart) / segLen : 0 };
    }
  }
  return { a: track.centerline[0], b: track.centerline[1 % n], t: 0 };
}

/** The centerline point at a given arc-length (wraps around the loop). Used by AI lookahead. */
export function pointOnCenterlineAtArc(track: Track, arc: number): Vec2 {
  const { a, b, t } = segmentAtArc(track, arc);
  return add(a, scale(sub(b, a), t));
}

/** The forward tangent direction of the centerline at a given arc-length. Used by AI lookahead. */
export function tangentAtArc(track: Track, arc: number): Vec2 {
  const { a, b } = segmentAtArc(track, arc);
  return normalize(sub(b, a));
}

function tangentAt(centerline: Vec2[], i: number): Vec2 {
  const n = centerline.length;
  const prev = centerline[(i - 1 + n) % n];
  const next = centerline[(i + 1) % n];
  const d = sub(next, prev);
  const len = distance(next, prev);
  return len > 1e-9 ? scale(d, 1 / len) : { x: 1, y: 0 };
}

function makeGate(centerline: Vec2[], index: number, halfWidth: number): Gate {
  const point = centerline[index];
  const forward = tangentAt(centerline, index);
  const normal = perp(forward);
  return { a: sub(point, scale(normal, halfWidth)), b: add(point, scale(normal, halfWidth)), forward };
}

function buildTrack(opts: {
  name: string;
  theme: TrackTheme;
  centerline: Vec2[];
  pavedHalfWidth: number;
  hardWallHalfWidth: number;
  gateHalfWidth: number;
  checkpointIndices: number[]; // indices into centerline, excludes 0 (the finish line)
  itemBoxIndices?: number[]; // indices into centerline where an item box sits
  startRowSpacing: number;
  startColSpacing: number;
}): Track {
  const { centerline } = opts;
  const n = centerline.length;
  const segmentStart: number[] = [];
  let acc = 0;
  for (let i = 0; i < n; i++) {
    segmentStart.push(acc);
    acc += distance(centerline[i], centerline[(i + 1) % n]);
  }
  const totalLength = acc;

  const finishLine = makeGate(centerline, 0, opts.gateHalfWidth);
  const checkpoints = opts.checkpointIndices.map((i) => makeGate(centerline, i, opts.gateHalfWidth));
  const checkpointArc = opts.checkpointIndices.map((i) => segmentStart[i]);

  const tangent0 = tangentAt(centerline, 0);
  const normal0 = perp(tangent0);
  const gridOrigin = centerline[0];
  const startPositions: Vec2[] = [0, 1, 2, 3].map((slot) => {
    const row = Math.floor(slot / 2);
    const col = slot % 2 === 0 ? -1 : 1;
    return add(
      sub(gridOrigin, scale(tangent0, opts.startRowSpacing * (row + 1))),
      scale(normal0, opts.startColSpacing * col),
    );
  });

  return {
    name: opts.name,
    theme: opts.theme,
    centerline,
    pavedHalfWidth: opts.pavedHalfWidth,
    hardWallHalfWidth: opts.hardWallHalfWidth,
    checkpoints,
    finishLine,
    totalCheckpoints: checkpoints.length,
    itemBoxes: (opts.itemBoxIndices ?? []).map((i) => centerline[i]),
    startPositions,
    startHeading: Math.atan2(tangent0.y, tangent0.x),
    segmentStart,
    totalLength,
    checkpointArc,
  };
}

function generateDesertCenterline(): Vec2[] {
  const points: Vec2[] = [];
  const count = 42;
  for (let i = 0; i < count; i++) {
    const t = (i / count) * Math.PI * 2;
    const rx = 620 + Math.sin(t * 2) * 140 + Math.cos(t * 3) * 40;
    const ry = 420 + Math.cos(t * 2) * 100 + Math.sin(t * 3) * 30;
    points.push({ x: Math.cos(t) * rx, y: Math.sin(t) * ry });
  }
  return points;
}

export const desertCanyon: Track = buildTrack({
  name: 'Desert Canyon Loop',
  theme: {
    background: '#5c4325',
    wall: '#d9a066',
    paved: '#4a4238',
    laneMarking: 'rgba(255,255,255,0.35)',
    checkerA: '#f1faee',
    checkerB: '#1d1d1d',
  },
  centerline: generateDesertCenterline(),
  pavedHalfWidth: 110,
  hardWallHalfWidth: 230,
  gateHalfWidth: 160,
  checkpointIndices: [6, 12, 18, 24, 30, 36],
  itemBoxIndices: [3, 9, 15, 21, 27, 33, 39],
  startRowSpacing: 60,
  startColSpacing: 45,
});

function generateSnowyCenterline(): Vec2[] {
  const points: Vec2[] = [];
  const count = 46;
  for (let i = 0; i < count; i++) {
    const t = (i / count) * Math.PI * 2;
    const rx = 560 + Math.sin(t * 3) * 150 + Math.cos(t * 5) * 40;
    const ry = 480 + Math.cos(t * 4) * 140 - Math.sin(t * 2) * 30;
    points.push({ x: Math.cos(t) * rx, y: Math.sin(t) * ry });
  }
  return points;
}

/** Snowy mountain switchback: icy blue-white palette, tighter zigzagging turns than the desert loop. */
export const snowyMountain: Track = buildTrack({
  name: 'Snowy Mountain Switchback',
  theme: {
    background: '#e8f1f8',
    wall: '#8fb4d9',
    paved: '#c9d9e6',
    laneMarking: 'rgba(30,58,89,0.35)',
    checkerA: '#1e3a59',
    checkerB: '#ffffff',
  },
  centerline: generateSnowyCenterline(),
  pavedHalfWidth: 100,
  hardWallHalfWidth: 210,
  gateHalfWidth: 150,
  checkpointIndices: [7, 14, 21, 28, 35, 42],
  itemBoxIndices: [4, 11, 18, 25, 32, 39, 44],
  startRowSpacing: 60,
  startColSpacing: 45,
});

function generateHarborCenterline(): Vec2[] {
  const points: Vec2[] = [];
  const count = 44;
  for (let i = 0; i < count; i++) {
    const t = (i / count) * Math.PI * 2;
    const rx = 600 + Math.sin(t * 2) * 120 + Math.sin(t * 5) * 30;
    const ry = 360 + Math.cos(t * 3) * 90;
    points.push({ x: Math.cos(t) * rx, y: Math.sin(t) * ry });
  }
  return points;
}

/** Nighttime harbor circuit: dark water palette with neon dock-light accents. */
export const harborCircuit: Track = buildTrack({
  name: 'Nighttime Harbor Circuit',
  theme: {
    background: '#0b1a2b',
    wall: '#12314a',
    paved: '#1c1c24',
    laneMarking: 'rgba(255,209,102,0.45)',
    checkerA: '#f1faee',
    checkerB: '#e63946',
  },
  centerline: generateHarborCenterline(),
  pavedHalfWidth: 110,
  hardWallHalfWidth: 220,
  gateHalfWidth: 155,
  checkpointIndices: [7, 14, 22, 29, 36, 40],
  itemBoxIndices: [3, 10, 18, 25, 32, 38, 42],
  startRowSpacing: 60,
  startColSpacing: 45,
});
