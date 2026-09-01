import { shapeSteeringInput } from "./steering.ts";
import type { SteeringSample } from "./types.ts";

export class InputController {
  private keyboard = new Set<string>();
  private pointerSample: SteeringSample = {
    value: 0,
    confidence: 1,
    timestamp: Number.NEGATIVE_INFINITY,
    source: "pointer",
  };

  constructor(
    private readonly target: HTMLElement,
    private readonly onActivity: () => void,
  ) {
    target.addEventListener("pointerdown", this.onPointer);
    target.addEventListener("pointermove", this.onPointer);
    target.addEventListener("pointerup", this.onPointerUp);
    target.addEventListener("pointercancel", this.onPointerUp);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
  }

  sample(now: number): SteeringSample {
    const keyboardValue =
      (this.keyboard.has("ArrowRight") || this.keyboard.has("KeyD") ? 1 : 0) -
      (this.keyboard.has("ArrowLeft") || this.keyboard.has("KeyA") ? 1 : 0);

    if (keyboardValue !== 0) {
      return {
        value: keyboardValue,
        confidence: 1,
        timestamp: now,
        source: "keyboard",
      };
    }
    return this.pointerSample;
  }

  destroy(): void {
    this.target.removeEventListener("pointerdown", this.onPointer);
    this.target.removeEventListener("pointermove", this.onPointer);
    this.target.removeEventListener("pointerup", this.onPointerUp);
    this.target.removeEventListener("pointercancel", this.onPointerUp);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
  }

  private readonly onPointer = (event: PointerEvent): void => {
    if (event.target instanceof Element && event.target.closest("button")) return;
    if (event.type === "pointerdown") {
      this.target.setPointerCapture(event.pointerId);
    }
    if (event.pointerType !== "mouse" && event.buttons === 0) return;
    const bounds = this.target.getBoundingClientRect();
    const value = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    this.pointerSample = {
      value: shapeSteeringInput(value),
      confidence: 1,
      timestamp: performance.now(),
      source: "pointer",
    };
    if (Math.abs(this.pointerSample.value) > 0.06) this.onActivity();
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (this.target.hasPointerCapture(event.pointerId)) {
      this.target.releasePointerCapture(event.pointerId);
    }
    if (event.pointerType !== "mouse") {
      this.pointerSample = {
        value: 0,
        confidence: 1,
        timestamp: performance.now(),
        source: "pointer",
      };
    }
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (!["ArrowLeft", "ArrowRight", "KeyA", "KeyD"].includes(event.code)) return;
    event.preventDefault();
    this.keyboard.add(event.code);
    this.onActivity();
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.keyboard.delete(event.code);
  };

  private readonly onBlur = (): void => {
    this.keyboard.clear();
    this.pointerSample = {
      value: 0,
      confidence: 1,
      timestamp: performance.now(),
      source: "pointer",
    };
  };
}
