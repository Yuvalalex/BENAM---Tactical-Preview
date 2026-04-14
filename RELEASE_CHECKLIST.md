# BENAM Release Checklist

## Pre-release

- Verify source and deploy trees stay aligned for any shipped change: `js/` <-> `www/js/`, `css/` <-> `www/css/`, `index.html` <-> `www/index.html`, `manifest.json` <-> `www/manifest.json`, `sw.js` <-> `www/sw.js`.
- If offline assets changed, bump the service worker cache version in both service worker files.
- Remove generated artifacts before packaging: `test-report/`, `test-results/`.

## Validation

- Install dependencies: `npm install`
- Run browser regression suite: `npm test`
- Build Android debug APK: `./build_apk.sh`
- Confirm APK exists at `android/app/build/outputs/apk/debug/app-debug.apk`

## Device smoke test

- List devices with Android SDK `adb`: `$HOME/Library/Android/sdk/platform-tools/adb devices -l`
- If a device/emulator is available, install APK: `$HOME/Library/Android/sdk/platform-tools/adb install -r android/app/build/outputs/apk/debug/app-debug.apk`
- Smoke check at least: app launch, role skip, PREP to War Room navigation, casualty add, report screen, offline reopen.

## Release gate

- README matches actual run, test, storage, and build flow.
- No console errors in smoke flow.
- No stale generated files staged by mistake.
- Android build succeeds from a clean working tree.