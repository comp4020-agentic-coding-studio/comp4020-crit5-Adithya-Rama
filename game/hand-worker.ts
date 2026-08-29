import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";

interface Landmark {
  x: number;
  y: number;
}

interface InitMessage {
  type: "init";
  wasmRoot: string;
  modelPath: string;
}

interface FrameMessage {
  type: "frame";
  bitmap: ImageBitmap;
}

type IncomingMessage = InitMessage | FrameMessage;

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<IncomingMessage>) => void) | null;
  postMessage: (message: unknown) => void;
};

let landmarker: HandLandmarker | null = null;

scope.onmessage = (event): void => {
  if (event.data.type === "init") {
    void initialise(event.data);
    return;
  }
  detect(event.data.bitmap);
};

async function initialise(message: InitMessage): Promise<void> {
  try {
    const vision = await FilesetResolver.forVisionTasks(message.wasmRoot);
    landmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: message.modelPath,
        delegate: "GPU",
      },
      runningMode: "IMAGE",
      numHands: 1,
      minHandDetectionConfidence: 0.55,
      minHandPresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
    scope.postMessage({ type: "ready" });
  } catch (error) {
    scope.postMessage({
      type: "error",
      reason: error instanceof Error ? error.message : "initialisation failed",
    });
  }
}

function detect(bitmap: ImageBitmap): void {
  if (!landmarker) {
    bitmap.close();
    return;
  }
  try {
    const result = landmarker.detect(bitmap);
    const landmarks = result.landmarks[0] as Landmark[] | undefined;
    const handedness = result.handedness[0]?.[0]?.score ?? 0;
    if (!landmarks) {
      scope.postMessage({
        type: "result",
        angle: 0,
        confidence: 0,
        landmarks: [],
      });
      return;
    }

    const indexKnuckle = landmarks[5]!;
    const pinkyKnuckle = landmarks[17]!;
    const angle =
      (Math.atan2(
        pinkyKnuckle.y - indexKnuckle.y,
        pinkyKnuckle.x - indexKnuckle.x,
      ) *
        180) /
      Math.PI;

    scope.postMessage({
      type: "result",
      angle,
      confidence: handedness,
      landmarks: landmarks.map(({ x, y }) => ({ x: 1 - x, y })),
    });
  } catch (error) {
    scope.postMessage({
      type: "error",
      reason: error instanceof Error ? error.message : "detection failed",
    });
  } finally {
    bitmap.close();
  }
}
