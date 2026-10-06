from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os
FONT='/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc'
def tile_layer(S, scale=1.0, cx=None, cy=None):
    """Draw a mahjong tile with 中 + small flower, on transparent canvas S x S."""
    im = Image.new('RGBA', (S, S), (0,0,0,0))
    d = ImageDraw.Draw(im)
    w = int(S*0.50*scale); h = int(w*1.3)
    cx = S//2 if cx is None else cx; cy = S//2 if cy is None else cy
    x0 = cx - w//2 - int(w*0.04); y0 = cy - h//2 - int(w*0.05)
    r = int(w*0.16); dd = int(w*0.09)
    # shadow
    sh = Image.new('RGBA', (S,S), (0,0,0,0)); sd = ImageDraw.Draw(sh)
    sd.rounded_rectangle([x0+dd*1.6, y0+dd*2, x0+w+dd*1.6, y0+h+dd*2], r, fill=(0,0,0,110))
    sh = sh.filter(ImageFilter.GaussianBlur(S*0.02)); im.alpha_composite(sh)
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([x0+dd, y0+dd*1.2, x0+w+dd, y0+h+dd*1.2], r, fill=(31,122,92,255))
    d.rounded_rectangle([x0+dd*0.5, y0+dd*0.6, x0+w+dd*0.5, y0+h+dd*0.6], r, fill=(222,207,164,255))
    # face gradient
    face = Image.new('RGBA', (w, h)); fd = ImageDraw.Draw(face)
    for yy in range(h):
        t = yy/h; c = (int(255-10*t), int(253-18*t), int(246-40*t), 255); fd.line([(0,yy),(w,yy)], fill=c)
    m = Image.new('L', (w,h), 0); ImageDraw.Draw(m).rounded_rectangle([0,0,w-1,h-1], r, fill=255)
    im.paste(face, (x0,y0), m)
    d = ImageDraw.Draw(im)
    f = ImageFont.truetype(FONT, int(w*0.78))
    d.text((x0+w/2, y0+h*0.52), '中', font=f, fill=(207,42,31,255), anchor='mm')
    return im
def bg(S, rounded=True):
    im = Image.new('RGBA', (S,S), (0,0,0,0))
    g = Image.new('RGBA', (S,S)); gd = ImageDraw.Draw(g)
    for yy in range(S):
        t=yy/S; gd.line([(0,yy),(S,yy)], fill=(int(52-30*t), int(190-90*t), int(140-70*t), 255))
    m = Image.new('L',(S,S),0); md=ImageDraw.Draw(m)
    if rounded: md.rounded_rectangle([0,0,S-1,S-1], int(S*0.22), fill=255)
    else: md.rectangle([0,0,S,S], fill=255)
    im.paste(g,(0,0),m)
    # sparkles
    d=ImageDraw.Draw(im)
    for (x,y,s) in [(0.2,0.22,0.035),(0.82,0.3,0.028),(0.78,0.8,0.03)]:
        X,Y,R=x*S,y*S,s*S
        d.polygon([(X,Y-R),(X+R*0.3,Y-R*0.3),(X+R,Y),(X+R*0.3,Y+R*0.3),(X,Y+R),(X-R*0.3,Y+R*0.3),(X-R,Y),(X-R*0.3,Y-R*0.3)], fill=(255,226,110,255))
    return im
dens = {'mdpi':1,'hdpi':1.5,'xhdpi':2,'xxhdpi':3,'xxxhdpi':4}
for k,s in dens.items():
    os.makedirs(f'res/mipmap-{k}', exist_ok=True)
    S = int(48*s); big = 512
    icon = bg(big); icon.alpha_composite(tile_layer(big, 1.05))
    icon.resize((S,S), Image.LANCZOS).save(f'res/mipmap-{k}/ic_launcher.png')
    F = int(108*s)
    fg = tile_layer(432, 0.62)  # stays inside 66dp safe zone
    fg.resize((F,F), Image.LANCZOS).save(f'res/mipmap-{k}/ic_fg.png')
    bgi = bg(432, rounded=False); bgi.resize((F,F), Image.LANCZOS).save(f'res/mipmap-{k}/ic_bg.png')
big = bg(512); big.alpha_composite(tile_layer(512,1.05)); big.save('icon512.png')
