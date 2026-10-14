#!/usr/bin/env python3
"""Real news from Apeldoorn for the village news in the game (js/village.js).

Runs every two hours on GitHub (tools/news.yml -> .github/workflows/news.yml) and writes to the
`news` branch:
  news.json        what the game shows: Apeldoorn items with a photo, most interesting first
  candidates.json  every safe Apeldoorn item with a photo, with its interest score (for reviewing)

  python3 tools/news.py --out news.json --cand candidates.json [--old candidates.json] [--file feed.xml ...]

Only light, friendly local news gets through: no accidents, fires, police, illness, politics or
columns (SKIP_CATS, SKIP_IN, SKIP_START), only about Apeldoorn and its villages (PLACES), and only
with a photo: the one the site puts in its feed, or else the share photo of the article page
(og:image). The photo is not copied: the game shows it from the news site, like a news reader app.
How interesting an item is comes from tools/interest.json (see interest()).
"""
import html, json, os, re, sys, time, urllib.request
from datetime import date, datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from xml.etree import ElementTree as ET

HERE = os.path.dirname(os.path.abspath(__file__))
# Apeldoorn: the city, its neighbourhoods, its villages and its well-known places
PLACES = re.compile(r'\b(apeldoorn\w*|ugchelen|beekbergen|loenen|hoenderloo|uddel|vaassen|hoog soeren|klarenbeek|lieren|'
                    r'wenum|wiesel|orden|zevenhuizen|osseveld|de maten|zuidbroek|kerschoten|anklaar|matenhoeve|matenhorst|'
                    r'sprengenbos|berg en bos|de parken|driehuizen|brinkhorst|woudhuis|malkenschoten|beemte|radio kootwijk|'
                    r'kootwijk|assel|hoog buurlo|het loo|paleis het loo|kroondomein|apenheul|orpheus|gigant|coda|aquadoorn|'
                    r'acec|hertzberger|marktplein|hoofdstraat|oranjepark|wilhelminapark|prinsenpark|julianatoren|'
                    r'apeldoorns kanaal|055)\b', re.I)
# src, feed, pages to read (WordPress feeds have older pages: ?paged=2, ...), must name a place
FEEDS = [
    ('Samen1', 'https://samen1.nl/feed/', 5, True),                        # Omroep Apeldoorn (also news from the region)
    ('Apeldoorn Direct', 'https://www.apeldoorndirect.nl/feed/', 3, False),  # only Apeldoorn
    ('Stedendriehoek', 'https://www.stedendriehoek.nl/feed/', 4, True),     # the regional free paper
    # (not the municipality's own news: Dennis dropped it on 2026-10-10)
]
NEWS_DAYS, NEWS_MAX = 7, 80           # news.json: at most a week old, and how many
CAND_DAYS, CAND_MAX = 60, 300         # candidates.json
OG_PER_RUN = 60                       # article pages read per run for a share photo
SKIP_CATS = {'112', 'politiek', 'column', 'columns', 'opinie', 'ingezonden', 'ondernemend', 'partnerbijdrage', 'advertorial', 'overig'}
# these keep an item out wherever they appear, also inside a longer Dutch word (woningbrand, geluidsoverlast)
SKIP_IN = """brand ongeluk ongeval gewond dood doden overlijd overleden politie arrest mishandel inbraak diefstal
overval drugs ontruim kanker oorlog racis misbruik verkracht explosie ontplof vermist botsing letsel rechtbank
zelfdoding suïcide suicide uitvaart begrafenis faillis overlast crimin bedreig slachtoffer geweld moord verslav evacu gaslek
noodweer steekpartij schietpartij traumaheli aanrijding""".split()
# these only at the start of a word (inside other words they are harmless: trampoline, Schotland)
SKIP_START = """ramp dode sterf stierf aangehouden verdacht steek schiet schot ziek crash rechter ontslag dader alcohol
vuurwerk storing asiel protest demonstr staking hufter boete handhav dakloos inbre gestolen trauma ontheemd""".split()
SKIP_RE = re.compile('(' + '|'.join(map(re.escape, SKIP_IN)) + r')|\b(' + '|'.join(map(re.escape, SKIP_START)) + ')', re.I)
FORMAT = 3
MEDIA, CONTENT = '{http://search.yahoo.com/mrss/}', '{http://purl.org/rss/1.0/modules/content/}'
# pictures that are not a news photo (site logos, disclaimers, tracking pixels, ...)
NOT_PHOTO = re.compile(r'disclaimer|logo|banner|icon|avatar|pixel|emoji|gravatar|advert|placeholder|default|\.gif|\.svg', re.I)
SMALL = re.compile(r'-(\d{2,3})x(\d{2,3})(?=\.(jpe?g|png|webp)$)', re.I)     # a WordPress thumbnail (up to 999 px)


