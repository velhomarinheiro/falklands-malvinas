"""gen_icons.py — gera os 22 ícones SVG militares para Operação Atlântico Sul."""

import os, math

OUT = '/home/user/wargame-naval/public/icons'
os.makedirs(OUT, exist_ok=True)

# Coordinate system: 64×64 viewBox, centre (32,32), effective sz=28
CX, CY, SZ = 32.0, 32.0, 28.0

def r(v): return round(v, 2)
def pt(x, y): return f'{r(x)},{r(y)}'

def write(name, body, extra_attrs=''):
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"'
        f' width="64" height="64" fill="black" stroke="none" {extra_attrs}>\n'
        f'{body}\n</svg>\n'
    )
    with open(f'{OUT}/{name}.svg', 'w') as f:
        f.write(svg)
    print(f'  {name}.svg')

# ─── Generic ship hull ────────────────────────────────────────────────────────
def ship(name, hw, hh):
    w, h = SZ*hw, SZ*hh
    hull = (f'M{pt(CX,CY-h)} L{pt(CX+w,CY-h*0.15)} '
            f'L{pt(CX+w*0.88,CY+h)} L{pt(CX-w*0.88,CY+h)} '
            f'L{pt(CX-w,CY-h*0.15)} Z')
    rx,ry = CX-w*0.38, CY-h*0.05
    rw,rh = w*0.76, h*0.52
    struct = f'<rect x="{r(rx)}" y="{r(ry)}" width="{r(rw)}" height="{r(rh)}" opacity="0.45"/>'
    write(name, f'<path d="{hull}"/>\n{struct}')

ship('fragata',    0.48, 0.52)
ship('corveta',    0.40, 0.44)
ship('cruzador',   0.62, 0.54)
ship('destroier',  0.44, 0.58)
ship('patrulha_oc',0.42, 0.46)
ship('patrulha_c', 0.30, 0.36)

# ─── Carrier ─────────────────────────────────────────────────────────────────
def carrier():
    w, h = SZ*0.84, SZ*0.28
    deck  = (f'M{pt(CX-w*0.60,CY-h)} L{pt(CX+w,CY-h)} '
             f'L{pt(CX+w,CY+h)} L{pt(CX-w*0.60,CY+h)} '
             f'L{pt(CX-w,CY)} Z')
    ang   = (f'M{pt(CX-w*0.08,CY-h)} L{pt(CX-w*0.55,CY-h*2.6)} '
             f'L{pt(CX-w*0.22,CY-h*2.6)} L{pt(CX+w*0.18,CY-h)} Z')
    isl   = (f'<rect x="{r(CX+w*0.30)}" y="{r(CY-h)}" '
             f'width="{r(w*0.24)}" height="{r(h*0.68)}" opacity="0.45"/>')
    write('carrier', f'<path d="{deck}"/>\n<path d="{ang}"/>\n{isl}')
carrier()

# ─── Amphibious ───────────────────────────────────────────────────────────────
def amphib():
    w, h = SZ*0.56, SZ*0.50
    hull  = (f'M{pt(CX,CY-h)} L{pt(CX+w,CY-h*0.45)} '
             f'L{pt(CX+w,CY+h)} L{pt(CX-w,CY+h)} '
             f'L{pt(CX-w,CY-h*0.45)} Z')
    ramp  = (f'<rect x="{r(CX-w*0.52)}" y="{r(CY+h*0.68)}" '
             f'width="{r(w*1.04)}" height="{r(h*0.24)}" opacity="0.45"/>')
    write('amphib', f'<path d="{hull}"/>\n{ramp}')
amphib()

