import { describe, expect, it } from 'vitest';
import {
  ITEM_TUNING,
  ITEM_TYPES,
  applyItemEvent,
  createItemHolderState,
  isHazardArmedFor,
  resolveIncomingHit,
  rollItem,
} from './items';

function baseKart(overrides: Partial<{ speed: number; spinOutRemaining: number; shieldActive: boolean }> = {}) {
  return { speed: 100, spinOutRemaining: 0, ...createItemHolderState(), ...overrides };
}

describe('applyItemEvent', () => {
  it('BOOST_USED adds forward speed and consumes the held item', () => {
    const kart = { ...baseKart({ speed: 100 }), heldItem: 'boost' as const };
    const next = applyItemEvent(kart, { type: 'BOOST_USED' });
    expect(next.speed).toBe(100 + ITEM_TUNING.boostSpeedBonus);
    expect(next.heldItem).toBeNull();
  });

  it('PROJECTILE_HIT and HAZARD_TRIGGERED set spinOutRemaining to the fixed duration', () => {
    const kart = baseKart();
    expect(applyItemEvent(kart, { type: 'PROJECTILE_HIT' }).spinOutRemaining).toBe(ITEM_TUNING.spinOutDuration);
    expect(applyItemEvent(kart, { type: 'HAZARD_TRIGGERED' }).spinOutRemaining).toBe(ITEM_TUNING.spinOutDuration);
  });

  it('SHIELD_ABSORBED clears the shield without spinning the kart out', () => {
    const kart = baseKart({ shieldActive: true });
    const next = applyItemEvent(kart, { type: 'SHIELD_ABSORBED' });
    expect(next.shieldActive).toBe(false);
    expect(next.spinOutRemaining).toBe(0);
  });
});

describe('shield absorbs exactly one hit then is consumed', () => {
  it('the first incoming hit is absorbed by the shield; the next spins the kart out', () => {
    let kart = baseKart({ shieldActive: true });

    const firstEvent = resolveIncomingHit(kart, 'projectile');
    expect(firstEvent).toEqual({ type: 'SHIELD_ABSORBED' });
    kart = applyItemEvent(kart, firstEvent);
    expect(kart.shieldActive).toBe(false);
    expect(kart.spinOutRemaining).toBe(0);

    const secondEvent = resolveIncomingHit(kart, 'projectile');
    expect(secondEvent).toEqual({ type: 'PROJECTILE_HIT' });
    kart = applyItemEvent(kart, secondEvent);
    expect(kart.spinOutRemaining).toBe(ITEM_TUNING.spinOutDuration);
  });

  it('a hazard contact is absorbed the same way as a projectile', () => {
    const kart = baseKart({ shieldActive: true });
    expect(resolveIncomingHit(kart, 'hazard')).toEqual({ type: 'SHIELD_ABSORBED' });
  });

  it('without a shield, a hit spins the kart out directly', () => {
    const kart = baseKart({ shieldActive: false });
    expect(resolveIncomingHit(kart, 'projectile')).toEqual({ type: 'PROJECTILE_HIT' });
    expect(resolveIncomingHit(kart, 'hazard')).toEqual({ type: 'HAZARD_TRIGGERED' });
  });
});

describe('isHazardArmedFor (self-immunity grace window)', () => {
  it('the dropper is immune immediately after dropping', () => {
    const hazard = { ownerId: 'a', position: { x: 0, y: 0 }, age: 0 };
    expect(isHazardArmedFor(hazard, 'a')).toBe(false);
  });

  it('the dropper stays immune up to the grace window', () => {
    const hazard = { ownerId: 'a', position: { x: 0, y: 0 }, age: ITEM_TUNING.hazardGraceWindow - 0.01 };
    expect(isHazardArmedFor(hazard, 'a')).toBe(false);
  });

  it('the dropper becomes vulnerable to their own hazard once the grace window elapses', () => {
    const hazard = { ownerId: 'a', position: { x: 0, y: 0 }, age: ITEM_TUNING.hazardGraceWindow };
    expect(isHazardArmedFor(hazard, 'a')).toBe(true);
  });

  it('any other kart is vulnerable to the hazard immediately, with no grace window', () => {
    const hazard = { ownerId: 'a', position: { x: 0, y: 0 }, age: 0 };
    expect(isHazardArmedFor(hazard, 'b')).toBe(true);
  });
});

describe('rollItem', () => {
  it('grants each item type at uniform odds across the RNG range', () => {
    const boundaries = [0, 0.25, 0.5, 0.75];
    const results = boundaries.map((v) => rollItem(() => v));
    expect(results).toEqual(ITEM_TYPES);
  });

  it('never rolls out of range at the top edge of the RNG', () => {
    expect(rollItem(() => 0.999999)).toBe(ITEM_TYPES[ITEM_TYPES.length - 1]);
  });
});
