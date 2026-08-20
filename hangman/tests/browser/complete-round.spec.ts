import { expect, test, type Page } from '@playwright/test';

const ALPHABET = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));

const secretWord = (page: Page) =>
  page.evaluate(
    () => (window as unknown as { __hangmanTest: { word: () => string } }).__hangmanTest.word(),
  );

/** Guesses `letter`, alternating between a real key press and clicking the on-screen key so both
 * input paths are exercised across a round. */
async function guessLetter(page: Page, letter: string, index: number): Promise<void> {
  if (index % 2 === 0) {
    await page.keyboard.press(letter);
  } else {
    await page.locator(`#keyboard button[data-letter="${letter}"]`).click();
  }
}

async function startRound(page: Page, tier: 'easy' | 'medium' | 'hard' = 'easy'): Promise<string> {
  await page.locator(`#tier-select input[value="${tier}"]`).check();
  await page.locator('#round-btn').click();
  await expect
    .poll(() => secretWord(page))
    .not.toBeNull();
  return (await secretWord(page)) as string;
}

test('plays a full round to a win via keyboard and on-screen keyboard', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/?test=1');
  await expect(page.locator('#scene-container canvas')).toBeVisible();

  const word = await startRound(page, 'easy');
  const distinctLetters = [...new Set(word.split(''))];

  for (const [index, letter] of distinctLetters.entries()) {
    await guessLetter(page, letter, index);
    await expect(page.getByTestId('attempts')).toHaveText('Remaining attempts: 6');
  }

  await expect(page.locator('#status')).toHaveText(`You won! The word was ${word}.`);
  await expect(page.locator('#status')).toHaveAttribute('data-outcome', 'won');
  await expect(page.getByTestId('word-display')).toHaveText(word.split('').join(' '));
  await expect(page.locator('#round-btn')).toHaveText('New round');

  expect(errors).toEqual([]);
});

test('plays a full round to a loss via keyboard and on-screen keyboard', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/?test=1');
  const word = await startRound(page, 'hard');
  const wrongLetters = ALPHABET.filter((letter) => !word.includes(letter)).slice(0, 6);
  expect(wrongLetters).toHaveLength(6);

  for (const [index, letter] of wrongLetters.entries()) {
    await guessLetter(page, letter, index);
    await expect(page.getByTestId('attempts')).toHaveText(`Remaining attempts: ${5 - index}`);
  }

  await expect(page.locator('#status')).toHaveText(`You lost. The word was ${word}.`);
  await expect(page.locator('#status')).toHaveAttribute('data-outcome', 'lost');
  await expect(page.getByTestId('word-display')).toHaveText(word.split('').join(' '));
  await expect(page.locator('#round-btn')).toHaveText('New round');

  expect(errors).toEqual([]);
});

test('switching presentation modes mid-round leaves round state unchanged', async ({ page }) => {
  await page.goto('/?test=1');
  const word = await startRound(page, 'medium');
  const distinctLetters = [...new Set(word.split(''))];

  // Guess a mix of right and (if available) wrong letters so guessed/attempts/word-display are
  // all non-trivial before switching modes.
  await guessLetter(page, distinctLetters[0]!, 0);
  const wrongLetter = ALPHABET.find((letter) => !word.includes(letter));
  if (wrongLetter) await guessLetter(page, wrongLetter, 1);

  const before = {
    word: await page.getByTestId('word-display').textContent(),
    attempts: await page.getByTestId('attempts').textContent(),
    guessed: await page.getByTestId('guessed').textContent(),
  };

  for (const mode of ['light', 'high-contrast', 'dark'] as const) {
    await page.locator(`[data-testid="mode-${mode}"]`).check();
    await expect(page.locator('html')).toHaveAttribute('data-mode', mode);
    await expect(page.getByTestId('word-display')).toHaveText(before.word!);
    await expect(page.getByTestId('attempts')).toHaveText(before.attempts!);
    await expect(page.getByTestId('guessed')).toHaveText(before.guessed!);
  }
});

test('a complete round emits no console errors in any presentation mode', async ({ page }) => {
  let errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));

  for (const mode of ['light', 'dark', 'high-contrast'] as const) {
    errors = [];
    await page.goto('/?test=1');
    await page.locator(`[data-testid="mode-${mode}"]`).check();

    const word = await startRound(page, 'easy');
    const wrongLetters = ALPHABET.filter((letter) => !word.includes(letter)).slice(0, 6);
    for (const [index, letter] of wrongLetters.entries()) {
      await guessLetter(page, letter, index);
    }
    await expect(page.locator('#status')).toHaveAttribute('data-outcome', 'lost');

    await page.locator('#round-btn').click();
    await expect(page.getByTestId('attempts')).toHaveText('Remaining attempts: 6');

    expect(errors, `console errors in ${mode} mode`).toEqual([]);
  }
});
