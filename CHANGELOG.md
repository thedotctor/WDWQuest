# WDWQuest Changelog

## v0.9.1 - Animated Board Movement
- Added an animated, tappable six-sided die to the Board Game.
- Player pawns now move one board space at a time after a roll.
- Added distinct pawn colors for up to 8 players.
- Transportation spaces now animate the pawn's extra movement.
- Added reduced-motion support so the game still works cleanly without animation.

## v0.9.0 - WDWQuest Board Game
- Added the first playable WDWQuest Board Game as a separate game page.
- Board Game supports 1 to 8 players; the other WDWQuest games remain 1 to 4 players.
- Added a 24-space Walt Disney World board with attractions, trivia, transportation, special spaces, and a Castle Finale.
- Players begin with $1,500 Disney Dollars.
- Unowned attractions require a correct trivia answer before they can be purchased.
- Landing on another player's attraction charges rent.
- Correct trivia can earn six category badges: Magic Kingdom, EPCOT, Hollywood Studios, Animal Kingdom, Resorts & Dining, and Disney History.
- Players with all six badges must reach the Castle Finale and answer the final question correctly to win.
- Added automatic turn advancement, passing-Park-Entrance bonuses, transportation moves, and a game log.

## v0.8.6 - iPhone Player Name Fix
- Improved Player Setup so Player 1 through Player 4 behave as true placeholder text.
- Added a safeguard for iPhone/Safari restoring the default player name as a real input value.
- If a default Player N value is present, typing the first character clears it automatically.

## v0.8.5 - Player Name Placeholders
- Player 1 through Player 4 now appear as placeholder text in Player Setup.
- The placeholder disappears automatically as soon as a player types a custom name.
- Leaving a name blank still falls back to Player 1, Player 2, and so on when the game starts.

## v0.8.4 - Trivia Setup Flow
- Added a Trivia difficulty screen after Player Setup and before gameplay.
- Removed the Trivia park filter.
- Removed the in-game difficulty dropdown.
- Added Casual, Fan, Expert, and Mixed difficulty choices before the game starts.

## v0.8.3 - Automatic Turn Rotation
- Automatically advances to the next player after each completed question or round.
- Solo games remain on Player 1.
- Trivia, Clues, History, Jeopardy, and Pin Drop rotate after the answer/result is completed.
- Photo Mode rotates after the photo is correctly completed.
- Points are awarded to the current player before the turn advances.

## v0.8.2 - Arcade Repair
- Repaired broken player-score JavaScript that could print source code onto the page.
- Restored the Home screen, shared player scoreboards, and Jeopardy board rendering.
- Kept solo through 4-player support across every game.
- Verified the main arcade JavaScript parses successfully before publishing.

## v0.8.1 - Solo to Four Players
- Every WDWQuest game can now be played solo or with up to 4 players.
- Player Setup now begins with Player 1 instead of forcing two teams.
- Players can be added or removed until the game has between 1 and 4 players.
- Updated Pin Drop to support solo play as well.

## v0.8.0 - Team Play Everywhere
- Added a Team Setup page before Trivia, Photo, Clues, History, Jeopardy, and Pin Drop.
- Start with 2 teams and add up to 4 total.
- Added separate live team scores to every game.
- Tap a team during play to choose who is answering or playing the current round.
- Pin Drop now carries the selected team names into the map game and scores each team separately.
- Removed the overall stats scoreboard from the Home page so the arcade launcher is cleaner.
- The full Stats page remains available from navigation.

## v0.7.0 - Jeopardy Team Play
- Added a team setup screen before Jeopardy category selection.
- Start with 2 teams and add up to 4 total.
- Teams can be given custom names.
- Each team has its own live score on the Jeopardy board.
- Tap a team to make it the active answering team.
- Correct answers add the clue value; incorrect answers subtract it.

