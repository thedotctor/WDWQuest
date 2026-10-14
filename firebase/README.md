# Free Firebase phone rooms

The computer or iPad hosting `board-game.html` runs the existing game and renders
the animated board. Phones open `board-controller.html`. Only small lobby, prompt,
score, presence, and choice messages go through Realtime Database. There are no
Cloud Functions, paid servers, or Firebase Hosting requirements.

## Connect your project

1. Open https://console.firebase.google.com/ and create **WDWQuest** on the free
   **Spark** plan. Google Analytics is optional; it is not used by this game.
2. Under **Build → Authentication → Get started → Sign-in method**, enable
   **Anonymous**. Players do not enter an email or password.
3. Under **Build → Realtime Database**, create a database. Choose **locked mode**,
   not temporary public test rules. Copy its full HTTPS database URL.
4. Open the database **Rules** tab. Replace the rules with
   [database.rules.json](database.rules.json), then click **Publish**.
5. Under **Project settings → General → Your apps**, add a **Web** app (`</>`).
   Register it; Firebase Hosting is not required. Copy the `firebaseConfig` object.
6. Fill [config.js](../assets/firebase/config.js) with that public object, including
   `databaseURL`. For example:

   ```js
   window.WDW_FIREBASE_CONFIG = {
     apiKey: "YOUR_WEB_API_KEY",
     authDomain: "YOUR_PROJECT.firebaseapp.com",
     databaseURL: "https://YOUR_DATABASE.firebasedatabase.app",
     projectId: "YOUR_PROJECT",
     appId: "YOUR_WEB_APP_ID"
   };
   ```

   Copy the actual URL from your console; some regions use `firebaseio.com`.
   These web settings are public. Do not use service-account/private keys.
7. Under Authentication settings, add **thedotctor.github.io** to authorized
   domains if needed. Publish the config file to GitHub Pages.

Use the existing Firebase connection for later features; do not create a separate
project per game. Check the console's current Spark limits and usage before a
larger public launch. Stay on Spark to avoid enabling usage-based billing.

## Play

1. On the shared-screen computer/iPad, choose **Host with Phones**.
2. Players open the controller link and enter the six-character room code.
3. Each chooses a different name, playing piece, and starting pin.
4. The host chooses **Start Adventure** when everyone is ready.
5. The current player's phone shows the game's normal choices and questions.
   Trade acceptance moves to the other player's phone. Everyone has their own
   money and collection view. To change a cash offer, use **Update Amount**.
6. On the host, choose **Fullscreen Board** above the 3D board to show only the
   animated board. Questions, choices, and Snack Break pictures appear on phones.
   Use **Exit fullscreen** or Escape to restore the host controls. Devices without
   native fullscreen use the available browser viewport instead.

Keep the host page open, in the foreground, and the device awake. Screen wake
lock is requested when supported. Phone refreshes reconnect the same anonymous
seat in the same browser; switching browser/private mode creates a new identity.
Network interruptions reconnect, but closing/reloading the host loses its running
game. This first version does not restore a game after the host page closes.

Choose **End Room** to disconnect phones and remove the room data; a running board
can continue in local mode. Rooms expire after 24 hours; abandoned
expired rooms can be removed in the console. Automatic scheduled cleanup would
require another service and is not part of this free version.

## Access rules and validation

The host alone writes game state. Members cannot edit money, ownership, or scores.
Only the player selected by the host's current prompt can submit a command, and
its revision must match. The host checks the live control and ignores duplicate
or stale commands. Players cannot enroll or change setup after the game begins.
Room lists cannot be read; a valid code is needed. Expired rooms reject player
reads and commands. A host can remove a room it owns.

## Local validation without a Firebase account

The full integration and access-rule tests use the official Firebase Authentication
and Realtime Database emulators with a `demo-wdwquest` project; they do not contact
or write to a live project. Node 24.12+ and Java 21 are required by the pinned tools.

Install the pinned tools outside the repository, then run:

```sh
npm --cache /tmp/wdw-npm-cache install --prefix /tmp/wdw-firebase --no-audit --no-fund \
  firebase@13.0.0 firebase-tools@15.33.0 esbuild@0.25.5 @firebase/rules-unit-testing@6.0.0
cd firebase
FIREBASE_EMULATORS_PATH=/tmp/wdw-firebase-emulators /tmp/wdw-firebase/node_modules/.bin/firebase emulators:start --only auth,database --project demo-wdwquest
```

From another terminal at the repository root:

```sh
node --test firebase/rules.test.cjs
TEST_FIREBASE_EMULATOR=1 python3 -m unittest discover -s tests -p test_phone_rooms.py -v
```

Run the rule checks and browser checks sequentially: the rules suite clears its
test namespace. Without `TEST_FIREBASE_EMULATOR=1`, browser tests substitute a
small local shared-data transport; that fast mode checks interface behavior but
does not test the Firebase security rules or SDK.

In environments where Node proxies also intercept loopback connections, run the
local rule tests with `env -u HTTP_PROXY -u http_proxy -u HTTPS_PROXY -u https_proxy`
before `node --test`. All rule-test destinations are loopback emulator endpoints.
If the Firebase CLI's initial rule upload is affected, start its auth emulator
separately, start the verified database JAR on 127.0.0.1:9000, then run the rule
suite to upload the rules into the demo namespace. Keep production network routing
and TLS verification intact.

The SDK is bundled locally in `assets/vendor/firebase-room-sdk.js`; production
does not fetch JavaScript from a CDN. Its versions/licenses are documented beside
the bundle. Emulator routing is accepted only on loopback pages.
