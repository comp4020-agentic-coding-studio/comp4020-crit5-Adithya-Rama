import { median, normalisePalmRoll } from "./steering.ts";
import type { SteeringSample } from "./types.ts";

interface WorkerResult {
  type: "result";
  angle: number;
  confidence: number;
  landmarks: Array<{ x: number; y: number }>;
}

type WorkerMessage =
  | { type: "ready" }
  | { type: "error"; reason: string }
  | WorkerResult;

export class PalmCamera {
  private worker: Worker | null = null;
  private stream: MediaStream | null = null;
  private video: HTMLVideoElement | null = null;
  private timer = 0;
  private busy = false;
  private neutralSamples: number[] = [];
  private neutral: number | null = null;

  constructor(
    private readonly onSample: (
      sample: SteeringSample,
      landmarks: WorkerResult["landmarks"],
    ) => void,
    private readonly onState: (state: "loading" | "ready" | "error") => void,
  ) {}

  async start(): Promise<void> {
    if (this.stream) return;
    this.onState("loading");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: "user",
          width: { ideal: 320 },
          height: { ideal: 240 },
        },
      });
      const video = document.createElement("video");
      video.muted = true;
      video.playsInline = true;
      video.srcObject = stream;
      await video.play();

      const worker = new Worker(new URL("./hand-worker.ts", import.meta.url), {
        type: "module",
      });
      worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
        const message = event.data;
        if (message.type === "ready") {
          this.onState("ready");
          this.timer = window.setInterval(() => {
            void this.sendFrame();
          }, 66);
          return;
        }
        if (message.type === "error") {
          this.onState("error");
          return;
        }
        this.busy = false;
        this.consume(message);
      };
      worker.onerror = () => {
        this.busy = false;
        this.onState("error");
      };

      this.stream = stream;
      this.video = video;
      this.worker = worker;
      worker.postMessage({
        type: "init",
        wasmRoot: new URL("./mediapipe/wasm", document.baseURI).href,
        modelPath: new URL("./models/hand_landmarker.task", document.baseURI).href,
      });
    } catch {
      this.onState("error");
      this.stop();
    }
  }

  stop(): void {
    window.clearInterval(this.timer);
    this.timer = 0;
    this.worker?.terminate();
    this.worker = null;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.video = null;
    this.busy = false;
  }

  private async sendFrame(): Promise<void> {
    if (this.busy || !this.video || !this.worker || this.video.readyState < 2) return;
    this.busy = true;
    try {
      const bitmap = await createImageBitmap(this.video);
      this.worker.postMessage({ type: "frame", bitmap }, [bitmap]);
    } catch {
      this.busy = false;
    }
  }

  private consume(result: WorkerResult): void {
    if (result.confidence < 0.45) return;

    if (this.neutral === null) {
      this.neutralSamples.push(result.angle);
      if (this.neutralSamples.length >= 12) {
        this.neutral = median(this.neutralSamples);
      }
    }
    const value =
      this.neutral === null ? 0 : -normalisePalmRoll(result.angle, this.neutral);
    this.onSample(
      {
        value,
        confidence: result.confidence,
        timestamp: performance.now(),
        source: "camera",
      },
      result.landmarks,
    );
  }
}
