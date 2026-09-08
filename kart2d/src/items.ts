import type { Vec2 } from './vec2';

export type ItemType = 'boost' | 'projectile' | 'shield' | 'hazard';

export const ITEM_TYPES: readonly ItemType[] = ['boost', 'projectile', 'shield', 'hazard'];

export const ITEM_TUNING = {
  boostSpeedBonus: 150, // added to speed immediately, then bleeds off like a drift boost (KART_TUNING.dragAboveCap)
  spinOutDuration: 1.2, // seconds of lost steering/near-zero speed from a projectile or hazard hit
  hazardGraceWindow: 0.6, // seconds a hazard's dropper is immune to their own hazard
  hazardDropBackOffset: 40, // world units behind the kart a hazard is placed
  projectileSpeed: 620,
  projectileRange: 560,
  projectileHitRadius: 12,
  hazardHitRadius: 22,
  boxPickupRadius: 42,
  boxRespawnCooldown: 6,
} as const;

export interface ItemHolderState {
  heldItem: ItemType | null;
  shieldActive: boolean;
}

export function createItemHolderState(): ItemHolderState {
  return { heldItem: null, shieldActive: false };
}

export type ItemEvent =
  | { type: 'BOOST_USED' }
  | { type: 'PROJECTILE_HIT' }
  | { type: 'SHIELD_ABSORBED' }
  | { type: 'HAZARD_TRIGGERED' };

export interface ItemAffectedState {
  speed: number;
  spinOutRemaining: number;
  heldItem: ItemType | null;
  shieldActive: boolean;
}

/** Applies one item-effect event to a kart's state. Pure: independent of rendering, AI, or world entities. */
export function applyItemEvent<T extends ItemAffectedState>(kart: T, event: ItemEvent): T {
  switch (event.type) {
    case 'BOOST_USED':
      return { ...kart, speed: kart.speed + ITEM_TUNING.boostSpeedBonus, heldItem: null };
    case 'PROJECTILE_HIT':
      return { ...kart, spinOutRemaining: ITEM_TUNING.spinOutDuration };
    case 'SHIELD_ABSORBED':
      return { ...kart, shieldActive: false };
    case 'HAZARD_TRIGGERED':
      return { ...kart, spinOutRemaining: ITEM_TUNING.spinOutDuration };
  }
}

/** An active shield absorbs an incoming projectile/hazard contact instead of it spinning the kart out. */
export function resolveIncomingHit(kart: { shieldActive: boolean }, source: 'projectile' | 'hazard'): ItemEvent {
  if (kart.shieldActive) return { type: 'SHIELD_ABSORBED' };
  return { type: source === 'projectile' ? 'PROJECTILE_HIT' : 'HAZARD_TRIGGERED' };
}

export interface Hazard {
  ownerId: string;
  position: Vec2;
  age: number; // seconds since dropped
}

export interface Projectile {
  ownerId: string;
  position: Vec2;
  heading: number;
  traveled: number; // world units flown since firing
}

/** A hazard is harmless to its own dropper until the grace window elapses; armed for everyone else immediately. */
export function isHazardArmedFor(hazard: Hazard, kartId: string): boolean {
  return hazard.ownerId !== kartId || hazard.age >= ITEM_TUNING.hazardGraceWindow;
}

/** Uniform-random item grant; `rng` is injectable (defaults to Math.random) so odds are deterministically testable. */
export function rollItem(rng: () => number = Math.random): ItemType {
  const index = Math.min(ITEM_TYPES.length - 1, Math.floor(rng() * ITEM_TYPES.length));
  return ITEM_TYPES[index];
}
