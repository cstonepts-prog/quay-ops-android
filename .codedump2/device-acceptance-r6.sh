#!/usr/bin/env bash
set -Eeuo pipefail
BASE="$GITHUB_WORKSPACE/.codedump2/device-acceptance-r6-base.sh"
TMP=/tmp/codedump-device-acceptance-r6-visible-controls.sh
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

visible_loop_download = r'''DOWNLOAD_VISIBLE=0
for _ in $(seq 1 24); do
  dump_ui "$EVID/download-visibility.xml" || true
  if python3 - "$EVID/download-visibility.xml" <<'PYCHECK'
import re,sys,xml.etree.ElementTree as ET
root=ET.parse(sys.argv[1]).getroot()
for node in root.iter('node'):
    if node.attrib.get('resource-id') != 'downloadDump':
        continue
    m=re.match(r'\[(\d+),(\d+)\]\[(\d+),(\d+)\]', node.attrib.get('bounds',''))
    if not m:
        raise SystemExit(1)
    x1,y1,x2,y2=map(int,m.groups())
    raise SystemExit(0 if (x2>x1 and y2>y1 and y1>=0 and y2<=2100) else 1)
raise SystemExit(1)
PYCHECK
  then
    DOWNLOAD_VISIBLE=1
    break
  fi
  adb shell input swipe 540 1900 540 650 450 || true
  sleep 1
done
[ "$DOWNLOAD_VISIBLE" -eq 1 ] || fail 'Download part reaches unobscured positive-size bounds'
tap_node 'downloadDump' || fail 'Download part visible and targetable above fixed navigation'
sleep 3
capture 09-native-save-picker
adb shell dumpsys activity activities | tr -d '\r' | grep -E 'mResumedActivity|topResumedActivity' | grep -Eiq 'documentsui|DocumentsActivity|com\.google\.android\.documentsui|com\.android\.documentsui' || fail 'native save picker top-resumed'
pass 'native save picker opened and top-resumed'
tap_node 'android:id/button1' || fail 'native SAVE button targetable'
'''
old = '''adb shell input swipe 540 1850 540 850 500 || true
sleep 2
tap_node 'Download part' || fail 'Download part targetable after scrolling'
sleep 3
capture 09-native-save-picker
adb shell dumpsys activity activities | grep -Eiq 'documentsui|DocumentsActivity|com\\.google\\.android\\.documentsui|com\\.android\\.documentsui' || fail 'native save picker opened'
pass 'native save picker opened'
tap_node 'Save' || fail 'native save confirmation targetable'
'''
if old not in s:
    raise SystemExit('Save interaction source pattern missing')
s = s.replace(old, visible_loop_download, 1)

old = '''sleep 5
top_has_app
capture 09b-native-save-return
'''
new = '''sleep 5
top_has_app || fail 'app resumed after native save confirmation'
capture 09b-native-save-return
'''
if old not in s:
    raise SystemExit('Post-save resume source pattern missing')
s = s.replace(old, new, 1)

visible_loop_share = r'''SHARE_VISIBLE=0
for _ in $(seq 1 24); do
  dump_ui "$EVID/share-visibility.xml" || true
  if python3 - "$EVID/share-visibility.xml" <<'PYCHECK'
import re,sys,xml.etree.ElementTree as ET
root=ET.parse(sys.argv[1]).getroot()
for node in root.iter('node'):
    if node.attrib.get('resource-id') != 'shareDump':
        continue
    m=re.match(r'\[(\d+),(\d+)\]\[(\d+),(\d+)\]', node.attrib.get('bounds',''))
    if not m:
        raise SystemExit(1)
    x1,y1,x2,y2=map(int,m.groups())
    raise SystemExit(0 if (x2>x1 and y2>y1 and y1>=0 and y2<=2100) else 1)
raise SystemExit(1)
PYCHECK
  then
    SHARE_VISIBLE=1
    break
  fi
  adb shell input swipe 540 1900 540 650 450 || true
  sleep 1
done
[ "$SHARE_VISIBLE" -eq 1 ] || fail 'Share part reaches unobscured positive-size bounds'
tap_node 'shareDump' || fail 'Share part visible and targetable above fixed navigation'
'''
old = '''adb shell input swipe 540 1850 540 850 500 || true
sleep 2
tap_node 'Share part' || fail 'Share part targetable after scrolling'
'''
if old not in s:
    raise SystemExit('Share interaction source pattern missing')
s = s.replace(old, visible_loop_share, 1)

p.write_text(s)
PY
grep -q "tap_node 'continueZip'" "$TMP"
grep -q "resource-id') != 'downloadDump'" "$TMP"
grep -q "tap_node 'android:id/button1'" "$TMP"
grep -q "app resumed after native save confirmation" "$TMP"
grep -q "resource-id') != 'shareDump'" "$TMP"
bash "$TMP"
