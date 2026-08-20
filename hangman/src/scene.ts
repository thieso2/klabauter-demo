import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MAX_STAGE, STAGE_NODE_NAMES, visibleNodesForStage } from './stage';

const MODEL_URL = `${import.meta.env.BASE_URL}models/blocky-character/character-a.glb`;
const TRANSITION_MS = 550;

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

  constructor(container: HTMLElement) {
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
    void this.loadFigure();

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();

    this.frame = requestAnimationFrame(this.tick);
  }

  private addLights(): void {
    this.scene.add(new THREE.HemisphereLight(0xdfeeff, 0x1a1410, 1.15));
    const key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(3, 6, 4);
    this.scene.add(key);
  }

  private addDressing(): void {
    const ground = new THREE.Mesh(
      new THREE.CylinderGeometry(3.2, 3.2, 0.3, 32),
      new THREE.MeshStandardMaterial({ color: 0x33473c, roughness: 0.9 }),
    );
    ground.position.y = -0.15;
    this.rig.add(ground);

    const timber = new THREE.MeshStandardMaterial({ color: 0x6b4a2c, roughness: 0.8 });
    const upright = new THREE.Mesh(new THREE.BoxGeometry(0.22, 4.2, 0.22), timber);
    upright.position.set(-1.7, 2.1, -1.1);
    this.rig.add(upright);

    const beam = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.22, 0.22), timber);
    beam.position.set(-0.6, 4.05, -1.1);
    this.rig.add(beam);

    const brace = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 1.5), timber);
    brace.position.set(-1.25, 3.4, -1.1);
    brace.rotation.x = Math.PI / 4.4;
    this.rig.add(brace);

    const rope = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 1.1, 8),
      new THREE.MeshStandardMaterial({ color: 0xcbb894, roughness: 0.7 }),
    );
    rope.position.set(0.5, 3.4, -1.1);
    this.rig.add(rope);
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
