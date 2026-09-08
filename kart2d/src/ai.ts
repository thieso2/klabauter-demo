import type { KartState } from './kart';
import { type Track, pointOnCenterlineAtArc, projectToTrack, tangentAtArc } from './track';
import { add, angleDelta, angleOf, dot, fromAngle, length, normalize, perp, scale, sub } from './vec2';

export interface AIOutput {
  steerAxis: number;
  accelerate: boolean;
  itemUsePressed: boolean;
}

const AI_TUNING = {
  lookaheadBase: 140,
  lookaheadPerSpeed: 0.6,
  steerGain: 1.4,
  overtakeDistance: 220,
  overtakeForwardCone: 0.5, // min dot(toRival-normalized, kartForward) to count as "ahead"
  overtakeLaneOffset: 70,
} as const;

/**
 * Pure AI steering: follows the track's driving line via a speed-scaled lookahead point on the
 * centerline, and nudges that target sideways to attempt an overtake when a rival is close ahead.
 */
export function driveAI(track: Track, kart: KartState, rivals: KartState[]): AIOutput {
  const t = AI_TUNING;
  const { arcLength } = projectToTrack(track, kart.position);
  const lookaheadArc = arcLength + t.lookaheadBase + Math.max(0, kart.speed) * t.lookaheadPerSpeed;
  const target = pointOnCenterlineAtArc(track, lookaheadArc);
  const tangent = tangentAtArc(track, lookaheadArc);
  const laneNormal = perp(tangent);

  const forward = fromAngle(kart.heading);
  const rivalAhead = closestRivalAhead(kart, rivals, forward, t.overtakeDistance, t.overtakeForwardCone);
  let lateralOffset = 0;
  if (rivalAhead) {
    const rivalSide = Math.sign(dot(sub(rivalAhead.position, kart.position), laneNormal)) || 1;
    lateralOffset = -rivalSide * t.overtakeLaneOffset;
  }

  const adjustedTarget = add(target, scale(laneNormal, lateralOffset));
  const desiredHeading = angleOf(sub(adjustedTarget, kart.position));
  const steerAxis = clamp(angleDelta(kart.heading, desiredHeading) * t.steerGain, -1, 1);

  return { steerAxis, accelerate: true, itemUsePressed: false };
}

function closestRivalAhead(
  kart: KartState,
  rivals: KartState[],
  forward: { x: number; y: number },
  maxDistance: number,
  forwardCone: number,
): KartState | undefined {
  let closest: KartState | undefined;
  let closestDist = maxDistance;
  for (const rival of rivals) {
    const toRival = sub(rival.position, kart.position);
    const dist = length(toRival);
    if (dist < 1e-6 || dist > maxDistance) continue;
    if (dot(normalize(toRival), forward) < forwardCone) continue;
    if (dist < closestDist) {
      closest = rival;
      closestDist = dist;
    }
  }
  return closest;
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
