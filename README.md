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

## Generation and storage

Enter your own Gemini API key in **Gemini settings**. It stays in memory and is sent directly to Google's API when generating. Gemini does not create an API key for you. Projects are stored in the workspace's browser storage; they are not synchronized between platforms. ManyMotions opens externally and requires your own account.

Movie generation requires API access and billing; it has not been validated with a live key. Native photo selection, browser storage persistence, generated-video playback and downloads/export require testing on physical Android/iOS devices. In particular, browser MediaRecorder and blob download support differ between mobile WebViews; native movie export is not yet verified. Native bundle exports alone do not establish these device capabilities or produce signed app-store builds.
