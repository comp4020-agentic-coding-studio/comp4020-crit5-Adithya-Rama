# COMP4020 prototype

Your starter repo for a COMP4020 prototype: a static site in HTML/CSS/TypeScript
that builds to plain HTML/CSS/JS and deploys to GitHub Pages. The deployed site
is what gets marked, not this repo.

The
[course website](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/)
publishes this deliverable's brief and spec, and this repo's name tells you
which deliverable applies. Read both before you plan or build.

## Spec anchor --- Crit 5, "A game"

This week's [published spec](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/crits/05-game/)
is the actual contract, and it overrides every architectural or product-vision
detail below if the two ever disagree:

- deployed and live at its public GitHub Pages URL by the cutoff
- it can be lost: a wrong move is possible, and play ends somewhere --- a win,
  a loss or a finish
- it teaches itself: no instructions anywhere, on screen or off --- the
  opening screen invites the first move, and play teaches whatever comes next
- a stranger can pick it up and reach an ending inside five minutes
- one rule of the game has a focused automated test, and one change you made
  came from playing the finished game rather than reading its code
- the repo shows the process --- commits that grew with the work, a process
  overview in `PROCESS.md`, and the week's reflection in
  `reflections/crit-5.md`
- you can account for how you directed, grounded and corrected the work

`spec/crit-5.test.ts` carries the two mechanically-checkable lines (no
instructions, a queryable game-over state). The rest --- five-minute pickup,
the playtesting-derived change, how you directed the work --- is judged at the
crit, not by a test.

## Product charter --- HANDSHIFT

HANDSHIFT is a premium-feeling browser arcade ride built around continuous
lateral steering. Keyboard and pointer are the primary controls; optional palm
roll maps to the same steering signal. Close non-colliding passes build score
and multiplier; a collision ends the run; surviving 210 seconds reaches a finish.

The opening is already live. A motorcycle idles on a sparse sunset highway, a
handlebar-motion glyph invites interaction, and the bike mirrors the first useful
steering signal before traffic becomes dangerous. Do not explain this with
words. The title, score, multiplier, time, reward words, and icon-only
camera/audio/restart controls are allowed; how-to copy is not.

### Runtime and architecture

- Keep Vite + strict TypeScript and deploy as static GitHub Pages output.
- Use Three.js for a procedural low/mid-poly road, bike, traffic and effects.
- Lazy-load MediaPipe Hand Landmarker only after camera activation. Its WASM
  and model are local assets, not CDN URLs.
- Normalise keyboard, pointer/touch and camera into the same timestamped
  steering sample. A held key wins, then a recent pointer gesture, then a fresh
  camera sample; camera loss recentres smoothly without affecting primary play.
- Keep rules pure: seeded traffic, collision, near-miss classification,
  multiplier and the 210-second finish must not depend on Three.js.
- Treat `playing`, `crashed` and `finished` as the public run-state contract
  and mirror it on the game root through `data-game-state`.
- Synthesize sound with Web Audio after a user gesture. Do not add downloaded
  audio or autoplay assumptions.

### Visual and performance budget

- Art direction: cinematic dusk-to-night expressway, reflective asphalt,
  emissive traffic lights, restrained bloom/fog, low chase camera, bike lean,
  sparks and speed streaks.
- Generated skyline/card raster assets must be inspected, copied into
  `public/`, optimised, and recorded with their final prompts. Simple particles
  and icons stay code-native.
- Cap device pixel ratio, pool road/traffic objects, sample hand tracking below
  render frequency, and degrade expensive effects before frame rate falls
  below 30 FPS.
- Initial pointer/keyboard play must work before the camera module or model has
  loaded, and a denied camera must never strand the player.

### Acceptance gates

1. Pure rule tests prove collision, one-shot near-miss scoring, steering
   calibration/clamping and the timed finish.
2. `pnpm check`, the Crit 5 spec and invariants pass against the built output.
3. The running game is exercised at 1920x1080 and 390x844, including keyboard,
   pointer/touch fallback, resize during play, crash, restart and finish.
4. A real student playthrough produces one concrete correction. Record the
   observation and resulting commit; never fabricate it.
5. Draft `reflections/crit-5.md` only from verified events and require student
   correction/approval before publication.
6. Keep development pushes private. Publish and verify Pages only after all
   gates above are green and the student approves the evidence.

## How to work in here

- Keep the dev server running (`pnpm dev`) so you see changes as you make them.
- Run `pnpm check` before you push --- it runs most of what CI runs (typecheck,
  build, spec) so you catch failures in seconds instead of waiting on the
  pipeline.
- Open the page in a browser and look at it --- the rendered page is the
  truth, not your mental model of it. The `agent-browser` CLI (documented on
  the course site's
  [backpressure page](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/topics/backpressure/#agent-browser-the-rendered-page-as-ground-truth))
  works well for this.
- When a check fails, read its output before changing anything. Treat a red
  check as authoritative --- the page is wrong until the check is green, not
  until you decide it should be.
- Commit when the checks pass. Never commit a red state.

## The link-preview card

`public/card.png` (1200x630) is the image a shared link shows; `index.html`'s
head points at it. Replace it and the `description` meta, and copy the head
block into any new page. The card URL resolves against the page that names it,
like any link --- `./card.png` is wrong one directory down, and nothing in CI
checks it, so the deployed head is the only place a broken one shows up.

## The checks (your sensors)

CI runs these on every push once your repo is public. While private (all week,
until you ship) CI stays skipped --- `pnpm check` is the same roster locally
and the faster loop anyway.

They also carry a mark at the crit: the sweep runs fifteen minutes after your
cutoff, and green checks there are worth half that week's shipped mark. Still
running counts as not green, so ship with time for CI to finish.

- **typecheck / build** --- `tsc --noEmit` then `pnpm build`; nothing else
  matters until these are green.
- **deploy / online** --- the live GitHub Pages URL must load and return the
  page you expect.
- **spec** --- `spec/invariants.test.ts` asserts what's true of any good
  website; the week's own `spec/*.test.ts` asserts this week's contract.
- **lint** --- `stylelint` for CSS, `oxlint` for TypeScript.
- **tests** --- any other tests you write, picked up by the same `vitest run`.
- **evidence** (`pnpm check:evidence`) --- `PROCESS.md`'s citations resolve to
  real commits, this week's reflection file exists, and your
  `CLAUDE.md`/`AGENTS.md` are present. Gates the deploy.
- **links / secrets** --- internal links resolve; no committed credentials (a
  local pre-commit hook also blocks anything shaped like an API key).

Nothing here measures accessibility or performance --- wiring those sensors is
your work if the week's spec asks for it.

## Your process is part of the mark

- **Commit as you go.** A trail that grew alongside the code is the strongest
  evidence of process; a single dump the night before is the weakest.
- **Keep `PROCESS.md` current** --- a short reading guide, not an essay, each
  entry pointing at a commit, a `CLAUDE.md`/`AGENTS.md` change, or a prompt and
  the commit it produced.
- **Write `reflections/crit-5.md`** --- the breakthrough that moved the work
  forward, and what this changed about the developer you want to be. Leave the
  actual judgement to yourself; an agent may scaffold structure, not content.
- **This file is process evidence too.** Keep it honest and current.

## This file is yours

A starting point, not a rulebook: what you add to it is the harness, and the
harness is assessed. This file and the sensors you wire into `check` carry
across the course --- both come with you into next week's repo. The prototype
doesn't: source, and the tests answering this week's published spec, stay
behind.
