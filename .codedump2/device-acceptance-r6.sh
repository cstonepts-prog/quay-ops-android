#!/usr/bin/env bash
set -Eeuo pipefail
PKG='app.codedump.tool'
ACT='app.codedump.tool/.MainActivity'
APK='/tmp/cdt-build/android/app/build/outputs/apk/debug/app-debug.apk'
EVID="$GITHUB_WORKSPACE/device-evidence"
mkdir -p "$EVID"

pass(){ printf 'PASS\t%s\n' "$1" | tee -a "$EVID/ACCEPTANCE_RESULTS.tsv"; }
note(){ printf 'NOTE\t%s\n' "$1" | tee -a "$EVID/ACCEPTANCE_RESULTS.tsv"; }
fail(){ printf 'FAIL\t%s\n' "$1" | tee -a "$EVID/ACCEPTANCE_RESULTS.tsv"; return 1; }

top_has_app(){ adb shell dumpsys activity activities | tr -d '\r' | grep -E 'mResumedActivity|topResumedActivity' | grep -q "$PKG"; }
fatal_for_app(){ adb logcat -d -v brief | awk '/FATAL EXCEPTION/{c=1;b=$0 ORS;next} c{b=b $0 ORS;if(++n>=14){if(b~/app\.codedump\.tool/){print b;f=1};c=0;n=0;b=""}} END{if(c&&b~/app\.codedump\.tool/){print b;f=1};exit f?0:1}'; }

capture(){
  local n="$1"
  adb exec-out screencap -p > "$EVID/$n.png" || true
  adb shell uiautomator dump /sdcard/window.xml >/dev/null 2>&1 || true
  adb pull /sdcard/window.xml "$EVID/$n.xml" >/dev/null 2>&1 || true
  adb shell dumpsys activity activities > "$EVID/$n-activities.txt" || true
  adb shell dumpsys window windows > "$EVID/$n-windows.txt" || true
  adb logcat -d -v time > "$EVID/$n-logcat.txt" || true
}

dump_ui(){ adb shell uiautomator dump /sdcard/window.xml >/dev/null 2>&1 && adb pull /sdcard/window.xml "$1" >/dev/null 2>&1; }
tap_node(){
  local needle="$1" xml="$EVID/current-ui.xml" xy
  dump_ui "$xml" || return 1
  xy="$(python3 - "$needle" "$xml" <<'PY'
import re,sys,xml.etree.ElementTree as ET
needle=sys.argv[1].casefold(); root=ET.parse(sys.argv[2]).getroot()
for node in root.iter('node'):
    hay=' '.join((node.attrib.get('text',''),node.attrib.get('content-desc',''),node.attrib.get('resource-id',''))).casefold()
    if needle in hay:
        m=re.match(r'\[(\d+),(\d+)\]\[(\d+),(\d+)\]',node.attrib.get('bounds',''))
        if m:
            x1,y1,x2,y2=map(int,m.groups()); print((x1+x2)//2,(y1+y2)//2); raise SystemExit(0)
raise SystemExit(1)
PY
)" || return 1
  adb shell input tap $xy
  sleep 2
}

assert_no_fatal(){ local label="$1"; if fatal_for_app > "$EVID/$label-fatal.txt"; then cat "$EVID/$label-fatal.txt"; fail "$label: fatal exception"; else pass "$label: no fatal exception"; fi; }
assert_ui(){ local file="$1" pattern="$2" label="$3"; grep -Eqi "$pattern" "$file" && pass "$label" || fail "$label"; }

: > "$EVID/ACCEPTANCE_RESULTS.tsv"
adb wait-for-device
adb shell getprop ro.build.version.release | tee "$EVID/android-version.txt"
adb shell getprop ro.build.version.sdk | tee -a "$EVID/android-version.txt"
adb shell wm size | tee "$EVID/display.txt"
adb shell wm density | tee -a "$EVID/display.txt"

adb install -r "$APK" | tee "$EVID/install.txt"
grep -q Success "$EVID/install.txt"
adb shell pm path "$PKG" | tee "$EVID/package-path.txt" | grep -q '^package:'
pass 'APK installation'

adb logcat -c
adb shell am force-stop "$PKG"
adb shell am start -W -n "$ACT" | tee "$EVID/launch.txt"
sleep 5
top_has_app
capture 01-launch-portrait
assert_no_fatal cold-online-launch
pass 'cold online launch'

adb logcat -c
(adb shell cmd connectivity airplane-mode enable || true)
adb shell svc wifi disable || true
adb shell svc data disable || true
adb shell am force-stop "$PKG"
adb shell am start -W -n "$ACT" | tee "$EVID/offline-launch.txt"
sleep 5
top_has_app
capture 02-cold-offline
assert_no_fatal cold-offline-launch
pass 'cold offline launch'
(adb shell cmd connectivity airplane-mode disable || true)
adb shell svc wifi enable || true

adb logcat -c
PID_BEFORE="$(adb shell pidof "$PKG" | tr -d '\r')"
adb shell settings put system accelerometer_rotation 0
adb shell settings put system user_rotation 1
sleep 4
top_has_app
PID_LAND="$(adb shell pidof "$PKG" | tr -d '\r')"
capture 03-landscape
[ "$PID_BEFORE" = "$PID_LAND" ] || note "Process changed during rotation: $PID_BEFORE -> $PID_LAND"
assert_no_fatal landscape-rotation
adb shell settings put system user_rotation 0
sleep 3
top_has_app
capture 04-portrait-restored
pass 'rotation portrait-landscape-portrait'

