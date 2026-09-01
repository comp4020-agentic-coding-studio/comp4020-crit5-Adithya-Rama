import { RideAudio } from "./game/audio.ts";
import { InputController } from "./game/input.ts";
import {
  RUN_DURATION_SECONDS,
  advanceRun,
  difficultyAt,
  applyNearMiss,
  crashRun,
  initialRun,
} from "./game/rules.ts";
import { GameScene } from "./game/scene.ts";

const root = required<HTMLElement>("#game");
const canvas = required<HTMLCanvasElement>("#road");
const scoreOutput = required<HTMLElement>("#score");
const timeOutput = required<HTMLElement>("#time");
const speedOutput = required<HTMLElement>("#speed");
const speedometer = required<HTMLElement>("#speedometer");
const progressFill = required<HTMLElement>("#run-progress-fill");
const rewardOutput = required<HTMLOutputElement>("#reward");
const endPanel = required<HTMLElement>("#end-panel");
const finalScore = required<HTMLElement>("#final-score");
const ending = required<HTMLElement>("#ending");
const restartButton = required<HTMLButtonElement>("#restart");
const pauseButton = required<HTMLButtonElement>("#pause");
const audioButton = required<HTMLButtonElement>("#audio");

const world = new GameScene(canvas);
const audio = new RideAudio();
let run = initialRun();
let started = false;
let paused = false;
let ended = false;
let lastFrame = performance.now();
let rewardTimer = 0;
let displaySpeed = 0;

const input = new InputController(root, () => {
  if (!started && run.state === "playing") {
    started = true;
    root.classList.add("is-running");
  }
  void audio.start();
});

pauseButton.addEventListener("click", () => {
  if (!started || run.state !== "playing") return;
  setPaused(!paused);
});

audioButton.addEventListener("click", () => {
  void audio.start();
  const muted = audio.toggle();
  audioButton.classList.toggle("is-muted", muted);
});

restartButton.addEventListener("click", () => {
  run = initialRun();
  started = false;
  paused = false;
  ended = false;
  displaySpeed = 0;
  root.dataset.gameState = "playing";
  root.dataset.paused = "false";
  root.classList.remove(
    "is-running",
    "is-paused",
    "is-ended",
    "is-crashed",
    "is-finished",
  );
  pauseButton.classList.remove("is-paused");
  pauseButton.setAttribute("aria-label", "Pause ride");
  endPanel.hidden = true;
  audio.setPaused(false);
  world.reset();
  showReward("");
});

window.addEventListener("resize", () => world.resize());
document.addEventListener("visibilitychange", () => {
  if (document.hidden && started && run.state === "playing") setPaused(true);
});

function frame(now: number): void {
  const frameDelta = Math.min(0.05, Math.max(0, (now - lastFrame) / 1000));
  lastFrame = now;
  const deltaSeconds = paused ? 0 : frameDelta;
  const steering = input.sample(now);
  const difficulty = difficultyAt(run.elapsed);
  const activelyRiding = started && run.state === "playing" && !paused;
  const targetSpeed = activelyRiding
    ? difficulty.worldSpeed * 4.65
    : paused
      ? displaySpeed
      : 0;
  displaySpeed +=
    (targetSpeed - displaySpeed) * Math.min(1, deltaSeconds * 2.8);
  const events = world.update(
    deltaSeconds,
    run.elapsed,
    steering.value,
    activelyRiding,
    run.state === "crashed",
  );

  if (activelyRiding) {
    if (events.collision) {
      run = crashRun(run);
      audio.crash();
    } else {
      for (let index = 0; index < events.nearMisses; index += 1) {
        run = applyNearMiss(run);
      }
      if (events.nearMisses > 0) {
        const reward = events.thread ? "THREAD" : "CLOSE";
        showReward(`${reward}  ×${run.multiplier.toFixed(1)}`);
        audio.nearMiss(events.thread);
      }
      const speed = difficulty.worldSpeed;
      run = advanceRun(run, deltaSeconds, speed);
      audio.update((speed - 12) / 40, steering.value);
    }
  } else if (!paused && run.state === "playing") {
    audio.update(0.08, steering.value);
  }

  if (run.state !== "playing" && !ended) settleRun();
  updateHud();
  requestAnimationFrame(frame);
}

function setPaused(nextPaused: boolean): void {
  if (!started || run.state !== "playing") return;
  paused = nextPaused;
  root.dataset.paused = String(paused);
  root.classList.toggle("is-paused", paused);
  pauseButton.classList.toggle("is-paused", paused);
  pauseButton.setAttribute("aria-label", paused ? "Resume ride" : "Pause ride");
  audio.setPaused(paused);
  lastFrame = performance.now();
}

function settleRun(): void {
  ended = true;
  paused = false;
  root.dataset.gameState = run.state;
  root.dataset.paused = "false";
  root.classList.remove("is-paused");
  root.classList.add("is-ended", `is-${run.state}`);
  pauseButton.classList.remove("is-paused");
  pauseButton.setAttribute("aria-label", "Pause ride");
  ending.textContent = run.state === "finished" ? "FINISH" : "CRASHED";
  finalScore.textContent = formatScore(run.score);
  endPanel.hidden = false;

  try {
    const previousBest = Number.parseInt(
      localStorage.getItem("handshift-best") ?? "0",
      10,
    );
    if (Math.floor(run.score) > previousBest) {
      localStorage.setItem("handshift-best", String(Math.floor(run.score)));
    }
  } catch {
    // Storage is optional; a blocked browser setting must not break the run.
  }
}

function updateHud(): void {
  scoreOutput.textContent = formatScore(run.score);
  const remaining = Math.max(0, Math.ceil(RUN_DURATION_SECONDS - run.elapsed));
  timeOutput.textContent =
    `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`;
  speedOutput.textContent = String(Math.round(displaySpeed)).padStart(3, "0");
  const speedRatio = Math.max(0, Math.min(1, displaySpeed / 245));
  speedometer.style.setProperty("--speed-angle", `${speedRatio * 250}deg`);
  speedometer.style.setProperty("--speed-ratio", String(speedRatio));
  progressFill.style.transform =
    `scaleX(${Math.min(1, run.elapsed / RUN_DURATION_SECONDS)})`;
}

function showReward(label: string): void {
  window.clearTimeout(rewardTimer);
  rewardOutput.textContent = label;
  rewardOutput.classList.toggle("is-visible", label.length > 0);
  if (label) {
    rewardTimer = window.setTimeout(() => {
      rewardOutput.classList.remove("is-visible");
    }, 820);
  }
}

function formatScore(value: number): string {
  return Math.floor(value).toString().padStart(6, "0");
}

function required<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing required element: ${selector}`);
  return element;
}

requestAnimationFrame(frame);
