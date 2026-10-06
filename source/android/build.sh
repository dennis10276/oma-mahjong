#!/bin/bash
# Builds Oma's Mahjong APK without Gradle (aapt2 + javac + d8 + apksigner).
set -e
cd "$(dirname "$0")"
SDK=${ANDROID_SDK:-/home/claude/sdk/android}
BT=$SDK/build-tools/35.0.0
JAR=$SDK/platforms/android-34/android.jar
KS=${KEYSTORE:-keystore/oma-mahjong.jks}
PASS=$(cat keystore/password.txt)
rm -rf build && mkdir -p build/res build/gen build/classes build/assets
cp -r ../www build/assets/www
$BT/aapt2 compile --dir res -o build/res/res.zip
$BT/aapt2 link -I $JAR --manifest AndroidManifest.xml --min-sdk-version 24 --target-sdk-version 34 \
  -A build/assets --java build/gen -o build/unsigned.apk build/res/res.zip
javac -nowarn --release 11 -classpath $JAR -d build/classes build/gen/nl/oma/mahjong/R.java src/nl/oma/mahjong/*.java 2>&1 | grep -v "^warning\|^Note" || true
$BT/d8 --release --min-api 24 --lib $JAR --output build $(find build/classes -name '*.class')
(cd build && zip -q -u unsigned.apk classes.dex)
$BT/zipalign -f -p 4 build/unsigned.apk build/aligned.apk
$BT/apksigner sign --ks $KS --ks-key-alias oma --ks-pass pass:$PASS --key-pass pass:$PASS --out build/OmasMahjong.apk build/aligned.apk
$BT/apksigner verify build/OmasMahjong.apk && echo "BUILD OK: build/OmasMahjong.apk"