# ─── Logistics ────────────────────────────────────────────────────────────────
def logistico():
    w, h = SZ*0.53, SZ*0.46
    hull  = (f'M{pt(CX,CY-h)} L{pt(CX+w*0.85,CY-h*0.22)} '
             f'L{pt(CX+w*0.85,CY+h)} L{pt(CX-w*0.85,CY+h)} '
             f'L{pt(CX-w*0.85,CY-h*0.22)} Z')
    h1    = (f'<rect x="{r(CX-w*0.65)}" y="{r(CY-h*0.06)}" '
             f'width="{r(w*0.44)}" height="{r(h*0.48)}" opacity="0.45"/>')
    h2    = (f'<rect x="{r(CX+w*0.10)}" y="{r(CY-h*0.06)}" '
             f'width="{r(w*0.44)}" height="{r(h*0.48)}" opacity="0.45"/>')
    write('logistico', f'<path d="{hull}"/>\n{h1}\n{h2}')
logistico()

# ─── Tanker ───────────────────────────────────────────────────────────────────
def tanque():
    hull  = (f'<ellipse cx="{CX}" cy="{r(CY+SZ*0.04)}" '
             f'rx="{r(SZ*0.58)}" ry="{r(SZ*0.36)}"/>')
    tanks = ''
    for i in (-1, 0, 1):
        tanks += (f'<ellipse cx="{r(CX+i*SZ*0.26)}" cy="{r(CY+SZ*0.04)}" '
                  f'rx="{r(SZ*0.16)}" ry="{r(SZ*0.20)}" opacity="0.45"/>\n')
    write('tanque', hull + '\n' + tanks)
tanque()

# ─── Submarines ───────────────────────────────────────────────────────────────
def submarino():
    hull  = (f'<ellipse cx="{CX}" cy="{CY}" '
             f'rx="{r(SZ*0.56)}" ry="{r(SZ*0.20)}"/>')
    tower = (f'<rect x="{r(CX-SZ*0.08)}" y="{r(CY-SZ*0.20-SZ*0.12)}" '
             f'width="{r(SZ*0.16)}" height="{r(SZ*0.14)}" opacity="0.45"/>')
    write('submarino', hull + '\n' + tower)
submarino()

def sub_nuclear():
    hull  = (f'<ellipse cx="{CX}" cy="{CY}" '
             f'rx="{r(SZ*0.68)}" ry="{r(SZ*0.22)}"/>')
    tower = (f'<rect x="{r(CX-SZ*0.11)}" y="{r(CY-SZ*0.22-SZ*0.18)}" '
             f'width="{r(SZ*0.22)}" height="{r(SZ*0.20)}" opacity="0.45"/>')
    ax, ay = CX, CY - SZ*0.52
    nr = SZ * 0.11
    nucleus = f'<circle cx="{r(ax)}" cy="{r(ay)}" r="{r(SZ*0.04)}"/>'
    sw = r(max(0.8, SZ*0.045))
    orbits = ''
    for i in range(3):
        angle = i * 60
        orbits += (f'<ellipse cx="{r(ax)}" cy="{r(ay)}" '
                   f'rx="{r(nr*1.8)}" ry="{r(nr*0.55)}" '
                   f'transform="rotate({angle} {r(ax)} {r(ay)})" '
                   f'fill="none" stroke="black" stroke-width="{sw}"/>\n')
    write('sub_nuclear', hull + '\n' + tower + '\n' + nucleus + '\n' + orbits)
sub_nuclear()

# ─── Maritime patrol aircraft (P-3 style) ────────────────────────────────────
def patrulha():
    fus   = (f'<ellipse cx="{CX}" cy="{CY}" '
             f'rx="{r(SZ*0.10)}" ry="{r(SZ*0.46)}"/>')
    wr    = f'M{pt(CX,CY-SZ*0.04)} L{pt(CX+SZ*0.54,CY+SZ*0.12)} L{pt(CX+SZ*0.50,CY+SZ*0.26)} L{pt(CX,CY+SZ*0.12)} Z'
    wl    = f'M{pt(CX,CY-SZ*0.04)} L{pt(CX-SZ*0.54,CY+SZ*0.12)} L{pt(CX-SZ*0.50,CY+SZ*0.26)} L{pt(CX,CY+SZ*0.12)} Z'
    tail  = f'M{pt(CX,CY+SZ*0.36)} L{pt(CX+SZ*0.16,CY+SZ*0.46)} L{pt(CX-SZ*0.16,CY+SZ*0.46)} Z'
    write('patrulha', fus + f'\n<path d="{wr}"/>\n<path d="{wl}"/>\n<path d="{tail}"/>')
