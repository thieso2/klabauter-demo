import { describe, expect, it } from 'vitest';
import { driveAI } from './ai';
import { createKartState } from './kart';
import { desertCanyon } from './track';
import { add, fromAngle, scale } from './vec2';

describe('driveAI', () => {
  it('steers right when heading has drifted left of the driving line', () => {
    const kart = createKartState(desertCanyon.centerline[0], desertCanyon.startHeading + 1.0);
    const output = driveAI(desertCanyon, kart, []);
    expect(output.steerAxis).toBeLessThan(0);
  });

  it('steers left when heading has drifted right of the driving line', () => {
    const kart = createKartState(desertCanyon.centerline[0], desertCanyon.startHeading - 1.0);
    const output = driveAI(desertCanyon, kart, []);
    expect(output.steerAxis).toBeGreaterThan(0);
  });

  it('always accelerates and does not press the item button while holding nothing', () => {
    const kart = createKartState(desertCanyon.centerline[0], desertCanyon.startHeading);
    const output = driveAI(desertCanyon, kart, []);
    expect(output.accelerate).toBe(true);
    expect(output.itemUsePressed).toBe(false);
  });

  it('presses the item button once it is holding an item, so it is never inert', () => {
    const kart = { ...createKartState(desertCanyon.centerline[0], desertCanyon.startHeading), heldItem: 'boost' as const };
    const output = driveAI(desertCanyon, kart, []);
    expect(output.itemUsePressed).toBe(true);
  });

  it('adjusts its steering to attempt to overtake a close rival directly ahead', () => {
    const kart = { ...createKartState(desertCanyon.centerline[0], desertCanyon.startHeading), speed: 150 };
    const clear = driveAI(desertCanyon, kart, []);

    const forward = fromAngle(kart.heading);
    const rival = createKartState(add(kart.position, scale(forward, 100)), desertCanyon.startHeading);
    const blocked = driveAI(desertCanyon, kart, [rival]);

    expect(blocked.steerAxis).not.toBeCloseTo(clear.steerAxis, 3);
  });

  it('ignores a rival far outside the overtake distance', () => {
    const kart = { ...createKartState(desertCanyon.centerline[0], desertCanyon.startHeading), speed: 150 };
    const clear = driveAI(desertCanyon, kart, []);

    const forward = fromAngle(kart.heading);
    const farRival = createKartState(add(kart.position, scale(forward, 2000)), desertCanyon.startHeading);
    const withFarRival = driveAI(desertCanyon, kart, [farRival]);

    expect(withFarRival.steerAxis).toBeCloseTo(clear.steerAxis, 5);
  });
});
