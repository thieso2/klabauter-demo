import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MAX_STAGE, STAGE_NODE_NAMES, visibleNodesForStage } from './stage';

const MODEL_URL = `${import.meta.env.BASE_URL}models/blocky-character/character-a.glb`;
const TRANSITION_MS = 550;

export type PresentationMode = 'light' | 'dark' | 'high-contrast';

export const PRESENTATION_MODES: readonly PresentationMode[] = ['light', 'dark', 'high-contrast'];

interface ModeConfig {
  background: number;
  hemiSky: number;
  hemiGround: number;
  hemiIntensity: number;
  keyColor: number;
  keyIntensity: number;
  ground: number;
  timber: number;
  rope: number;
}

// Presentation modes only ever touch light colors/intensities and dressing-material colors, plus
// the scene clear color — never the loaded figure's geometry or the figure's own materials.
const MODE_CONFIG: Record<PresentationMode, ModeConfig> = {
  dark: {
    background: 0x0b1419,
    hemiSky: 0xdfeeff,
    hemiGround: 0x1a1410,
    hemiIntensity: 1.15,
    keyColor: 0xffffff,
    keyIntensity: 1.4,
    ground: 0x33473c,
    timber: 0x6b4a2c,
    rope: 0xcbb894,
  },
  light: {
    background: 0xeef3f4,
    hemiSky: 0xffffff,
    hemiGround: 0xc9d6da,
    hemiIntensity: 1.3,
    keyColor: 0xfff6e0,
    keyIntensity: 1.5,
    ground: 0x8fae9a,
    timber: 0x9c7148,
    rope: 0xe4d3ab,
  },
  'high-contrast': {
    background: 0x000000,
    hemiSky: 0xffffff,
    hemiGround: 0x000000,
    hemiIntensity: 1.6,
    keyColor: 0xffffff,
    keyIntensity: 2.2,
    ground: 0x222222,
    timber: 0xffe000,
    rope: 0xffffff,
  },
};

interface PartTransition {
  node: THREE.Object3D;
  start: number;
  from: THREE.Vector3;
  to: THREE.Vector3;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/** The 3D gallows + glTF figure scene. Stage is derived purely from wrong-guess count elsewhere
 * (see stage.ts) and applied here via `setStage`; this class owns only rendering. */
export class HangmanScene {
  private readonly container: HTMLElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly rig: THREE.Group;
  private readonly partNodes = new Map<string, THREE.Object3D>();
  private readonly partScale = new Map<string, THREE.Vector3>();
  private readonly transitions = new Map<string, PartTransition>();
  private readonly resizeObserver: ResizeObserver;
  private currentStage = 0;
  private pendingStage: number | null = null;
  private figureRoot: THREE.Object3D | null = null;
  private frame = 0;
  private disposed = false;
  private hemiLight!: THREE.HemisphereLight;
  private keyLight!: THREE.DirectionalLight;
  private groundMat!: THREE.MeshStandardMaterial;
  private timberMat!: THREE.MeshStandardMaterial;
  private ropeMat!: THREE.MeshStandardMaterial;

  constructor(container: HTMLElement, initialMode: PresentationMode = 'dark') {
    this.container = container;

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    this.camera.position.set(0, 2.5, 7);
    this.camera.lookAt(0, 1.8, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(this.renderer.domElement);

    this.rig = new THREE.Group();
    this.scene.add(this.rig);

    this.addLights();
    this.addDressing();
    this.setMode(initialMode);
    void this.loadFigure();

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();

    this.frame = requestAnimationFrame(this.tick);
  }

  private addLights(): void {
    this.hemiLight = new THREE.HemisphereLight(0xdfeeff, 0x1a1410, 1.15);
    this.scene.add(this.hemiLight);
    this.keyLight = new THREE.DirectionalLight(0xffffff, 1.4);
    this.keyLight.position.set(3, 6, 4);
    this.scene.add(this.keyLight);
  }

  private addDressing(): void {
    this.groundMat = new THREE.MeshStandardMaterial({ color: 0x33473c, roughness: 0.9 });
    const ground = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 0.3, 32), this.groundMat);
    ground.position.y = -0.15;
    this.rig.add(ground);

