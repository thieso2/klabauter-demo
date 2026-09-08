export interface Vec2 {
  x: number;
  y: number;
}

export const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (a: Vec2, s: number): Vec2 => ({ x: a.x * s, y: a.y * s });
export const dot = (a: Vec2, b: Vec2): number => a.x * b.x + a.y * b.y;
export const cross = (a: Vec2, b: Vec2): number => a.x * b.y - a.y * b.x;
export const length = (a: Vec2): number => Math.hypot(a.x, a.y);
export const distance = (a: Vec2, b: Vec2): number => length(sub(a, b));
export function normalize(a: Vec2): Vec2 {
  const len = length(a);
  return len > 1e-9 ? { x: a.x / len, y: a.y / len } : { x: 0, y: 0 };
}
/** Rotates a vector by `radians` (counter-clockwise in a standard math frame). */
export function rotate(a: Vec2, radians: number): Vec2 {
  const c = Math.cos(radians), s = Math.sin(radians);
  return { x: a.x * c - a.y * s, y: a.x * s + a.y * c };
}
/** 90-degree counter-clockwise perpendicular. */
export const perp = (a: Vec2): Vec2 => ({ x: -a.y, y: a.x });
export const fromAngle = (radians: number): Vec2 => ({ x: Math.cos(radians), y: Math.sin(radians) });
export const angleOf = (a: Vec2): number => Math.atan2(a.y, a.x);
export function clampLength(a: Vec2, max: number): Vec2 {
  const len = length(a);
  return len > max && len > 1e-9 ? scale(a, max / len) : a;
}
/** Shortest signed difference from `a` to `b` in radians, in (-PI, PI]. */
export function angleDelta(a: number, b: number): number {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
