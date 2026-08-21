# Quay for Android

FTP operations console as a native Android APK with **background queue and scheduling**.

## Download the APK

1. Open **[Actions](../../actions)** → workflow **Build Quay APK**
2. Open the latest successful run
3. Download the artifact **`quay-ops-debug`**
4. Unzip → install `app-debug.apk` on your device

Or trigger a build manually: **Actions → Build Quay APK → Run workflow**.

## What you get

| Piece | Role |
|-------|------|
| **MainActivity** | Full-screen WebView hosting the Quay console |
| **QuayService** | Foreground service — keeps transfers alive when the UI is backgrounded |
| **BootReceiver** | Restarts the service after reboot (optional) |
| **QuayBridge** | `window.QuayNative` JS bridge for platform + toasts |
| **assets/www** | The full Quay web app (queue, schedules, fleet, installer) |

### Background behaviour

- Sticky notification: **Quay · transferring** / **Quay · background**
- Partial wake lock while jobs are active
- Battery-optimisation exemption request on first launch
- Service type: `dataSync` (Android 14+)
- Status polled from the JS engine every ~2.5s via `window.__quayStatus()`

## Build locally

```bash
# Point at your SDK
echo "sdk.dir=$HOME/Android/Sdk" > local.properties

gradle :app:assembleDebug
# or Android Studio → Build → Build APK(s)
```

Output: `app/build/outputs/apk/debug/app-debug.apk`

```bash
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

## Package id

`com.quay.ops` · minSdk 26 · targetSdk 34

## Permissions

- `INTERNET`, `ACCESS_NETWORK_STATE`
- `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_DATA_SYNC`
- `POST_NOTIFICATIONS`, `WAKE_LOCK`
- `RECEIVE_BOOT_COMPLETED`
- `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`

## Notes

- Transfers are simulated in-browser (same engine as the web app). The service keeps the process and engine alive under a foreground notification.
- For real FTP sockets you would add a native client (e.g. Apache Commons Net / JSch) and call it from the bridge; the UI and queue model already match that shape.
- First launch shows the intelligent installer wizard.
