# -*- coding: utf-8 -*-
"""
Gerador do mapa — Operação Atlântico Sul · Versão Histórica (Malvinas/Falklands, 1982)
Grade hexagonal 20×10 (A–T × 1–10), hexágonos de topo plano, deslocamento "odd-q"
(colunas B, D, F… deslocadas meia célula para baixo). 1 hex = 75 NM (centro a centro).

Projeção: Cônica Conforme de Lambert (paralelos-padrão 47°S e 55°S, meridiano 53°W)
→ formas preservadas e escala praticamente constante (erro < 1,5 %) em todo o teatro.
Dados: Natural Earth 1:10M (terra, ilhas menores, fronteiras, batimetria).
"""
import json, math, random
import numpy as np
import shapefile
from shapely.geometry import shape, box, Polygon, MultiPolygon, LineString
from shapely.ops import unary_union, transform as shp_transform
from pyproj import Transformer, Geod
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops

NE = "/home/claude/ne/"
OUT = "/mnt/user-data/outputs/"

# ---------------------------------------------------------------- parâmetros
COLS, ROWS = 20, 10
HEX_NM = 75.0
R_KM = HEX_NM * 1.852 / math.sqrt(3)          # raio (centro→vértice) em km
R_PX = 96                                      # raio em pixels (imagem final)
M = 76                                         # margem (px) em volta da grade
SS = 2                                         # supersampling
S3 = math.sqrt(3)

GRID_W_KM = (1.5 * (COLS - 1) + 2) * R_KM
GRID_H_KM = (S3 * ROWS + S3 / 2) * R_KM
X0_KM, Y1_KM = -1262.0, 650.0                  # canto sup. esq. da grade (km, LCC)

PROJ = "+proj=lcc +lat_1=-47 +lat_2=-55 +lat_0=-51 +lon_0=-53 +ellps=WGS84 +units=km"
fwd = Transformer.from_crs("EPSG:4326", PROJ, always_xy=True)
inv = Transformer.from_crs(PROJ, "EPSG:4326", always_xy=True)
geod = Geod(ellps="WGS84")

K = R_PX / R_KM                                # px por km (imagem final)
W = int(round(GRID_W_KM * K)) + 2 * M
H = int(round(GRID_H_KM * K)) + 2 * M
WS, HS = W * SS, H * SS

def km2px(x, y, ss=SS):
    return ((M + (x - X0_KM) * K) * ss, (M + (Y1_KM - y) * K) * ss)

def ll2px(lon, lat, ss=SS):
    x, y = fwd.transform(lon, lat)
    return km2px(x, y, ss)

def px2ll(px, py):
    x = X0_KM + (px - M) / K
    y = Y1_KM - (py - M) / K
    return inv.transform(x, y)

# limites geográficos da janela (com folga) para recorte
corners = [px2ll(px, py) for px in (0, W / 2, W) for py in (0, H / 2, H)]
LON_MIN = min(c[0] for c in corners) - 2; LON_MAX = max(c[0] for c in corners) + 2
LAT_MIN = min(c[1] for c in corners) - 2; LAT_MAX = max(c[1] for c in corners) + 2
CLIP = box(LON_MIN, LAT_MIN, LON_MAX, LAT_MAX)

def hex_center(c, r, ss=1):
    cx = M + R_PX + 1.5 * R_PX * c
    cy = M + S3 / 2 * R_PX + S3 * R_PX * r + (S3 / 2 * R_PX if c % 2 else 0)
    return cx * ss, cy * ss

def hex_corners(cx, cy, rad):
    return [(cx + rad * math.cos(math.radians(60 * i)), cy + rad * math.sin(math.radians(60 * i))) for i in range(6)]

# ---------------------------------------------------------------- dados
def load_geojson(fn):
    d = json.load(open(NE + fn))
    geoms = []
    for f in d["features"]:
        g = shape(f["geometry"])
        if g.intersects(CLIP):
            geoms.append(g.intersection(CLIP))
    return geoms

def polys(g):
    if g.is_empty: return []
    if isinstance(g, Polygon): return [g]
    if isinstance(g, MultiPolygon): return list(g.geoms)
    return [p for gg in getattr(g, "geoms", []) for p in polys(gg)]