## v0.6.3 - Jeopardy Typing-Only Suggestions
- Removed the manual Answers picker from Jeopardy.
- Answer suggestions now stay completely hidden until the player types.
- This prevents the full answer list from opening immediately when a clue is selected on iPhone.

## v0.6.2 - Jeopardy Suggestion Timing
- Jeopardy answer suggestions now stay hidden until the player starts typing.
- The Answers picker still opens the full answer list on demand.

## v0.6.1 - Jeopardy Answer Picker
- Added a visible Answers picker to every Jeopardy clue.
- Tapping the Jeopardy answer field now opens the full current-board answer list.
- Kept live type-to-search filtering.
- Verified all 400 Jeopardy clues contain valid answer data.

## v0.6.0 - Full iPhone Support
- Added iPhone-responsive styling across Home, Trivia, Photo, Clues, History, Jeopardy, Stats, and Changelog.
- Added safe-area spacing for notched and Dynamic Island iPhones.
- Increased tap targets and made mobile game actions full-width.
- Set form controls to iPhone-friendly sizing to prevent Safari input zoom.
- Improved top navigation as a smooth horizontal strip on narrow screens.
- Improved Photo Mode sizing and one-column answer layouts.
- Improved History, Stats, and changelog layouts for narrow displays.
- Improved Jeopardy category selection and horizontal board swiping.
- Improved Pin Drop photo, map, zoom buttons, scoring controls, and spacing.
- Removed a touch-action rule that could interfere with map gestures on iPhone.

## v0.5.0 - 400-Clue Jeopardy Bank
- Expanded WDW Jeopardy to 20 selectable categories.
- Every category now contains 20 clues.
- Each category has 4 different clues for each value: $100, $200, $300, $400, and $500.
- Total Jeopardy bank: 400 clues.
- Building a board randomly selects one clue at each value from each selected category.
- Rebuilding a category during the same Jeopardy session avoids immediately repeating the same clue/value combination.
- Added Queues & Details, Opening Years & Milestones, and Animals & Nature.

## v0.4.0 - Custom Jeopardy Builder
- WDW Jeopardy now starts with a category-selection screen.
- Players choose exactly 5 categories to build their own board.
- Added 17 selectable categories and 85 Jeopardy clues.
- Added Surprise Me to choose 5 random categories.
- Searchable answer suggestions now use the 25 answers on the current board.
- The board generator already supports multiple clues per dollar value for future question packs.

## v0.3.2 - Custom Jeopardy Autocomplete
- Replaced the browser datalist with a custom live-search dropdown.
- Matching Jeopardy answers appear visibly as the user types.
- Suggestions can be clicked to fill the answer.
- Arrow Up/Down navigate suggestions.
- Enter selects an active suggestion or submits the typed answer.

## v0.3.1 - Searchable Jeopardy Answers
- Added a searchable answer dropdown to WDW Jeopardy.
- Typing in the answer box filters all Jeopardy answers.
- Players can select an answer from the browser suggestion list.
- Pressing Enter now submits the current answer.

## v0.3.0 - WDW Pin Drop
- Published WDW Pin Drop as an endless map game.
- Uses the 100-photo WDW photo library.
- Players click an interactive map to place their guess.
- Each location scores by distance from the target.
- Pin Drop continues indefinitely instead of ending after five rounds.
- Pin Drop lives in `pin-drop.html` so map code is isolated from the main arcade.
- Main arcade remains based on the proven v0.2.5 engine.

## v0.2.5 - Photo Window
- Standardized Photo Mode at approximately 600 × 400 px maximum on desktop.

## v0.2.3 - Photo Loading Fix
- Corrected Wikimedia image loading and added fallbacks.

## v0.2.1 - Photo Pack 1
- Added 100 reusable Walt Disney World photos with attribution.

## v0.2
- Added Photo Where Am I?
- Added What Was Here Before?
- Rebuilt the arcade-style home screen.

## v0.1
- Initial WDWQuest release.
- Trivia, clue-based Where Am I?, Jeopardy, stats, and achievements.
