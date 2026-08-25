#!/usr/bin/env bash
set -Eeuo pipefail
BASE="$GITHUB_WORKSPACE/.codedump2/device-acceptance-r6-base.sh"
TMP=/tmp/codedump-device-acceptance-r6-runtime-fixed.sh
cp "$BASE" "$TMP"
python3 - "$TMP" <<'PY'
from pathlib import Path
import sys
p = Path(sys.argv[1])
s = p.read_text()

old = "tap_node 'Continue' || fail 'ZIP Continue targetable after scrolling above fixed navigation'"
new = "tap_node 'continueZip' || fail 'ZIP Continue button targetable after scrolling above fixed navigation'"
if old not in s:
    raise SystemExit('Continue selector source pattern missing')
s = s.replace(old, new, 1)

old = '''adb shell input swipe 540 1850 540 850 500 || true
sleep 2
tap_node 'Download part' || fail 'Download part targetable after scrolling'
sleep 3
capture 09-native-save-picker
adb shell dumpsys activity activities | grep -Eiq 'documentsui|DocumentsActivity|com\\.google\\.android\\.documentsui|com\\.android\\.documentsui' || fail 'native save picker opened'
pass 'native save picker opened'
tap_node 'Save' || fail 'native save confirmation targetable'
'''
new = '''for _ in 1 2 3; do
  adb shell input swipe 540 1850 540 800 500 || true
  sleep 1
done
tap_node 'downloadDump' || fail 'Download part visible and targetable above fixed navigation'
sleep 3
capture 09-native-save-picker
adb shell dumpsys activity activities | tr -d '\\r' | grep -E 'mResumedActivity|topResumedActivity' | grep -Eiq 'documentsui|DocumentsActivity|com\\.google\\.android\\.documentsui|com\\.android\\.documentsui' || fail 'native save picker top-resumed'
pass 'native save picker opened and top-resumed'
tap_node 'Save' || fail 'native save confirmation targetable'
'''
if old not in s:
    raise SystemExit('Save interaction source pattern missing')
s = s.replace(old, new, 1)

old = '''adb shell input swipe 540 1850 540 850 500 || true
sleep 2
tap_node 'Share part' || fail 'Share part targetable after scrolling'
'''
new = '''for _ in 1 2 3; do
  adb shell input swipe 540 1850 540 800 500 || true
  sleep 1
done
tap_node 'shareDump' || fail 'Share part visible and targetable above fixed navigation'
'''
if old not in s:
    raise SystemExit('Share interaction source pattern missing')
s = s.replace(old, new, 1)

p.write_text(s)
PY
grep -q "tap_node 'continueZip'" "$TMP"
grep -q "tap_node 'downloadDump'" "$TMP"
grep -q "top-resumed" "$TMP"
grep -q "tap_node 'shareDump'" "$TMP"
bash "$TMP"
