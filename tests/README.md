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
