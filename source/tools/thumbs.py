#!/usr/bin/env python3
"""Small preview photos for the review page, where Dennis rates which news items are interesting
for grandma. Artifact pages cannot load photos from other websites, so the photos go into the page
itself: 320 px wide, as data: URLs. Only for reviewing (private), never shown in the game.

  python3 tools/thumbs.py --cand candidates.json --out thumbs.json [--old old-thumbs.json]
"""
import base64, io, json, sys, urllib.request

from PIL import Image


def main():
    a = sys.argv[1:]
    opt = lambda k: a[a.index(k) + 1] if k in a else None
    items = json.load(open(opt('--cand'), encoding='utf-8')).get('items', [])
    try:
        old = json.load(open(opt('--old'), encoding='utf-8')) if opt('--old') else {}
    except Exception:
        old = {}
    out, made = {}, 0
    for it in items:
        if it['id'] in old:
            out[it['id']] = old[it['id']]
            continue
        for url in [it.get('img'), it.get('thumb')]:
            if not url:
                continue
            try:
                req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (compatible; OmasMahjong-news/1.1)'})
                im = Image.open(io.BytesIO(urllib.request.urlopen(req, timeout=20).read())).convert('RGB')
                im.thumbnail((320, 320))
                buf = io.BytesIO()
                im.save(buf, 'JPEG', quality=62, optimize=True)
                out[it['id']] = 'data:image/jpeg;base64,' + base64.b64encode(buf.getvalue()).decode()
                made += 1
                break
            except Exception as e:
                print(f'{it["id"]}: {e}', file=sys.stderr)
    json.dump(out, open(opt('--out'), 'w'))
    print(f'{len(out)} preview photos ({made} new)')


if __name__ == '__main__':
    main()
