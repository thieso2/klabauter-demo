export type Source = 'keyboard' | 'mouse' | 'gamepad' | 'touch';
export type Action = 'jump' | 'run' | 'crouch' | 'dive' | 'recenter' | 'pause';
export interface Vec2 { x: number; y: number }
export interface FrameInput { move: Vec2; camera: Vec2; zoom: number; held: Record<Action, boolean>; pressed: Set<Action>; released: Set<Action> }
const actions: Action[] = ['jump', 'run', 'crouch', 'dive', 'recenter', 'pause'];
const zeroActions = () => Object.fromEntries(actions.map(a => [a, false])) as Record<Action, boolean>;

export class InputNormalizer {
  private moves = new Map<Source, Vec2>();
  private cameras = new Map<Source, { value: Vec2; at: number }>();
  private buttons = new Map<Source, Record<Action, boolean>>();
  private previous = zeroActions();
  private wheel = 0;

  setMove(source: Source, value: Vec2) { this.moves.set(source, clamp(value)); }
  setCamera(source: Source, value: Vec2, at = performance.now()) { if (value.x || value.y) this.cameras.set(source, { value, at }); }
  addZoom(delta: number) { this.wheel += delta; }
  setButton(source: Source, action: Action, held: boolean) {
    const state = this.buttons.get(source) ?? zeroActions(); state[action] = held; this.buttons.set(source, state);
  }
  clearSource(source: Source) { this.moves.delete(source); this.cameras.delete(source); this.buttons.delete(source); }
  clearAll() { this.moves.clear(); this.cameras.clear(); this.buttons.clear(); this.previous = zeroActions(); this.wheel = 0; }
  sample(): FrameInput {
    const move = strongest([...this.moves.values()]);
    const latest = [...this.cameras.values()].sort((a,b) => b.at-a.at)[0];
    const held = zeroActions();
    for (const state of this.buttons.values()) for (const action of actions) held[action] ||= state[action];
    const pressed = new Set<Action>(), released = new Set<Action>();
    for (const action of actions) { if (held[action] && !this.previous[action]) pressed.add(action); if (!held[action] && this.previous[action]) released.add(action); }
    this.previous = { ...held }; const zoom = this.wheel; this.wheel = 0;
    for (const source of this.cameras.keys()) this.cameras.set(source, { value: {x:0,y:0}, at: this.cameras.get(source)!.at });
    return { move, camera: latest?.value ?? {x:0,y:0}, zoom, held, pressed, released };
  }
}

function strongest(values: Vec2[]): Vec2 {
  let x = 0, y = 0;
  for (const value of values) { if (Math.abs(value.x) > Math.abs(x)) x = value.x; else if (Math.abs(value.x) === Math.abs(x) && Math.sign(value.x) !== Math.sign(x)) x = 0; if (Math.abs(value.y) > Math.abs(y)) y = value.y; else if (Math.abs(value.y) === Math.abs(y) && Math.sign(value.y) !== Math.sign(y)) y = 0; }
  return clamp({x,y});
}
function clamp(v: Vec2): Vec2 { const length = Math.hypot(v.x,v.y); return length > 1 ? {x:v.x/length,y:v.y/length} : {...v}; }
