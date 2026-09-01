# Process overview

## What I built

I built HANDSHIFT, a browser-based 3D motorcycle game in which the player
weaves through progressively denser highway traffic, builds a multiplier from
close passes, and either crashes or reaches an illuminated finish. Keyboard and
pointer steering are now primary; palm tracking remains an optional version of
the same continuous steering mechanic.

## The moments that mattered

I first turned the Crit 5 requirements into a harness rather than treating them
as a final checklist. The 210-second ending was originally 150 seconds, but the
important constraints were already explicit: the game had to teach itself,
remain playable without a camera, expose a testable run state, and keep runtime
assets local. That scope is visible in
[`8d0a2d8`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-Adithya-Rama/commit/8d0a2d8).

Next I separated rules from presentation. Collision, close-pass scoring and the
timed ending landed as deterministic functions and focused tests before the
Three.js highway, motorcycle and traffic were built. This made later tuning
safer because graphical changes could not silently redefine the game. See
[`6f6a759...df66b54`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-Adithya-Rama/compare/6f6a759...df66b54).

The decisive correction came from actual use, not code inspection:

> “no its not tracking my hand at all”

I replaced the non-working hand pipeline with MediaPipe video inference and
local GPU/CPU fallback. After the camera worked, the next play feedback was that
it was still imprecise. I therefore made keyboard and pointer primary, retained
camera as optional, added steadier palm calibration, extended the run to 210
seconds, and coordinated speed, traffic, trucks and visual progression through
one difficulty curve. The confirmed camera correction is
[`79a66df`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-Adithya-Rama/commit/79a66df);
the later play-derived polish remains pending final visual playtest and its own
commit.
