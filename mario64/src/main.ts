import "./style.css";
import { Game } from "./game";
import {
  loadSettings,
  saveSettings,
  defaults,
  remap,
  type Settings,
} from "./settings";
import { Soundscape } from "./audio";
import type { Action } from "./input";
const root = document.querySelector<HTMLElement>("#app")!;
let settings = loadSettings(safeStorage());
let game: Game | undefined;
let playing = false;
root.innerHTML = `<section id="stage" aria-label="Galecrest Isle 3D play area"></section><header id="hud" hidden><div><strong id="objective" data-testid="objective">Wake the wind network · 0/3</strong><span id="guidance">Search the three foothill regions.</span><span id="run-stats" aria-label="Run statistics">◇ 0 optional shards · <time id="run-timer">0:00</time></span></div><p id="objective-feedback" role="status" aria-live="polite"></p><button id="pause" aria-label="Pause game">Ⅱ</button></header><section id="title" class="panel"><p class="eyebrow">An original wind-runner adventure</p><h1>Galecrest Isle</h1><p>Wake three beacons, gather ascent motes, and calm the summit guardian.</p><button id="start">Begin adventure</button><button id="controls-open" class="secondary">Controls & settings</button></section><section id="menu" class="panel" hidden><h2>Paused</h2><button id="resume">Resume</button><button id="controls-menu" class="secondary">Controls & settings</button><button id="restart-open" class="secondary">Restart run</button><button id="title-return" class="secondary">Return to title</button></section><dialog id="restart"><form method="dialog"><h2>Restart this run?</h2><p>Beacon, mote, shard, and guardian progress will be lost.</p><button value="cancel" class="secondary">Keep playing</button><button id="restart-confirm" value="confirm">Restart</button></form></dialog><dialog id="controls"><form method="dialog"><h2>Controls & settings</h2><p><b>Move:</b> keys · left stick · left touch pad<br><b>Camera:</b> mouse drag/wheel · right stick · right-side drag/pinch<br><b>Actions:</b> remappable below · touch buttons<br><b>Menus:</b> gamepad d-pad or left stick to highlight, left/right to adjust a slider or dropdown, A to confirm, Start for the first entry</p><fieldset><legend>Audio</legend><label>Master volume <input id="master" type="range" min="0" max="1" step=".05"></label><label>Music volume <input id="music" type="range" min="0" max="1" step=".05"></label><label>Effects volume <input id="effects" type="range" min="0" max="1" step=".05"></label></fieldset><fieldset><legend>Display and camera</legend><label>Quality <select id="quality"><option value="auto">Auto</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label><label>Camera sensitivity <input id="sensitivity" type="range" min=".4" max="2" step=".1"></label><label><input id="invert" type="checkbox"> Invert camera Y</label><label>Touch control size <input id="touch-scale" type="range" min=".75" max="1.35" step=".05"></label><label><input id="reduced" type="checkbox"> Reduced motion</label><label><input id="assist" type="checkbox"> Assist mode (less damage, more recovery time)</label></fieldset><fieldset><legend>Keyboard and gamepad bindings</legend><div id="bindings"></div><p id="binding-status" class="note" role="status"></p><button id="restore" type="button" class="secondary">Restore defaults</button></fieldset><button>Done</button></form></dialog><div id="touch" hidden><div id="stick" aria-label="Touch movement"><i></i></div><button id="touch-jump">Jump</button><button id="touch-pause" aria-label="Pause game">Ⅱ</button></div><aside id="rotate" hidden>Please rotate to landscape to play.</aside>`;
document
  .querySelector("#touch-jump")
  ?.insertAdjacentHTML(
    "afterend",
    '<button id="touch-action">Action</button><button id="touch-dive">Dive</button>',
  );
document
  .querySelector("#sensitivity")
  ?.parentElement?.insertAdjacentHTML(
    "afterend",
    '<label>Touch camera sensitivity <input id="touch-sensitivity" type="range" min=".4" max="2" step=".1"></label>',
  );
