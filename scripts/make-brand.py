"""Generates PROVID brand assets (icon, adaptive icon, splash, favicon, logo SVG).
Run: python3 scripts/make-brand.py   (needs Pillow + numpy)"""
import math, os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

OUT = os.path.join(os.path.dirname(__file__), '..', 'assets')
os.makedirs(OUT, exist_ok=True)
BG1, BG2 = (14, 47, 28), (4, 14, 8)
G1, G2 = (34, 197, 94), (190, 242, 100)     # green -> lime
Y1, Y2 = (255, 214, 10), (255, 236, 120)    # yellow
SS = 3

# ---- geometry in a 1024 design space ----
HEX = [(512 + 330 * math.cos(math.radians(-90 + 60 * k)), 512 + 330 * math.sin(math.radians(-90 + 60 * k))) for k in range(6)]
_tri = [(412, 352), (712, 512), (412, 672)]
_cx = sum(p[0] for p in _tri) / 3; _cy = sum(p[1] for p in _tri) / 3
TRI = [(_cx + (x - _cx) * .9, _cy + (y - _cy) * .9) for x, y in _tri]
SPARK = [(772, 196), (808, 240), (772, 284), (736, 240)]

def grad(w, h, c1, c2, diag=True):
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    t = ((x / w + y / h) / 2) if diag else (y / h)
    t = t[..., None]
    a = np.array(c1, np.float32); b = np.array(c2, np.float32)
    return Image.fromarray((a + (b - a) * t).astype(np.uint8), 'RGB')

