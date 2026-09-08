import { driveAI } from './ai';
import type { InputState } from './input';
import {
  ITEM_TUNING,
  type Hazard,
  type ItemType,
  type Projectile,
  applyItemEvent,
  isHazardArmedFor,
  resolveIncomingHit,
  rollItem,
} from './items';
import { type KartInput, type KartState, createKartState, resolveKartCollision, stepKart } from './kart';
import { type Camera, drawHazards, drawItemBoxes, drawKart, drawProjectiles, drawTrack } from './render';
import type { RacerDesign } from './racers';
import { type RaceState, createRaceState, raceReducer, rankKarts } from './race';
import { type Track, crossGateDirection, crossedGateForward, distanceAlongSegment } from './track';
import { type Vec2, add, distance, fromAngle, scale, sub } from './vec2';

export type KartId = 'player' | 'ai-1' | 'ai-2' | 'ai-3';
const KART_IDS: KartId[] = ['player', 'ai-1', 'ai-2', 'ai-3'];
const TOTAL_LAPS = 3;
const KART_RADIUS = 22;
const FIXED_DT = 1 / 60;
const CAMERA_SCALE = 0.55;

export interface RaceView {
  lap: number; // player's current lap number in progress, 1..totalLaps
  totalLaps: number;
  position: number; // player's 1-indexed rank
  totalKarts: number;
  finished: boolean;
  placements: { kartId: KartId; name: string }[] | null;
  heldItem: ItemType | null;
}

/** Owns the simulation loop for one race: steps input/AI/physics/collisions/laps at a fixed step, then renders. */
export class Game {
  private karts: Record<KartId, KartState>;
  private designs: Record<KartId, RacerDesign>;
  private raceState: RaceState;
  private camera: Camera;
  private ctx: CanvasRenderingContext2D;
  private accumulator = 0;
  private lastTime: number | null = null;
  private rafHandle: number | null = null;
  private finished = false;
  private itemBoxCooldowns: number[];
  private projectiles: Projectile[] = [];
  private hazards: Hazard[] = [];

  constructor(
    private canvas: HTMLCanvasElement,
    private track: Track,
    playerDesign: RacerDesign,
    aiDesigns: [RacerDesign, RacerDesign, RacerDesign],
    private input: InputState,
    private onView: (view: RaceView) => void,
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    this.ctx = ctx;
    this.camera = { center: track.startPositions[0], scale: CAMERA_SCALE, viewportWidth: canvas.width, viewportHeight: canvas.height };

    this.designs = { player: playerDesign, 'ai-1': aiDesigns[0], 'ai-2': aiDesigns[1], 'ai-3': aiDesigns[2] };
    this.karts = {} as Record<KartId, KartState>;
    KART_IDS.forEach((id, i) => {
      this.karts[id] = createKartState(track.startPositions[i], track.startHeading);
    });
    this.raceState = createRaceState(KART_IDS, track.totalCheckpoints);
    this.itemBoxCooldowns = track.itemBoxes.map(() => 0);
  }

  start() {
    this.lastTime = null;
    this.rafHandle = requestAnimationFrame(this.loop);
  }

  stop() {
    if (this.rafHandle !== null) cancelAnimationFrame(this.rafHandle);
    this.rafHandle = null;
  }

  private loop = (time: number) => {
    if (this.lastTime === null) this.lastTime = time;
    const delta = Math.min(0.25, (time - this.lastTime) / 1000);
    this.lastTime = time;
    this.accumulator += delta;
    while (this.accumulator >= FIXED_DT && !this.finished) {
      this.tick(FIXED_DT);
      this.accumulator -= FIXED_DT;
    }
    this.render();
    if (!this.finished) this.rafHandle = requestAnimationFrame(this.loop);
  };

  private tick(dt: number) {
    const prevPositions: Record<KartId, Vec2> = {} as Record<KartId, Vec2>;
    KART_IDS.forEach((id) => (prevPositions[id] = this.karts[id].position));

    const playerFrame = this.input.sample();
    const itemUsePressed: Record<KartId, boolean> = {} as Record<KartId, boolean>;
    KART_IDS.forEach((id) => {
      const kart = this.karts[id];
      let kartInput: KartInput;
      if (id === 'player') {
        kartInput = playerFrame;
        itemUsePressed[id] = playerFrame.itemPressed;
      } else {
        const rivals = KART_IDS.filter((other) => other !== id).map((other) => this.karts[other]);
        const ai = driveAI(this.track, kart, rivals);
        kartInput = { steerAxis: ai.steerAxis, accelerate: ai.accelerate, brake: false, driftHeld: false };
        itemUsePressed[id] = ai.itemUsePressed;
      }
      this.karts[id] = stepKart(kart, kartInput, this.track, dt);
    });

    for (let i = 0; i < KART_IDS.length; i++) {
      for (let j = i + 1; j < KART_IDS.length; j++) {
        const [a, b] = resolveKartCollision(this.karts[KART_IDS[i]], this.karts[KART_IDS[j]], KART_RADIUS);
        this.karts[KART_IDS[i]] = a;
        this.karts[KART_IDS[j]] = b;
      }
    }

    this.tickItems(dt, itemUsePressed);

    for (const id of KART_IDS) {
      const prev = prevPositions[id];
      const curr = this.karts[id].position;
      const progress = this.raceState.karts[id];

      const nextGate = progress.checkpointIndex < this.track.totalCheckpoints ? this.track.checkpoints[progress.checkpointIndex] : null;
      if (nextGate && crossedGateForward(nextGate, prev, curr)) {
        this.raceState = raceReducer(this.raceState, {
          type: 'CHECKPOINT_PASSED',
          kartId: id,
          checkpointIndex: progress.checkpointIndex,
        }).state;
      }

      const finishDirection = crossGateDirection(this.track.finishLine, prev, curr);
      if (finishDirection) {
        const result = raceReducer(this.raceState, { type: 'FINISH_CROSSED', kartId: id, forward: finishDirection === 'forward' });
        this.raceState = result.state;
        if (id === 'player' && result.emitted.some((e) => e.type === 'LAP_COMPLETED' && e.lap >= TOTAL_LAPS)) {
          this.finishRace();
          return;
        }
      }
    }

    this.camera.center = this.karts.player.position;
    this.onView(this.buildView(false, null));
  }

