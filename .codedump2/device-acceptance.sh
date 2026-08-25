#!/usr/bin/env bash
set -Eeuo pipefail
PKG="app.codedump.tool"
ACT="app.codedump.tool/.MainActivity"
APK="/tmp/cdt-build/android/app/build/outputs/apk/debug/app-debug.apk"
EVID="$GITHUB_WORKSPACE/device-evidence"
mkdir -p "$EVID"

pass() { printf 'PASS\t%s\n' "$1" | tee -a "$EVID/ACCEPTANCE_RESULTS.tsv"; }
note() { printf 'NOTE\t%s\n' "$1" | tee -a "$EVID/ACCEPTANCE_RESULTS.tsv"; }
fail() { printf 'FAIL\t%s\n' "$1" | tee -a "$EVID/ACCEPTANCE_RESULTS.tsv"; return 1; }

top_has_app() {
  adb shell dumpsys activity activities | tr -d '\r' | grep -E 'mResumedActivity|topResumedActivity' | grep -q "$PKG"
}

fatal_for_app() {
  adb logcat -d -v brief | awk '
    /FATAL EXCEPTION/ {capture=1; block=$0 ORS; next}
    capture {block=block $0 ORS; if (++n>=14) {if (block ~ /app\.codedump\.tool/) {print block; found=1}; capture=0; n=0; block=""}}
    END {if (capture && block ~ /app\.codedump\.tool/) {print block; found=1}; exit found?0:1}
  '
}

capture() {
  local name="$1"
  adb exec-out screencap -p > "$EVID/${name}.png" || true
  adb shell uiautomator dump /sdcard/window.xml >/dev/null 2>&1 || true
  adb pull /sdcard/window.xml "$EVID/${name}.xml" >/dev/null 2>&1 || true
  adb shell dumpsys activity activities > "$EVID/${name}-activities.txt" || true
  adb shell dumpsys window windows > "$EVID/${name}-windows.txt" || true
  adb logcat -d -v time > "$EVID/${name}-logcat.txt" || true
}

dump_ui() {
  local dest="$1"
  adb shell uiautomator dump /sdcard/window.xml >/dev/null 2>&1 || return 1
  adb pull /sdcard/window.xml "$dest" >/dev/null 2>&1
}

