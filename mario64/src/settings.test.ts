import { describe, expect, it } from "vitest";
import { defaults, loadSettings, remap, saveSettings } from "./settings";
describe("settings", () => {
  it("round trips through storage", () => {
    let value: string | null = null;
    const s = {
      getItem: () => value,
      setItem: (_: string, v: string) => {
        value = v;
      },
    };
    const changed = { ...structuredClone(defaults), invertY: true, touchSensitivity: 1.7 };
    expect(saveSettings(changed, s)).toBe(true);
    expect(loadSettings(s).invertY).toBe(true);
    expect(loadSettings(s).touchSensitivity).toBe(1.7);
  });
  it("falls back on corrupt or unavailable storage", () => {
    expect(loadSettings({ getItem: () => "{", setItem: () => {} })).toEqual(
      defaults,
    );
    expect(
      loadSettings({
        getItem: () => {
          throw Error();
        },
        setItem: () => {},
      }),
    ).toEqual(defaults);
  });
  it("rejects conflicts without unbinding required actions", () => {
    expect(new Set(Object.values(defaults.keyboard)).size).toBe(Object.keys(defaults.keyboard).length);
    expect(new Set(Object.values(defaults.gamepad)).size).toBe(Object.keys(defaults.gamepad).length);
    expect(remap(defaults.keyboard, "jump", "Escape")).toBeNull();
    expect(remap(defaults.keyboard, "jump", "KeyJ")?.jump).toBe("KeyJ");
  });
});
