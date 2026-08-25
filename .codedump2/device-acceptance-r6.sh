#!/usr/bin/env bash
set -Eeuo pipefail
BASE="$GITHUB_WORKSPACE/.codedump2/device-acceptance-r6-base.sh"
TMP=/tmp/codedump-device-acceptance-r6-selector-fixed.sh
cp "$BASE" "$TMP"
sed -i "s/tap_node 'Continue' || fail 'ZIP Continue targetable after scrolling above fixed navigation'/tap_node 'continueZip' || fail 'ZIP Continue button targetable after scrolling above fixed navigation'/" "$TMP"
grep -q "tap_node 'continueZip'" "$TMP"
bash "$TMP"
