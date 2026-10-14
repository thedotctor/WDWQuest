# Eight-property quest and balance features

The board now uses one rule set for every game: collect all six badges, own at
least eight properties from one park, and hold all five pins from that same park.
There is no Standard/Short mode selector. Any eight of the park's ten properties
meet the property goal; the nighttime show is one eligible property.

## New progress options

- Pixie Dust chooses a category for a badge the player still needs. It returns to
  any category after all six are earned. Park Trivia and purchase questions remain
  themed to the landed park, and a retry keeps its category.
- End-of-turn property deals offer either the existing one-for-one swap or a cash
  offer. A cash buyer need not already own a property. The seller must accept;
  only then do money and ownership transfer. One offer is allowed per turn.
  Whole-dollar amounts must be positive and affordable. Acceptance rechecks both
  players, the property owner, and the buyer's available money.
- Pin Traders offers one missing design for $100 per visit, independently of the
  player's one pin trade. Regular park pins have extra copies, enabling multiple
  players to complete the same park set. Optional power pins remain exclusive to
  one active player; their consumed cooldowns remain consumed.
- The existing $300 Park Hopper Bonus remains in effect.

## Verification

Six new browser regressions cover eight-property eligibility, remaining badge
and pin requirements, missing-category questions, retained park routing, cash
acceptance/decline and invalid offers, duplicate-action protection, affordable
pin purchases, regular park copies, unique powers, and purchase-plus-trade visits.
The prior browser checks also pass. A five-player WebGL smoke confirmed cash
offers and the shop work with the 3D board.

The complete seeded game (`174513`) finished in **234 completed turns**, with
three players still active, **zero JavaScript errors**, and no money/property/pin
invariant failures. It used 19 accepted cash offers and seven Pin Traders shop
purchases. Drew missed the first finale, completed the required 80-space retry
lap, and then won through the real finale UI.

A separate natural finish reached a win in 221 turns: Casey entered and won
while Drew was still completing his retry lap. That is valid game behavior. The
reusable runner now has other ready players voluntarily continue rolling until
its first challenger completes the retry, so the test always exercises that
rule without bypassing or changing game state.

These are accelerated automated strategies, not predictions for every human
game. Quiz answers are read from the question data, and presentation waits are
skipped. The earlier lap-bonus-only run needed 706 turns; the additional options
reduce collection bottlenecks in this tested scenario.

```sh
python3 -m unittest discover -s tests -v
python3 tests/play_five_player_game.py --seed 174513 --output /tmp/wdwquest-balanced-eight
```
