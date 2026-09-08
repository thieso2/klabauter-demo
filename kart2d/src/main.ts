import './style.css';
import { Game, type KartId, type RaceView } from './game';
import { InputState, attachInput } from './input';
import type { ItemType } from './items';
import { RACER_DESIGNS, aiDesignsFor, selectableDesigns } from './racers';
import { type RacerCupScore, computeCupStandings, scoreRace } from './scoring';
import { desertCanyon, harborCircuit, snowyMountain } from './track';
import type { Track } from './track';

const CUP: { track: Track; label: string }[] = [
  { track: desertCanyon, label: 'Desert Canyon Loop' },
  { track: snowyMountain, label: 'Snowy Mountain Switchback' },
  { track: harborCircuit, label: 'Nighttime Harbor Circuit' },
];
const root = document.querySelector<HTMLElement>('#app')!;
root.innerHTML = `
<section id="title" class="panel">
  <p class="eyebrow">An original top-down kart racer</p>
  <h1>Turbo Loop Cup</h1>
  <p>Race three tracks against three AI opponents for the cup.</p>
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
    <span id="held-item" class="held-item" data-testid="held-item" aria-label="No item held"></span>
  </div>
</section>
<section id="results" class="panel" hidden>
  <h2 id="results-heading" data-testid="results-heading">Race results</h2>
  <ol id="placements" data-testid="placements"></ol>
  <button id="continue" data-testid="continue">Continue</button>
</section>
<section id="champion" class="panel" hidden>
  <h2>Cup champion</h2>
  <ol id="standings" data-testid="standings"></ol>
  <button id="race-again" data-testid="race-again">Race again</button>
</section>
`;

const $ = <T extends HTMLElement>(selector: string) => root.querySelector<T>(selector)!;

const titleScreen = $('#title');
const racerSelectScreen = $('#racer-select');
const raceScreen = $('#race');
const resultsScreen = $('#results');
const championScreen = $('#champion');
const canvas = $<HTMLCanvasElement>('#race-canvas');
const lapCounter = $('#lap-counter');
const positionIndicator = $('#position-indicator');
const heldItemIndicator = $('#held-item');
const resultsHeading = $('#results-heading');
const placementsList = $('#placements');
const standingsList = $('#standings');
const continueButton = $<HTMLButtonElement>('#continue');

const ITEM_LABELS: Record<ItemType, string> = {
  boost: 'Speed Boost',
  projectile: 'Projectile',
  shield: 'Shield',
  hazard: 'Hazard',
};

const input = new InputState();
attachInput(window, input);

let game: Game | null = null;
let playerDesignId = '';
let namesByKartId: Record<KartId, string> = { player: '', 'ai-1': '', 'ai-2': '', 'ai-3': '' };
let raceIndex = 0;
let raceFinishOrders: KartId[][] = [];

const ORDINALS = ['1st', '2nd', '3rd', '4th'];
const ordinal = (rank: number) => ORDINALS[rank - 1] ?? `${rank}th`;

function showScreen(screen: HTMLElement) {
  for (const s of [titleScreen, racerSelectScreen, raceScreen, resultsScreen, championScreen]) s.hidden = s !== screen;
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
    button.addEventListener('click', () => startCup(design.id));
    container.appendChild(button);
  }
}

function startCup(playerDesignIdChoice: string) {
  playerDesignId = playerDesignIdChoice;
  const playerDesign = RACER_DESIGNS.find((d) => d.id === playerDesignId)!;
  const aiDesigns = aiDesignsFor(playerDesignId);
  namesByKartId = {
    player: playerDesign.name,
    'ai-1': aiDesigns[0].name,
    'ai-2': aiDesigns[1].name,
    'ai-3': aiDesigns[2].name,
  };
  raceIndex = 0;
  raceFinishOrders = [];
  startRace();
}

function startRace() {
  const playerDesign = RACER_DESIGNS.find((d) => d.id === playerDesignId)!;
  const aiDesigns = aiDesignsFor(playerDesignId);
  showScreen(raceScreen);
  game?.stop();
  game = new Game(canvas, CUP[raceIndex].track, playerDesign, [aiDesigns[0], aiDesigns[1], aiDesigns[2]], input, onView);
  game.start();
}

function onView(view: RaceView) {
  lapCounter.textContent = `Lap ${view.lap}/${view.totalLaps}`;
  positionIndicator.textContent = ordinal(view.position);
  heldItemIndicator.className = `held-item held-item--${view.heldItem ?? 'none'}`;
  heldItemIndicator.setAttribute('aria-label', view.heldItem ? `Holding ${ITEM_LABELS[view.heldItem]}` : 'No item held');
  if (view.finished && view.placements) showResults(view.placements);
}

function showResults(placements: { kartId: KartId; name: string }[]) {
  game?.stop();
  const finishOrder = placements.map((p) => p.kartId);
  raceFinishOrders.push(finishOrder);
  const racePoints = scoreRace(finishOrder);
  const runningTotals = computeCupStandings(raceFinishOrders);
  const totalById = new Map(runningTotals.map((s) => [s.racerId, s.total]));

  resultsHeading.textContent = `${CUP[raceIndex].label} — results`;
  placementsList.innerHTML = '';
  placements.forEach((placement, i) => {
    const li = document.createElement('li');
    li.dataset.testid = `placement-${i + 1}`;
    const you = placement.kartId === 'player' ? ' (You)' : '';
    li.textContent = `${ordinal(i + 1)} — ${placement.name}${you}: +${racePoints[placement.kartId]} pts (cup total ${totalById.get(placement.kartId)})`;
    placementsList.appendChild(li);
  });

  const isLastRace = raceIndex === CUP.length - 1;
  continueButton.textContent = isLastRace ? 'See champion' : 'Continue';
  showScreen(resultsScreen);
}

function showChampion() {
  const standings = computeCupStandings(raceFinishOrders);
  standingsList.innerHTML = '';
  standings.forEach((score, i) => {
    const li = document.createElement('li');
    li.dataset.testid = `standing-${i + 1}`;
    if (score.racerId === 'player') li.classList.add('you');
    const you = score.racerId === 'player' ? ' (You)' : '';
    li.textContent = `${ordinal(i + 1)} — ${nameFor(score)}${you}: ${score.total} pts`;
    standingsList.appendChild(li);
  });
  showScreen(championScreen);
}

function nameFor(score: RacerCupScore): string {
  return namesByKartId[score.racerId as KartId] ?? score.racerId;
}

$('#start').addEventListener('click', () => {
  renderRacerOptions();
  showScreen(racerSelectScreen);
});

continueButton.addEventListener('click', () => {
  if (raceIndex === CUP.length - 1) {
    showChampion();
  } else {
    raceIndex += 1;
    startRace();
  }
});

$('#race-again').addEventListener('click', () => {
  renderRacerOptions();
  showScreen(racerSelectScreen);
});

showScreen(titleScreen);
