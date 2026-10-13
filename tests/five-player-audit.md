# Five-player game audit — October 13, 2026

The final browser run completed a real game with five players. Emery won the
Castle Finale after 1,017 completed turns and 3,919 UI actions. The first finale
answer was intentionally wrong; the game required the real 80-space retry lap
before the second, successful attempt. No cash, badges, ownership, positions, or
victory requirements were granted or bypassed.

## Bugs reproduced and fixed

1. **Cards created negative balances.** A $100 expense could turn $10 into −$90;
   player-to-player gifts could make several players negative. Card payments now
   use available cash and report the amount actually paid. Unpayable card
   shortfalls are waived; party payments share available whole dollars fairly.
   Elimination still follows the unpaid-rent rule.
2. **Eliminated players stranded their pins.** Their designs stayed excluded from
   doubles purchases and Cast Member inventories even though active players could
   no longer trade with them. Bankruptcy now returns pins as well as properties
   to circulation. Used power-pin cooldowns remain consumed after transfer.
3. **Stale Snack Break photo callbacks altered closed or newer popups.** A late
   image failure threw a null-element error after the popup closed, or replaced
   the next snack's image with the old failure message. Image and mask callbacks
   now update only their own active photo/frame.

## Final verification

- Final full-game seed: `174513`; five unique tokens and starting pins.
- Zero JavaScript errors and zero money/property/pin invariant failures.
- 95 Magic & Mischief draws, 45 transportation bonus rolls, 21 rent payments,
  4 bankruptcies, 15 doubles pin purchases, 14 accepted property trades,
  3 completed Cast Member pin trades, 48 Snack Breaks, and 159 autograph visits.
- Wrong trivia answers and the failed finale/retry were exercised.
- The ten existing/financial browser checks passed, followed by the new Snack
  Break callback regression check.
- Separate five-player WebGL check passed: all five 3D pawns, animated dice,
  purchase and turn handoff, pawn camera follow/free roam, and fifth-player
  Security travel, missed turn, and return. Focused player pin-trade, cooldown,
  and Security cases also passed.

## Scope and remaining concern

The long run uses normal button choices, seeded random dice/decks, and quiz
answers read from the question data. Presentation waits are skipped; reduced
motion and the classic board make thousands of turns practical to automate.
External photos are blocked by the fixture, so this is not a production photo
availability check. WebGL presentation is covered separately.

Pacing remains a design concern: four players were eliminated before the finale,
and the surviving player's collection requirements kept this particular run
long. This is one automated strategy and seed, not a prediction for every game.
The economy and winning requirements were not rebalanced in this change.

Reproduce the completed run:

```sh
python3 tests/play_five_player_game.py --seed 174513 --output /tmp/wdwquest-five-player
```
