import type { ItemType } from './items';
import { type Track, projectToTrackDetailed } from './track';
import { type Vec2, add, fromAngle, normalize, scale, sub } from './vec2';

export interface KartState {
  position: Vec2;
  heading: number; // radians
  speed: number; // scalar forward speed; negative is reverse
  driftCharge: number; // seconds held in an active drift; 0 when not drifting
  driftDirection: -1 | 0 | 1; // steer direction of the active drift; 0 when not drifting
  /** Seconds remaining with no steering authority and near-zero speed. Only items set this > 0. */
  spinOutRemaining: number;
  heldItem: ItemType | null;
  /** Passive, indefinite until it absorbs one projectile/hazard hit. */
  shieldActive: boolean;
}

export interface KartInput {
  steerAxis: number;
  accelerate: boolean;
  brake: boolean;
  driftHeld: boolean;
}

export const KART_TUNING = {
  maxSpeed: 260,
  reverseMaxSpeed: 120,
  offTrackMaxSpeed: 130,
  accel: 220,
  brakeDecel: 320,
  friction: 140,
  dragAboveCap: 3.2, // per-second exponential pull of speed back toward its cap (boost decay, off-track slowdown)
  turnRate: 3.0, // rad/sec at full speed
  turnRateAtStandstill: 0.4, // fraction of turnRate available at zero speed
  driftTurnMultiplier: 1.35,
  driftMinSteer: 0.3,
  driftMinSpeed: 70,
  driftMinChargeForBoost: 0.5, // seconds
  driftMaxCharge: 1.5, // seconds
  driftBoostBase: 130,
  driftBoostFullChargeBonus: 60,
  spinOutDecel: 900,
} as const;

export function createKartState(position: Vec2, heading: number): KartState {
  return {
    position,
    heading,
    speed: 0,
    driftCharge: 0,
    driftDirection: 0,
    spinOutRemaining: 0,
    heldItem: null,
    shieldActive: false,
  };
}

/** Fixed-step movement: deterministic given the same starting state, input, track, and dt. */
export function stepKart(state: KartState, input: KartInput, track: Track, dt: number): KartState {
  if (state.spinOutRemaining > 0) return stepSpinningOut(state, dt);

  const t = KART_TUNING;
  const { distanceFromCenter } = projectToTrackDetailed(track, state.position);
  const onPaved = distanceFromCenter <= track.pavedHalfWidth;

  let driftCharge = state.driftCharge;
  let driftDirection = state.driftDirection;
  let speed = state.speed;

  const wantsDrift = input.driftHeld && Math.abs(input.steerAxis) >= t.driftMinSteer && Math.abs(speed) >= t.driftMinSpeed;
  if (wantsDrift) {
    const direction = Math.sign(input.steerAxis) as -1 | 1;
    if (driftDirection !== direction) driftCharge = 0; // switching direction restarts the charge
    driftDirection = direction;
    driftCharge = Math.min(t.driftMaxCharge, driftCharge + dt);
  } else if (driftDirection !== 0) {
    // Drift input released (or conditions no longer met): resolve a boost if enough charge was banked.
    if (driftCharge >= t.driftMinChargeForBoost) {
      const chargeFraction = Math.min(1, driftCharge / t.driftMaxCharge);
      const boost = t.driftBoostBase + t.driftBoostFullChargeBonus * chargeFraction;
      speed += boost;
    }
    driftCharge = 0;
    driftDirection = 0;
  }
  const isDrifting = driftDirection !== 0;

  // Steering: full authority at speed, a reduced baseline near standstill so a stopped kart can still pivot.
  const speedFraction = Math.min(1, Math.abs(speed) / t.maxSpeed);
  const turnFactor = t.turnRateAtStandstill + (1 - t.turnRateAtStandstill) * speedFraction;
  const turnRate = t.turnRate * (isDrifting ? t.driftTurnMultiplier : 1) * turnFactor;
  const heading = state.heading + input.steerAxis * turnRate * dt;

  // Throttle: accelerate/brake push speed toward the cap for this frame's surface; drag pulls any excess
  // (from a drift boost, or from just leaving pavement) back down smoothly rather than snapping.
  const cap = onPaved ? t.maxSpeed : t.offTrackMaxSpeed;
  if (input.accelerate && !input.brake) {
    if (speed < cap) speed = Math.min(cap, speed + t.accel * dt);
  } else if (input.brake && !input.accelerate) {
    if (speed > 0) speed = Math.max(0, speed - t.brakeDecel * dt);
    else speed = Math.max(-t.reverseMaxSpeed, speed - t.accel * dt);
  } else {
    speed = speed > 0 ? Math.max(0, speed - t.friction * dt) : Math.min(0, speed + t.friction * dt);
  }
  if (speed > cap) speed -= (speed - cap) * t.dragAboveCap * dt;

  let position = add(state.position, scale(fromAngle(heading), speed * dt));
  position = clampToHardWall(track, position);

  return {
    position,
    heading,
    speed,
    driftCharge,
    driftDirection,
    spinOutRemaining: 0,
    heldItem: state.heldItem,
    shieldActive: state.shieldActive,
  };
}

function stepSpinningOut(state: KartState, dt: number): KartState {
  const t = KART_TUNING;
  const speed = state.speed > 0 ? Math.max(0, state.speed - t.spinOutDecel * dt) : Math.min(0, state.speed + t.spinOutDecel * dt);
  const position = add(state.position, scale(fromAngle(state.heading), speed * dt));
  return {
    position,
    heading: state.heading,
    speed,
    driftCharge: 0,
    driftDirection: 0,
    spinOutRemaining: Math.max(0, state.spinOutRemaining - dt),
    heldItem: state.heldItem,
    shieldActive: state.shieldActive,
  };
}

function clampToHardWall(track: Track, position: Vec2): Vec2 {
  const { distanceFromCenter, closestPoint } = projectToTrackDetailed(track, position);
  if (distanceFromCenter <= track.hardWallHalfWidth) return position;
  const outward = normalize(sub(position, closestPoint));
  return add(closestPoint, scale(outward, track.hardWallHalfWidth));
}

/** Simple push-apart so two karts never overlap; no spin-out or speed change from contact alone. */
export function resolveKartCollision(a: KartState, b: KartState, kartRadius: number): [KartState, KartState] {
  const delta = sub(b.position, a.position);
  const dist = Math.hypot(delta.x, delta.y);
  const minDist = kartRadius * 2;
  if (dist >= minDist || dist < 1e-6) return [a, b];
  const overlap = minDist - dist;
  const push = scale(normalize(delta), overlap / 2);
  return [{ ...a, position: sub(a.position, push) }, { ...b, position: add(b.position, push) }];
}