patrulha()

# ─── Fighter (delta wing) ─────────────────────────────────────────────────────
def caca():
    fus   = (f'<ellipse cx="{CX}" cy="{CY}" '
             f'rx="{r(SZ*0.07)}" ry="{r(SZ*0.42)}"/>')
    wr    = f'M{pt(CX,CY-SZ*0.04)} L{pt(CX+SZ*0.48,CY+SZ*0.34)} L{pt(CX+SZ*0.28,CY+SZ*0.42)} L{pt(CX,CY+SZ*0.10)} Z'
    wl    = f'M{pt(CX,CY-SZ*0.04)} L{pt(CX-SZ*0.48,CY+SZ*0.34)} L{pt(CX-SZ*0.28,CY+SZ*0.42)} L{pt(CX,CY+SZ*0.10)} Z'
    tail  = f'M{pt(CX,CY+SZ*0.30)} L{pt(CX+SZ*0.09,CY+SZ*0.42)} L{pt(CX-SZ*0.09,CY+SZ*0.42)} Z'
    write('caca', fus + f'\n<path d="{wr}"/>\n<path d="{wl}"/>\n<path d="{tail}"/>')
caca()

# ─── Attack aircraft ──────────────────────────────────────────────────────────
def ataque():
    fus   = (f'<ellipse cx="{CX}" cy="{CY}" '
             f'rx="{r(SZ*0.10)}" ry="{r(SZ*0.44)}"/>')
    wr    = f'M{pt(CX,CY+SZ*0.02)} L{pt(CX+SZ*0.52,CY+SZ*0.26)} L{pt(CX+SZ*0.48,CY+SZ*0.40)} L{pt(CX,CY+SZ*0.20)} Z'
    wl    = f'M{pt(CX,CY+SZ*0.02)} L{pt(CX-SZ*0.52,CY+SZ*0.26)} L{pt(CX-SZ*0.48,CY+SZ*0.40)} L{pt(CX,CY+SZ*0.20)} Z'
    tail  = f'M{pt(CX,CY+SZ*0.34)} L{pt(CX+SZ*0.17,CY+SZ*0.44)} L{pt(CX-SZ*0.17,CY+SZ*0.44)} Z'
    write('ataque', fus + f'\n<path d="{wr}"/>\n<path d="{wl}"/>\n<path d="{tail}"/>')
ataque()

# ─── AEW (rotodome) ───────────────────────────────────────────────────────────
def aew():
    dome  = (f'<ellipse cx="{CX}" cy="{r(CY-SZ*0.12)}" '
             f'rx="{r(SZ*0.46)}" ry="{r(SZ*0.11)}"/>')
    strut = (f'<rect x="{r(CX-SZ*0.04)}" y="{r(CY-SZ*0.01)}" '
             f'width="{r(SZ*0.08)}" height="{r(SZ*0.15)}"/>')
    fus   = (f'<ellipse cx="{CX}" cy="{r(CY+SZ*0.14)}" '
             f'rx="{r(SZ*0.09)}" ry="{r(SZ*0.34)}"/>')
    wr    = f'M{pt(CX,CY+SZ*0.06)} L{pt(CX+SZ*0.48,CY+SZ*0.24)} L{pt(CX+SZ*0.42,CY+SZ*0.34)} L{pt(CX,CY+SZ*0.18)} Z'
    wl    = f'M{pt(CX,CY+SZ*0.06)} L{pt(CX-SZ*0.48,CY+SZ*0.24)} L{pt(CX-SZ*0.42,CY+SZ*0.34)} L{pt(CX,CY+SZ*0.18)} Z'
    write('aew', dome + '\n' + strut + '\n' + fus + f'\n<path d="{wr}"/>\n<path d="{wl}"/>')
