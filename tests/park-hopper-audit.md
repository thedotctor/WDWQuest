# $300 Park Hopper Bonus verification

Each completed 80-space lap now credits $300 Disney Dollars to the player's
MagicBand. The popup uses the requested wording exactly:

> Four Parks, One Day! Here's A MAGIC for your next trip.

Players receive the money before resolving the space where their movement ends.
“Keep Exploring” closes the bonus popup and resumes the same player's landing
action. Transportation and card travel contribute actual movement; Security
trips do not. Backward movement reduces net progress, and recrossing an already
paid lap boundary cannot produce a second payment. Progress is tracked separately
for every player and resets for a new game.

## Browser results

The seeded five-player playthrough (`174513`) reached a real win in **706 turns**,
with **four players still active**. It exercised a failed Castle Finale, the real
80-space retry lap, and a successful second attempt. The runner handled 60 bonus
popups and reported zero JavaScript errors or state-invariant failures.

The previous no-bonus run using the same seed and decision strategy took 1,017
turns and ended with one active player. This is one automated comparison, not a
claim that every game will have the same result.

Three new regression cases cover the first and subsequent lap rewards,
backtracking, independent five-player counters, Security, and continuation into
a purchase offer. The existing browser suite also passed. A separate WebGL check
verified that the popup renders and dismisses correctly in the 3D board.

Reproduce the full game with:

```sh
python3 tests/play_five_player_game.py --seed 174513 --output /tmp/wdwquest-park-hopper-300
```