def lines(g):
    if g.is_empty: return []
    if isinstance(g, LineString): return [g]
    return [l for gg in getattr(g, "geoms", []) for l in lines(gg)]

print("carregando terra…")
land = unary_union(load_geojson("ne_10m_land.geojson") + load_geojson("ne_10m_minor_islands.geojson"))
LAND_POLYS = sorted(polys(land), key=lambda p: -p.area)
BORDERS = [l for g in load_geojson("ne_10m_admin_0_boundary_lines_land.geojson") for l in lines(g)]

def load_bathy(tag):
    sf = shapefile.Reader(NE + f"ne_10m_bathymetry_{tag}")
    out = []
    for s in sf.shapes():
        g = shape(s.__geo_interface__)
        if g.intersects(CLIP):
            out += polys(g.intersection(CLIP))
    return sorted(out, key=lambda p: -p.area)

print("carregando batimetria…")
BATHY = [(d, load_bathy(t)) for d, t in [(200, "K_200"), (1000, "J_1000"), (2000, "I_2000"),
                                          (3000, "H_3000"), (4000, "G_4000")]]

def ring_px(coords):
    pts = []
    for lon, lat in coords:
        pts.append(ll2px(lon, lat))
    return pts

def rasterize(polylist):
    m = Image.new("L", (WS, HS), 0)
    d = ImageDraw.Draw(m)
    for p in polylist:  # maiores primeiro: ilhas dentro de buracos são redesenhadas depois
        ext = ring_px(p.exterior.coords)
        if len(ext) > 2: d.polygon(ext, fill=255)
        for hole in p.interiors:
            hp = ring_px(hole.coords)
            if len(hp) > 2: d.polygon(hp, fill=0)
    return m.resize((W, H), Image.BOX)

# ---------------------------------------------------------------- paleta (identidade do jogo)
SEA_SHELF  = np.array([22, 58, 92])     # plataforma (< 200 m)
SEA_LEVELS = [np.array(c) for c in ([16, 44, 74], [12, 35, 61], [10, 29, 52], [8, 24, 44], [7, 20, 38])]
LAND_BASE  = np.array([74, 60, 38])
LAND_HI    = np.array([108, 86, 54])
COAST      = (184, 148, 88)
GOLD       = (212, 175, 90)
TXT_BLUE   = (120, 160, 196)
TXT_DIM    = (86, 120, 152)

def arr(img): return np.asarray(img, dtype=np.float32) / 255.0

# ---------------------------------------------------------------- mar
print("renderizando mar…")
sea = np.ones((H, W, 3), np.float32) * SEA_SHELF
depth_masks = {}
for (d, pl), col in zip(BATHY, SEA_LEVELS):
    mk = rasterize(pl)
    depth_masks[d] = mk
    a = arr(mk.filter(ImageFilter.GaussianBlur(10)))[..., None]
    sea = sea * (1 - a) + col * a

# vinheta radial + leve brilho central (como no tabuleiro)
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
cxn, cyn = W * 0.52, H * 0.46
rr = np.sqrt(((xx - cxn) / (W * 0.62)) ** 2 + ((yy - cyn) / (H * 0.70)) ** 2)
vign = np.clip(1.08 - 0.38 * rr ** 1.6, 0.55, 1.1)[..., None]
sea = sea * vign
# ruído fino
rng = np.random.default_rng(1982)
sea += rng.normal(0, 1.4, (H, W, 1)).astype(np.float32)

# isóbata de 200 m (quebra da plataforma) — linha sutil
edge = depth_masks[200].filter(ImageFilter.FIND_EDGES).filter(ImageFilter.MaxFilter(3))
ea = arr(edge.filter(ImageFilter.GaussianBlur(1)))[..., None] * 0.16
sea = sea * (1 - ea) + np.array([90, 150, 200]) * ea
edge1k = depth_masks[1000].filter(ImageFilter.FIND_EDGES).filter(ImageFilter.MaxFilter(3))
ea = arr(edge1k.filter(ImageFilter.GaussianBlur(1)))[..., None] * 0.07
sea = sea * (1 - ea) + np.array([90, 150, 200]) * ea