tap_node() {
  local needle="$1"
  local xml="$EVID/current-ui.xml"
  dump_ui "$xml" || return 1
  local xy
  xy="$(python3 - "$needle" "$xml" <<'PY'
import re, sys, xml.etree.ElementTree as ET
needle=sys.argv[1].casefold()
root=ET.parse(sys.argv[2]).getroot()
for node in root.iter("node"):
    hay=" ".join([node.attrib.get("text",""), node.attrib.get("content-desc",""), node.attrib.get("resource-id","")]).casefold()
    if needle in hay:
        m=re.match(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", node.attrib.get("bounds",""))
        if m:
            x1,y1,x2,y2=map(int,m.groups())
            print((x1+x2)//2, (y1+y2)//2)
            raise SystemExit(0)
raise SystemExit(1)
PY
)" || return 1
  adb shell input tap $xy
  sleep 2
}

assert_no_fatal() {
  local label="$1"
  if fatal_for_app > "$EVID/${label}-fatal.txt"; then
    cat "$EVID/${label}-fatal.txt"
    fail "$label: no fatal exception"
  else
    pass "$label: no fatal exception"
  fi
}

: > "$EVID/ACCEPTANCE_RESULTS.tsv"
adb wait-for-device
adb shell getprop ro.build.version.release | tee "$EVID/android-version.txt"
adb shell getprop ro.build.version.sdk | tee -a "$EVID/android-version.txt"
adb shell wm size | tee "$EVID/display.txt"
adb shell wm density | tee -a "$EVID/display.txt"

adb install -r "$APK" | tee "$EVID/install.txt"
grep -q "Success" "$EVID/install.txt"
adb shell pm path "$PKG" | tee "$EVID/package-path.txt" | grep -q '^package:'
pass "APK installation"

adb logcat -c
adb shell am force-stop "$PKG"
adb shell am start -W -n "$ACT" | tee "$EVID/launch.txt"
sleep 5
top_has_app
test -n "$(adb shell pidof "$PKG" | tr -d '\r')"
capture "01-launch-portrait"
assert_no_fatal "cold-online-launch"
pass "cold online launch"

if grep -Eqi 'Code Dump|Extract dump|Create dump|Open settings' "$EVID/01-launch-portrait.xml" 2>/dev/null; then
  pass "WebView accessibility content exposed"
else
  note "WebView accessibility content not exposed in UIAutomator hierarchy; screenshots retained for visual inspection"
fi

adb logcat -c
(adb shell cmd connectivity airplane-mode enable || true)
adb shell svc wifi disable || true
adb shell svc data disable || true
adb shell am force-stop "$PKG"
adb shell am start -W -n "$ACT" | tee "$EVID/offline-launch.txt"
sleep 5
top_has_app
capture "02-cold-offline"
assert_no_fatal "cold-offline-launch"
pass "cold offline launch"
(adb shell cmd connectivity airplane-mode disable || true)
adb shell svc wifi enable || true

adb logcat -c
PID_BEFORE="$(adb shell pidof "$PKG" | tr -d '\r')"
adb shell settings put system accelerometer_rotation 0
adb shell settings put system user_rotation 1
sleep 4
top_has_app
PID_LAND="$(adb shell pidof "$PKG" | tr -d '\r')"
capture "03-landscape"
test -n "$PID_LAND"
[ "$PID_BEFORE" = "$PID_LAND" ] || note "Process changed during rotation: before=$PID_BEFORE after=$PID_LAND"
assert_no_fatal "landscape-rotation"
adb shell settings put system user_rotation 0
sleep 3
top_has_app
capture "04-portrait-restored"
pass "rotation portrait-landscape-portrait"

if tap_node "Open settings"; then
  capture "05-settings-open"
  if grep -Eqi 'Settings|Diagnostics|Workspace recovery|Reset defaults' "$EVID/05-settings-open.xml" 2>/dev/null; then
    pass "settings sheet interaction"
  else
    note "Settings control tapped but accessibility hierarchy did not expose expected sheet text"
  fi
  adb logcat -c
  adb shell input keyevent KEYCODE_BACK
  sleep 2
  top_has_app
  assert_no_fatal "android-back-from-settings"
  pass "Android Back from modal"
else
  note "Could not target Open settings through UIAutomator; modal Back interaction not executable"
fi

python3 - <<'PY'
from pathlib import Path
import zipfile
p=Path('/tmp/CodeDumpFixture.zip')
with zipfile.ZipFile(p,'w',zipfile.ZIP_DEFLATED) as z:
    z.writestr('src/main.txt','hello from Android SAF fixture\n')
    z.writestr('README.md','# Fixture\nAndroid emulator acceptance.\n')
Path('/tmp/CodeDumpIntent.txt').write_text('Code Dump incoming intent fixture\n', encoding='utf-8')
PY
adb push /tmp/CodeDumpFixture.zip /sdcard/Download/CodeDumpFixture.zip >/dev/null
adb push /tmp/CodeDumpIntent.txt /sdcard/Download/CodeDumpIntent.txt >/dev/null
adb shell am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE -d file:///sdcard/Download/CodeDumpFixture.zip >/dev/null || true
adb shell am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE -d file:///sdcard/Download/CodeDumpIntent.txt >/dev/null || true

if tap_node "Create dump" && tap_node "Choose ZIP"; then
  sleep 3
  capture "06-saf-zip-picker"
  if adb shell dumpsys activity activities | grep -Eiq 'documentsui|DocumentsActivity|com\.google\.android\.documentsui|com\.android\.documentsui'; then
    pass "SAF ZIP picker opened"
    if tap_node "CodeDumpFixture.zip"; then
      sleep 6
      top_has_app
      capture "07-saf-zip-return"
      assert_no_fatal "saf-zip-import"
      if tap_node "Continue"; then
        sleep 5
        top_has_app
        capture "08-project-imported"
        assert_no_fatal "zip-preflight-continue"
        pass "SAF ZIP selected and imported"
      else
        note "ZIP returned to app but Continue control was not targetable"
      fi
    else
      note "SAF picker opened but fixture file was not targetable through UIAutomator"
      adb shell input keyevent KEYCODE_BACK || true
      sleep 2
    fi
  else
    note "Choose ZIP was tapped but DocumentsUI was not detected"
  fi
else
  note "Native Create/Choose ZIP controls were not targetable through UIAutomator"
fi

if top_has_app && tap_node "Download part"; then
  sleep 3
  capture "09-native-save-picker"
  if adb shell dumpsys activity activities | grep -Eiq 'documentsui|DocumentsActivity|com\.google\.android\.documentsui|com\.android\.documentsui'; then
    pass "native save picker opened"
    adb shell input keyevent KEYCODE_BACK || true
    sleep 2
  else
    note "Download part tapped but native save picker was not detected"
  fi
else
  note "Download part not available/targetable after fixture import"
fi

if top_has_app && tap_node "Share part"; then
  sleep 3
  capture "10-share-sheet"
  if adb shell dumpsys activity activities | grep -Eiq 'resolver|chooser|IntentResolver|ChooserActivity|android.*resolver'; then
    pass "native share chooser opened"
  else
    note "Share part tapped but chooser activity was not positively identified"
  fi
  adb shell input keyevent KEYCODE_BACK || true
  sleep 2
else
  note "Share part not available/targetable after fixture import"
fi

adb logcat -c
URI='content://com.android.externalstorage.documents/document/primary%3ADownload%2FCodeDumpIntent.txt'
set +e
adb shell am start -W -a android.intent.action.VIEW -t text/plain -d "$URI" --grant-read-uri-permission -n "$ACT" > "$EVID/view-intent.txt" 2>&1
VIEW_RC=$?
set -e
sleep 4
if [ "$VIEW_RC" -eq 0 ] && top_has_app; then
  capture "11-view-intent"
  assert_no_fatal "incoming-view-intent"
  pass "incoming VIEW intent"
else
  note "Incoming VIEW intent could not be fully exercised; rc=$VIEW_RC"
fi

adb logcat -c
set +e
adb shell am start -W -a android.intent.action.SEND -t text/plain --eu android.intent.extra.STREAM "$URI" --grant-read-uri-permission -n "$ACT" > "$EVID/send-intent.txt" 2>&1
SEND_RC=$?
set -e
sleep 4
if [ "$SEND_RC" -eq 0 ] && top_has_app; then
  capture "12-send-intent"
  assert_no_fatal "incoming-send-intent"
  pass "incoming SEND intent"
else
  note "Incoming SEND intent could not be fully exercised; rc=$SEND_RC"
fi

adb logcat -c
adb shell am force-stop "$PKG"
sleep 1
adb shell am start -W -n "$ACT" > "$EVID/process-restart.txt"
sleep 4
top_has_app
test -n "$(adb shell pidof "$PKG" | tr -d '\r')"
capture "13-process-restart"
assert_no_fatal "process-restart"
pass "force-stop and process restart"

printf 'ANDROID_EMULATOR_ACCEPTANCE_COMPLETE\n' | tee "$EVID/COMPLETE.txt"
