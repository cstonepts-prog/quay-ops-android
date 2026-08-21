#!/usr/bin/env bash
# Build Quay debug APK
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
export JAVA_HOME="${JAVA_HOME:-/usr/lib/jvm/java-17-openjdk-amd64}"
export PATH="${JAVA_HOME}/bin:${PATH}"

if command -v gradle >/dev/null 2>&1; then
  GRADLE=gradle
elif [[ -x ./gradlew ]]; then
  GRADLE=./gradlew
else
  echo "Gradle not found. Install Gradle 8.5+ or use Android Studio."
  exit 1
fi

echo "sdk.dir=${ANDROID_HOME}" > "$ROOT/local.properties"
cd "$ROOT"

echo "Building Quay APK…"
"$GRADLE" :app:assembleDebug --no-daemon

APK="$ROOT/app/build/outputs/apk/debug/app-debug.apk"
if [[ -f "$APK" ]]; then
  echo "OK → $APK"
  ls -lh "$APK"
else
  echo "APK not found at $APK"
  exit 1
fi