aew()

# ─── Helicopter ───────────────────────────────────────────────────────────────
def helicoptero():
    blade = SZ * 0.52
    sw    = r(max(1.5, SZ*0.08))
    blades = (f'<line x1="{r(CX-blade)}" y1="{CY}" x2="{r(CX+blade)}" y2="{CY}" '
              f'stroke="black" stroke-width="{sw}"/>\n'
              f'<line x1="{CX}" y1="{r(CY-blade)}" x2="{CX}" y2="{r(CY+blade)}" '
              f'stroke="black" stroke-width="{sw}"/>')
    fus   = (f'<ellipse cx="{CX}" cy="{CY}" '
             f'rx="{r(SZ*0.13)}" ry="{r(SZ*0.22)}"/>')
    boom  = (f'<line x1="{CX}" y1="{r(CY+SZ*0.22)}" x2="{CX}" y2="{r(CY+SZ*0.50)}" '
             f'stroke="black" stroke-width="{r(max(1,SZ*0.06))}"/>')
    trotor= (f'<line x1="{r(CX-SZ*0.11)}" y1="{r(CY+SZ*0.50)}" '
             f'x2="{r(CX+SZ*0.11)}" y2="{r(CY+SZ*0.50)}" '
             f'stroke="black" stroke-width="{r(max(1,SZ*0.05))}"/>')
    write('helicoptero', blades + '\n' + fus + '\n' + boom + '\n' + trotor)
helicoptero()

# ─── Coastal battery ─────────────────────────────────────────────────────────
def bateria_costeira():
    lw = r(max(1.2, SZ*0.08))
    # Radar arc
    ra = SZ * 0.28
    a1, a2 = math.pi*1.12, math.pi*1.88
    rx0 = CX - SZ*0.18 + ra*math.cos(a1)
    ry0 = CY - SZ*0.08 + ra*math.sin(a1)
    rx1 = CX - SZ*0.18 + ra*math.cos(a2)
    ry1 = CY - SZ*0.08 + ra*math.sin(a2)
    radar = (f'<path d="M{pt(rx0,ry0)} A{r(ra)},{r(ra)} 0 0,1 {pt(rx1,ry1)}" '
             f'fill="none" stroke="black" stroke-width="{lw}"/>\n'
             f'<line x1="{r(CX-SZ*0.18)}" y1="{r(CY-SZ*0.08)}" '
             f'x2="{r(CX-SZ*0.18)}" y2="{r(CY+SZ*0.20)}" '
             f'stroke="black" stroke-width="{lw}"/>')
    # Rotated launcher
    angle = -math.pi * 0.28
    tx, ty = CX + SZ*0.26, CY + SZ*0.08
    ca, sa = math.cos(angle), math.sin(angle)
    def rot(lx, ly): return r(lx*ca - ly*sa + tx), r(lx*sa + ly*ca + ty)
    p1 = rot(-SZ*0.06, -SZ*0.28); p2 = rot( SZ*0.06, -SZ*0.28)
    p3 = rot( SZ*0.06,  0);        p4 = rot(-SZ*0.06,  0)
    pt_tip = rot(0, -SZ*0.42)
    launcher = (f'<polygon points="{p1[0]},{p1[1]} {p2[0]},{p2[1]} {p3[0]},{p3[1]} {p4[0]},{p4[1]}"/>\n'
                f'<polygon points="{p1[0]},{p1[1]} {pt_tip[0]},{pt_tip[1]} {p2[0]},{p2[1]}"/>')
    base = f'<rect x="{r(CX-SZ*0.40)}" y="{r(CY+SZ*0.30)}" width="{r(SZ*0.80)}" height="{r(SZ*0.14)}"/>'
    write('bateria_costeira', radar + '\n' + launcher + '\n' + base)
bateria_costeira()

