import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { crashRun, initialRun } from "../game/rules.ts";

// Crit 5, "A game" --- contract tests for this week's published spec
// (https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/crits/05-game/).
// Runs against the BUILT site, same as spec/invariants.test.ts. The spec lines
// judged by a person at the crit (five-minute pickup, the playtesting-derived
// change, how the work was directed) aren't testable and aren't attempted here.
const DIST = resolve("dist");
const home = new JSDOM(readFileSync(resolve(DIST, "index.html"), "utf8")).window
  .document;

describe("crit 5: no instructions anywhere", () => {
  const TUTORIAL_WORDS = /how to play|instructions|tutorial|click here to start/i;

  it("has no on-screen tutorial or how-to-play text", () => {
    expect(
      home.body.textContent ?? "",
      "the opening screen has to make the first move obvious on its own --- no explanatory text standing in for it",
    ).not.toMatch(TUTORIAL_WORDS);
  });

  it("has no help/instructions dialog", () => {
    expect(
      home.querySelector('dialog, [role="dialog"], .tutorial, .how-to-play'),
    ).toBeFalsy();
  });
});

describe("crit 5: the game can be lost", () => {
  // Contract, not implementation: the game root reports its own state so a
  // test (or a tutor) can tell playing from ended without reading the source.
  // Swap the selector/values below if your game's convention differs, but keep
  // some state that is queryable rather than only inferrable from the DOM.
  it("exposes a game-state hook that starts in play", () => {
    const root = home.querySelector("[data-game-state]");
    expect(
      root,
      "add data-game-state to the game's root element, starting at \"playing\"",
    ).toBeTruthy();
    expect(root?.getAttribute("data-game-state")).toBe("playing");
  });

  it("makes a traffic collision terminal", () => {
    expect(crashRun(initialRun()).state).toBe("crashed");
  });
});
