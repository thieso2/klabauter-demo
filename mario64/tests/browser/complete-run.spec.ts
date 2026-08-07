import { expect, test, type Page } from "@playwright/test";
type Snapshot = {
  position: { x: number; y: number; z: number };
  phase: string;
  guardian: {
    mode: string;
    hits: number;
    position: { x: number; y: number; z: number };
    enabledConductor: number;
  };
  paused: boolean;
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
    await expect
      .poll(async () => (await api(page, "snapshot")).guardian.mode)
      .toMatch(/telegraph|recover/);
    const before = await api(page, "snapshot");
    await teleport(page, conductors[before.guardian.enabledConductor]);
    await expect
      .poll(async () => (await api(page, "snapshot")).guardian.mode, {
        timeout: 8_000,
      })
      .toBe("exposed");
    const exposed = await api(page, "snapshot");
    await teleport(page, {
      x: exposed.guardian.position.x,
      y: exposed.guardian.position.y + 1,
      z: exposed.guardian.position.z,
    });
    await page.keyboard.press("ControlLeft");
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
  await page.keyboard.up("KeyW");
});
