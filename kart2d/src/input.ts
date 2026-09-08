export interface FrameInput {
  steerAxis: number; // -1 (left) .. 1 (right)
  accelerate: boolean;
  brake: boolean;
  driftHeld: boolean;
  itemPressed: boolean;
}

const STEER_LEFT = new Set(['ArrowLeft', 'KeyA']);
const STEER_RIGHT = new Set(['ArrowRight', 'KeyD']);
const ACCELERATE = new Set(['ArrowUp', 'KeyW']);
const BRAKE = new Set(['ArrowDown', 'KeyS']);
const DRIFT = new Set(['ShiftLeft']);
const ITEM = new Set(['Space']);
const TRACKED = new Set([...STEER_LEFT, ...STEER_RIGHT, ...ACCELERATE, ...BRAKE, ...DRIFT, ...ITEM]);

/** Normalizes raw keyboard events into a per-frame held-state snapshot. */
export class InputState {
  private held = new Set<string>();
  private itemPressedThisFrame = false;

  handleKeyDown(code: string) {
    if (!TRACKED.has(code)) return;
    if (ITEM.has(code) && !this.held.has(code)) this.itemPressedThisFrame = true;
    this.held.add(code);
  }

  handleKeyUp(code: string) {
    this.held.delete(code);
  }

  /** Losing window focus must not leave a kart accelerating/turning forever. */
  handleBlur() {
    this.held.clear();
    this.itemPressedThisFrame = false;
  }

  sample(): FrameInput {
    let steerAxis = 0;
    if (this.hasAny(STEER_LEFT)) steerAxis -= 1;
    if (this.hasAny(STEER_RIGHT)) steerAxis += 1;
    const frame: FrameInput = {
      steerAxis,
      accelerate: this.hasAny(ACCELERATE),
      brake: this.hasAny(BRAKE),
      driftHeld: this.hasAny(DRIFT),
      itemPressed: this.itemPressedThisFrame,
    };
    this.itemPressedThisFrame = false;
    return frame;
  }

  private hasAny(codes: Set<string>) {
    for (const code of codes) if (this.held.has(code)) return true;
    return false;
  }
}

export function attachInput(target: Window, state: InputState) {
  const onKeyDown = (e: KeyboardEvent) => state.handleKeyDown(e.code);
  const onKeyUp = (e: KeyboardEvent) => state.handleKeyUp(e.code);
  const onBlur = () => state.handleBlur();
  target.addEventListener('keydown', onKeyDown);
  target.addEventListener('keyup', onKeyUp);
  target.addEventListener('blur', onBlur);
  return () => {
    target.removeEventListener('keydown', onKeyDown);
    target.removeEventListener('keyup', onKeyUp);
    target.removeEventListener('blur', onBlur);
  };
}
