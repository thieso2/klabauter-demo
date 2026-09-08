import { driveAI } from './ai';
import type { InputState } from './input';
import { type KartInput, type KartState, createKartState, resolveKartCollision, stepKart } from './kart';
import { type Camera, drawKart, drawTrack } from './render';
import type { RacerDesign } from './racers';
import { type RaceState, createRaceState, raceReducer, rankKarts } from './race';
import { type Track, crossGateDirection, crossedGateForward, distanceAlongSegment } from './track';
import type { Vec2 } from './vec2';

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
    KART_IDS.forEach((id) => {
      const kart = this.karts[id];
      let kartInput: KartInput;
      if (id === 'player') {
        kartInput = playerFrame;
      } else {
        const rivals = KART_IDS.filter((other) => other !== id).map((other) => this.karts[other]);
        const ai = driveAI(this.track, kart, rivals);
        kartInput = { steerAxis: ai.steerAxis, accelerate: ai.accelerate, brake: false, driftHeld: false };
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

  private render() {
    drawTrack(this.ctx, this.track, this.camera);
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
    };
  }

  private finishRace() {
    this.finished = true;
    const order = rankKarts(this.rankingEntries());
    const placements = order.map((id) => ({ kartId: id as KartId, name: this.designs[id as KartId].name }));
    this.onView(this.buildView(true, placements));
  }
}
