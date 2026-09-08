import { expect, test } from '@playwright/test';

/**
 * Drives one race for real (keyboard input, live physics) to exercise input/movement/rendering,
 * then uses the ?test=1 seam to instantly complete each race — a full 3-lap race x 3 tracks would
 * take minutes of real driving, which this smoke test isn't meant to validate (unit tests cover
 * lap/finish logic in detail). What this test verifies is the screen wiring end to end.
 */
async function finishRace(page: import('@playwright/test').Page) {
  await page.evaluate(() => (window as unknown as { __turboLoopTest: { finishRace: () => void } }).__turboLoopTest.finishRace());
}

test('a full cup playthrough reaches the champion screen with no console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/?test=1');
  await page.getByTestId('start').click();

  const racerOptions = page.getByTestId('racer-option');
  await expect(racerOptions.first()).toBeVisible();
  await racerOptions.first().click();

  await expect(page.getByTestId('lap-counter')).toBeVisible();
  await expect(page.getByTestId('lap-counter')).toHaveText('Lap 1/3');
  await expect(page.getByTestId('position')).toBeVisible();
  // held-item is visibility:hidden while no item is held (held-item--none) — just confirm it's wired up.
  await expect(page.getByTestId('held-item')).toHaveAttribute('aria-label', 'No item held');

  // Real input, to exercise the actual game loop before short-circuiting to a result.
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(400);
  await page.keyboard.up('ArrowUp');

  await finishRace(page);
  await expect(page.getByTestId('results-heading')).toBeVisible();
  await expect(page.getByTestId('placement-1')).toBeVisible();
  await expect(page.getByTestId('continue')).toHaveText('Continue');
  await page.getByTestId('continue').click();

  await expect(page.getByTestId('lap-counter')).toHaveText('Lap 1/3');
  await finishRace(page);
  await expect(page.getByTestId('results-heading')).toBeVisible();
  await expect(page.getByTestId('continue')).toHaveText('Continue');
  await page.getByTestId('continue').click();

  await expect(page.getByTestId('lap-counter')).toHaveText('Lap 1/3');
  await finishRace(page);
  await expect(page.getByTestId('results-heading')).toBeVisible();
  await expect(page.getByTestId('continue')).toHaveText('See champion');
  await page.getByTestId('continue').click();

  await expect(page.getByTestId('standings')).toBeVisible();
  await expect(page.getByTestId('standing-1')).toBeVisible();
  await expect(page.getByTestId('standing-4')).toBeVisible();

  expect(errors).toEqual([]);
});
