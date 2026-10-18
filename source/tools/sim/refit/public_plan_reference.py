import hashlib
import json
from pathlib import Path

from personal_value_fit import ROOT, digest


def inside(folder, filename):
    resolved = (Path(folder) / filename).resolve()
    if Path(folder).resolve() not in resolved.parents:
        raise ValueError('Public-plan reference path escapes its pinned root')
    return resolved


def load_reference(snapshot, data_file, root=ROOT):
    snapshot, root = Path(snapshot).resolve(), Path(root).resolve()
    manifest_file = inside(snapshot, 'manifest.json')
    manifest = json.loads(manifest_file.read_bytes())
    data_path = inside(snapshot, data_file)
    if digest(data_path) != manifest['files'].get(data_file):
        raise ValueError('Pinned public-plan feature data changed')
    data = json.loads(data_path.read_bytes())
    fingerprint = hashlib.sha256()
    sources = [manifest_file, data_path]
    for name in data['fingerprintFiles']:
        local = name in manifest['files']
        expected = manifest['files'][name] if local else manifest.get('externalPinnedDependencies', {}).get(name)
        if not expected or not local and '/experiments/' not in name and '/runs/' not in name:
            raise ValueError('Public-plan reference is missing an immutable source: ' + name)
        source = inside(snapshot if local else root, name)
        content = source.read_bytes()
        if hashlib.sha256(content).hexdigest() != expected:
            raise ValueError('Pinned public-plan source changed: ' + name)
        fingerprint.update(name.encode())
        fingerprint.update(content)
        sources.append(source)
    if fingerprint.hexdigest() != data['fingerprint']:
        raise ValueError('Pinned public-plan feature fingerprint differs')
    return data, {'snapshot': snapshot.relative_to(root).as_posix(), 'manifestSha256': digest(manifest_file),
                  'dataSha256': digest(data_path), 'featureFingerprint': data['fingerprint'],
                  'referenceHashes': {source.relative_to(root).as_posix(): digest(source) for source in set(sources)}}