def ok_photo(url):
    if not url:
        return None
    url = html.unescape(url).strip().replace('http://', 'https://', 1)
    name = url.split('?')[0].rsplit('/', 1)[-1]
    if not url.startswith('https://') or NOT_PHOTO.search(name) or SKIP_RE.search(name.replace('_', ' ').replace('-', ' ')):
        return None             # (also no photo whose file name says police, accident, ...)
    return url


def image_of(it):
    """The photo in the feed item (media:content, enclosure, or the first <img> in the text)."""
    for el in it.findall(MEDIA + 'content') + it.findall(MEDIA + 'thumbnail') + it.findall('enclosure'):
        u = el.get('url') or ''
        if u and (el.get('medium') == 'image' or (el.get('type') or '').startswith('image') or el.tag.endswith('thumbnail')) and ok_photo(u):
            return ok_photo(u)
    for field in [it.findtext('description') or '', it.findtext(CONTENT + 'encoded') or '']:
        for m in re.finditer(r'<img\b[^>]*?\ssrc=["\']([^"\']+)', field, re.I):
            if ok_photo(m.group(1)):
                return ok_photo(m.group(1))
    return None


def clean(s):
    """Feed text as plain text: no HTML, no "Het bericht ... verscheen eerst op ..." line."""
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


def items_from(src, xml, need_place=False):
    out = []
    xml = xml.lstrip() if isinstance(xml, (bytes, str)) else xml    # some feeds start with an empty line
    try:
        root = ET.fromstring(xml)
    except ET.ParseError:
        # some feeds have a bare & or control characters in their text: repair and try again
        s = xml.decode('utf-8', 'replace') if isinstance(xml, bytes) else xml
        s = re.sub(r'&(?!(#\d+|#x[0-9a-fA-F]+|[a-zA-Z]\w*);)', '&amp;', s)
        s = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f]', ' ', s)
        root = ET.fromstring(s.encode('utf-8'))
    for it in root.iter('item'):
        title = clean(it.findtext('title'))
        text = shorten(clean(it.findtext('description')))
        full = clean(it.findtext(CONTENT + 'encoded'))[:3000]
        cats = sorted({clean(c.text).lower() for c in it.findall('category') if c.text})
        guid = (it.findtext('guid') or it.findtext('link') or title).strip()
        try:
            t = int(parsedate_to_datetime(it.findtext('pubDate')).timestamp() * 1000)
        except Exception:
            t = int(time.time() * 1000)
        if not title or set(cats) & SKIP_CATS or SKIP_RE.search(title) or SKIP_RE.search(text):
            continue
        if need_place and not ('apeldoorn' in cats or PLACES.search(title + ' ' + text + ' ' + full[:1200])):
            continue
        if not text and full:
            text = shorten(full)
        item = {'id': re.sub(r'\W+', '', guid)[-40:], 't': t, 'title': title[:140], 'text': text, 'src': src,
                'link': (it.findtext('link') or '').strip(), 'cats': cats[:6]}
        until = event_until(item, full)
        if until:
            item['until'] = until
        img = image_of(it)
        if img:
            item['img'] = img
        out.append(item)
    return out


