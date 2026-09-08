import { describe, expect, it } from 'vitest';
import { InputState } from './input';

describe('InputState', () => {
  it('reports steer axis from arrow keys and WASD equivalently', () => {
    const a = new InputState();
    a.handleKeyDown('ArrowLeft');
    expect(a.sample().steerAxis).toBe(-1);
    const b = new InputState();
    b.handleKeyDown('KeyD');
    expect(b.sample().steerAxis).toBe(1);
  });

  it('cancels opposing steer keys to zero', () => {
    const s = new InputState();
    s.handleKeyDown('ArrowLeft');
    s.handleKeyDown('ArrowRight');
    expect(s.sample().steerAxis).toBe(0);
  });

  it('reports accelerate and brake from arrows or WASD', () => {
    const s = new InputState();
    s.handleKeyDown('ArrowUp');
    s.handleKeyDown('KeyS');
    const frame = s.sample();
    expect(frame.accelerate).toBe(true);
    expect(frame.brake).toBe(true);
  });

  it('holds drift while Left Shift is down', () => {
    const s = new InputState();
    expect(s.sample().driftHeld).toBe(false);
    s.handleKeyDown('ShiftLeft');
    expect(s.sample().driftHeld).toBe(true);
    s.handleKeyUp('ShiftLeft');
    expect(s.sample().driftHeld).toBe(false);
  });

  it('reports itemPressed only once per key-down edge', () => {
    const s = new InputState();
    s.handleKeyDown('Space');
    expect(s.sample().itemPressed).toBe(true);
    expect(s.sample().itemPressed).toBe(false);
    s.handleKeyUp('Space');
    s.handleKeyDown('Space');
    expect(s.sample().itemPressed).toBe(true);
  });

  it('ignores untracked keys', () => {
    const s = new InputState();
    s.handleKeyDown('KeyQ');
    const frame = s.sample();
    expect(frame.steerAxis).toBe(0);
    expect(frame.accelerate).toBe(false);
  });

  it('clears all held state on window blur', () => {
    const s = new InputState();
    s.handleKeyDown('ArrowUp');
    s.handleKeyDown('ArrowRight');
    s.handleKeyDown('ShiftLeft');
    s.handleBlur();
    const frame = s.sample();
    expect(frame.accelerate).toBe(false);
    expect(frame.steerAxis).toBe(0);
    expect(frame.driftHeld).toBe(false);
  });
});
