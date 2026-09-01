# Crit 5 reflection

The breakthrough was realising that a technically interesting input method was
not automatically the best centre for the game. I initially treated palm
tracking as HANDSHIFT’s defining interaction. Automated checks could confirm
that the model loaded and that steering values were produced, but they could
not tell me whether the motorcycle was actually controllable. Playing the build
exposed that gap immediately: first the hand was not tracked at all, and after I
fixed the MediaPipe video path, the tracking still felt too imprecise.

That feedback changed the design rather than just prompting another small
camera adjustment. I kept hand tracking as an optional expression of the same
steering signal, but made keyboard and pointer control primary. I then spent
the complexity budget on what made the ride more enjoyable: stronger speed and
lean animation, richer traffic and road detail, close-pass rewards, a longer
210-second run, and one progressive difficulty curve shared by scoring,
traffic, lighting and the finish sequence.

This work changed the kind of developer I want to be by making me less attached
to novelty for its own sake. I want to use tests for the facts they can prove,
then deliberately seek human evidence for control, clarity and feel. The most
important correction in this project did not come from a failing test. It came
from accepting that the player’s experience was stronger evidence than my
original concept.
