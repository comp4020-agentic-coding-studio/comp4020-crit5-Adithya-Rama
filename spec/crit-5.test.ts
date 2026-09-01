import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { crashRun, initialRun } from "../game/rules.ts";

const DIST = resolve("dist");
const home = new JSDOM(readFileSync(resolve(DIST, "index.html"), "utf8")).window
  .document;
const mainSource = readFileSync(resolve("main.ts"), "utf8");

describe("crit 5: no instructions anywhere", () => {
  const TUTORIAL_WORDS = /how to play|instructions|tutorial|click here to start/i;

  it("has no on-screen tutorial or how-to-play text", () => {
    expect(
      home.body.textContent ?? "",
      "the opening screen has to make the first move obvious on its own",
    ).not.toMatch(TUTORIAL_WORDS);
  });

  it("has no help/instructions dialog", () => {
    expect(
      home.querySelector('dialog, [role="dialog"], .tutorial, .how-to-play'),
    ).toBeFalsy();
  });
});

describe("crit 5: the game can be lost", () => {
  it("exposes a game-state hook that starts in play", () => {
    const root = home.querySelector("[data-game-state]");
    expect(root).toBeTruthy();
    expect(root?.getAttribute("data-game-state")).toBe("playing");
  });

  it("makes a traffic collision terminal", () => {
    expect(crashRun(initialRun()).state).toBe("crashed");
  });
});

describe("HANDSHIFT: resilient controls", () => {
  it("provides pause and resume without adding another terminal game state", () => {
    expect(home.querySelector("#pause")).toBeTruthy();
    expect(mainSource).toContain("const deltaSeconds = paused ? 0 : frameDelta");
    expect(mainSource).toContain('root.dataset.paused = String(paused)');
  });

  it("shows speed directly instead of an unexplained starting multiplier", () => {
    expect(home.querySelector("#speedometer #speed")).toBeTruthy();
    expect(home.querySelector("#multiplier")).toBeFalsy();
  });

  it("ships only keyboard and pointer steering", () => {
    expect(home.querySelector("#camera, #camera-preview, #hand-trace")).toBeFalsy();
    expect(mainSource).not.toMatch(/PalmCamera|cameraButton|palmCamera/);
  });
});
