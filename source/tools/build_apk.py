#!/usr/bin/env python3
"""Build the APK on Windows with the verified toolchain in build/toolchain.

No Gradle is needed. Signing passwords are read by apksigner from their existing
file and are never put on the command line. Each build uses a fresh directory.
"""
from pathlib import Path
import hashlib
import json
import re
import shutil
import subprocess
import tempfile
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]


def run(args):
    subprocess.run([str(a) for a in args], check=True)


def main():
    tc = ROOT / 'build' / 'toolchain'
    for package in json.loads((tc / 'packages.json').read_text(encoding='utf-8')):
        archive = tc / package['name']
        digest = hashlib.new(package['algorithm'], archive.read_bytes()).hexdigest()
        if digest != package['hash']:
            raise RuntimeError('Toolchain checksum mismatch: ' + archive.name)
        dest = tc / archive.stem
        if not dest.exists():
            with ZipFile(archive) as z:
                for name in z.namelist():
                    if not (dest / name).resolve().is_relative_to(dest.resolve()):
                        raise RuntimeError('Unsafe archive path')
                z.extractall(dest)
    java = next((tc / 'jdk').glob('*/bin/java.exe'))
    javac = java.with_name('javac.exe')
    bt = next((tc / 'build-tools').glob('*/aapt2.exe')).parent
    jar = next((tc / 'platform').glob('*/android.jar'))
    android = ROOT / 'android'
    manifest = android / 'AndroidManifest.xml'
    version = re.search(r'android:versionName="([^"]+)"', manifest.read_text()).group(1)
    build = Path(tempfile.mkdtemp(prefix=f'apk-{version}-', dir=ROOT / 'build'))
    for folder in ['gen', 'classes', 'assets', 'dex']:
        (build / folder).mkdir()
    shutil.copytree(ROOT / 'www', build / 'assets' / 'www')
    run([bt / 'aapt2.exe', 'compile', '--dir', android / 'res', '-o', build / 'res.zip'])
    run([bt / 'aapt2.exe', 'link', '-I', jar, '--manifest', manifest,
         '--min-sdk-version', '24', '--target-sdk-version', '34', '-A', build / 'assets',
         '--java', build / 'gen', '-o', build / 'compiled.apk', build / 'res.zip'])
    sources = list((build / 'gen').rglob('*.java')) + list((android / 'src').rglob('*.java'))
    run([javac, '-nowarn', '--release', '11', '-classpath', jar, '-d', build / 'classes', *sources])
    run([java, '-cp', bt / 'lib' / 'd8.jar', 'com.android.tools.r8.D8', '--release',
         '--min-api', '24', '--lib', jar, '--output', build / 'dex', *list((build / 'classes').rglob('*.class'))])
    # Repack consistently: appending to aapt2's archive with Python can otherwise
    # leave different UTF-8 flags in the local and central ZIP headers.
    with ZipFile(build / 'compiled.apk') as source, ZipFile(build / 'unsigned.apk', 'w') as z:
        for entry in source.infolist():
            z.writestr(entry, source.read(entry.filename))
        z.write(build / 'dex' / 'classes.dex', 'classes.dex')
    run([bt / 'zipalign.exe', '-f', '-p', '4', build / 'unsigned.apk', build / 'aligned.apk'])
    apk = build / 'OmasMahjong.apk'
    signer = [java, '-jar', bt / 'lib' / 'apksigner.jar']
    password = 'file:' + str(android / 'keystore' / 'password.txt')
    run([*signer, 'sign', '--ks', android / 'keystore' / 'oma-mahjong.jks',
         '--ks-key-alias', 'oma', '--ks-pass', password,
         '--out', apk, build / 'aligned.apk'])
    run([*signer, 'verify', '--verbose', apk])
    # Android upgrades must use the same certificate as the existing distributed APK.
    old = ROOT.parent / 'OmasMahjong.apk'
    def certificate(file):
        result = subprocess.check_output([str(a) for a in [*signer, 'verify', '--print-certs', file]], text=True)
        return re.search(r'certificate SHA-256 digest: (\w+)', result).group(1)
    if old.exists() and certificate(old) != certificate(apk):
        raise RuntimeError('Signing certificate changed; APK was not distributed')
    with ZipFile(apk) as z:
        for f in (ROOT / 'www').rglob('*'):
            if f.is_file() and z.read('assets/www/' + f.relative_to(ROOT / 'www').as_posix()) != f.read_bytes():
                raise RuntimeError('APK assets differ: ' + str(f))
    out = android / 'build'
    out.mkdir(exist_ok=True)
    shutil.copy2(apk, out / 'OmasMahjong.apk')
    print(f'BUILD OK: {out / "OmasMahjong.apk"}; version {version}, existing signing certificate, assets verified')


if __name__ == '__main__':
    main()
