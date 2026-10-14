Run the board game’s browser regression checks from the repository root:

```sh
python3 -m unittest discover -s tests -v
```

The tests start their own local static server and cover multiplayer setup,
collection exclusivity, camera and lighting controls, keyboard space browsing,
a dice roll and property purchase, turn handoff, earned badges, free camera panning,
automatic movement tracking, and phone/classic layouts.
External requests are blocked to verify that core board rendering is local.

Requires Python and Playwright (`python3 -m pip install playwright`). The prepared
cloud environment includes Chromium at `/usr/bin/chromium`. On other machines,
use `python3 -m playwright install chromium` or set `TEST_CHROMIUM_PATH`.

The default checks the CPU renderer. Also check the WebGL renderer with:

```sh
TEST_WEBGL=1 python3 -m unittest discover -s tests -v
```

Three.js 0.170.0 is bundled under `assets/vendor` with its MIT license. The source
npm archive was verified against the registry’s SHA-512 integrity before extraction.

Publishing: requested board updates now go directly to the main `board-game.html`
and its assets on `main`. The arcade links to that page. The separate
`previews/board-v1/` copy is retained as a historical preview; new changes do not
need to be published there first.

The root `.nojekyll` keeps GitHub Pages from running Jekyll on this static site.
The board preloads its local Three.js module while the setup screen is loading.
Versioned board links bypass a cached page but do not bypass the Pages deployment queue.

To run a complete, accelerated five-player game through the Castle Finale:

```sh
python3 tests/play_five_player_game.py --seed 174513 --output /tmp/wdwquest-five-player
```

The runner makes normal button choices and uses seeded random dice and decks.
It reads quiz answers from the question data, skips presentation waits, and uses
reduced motion and the classic view to finish a long game quickly. It never grants
cash, moves pawns directly, assigns ownership/badges, or bypasses the win rules.
The first finale answer is deliberately wrong; winning then requires the real
80-space retry lap. It records turns, card/trade events, balances, and errors in
`report.json`. The normal regression suite also covers five-player card payments,
returned pins after elimination, and cooldowns preserved when those pins are bought.

The $300 Park Hopper Bonus is covered by lap, backtracking, Security, and popup
continuation checks. See [park-hopper-audit.md](park-hopper-audit.md) for the
complete five-player balance run.

All games now use an eight-property park goal, with all six badges and five
matching pins. Pixie Dust targets missing badges; end-of-turn cash property
offers and a $100 Pin Traders shop add ways to finish a collection. See
[balance-features-audit.md](balance-features-audit.md) for the latest full run.

Firebase phone-room setup and emulator instructions are in
[../firebase/README.md](../firebase/README.md). The new `test_phone_rooms.py` suite
checks a five-phone round, seller consent for cash trades, room closure, refresh,
host presence, stale choices, and prompt sanitization. Its default transport is
simulated; set `TEST_FIREBASE_EMULATOR=1` for the actual bundled Firebase SDK and
official Authentication/Realtime Database emulators. Database authorization has
its own official-emulator suite in `firebase/rules.test.cjs`.