# ---------------------------------------------------------------- terra
print("renderizando terra…")
land_mask = rasterize(LAND_POLYS)
lm = arr(land_mask)[..., None]

# brilho dourado externo da costa (glow)
glow = arr(land_mask.filter(ImageFilter.GaussianBlur(9)))[..., None] * (1 - lm)
sea = sea + np.array([150, 120, 60]) * glow * 0.28

# sombreamento interno: mais claro junto à costa, mais escuro no interior
dist = arr(ImageChops.invert(land_mask).filter(ImageFilter.GaussianBlur(26)))[..., None]
landcol = LAND_BASE * (1 - dist * 0.9) + LAND_HI * (dist * 0.9)
# textura "papel/terreno"
tex = rng.normal(0, 1, (H // 5, W // 5)).astype(np.float32)
tex_img = Image.fromarray(((tex - tex.min()) / (tex.max() - tex.min()) * 255).astype(np.uint8))
tex_img = tex_img.resize((W, H), Image.BICUBIC).filter(ImageFilter.GaussianBlur(3))
landcol = landcol * (0.93 + 0.14 * arr(tex_img)[..., None])
landcol += rng.normal(0, 2.0, (H, W, 1)).astype(np.float32)

img = sea * (1 - lm) + landcol * lm

# linha de costa
coast = land_mask.filter(ImageFilter.FIND_EDGES)
ca = np.clip(arr(coast) * 1.6, 0, 1)[..., None] * 0.9
img = img * (1 - ca) + np.array(COAST) * ca

base = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8), "RGB").convert("RGBA")

# ---------------------------------------------------------------- camadas vetoriais
ov = Image.new("RGBA", (WS, HS), (0, 0, 0, 0))
od = ImageDraw.Draw(ov)

def dashed(draw, pts, dash, gap, fill, width):
    acc, on = 0.0, True
    seg_left = dash
    for (x1, y1), (x2, y2) in zip(pts[:-1], pts[1:]):
        L = math.hypot(x2 - x1, y2 - y1); pos = 0.0
        while pos < L:
            step = min(seg_left, L - pos)
            if on:
                a = pos / L; b = (pos + step) / L
                draw.line([(x1 + (x2 - x1) * a, y1 + (y2 - y1) * a), (x1 + (x2 - x1) * b, y1 + (y2 - y1) * b)], fill=fill, width=width)
            pos += step; seg_left -= step
            if seg_left <= 1e-6:
                on = not on; seg_left = dash if on else gap

# graticulado a cada 2°
for lon in range(-76, -28, 2):
    pts = [ll2px(lon, lat / 4) for lat in range(-60 * 4, -40 * 4 + 1)]
    dashed(od, pts, 3 * SS, 7 * SS, (120, 170, 215, 40), 1 * SS)
for lat in range(-60, -40, 2):
    pts = [ll2px(lon / 4, lat) for lon in range(-80 * 4, -28 * 4 + 1)]
    dashed(od, pts, 3 * SS, 7 * SS, (120, 170, 215, 40), 1 * SS)

# fronteira Argentina–Chile
for l in BORDERS:
    pts = [ll2px(x, y) for x, y in l.coords]
    dashed(od, pts, 7 * SS, 5 * SS, (225, 185, 110, 170), int(1.5 * SS))

# Zona de Exclusão Total (200 NM a partir de 51°40'S 59°30'W — declarada em 30 ABR 1982)
TEZ_C = (-59.5, -(51 + 40 / 60))
circ = []
for az in np.arange(0, 360.5, 0.5):
    lo, la, _ = geod.fwd(TEZ_C[0], TEZ_C[1], az, 200 * 1852)
    circ.append(ll2px(lo, la))
dashed(od, circ, 9 * SS, 7 * SS, (150, 195, 230, 120), int(1.6 * SS))

base = Image.alpha_composite(base, ov.resize((W, H), Image.LANCZOS))

# ---------------------------------------------------------------- tipografia
FD = "/usr/share/fonts/truetype/dejavu/"
def F(name, size): return ImageFont.truetype(FD + name, int(size * SS))
MONO, MONO_B = "DejaVuSansMono.ttf", "DejaVuSansMono-Bold.ttf"
SERIF_I, SERIF = "DejaVuSerif-Italic.ttf", "DejaVuSerif.ttf"

