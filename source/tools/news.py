#!/usr/bin/env python3
"""Real news from Apeldoorn for the village news in the game (js/village.js).

Runs every two hours on GitHub (tools/news.yml -> .github/workflows/news.yml) and writes news.json
to the `news` branch; the game reads it from raw.githubusercontent.com.

  python3 tools/news.py --out news.json [--old old-news.json] [--file feed.xml ...]

Only light, friendly local news gets through: no accidents, fires, police, illness, politics or
columns (see SKIP_CATS, SKIP_IN and SKIP_START). Only the headline, the short summary and the photo that
the site itself puts in its feed are used, with the name of the source; the photo is not copied,
the game shows it from the news site (like a news reader app does).
"""
import html, json, re, sys, time, urllib.request
from email.utils import parsedate_to_datetime
from xml.etree import ElementTree as ET

# (source, feed, only items that mention one of these places; None = everything is local)
PLACES = r'\b(apeldoorn\w*|ugchelen|beekbergen|loenen|hoenderloo|uddel|vaassen|hoog soeren|klarenbeek|lieren|wenum|wiesel|orden|zevenhuizen|osseveld|de maten|zuidbroek|het loo|apenheul|berg en bos|oranjepark)\b'
FEEDS = [
    ('Samen1', 'https://samen1.nl/feed/', None),                       # Omroep Apeldoorn, the local broadcaster
    ('Apeldoorn Direct', 'https://www.apeldoorndirect.nl/category/stad/feed/', None),
    ('Stedendriehoek', 'https://www.stedendriehoek.nl/feed/', PLACES),   # the regional free paper: Apeldoorn items only
]
KEEP_DAYS, KEEP_MAX = 10, 60
SKIP_CATS = {'112', 'politiek', 'column', 'columns', 'opinie', 'ingezonden', 'ondernemend', 'partnerbijdrage', 'advertorial', 'overig'}
# these keep an item out wherever they appear, also inside a longer Dutch word (woningbrand, geluidsoverlast)
SKIP_IN = """brand ongeluk ongeval gewond dood doden overlijd overleden politie arrest mishandel inbraak diefstal
overval drugs ontruim kanker oorlog racis misbruik verkracht explosie ontplof vermist botsing letsel rechtbank
zelfdoding uitvaart begrafenis faillis overlast crimin bedreig slachtoffer geweld moord verslav evacu gaslek
noodweer steekpartij schietpartij traumaheli aanrijding""".split()
# these only at the start of a word (inside other words they are harmless: trampoline, Schotland)
SKIP_START = """ramp dode sterf stierf aangehouden verdacht steek schiet schot ziek crash rechter ontslag dader alcohol
vuurwerk storing asiel protest demonstr staking hufter boete handhav dakloos inbre gestolen trauma""".split()
SKIP_RE = re.compile('(' + '|'.join(map(re.escape, SKIP_IN)) + r')|\b(' + '|'.join(map(re.escape, SKIP_START)) + ')', re.I)
FORMAT = 2      # news.json from an older collector is not merged in (its items were filtered less strictly)
MEDIA, CONTENT = '{http://search.yahoo.com/mrss/}', '{http://purl.org/rss/1.0/modules/content/}'
# pictures that are not a news photo (site logos, disclaimers, tracking pixels, ...)
NOT_PHOTO = re.compile(r'disclaimer|logo|banner|icon|avatar|pixel|emoji|gravatar|advert|\.gif|\.svg', re.I)


def image_of(it):
    """The news photo of a feed item: (photo, smaller fallback). WordPress thumbnails like
    name-150x150.jpg also exist without the size (the original, much sharper)."""
    url = None
    for el in it.findall(MEDIA + 'content') + it.findall(MEDIA + 'thumbnail') + it.findall('enclosure'):
        u = el.get('url') or ''
        if u and (el.get('medium') == 'image' or (el.get('type') or '').startswith('image') or el.tag.endswith('thumbnail')) and not NOT_PHOTO.search(u):
            url = u
            break
    if not url:
        for field in [it.findtext('description') or '', it.findtext(CONTENT + 'encoded') or '']:
            for m in re.finditer(r'<img\b[^>]*?\ssrc=["\']([^"\']+)', field, re.I):
                if not NOT_PHOTO.search(m.group(1)):
                    url = m.group(1)
                    break
            if url:
                break
    if not url:
        return None, None
    url = html.unescape(url).replace('http://', 'https://', 1)
    if not url.startswith('https://') or SKIP_RE.search(url.rsplit('/', 1)[-1].replace('_', ' ').replace('-', ' ')):
        return None, None       # (also no photo whose file name says police, accident, ...)
    full = re.sub(r'-\d{2,4}x\d{2,4}(?=\.(jpe?g|png|webp)$)', '', url, flags=re.I)
    return full, (url if full != url else None)


