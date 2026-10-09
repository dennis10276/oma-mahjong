#!/usr/bin/env python3
"""Release a new version of Oma's Mahjong.

  python3 release.py 1.6 --deploy    the usual way: new game files (phones update themselves)
                                     AND a fresh APK on the download page, so new installs
                                     always get the newest version too
  --no-apk                           skip the APK (only for quick tests)
  --no-tests                         skip the test suite (tests/run.js), which otherwise must pass first

What it does:
  - sets the version in www/js/core.js (APP_VERSION) and www/index.html (the boot loader)
  - writes site/play/ (the game in the browser) + site/play/bundle.json (what the app downloads)
  - bumps versionCode/versionName, builds the APK, puts it on the download page (unless --no-apk)
"""
import json, os, re, shutil, subprocess, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
WWW, SITE = os.path.join(ROOT, 'www'), os.path.join(ROOT, 'site')
REPO = os.environ.get('PAGES_REPO', '/home/claude/repo-oma')


def game_files():
    """The game scripts in load order, as listed in the boot loader of www/index.html."""
    html = open(os.path.join(WWW, 'index.html'), encoding='utf-8').read()
    m = re.search(r"FILES = \[([^\]]*)\]", html)
    return re.findall(r"'([^'?]+)'", m.group(1))


def run_tests():
    """Every release is checked the same way first: the whole offline test suite must pass."""
    env = dict(os.environ)
    nm = os.path.join(ROOT, 'tests', 'node_modules')
    if os.path.isdir(nm):
        env['NODE_PATH'] = nm
    print('running the tests (tests/run.js)...')
    r = subprocess.run(['node', os.path.join(ROOT, 'tests', 'run.js')], env=env)
    if r.returncode != 0:
        sys.exit('tests failed: nothing was released. Fix them, or use --no-tests if you really must.')


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
    v, apk, deploy = args[0], '--no-apk' not in sys.argv, '--deploy' in sys.argv
    if '--no-tests' not in sys.argv:
        run_tests()

    sub(os.path.join(WWW, 'js', 'core.js'), r"const APP_VERSION = '[^']*'", f"const APP_VERSION = '{v}'")
    FILES = game_files()
    sub(os.path.join(WWW, 'index.html'), r"var BUILT = '[^']*'", f"var BUILT = '{v}'")

    # the browser version, with cache-busting
    play = os.path.join(SITE, 'play')
    shutil.rmtree(play, ignore_errors=True)
    shutil.copytree(WWW, play)
    idx = os.path.join(play, 'index.html')
    s = open(idx, encoding='utf-8').read()
    s = re.sub(r'href="style\.css"', f'href="style.css?v={v}"', s)
    s = re.sub(r"FILES = \[[^\]]*\]", "FILES = [" + ", ".join(f"'{f}?v={v}'" for f in FILES) + "]", s, count=1)
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
    # the tiny file the app checks every minute
    json.dump({'v': v}, open(os.path.join(play, 'version.json'), 'w'))

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
        # the family dashboard (live play data); it loads play/js/rules.js, so it always matches the game
        shutil.rmtree(os.path.join(REPO, 'dash'), ignore_errors=True)
        shutil.copytree(os.path.join(SITE, 'dash'), os.path.join(REPO, 'dash'))
        shutil.copy(os.path.join(ROOT, 'android', 'AndroidManifest.xml'), os.path.join(REPO, 'source', 'android', 'AndroidManifest.xml'))
        for f in ['README.md', 'release.py']:
            shutil.copy(os.path.join(ROOT, f), os.path.join(REPO, 'source', f))
        shutil.rmtree(os.path.join(REPO, 'source', 'tests'), ignore_errors=True)
        shutil.copytree(os.path.join(ROOT, 'tests'), os.path.join(REPO, 'source', 'tests'), ignore=shutil.ignore_patterns('node_modules'))
        msg = f'Version {v}' + (' (game update + fresh APK on the download page)' if apk else ' (game update only)')
        subprocess.run(['git', '-C', REPO, 'add', '-A'], check=True)
        trailer = os.environ.get('COMMIT_TRAILER', '').strip()
        subprocess.run(['git', '-C', REPO, 'commit', '-q', '-m', msg + ('\n\n' + trailer if trailer else '')], check=True)
        subprocess.run(['git', '-C', REPO, 'push', '-q', 'origin', 'HEAD'], check=True)
        print('deployed')


if __name__ == '__main__':
    main()