document
  .querySelector("#guidance")
  ?.insertAdjacentHTML(
    "afterend",
    '<span id="health" data-testid="health" aria-label="Health">◆◆◆◆◆◆</span>',
  );
document
  .querySelector("#menu")
  ?.insertAdjacentHTML(
    "afterend",
    '<section id="complete" class="panel" data-testid="completion" hidden><p class="eyebrow">Windglass Crest claimed</p><h2>Island calmed</h2><p id="complete-stats"></p></section>',
  );
const $ = <T extends HTMLElement>(s: string) => root.querySelector<T>(s)!;
const title = $("#title"),
  menu = $("#menu"),
  hud = $("#hud"),
  touch = $("#touch"),
  dialog = $<HTMLDialogElement>("#controls");
const sound = new Soundscape();
const actions: Action[] = [
  "jump",
  "crouch",
  "dive",
  "recenter",
  "pause",
];
let lastPhase = "beacons",
  lastHealth = 6;
function begin() {
  sound.start(settings);
  if (!game) {
    try {
      game = new Game($("#stage"), settings, pause, (view) => {
        const objective = $("#objective"),
          timer = $<HTMLTimeElement>("#run-timer");
        objective.textContent = view.objective;
        objective.dataset.phase = view.phase;
        $("#guidance").textContent = view.guidance;
        $("#objective-feedback").textContent = view.feedback;
        $("#health").textContent =
          "◆".repeat(view.health) + "◇".repeat(view.maxHealth - view.health);
        $("#health").setAttribute(
          "aria-label",
          `${view.health} of ${view.maxHealth} health`,
        );
        $("#run-stats").childNodes[0].textContent =
          `◇ ${view.shards} optional shards · `;
        const seconds = Math.floor(view.elapsed),
          time = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
        timer.textContent = time;
        timer.dateTime = `PT${seconds}S`;
        root.dataset.guardianHits = String(view.guardianHits);
        if (view.health < lastHealth) sound.cue("hurt");
        if (view.phase !== lastPhase)
          sound.cue(view.complete ? "complete" : "progress");
        lastHealth = view.health;
        lastPhase = view.phase;
        if (view.complete) {
          playing = false;
          hud.hidden = true;
          touch.hidden = true;
          $("#complete-stats").textContent =
            `Time ${time} · ${view.shards} optional shard${view.shards === 1 ? "" : "s"}`;
          $("#complete").hidden = false;
        }
      });
      if (new URLSearchParams(location.search).has("test"))
        (window as Window & { __galecrestTest?: unknown }).__galecrestTest = {
          teleport: (position: { x: number; y: number; z: number }) =>
            game?.testTeleport(position),
          snapshot: () => game?.testSnapshot(),
          input: game.input,
        };
    } catch {
      root.innerHTML =
        '<section class="panel error" role="alert"><h1>3D graphics unavailable</h1><p>WebGL could not start. Update your browser or graphics driver, then reload.</p></section>';
      return;
    }
  }
  title.hidden = true;
  menu.hidden = true;
  hud.hidden = false;
  touch.hidden = !matchMedia("(pointer: coarse)").matches;
  playing = true;
  game.resume();
  orientationCheck();
}
function pause() {
  if (!playing) return;
  playing = false;
  game?.stop();
  menu.hidden = false;
  touch.hidden = true;
}
function renderBindings() {
  const labels: Record<Action, string> = {
    jump: "Jump",
    crouch: "Crouch / pound",
    dive: "Dive",
    recenter: "Recenter camera",
    pause: "Pause",
  };
  $("#bindings").innerHTML = actions
    .map(
      (a) =>
        `<div class="binding"><span>${labels[a]}</span><button type="button" class="secondary key-bind" data-action="${a}" title="Press to change keyboard binding">${settings.keyboard[a]}</button><label>Pad <select class="pad-bind" data-action="${a}">${Array.from({ length: 16 }, (_, i) => `<option value="${i}" ${settings.gamepad[a] === i ? "selected" : ""}>${i}</option>`).join("")}</select></label></div>`,
    )
    .join("");
  root.querySelectorAll<HTMLButtonElement>(".key-bind").forEach(
    (button) =>
      (button.onclick = () => {
        button.textContent = "Press a key…";
        const action = button.dataset.action as Action;
        addEventListener(
          "keydown",
          (e) => {
            e.preventDefault();
            const next = remap(settings.keyboard, action, e.code);
            if (next) {
              settings.keyboard = next;
              $("#binding-status").textContent = `${action} is now ${e.code}.`;
            } else
              $("#binding-status").textContent =
                `${e.code} is already assigned. Choose another key.`;
            renderBindings();
          },
          { once: true },
        );
      }),
  );
  root.querySelectorAll<HTMLSelectElement>(".pad-bind").forEach(
    (select) =>
      (select.onchange = () => {
        const action = select.dataset.action as Action,
          next = remap(settings.gamepad, action, +select.value);
        if (next) {
          settings.gamepad = next;
          $("#binding-status").textContent =
            `${action} is now gamepad button ${select.value}.`;
        } else {
          $("#binding-status").textContent =
            `Button ${select.value} is already assigned.`;
          renderBindings();
        }
      }),
  );
}
function openControls() {
  for (const [id, value] of [
    ["#master", settings.masterVolume],
    ["#music", settings.musicVolume],
    ["#effects", settings.effectsVolume],
    ["#sensitivity", settings.sensitivity],
    ["#touch-sensitivity", settings.touchSensitivity],
    ["#touch-scale", settings.touchScale],
  ] as const)
    ($(id) as HTMLInputElement).value = String(value);
  ($("#quality") as HTMLSelectElement).value = settings.quality;
  ($("#invert") as HTMLInputElement).checked = settings.invertY;
  ($("#reduced") as HTMLInputElement).checked = settings.reducedMotion;
  ($("#assist") as HTMLInputElement).checked = settings.assist;
  renderBindings();
  dialog.showModal();
}
function save() {
  settings = {
    ...settings,
    masterVolume: +($("#master") as HTMLInputElement).value,
    musicVolume: +($("#music") as HTMLInputElement).value,
    effectsVolume: +($("#effects") as HTMLInputElement).value,
    quality: ($("#quality") as HTMLSelectElement).value as Settings["quality"],
    sensitivity: +($("#sensitivity") as HTMLInputElement).value,
    touchSensitivity: +($("#touch-sensitivity") as HTMLInputElement).value,
    invertY: ($("#invert") as HTMLInputElement).checked,
    touchScale: +($("#touch-scale") as HTMLInputElement).value,
    reducedMotion: ($("#reduced") as HTMLInputElement).checked,
    assist: ($("#assist") as HTMLInputElement).checked,
  };
  saveSettings(settings, safeStorage());
  root.style.setProperty("--touch-scale", String(settings.touchScale));
  game?.updateSettings(settings);
  sound.update(settings);
}
for (const id of ["#master", "#music", "#effects"])
  $(id).addEventListener("input", () => {
    save();
    sound.start(settings);
  });
