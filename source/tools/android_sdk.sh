#!/bin/bash
# The two Android SDK parts the APK build needs (build-tools 35.0.0 and platform 34), fetched from
# Google and checked against their SHA-1 when they are not there yet. Used by android/build.sh, so a
# fresh computer (a new Claude or Codex session, GitHub Actions) can build without setting anything up.
#   bash tools/android_sdk.sh            (into $ANDROID_SDK, default ~/sdk/android)
set -e
SDK=${ANDROID_SDK:-$HOME/sdk/android}
get() {   # <zip> <sha1> <target dir>
  [ -e "$3" ] && return 0
  local tmp; tmp=$(mktemp -d)
  echo "downloading $1 (Android SDK, once)..."
  curl -fsSL --retry 3 -o "$tmp/$1" "https://dl.google.com/android/repository/$1"
  echo "$2  $tmp/$1" | sha1sum -c --quiet -
  unzip -q "$tmp/$1" -d "$tmp/x"
  mkdir -p "$(dirname "$3")"
  mv "$tmp/x/"* "$3"
  rm -rf "$tmp"
}
get build-tools_r35_linux.zip 2cfaa0bbb2336e9ec18ed3ecea84fa2e2af607bc "$SDK/build-tools/35.0.0"
get platform-34-ext7_r03.zip 1f2e9478d6a7601425ceaa553311dc43191f103d "$SDK/platforms/android-34"
