# Quay FTP for Android

**Real FTP / FTPS client** with transfer queue, scheduling, folder sync, and delete-after-send.
Transfers run in a foreground service so they continue in the background.

## Features

- **FTP** and **FTPS** (explicit TLS + implicit) — pure Java, no third-party FTP libraries
- Dual-pane local / remote browser
- Upload & download with live progress
- **Folder sync** (upload or download tree, skip same-size files)
- **Delete after send** on uploads and sync-up
- **Queue** with pause / resume / cancel
- **Schedules** — once, hourly, daily, weekly
- Background **foreground service** + boot restart
- First-run installer wizard

## Download APK

1. Open [Actions](https://github.com/cstonepts-prog/quay-ops-android/actions)
2. Open the latest green **Build Quay APK** run
3. Download the **quay-ops-debug** artifact

## Build locally

```bash
echo "sdk.dir=$ANDROID_HOME" > local.properties
./gradlew :app:assembleDebug
# APK: app/build/outputs/apk/debug/app-debug.apk
```

## Architecture

| Layer | Role |
|-------|------|
| `ftp/FtpClient` | Pure-Java FTP/FTPS (PASV, LIST/MLSD, RETR, STOR) |
| `engine/TransferEngine` | Queue processor, sync, schedules |
| `QuayService` | Foreground service + wake lock |
| `QuayBridge` | `window.QuayNative.*` JS API |
| `assets/www` | UI (vanilla HTML/CSS/JS) |

## Usage

1. **Sites** → add host, port, FTP or FTPS, credentials → **Test**
2. **Browser** → select site → Connect → pick local/remote files
3. Upload / Download / Sync folder (optional **Delete after send**)
4. **Queue** shows live progress; service keeps running when app is backgrounded
5. **Schedules** for recurring jobs

Local files default to the app Downloads directory.
