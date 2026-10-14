# Firebase phone room validation

The published Web app settings target the user's `wdwquest` Firebase project.
The existing GitHub Pages site remains the frontend host. Anonymous sign-in was
verified against that live project with a temporary test account, which was then
deleted. The live database still denied room access before the user's rules were
published; no production room or game state was written during that check.

## Passed checks

- Existing local board regression suite: **20 tests passed**.
- Multi-browser integration using a simulated local shared-data transport:
  **7 tests passed**. This run alone does not establish Firebase SDK/rule behavior.
- The same **7 browser tests passed with Firebase 13.0.0 and the official
  Authentication and Realtime Database emulators**, in a `demo-wdwquest` namespace.
- Official-emulator rule authorization suite: **5 tests passed**.

The phone checks covered a complete round with five independent browser identities,
phone rolls and answers, turn handoff, cash offer edits, seller-only consent,
controller refresh without duplicate enrollment, host presence loss/return,
stale or wrong-player commands, safe prompt rendering, and ending a room while
leaving the board available for local play. No page exceptions occurred.

The rule checks proved that room listing and unauthenticated reads are denied;
only the host can change state/catalog; host identity cannot be replaced; members
can only enroll themselves and cannot change setup after play starts; commands
require the selected actor and exact prompt revision; oversized fields are denied;
members cannot impersonate host presence; and expired rooms reject player game
access. The database emulator accepted the rules with HTTP 200.

## Limits

This is a shared-screen party mode: one open host page runs the existing engine.
The server synchronizes choices and state; it does not run the game independently.
Closing or refreshing the host loses the running game. Phone refreshes and network
reconnections retain a seat in the same browser. Rooms expire after 24 hours and
are removed by End Room; abandoned expired records need console cleanup.

No physical iPad performance test or full-length five-phone game was run.
Live multiplayer remains dependent on publishing these rules in the user's
Firebase console. Headless tests used reduced motion and the software renderer.

The SDK is bundled locally. Updates send changed state fields only; the 3D scene,
animation frames, answer keys, and full trivia bank are not transmitted to phones.
