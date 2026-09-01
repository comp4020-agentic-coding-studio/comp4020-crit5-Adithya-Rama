# Crit 5 reflection

My main breakthrough was accepting that hand tracking was not making HANDSHIFT
a better game. It sounded like the most interesting part of the concept, but
playing it exposed problems that the automated checks could not. At first the
camera did not track my hand at all. After that was fixed, it still felt
imprecise, turning it on and off was inconvenient, and the extra work made the
game feel laggy.

I could have kept adjusting the tracking because I had already spent time on
it, but that would have protected the feature instead of improving the game. I
removed it completely and made keyboard and mouse the real controls. That gave
me space to focus on the part I enjoyed more: the sense of speed, weaving
through traffic, close passes, a longer run and difficulty that keeps building.

The same thing happened with the sound. The first synthetic engine ran without errors, but to me it sounded like a
rotating fan. I replaced it with
a real CC0 Hayabusa recording, then adjusted the loops, wind level and volume
after listening again. I also added oncoming traffic and softened the steering
because the later version still felt too easy and too abrupt.

This changed how I want to work as a developer. I should not confuse an unusual
feature with a good interaction, or a passing test with a finished experience.
Tests were useful for collision, timing and input maths, but they could not tell
me whether steering felt fair or an engine sounded believable. The most useful
decisions came from playing honestly, saying what I did not like, and being
willing to delete work when it was taking the project in the wrong direction.
