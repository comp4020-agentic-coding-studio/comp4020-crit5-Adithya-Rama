# COMP4020 prototype

Your starter repo for a COMP4020 prototype: a static site in HTML/CSS/TypeScript
that builds to plain HTML/CSS/JS and deploys to GitHub Pages. The deployed site
is what gets marked, not this repo.

The
[course website](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/)
publishes this deliverable's brief and spec, and this repo's name tells you
which deliverable applies. Read both before you plan or build.

## Spec anchor --- Crit 5, "A game"

_Fill this in with the published spec's checkable lines once pulled (course
`start` skill, step 6). It overrides every architectural or product-vision
detail below if the two ever disagree._

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