$("#restore").onclick = () => {
  settings = structuredClone(defaults);
  dialog.close();
  queueMicrotask(openControls);
};
$("#start").onclick = begin;
$("#pause").onclick = pause;
$("#touch-pause").onclick = pause;
$("#resume").onclick = begin;
$("#controls-open").onclick = openControls;
$("#controls-menu").onclick = openControls;
dialog.addEventListener("close", save);
$("#restart-open").onclick = () => $<HTMLDialogElement>("#restart").showModal();
$("#restart-confirm").onclick = () => location.reload();
$("#title-return").onclick = () => {
  pause();
  menu.hidden = true;
  title.hidden = false;
  hud.hidden = true;
};
// A gamepad has to carry a player from the title screen through to completion on its own. The
// in-game normaliser only samples the pad while the simulation is running, so the menus poll it
// here: without this a controller can pause the game but cannot start, resume or leave it.
const padMenu = {
  focus: 0,
  held: [] as boolean[],
  axisAt: 0,
  panel(): HTMLElement | undefined {
    // A modal dialog sits on top of whatever opened it and owns the pad while it is open.
    const modal = [...document.querySelectorAll("dialog[open]")];
    if (modal.length) return modal[modal.length - 1] as HTMLElement;
    return [title, menu].find((p) => !p.hidden);
  },
  choices(): HTMLElement[] {
    const panel = this.panel();
    if (!panel) return [];
    return [
      ...panel.querySelectorAll<HTMLElement>("button, input, select"),
    ].filter((el) => !(el as HTMLInputElement).disabled);
  },
  panelShown: undefined as HTMLElement | undefined,
  mark(buttons: HTMLElement[]) {
    // Clear document-wide: a panel that just closed would otherwise keep a stale highlight.
    for (const stale of document.querySelectorAll(".pad-focus"))
      stale.classList.remove("pad-focus");
    buttons[this.focus]?.classList.add("pad-focus");
    buttons[this.focus]?.focus();
  },
};
/** Moves a range or select one step, mirroring what a mouse drag or keyboard arrow would do. */
function adjust(el: HTMLElement | undefined, direction: number) {
  if (el instanceof HTMLInputElement && el.type === "range") {
    const step = Number(el.step) || 0.05;
    const next = Math.min(
      Number(el.max),
      Math.max(Number(el.min), Number(el.value) + step * direction),
    );
    el.value = String(next);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  } else if (el instanceof HTMLSelectElement) {
    const next = el.selectedIndex + direction;
    if (next >= 0 && next < el.options.length) {
      el.selectedIndex = next;
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }
}
function pollMenuPad(now = 0) {
  requestAnimationFrame(pollMenuPad);
  const pad = (navigator.getGamepads?.() ?? [])[0];
  const panel = padMenu.panel();
  const buttons = padMenu.choices();
  if (panel !== padMenu.panelShown) {
    padMenu.panelShown = panel;
    padMenu.focus = 0;
    padMenu.mark(buttons);
  }
  if (!pad || !buttons.length) {
    // Remember what is already down, so the press that opened this menu is not read as a fresh
    // edge on the next frame and instantly activate the entry underneath it.
    padMenu.held = pad ? pad.buttons.map((b) => b.pressed) : [];
    return;
  }
  const pressed = (i: number) => !!pad.buttons[i]?.pressed;
  const edge = (i: number) => pressed(i) && !padMenu.held[i];
  const stickY = pad.axes[1] ?? 0;
  const stepped = now - padMenu.axisAt > 220;
  let move = 0;
  if (edge(13) || (stepped && stickY > 0.5)) move = 1;
  else if (edge(12) || (stepped && stickY < -0.5)) move = -1;
  if (move) {
    if (Math.abs(stickY) > 0.5) padMenu.axisAt = now;
    padMenu.focus = (padMenu.focus + move + buttons.length) % buttons.length;
    padMenu.mark(buttons);
  } else if (!buttons.some((b) => b.classList.contains("pad-focus"))) {
    padMenu.focus = Math.min(padMenu.focus, buttons.length - 1);
    padMenu.mark(buttons);
  }
  // Left/right adjust a highlighted slider or dropdown, so settings are reachable without a mouse.
  const stickX = pad.axes[0] ?? 0;
  let nudge = 0;
  if (edge(15) || (stepped && stickX > 0.5)) nudge = 1;
  else if (edge(14) || (stepped && stickX < -0.5)) nudge = -1;
  if (nudge) {
    if (Math.abs(stickX) > 0.5) padMenu.axisAt = now;
    adjust(buttons[padMenu.focus], nudge);
  }
  // A confirms the highlighted entry; Start is a shortcut for the panel's primary action.
  if (edge(0)) buttons[padMenu.focus]?.click();
  else if (edge(settings.gamepad.pause)) buttons[0]?.click();
  padMenu.held = pad.buttons.map((b) => b.pressed);
}
requestAnimationFrame(pollMenuPad);

let touchId = -1,
  sx = 0,
  sy = 0;
const stick = $("#stick");
stick.addEventListener("pointerdown", (e) => {
  touchId = e.pointerId;
  sx = e.clientX;
  sy = e.clientY;
  // Capture keeps the drag alive outside the pad, but the pointer may already be gone.
  try {
    stick.setPointerCapture(e.pointerId);
  } catch {
    /* pointer no longer active; the move/up handlers still work without capture */
  }
});
stick.addEventListener("pointermove", (e) => {
  if (e.pointerId === touchId) {
    const move = {
      x: Math.max(-1, Math.min(1, (e.clientX - sx) / 45)),
      y: Math.max(-1, Math.min(1, (e.clientY - sy) / 45)),
    };
    game?.input.setMove("touch", move);
  }
});
const clearTouch = () => {
  touchId = -1;
  // Only the movement vector belongs to this touch. Clearing the whole touch source would drop a
  // jump or camera touch that another finger is still holding.
  game?.input.setMove("touch", { x: 0, y: 0 });
};
stick.addEventListener("pointerup", clearTouch);
stick.addEventListener("pointercancel", clearTouch);
$("#touch-jump").addEventListener("pointerdown", () =>
  game?.input.setButton("touch", "jump", true),
);
const releaseJump = () => game?.input.setButton("touch", "jump", false);
$("#touch-jump").addEventListener("pointerup", releaseJump);
// A cancelled touch never sends pointerup, so without this the jump stays held down.
$("#touch-jump").addEventListener("pointercancel", releaseJump);
const stage = $("#stage");
let camId = -1,
  cx = 0,
  cy = 0,
  lastTap = 0;
const cameraTouches = new Map<number, { x: number; y: number }>();
let pinch = 0;
stage.addEventListener("pointerdown", (e) => {
  if (e.pointerType === "touch" && e.clientX > innerWidth * 0.42) {
    const now = performance.now();
    if (now - lastTap < 320) game?.input.setButton("touch", "recenter", true);
    lastTap = now;
    camId = e.pointerId;
    cx = e.clientX;
    cy = e.clientY;
    cameraTouches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (cameraTouches.size === 2) pinch = touchDistance(cameraTouches);
  }
});
stage.addEventListener("pointermove", (e) => {
  if (cameraTouches.has(e.pointerId)) {
    cameraTouches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (cameraTouches.size === 2) {
      const next = touchDistance(cameraTouches);
      game?.input.addZoom((pinch - next) * 0.8);
      pinch = next;
    } else if (e.pointerId === camId) {
      game?.input.setCamera("touch", {
        x: (e.clientX - cx) * settings.touchSensitivity,
        y: (e.clientY - cy) * settings.touchSensitivity,
      });
      cx = e.clientX;
      cy = e.clientY;
    }
  }
});
const endCamera = (e: PointerEvent) => {
  cameraTouches.delete(e.pointerId);
  // Only the finger that started the recenter tap may end it; another finger lifting must not.
  if (e.pointerId === camId) {
    camId = -1;
    game?.input.setButton("touch", "recenter", false);
  }
};
stage.addEventListener("pointerup", endCamera);
stage.addEventListener("pointercancel", endCamera);
function orientationCheck() {
  const portrait =
    innerHeight > innerWidth && matchMedia("(pointer: coarse)").matches;
  $("#rotate").hidden = !portrait;
  if (portrait) pause();
}
addEventListener("resize", orientationCheck);
addEventListener("blur", pause);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) pause();
});
function safeStorage() {
  try {
    return localStorage;
  } catch {
    return undefined;
  }
}
function touchDistance(points: Map<number, { x: number; y: number }>) {
  const [a, b] = [...points.values()];
  return Math.hypot(a.x - b.x, a.y - b.y);
}
for (const [id, action] of [
  ["#touch-action", "crouch"],
  ["#touch-dive", "dive"],
] as const) {
  $(id).addEventListener("pointerdown", () =>
    game?.input.setButton("touch", action, true),
  );
  $(id).addEventListener("pointerup", () =>
    game?.input.setButton("touch", action, false),
  );
  $(id).addEventListener("pointercancel", () =>
    game?.input.setButton("touch", action, false),
  );
}