txt = Image.new("RGBA", (WS, HS), (0, 0, 0, 0))
td = ImageDraw.Draw(txt)

def spaced(text, font, track):
    """largura de texto com espaçamento entre letras"""
    return sum(td.textlength(ch, font=font) for ch in text) + track * (len(text) - 1)

def draw_spaced(xy, text, font, fill, track=0, anchor="mm", halo=None):
    w = spaced(text, font, track * SS)
    x, y = xy
    if anchor[0] == "m": x -= w / 2
    elif anchor[0] == "r": x -= w
    for ch in text:
        if halo:
            td.text((x, y), ch, font=font, fill=halo, anchor="lm", stroke_width=int(3 * SS), stroke_fill=halo)
        td.text((x, y), ch, font=font, fill=fill, anchor="lm")
        x += td.textlength(ch, font=font) + track * SS

HALO_SEA = (8, 24, 44, 150)
HALO_LAND = (60, 45, 25, 170)

def place(lon, lat, name, dx=10, dy=0, anchor="lm", kind="town", size=13, color=None, halo=HALO_LAND):
    x, y = ll2px(lon, lat)
    if kind == "town":
        td.ellipse([x - 4 * SS, y - 4 * SS, x + 4 * SS, y + 4 * SS], fill=(235, 205, 140, 255), outline=(40, 30, 15, 255), width=SS)
    elif kind == "base":   # base aérea / naval — losango
        s = 6 * SS
        td.polygon([(x, y - s), (x + s, y), (x, y + s), (x - s, y)], fill=(235, 205, 140, 255), outline=(40, 30, 15, 255))
    elif kind == "capital":
        td.ellipse([x - 6 * SS, y - 6 * SS, x + 6 * SS, y + 6 * SS], outline=(235, 205, 140, 255), width=2 * SS)
        td.ellipse([x - 3 * SS, y - 3 * SS, x + 3 * SS, y + 3 * SS], fill=(235, 205, 140, 255))
    draw_spaced((x + dx * SS, y + dy * SS), name, F(MONO, size), color or (225, 205, 160, 255), 0.5, anchor, halo)

# --- Argentina (continente) — bases de onde operaram FAA / COAN
place(-67.50, -45.86, "Comodoro Rivadavia", kind="base")
place(-65.90, -47.75, "Puerto Deseado", kind="town")
place(-67.72, -49.31, "Puerto San Julián", kind="base")
place(-68.52, -50.02, "Puerto Santa Cruz", kind="town")
place(-69.22, -51.62, "Río Gallegos", kind="base")
place(-67.70, -53.79, "Río Grande", kind="base")
place(-68.30, -54.80, "Ushuaia", kind="base", dx=-10, anchor="rm")
place(-70.91, -53.16, "Punta Arenas", kind="town", dx=10, dy=-14)
# --- Malvinas / Falklands
place(-57.85, -51.69, "Puerto Argentino / Stanley", kind="capital", dx=12)
place(-58.97, -51.83, "Goose Green", kind="town", dx=-2, dy=16, anchor="mm", size=12)
place(-59.03, -51.50, "San Carlos", kind="town", dx=10, dy=-2, size=12)
place(-59.52, -51.62, "Port Howard", kind="town", dx=-10, dy=6, anchor="rm", size=12)
place(-60.07, -51.94, "Fox Bay", kind="town", dx=-10, dy=6, anchor="rm", size=12)
place(-59.55, -51.31, "Pebble", kind="base", dx=0, dy=-15, anchor="mm", size=12)
# --- Geórgias do Sul
place(-36.51, -54.28, "Grytviken", kind="town", dx=-2, dy=18, anchor="mm", size=12)
place(-36.68, -54.14, "Leith", kind="town", dx=-10, dy=-8, anchor="rm", size=12)

def region(lon, lat, text, font, fill, track, halo=None):
    x, y = ll2px(lon, lat)
    draw_spaced((x, y), text, font, fill, track, "mm", halo)

