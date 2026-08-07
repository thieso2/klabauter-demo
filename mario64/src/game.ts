import * as THREE from "three";
import { InputNormalizer, type FrameInput, type Action } from "./input";
import {
  initialPlayer,
  stepPlayer,
  type PlayerState,
  type PlayerWorld,
  type Surface,
  type Vec3,
} from "./player";
import type { Settings } from "./settings";
import {
  CHECKPOINTS,
  guidanceText,
  initialRun,
  objectiveText,
  reduceRun,
  type RunState,
} from "./run-state";
import {
  conductors,
  damage,
  heal,
  initialEncounter,
  resetTransient,
  stepEncounter,
  type EncounterState,
} from "./encounter";

interface Pad {
  x: number;
  z: number;
  y: number;
  w: number;
  d: number;
  h?: number;
  color?: string;
  name?: string;
  motion?: {
    axis: "x" | "z" | "y";
    range: number;
    speed: number;
    phase: number;
  };
  mesh?: THREE.Mesh;
  last?: Vec3;
}
interface Slope {
  x: number;
  z: number;
  y: number;
  w: number;
  d: number;
  rise: number;
  mesh?: THREE.Mesh;
}
const pads: Pad[] = [
  { x: 0, z: 8, y: 0.8, w: 14, d: 10, color: "#d5b967", name: "Landing Shelf" },
  {
    x: -15,
    z: 3,
    y: 1.1,
    w: 15,
    d: 7,
    color: "#afc477",
    name: "Whispering Orchard",
  },
  { x: 14, z: 5, y: 1.5, w: 14, d: 6, color: "#d8a75e", name: "Amber Run" },
  {
    x: 1,
    z: -7,
    y: 1.8,
    w: 10,
    d: 11,
    color: "#91b991",
    name: "Crystal Hollow",
  },
  { x: -7, z: -15, y: 3, w: 8, d: 4 },
  { x: 2, z: -19, y: 4.5, w: 9, d: 4 },
  { x: 11, z: -16, y: 6, w: 8, d: 4 },
  {
    x: 16,
    z: -22,
    y: 7.5,
    w: 5,
    d: 5,
    motion: { axis: "x", range: 4, speed: 0.8, phase: 0 },
    name: "Wind Ferry",
  },
  { x: 8, z: -28, y: 9, w: 6, d: 5 },
  { x: 0, z: -31, y: 11, w: 4, d: 5 },
  { x: -6, z: -34, y: 13, w: 4, d: 5 },
  {
    x: -1,
    z: -41,
    y: 15,
    w: 5,
    d: 5,
    motion: { axis: "z", range: 4, speed: 0.65, phase: 1.2 },
    name: "Cloud Lift",
  },
  { x: 7, z: -45, y: 17, w: 6, d: 6 },
  { x: 0, z: -52, y: 19, w: 9, d: 5 },
  {
    x: 0,
    z: -64,
    y: 21,
    w: 25,
    d: 18,
    color: "#c4b27e",
    name: "Galecrest Crown",
  },
  // broad recovery terraces beneath the ascent
  { x: 3, z: -23, y: 1, w: 28, d: 7, color: "#789b78" },
  { x: -1, z: -38, y: 2, w: 25, d: 7, color: "#789b78" },
  { x: 3, z: -50, y: 3, w: 28, d: 7, color: "#789b78" },
];
const walls = [
  { x: 3, z: -31, y: 13, w: 0.8, d: 5, h: 8 },
  { x: -3, z: -34, y: 15, w: 0.8, d: 5, h: 8 },
  { x: 0, z: -48, y: 20, w: 7, d: 0.8, h: 5 },
];
const slopes: Slope[] = [
  { x: -7, z: -12.5, y: 2, w: 8, d: 5, rise: 2 },
  { x: 7, z: -25.5, y: 7.6, w: 6, d: 5, rise: 6 },
];
interface ObjectiveEntity {
  id: string;
  kind: "beacon" | "mote" | "shard" | "health";
  position: Vec3;
  mesh: THREE.Object3D;
}
export interface RunView {
  objective: string;
  guidance: string;
  feedback: string;
  beacons: number;
  motes: number;
  shards: number;
  elapsed: number;
  phase: RunState["phase"];
  health: number;
  maxHealth: number;
  guardianHits: number;
  complete: boolean;
}

