import { describe, expect, it } from "vitest";
import { createCrossfadedLoop } from "./audio.ts";

describe("engine loop processing", () => {
  it("crossfades the recording boundary into the next loop cycle", () => {
    const sourceData = Float32Array.from(
      { length: 20 },
      (_, index) => index / 20,
    );
    const recording = {
      sampleRate: 10,
      duration: 2,
      length: sourceData.length,
      numberOfChannels: 1,
      getChannelData: () => sourceData,
    } as unknown as AudioBuffer;
    let outputData = new Float32Array();
    const context = {
      createBuffer: (_channels: number, length: number) => {
        outputData = new Float32Array(length);
        return {
          getChannelData: () => outputData,
        };
      },
    } as unknown as BaseAudioContext;

    const loop = createCrossfadedLoop(context, recording, 0, 2, 0.2);

    expect(loop).toBeDefined();
    expect(outputData.length).toBe(18);
    expect(outputData[0]).toBeCloseTo(0.1);
    expect(outputData.at(-1)).toBeCloseTo(0.05);
    expect(Math.abs(outputData[0]! - outputData.at(-1)!)).toBeLessThan(0.06);
  });
});