    this.timberMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2c, roughness: 0.8 });
    const upright = new THREE.Mesh(new THREE.BoxGeometry(0.22, 4.2, 0.22), this.timberMat);
    upright.position.set(-1.7, 2.1, -1.1);
    this.rig.add(upright);

    const beam = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.22, 0.22), this.timberMat);
    beam.position.set(-0.6, 4.05, -1.1);
    this.rig.add(beam);

    const brace = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 1.5), this.timberMat);
    brace.position.set(-1.25, 3.4, -1.1);
    brace.rotation.x = Math.PI / 4.4;
    this.rig.add(brace);

    this.ropeMat = new THREE.MeshStandardMaterial({ color: 0xcbb894, roughness: 0.7 });
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.1, 8), this.ropeMat);
    rope.position.set(0.5, 3.4, -1.1);
    this.rig.add(rope);
  }

  /** Applies a presentation mode: scene clear color, light colors/intensities, and dressing
   * material colors only. Never touches the loaded figure's own geometry/materials, never
   * reloads the glTF, and is independent of round state (§4 of the spec). */
  setMode(mode: PresentationMode): void {
    const cfg = MODE_CONFIG[mode];
    this.scene.background = new THREE.Color(cfg.background);
    this.hemiLight.color.setHex(cfg.hemiSky);
    this.hemiLight.groundColor.setHex(cfg.hemiGround);
    this.hemiLight.intensity = cfg.hemiIntensity;
    this.keyLight.color.setHex(cfg.keyColor);
    this.keyLight.intensity = cfg.keyIntensity;
    this.groundMat.color.setHex(cfg.ground);
    this.timberMat.color.setHex(cfg.timber);
    this.ropeMat.color.setHex(cfg.rope);
  }

  private async loadFigure(): Promise<void> {
    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync(MODEL_URL);
    if (this.disposed) return;

    const root = gltf.scene;
    root.scale.setScalar(1.5);
    root.position.set(0.5, 0, -1.1);

    root.traverse((object) => {
      if (STAGE_NODE_NAMES.includes(object.name)) {
        this.partNodes.set(object.name, object);
        this.partScale.set(object.name, object.scale.clone());
        object.visible = false;
        object.scale.setScalar(0);
      }
    });

    this.figureRoot = root;
    this.rig.add(root);

    const target = this.pendingStage ?? this.currentStage;
    this.applyStage(target, false);
  }

  /** Advances (or resets) the figure to `stage` (0-6). Animates newly-revealed parts unless
   * `animate` is false (used for the instant reset back to stage 0 on a new round). */
  setStage(stage: number, animate = true): void {
    const clamped = Math.max(0, Math.min(MAX_STAGE, Math.trunc(stage)));
    this.currentStage = clamped;
    if (!this.figureRoot) {
      this.pendingStage = clamped;
      return;
    }
    this.applyStage(clamped, animate);
  }

  private applyStage(stage: number, animate: boolean): void {
    const visible = new Set(visibleNodesForStage(stage));
    const now = performance.now();

    for (const [name, node] of this.partNodes) {
      const shouldShow = visible.has(name);
      if (shouldShow && !node.visible) {
        node.visible = true;
        const target = this.partScale.get(name)!;
        if (animate) {
          this.transitions.set(name, {
            node,
            start: now,
            from: new THREE.Vector3(0, 0, 0),
            to: target,
          });
        } else {
          this.transitions.delete(name);
          node.scale.copy(target);
        }
      } else if (!shouldShow && node.visible) {
        node.visible = false;
        node.scale.setScalar(0);
        this.transitions.delete(name);
      }
    }
  }

  private advanceTransitions(): void {
    if (this.transitions.size === 0) return;
    const now = performance.now();
    for (const [name, transition] of this.transitions) {
      const t = Math.min(1, (now - transition.start) / TRANSITION_MS);
      const eased = easeOutCubic(t);
      transition.node.scale.lerpVectors(transition.from, transition.to, eased);
      if (t >= 1) this.transitions.delete(name);
    }
  }

  private resize(): void {
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  private tick = (): void => {
    if (this.disposed) return;
    this.advanceTransitions();
    this.rig.rotation.y += 0.0015;
    this.renderer.render(this.scene, this.camera);
    this.frame = requestAnimationFrame(this.tick);
  };

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
