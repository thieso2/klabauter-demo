import { expect, test, type Page } from "@playwright/test";
type Snapshot = {
  position: { x: number; y: number; z: number };
  phase: string;
  beacons: string[];
  motes: string[];
  guardian: {
    mode: string;
    hits: number;
    position: { x: number; y: number; z: number };
    enabledConductor: number;
  };
  paused: boolean;
  input: { move: { x: number; y: number }; held: Record<string, boolean> };
};
const conductors = [
  { x: -8, y: 21, z: -68 },
  { x: 8, y: 21, z: -68 },
  { x: 0, y: 21, z: -58 },
];
const api = (page: Page, method: "snapshot" | "teleport", arg?: unknown) =>
  page.evaluate(
    ({ method, arg }) => {
      const seam = (
        window as typeof window & {
          __galecrestTest: {
            snapshot: () => Snapshot;
            teleport: (p: unknown) => void;
          };
        }
      ).__galecrestTest;
      return method === "snapshot" ? seam.snapshot() : seam.teleport(arg);
    },
    { method, arg },
  ) as Promise<Snapshot>;
const teleport = (page: Page, p: { x: number; y: number; z: number }) =>
  api(page, "teleport", p);

type Waypoint = { x: number; y: number; z: number; hop?: boolean; reach?: number };
// This test never moves the camera, so its yaw stays at 0 and W is -z while D is +x.
const keysFor = (at: Snapshot["position"], to: Waypoint) => {
  const keys = new Set<string>();
  if (to.x - at.x > 0.35) keys.add("KeyD");
  else if (to.x - at.x < -0.35) keys.add("KeyA");
  if (to.z - at.z < -0.35) keys.add("KeyW");
  else if (to.z - at.z > 0.35) keys.add("KeyS");
  return keys;
};
/** Runs and jumps the player along a route using only real key events — never teleports. */
async function walk(page: Page, held: Set<string>, route: Waypoint[]) {
  for (const to of route) {
    const deadline = Date.now() + 25_000;
    let lastJump = 0,
      closest = Infinity,
      stalled = 0;
    for (;;) {
      const at = (await api(page, "snapshot")).position;
      const gap = Math.hypot(at.x - to.x, at.z - to.z);
      if (gap < (to.reach ?? 1.3) && Math.abs(at.y - to.y) < 2.5) break;
      if (Date.now() > deadline)
        throw new Error(
          `ran out of time walking to ${JSON.stringify(to)}; stopped at ${JSON.stringify(at)}`,
        );
      if (gap < closest - 0.15) {
        closest = gap;
        stalled = 0;
      } else stalled++;
      const want = keysFor(at, to);
      for (const key of [...held])
        if (!want.has(key)) {
          await page.keyboard.up(key);
          held.delete(key);
        }
      for (const key of want)
        if (!held.has(key)) {
          await page.keyboard.down(key);
          held.add(key);
        }
      // Jump to climb, to clear a gap, or to work loose when progress stops.
      if (
        (to.hop || to.y - at.y > 0.35 || stalled > 7) &&
        Date.now() - lastJump > 480
      ) {
        lastJump = Date.now();
        await page.keyboard.press("Space", { delay: 25 });
      }
      await page.waitForTimeout(45);
    }
  }
  for (const key of [...held]) {
    await page.keyboard.up(key);
    held.delete(key);
  }
}
test("real gates and encounter complete in the running browser game", async ({
  page,
}) => {
  const errors: string[] = [],
    external: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    const u = new URL(r.url());
    if (u.hostname !== "127.0.0.1") external.push(r.url());
  });
  await page.goto("/?test=1");
  await page.getByRole("button", { name: "Begin adventure" }).click();
  await expect
    .poll(() => page.evaluate(() => "__galecrestTest" in window))
    .toBe(true);
  await teleport(page, { x: 0, y: 2, z: -11 });
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(450);
  await page.keyboard.up("KeyW");
  expect((await api(page, "snapshot")).position.z).toBeGreaterThan(-12);
  await teleport(page, { x: 0, y: 19, z: -55 });
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(450);
  await page.keyboard.up("KeyW");
  expect((await api(page, "snapshot")).position.z).toBeGreaterThan(-56);
  for (const p of [
    { x: 17, y: 2.4, z: 6 },
    { x: -19, y: 2, z: 2 },
    { x: 0, y: 2.7, z: -10 },
  ]) {
    await teleport(page, p);
    await page.waitForTimeout(100);
  }
  await expect
    .poll(async () => (await api(page, "snapshot")).phase)
    .toBe("ascent");
  for (const p of [
    { x: -7, y: 4, z: -15 },
    { x: 2, y: 5.5, z: -19 },
    { x: 16, y: 8.4, z: -22 },
    { x: -6, y: 14, z: -34 },
    { x: 0, y: 20, z: -52 },
  ]) {
    await teleport(page, p);
    await page.waitForTimeout(100);
  }
  await expect
    .poll(async () => (await api(page, "snapshot")).phase)
    .toBe("summit");
  for (let hit = 1; hit <= 3; hit++) {
    // Bait the charge by standing on the armed conductor. Which one is armed advances when the
    // guardian finishes recovering, so re-place the player on each poll instead of reading it
    // once — a value sampled during 'recover' is the previous target, and the charge misses.
    await expect
      .poll(
        async () => {
          const s = await api(page, "snapshot");
          await teleport(page, conductors[s.guardian.enabledConductor]);
          return s.guardian.mode;
        },
        { timeout: 20_000 },
      )
      .toBe("exposed");
    const exposed = await api(page, "snapshot");
    await teleport(page, {
      x: exposed.guardian.position.x,
      y: exposed.guardian.position.y + 1,
      z: exposed.guardian.position.z,
    });
    // ShiftLeft is the crouch/ground-pound binding; pressing it in the air is a real attack.
    await page.keyboard.press("ShiftLeft");
    await expect
      .poll(async () => (await api(page, "snapshot")).guardian.hits)
      .toBe(hit);
  }
  await teleport(page, { x: 0, y: 23, z: -65 });
  await expect(page.getByTestId("completion")).toBeVisible();
  await expect(page.getByTestId("completion")).toContainText(/Time \d+:\d{2}/);
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
});
test("blur pauses and clears held browser input", async ({ page }) => {
  await page.goto("/?test=1");
  await page.getByRole("button", { name: "Begin adventure" }).click();
  await page.keyboard.down("KeyW");
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expect(page.getByRole("heading", { name: "Paused" })).toBeVisible();
  expect((await api(page, "snapshot")).paused).toBe(true);
  expect((await api(page, "snapshot")).input.move).toEqual({ x: 0, y: 0 });
  expect(Object.values((await api(page, "snapshot")).input.held)).not.toContain(true);
  await page.keyboard.up("KeyW");
});
test("the beacon route is completable with ordinary keyboard movement", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?test=1");
  await page.getByRole("button", { name: "Begin adventure" }).click();
  await expect
    .poll(() => page.evaluate(() => "__galecrestTest" in window))
    .toBe(true);
  // Nothing below teleports: the player runs and jumps the whole route on real key events.
  const held = new Set<string>();
  await walk(page, held, [
    { x: -6, y: 0.8, z: 5 },
    { x: -12, y: 1.1, z: 4, hop: true },
    { x: -19, y: 1.2, z: 2 },
  ]);
  await expect
    .poll(async () => (await api(page, "snapshot")).beacons.length)
    .toBe(1);
  await walk(page, held, [
    { x: -8, y: 1.1, z: 5 },
    { x: 0, y: 0.8, z: 5, hop: true },
    { x: 9, y: 1.5, z: 5, hop: true },
    { x: 17, y: 1.6, z: 6 },
  ]);
  await expect
    .poll(async () => (await api(page, "snapshot")).beacons.length)
    .toBe(2);
  await walk(page, held, [
    { x: 2, y: 0.8, z: 5 },
    { x: 0, y: 0.8, z: 3.5 },
    { x: 0, y: 1.8, z: -3, hop: true, reach: 2 },
    { x: 0, y: 1.9, z: -10 },
  ]);
  const woken = await api(page, "snapshot");
  expect(woken.beacons.length).toBe(3);
  // Waking all three is what opens the ascent gate, so the phase moved on through play alone.
  expect(woken.phase).toBe("ascent");
  // And the barrier that stopped ordinary movement at z=-12 above is now walkable.
  await walk(page, held, [{ x: -7, y: 2, z: -14, hop: true, reach: 2 }]);
  expect((await api(page, "snapshot")).position.z).toBeLessThan(-12.5);
  expect(errors).toEqual([]);
});
