# Process overview

I started HANDSHIFT with hand tracking as the main idea. Before building the
game, I wrote the Crit 5 constraints into the harness: no tutorial, a real loss
state, a finish inside five minutes, local assets and rules I could test without
the 3D scene. That starting scope is in
[`8d0a2d8`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-Adithya-Rama/commit/8d0a2d8).

I built collision, scoring and the timed finish separately from Three.js, then
used those rules for the highway scene. The progression from rules to the first
playable ride is visible in
[`6f6a759...df66b54`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-Adithya-Rama/compare/6f6a759...df66b54).

The biggest changes came from playing it. The webcam initially did not track my
hand at all, so I corrected the MediaPipe video path in
[`79a66df`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-Adithya-Rama/commit/79a66df).
That fixed the technical problem, but the control was still imprecise, awkward
to switch on and off, and the game had become laggy. I stopped trying to protect
the original idea and removed the camera code, model and WASM files completely.

I then pushed the game toward the Highway Rider experience I actually wanted:
keyboard and pointer steering, a 210-second run, automatic speed, denser traffic,
trucks, oncoming vehicles, close-pass scoring and a clearer motorcycle shape.
The synthetic engine also sounded like a fan, so I replaced it with a local CC0
Hayabusa recording and later crossfaded its loops. I softened the steering after
another play showed it was too abrupt. The final play-derived correction is in
[`d515f3b`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-Adithya-Rama/commit/d515f3b),
with focused tests for steering, collision and audio-loop processing.
