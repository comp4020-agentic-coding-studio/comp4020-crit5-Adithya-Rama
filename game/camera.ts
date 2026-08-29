import type {
  HandLandmarker,
  HandLandmarkerResult,
  NormalizedLandmark,
} from "@mediapipe/tasks-vision";
import { median, normalisePalmRoll } from "./steering.ts";
import type { SteeringSample } from "./types.ts";

type CameraState = "loading" | "ready" | "error";
type LandmarkPoint = { x: number; y: number };

export class PalmCamera {
  private landmarker: HandLandmarker | null = null;
  private stream: MediaStream | null = null;
  private timer = 0;
  private starting = false;
  private neutralSamples: number[] = [];
  private neutral: number | null = null;

  constructor(
    private readonly video: HTMLVideoElement,
    private readonly onSample: (
      sample: SteeringSample,
      landmarks: LandmarkPoint[],
    ) => void,
    private readonly onState: (state: CameraState, reason?: string) => void,
  ) {}

  async start(): Promise<void> {
    if (this.stream || this.starting) return;
    this.starting = true;
    this.onState("loading");

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("camera API unavailable");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30, max: 30 },
        },
      });

      this.stream = stream;
      this.video.srcObject = stream;
      await this.video.play();

      const { FilesetResolver, HandLandmarker } = await import(
        "@mediapipe/tasks-vision"
      );
      const wasmRoot = new URL("./mediapipe/wasm", document.baseURI).href;
      const modelAssetPath = new URL(
        "./models/hand_landmarker.task",
        document.baseURI,
      ).href;
      const vision = await FilesetResolver.forVisionTasks(wasmRoot);
      const options = {
        baseOptions: { modelAssetPath, delegate: "GPU" as const },
        runningMode: "VIDEO" as const,
        numHands: 1,
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.45,
        minTrackingConfidence: 0.45,
      };

      try {
        this.landmarker = await HandLandmarker.createFromOptions(vision, options);
      } catch {
        this.landmarker = await HandLandmarker.createFromOptions(vision, {
          ...options,
          baseOptions: { modelAssetPath, delegate: "CPU" },
        });
      }

      this.neutralSamples = [];
      this.neutral = null;
      this.onState("ready");
      this.timer = window.setInterval(() => this.detectFrame(), 66);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "camera failed";
      this.stop();
      this.onState("error", reason);
    } finally {
      this.starting = false;
    }
  }

  stop(): void {
    window.clearInterval(this.timer);
    this.timer = 0;
    this.landmarker?.close();
    this.landmarker = null;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.video.pause();
    this.video.srcObject = null;
    this.neutralSamples = [];
    this.neutral = null;
  }

  private detectFrame(): void {
    if (
      !this.landmarker ||
      this.video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA
    ) {
      return;
    }

    try {
      this.consume(this.landmarker.detectForVideo(this.video, performance.now()));
    } catch (error) {
      const reason = error instanceof Error ? error.message : "tracking failed";
      this.stop();
      this.onState("error", reason);
    }
  }

  private consume(result: HandLandmarkerResult): void {
    const landmarks = result.landmarks[0];
    if (!landmarks) {
      this.onSample(
        {
          value: 0,
          confidence: 0,
          timestamp: performance.now(),
          source: "camera",
        },
        [],
      );
      return;
    }

    const confidence = result.handedness[0]?.[0]?.score ?? 1;
    if (confidence < 0.45) return;

    const angle = palmRoll(landmarks);
    if (this.neutral === null) {
      this.neutralSamples.push(angle);
      if (this.neutralSamples.length >= 12) {
        this.neutral = median(this.neutralSamples);
      }
    }

    const value =
      this.neutral === null ? 0 : -normalisePalmRoll(angle, this.neutral);
    this.onSample(
      {
        value,
        confidence,
        timestamp: performance.now(),
        source: "camera",
      },
      landmarks.map(({ x, y }) => ({ x: 1 - x, y })),
    );
  }
}

function palmRoll(landmarks: NormalizedLandmark[]): number {
  const indexKnuckle = landmarks[5]!;
  const pinkyKnuckle = landmarks[17]!;
  return (
    (Math.atan2(
      pinkyKnuckle.y - indexKnuckle.y,
      pinkyKnuckle.x - indexKnuckle.x,
    ) *
      180) /
    Math.PI
  );
}
