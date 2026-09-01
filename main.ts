import { RideAudio } from "./game/audio.ts";
import { PalmCamera } from "./game/camera.ts";
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
const multiplierOutput = required<HTMLElement>("#multiplier");
const speedOutput = required<HTMLElement>("#speed");
const progressFill = required<HTMLElement>("#run-progress-fill");
const rewardOutput = required<HTMLOutputElement>("#reward");
const endPanel = required<HTMLElement>("#end-panel");
const finalScore = required<HTMLElement>("#final-score");
const ending = required<HTMLElement>("#ending");
const restartButton = required<HTMLButtonElement>("#restart");
const cameraButton = required<HTMLButtonElement>("#camera");
const cameraPreview = required<HTMLVideoElement>("#camera-preview");
const audioButton = required<HTMLButtonElement>("#audio");
const handTrace = required<HTMLCanvasElement>("#hand-trace");
const handContext = handTrace.getContext("2d");

const world = new GameScene(canvas);
const audio = new RideAudio();
let run = initialRun();
let started = false;
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

const palmCamera = new PalmCamera(
  cameraPreview,
  (sample, landmarks) => {
    input.setCameraSample(sample);
    drawHand(landmarks);
    cameraButton.style.setProperty("--hand-roll", `${sample.value * 24}deg`);
  },
  (state, reason) => {
    root.dataset.cameraState = state;
    cameraButton.dataset.cameraState = state;
    cameraButton.classList.toggle("is-active", state === "ready");
    cameraButton.dataset.cameraError = reason ?? "";
    if (state === "error") drawHand([]);
  },
);

cameraButton.addEventListener("click", () => {
  void audio.start();
  void palmCamera.start();
});

audioButton.addEventListener("click", () => {
  void audio.start();
  const muted = audio.toggle();
  audioButton.classList.toggle("is-muted", muted);
});

restartButton.addEventListener("click", () => {
  run = initialRun();
  started = false;
  ended = false;
  displaySpeed = 0;
  root.dataset.gameState = "playing";
  root.classList.remove("is-running", "is-ended", "is-crashed", "is-finished");
  endPanel.hidden = true;
  world.reset();
  showReward("");
});

window.addEventListener("resize", () => world.resize());
window.addEventListener("pagehide", () => palmCamera.stop());

function frame(now: number): void {
  const deltaSeconds = Math.min(0.05, Math.max(0, (now - lastFrame) / 1000));
  lastFrame = now;
  const steering = input.sample(now);
  const difficulty = difficultyAt(run.elapsed);
  const targetSpeed =
    started && run.state === "playing" ? difficulty.worldSpeed * 4.65 : 0;
  displaySpeed +=
    (targetSpeed - displaySpeed) * Math.min(1, deltaSeconds * 2.8);
  const events = world.update(
    deltaSeconds,
    run.elapsed,
    steering.value,
    started,
    run.state === "crashed",
  );

  if (run.state === "playing" && started) {
    if (events.collision) {
      run = crashRun(run);
      audio.crash();
    } else {
      for (let index = 0; index < events.nearMisses; index += 1) {
        run = applyNearMiss(run);
      }
      if (events.nearMisses > 0) {
        showReward(events.thread ? "THREAD" : "CLOSE");
        audio.nearMiss(events.thread);
      }
      const speed = difficulty.worldSpeed;
      run = advanceRun(run, deltaSeconds, speed);
      audio.update(speed / 54, steering.value);
    }
  } else {
    audio.update(0.18, steering.value);
  }

  if (run.state !== "playing" && !ended) settleRun();
  updateHud();
  requestAnimationFrame(frame);
}

function settleRun(): void {
  ended = true;
  root.dataset.gameState = run.state;
  root.classList.add("is-ended", `is-${run.state}`);
  ending.textContent = run.state === "finished" ? "FINISH" : "CRASHED";
  finalScore.textContent = formatScore(run.score);
  endPanel.hidden = false;

  try {
    const previousBest = Number.parseInt(localStorage.getItem("handshift-best") ?? "0", 10);
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
  timeOutput.textContent = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`;
  multiplierOutput.textContent = `×${run.multiplier.toFixed(1)}`;
  speedOutput.textContent = String(Math.round(displaySpeed)).padStart(3, "0");
  progressFill.style.transform = `scaleX(${Math.min(1, run.elapsed / RUN_DURATION_SECONDS)})`;
}

function showReward(label: string): void {
  window.clearTimeout(rewardTimer);
  rewardOutput.textContent = label;
  rewardOutput.classList.toggle("is-visible", label.length > 0);
  if (label) {
    rewardTimer = window.setTimeout(() => {
      rewardOutput.classList.remove("is-visible");
    }, 720);
  }
}

function drawHand(landmarks: Array<{ x: number; y: number }>): void {
  if (!handContext) return;
  handContext.clearRect(0, 0, handTrace.width, handTrace.height);
  if (landmarks.length === 0) return;
  handContext.fillStyle = "rgba(98, 231, 255, 0.82)";
  handContext.shadowColor = "#58e8ff";
  handContext.shadowBlur = 9;
  for (const point of landmarks) {
    handContext.beginPath();
    handContext.arc(
      point.x * handTrace.width,
      point.y * handTrace.height,
      2.3,
      0,
      Math.PI * 2,
    );
    handContext.fill();
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
