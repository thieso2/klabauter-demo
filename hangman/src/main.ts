import './style.css';
import { MAX_ATTEMPTS, guess, revealedWord, startRound, type RoundState } from './game';
import { HangmanScene, type PresentationMode } from './scene';
import { stageFromWrongGuesses } from './stage';
import { TIERS, type Tier } from './words';

const DEFAULT_TIER: Tier = 'medium';
const DEFAULT_MODE: PresentationMode = 'dark';
const MODES: { value: PresentationMode; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'high-contrast', label: 'High Contrast' },
];

const root = document.querySelector<HTMLElement>('#app')!;
root.innerHTML = `
  <header>
    <h1>Hangman</h1>
    <div class="tier-select" id="tier-select" role="radiogroup" aria-label="Difficulty tier">
      ${TIERS.map(
        (tier) => `
        <label>
          <input type="radio" name="tier" value="${tier}" ${tier === DEFAULT_TIER ? 'checked' : ''} />
          <span>${tier[0]!.toUpperCase()}${tier.slice(1)}</span>
        </label>`,
      ).join('')}
    </div>
    <div class="mode-select" id="mode-select" role="radiogroup" aria-label="Presentation mode">
      ${MODES.map(
        (mode) => `
        <label>
          <input
            type="radio"
            name="mode"
            value="${mode.value}"
            data-testid="mode-${mode.value}"
            ${mode.value === DEFAULT_MODE ? 'checked' : ''}
          />
          <span>${mode.label}</span>
        </label>`,
      ).join('')}
    </div>
  </header>
  <main>
    <section id="scene-container" aria-label="3D hangman scene"></section>
    <section id="panel">
      <p id="status" role="status" aria-live="polite"></p>
      <p id="word-display" data-testid="word-display" aria-label="Word progress"></p>
      <p id="attempts" data-testid="attempts"></p>
      <p id="guessed" data-testid="guessed"></p>
      <div id="keyboard" role="group" aria-label="Letter keys"></div>
      <button id="round-btn" type="button">Start round</button>
    </section>
  </main>
`;

const sceneContainer = document.querySelector<HTMLElement>('#scene-container')!;
const statusEl = document.querySelector<HTMLElement>('#status')!;
const wordEl = document.querySelector<HTMLElement>('#word-display')!;
const attemptsEl = document.querySelector<HTMLElement>('#attempts')!;
const guessedEl = document.querySelector<HTMLElement>('#guessed')!;
const keyboardEl = document.querySelector<HTMLElement>('#keyboard')!;
const roundBtn = document.querySelector<HTMLButtonElement>('#round-btn')!;
const tierInputs = Array.from(
  document.querySelectorAll<HTMLInputElement>('#tier-select input[type="radio"]'),
);
const modeInputs = Array.from(
  document.querySelectorAll<HTMLInputElement>('#mode-select input[type="radio"]'),
);

const scene = new HangmanScene(sceneContainer);

const ALPHABET = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));
const keyButtons = new Map<string, HTMLButtonElement>();
for (const letter of ALPHABET) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = letter;
  button.dataset.letter = letter;
  button.addEventListener('click', () => applyGuess(letter));
  keyboardEl.appendChild(button);
  keyButtons.set(letter, button);
}

let round: RoundState | null = null;

function selectedTier(): Tier {
  return (tierInputs.find((input) => input.checked)?.value as Tier | undefined) ?? DEFAULT_TIER;
}

function applyGuess(letter: string): void {
  if (!round || round.status !== 'in-progress') return;
  const next = guess(round, letter);
  if (next === round) return;
  round = next;
  const wrongGuesses = MAX_ATTEMPTS - round.remaining;
  if (round.status !== 'in-progress' || wrongGuesses > 0) {
    scene.setStage(stageFromWrongGuesses(wrongGuesses));
  }
  render();
}

function beginRound(): void {
  round = startRound(selectedTier());
  scene.setStage(0, false);
  render();
}

function render(): void {
  const active = round !== null && round.status === 'in-progress';
  for (const input of tierInputs) input.disabled = active;

  if (!round) {
    statusEl.textContent = 'Choose a difficulty and start a round.';
    statusEl.removeAttribute('data-outcome');
    wordEl.textContent = '';
    attemptsEl.textContent = '';
    guessedEl.textContent = '';
    roundBtn.textContent = 'Start round';
    for (const button of keyButtons.values()) {
      button.className = '';
      button.disabled = true;
    }
    return;
  }

  wordEl.textContent = revealedWord(round).split('').join(' ');
  attemptsEl.textContent = `Remaining attempts: ${round.remaining}`;
  const guessedList = [...round.guessed].sort();
  guessedEl.textContent = guessedList.length ? `Guessed: ${guessedList.join(', ')}` : 'Guessed: —';

  for (const letter of ALPHABET) {
    const button = keyButtons.get(letter)!;
    const wasGuessed = round.guessed.has(letter);
    button.disabled = wasGuessed || round.status !== 'in-progress';
    button.className = wasGuessed ? (round.word.includes(letter) ? 'correct' : 'incorrect') : '';
  }

  if (round.status === 'won') {
    statusEl.textContent = 'You won! The word was ' + round.word + '.';
    statusEl.dataset.outcome = 'won';
    roundBtn.textContent = 'New round';
  } else if (round.status === 'lost') {
    statusEl.textContent = 'You lost. The word was ' + round.word + '.';
    statusEl.dataset.outcome = 'lost';
    roundBtn.textContent = 'New round';
  } else {
    statusEl.textContent = 'Guess a letter.';
    statusEl.removeAttribute('data-outcome');
    roundBtn.textContent = 'New round';
  }
}

function applyMode(mode: PresentationMode): void {
  document.documentElement.dataset.mode = mode;
  scene.setMode(mode);
}

roundBtn.addEventListener('click', beginRound);

// Presentation mode is always reachable and never touches round state (§4 of the spec) — no
// disabling during a round, no interaction with `round` at all.
for (const input of modeInputs) {
  input.addEventListener('change', () => {
    if (input.checked) applyMode(input.value as PresentationMode);
  });
}

window.addEventListener('keydown', (event) => {
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  const key = event.key;
  if (key.length !== 1) return;
  const letter = key.toUpperCase();
  if (letter < 'A' || letter > 'Z') return;
  applyGuess(letter);
});

applyMode(DEFAULT_MODE);
render();

// Test-only seam (mirrors mario64's `__galecrestTest`): exposes the secret word so the Playwright
// smoke test can script a deterministic win/loss route instead of guessing blind. Only wired up
// when the page is loaded with `?test=1`; never reachable in normal play.
if (new URLSearchParams(location.search).get('test') === '1') {
  (window as unknown as { __hangmanTest: { word: () => string | null } }).__hangmanTest = {
    word: () => round?.word ?? null,
  };
}