def clean(s):
    """The feed summary as plain text: no HTML, no "Het bericht ... verscheen eerst op ..." line."""
    s = re.sub(r'<(script|style)[^>]*>.*?</\1>', ' ', s or '', flags=re.S | re.I)
    s = re.sub(r'<[^>]+>', ' ', s)
    s = html.unescape(s)
    s = re.sub(r'(Het bericht|The post)\s.*?(verscheen eerst op|appeared first on).*$', '', s, flags=re.S | re.I)
    s = re.sub(r'\[(…|\.\.\.)\]', '…', s)
    return re.sub(r'\s+', ' ', s).strip()


def shorten(s, n=280):
    if len(s) <= n:
        return s
    cut = s[:n]
    end = max(cut.rfind('. '), cut.rfind('! '), cut.rfind('? '))
    return cut[:end + 1] if end > n * 0.5 else cut[:cut.rfind(' ')] + ' …'


def items_from(src, xml, need=None):
    out = []
    root = ET.fromstring(xml.lstrip() if isinstance(xml, (bytes, str)) else xml)    # some feeds start with an empty line
    for it in root.iter('item'):
        title = clean(it.findtext('title'))
        text = shorten(clean(it.findtext('description')))
        cats = {clean(c.text).lower() for c in it.findall('category') if c.text}
        guid = (it.findtext('guid') or it.findtext('link') or title).strip()
        try:
            t = int(parsedate_to_datetime(it.findtext('pubDate')).timestamp() * 1000)
        except Exception:
            t = int(time.time() * 1000)
        if not title or cats & SKIP_CATS or SKIP_RE.search(title) or SKIP_RE.search(text):
            continue
        if need and not re.search(need, title + ' ' + text, re.I):
            continue
        item = {'id': re.sub(r'\W+', '', guid)[-40:], 't': t, 'title': title[:140], 'text': text, 'src': src}
        img, thumb = image_of(it)
        if img:
            item['img'] = img
        if thumb:
            item['thumb'] = thumb
        out.append(item)
    return out


def fetch(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'OmasMahjong-news/1.0 (+https://dennis10276.github.io/oma-mahjong/)'})
    return urllib.request.urlopen(req, timeout=30).read()


def main():
    a = sys.argv[1:]
    opt = lambda k: a[a.index(k) + 1] if k in a else None
    old = []
    if opt('--old'):
        try:
            o = json.load(open(opt('--old'), encoding='utf-8'))
            old = o.get('items', []) if o.get('v') == FORMAT else []
        except Exception:
            old = []
    new = []
    files = [a[i + 1] for i, x in enumerate(a) if x == '--file']
    failed = 0
    for src, url, need in ([('Test', f, None) for f in files] if files else FEEDS):
        try:
            new += items_from(src, open(url, 'rb').read() if files else fetch(url), need)
        except Exception as e:
            failed += 1
            print(f'{src}: {e}', file=sys.stderr)
    if failed and failed == len(files or FEEDS):
        sys.exit('no feed could be read: the old news.json stays')
    seen, items = set(), []
    for it in sorted(new + old, key=lambda x: -x['t']):
        key = it['title'].lower()[:60]
        if it['id'] in seen or key in seen or SKIP_RE.search(it['title'] + ' ' + it['text']):
            continue
        seen.update([it['id'], key])
        if it['t'] > (time.time() - KEEP_DAYS * 86400) * 1000:
            items.append(it)
    out = {'v': FORMAT, 'updated': int(time.time() * 1000), 'items': items[:KEEP_MAX]}
    json.dump(out, open(opt('--out') or 'news.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'{len(out["items"])} items ({len(new)} new from the feeds)')


if __name__ == '__main__':
    main()
