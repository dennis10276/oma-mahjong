#!/usr/bin/env python3
"""Release a new version of Oma's Mahjong.

  python3 release.py 1.6            game update only: phones with the app pick it up by themselves
  python3 release.py 1.6 --apk      also build a new APK (only needed when android/ changed)
  add --deploy to copy everything to the GitHub Pages repo and push it.

What it does:
  - sets the version in www/game.js (APP_VERSION) and www/index.html (the boot loader)
  - writes site/play/ (the game in the browser) + site/play/bundle.json (what the app downloads)
  - with --apk: bumps versionCode/versionName, builds the APK, puts it on the download page
"""
import json, os, re, shutil, subprocess, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
WWW, SITE = os.path.join(ROOT, 'www'), os.path.join(ROOT, 'site')
REPO = os.environ.get('PAGES_REPO', '/home/claude/repo-oma')
FILES = ['tiles.js', 'audio.js', 'layouts.js', 'game.js']


def sub(path, pattern, repl, count=1):
    s = open(path, encoding='utf-8').read()
    s2, n = re.subn(pattern, repl, s, count=count)
    if n == 0:
        sys.exit(f'pattern not found in {path}: {pattern}')
    open(path, 'w', encoding='utf-8').write(s2)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if len(args) != 1 or not re.fullmatch(r'\d+(\.\d+)*', args[0]):
        sys.exit(__doc__)
    v, apk, deploy = args[0], '--apk' in sys.argv, '--deploy' in sys.argv

    sub(os.path.join(WWW, 'game.js'), r"const APP_VERSION = '[^']*'", f"const APP_VERSION = '{v}'")
    sub(os.path.join(WWW, 'index.html'), r"var BUILT = '[^']*'", f"var BUILT = '{v}'")

    # the browser version, with cache-busting
    play = os.path.join(SITE, 'play')
    shutil.rmtree(play, ignore_errors=True)
    shutil.copytree(WWW, play)
    idx = os.path.join(play, 'index.html')
    s = open(idx, encoding='utf-8').read()
    s = re.sub(r'href="style\.css"', f'href="style.css?v={v}"', s)
    s = re.sub(r"FILES = \['tiles\.js', 'audio\.js', 'layouts\.js', 'game\.js'\]",
               "FILES = [" + ", ".join(f"'{f}?v={v}'" for f in FILES) + "]", s)
    open(idx, 'w', encoding='utf-8').write(s)

    # what installed apps download
    html = open(os.path.join(WWW, 'index.html'), encoding='utf-8').read()
    body = html.split('<body>', 1)[1].split('<script id="boot">', 1)[0]
    bundle = {
        'v': v,
        'css': open(os.path.join(WWW, 'style.css'), encoding='utf-8').read(),
        'body': body,
        'js': [open(os.path.join(WWW, f), encoding='utf-8').read() for f in FILES],
    }
    json.dump(bundle, open(os.path.join(play, 'bundle.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print(f'bundle.json {os.path.getsize(os.path.join(play, "bundle.json")) // 1024} KB, version {v}')

    if apk:
        man = os.path.join(ROOT, 'android', 'AndroidManifest.xml')
        code = int(re.search(r'android:versionCode="(\d+)"', open(man).read()).group(1)) + 1
        sub(man, r'android:versionCode="\d+"', f'android:versionCode="{code}"')
        sub(man, r'android:versionName="[^"]*"', f'android:versionName="{v}"')
        subprocess.run(['bash', os.path.join(ROOT, 'android', 'build.sh')], check=True)
        shutil.copy(os.path.join(ROOT, 'android', 'build', 'OmasMahjong.apk'), os.path.join(SITE, 'OmasMahjong.apk'))
        sub(os.path.join(SITE, 'index.html'), r'Versie [0-9.]+ ·', f'Versie {v} ·')
        print(f'APK built: version {v} (code {code})')

    if deploy:
        for f in ['index.html', 'OmasMahjong.apk', 'favicon.png']:
            shutil.copy(os.path.join(SITE, f), os.path.join(REPO, f))
        shutil.rmtree(os.path.join(REPO, 'play'), ignore_errors=True)
        shutil.copytree(play, os.path.join(REPO, 'play'))
        shutil.copy(os.path.join(ROOT, 'android', 'AndroidManifest.xml'), os.path.join(REPO, 'source', 'android', 'AndroidManifest.xml'))
        msg = f'Version {v}' + (' (new APK)' if apk else ' (game update, installed apps update themselves)')
        subprocess.run(['git', '-C', REPO, 'add', '-A'], check=True)
        subprocess.run(['git', '-C', REPO, 'commit', '-q', '-m', msg + os.environ.get('COMMIT_TRAILER', '')], check=True)
        subprocess.run(['git', '-C', REPO, 'push', '-q', 'origin', 'HEAD'], check=True)
        print('deployed')


if __name__ == '__main__':
    main()