def mark(N, m=1.0, glow=True):
    """Transparent RGBA mark on an N x N canvas; m scales the 1024-space design."""
    W = N * SS; k = m * W / 1024; c = W / 2
    tr = lambda pts: [(c + (x - 512) * k, c + (y - 512) * k) for x, y in pts]
    hexp, tri, spark = tr(HEX), tr(TRI), tr(SPARK)
    hexmask = Image.new('L', (W, W), 0); d = ImageDraw.Draw(hexmask)
    d.line(hexp + hexp[:2], fill=255, width=int(56 * k), joint='curve')
    trimask = Image.new('L', (W, W), 0); d = ImageDraw.Draw(trimask)
    d.polygon(tri, fill=255); d.line(tri + tri[:2], fill=255, width=int(44 * k), joint='curve')
    spmask = Image.new('L', (W, W), 0); ImageDraw.Draw(spmask).polygon(spark, fill=255)
    layer = Image.new('RGBA', (W, W), (0, 0, 0, 0))
    if glow:
        g = Image.new('RGBA', (W, W), G1 + (0,)); g.putalpha(hexmask.filter(ImageFilter.GaussianBlur(26 * k)).point(lambda v: int(v * .55)))
        layer = Image.alpha_composite(layer, g)
        yg = Image.new('RGBA', (W, W), Y1 + (0,)); yg.putalpha(trimask.filter(ImageFilter.GaussianBlur(30 * k)).point(lambda v: int(v * .35)))
        layer = Image.alpha_composite(layer, yg)
    # faint hex fill
    fill = Image.new('L', (W, W), 0); ImageDraw.Draw(fill).polygon(hexp, fill=255)
    f = Image.new('RGBA', (W, W), G1 + (0,)); f.putalpha(fill.point(lambda v: v * 30 // 255)); layer = Image.alpha_composite(layer, f)
    for mask, (a, b) in ((hexmask, (G1, G2)), (trimask, (Y1, Y2)), (spmask, (Y1, Y2))):
        im = grad(W, W, a, b).convert('RGBA'); im.putalpha(mask); layer = Image.alpha_composite(layer, im)
    return layer.resize((N, N), Image.LANCZOS)

def background(N, radius=0.0):
    W = N * SS
    bg = grad(W, W, (BG1), (BG2), diag=False).convert('RGBA')
    glow = Image.new('RGBA', (W, W), G1 + (0,))
    yy, xx = np.mgrid[0:W, 0:W].astype(np.float32)
    a = np.clip(1 - np.hypot(xx - W * .5, yy - W * .35) / (W * .6), 0, 1) ** 2 * 90
    glow.putalpha(Image.fromarray(a.astype(np.uint8), 'L')); bg = Image.alpha_composite(bg, glow)
    if radius:
        mask = Image.new('L', (W, W), 0); ImageDraw.Draw(mask).rounded_rectangle([0, 0, W - 1, W - 1], radius=int(radius * W), fill=255)
        bg.putalpha(mask)
    return bg.resize((N, N), Image.LANCZOS)

def font(path, size): return ImageFont.truetype(path, size)
INTER = '/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf'
MONO = '/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf'

def spaced(draw, text, f, cx, y, fill, tracking):
    widths = [draw.textlength(ch, font=f) for ch in text]
    total = sum(widths) + tracking * (len(text) - 1); x = cx - total / 2
    for ch, w in zip(text, widths):
        draw.text((x, y), ch, font=f, fill=fill); x += w + tracking

# 1) app icon: full-bleed square (stores apply their own mask)
icon = Image.alpha_composite(background(1024), mark(1024, 0.92)).convert('RGB'); icon.save(f'{OUT}/icon.png')
# 2) Android adaptive foreground: transparent, mark inside the 66% safe zone
mark(1024, 0.62, glow=False).save(f'{OUT}/adaptive-icon.png')
# 3) transparent mark for in-app use
mark(512, 1.0).save(f'{OUT}/logo-mark.png')
# 4) rounded logo tile (web / README)
Image.alpha_composite(background(512, .22), mark(512, .9)).save(f'{OUT}/logo.png')
# 5) favicon
fav = Image.alpha_composite(background(256, .22), mark(256, .92)); fav.resize((48, 48), Image.LANCZOS).save(f'{OUT}/favicon.png')
fav.save(f'{OUT}/favicon.ico', sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
# 6) splash 1284x2778 : mark + wordmark + tagline
SW, SH = 1284, 2778
splash = background(SW).resize((SW, SH), Image.LANCZOS) if False else None
col = grad(SW, SH, BG1, BG2, diag=False).convert('RGBA')
yy, xx = np.mgrid[0:SH, 0:SW].astype(np.float32)
a = np.clip(1 - np.hypot(xx - SW * .5, yy - SH * .42) / (SW * .85), 0, 1) ** 2 * 110
gl = Image.new('RGBA', (SW, SH), G1 + (0,)); gl.putalpha(Image.fromarray(a.astype(np.uint8), 'L')); col = Image.alpha_composite(col, gl)
m = mark(760, 1.0); col.alpha_composite(m, ((SW - 760) // 2, 880))
d = ImageDraw.Draw(col)
spaced(d, 'PROVID', font(INTER, 128), SW / 2, 1690, (244, 248, 238), 26)
spaced(d, 'SCRIPT  TO  SCREEN', font(MONO, 38), SW / 2, 1870, G2, 12)
col.convert('RGB').save(f'{OUT}/splash.png')

# 7) SVGs (same geometry)
hexpts = ' '.join(f'{x:.1f},{y:.1f}' for x, y in HEX)
tripts = ' '.join(f'{x:.1f},{y:.1f}' for x, y in TRI)
sppts = ' '.join(f'{x},{y}' for x, y in SPARK)
def svg(tile=True, idp='p'):
    rect = f'<rect width="1024" height="1024" rx="230" fill="url(#{idp}bg)"/>' if tile else ''
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><defs>'
      f'<linearGradient id="{idp}bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0e2f1c"/><stop offset="1" stop-color="#040e08"/></linearGradient>'
      f'<linearGradient id="{idp}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#22c55e"/><stop offset="1" stop-color="#bef264"/></linearGradient>'
      f'<linearGradient id="{idp}y" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffd60a"/><stop offset="1" stop-color="#ffec78"/></linearGradient></defs>{rect}'
      f'<polygon points="{hexpts}" fill="#22c55e" fill-opacity=".12" stroke="url(#{idp}g)" stroke-width="56" stroke-linejoin="round"/>'
      f'<polygon points="{tripts}" fill="url(#{idp}y)" stroke="url(#{idp}y)" stroke-width="44" stroke-linejoin="round"/>'
      f'<polygon points="{sppts}" fill="url(#{idp}y)"/></svg>')
open(f'{OUT}/logo.svg', 'w').write(svg(True)); open(f'{OUT}/logo-mark.svg', 'w').write(svg(False))
open('dist/logo.svg', 'w').write(svg(True))
print('brand assets written')