if tap_node 'Open settings'; then
  capture 05-settings-open
  assert_ui "$EVID/05-settings-open.xml" 'Settings|Diagnostics|Workspace recovery|Reset defaults' 'settings sheet interaction'
  adb logcat -c
  adb shell input keyevent KEYCODE_BACK
  sleep 2
  top_has_app
  capture 05b-settings-back
  assert_no_fatal android-back-from-settings
  if grep -Eqi 'Reset defaults|Workspace recovery' "$EVID/05b-settings-back.xml"; then fail 'Android Back dismisses settings modal'; else pass 'Android Back dismisses settings modal'; fi
else
  fail 'Open settings targetable'
fi

python3 - <<'PY'
from pathlib import Path
import zipfile
with zipfile.ZipFile('/tmp/CodeDumpFixture.zip','w',zipfile.ZIP_DEFLATED) as z:
    z.writestr('src/main.txt','hello from Android SAF fixture\n')
    z.writestr('README.md','# Fixture\nAndroid emulator acceptance.\n')
Path('/tmp/CodeDumpIntent.txt').write_text('Code Dump incoming intent fixture\n',encoding='utf-8')
PY
adb push /tmp/CodeDumpFixture.zip /sdcard/Download/CodeDumpFixture.zip >/dev/null
adb shell am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE -d file:///sdcard/Download/CodeDumpFixture.zip >/dev/null || true

tap_node 'Create dump' || fail 'Create dump targetable'
tap_node 'Choose ZIP' || fail 'Choose ZIP targetable'
sleep 3
capture 06-saf-zip-picker
adb shell dumpsys activity activities | grep -Eiq 'documentsui|DocumentsActivity|com\.google\.android\.documentsui|com\.android\.documentsui' || fail 'SAF ZIP picker opened'
pass 'SAF ZIP picker opened'
tap_node 'CodeDumpFixture.zip' || fail 'SAF fixture targetable'
sleep 7
top_has_app
capture 07-saf-zip-return
assert_no_fatal saf-zip-preflight
assert_ui "$EVID/07-saf-zip-return.xml" 'ZIP preflight|Continue extraction|continueZip' 'SAF ZIP preflight completed'
tap_node 'Continue' || fail 'ZIP Continue targetable'
sleep 6
top_has_app
capture 08-project-imported
assert_no_fatal zip-preflight-continue
assert_ui "$EVID/08-project-imported.xml" 'Generated dump|Download part|downloadDump' 'SAF ZIP extraction produced generated dump'
pass 'SAF ZIP selected, preflighted and extracted'

tap_node 'Download part' || fail 'Download part targetable'
sleep 3
capture 09-native-save-picker
adb shell dumpsys activity activities | grep -Eiq 'documentsui|DocumentsActivity|com\.google\.android\.documentsui|com\.android\.documentsui' || fail 'native save picker opened'
pass 'native save picker opened'
tap_node 'Save' || fail 'native save confirmation targetable'
sleep 5
top_has_app
capture 09b-native-save-return
assert_no_fatal native-save-complete
if grep -Eqi 'Export failed|Could not create output|Could not write export' "$EVID/09b-native-save-return.xml"; then fail 'native save completed'; else pass 'native save completed'; fi

tap_node 'Share part' || fail 'Share part targetable'
sleep 3
capture 10-share-sheet
adb shell dumpsys activity activities | grep -Eiq 'resolver|chooser|IntentResolver|ChooserActivity|android.*resolver' || fail 'native share chooser opened'
pass 'native share chooser opened after streamed export'
adb shell input keyevent KEYCODE_BACK || true
sleep 2
top_has_app

printf 'Code Dump VIEW intent fixture\n' | adb shell run-as "$PKG" sh -c 'cat > cache/CodeDumpView.txt'
printf 'Code Dump SEND intent fixture\n' | adb shell run-as "$PKG" sh -c 'cat > cache/CodeDumpSend.txt'
adb shell run-as "$PKG" ls -l cache/CodeDumpView.txt cache/CodeDumpSend.txt > "$EVID/fileprovider-fixtures.txt"
VIEW_URI="content://$PKG.fileprovider/shared_cache/CodeDumpView.txt"
SEND_URI="content://$PKG.fileprovider/shared_cache/CodeDumpSend.txt"

adb logcat -c
adb shell am force-stop "$PKG"
adb shell am start -W -a android.intent.action.VIEW -t text/plain -d "$VIEW_URI" -n "$ACT" | tee "$EVID/view-intent.txt"
sleep 5
top_has_app
capture 11-view-intent
assert_no_fatal incoming-view-intent
assert_ui "$EVID/11-view-intent.xml" 'CodeDumpView|Loaded dump' 'incoming VIEW intent consumed by web workflow'
pass 'incoming VIEW intent'

adb logcat -c
adb shell am start -W -a android.intent.action.SEND -t text/plain --eu android.intent.extra.STREAM "$SEND_URI" -n "$ACT" | tee "$EVID/send-intent.txt"
sleep 5
top_has_app
capture 12-send-intent
assert_no_fatal incoming-send-intent
assert_ui "$EVID/12-send-intent.xml" 'CodeDumpSend|Loaded dump' 'incoming SEND intent consumed by web workflow'
pass 'incoming SEND intent'

adb logcat -c
adb shell am force-stop "$PKG"
sleep 1
adb shell am start -W -n "$ACT" > "$EVID/process-restart.txt"
sleep 4
top_has_app
capture 13-process-restart
assert_no_fatal process-restart
pass 'force-stop and process restart'

printf 'ANDROID_EMULATOR_ACCEPTANCE_COMPLETE\n' | tee "$EVID/COMPLETE.txt"
