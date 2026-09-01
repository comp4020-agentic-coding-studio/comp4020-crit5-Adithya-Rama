# AGENTS.md

## Purpose

This file defines engineering rules for agents working on this prototype.

Read this file together with:

* `CLAUDE.md`;
* repository documentation;
* current implementation;
* task-specific prompt/instructions.

If instructions conflict:

1. explicit current task instruction;
2. repository safety/course constraints;
3. `AGENTS.md`;
4. `CLAUDE.md`;
5. inferred preferences.

Do not override actual repository facts with stale documentation.

---

# 0. Spec anchor --- the actual assignment requirement

The published spec for this deliverable (Crit 5, "A game") is the real
contract, and under the priority order above it is a "repository
safety/course constraint" --- it outranks every rule below it and every
product-vision detail in `CLAUDE.md`:

1. deployed and live at its public GitHub Pages URL by the cutoff;
2. it can be lost: a wrong move is possible, and play ends somewhere --- a
   win, a loss or a finish;
3. it teaches itself: no instructions anywhere, on screen or off --- the
   opening screen invites the first move, and play teaches whatever comes
   next;
4. a stranger can pick it up and reach an ending inside five minutes;
5. one rule of the game has a focused automated test, and one change you made
   came from playing the finished game rather than reading its code;
6. the repo shows the process --- commits that grew with the work, a process
   overview in `PROCESS.md`, and the week's reflection in
   `reflections/crit-5.md`;
7. you can account for how you directed, grounded and corrected the work.

Full text: <https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/crits/05-game/>

Before any commit that claims a milestone, and always before invoking rule 10
("Before declaring completion"):

* re-check the spec lines, verbatim, against the actual running build --- not
  the plan, not what you intended to build;
* if a choice elsewhere in this file would cost a spec line by the cutoff, the
  choice is wrong --- cut scope instead;
* do not silently reinterpret a spec line to fit architecture already
  written; flag the conflict for the student rather than quietly deciding the
  spec meant something narrower.

## 0.1 HANDSHIFT product contract

The chosen response is **HANDSHIFT**, a keyboard-and-pointer-first 3D motorcycle
game with optional hand tracking. Keep the response pointed and small even when
polishing it:

* one continuous lateral steering mechanic is driven primarily by keyboard or
  pointer/touch, with optional palm roll using the same normalized signal;
* keyboard and pointer/touch remain immediately playable whether camera
  permission, lighting or tracking succeeds or fails;
* a run ends in a crash or at the illuminated finish after 210 seconds;
* the root exposes `data-game-state="playing|crashed|finished"` and keeps it in
  sync with the real run state;
* there is no instructional copy, tutorial screen, help dialog, or README
  control guide --- affordance and feedback do the teaching;
* Three.js, MediaPipe WASM/model files, generated artwork and other runtime
  assets ship locally. Do not add a runtime CDN dependency;
* game rules stay deterministic and separate from rendering so collision,
  scoring and finishing can be tested without WebGL or a camera;
* target 60 FPS on the desktop marking viewport and at least 30 FPS on the
  phone viewport, with adaptive quality rather than broken play;
* never report webcam quality, visual polish, audio feel or mobile play as
  verified unless that exact check was performed on the running build.

Reject an endless-only run, a camera-only build, or extra mechanics that put a
spec line or the core steering feel at risk. The feature-complete build must
pause for a real student playthrough; its observed correction and the student's
approved reflection are pre-publication gates, not details to invent.

---

# 1. Audit before implementation

Before significant work:

* inspect relevant source files;
* inspect package/framework config;
* inspect existing tests;
* inspect deployment configuration.

Do not immediately scaffold a replacement project.

Do not assume a dependency is missing before checking.

---

# 2. Testing split

Prioritise deterministic tests for logic that is mechanically checkable.

Do not attempt to prove subjective quality (how something looks, feels, or
plays) through unit tests --- flag it for human judgement instead.

---

# 3. Manual testing

Report only tests actually performed, on the actual running build.

---

# 4. Git discipline

Prefer logical commits. Do not combine unrelated work into one giant commit.
Do not rewrite history unless explicitly instructed.

---

# 5. No unnecessary dependencies

Before adding a library:

1. inspect existing dependencies;
2. justify what problem it solves;
3. check browser/static-hosting compatibility;
4. check bundle impact.

---

# 6. Avoid speculative abstractions

Create boundaries where they improve clarity. Avoid architecture
astronautics --- do not create factories/providers/managers merely because
they might theoretically be useful later. The system should remain
understandable to a student developer.

---

# 7. Do not overbuild

Unless explicitly requested, do not implement features beyond what the week's
spec and product vision ask for.

---

# 8. Process documents

Update `PROCESS.md` with actual facts only. Do not fabricate user testing,
iterations, tutor feedback, or personal motivations.

You may scaffold `reflections/crit-5.md`'s structure, but leave personal
judgement in it to the student unless explicitly provided.

---

# 9. Failure handling

Handle realistic failure modes for this week's build (bad input, missing
assets, load failures) so the rest of the application stays usable.

---

# 10. Before declaring completion

Verify, in this order:

## Spec (rule 0 --- check first)

* all published spec lines hold against the actual build, not the plan;
* this week's spec test file and `spec/invariants.test.ts` are both green;
* `pnpm check:evidence` is green.

## Quality

* build passes;
* relevant tests pass;
* no known console-breaking errors;
* remaining subjective judgement (look, feel, play) is documented, not
  claimed.

Do not claim completion if a core item is knowingly broken, even if
everything else is green.

---

# 11. Final reporting

When completing a substantial task, report:

* what changed;
* important files;
* architecture decisions;
* tests/build run;
* known limitations;
* next highest-value action.

Avoid vague statements like "everything is production-ready." Be precise.
