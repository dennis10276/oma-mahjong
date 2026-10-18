"""Pictures of piles, old next to new (tile spots and layers only, no pictures on the tiles).
   python3 source/tools/sim/variety/render.py out.png 157,158,159   (levels from analysis/variety-progress.json)
Needs boards.json written by: node source/tools/sim/variety/render_data.js <levels> > boards.json"""
import json, sys
from PIL import Image, ImageDraw, ImageFont

def draw_pile(d, tiles, ox, oy, w, h, title):
    xs = [t[0] / 2 - t[2] * 0.14 for t in tiles]; ys = [t[1] / 2 * 1.24 - t[2] * 0.14 for t in tiles]
    W = max(xs) + 1 - min(xs); H = max(ys) + 1.24 - min(ys)
    s = min((w - 20) / W, (h - 40) / H)
    shades = [(236, 226, 203), (220, 205, 170), (201, 182, 139), (179, 156, 110), (155, 130, 86), (131, 106, 66), (110, 86, 50), (90, 68, 38)]
    for t, x, y in sorted(zip(tiles, xs, ys), key=lambda a: (a[0][2], a[0][1], a[0][0])):
        X = ox + 10 + (x - min(xs)) * s; Y = oy + 30 + (y - min(ys)) * s
        d.rectangle([X + 3, Y + 3, X + s * 0.95 + 3, Y + s * 1.18 + 3], fill=(60, 50, 40))
        d.rectangle([X, Y, X + s * 0.95, Y + s * 1.18], fill=shades[min(t[2], 7)], outline=(80, 66, 45))
    d.text((ox + 10, oy + 6), title, fill=(30, 30, 30))

if __name__ == '__main__':
    out = sys.argv[1]; data = json.load(open(sys.argv[2] if len(sys.argv) > 2 else 'boards.json'))
    rows = data['rows']; cw, ch = 300, 420
    img = Image.new('RGB', (cw * 2, ch * len(rows)), (250, 248, 242)); d = ImageDraw.Draw(img)
    for i, r in enumerate(rows):
        draw_pile(d, r['old'], 0, i * ch, cw, ch, f"level {r['lv']} now ({r['oldNote']})")
        draw_pile(d, r['new'], cw, i * ch, cw, ch, f"level {r['lv']} new: {r['shape']} ({r['newNote']})")
    img.save(out)
