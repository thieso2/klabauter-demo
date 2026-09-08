import './style.css';
import { Game, type KartId, type RaceView } from './game';
import { InputState, attachInput } from './input';
import { RACER_DESIGNS, aiDesignsFor, selectableDesigns } from './racers';
import { desertCanyon } from './track';

const root = document.querySelector<HTMLElement>('#app')!;
root.innerHTML = `
<section id="title" class="panel">
  <p class="eyebrow">An original top-down kart racer</p>
  <h1>Turbo Loop Cup</h1>
  <p>Race the desert canyon loop against three AI opponents.</p>
  <p class="controls-summary">Steer: Arrow keys or WASD &middot; Drift: Left Shift (hold) &middot; Item: Space</p>
  <button id="start" data-testid="start">Start</button>
</section>
<section id="racer-select" class="panel" hidden>
  <h2>Choose your racer</h2>
  <div id="racer-options" role="group" aria-label="Racer select"></div>
</section>
<section id="race" hidden>
  <canvas id="race-canvas" width="960" height="600" aria-label="Race view"></canvas>
  <div id="hud">
    <span id="lap-counter" data-testid="lap-counter">Lap 1/3</span>
    <span id="position-indicator" data-testid="position">1st</span>
  </div>
</section>
<section id="results" class="panel" hidden>
  <h2>Race results</h2>
  <ol id="placements" data-testid="placements"></ol>
  <button id="race-again" data-testid="race-again">Race again</button>
</section>
`;

const $ = <T extends HTMLElement>(selector: string) => root.querySelector<T>(selector)!;

const titleScreen = $('#title');
const racerSelectScreen = $('#racer-select');
const raceScreen = $('#race');
const resultsScreen = $('#results');
const canvas = $<HTMLCanvasElement>('#race-canvas');
const lapCounter = $('#lap-counter');
const positionIndicator = $('#position-indicator');
const placementsList = $('#placements');

const input = new InputState();
attachInput(window, input);

let game: Game | null = null;

const ORDINALS = ['1st', '2nd', '3rd', '4th'];
const ordinal = (rank: number) => ORDINALS[rank - 1] ?? `${rank}th`;

function showScreen(screen: HTMLElement) {
  for (const s of [titleScreen, racerSelectScreen, raceScreen, resultsScreen]) s.hidden = s !== screen;
}

function renderRacerOptions() {
  const container = $('#racer-options');
  container.innerHTML = '';
  for (const design of selectableDesigns()) {
    const button = document.createElement('button');
    button.className = 'racer-option';
    button.dataset.testid = 'racer-option';
    button.dataset.racerId = design.id;
    button.setAttribute('aria-label', `Choose ${design.name}`);
    button.style.setProperty('--racer-color', design.bodyColor);
    button.textContent = design.name;
    button.addEventListener('click', () => startRace(design.id));
    container.appendChild(button);
  }
}

function startRace(playerDesignId: string) {
  const playerDesign = RACER_DESIGNS.find((d) => d.id === playerDesignId)!;
  const aiDesigns = aiDesignsFor(playerDesignId);
  showScreen(raceScreen);
  game?.stop();
  game = new Game(canvas, desertCanyon, playerDesign, [aiDesigns[0], aiDesigns[1], aiDesigns[2]], input, onView);
  game.start();
}

function onView(view: RaceView) {
  lapCounter.textContent = `Lap ${view.lap}/${view.totalLaps}`;
  positionIndicator.textContent = ordinal(view.position);
  if (view.finished && view.placements) showResults(view.placements);
}

function showResults(placements: { kartId: KartId; name: string }[]) {
  game?.stop();
  placementsList.innerHTML = '';
  placements.forEach((placement, i) => {
    const li = document.createElement('li');
    li.dataset.testid = `placement-${i + 1}`;
    li.textContent = `${ordinal(i + 1)} — ${placement.name}${placement.kartId === 'player' ? ' (You)' : ''}`;
    placementsList.appendChild(li);
  });
  showScreen(resultsScreen);
}

$('#start').addEventListener('click', () => {
  renderRacerOptions();
  showScreen(racerSelectScreen);
});

$('#race-again').addEventListener('click', () => {
  renderRacerOptions();
  showScreen(racerSelectScreen);
});

showScreen(titleScreen);