# ─── ADA battery ─────────────────────────────────────────────────────────────
def bateria_ada():
    lw, lh = SZ*0.09, SZ*0.36
    tube_top = CY - SZ*0.10
    tubes = tips = ''
    for ox in (-SZ*0.22, 0, SZ*0.22):
        tubes += (f'<rect x="{r(CX+ox-lw/2)}" y="{r(tube_top)}" '
                  f'width="{r(lw)}" height="{r(lh)}"/>\n')
        tip = (f'M{pt(CX+ox-lw/2,tube_top)} '
               f'L{pt(CX+ox,tube_top-SZ*0.14)} '
               f'L{pt(CX+ox+lw/2,tube_top)} Z')
        tips += f'<path d="{tip}"/>\n'
    base = f'<rect x="{r(CX-SZ*0.40)}" y="{r(CY+SZ*0.28)}" width="{r(SZ*0.80)}" height="{r(SZ*0.12)}"/>'
    write('bateria_ada', tubes + tips + base)
bateria_ada()

# ─── FPSO platform ────────────────────────────────────────────────────────────
def fpso():
    s = SZ * 0.56
    plat  = f'<rect x="{r(CX-s/2)}" y="{r(CY-s/2)}" width="{r(s)}" height="{r(s)}"/>'
    leg_s = SZ * 0.12
    legs  = ''
    for (lx, ly) in [(-s/2,-s/2),(s/2-leg_s,-s/2),(-s/2,s/2-leg_s),(s/2-leg_s,s/2-leg_s)]:
        legs += f'<rect x="{r(CX+lx)}" y="{r(CY+ly)}" width="{r(leg_s)}" height="{r(leg_s)}" opacity="0.5"/>\n'
    derrick = (f'<rect x="{r(CX-SZ*0.08)}" y="{r(CY-SZ*0.18)}" '
               f'width="{r(SZ*0.16)}" height="{r(SZ*0.36)}" opacity="0.55"/>')
    write('fpso', plat + '\n' + legs + derrick)
fpso()

# ─── Port (anchor) ────────────────────────────────────────────────────────────
def porto():
    lw = r(max(1.5, SZ*0.10))
    ring  = (f'<circle cx="{CX}" cy="{r(CY-SZ*0.32)}" r="{r(SZ*0.12)}" '
             f'fill="none" stroke="black" stroke-width="{lw}"/>')
    cross = (f'<line x1="{r(CX-SZ*0.30)}" y1="{r(CY-SZ*0.18)}" '
             f'x2="{r(CX+SZ*0.30)}" y2="{r(CY-SZ*0.18)}" '
             f'stroke="black" stroke-width="{lw}"/>')
    shaft = (f'<line x1="{CX}" y1="{r(CY-SZ*0.18)}" '
             f'x2="{CX}" y2="{r(CY+SZ*0.30)}" stroke="black" stroke-width="{lw}"/>')
    fl    = (f'<line x1="{CX}" y1="{r(CY+SZ*0.30)}" '
             f'x2="{r(CX-SZ*0.26)}" y2="{r(CY+SZ*0.12)}" stroke="black" stroke-width="{lw}"/>\n'
             f'<line x1="{CX}" y1="{r(CY+SZ*0.30)}" '
             f'x2="{r(CX+SZ*0.26)}" y2="{r(CY+SZ*0.12)}" stroke="black" stroke-width="{lw}"/>')
    write('porto', ring + '\n' + cross + '\n' + shaft + '\n' + fl)
porto()

# ─── Airport (runway cross) ───────────────────────────────────────────────────
def aeroporto():
    h_rw = (f'<rect x="{r(CX-SZ*0.44)}" y="{r(CY-SZ*0.11)}" '
            f'width="{r(SZ*0.88)}" height="{r(SZ*0.22)}"/>')
    v_rw = (f'<rect x="{r(CX-SZ*0.11)}" y="{r(CY-SZ*0.44)}" '
            f'width="{r(SZ*0.22)}" height="{r(SZ*0.88)}"/>')
    write('aeroporto', h_rw + '\n' + v_rw)
aeroporto()

print(f'\n✓ {len(os.listdir(OUT))} SVG icons saved to {OUT}/')