region(-68.9, -47.9, "ARGENTINA", F(SERIF, 30), (225, 200, 150, 235), 10, HALO_LAND)
region(-70.35, -53.62, "CHILE", F(SERIF, 13), (205, 180, 135, 210), 5, HALO_LAND)
region(-68.0, -54.25, "TERRA DO FOGO", F(SERIF_I, 13), (225, 200, 150, 220), 3, HALO_LAND)
region(-70.2, -52.50, "Estreito de Magalhães", F(SERIF_I, 12), TXT_BLUE + (210,), 1, HALO_SEA)
region(-64.0, -55.25, "Isla de los Estados", F(SERIF_I, 12), TXT_BLUE + (210,), 1, HALO_SEA)
region(-67.3, -56.35, "Cabo Horn", F(SERIF_I, 12), TXT_BLUE + (210,), 1, HALO_SEA)
region(-59.0, -52.85, "ILHAS MALVINAS / FALKLAND ISLANDS", F(SERIF_I, 16), (170, 200, 225, 230), 3, HALO_SEA)
region(-37.2, -55.25, "GEÓRGIAS DO SUL", F(SERIF_I, 14), (170, 200, 225, 230), 3, HALO_SEA)
region(-37.2, -55.62, "SOUTH GEORGIA", F(SERIF_I, 11), (150, 185, 215, 200), 3, HALO_SEA)
region(-47.0, -50.8, "ATLÂNTICO SUL", F(SERIF_I, 40), (120, 160, 200, 110), 12)
region(-63.4, -49.4, "MAR ARGENTINO", F(SERIF_I, 18), (120, 160, 200, 110), 8)
region(-59.0, -54.55, "Banco Burdwood", F(SERIF_I, 12), (120, 160, 200, 150), 2)

# rótulo da ZET no topo do círculo
tx, ty = ll2px(TEZ_C[0], TEZ_C[1] + 200 / 60 / 1.0)
draw_spaced((tx, ty - 34 * SS), "ZONA DE EXCLUSÃO TOTAL — 200 NM", F(MONO, 13), (150, 195, 230, 190), 3, "mm", HALO_SEA)
draw_spaced((tx, ty - 16 * SS), "30 ABR 1982", F(MONO, 10), (150, 195, 230, 150), 3, "mm", HALO_SEA)

# rótulos do graticulado (bordas)
fg = F(MONO, 11)
for lat in range(-56, -44, 2):
    # ponto da borda esquerda da grade onde a latitude cruza
    ys = np.linspace(0, H, 3000)
    lats = np.array([px2ll(M * 0.35, y)[1] for y in ys])
    i = int(np.argmin(abs(lats - lat)))
    if 30 < ys[i] < H - 30:
        draw_spaced((M * 0.18 * SS, ys[i] * SS), f"{-lat}°S", fg, TXT_DIM + (170,), 0, "lm")
for lon in range(-70, -34, 4):
    xs = np.linspace(0, W, 4000)
    lons = np.array([px2ll(x, H - M * 0.35)[0] for x in xs])
    i = int(np.argmin(abs(lons - lon)))
    if 40 < xs[i] < W - 40:
        draw_spaced((xs[i] * SS, (H - M * 0.30) * SS), f"{-lon}°W", fg, TXT_DIM + (170,), 0, "mm")

base = Image.alpha_composite(base, txt.resize((W, H), Image.LANCZOS))

# ---------------------------------------------------------------- rosa dos ventos, escala, legenda
dec = Image.new("RGBA", (WS, HS), (0, 0, 0, 0))
dd = ImageDraw.Draw(dec)
# rosa dos ventos orientada ao norte verdadeiro no ponto em que é desenhada
rcx, rcy = (W - M - 70) * SS, (M + 80) * SS
lo, la = px2ll(W - M - 70, M + 80)
x1, y1 = ll2px(lo, la); x2, y2 = ll2px(lo, la + 0.5)
ang = math.atan2(y2 - y1, x2 - x1)
def rot(dx, dy, a):
    ca, sa = math.cos(a), math.sin(a)
    return (rcx + dx * ca - dy * sa, rcy + dx * sa + dy * ca)
