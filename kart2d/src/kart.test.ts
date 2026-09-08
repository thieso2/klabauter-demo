import { describe, expect, it } from 'vitest';
import { KART_TUNING, type KartInput, createKartState, resolveKartCollision, stepKart } from './kart';
import type { Track } from './track';

function straightTrack(overrides: Partial<Track> = {}): Track {
  const centerline = [
    { x: -2000, y: 0 },
    { x: 2000, y: 0 },
  ];
  return {
    name: 'test-straight',
    theme: { background: '#000', wall: '#111', paved: '#222', laneMarking: '#333', checkerA: '#fff', checkerB: '#000' },
    centerline,
    pavedHalfWidth: 1000,
    hardWallHalfWidth: 5000,
    checkpoints: [],
    finishLine: { a: { x: 0, y: -10 }, b: { x: 0, y: 10 }, forward: { x: 1, y: 0 } },
    totalCheckpoints: 0,
    itemBoxes: [],
    startPositions: [{ x: 0, y: 0 }],
    startHeading: 0,
    segmentStart: [0, 4000],
    totalLength: 4000,
    checkpointArc: [],
    ...overrides,
  };
}

const dt = 1 / 60;
const accelInput: KartInput = { steerAxis: 0, accelerate: true, brake: false, driftHeld: false };

describe('stepKart', () => {
  it('is deterministic for an identical starting state and input sequence', () => {
    const track = straightTrack();
    const inputs: KartInput[] = [
      { steerAxis: 1, accelerate: true, brake: false, driftHeld: false },
      { steerAxis: 1, accelerate: true, brake: false, driftHeld: true },
      { steerAxis: 0, accelerate: true, brake: false, driftHeld: true },
      { steerAxis: -1, accelerate: false, brake: true, driftHeld: false },
    ];
    const run = () => {
      let state = createKartState({ x: 0, y: 0 }, 0);
      for (let frame = 0; frame < 300; frame++) state = stepKart(state, inputs[frame % inputs.length], track, dt);
      return state;
    };
    expect(run()).toEqual(run());
  });

  it('grants a measurably faster speed from a charged drift release than plain acceleration over the same time', () => {
    const track = straightTrack();
    const start = createKartState({ x: 0, y: 0 }, 0);
    const steps = 60; // 1 second

    let plain = start;
    for (let i = 0; i < steps; i++) plain = stepKart(plain, accelInput, track, dt);

    let drift = start;
    for (let i = 0; i < steps; i++) {
      drift = stepKart(drift, { steerAxis: 1, accelerate: true, brake: false, driftHeld: true }, track, dt);
    }
    expect(drift.driftCharge).toBeGreaterThanOrEqual(KART_TUNING.driftMinChargeForBoost);
    drift = stepKart(drift, { steerAxis: 0, accelerate: false, brake: false, driftHeld: false }, track, dt);

    expect(drift.speed).toBeGreaterThan(plain.speed + 50);
  });

  it('grants no boost when drift is released before the charge threshold', () => {
    const track = straightTrack();
    let state = createKartState({ x: 0, y: 0 }, 0);
    // Ramp past the drift-eligible speed, then hold the drift only briefly.
    for (let i = 0; i < 30; i++) {
      state = stepKart(state, { steerAxis: 1, accelerate: true, brake: false, driftHeld: true }, track, dt);
    }
    expect(state.driftCharge).toBeGreaterThan(0);
    expect(state.driftCharge).toBeLessThan(KART_TUNING.driftMinChargeForBoost);
    const speedBeforeRelease = state.speed;
    state = stepKart(state, { steerAxis: 0, accelerate: false, brake: false, driftHeld: false }, track, dt);
    expect(state.speed).toBeLessThanOrEqual(speedBeforeRelease + 1e-6);
  });

  it('caps speed off-track as a slowdown, not a hard stop', () => {
    const track = straightTrack();
    let state = createKartState({ x: 0, y: 1500 }, 0); // beyond pavedHalfWidth, inside hardWallHalfWidth
    for (let i = 0; i < 300; i++) state = stepKart(state, accelInput, track, dt);
    expect(state.speed).toBeGreaterThan(0);
    expect(state.speed).toBeLessThanOrEqual(KART_TUNING.offTrackMaxSpeed + 1);
    expect(state.speed).toBeLessThan(KART_TUNING.maxSpeed);
  });

  it('reaches full speed when it stays on the paved surface', () => {
    const track = straightTrack();
    let state = createKartState({ x: 0, y: 0 }, 0);
    for (let i = 0; i < 300; i++) state = stepKart(state, accelInput, track, dt);
    expect(state.speed).toBeCloseTo(KART_TUNING.maxSpeed, 0);
  });

  it('clamps position at the hard wall instead of passing through it', () => {
    const track = straightTrack({ hardWallHalfWidth: 200 });
    let state = createKartState({ x: 0, y: 190 }, Math.PI / 2); // facing +y, straight at the wall
    for (let i = 0; i < 120; i++) state = stepKart(state, accelInput, track, dt);
    expect(state.position.y).toBeLessThanOrEqual(200 + 1e-6);
  });

  it('ignores steering and bleeds off speed while spun out', () => {
    const track = straightTrack();
    const spinning = { ...createKartState({ x: 0, y: 0 }, 0), speed: 200, spinOutRemaining: 0.3 };
    const next = stepKart(spinning, { steerAxis: 1, accelerate: true, brake: false, driftHeld: false }, track, dt);
    expect(next.heading).toBe(spinning.heading);
    expect(next.speed).toBeLessThan(spinning.speed);
    expect(next.spinOutRemaining).toBeCloseTo(0.3 - dt, 5);
  });

  it('carries heldItem and shieldActive through a normal step unchanged', () => {
    const track = straightTrack();
    const state = { ...createKartState({ x: 0, y: 0 }, 0), heldItem: 'boost' as const, shieldActive: true };
    const next = stepKart(state, accelInput, track, dt);
    expect(next.heldItem).toBe('boost');
    expect(next.shieldActive).toBe(true);
  });
});

describe('resolveKartCollision', () => {
  it('pushes overlapping karts apart symmetrically without changing speed', () => {
    const a = { ...createKartState({ x: -5, y: 0 }, 0), speed: 100 };
    const b = { ...createKartState({ x: 5, y: 0 }, 0), speed: 50 };
    const [ra, rb] = resolveKartCollision(a, b, 20);
    const dist = Math.hypot(rb.position.x - ra.position.x, rb.position.y - ra.position.y);
    expect(dist).toBeCloseTo(40, 5);
    expect(ra.speed).toBe(100);
    expect(rb.speed).toBe(50);
  });

  it('leaves non-overlapping karts untouched', () => {
    const a = createKartState({ x: -100, y: 0 }, 0);
    const b = createKartState({ x: 100, y: 0 }, 0);
    const [ra, rb] = resolveKartCollision(a, b, 20);
    expect(ra).toEqual(a);
    expect(rb).toEqual(b);
  });
});
