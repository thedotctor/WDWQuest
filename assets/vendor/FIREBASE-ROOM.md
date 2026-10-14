# Firebase room SDK

`firebase-room-sdk.js` bundles only Firebase app, anonymous authentication, and
Realtime Database exports used by `assets/firebase/client.js`.

- Official package: `firebase@13.0.0` from https://www.npmjs.com/package/firebase
- Source: https://github.com/firebase/firebase-js-sdk
- Build tool: `esbuild@0.25.5`, browser ESM, minified, linked legal comments
- License notices: `firebase-room-sdk.js.LEGAL.txt`

To reproduce, install the pinned packages outside the checkout, create an entry
that exports the imports listed in `assets/firebase/client.js`, then bundle:

```sh
/tmp/wdw-firebase/node_modules/.bin/esbuild /tmp/wdw-firebase/sdk-entry.js \
  --bundle --format=esm --platform=browser --minify --legal-comments=linked \
  --outfile=assets/vendor/firebase-room-sdk.js
```