export class Game {
  readonly input = new InputNormalizer();
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(58, 1, 0.1, 150);
  private hero: THREE.Group;
  private state: PlayerState = initialPlayer();
  private accumulator = 0;
  private last = 0;
  private elapsed = 0;
  private running = false;
  private yaw = 0;
  private pitch = 0.45;
  private distance = 9;
  private world: PlayerWorld;
  private run = initialRun();
  private encounter: EncounterState = initialEncounter();
  private entities: ObjectiveEntity[] = [];
  private healthCollected = new Set<string>();
  private ascentGate?: THREE.Mesh;
  private summitGate?: THREE.Mesh;
  private enemyMeshes = new Map<string, THREE.Object3D>();
  private guardian?: THREE.Group;
  private crest?: THREE.Object3D;
  private conductorMeshes: THREE.Object3D[] = [];
  private cameraSolids: THREE.Object3D[] = [];
  private cameraDistance = 9;
  private lastFeedback = -1;
  private lastEncounterFeedback = -1;
  constructor(
    private host: HTMLElement,
    private settings: Settings,
    private onPause: () => void,
    private onRun: (view: RunView) => void = () => {},
  ) {
    const tier = this.resolveQuality();
    this.renderer = new THREE.WebGLRenderer({
      antialias: tier !== "low",
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(
      Math.min(
        devicePixelRatio,
        tier === "high" ? 2 : tier === "medium" ? 1.5 : 1,
      ),
    );
    this.renderer.shadowMap.enabled = tier !== "low";
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.dataset.quality = tier;
    host.prepend(this.renderer.domElement);
    this.scene.background = new THREE.Color("#86c9d5");
    this.scene.fog = new THREE.Fog("#86c9d5", 48, 115);
    this.scene.add(new THREE.HemisphereLight("#fff5ce", "#274c59", 2.4));
    const sun = new THREE.DirectionalLight("#fff0ad", 2.7);
    sun.position.set(-18, 35, 12);
    sun.castShadow = true;
    this.scene.add(sun);
    this.buildIsland();
    this.buildObjectives();
    this.buildEncounters();
    this.world = {
      ground: (x, z, py) => this.ground(x, z, py),
      wall: (p, v) => this.wall(p, v),
      bounds: {
        minX: -35,
        maxX: 35,
        minZ: -78,
        maxZ: 18,
        voidY: this.settings.assist ? -5 : -10,
      },
    };
    this.hero = this.makeHero();
    this.scene.add(this.hero);
    this.bind();
    this.resize();
  }
  start() {
    this.running = true;
    this.last = performance.now();
    this.emitRun();
    requestAnimationFrame(this.loop);
  }
  stop() {
    this.running = false;
    this.input.clearAll();
  }
  resume() {
    if (!this.running) this.start();
  }
  updateSettings(s: Settings) {
    this.settings = s;
    if (this.world.bounds) this.world.bounds.voidY = s.assist ? -5 : -10;
  }
  private resolveQuality() {
    if (this.settings.quality !== "auto") return this.settings.quality;
    const coarse = matchMedia("(pointer: coarse)").matches,
      cores = navigator.hardwareConcurrency || 4,
      memory =
        (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
    return coarse || cores <= 4 || memory <= 4
      ? "low"
      : cores >= 8 && memory >= 8
        ? "high"
        : "medium";
  }
  private buildIsland() {
    const stone = new THREE.MeshStandardMaterial({
      color: "#617a70",
      flatShading: true,
      roughness: 1,
    });
    for (const p of pads) {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(p.w, Math.max(1, p.h ?? 1.4), p.d),
        new THREE.MeshStandardMaterial({
          color: p.color ?? "#d0bb78",
          flatShading: true,
          roughness: 0.95,
        }),
      );
      m.position.set(p.x, p.y - (p.h ?? 1.4) / 2, p.z);
      m.castShadow = m.receiveShadow = true;
      p.mesh = m;
      p.last = { x: p.x, y: p.y, z: p.z };
      this.scene.add(m);
      this.cameraSolids.push(m);
      if (p.name) this.marker(p.name, p.x, p.y + 0.08, p.z);
    }
    for (const w of walls) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w.w, w.h, w.d), stone);
      m.position.set(w.x, w.y - w.h / 2, w.z);
      m.castShadow = true;
      this.scene.add(m);
      this.cameraSolids.push(m);
    }
    for (const s of slopes) {
      const angle = Math.atan2(s.rise, s.d),
        m = new THREE.Mesh(
          new THREE.BoxGeometry(s.w, 0.7, Math.hypot(s.d, s.rise)),
          new THREE.MeshStandardMaterial({
            color: "#b8b676",
            flatShading: true,
            roughness: 1,
          }),
        );
      m.rotation.x = -angle;
      m.position.set(s.x, s.y + s.rise / 2 - 0.35, s.z);
      m.castShadow = m.receiveShadow = true;
      s.mesh = m;
      this.scene.add(m);
      this.cameraSolids.push(m);
    }
    // Original route language: curved wind arches, branch cairns, and a many-pointed summit canopy.
    for (let i = 0; i < 18; i++) {
      const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.45 + (i % 4) * 0.18, 0),
        stone,
      );
      const a = i * 2.4,
        r = 10 + (i % 8);
      rock.position.set(Math.sin(a) * r, 0.5, 7 + Math.cos(a) * r);
      rock.scale.y = 1.6;
      this.scene.add(rock);
    }
    for (let i = 0; i < 7; i++) {
      const fin = new THREE.Mesh(
        new THREE.ConeGeometry(0.45, 3.5, 3),
        new THREE.MeshStandardMaterial({ color: "#e8dfb3", flatShading: true }),
      );
      const a = (i / 7) * Math.PI * 2;
      fin.position.set(Math.sin(a) * 9, 23, -64 + Math.cos(a) * 6);
      fin.rotation.z = a;
      this.scene.add(fin);
    }
  }
  private buildObjectives() {
    const beaconData = [
      ["orchard", -19, 2, 1.2, "#32d4df"],
      ["amber", 17, 6, 1.6, "#ff9d32"],
      ["hollow", 0, -10, 1.9, "#a779ff"],
    ] as const;
    for (const [id, x, z, y, color] of beaconData) {
      const group = new THREE.Group(),
        ring = new THREE.Mesh(
          new THREE.TorusGeometry(1.05, 0.2, 4, 12),
          new THREE.MeshStandardMaterial({
            color: "#53676c",
            emissive: color,
            emissiveIntensity: 0.08,
          }),
        ),
        spire = new THREE.Mesh(
          new THREE.ConeGeometry(0.42, 2, 4),
          new THREE.MeshStandardMaterial({
            color: "#c8d4ca",
            flatShading: true,
          }),
        );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 1.25;
      spire.position.y = 0.8;
      group.add(ring, spire);
      group.position.set(x, y, z);
      group.userData.landmarkId = `beacon-${id}`;
      group.userData.cue = "diamond beacon";
      this.scene.add(group);
      this.entities.push({
        id,
        kind: "beacon",
        position: { x, y: y + 0.8, z },
        mesh: group,
      });
    }
    const moteData = [
      ["threshold", -7, 4, -15],
      ["switchback", 2, 5.5, -19],
      ["ferry", 16, 8.4, -22],
      ["wallkick", -6, 14, -34],
      ["crownstep", 0, 20, -52],
    ] as const;
    for (const [id, x, y, z] of moteData) {
      const mesh = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.42, 0),
        new THREE.MeshStandardMaterial({
          color: "#fff39a",
          emissive: "#51d9e8",
          emissiveIntensity: 1.5,
          flatShading: true,
        }),
      );
      mesh.position.set(x, y, z);
      mesh.userData.landmarkId = `mote-${id}`;
      mesh.userData.cue = "octagonal energy mote";
      this.scene.add(mesh);
      this.entities.push({ id, kind: "mote", position: { x, y, z }, mesh });
    }
    for (const [id, x, y, z] of [
      ["shelf", 5, 1.5, 7],
      ["orchard-high", -16, 2.2, 1],
      ["recovery", 8, 2, -24],
    ] as const) {
      const mesh = new THREE.Mesh(
        new THREE.TetrahedronGeometry(0.32),
        new THREE.MeshStandardMaterial({
          color: "#f6d65c",
          emissive: "#aa6712",
          emissiveIntensity: 0.6,
        }),
      );
      mesh.position.set(x, y, z);
      mesh.userData.landmarkId = `shard-${id}`;
      this.scene.add(mesh);
      this.entities.push({ id, kind: "shard", position: { x, y, z }, mesh });
    }
    for (const [id, x, y, z] of [
      ["foothill-tonic", -11, 1.2, 5],
      ["ascent-tonic", 8, 4.7, -20],
    ] as const) {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.38, 8, 6),
        new THREE.MeshStandardMaterial({
          color: "#7ff0a2",
          emissive: "#287d56",
          emissiveIntensity: 1,
        }),
      );
      mesh.position.set(x, y, z);
      mesh.userData.landmarkId = `health-${id}`;
      mesh.userData.cue = "green round health tonic";
      this.scene.add(mesh);
      this.entities.push({ id, kind: "health", position: { x, y, z }, mesh });
    }
    const gateMat = new THREE.MeshStandardMaterial({
      color: "#263f55",
      emissive: "#407da0",
      emissiveIntensity: 0.5,
      transparent: true,
      opacity: 0.9,
    });
    this.ascentGate = new THREE.Mesh(
      new THREE.BoxGeometry(70, 8, 0.8),
      gateMat.clone(),
    );
    this.ascentGate.position.set(0, 4, -12);
    this.ascentGate.userData.landmarkId = "gate-ascent";
    this.scene.add(this.ascentGate);
    this.cameraSolids.push(this.ascentGate);
    this.summitGate = new THREE.Mesh(
      new THREE.BoxGeometry(70, 24, 0.8),
      gateMat.clone(),
    );
    this.summitGate.position.set(0, 12, -56);
    this.summitGate.userData.landmarkId = "gate-summit";
    this.scene.add(this.summitGate);
    this.cameraSolids.push(this.summitGate);
  }
  private buildEncounters() {
    const colors = { charger: "#e36e46", spitter: "#65b9c5", bloom: "#b56bd4" };
    for (const e of this.encounter.enemies) {
      const g = new THREE.Group(),
        body = new THREE.Mesh(
          e.kind === "bloom"
            ? new THREE.ConeGeometry(0.7, 1.5, 7)
            : new THREE.DodecahedronGeometry(0.65, 0),
          new THREE.MeshStandardMaterial({
            color: colors[e.kind],
            emissive: "#2b1726",
            flatShading: true,
          }),
        );
      body.position.y = 0.65;
      g.add(body);
      g.position.set(e.position.x, e.position.y, e.position.z);
      g.userData.landmarkId = `enemy-${e.id}`;
      this.scene.add(g);
      this.enemyMeshes.set(e.id, g);
    }
    this.guardian = new THREE.Group();
    const shell = new THREE.Mesh(
        new THREE.IcosahedronGeometry(1.55, 0),
        new THREE.MeshStandardMaterial({
          color: "#365a67",
          emissive: "#163744",
          flatShading: true,
        }),
      ),
      core = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.72),
        new THREE.MeshStandardMaterial({
          color: "#f6cb62",
          emissive: "#5bcddd",
          emissiveIntensity: 0.3,
          flatShading: true,
        }),
      );
    core.userData.core = true;
    this.guardian.add(shell, core);
    this.guardian.position.set(0, 22, -65);
    this.guardian.userData.landmarkId = "guardian-aerolith";
    this.scene.add(this.guardian);
    for (let i = 0; i < conductors.length; i++) {
      const c = conductors[i],
        m = new THREE.Mesh(
          new THREE.CylinderGeometry(0.65, 0.9, 3, 6),
          new THREE.MeshStandardMaterial({
            color: "#477482",
            emissive: "#163744",
            emissiveIntensity: 0.4,
            flatShading: true,
          }),
        );
      m.position.set(c.x, c.y + 1.5, c.z);
      m.userData.landmarkId = `conductor-${i + 1}`;
      this.scene.add(m);
      this.conductorMeshes.push(m);
    }
    this.crest = new THREE.Mesh(
      new THREE.TorusKnotGeometry(0.65, 0.18, 48, 6, 2, 3),
      new THREE.MeshStandardMaterial({
        color: "#ffe38a",
        emissive: "#e08032",
        emissiveIntensity: 1.2,
        flatShading: true,
      }),
    );
    this.crest.position.set(0, 23, -65);
    this.crest.visible = false;
    this.crest.userData.landmarkId = "windglass-crest";
    this.scene.add(this.crest);
  }
  private marker(label: string, x: number, y: number, z: number) {
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.09, 1.8, 5),
      new THREE.MeshStandardMaterial({ color: "#f3e6b0" }),
    );
    pole.position.set(x, y + 0.9, z);
    pole.userData.label = label;
    this.scene.add(pole);
  }
  private ground(x: number, z: number, previousY: number): Surface | undefined {
    let best: Surface | undefined;
    for (const p of pads) {
      const pos = p.mesh?.position ?? new THREE.Vector3(p.x, p.y, p.z),
        top = pos.y + (p.h ?? 1.4) / 2;
      if (
        Math.abs(x - pos.x) <= p.w / 2 + 0.38 &&
        Math.abs(z - pos.z) <= p.d / 2 + 0.38 &&
        top <= previousY + 0.9 &&
        (!best || top > best.y)
      ) {
        const velocity = p.last
          ? {
              x: (pos.x - p.last.x) * 60,
              y: (top - p.last.y) * 60,
              z: (pos.z - p.last.z) * 60,
            }
          : { x: 0, y: 0, z: 0 };
        best = {
          y: top,
          normal: { x: 0, y: 1, z: 0 },
          platform: p.motion ? p.name : undefined,
          velocity,
        };
      }
    }
    for (const s of slopes)
      if (
        Math.abs(x - s.x) <= s.w / 2 + 0.3 &&
        Math.abs(z - s.z) <= s.d / 2 + 0.3
      ) {
        const t = (z - (s.z - s.d / 2)) / s.d,
          y = s.y + s.rise * (1 - t),
          length = Math.hypot(s.d, s.rise);
        if (y <= previousY + 0.9 && (!best || y > best.y))
          best = { y, normal: { x: 0, y: s.d / length, z: s.rise / length } };
      }
    return best;
  }
  private wall(p: Vec3, v: Vec3) {
    const active = [...walls];
    if (this.run.phase === "beacons")
      active.push({ x: 0, z: -12, y: 8, w: 70, d: 0.8, h: 10 });
    if (this.run.phase !== "summit")
      active.push({ x: 0, z: -56, y: 24, w: 70, d: 0.8, h: 24 });
    for (const w of active)
      if (
        Math.abs(p.x - w.x) < w.w / 2 + 0.55 &&
        Math.abs(p.z - w.z) < w.d / 2 + 0.55 &&
        p.y > w.y - w.h &&
        p.y < w.y + 0.4
      ) {
        const nx =
          Math.abs(p.x - w.x) / (w.w / 2) > Math.abs(p.z - w.z) / (w.d / 2)
            ? Math.sign(p.x - w.x)
            : 0;
        return {
          normal: { x: nx, y: 0, z: nx ? 0 : Math.sign(p.z - w.z) },
          ledgeY: w.y,
        };
      }
    return undefined;
  }
  private updatePlatforms(dt: number) {
    this.elapsed += dt;
    for (const p of pads)
      if (p.motion && p.mesh && p.last) {
        p.last = {
          x: p.mesh.position.x,
          y: p.mesh.position.y + (p.h ?? 1.4) / 2,
          z: p.mesh.position.z,
        };
        const d =
          Math.sin(this.elapsed * p.motion.speed + p.motion.phase) *
          p.motion.range;
        p.mesh.position[p.motion.axis] =
          (p as unknown as Record<string, number>)[p.motion.axis] + d;
      }
  }
  private loop = (now: number) => {
    if (!this.running) return;
    const elapsed = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.accumulator += elapsed;
    this.run = reduceRun(this.run, { type: "tick", seconds: elapsed });
    const frame = this.poll();
    this.orbit(frame);
    while (this.accumulator >= 1 / 60) {
      this.updatePlatforms(1 / 60);
      const previousMove = this.state.state;
      const previousPosition = { ...this.state.position };
      this.state = stepPlayer(
        this.state,
        {
          move: frame.move,
          jumpPressed: frame.pressed.has("jump"),
          run: Math.hypot(frame.move.x, frame.move.y) > 0.72,
          crouch: frame.held.crouch,
          crouchPressed: frame.pressed.has("crouch"),
          divePressed: frame.pressed.has("dive"),
          cameraYaw: this.yaw,
          assist: this.settings.assist,
        },
        1 / 60,
        this.world,
      );
      if (
        this.state.grounded &&
        this.wall(this.state.position, this.state.velocity)
      ) {
        this.state.position.x = previousPosition.x;
        this.state.position.z = previousPosition.z;
        this.state.velocity.x = this.state.velocity.z = 0;
      }
      if (this.state.state === "hurt" && previousMove !== "hurt")
        this.applyDamage(1, {
          x: this.state.position.x,
          y: this.state.position.y,
          z: this.state.position.z + 1,
        });
      const encounter = stepEncounter(
        this.encounter,
        {
          player: this.state.position,
          playerVelocity: this.state.velocity,
          playerMove: this.state.state,
          phase: this.run.phase === "complete" ? "summit" : this.run.phase,
          assist: this.settings.assist,
        },
        1 / 60,
      );
      this.encounter = encounter.state;
      if (encounter.damage)
        this.applyDamage(
          this.settings.assist ? 1 : encounter.damage.amount,
          encounter.damage.source,
        );
      if (encounter.enemyDefeated)
        this.run = reduceRun(this.run, {
          type: "shard",
          id: `drop-${encounter.enemyDefeated}`,
        });
      if (this.encounter.health <= 0) this.recover(true);
      else if (this.state.state === "recover" && previousMove !== "recover")
        this.recover(false);
      this.accumulator -= 1 / 60;
      frame.pressed.clear();
    }
    this.collect();
    this.animateObjectives(now);
    this.syncEncounters(now);
    this.hero.position.set(
      this.state.position.x,
      this.state.position.y - 0.8,
      this.state.position.z,
    );
    this.hero.rotation.y = this.state.facing;
    this.hero.scale.y =
      this.state.state === "slide" || this.state.state === "dive" ? 0.65 : 1;
    this.hero.visible =
      this.encounter.invulnerable <= 0 || Math.floor(now / 90) % 2 === 0;
    this.placeCamera();
    this.renderer.render(this.scene, this.camera);
    this.emitRun();
    requestAnimationFrame(this.loop);
  };
  private collect() {
    for (const e of this.entities) {
      if (!e.mesh.visible || distance(this.state.position, e.position) > 1.35)
        continue;
      if (e.kind === "health") {
        const prior = this.encounter;
        this.encounter = heal(this.encounter, 2);
        if (this.encounter !== prior) {
          this.healthCollected.add(e.id);
          e.mesh.visible = false;
        }
        continue;
      }
      const prior = this.run;
      this.run = reduceRun(this.run, { type: e.kind, id: e.id });
      if (this.run !== prior) {
        if (e.kind === "beacon") this.lightBeacon(e);
        else e.mesh.visible = false;
        this.syncGates();
      }
    }
  }
  private applyDamage(amount: number, source: Vec3) {
    const prior = this.encounter;
    this.encounter = damage(this.encounter, amount);
    if (prior === this.encounter) return;
    const dx = this.state.position.x - source.x,
      dz = this.state.position.z - source.z,
      n = Math.max(0.01, Math.hypot(dx, dz));
    this.state.velocity = { x: (dx / n) * 7, y: 6, z: (dz / n) * 7 };
    this.state.grounded = false;
    this.state.state = "hurt";
    this.state.stun = this.settings.assist ? 0.3 : 0.55;
  }
  private recover(defeat = false) {
    this.state = initialPlayer(CHECKPOINTS[this.run.checkpoint]);
    this.state.state = "recover";
    this.state.stun = this.settings.assist ? 0.15 : 0.35;
    this.encounter = resetTransient(
      this.encounter,
      defeat && this.run.phase === "summit",
    );
    this.run = reduceRun(this.run, { type: "recover" });
    this.syncEntities();
  }
  private syncEntities() {
    for (const e of this.entities) {
      e.mesh.visible =
        e.kind === "health"
          ? !this.healthCollected.has(e.id)
          : e.kind === "beacon" ||
            (e.kind === "mote"
              ? !this.run.motes.includes(e.id)
              : !this.run.shards.includes(e.id));
      if (e.kind === "beacon" && this.run.beacons.includes(e.id))
        this.lightBeacon(e);
    }
    this.syncGates();
  }
  private lightBeacon(e: ObjectiveEntity) {
    e.mesh.scale.setScalar(1.18);
    e.mesh.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        const mat = o.material as THREE.MeshStandardMaterial;
        mat.emissive?.set("#8fffe5");
        mat.emissiveIntensity = 1.2;
      }
    });
  }
  private syncGates() {
    if (this.ascentGate) this.ascentGate.visible = this.run.phase === "beacons";
    if (this.summitGate) this.summitGate.visible = this.run.phase !== "summit";
  }
  private animateObjectives(now: number) {
    for (const e of this.entities)
      if (e.mesh.visible) {
        e.mesh.rotation.y = now * 0.0015;
        if (e.kind !== "beacon")
          e.mesh.position.y =
            e.position.y + Math.sin(now * 0.003 + e.position.x) * 0.14;
      }
  }
  private syncEncounters(now: number) {
    for (const e of this.encounter.enemies) {
      const m = this.enemyMeshes.get(e.id);
      if (!m) continue;
      m.visible = e.mode !== "defeated";
      m.position.set(
        e.position.x,
        e.position.y + (e.kind === "spitter" ? e.hop : 0),
        e.position.z,
      );
      m.scale.setScalar(
        e.mode === "telegraph" ? 1 + Math.sin(now * 0.03) * 0.12 : 1,
      );
    }
    if (this.guardian) {
      const g = this.encounter.guardian;
      this.guardian.visible =
        this.run.phase === "summit" && g.mode !== "defeated";
      this.guardian.position.set(g.position.x, g.position.y, g.position.z);
      this.guardian.rotation.y = now * 0.001 * (1 + g.hits);
      this.guardian.traverse((o) => {
        if (o instanceof THREE.Mesh && o.userData.core) {
          const mat = o.material as THREE.MeshStandardMaterial;
          mat.emissiveIntensity = g.mode === "exposed" ? 2.5 : 0.25;
          o.visible = g.mode === "exposed";
        }
      });
    }
    this.conductorMeshes.forEach((m, i) => {
      const mat = (m as THREE.Mesh).material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity =
        this.run.phase === "summit" &&
        i === this.encounter.guardian.enabledConductor
          ? 2
          : 0.25;
    });
    if (this.crest) {
      this.crest.visible =
        this.encounter.guardian.mode === "defeated" &&
        this.run.phase === "summit";
      this.crest.rotation.y = now * 0.002;
      if (
        this.crest.visible &&
        distance(this.state.position, { x: 0, y: 23, z: -65 }) < 1.8
      ) {
        this.run = reduceRun(this.run, { type: "complete" });
        this.running = false;
        this.input.clearAll();
      }
    }
  }
  private emitRun() {
    if (this.run.feedbackSerial !== this.lastFeedback) {
      this.lastFeedback = this.run.feedbackSerial;
      this.host.dataset.phase = this.run.phase;
    }
    const feedback =
      this.encounter.feedbackSerial !== this.lastEncounterFeedback
        ? ((this.lastEncounterFeedback = this.encounter.feedbackSerial),
          this.encounter.feedback)
        : this.run.feedback;
    this.onRun({
      objective: objectiveText(this.run),
      guidance: guidanceText(this.run),
      feedback,
      beacons: this.run.beacons.length,
      motes: this.run.motes.length,
      shards: this.run.shards.length,
      elapsed: this.run.elapsed,
      phase: this.run.phase,
      health: this.encounter.health,
      maxHealth: this.encounter.maxHealth,
      guardianHits: this.encounter.guardian.hits,
      complete: this.run.phase === "complete",
    });
  }
  private poll() {
    const p = (navigator.getGamepads?.() ?? [])[0];
    if (p) {
      this.input.setMove("gamepad", { x: dead(p.axes[0]), y: dead(p.axes[1]) });
      this.input.setCamera(
        "gamepad",
        { x: dead(p.axes[2]), y: dead(p.axes[3]) },
        performance.now(),
      );
      this.input.addZoom(
        ((p.buttons[7]?.value ?? 0) - (p.buttons[6]?.value ?? 0)) * 3,
      );
      for (const a of [
        "jump",
        "crouch",
        "dive",
        "recenter",
        "pause",
      ] as Action[])
        this.input.setButton(
          "gamepad",
          a,
          !!p.buttons[this.settings.gamepad[a]]?.pressed,
        );
    }
    const f = this.input.sample();
    if (f.pressed.has("pause")) this.onPause();
    return f;
  }
  private orbit(f: FrameInput) {
    if (f.pressed.has("recenter")) this.yaw = this.state.facing + Math.PI;
    const scale = 0.025 * this.settings.sensitivity;
    this.yaw -= f.camera.x * scale;
    this.pitch = Math.max(
      0.15,
      Math.min(
        1.15,
        this.pitch + f.camera.y * scale * (this.settings.invertY ? -1 : 1),
      ),
    );
    this.distance = Math.max(4, Math.min(13, this.distance + f.zoom * 0.008));
  }
  private placeCamera() {
    const target = new THREE.Vector3(
        this.state.position.x,
        this.state.position.y + 0.8,
        this.state.position.z,
      ),
      dir = new THREE.Vector3(
        Math.sin(this.yaw) * Math.cos(this.pitch),
        Math.sin(this.pitch),
        Math.cos(this.yaw) * Math.cos(this.pitch),
      ),
      ray = new THREE.Raycaster(target, dir, 0.2, this.distance),
      obstruction = ray
        .intersectObjects(this.cameraSolids.filter((solid) => solid.visible), false)
        .find((hit) => hit.distance > 0.3),
      safeDistance = obstruction
        ? Math.max(1.2, obstruction.distance - 0.35)
        : this.distance;
    this.cameraDistance +=
      (safeDistance - this.cameraDistance) *
      (safeDistance < this.cameraDistance ? 0.55 : 0.08);
    const desired = target.clone().addScaledVector(dir, this.cameraDistance);
    if (this.settings.reducedMotion) this.camera.position.copy(desired);
    else this.camera.position.lerp(desired, 0.22);
    this.camera.lookAt(target);
  }
  /** Test-only browser seam. The entry point exposes this only with ?test=1. */
  testTeleport(position: Vec3) {
    this.state.position = { ...position };
    this.state.velocity = { x: 0, y: 0, z: 0 };
    this.state.grounded = false;
    this.state.state = "fall";
  }
  testSnapshot() {
    return {
      position: { ...this.state.position },
      phase: this.run.phase,
      beacons: [...this.run.beacons],
      motes: [...this.run.motes],
      guardian: {
        mode: this.encounter.guardian.mode,
        hits: this.encounter.guardian.hits,
        position: { ...this.encounter.guardian.position },
        enabledConductor: this.encounter.guardian.enabledConductor,
      },
      cameraDistance: this.cameraDistance,
      paused: !this.running,
      input: this.input.snapshot(),
    };
  }
  private makeHero() {
    const g = new THREE.Group(),
      mat = new THREE.MeshStandardMaterial({
        color: "#f5e7a8",
        flatShading: true,
      }),
      accent = new THREE.MeshStandardMaterial({
        color: "#247986",
        flatShading: true,
      });
    const body = new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 1), mat);
    body.position.y = 0.65;
    const head = new THREE.Mesh(new THREE.DodecahedronGeometry(0.4, 0), accent);
    head.position.y = 1.45;
    const wing = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.8, 3), accent);
    wing.rotation.z = Math.PI / 2;
    wing.position.set(0, 0.8, 0.45);
    g.add(body, head, wing);
    g.traverse((o) => {
      if (o instanceof THREE.Mesh) o.castShadow = true;
    });
    return g;
  }
  private bind() {
    const keys = new Set<string>(),
      sync = () => {
        this.input.setMove("keyboard", {
          x:
            Number(keys.has("KeyD") || keys.has("ArrowRight")) -
            Number(keys.has("KeyA") || keys.has("ArrowLeft")),
          y:
            Number(keys.has("KeyS") || keys.has("ArrowDown")) -
            Number(keys.has("KeyW") || keys.has("ArrowUp")),
        });
        for (const a of [
          "jump",
          "crouch",
          "dive",
          "recenter",
          "pause",
        ] as Action[])
          this.input.setButton(
            "keyboard",
            a,
            keys.has(this.settings.keyboard[a]),
          );
      };
    addEventListener("keydown", (e) => {
      keys.add(e.code);
      sync();
      if (
        ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
          e.code,
        )
      )
        e.preventDefault();
    });
    addEventListener("keyup", (e) => {
      keys.delete(e.code);
      sync();
    });
    let drag = false,
      px = 0,
      py = 0;
    this.renderer.domElement.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse") {
        if (e.button === 0) this.input.setButton("mouse", "dive", true);
        drag = true;
        px = e.clientX;
        py = e.clientY;
        this.renderer.domElement.setPointerCapture(e.pointerId);
      }
    });
    this.renderer.domElement.addEventListener("pointermove", (e) => {
      if (drag) {
        this.input.setCamera("mouse", { x: e.clientX - px, y: e.clientY - py });
        px = e.clientX;
        py = e.clientY;
      }
    });
    this.renderer.domElement.addEventListener("pointerup", () => {
      drag = false;
      this.input.setButton("mouse", "dive", false);
    });
    this.renderer.domElement.addEventListener(
      "wheel",
      (e) => {
        this.input.addZoom(e.deltaY);
        e.preventDefault();
      },
      { passive: false },
    );
    addEventListener("gamepaddisconnected", () =>
      this.input.clearSource("gamepad"),
    );
    addEventListener("resize", () => this.resize());
  }
  resize() {
    const w = this.host.clientWidth,
      h = this.host.clientHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
}
const dead = (v = 0) => (Math.abs(v) < 0.16 ? 0 : v);
const distance = (a: Vec3, b: Vec3) =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