Rr = 46 * SS
dd.ellipse([rcx - Rr, rcy - Rr, rcx + Rr, rcy + Rr], outline=(150, 190, 225, 150), width=int(1.5 * SS))
dd.ellipse([rcx - Rr * 0.72, rcy - Rr * 0.72, rcx + Rr * 0.72, rcy + Rr * 0.72], outline=(150, 190, 225, 90), width=SS)
for k in range(4):
    a = ang + k * math.pi / 2
    tip = rot(Rr * 1.15, 0, a); l = rot(Rr * 0.18, Rr * 0.18, a); r_ = rot(Rr * 0.18, -Rr * 0.18, a)
    col = (230, 235, 245, 235) if k == 0 else (150, 190, 225, 200)
    dd.polygon([(rcx, rcy), l, tip], fill=col); dd.polygon([(rcx, rcy), r_, tip], fill=(90, 120, 150, 220))
for k in range(4):
    a = ang + math.pi / 4 + k * math.pi / 2
    tip = rot(Rr * 0.62, 0, a); l = rot(Rr * 0.1, Rr * 0.1, a); r_ = rot(Rr * 0.1, -Rr * 0.1, a)
    dd.polygon([(rcx, rcy), l, tip, r_], fill=(120, 160, 200, 170))
nx, ny = rot(Rr * 1.45, 0, ang)
dd.text((nx, ny), "N", font=F(MONO_B, 16), fill=(230, 235, 245, 240), anchor="mm")

# barra de escala (NM) — medida na latitude média
sx0, sy0 = (W - M - 560) * SS, (H - M - 34) * SS
nm_px = 1.852 * K * SS
for i, v in enumerate([0, 75, 150, 225]):
    x = sx0 + v * nm_px
    if i < 3:
        dd.rectangle([x, sy0, sx0 + [75, 150, 225][i] * nm_px, sy0 + 6 * SS],
                     fill=(212, 175, 90, 220) if i % 2 == 0 else (20, 40, 65, 220), outline=(212, 175, 90, 220), width=SS)
    dd.text((x, sy0 + 20 * SS), str(v), font=F(MONO, 11), fill=(170, 200, 225, 220), anchor="mm")
dd.text((sx0 + 225 * nm_px + 10 * SS, sy0 + 3 * SS), "NM", font=F(MONO, 11), fill=(170, 200, 225, 220), anchor="lm")
dd.text((sx0, sy0 - 14 * SS), "ESCALA · 1 HEX = 75 NM", font=F(MONO, 11), fill=(212, 175, 90, 230), anchor="lm")

# legenda / cartucho (canto inferior esquerdo)
lx, ly = (M + 16) * SS, (H - M - 118) * SS
dd.rounded_rectangle([lx - 12 * SS, ly - 14 * SS, lx + 300 * SS, ly + 92 * SS], radius=4 * SS,
                     fill=(8, 20, 36, 170), outline=(212, 175, 90, 140), width=SS)
dd.text((lx, ly), "TEATRO DE OPERAÇÕES · 1982", font=F(MONO_B, 12), fill=(212, 175, 90, 240), anchor="lm")
dd.ellipse([lx, ly + 20 * SS, lx + 8 * SS, ly + 28 * SS], fill=(235, 205, 140, 255))
dd.text((lx + 16 * SS, ly + 24 * SS), "localidade", font=F(MONO, 11), fill=(190, 210, 230, 220), anchor="lm")
s = 5 * SS; bx, by = lx + 4 * SS, ly + 44 * SS
dd.polygon([(bx, by - s), (bx + s, by), (bx, by + s), (bx - s, by)], fill=(235, 205, 140, 255))
dd.text((lx + 16 * SS, by), "base aérea / aeródromo", font=F(MONO, 11), fill=(190, 210, 230, 220), anchor="lm")
dashed(dd, [(lx - 2 * SS, ly + 64 * SS), (lx + 12 * SS, ly + 64 * SS)], 4 * SS, 3 * SS, (150, 195, 230, 200), 2 * SS)
dd.text((lx + 16 * SS, ly + 64 * SS), "Zona de Exclusão Total", font=F(MONO, 11), fill=(190, 210, 230, 220), anchor="lm")
dd.text((lx, ly + 82 * SS), "Lambert conforme · NE 1:10M", font=F(MONO, 9), fill=(120, 150, 180, 200), anchor="lm")

