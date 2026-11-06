# PROVID

An Expo app for Android, iOS, and web. Describe a movie idea, upload or generate character portraits, add names, ages and creative direction, paste the full screenplay, then generate and refine individual shots.

## Develop

Requires Node.js 20.19.4 or newer and npm. Expo SDK 54 dependency versions are recorded in package-lock.json.

```sh
npm ci
npm start
```

Use `npm run web` for web, `npm run android` for an available Android emulator/device, or `npm run ios` for an available iOS simulator (macOS required). Use an Expo Go version compatible with SDK 54 on devices. If Expo's online metadata service is unavailable, prefix commands with `EXPO_OFFLINE=1`.

`npm run export:web` builds the web app into `web-build/`. Native bundle validation: `npm run prepare:studio` followed by `npx expo export --platform android --platform ios --output-dir /tmp/provid-native-export`.

The existing studio in `dist/` is bundled into an embedded workspace by `scripts/bundle-studio.mjs`. Expo uses React Native WebView on Android/iOS and an iframe on web. This is an Expo shell around the browser workspace, not a rewrite of its controls into native components. The start/export scripts rebuild the embedded HTML after studio changes. The original static app can still run with `python3 -m http.server 8000 --directory dist`.

## Branding

Logo, app icon, Android adaptive icon, splash screen and favicon live in `assets/` (the web copies are in `dist/`). They are configured in `app.json`. To regenerate them after changing colors or shapes, run `python3 scripts/make-brand.py` (needs Pillow and numpy). Native splash and icon changes only show in a new development or production build, not in Expo Go.

## Video generators

Choose one in **Settings**:

- **Gemini Omni** (paid): best quality, up to three character references per shot, dialogue and sound, and edits that continue the previous result. Google has no free API tier for video.
- **Magic Hour** (free credits): your own Magic Hour API key; renders 5-second 480p shots with the `ltx-2.5` model from one character image. Free credits are small, and the account may need a plan for API use. Touch-ups re-render the shot with your change added to the original direction.
- **Your own video server** (free): runs on your GPU, see `server/README.md`.

The Gemini key is still used to plan shots from your script, which works on Google's free text tier. The free providers were checked against a mock of their documented APIs, not live accounts. Browsers need Magic Hour and your server to allow cross-origin requests, which is unverified.

## Generation and storage

Enter your own Gemini API key in **Gemini settings**. It stays in memory and is sent directly to Google's API when generating. Gemini does not create an API key for you. Projects are stored in the workspace's browser storage; they are not synchronized between platforms. ManyMotions opens externally and requires your own account.

Movie generation requires API access and billing; it has not been validated with a live key. Native photo selection, browser storage persistence, generated-video playback and downloads/export require testing on physical Android/iOS devices. In particular, browser MediaRecorder and blob download support differ between mobile WebViews; native movie export is not yet verified. Native bundle exports alone do not establish these device capabilities or produce signed app-store builds.
