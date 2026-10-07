# Oma's Mahjong

Ad-free Mahjong solitaire for Android, in Dutch.

- `OmasMahjong.apk`: the app, ready to install
- `www/`: the game itself (HTML/JS, open `www/index.html` in a browser to play)
- `android/`: the small Android wrapper (WebView) + `build.sh` (aapt2/javac/d8/apksigner, no Gradle needed)
- `android/keystore/`: the signing key + password. KEEP THESE SAFE: updates must be signed with this
  same key or Android refuses to install them over the old version (and grandma would lose her progress).
- `site/`: the public download page (GitHub Pages)

To make an update: edit `www/`, bump `versionCode`/`versionName` in `android/AndroidManifest.xml`,
run `android/build.sh` (needs Android SDK build-tools 35 + platform 34, set ANDROID_SDK), copy the new APK into `site/`.

## Updates (from version 1.5)

The app updates itself: on start (and when it comes back to the foreground) it checks
`play/bundle.json` on the website. A newer version is downloaded and kept on the phone,
then used from the home screen on. If a downloaded version does not start, the app falls
back to its built-in version and skips that update.

    python3 release.py 1.6 --deploy   # phones update themselves, and the download page
                                      # always gets a fresh APK of the same version