base = Image.alpha_composite(base, dec.resize((W, H), Image.LANCZOS))

# moldura da área de jogo
fr = Image.new("RGBA", (WS, HS), (0, 0, 0, 0))
fd = ImageDraw.Draw(fr)
fd.rectangle([2 * SS, 2 * SS, WS - 3 * SS, HS - 3 * SS], outline=(212, 175, 90, 90), width=2 * SS)
base_nogrid = Image.alpha_composite(base, fr.resize((W, H), Image.LANCZOS))

# ---------------------------------------------------------------- grade hexagonal (versão com grade)
gr = Image.new("RGBA", (WS, HS), (0, 0, 0, 0))
gd = ImageDraw.Draw(gr)
for c in range(COLS):
    for r in range(ROWS):
        cx, cy = hex_center(c, r, SS)
        pts = hex_corners(cx, cy, R_PX * SS)
        gd.line(pts + [pts[0]], fill=(110, 170, 220, 70), width=int(1.4 * SS))
for c in range(COLS):
    cx, _ = hex_center(c, 0, SS)
    gd.text((cx, M * 0.55 * SS), chr(65 + c), font=F(MONO, 15), fill=(130, 165, 200, 210), anchor="mm")
for r in range(ROWS):
    _, cy = hex_center(0, r, SS)
    gd.text((M * 0.62 * SS, cy), str(r + 1), font=F(MONO, 15), fill=(130, 165, 200, 210), anchor="mm")
base_grid = Image.alpha_composite(base_nogrid, gr.resize((W, H), Image.LANCZOS))

def save(im, fn):
    im.convert("RGB").save(OUT + fn, optimize=True)
    print("salvo", fn, W, H)

save(base_nogrid, "mapa_malvinas_1982_base.png")
save(base_grid, "mapa_malvinas_1982_grade.png")

# ---------------------------------------------------------------- georreferência + terreno por hex
print("calculando terreno por hexágono…")
land_km = shp_transform(lambda x, y, z=None: fwd.transform(x, y), land)
hexes = []
for c in range(COLS):
    for r in range(ROWS):
        cx, cy = hex_center(c, r, 1)
        lon, lat = px2ll(cx, cy)
        poly_km = Polygon([(X0_KM + (px - M) / K, Y1_KM - (py - M) / K) for px, py in hex_corners(cx, cy, R_PX)])
        frac = poly_km.intersection(land_km).area / poly_km.area
        terr = "terra" if frac > 0.6 else ("costa" if frac > 0.02 else "mar")
        hexes.append({"id": f"{chr(65 + c)}{r + 1}", "col": c, "row": r,
                      "px": [round(cx, 1), round(cy, 1)], "lon": round(lon, 4), "lat": round(lat, 4),
                      "fracao_terra": round(frac, 3), "terreno": terr})
meta = {
    "cenario": "Operação Atlântico Sul — Versão Histórica: Malvinas/Falklands 1982",
    "imagem": {"largura_px": W, "altura_px": H, "margem_px": M},
    "grade": {"colunas": COLS, "linhas": ROWS, "orientacao": "topo plano (flat-top)",
              "deslocamento": "odd-q (colunas B, D, F… deslocadas +½ hex para baixo)",
              "raio_px": R_PX, "passo_horizontal_px": 1.5 * R_PX, "passo_vertical_px": round(S3 * R_PX, 3),
              "hex_nm_centro_a_centro": HEX_NM,
              "formula_centro": "x = M + R + 1,5·R·col ; y = M + (√3/2)·R + √3·R·lin + (col ímpar ? (√3/2)·R : 0)"},
    "projecao": {"proj4": PROJ, "x0_km": X0_KM, "y1_km": Y1_KM, "px_por_km": K,
                 "pixel_para_km": "x_km = x0 + (px − M)/K ; y_km = y1 − (py − M)/K"},
    "zona_exclusao_total": {"centro_lon": TEZ_C[0], "centro_lat": TEZ_C[1], "raio_nm": 200, "data": "1982-04-30"},
    "hexagonos": hexes,
}
json.dump(meta, open(OUT + "mapa_malvinas_1982_georef.json", "w"), ensure_ascii=False, indent=1)
print("ok")