  /** Item-use, in-flight projectiles, dropped hazards, and item box pickups/respawns — all after this tick's movement. */
  private tickItems(dt: number, itemUsePressed: Record<KartId, boolean>) {
    for (const id of KART_IDS) {
      if (!itemUsePressed[id]) continue;
      const kart = this.karts[id];
      const item = kart.heldItem;
      if (!item) continue;
      if (item === 'boost') {
        this.karts[id] = applyItemEvent(kart, { type: 'BOOST_USED' });
      } else if (item === 'shield') {
        this.karts[id] = { ...kart, heldItem: null, shieldActive: true };
      } else if (item === 'projectile') {
        this.karts[id] = { ...kart, heldItem: null };
        this.projectiles.push({ ownerId: id, position: kart.position, heading: kart.heading, traveled: 0 });
      } else {
        this.karts[id] = { ...kart, heldItem: null };
        const rear = sub(kart.position, scale(fromAngle(kart.heading), ITEM_TUNING.hazardDropBackOffset));
        this.hazards.push({ ownerId: id, position: rear, age: 0 });
      }
    }

    const survivingProjectiles: Projectile[] = [];
    for (const projectile of this.projectiles) {
      const traveled = projectile.traveled + ITEM_TUNING.projectileSpeed * dt;
      const position = add(projectile.position, scale(fromAngle(projectile.heading), ITEM_TUNING.projectileSpeed * dt));
      let hit = false;
      for (const id of KART_IDS) {
        if (id === projectile.ownerId) continue;
        const target = this.karts[id];
        if (distance(target.position, position) > ITEM_TUNING.projectileHitRadius + KART_RADIUS) continue;
        this.karts[id] = applyItemEvent(target, resolveIncomingHit(target, 'projectile'));
        hit = true;
        break;
      }
      if (!hit && traveled <= ITEM_TUNING.projectileRange) survivingProjectiles.push({ ...projectile, position, traveled });
    }
    this.projectiles = survivingProjectiles;

    const survivingHazards: Hazard[] = [];
    for (const hazard of this.hazards) {
      const aged = { ...hazard, age: hazard.age + dt };
      let consumed = false;
      for (const id of KART_IDS) {
        const target = this.karts[id];
        if (distance(target.position, aged.position) > ITEM_TUNING.hazardHitRadius + KART_RADIUS) continue;
        if (!isHazardArmedFor(aged, id)) continue;
        this.karts[id] = applyItemEvent(target, resolveIncomingHit(target, 'hazard'));
        consumed = true;
        break;
      }
      if (!consumed) survivingHazards.push(aged);
    }
    this.hazards = survivingHazards;

    this.itemBoxCooldowns = this.itemBoxCooldowns.map((cooldown, i) => {
      if (cooldown > 0) return Math.max(0, cooldown - dt);
      const box = this.track.itemBoxes[i];
      for (const id of KART_IDS) {
        const kart = this.karts[id];
        if (kart.heldItem) continue;
        if (distance(kart.position, box) > ITEM_TUNING.boxPickupRadius) continue;
        this.karts[id] = { ...kart, heldItem: rollItem() };
        return ITEM_TUNING.boxRespawnCooldown;
      }
      return 0;
    });
  }

  private render() {
    drawTrack(this.ctx, this.track, this.camera);
    drawItemBoxes(this.ctx, this.track, this.camera, this.itemBoxCooldowns);
    drawHazards(this.ctx, this.camera, this.hazards);
    drawProjectiles(this.ctx, this.camera, this.projectiles);
    for (const id of KART_IDS) drawKart(this.ctx, this.camera, this.karts[id], this.designs[id]);
  }

  private rankingEntries() {
    return KART_IDS.map((id) => {
      const progress = this.raceState.karts[id];
      return {
        kartId: id,
        lapsCompleted: progress.lapsCompleted,
        checkpointIndex: progress.checkpointIndex,
        distanceAlongSegment: distanceAlongSegment(this.track, this.karts[id].position, progress.checkpointIndex),
      };
    });
  }

  private buildView(finished: boolean, placements: { kartId: KartId; name: string }[] | null): RaceView {
    const order = rankKarts(this.rankingEntries());
    const playerProgress = this.raceState.karts.player;
    return {
      lap: Math.min(TOTAL_LAPS, playerProgress.lapsCompleted + 1),
      totalLaps: TOTAL_LAPS,
      position: order.indexOf('player') + 1,
      totalKarts: KART_IDS.length,
      finished,
      placements,
      heldItem: this.karts.player.heldItem,
    };
  }

  /** Test-only browser seam. The entry point exposes this only with ?test=1, to skip a full physical lap count. */
  testFinishRace() {
    if (this.finished) return;
    this.raceState = {
      ...this.raceState,
      karts: { ...this.raceState.karts, player: { lapsCompleted: TOTAL_LAPS, checkpointIndex: this.track.totalCheckpoints } },
    };
    this.finishRace();
  }

  private finishRace() {
    this.finished = true;
    const order = rankKarts(this.rankingEntries());
    const placements = order.map((id) => ({ kartId: id as KartId, name: this.designs[id as KartId].name }));
    this.onView(this.buildView(true, placements));
  }
}
