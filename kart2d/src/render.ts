import type { KartState } from './kart';
import type { RacerDesign } from './racers';
import type { Track } from './track';
import { type Vec2 } from './vec2';

export interface Camera {
  center: Vec2;
  scale: number;
  viewportWidth: number;
  viewportHeight: number;
}

export function worldToScreen(camera: Camera, p: Vec2): Vec2 {
  return {
    x: (p.x - camera.center.x) * camera.scale + camera.viewportWidth / 2,
    y: (p.y - camera.center.y) * camera.scale + camera.viewportHeight / 2,
  };
}

function centerlinePath(ctx: CanvasRenderingContext2D, track: Track, camera: Camera) {
  ctx.beginPath();
  track.centerline.forEach((p, i) => {
    const s = worldToScreen(camera, p);
    if (i === 0) ctx.moveTo(s.x, s.y);
    else ctx.lineTo(s.x, s.y);
  });
  ctx.closePath();
}

/** Draws the desert canyon: rock canyon wall, sand shoulder (the off-track slowdown band), then paved road. */
export function drawTrack(ctx: CanvasRenderingContext2D, track: Track, camera: Camera) {
  ctx.fillStyle = '#5c4325';
  ctx.fillRect(0, 0, camera.viewportWidth, camera.viewportHeight);

  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  centerlinePath(ctx, track, camera);
  ctx.strokeStyle = '#d9a066';
  ctx.lineWidth = track.hardWallHalfWidth * 2 * camera.scale;
  ctx.stroke();

  centerlinePath(ctx, track, camera);
  ctx.strokeStyle = '#4a4238';
  ctx.lineWidth = track.pavedHalfWidth * 2 * camera.scale;
  ctx.stroke();

  centerlinePath(ctx, track, camera);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = Math.max(1, 2 * camera.scale);
  ctx.setLineDash([14 * camera.scale, 18 * camera.scale]);
  ctx.stroke();
  ctx.setLineDash([]);

  drawCheckerGate(ctx, track.finishLine, camera);
}

function drawCheckerGate(ctx: CanvasRenderingContext2D, gate: Track['finishLine'], camera: Camera) {
  const a = worldToScreen(camera, gate.a);
  const b = worldToScreen(camera, gate.b);
  const squares = 8;
  for (let i = 0; i < squares; i++) {
    const t0 = i / squares;
    const t1 = (i + 1) / squares;
    ctx.fillStyle = i % 2 === 0 ? '#f1faee' : '#1d1d1d';
    ctx.fillRect(
      a.x + (b.x - a.x) * t0 - 4 * camera.scale,
      a.y + (b.y - a.y) * t0,
      8 * camera.scale,
      ((b.y - a.y) * (t1 - t0) || 4) + 4,
    );
  }
}

const SHAPES: Record<RacerDesign['shape'], Vec2[]> = {
  wedge: [
    { x: 22, y: 0 },
    { x: -14, y: 14 },
    { x: -6, y: 0 },
    { x: -14, y: -14 },
  ],
  delta: [
    { x: 20, y: 0 },
    { x: -16, y: 16 },
    { x: -16, y: -16 },
  ],
  hex: [
    { x: 18, y: 0 },
    { x: 8, y: 15 },
    { x: -10, y: 15 },
    { x: -18, y: 0 },
    { x: -10, y: -15 },
    { x: 8, y: -15 },
  ],
  chevron: [
    { x: 20, y: 0 },
    { x: -4, y: 16 },
    { x: -18, y: 16 },
    { x: 2, y: 0 },
    { x: -18, y: -16 },
    { x: -4, y: -16 },
  ],
};

export function drawKart(ctx: CanvasRenderingContext2D, camera: Camera, kart: KartState, design: RacerDesign) {
  const s = worldToScreen(camera, kart.position);
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.rotate(kart.heading);
  ctx.scale(camera.scale, camera.scale);

  const points = SHAPES[design.shape];
  ctx.beginPath();
  points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.closePath();
  ctx.fillStyle = design.bodyColor;
  ctx.fill();
  ctx.strokeStyle = design.accentColor;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(2, 0, 4.5, 0, Math.PI * 2);
  ctx.fillStyle = design.accentColor;
  ctx.fill();

  ctx.restore();

  if (kart.driftDirection !== 0) {
    const chargeFraction = Math.min(1, kart.driftCharge / 1.5);
    ctx.beginPath();
    ctx.arc(s.x, s.y - 26 * camera.scale, 5, 0, Math.PI * 2 * chargeFraction);
    ctx.strokeStyle = chargeFraction >= 0.33 ? '#ffd166' : '#ffffff';
    ctx.lineWidth = 3;
    ctx.stroke();
  }
}