def fetch(url, timeout=30):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (compatible; OmasMahjong-news/1.1; +https://dennis10276.github.io/oma-mahjong/)'})
    return urllib.request.urlopen(req, timeout=timeout).read()


def og_image(link):
    """The share photo of an article page (what Facebook/WhatsApp show for a link)."""
    try:
        page = fetch(link, 15)[:400000].decode('utf-8', 'replace')
    except Exception:
        return None
    for pat in [r'<meta[^>]+property=["\']og:image(?::url)?["\'][^>]+content=["\']([^"\']+)', r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:image',
                r'<meta[^>]+name=["\']twitter:image["\'][^>]+content=["\']([^"\']+)']:
        m = re.search(pat, page, re.I)
        if m and ok_photo(m.group(1)):
            return ok_photo(m.group(1))
    return None


# ---------- when is the event an item talks about over? ----------
MONTHS = {'jan': 1, 'januari': 1, 'feb': 2, 'februari': 2, 'mrt': 3, 'maart': 3, 'apr': 4, 'april': 4, 'mei': 5, 'jun': 6, 'juni': 6,
          'jul': 7, 'juli': 7, 'aug': 8, 'augustus': 8, 'sep': 9, 'sept': 9, 'september': 9, 'okt': 10, 'oktober': 10,
          'nov': 11, 'november': 11, 'dec': 12, 'december': 12}
DATE_RE = re.compile(r'\b(\d{1,2})(?:\s*(?:en|t/m|tot en met|tot|-|–)\s*(\d{1,2}))?\s+(' + '|'.join(sorted(MONTHS, key=len, reverse=True)) + r')\b\.?(?:\s+(\d{4}))?', re.I)
AMS = timezone(timedelta(hours=2))      # Amsterdam (summer time; an hour off in winter does not matter here)


def event_until(it, full=''):
    """The last day the event in the item is on (end of that day, ms), or None when it names no date.
    Dates are read from the text ("zaterdag 10 oktober", "10 t/m 12 oktober", "tot en met 1 november");
    "vandaag"/"vanavond" is the day it was published, "morgen" the day after. Dates long before the
    item was published are history ("gebouwd in mei 1960"), not the event, and are skipped."""
    pub = datetime.fromtimestamp(it['t'] / 1000, AMS).date()
    s = ' '.join([it['title'], it.get('text', ''), full[:2500]])
    days = []
    for m in DATE_RE.finditer(s):
        d1, d2, mon, yr = m.group(1), m.group(2), MONTHS[m.group(3).lower()], m.group(4)
        for d in [int(d2 or d1)]:
            years = [int(yr)] if yr else [pub.year - 1, pub.year, pub.year + 1]
            cands = []
            for y in years:
                try:
                    cands.append(date(y, mon, d))
                except ValueError:
                    pass
            if not cands:
                continue
            day = min(cands, key=lambda x: abs((x - pub).days)) if not yr else cands[0]
            if pub - timedelta(days=60) <= day <= pub + timedelta(days=370):
                days.append(day)
    low = s.lower()
    if re.search(r'\b(vandaag|vanavond|vanmiddag)\b', low):
        days.append(pub)
    if re.search(r'\bmorgen(avond|middag|ochtend)?\b', low):
        days.append(pub + timedelta(days=1))
    if not days:
        return None
    last = max(days)
    return int(datetime(last.year, last.month, last.day, 23, 59, tzinfo=AMS).timestamp() * 1000)


# ---------- how interesting is it (for grandma: small human stories, animals, royals, nature, curiosities) ----------
def load_model():
    try:
        return json.load(open(os.path.join(HERE, 'interest.json'), encoding='utf-8'))
    except Exception:
        return {'words': {}, 'src': {}, 'bias': 0, 'min': -99}


def words_of(it):
    s = (it['title'] + ' ' + it['title'] + ' ' + it.get('text', '')).lower()
    return set(re.findall(r'[a-zà-ÿ]{4,}', s))


def interest(it, model):
    """Sum of the weights of the words that start a word in the item (stems), plus the source."""
    s = model.get('bias', 0) + model.get('src', {}).get(it['src'], 0)
    ws = words_of(it)
    for stem, w in model.get('words', {}).items():
        if any(x.startswith(stem) for x in ws):
            s += w
    return round(s, 2)


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
    files = [a[i + 1] for i, x in enumerate(a) if x == '--file']
    if not files:
        old = [it for it in old if it.get('src') in {f[0] for f in FEEDS}]     # a source that was dropped goes entirely
    new, failed, tried = [], 0, 0
    for src, url, pages, need in ([('Test', f, 1, False) for f in files] if files else FEEDS):
        for pg in range(1, pages + 1):
            tried += 1
            try:
                body = open(url, 'rb').read() if files else fetch(url + ('?paged=%d' % pg if pg > 1 else ''))
                new += items_from(src, body, need)
            except Exception as e:
                failed += 1
                print(f'{src} page {pg}: {e}', file=sys.stderr)
    if failed == tried:
        sys.exit('no feed could be read: the old files stay')
    # merge with what we had (keeps photos found earlier), newest first, no doubles
    known = {it['id']: it for it in old}
    seen, items = set(), []
    now = float(opt('--now') or time.time() * 1000)      # (--now: a fixed 'today' for the tests)
    for it in sorted(new + old, key=lambda x: -x['t']):
        key = re.sub(r'\W+', '', it['title'].lower())[:50]
        if it['id'] in seen or key in seen or SKIP_RE.search(it['title'] + ' ' + it.get('text', '')) or it['t'] < now - CAND_DAYS * 864e5:
            continue
        seen.update([it['id'], key])
        k = known.get(it['id'])
        if k and k.get('img') and not it.get('img'):
            it['img'] = k['img']
        if k and k.get('og'):
            it['og'] = k['og']
        items.append(it)
    # a sharper photo: a feed thumbnail (or no photo) -> the share photo of the article page
    reads = 0
    for it in items:
        small = it.get('img') and SMALL.search(it['img'].split('?')[0])
        if (small or not it.get('img')) and 'og' not in it and it.get('link') and not files and reads < OG_PER_RUN:
            reads += 1
            it['og'] = og_image(it['link']) or ''
        if it.get('og'):
            if it.get('img') and it['img'] != it['og']:
                it['thumb'] = it['img']
            it['img'] = it['og']
    # a photo used by several items is the site's default picture, not a news photo
    count = {}
    for it in items:
        count[it.get('img')] = count.get(it.get('img'), 0) + 1
    items = [it for it in items if it.get('img') and count[it['img']] <= 2]
    model = load_model()
    for it in items:
        it['s'] = interest(it, model)
    cand = {'v': FORMAT, 'updated': int(now), 'items': items[:CAND_MAX]}
    # for the game: at most a week old, the event (if any) not over yet, interesting enough
    keep = [{k: it[k] for k in ('id', 't', 'title', 'text', 'src', 'img', 'thumb', 's', 'until') if k in it}
            for it in items if it['t'] > now - NEWS_DAYS * 864e5 and it.get('until', now + 1) > now and it['s'] >= model.get('min', -99)]
    news = {'v': FORMAT, 'updated': int(now), 'items': keep[:NEWS_MAX]}
    json.dump(news, open(opt('--out') or 'news.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    if opt('--cand'):
        json.dump(cand, open(opt('--cand'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'{len(keep)} news items ({sum(1 for it in items if it.get("until", now + 1) <= now)} about events that are over), {len(items)} candidates ({len(new)} from the feeds, {reads} article pages read)')


if __name__ == '__main__':
    main()
