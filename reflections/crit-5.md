# Crit 5 reflection

The breakthrough was realising that a technically interesting input method was
not automatically the best centre for the game. I initially treated palm
tracking as HANDSHIFT’s defining interaction. Automated checks could confirm
that the model loaded and that steering values were produced, but they could
not tell me whether the motorcycle was actually controllable. Playing the build
exposed that gap immediately: first the hand was not tracked at all, and after I
fixed the MediaPipe video path, the tracking still felt too imprecise.

That feedback changed the design rather than just prompting another small
camera adjustment. I first made keyboard and pointer control primary and kept
tracking optional. A later playthrough showed that even turning the camera
feature on and off was inconvenient and the expanded build felt laggy. I
removed hand tracking completely instead of protecting the original novelty,
then spent the recovered runtime budget on automatic speed, clearer motorcycle
and traffic shapes, rider lean, close-pass rewards and progressive difficulty.

This work changed the kind of developer I want to be by making me less attached
to novelty for its own sake. I want to use tests for the facts they can prove,
then deliberately seek human evidence for control, clarity and feel. The most
important corrections in this project did not come from failing tests. They
came from accepting that the player’s experience was stronger evidence than my
original concept.

Later playtests exposed fan-like engine loops, abrupt steering and a flat
late-game threat. I bundled a CC0 Hayabusa recording, added progressively more
headlight-signalled oncoming traffic with swept collision, then introduced a
centre-weighted input curve, gentler traction and crossfaded sample layers.
Tests cover that mechanical behaviour, not whether it feels or sounds right.
