'use strict';

// ─── Type abbreviation labels ─────────────────────────────────────────────────
const TYPE_ABBR = {
  carrier:          'CV',
  amphib:           'AN',
  cruzador:         'CG',
  destroier:        'DD',
  fragata:          'FF',
  corveta:          'CO',
  patrulha_oc:      'PO',
  patrulha_c:       'PC',
  logistico:        'LG',
  tanque:           'NT',
  sub_nuclear:      'SN',
  submarino:        'SS',
  patrulha:         'MP',
  caca:             'F',
  ataque:           'A',
  aew:              'AW',
  helicoptero:      'HE',
  bateria_costeira: 'BC',
  bateria_ada:      'AD',
  fpso:             'FP',
  porto:            'PT',
  aeroporto:        'BA',
};

// Legacy UNIT_DEFS kept for any code still referencing it
const UNIT_DEFS = {
  fragata:     { name: 'Fragata',           abbr: 'FF', hp: 4, mov: 3 },
  destroier:   { name: 'Destróier',         abbr: 'DD', hp: 5, mov: 4 },
  corveta:     { name: 'Corveta',           abbr: 'CO', hp: 3, mov: 3 },
  submarino:   { name: 'Submarino',         abbr: 'SS', hp: 3, mov: 3 },
  helicoptero: { name: 'Helicóptero ASW',   abbr: 'HE', hp: 2, mov: 5 },
  patrulha:    { name: 'Patrulha Marítima', abbr: 'MP', hp: 2, mov: 7 },
};

// ─── Icon loading (PNG preferred, SVG fallback) ───────────────────────────────
const UNIT_ICONS = {};           // type → { img, isPng }
const TINT_CACHE = new Map();    // "type_color_size" → offscreen canvas

const ICON_TYPES = [
  'carrier','amphib','cruzador','destroier','fragata','corveta',
  'patrulha_oc','patrulha_c','logistico','tanque',
  'submarino','sub_nuclear',
  'patrulha','caca','ataque','aew','helicoptero',
  'bateria_costeira','bateria_ada',
  'fpso','porto','aeroporto',
];

// Maps unit type → PNG filename in public/icons/ (white-bg, black-stroke icons)
const PNG_TYPE_MAP = {
  carrier:          'porta-avioes.png',
  amphib:           'navio-de-guerra.png',
  cruzador:         'navio-de-guerra.png',
  destroier:        'navio-de-guerra.png',
  fragata:          'barco.png',
  corveta:          'barco.png',
  patrulha_oc:      'barco.png',
  patrulha_c:       'barco.png',
  logistico:        'barco-de-carga.png',
  tanque:           'tanque-de-oleo.png',
  submarino:        'submarino.png',
  sub_nuclear:      'submarino 2.png',
  patrulha:         'aviao-de-combate.png',
  caca:             'aeronaves.png',
  ataque:           'aeronaves.png',
  aew:              'aviao-de-combate.png',
  bateria_costeira: 'Military Tank.png',
  bateria_ada:      'Military Tank.png',
  fpso:             'plataforma-de-petroleo.png',
  porto:            'porto.png',
  aeroporto:        'aeroporto.png',
  // helicoptero: no PNG available → falls back to SVG
};

function initIcons(callback) {
  // Deduplicate: load each unique PNG file only once
  const uniquePngs = [...new Set(Object.values(PNG_TYPE_MAP))];
  const svgTypes   = ICON_TYPES.filter(t => !PNG_TYPE_MAP[t]);
  const needed     = uniquePngs.length + svgTypes.length;
  let   loaded     = 0;
  const done = () => { if (++loaded >= needed && callback) callback(); };

  // Load unique PNGs, share Image objects across types that use the same file
  const pngImgs = {};
  for (const file of uniquePngs) {
    const img = new Image();
    pngImgs[file] = img;
    img.onload = img.onerror = done;
    img.src = '/icons/' + encodeURIComponent(file);
  }
  for (const type of ICON_TYPES) {
    const file = PNG_TYPE_MAP[type];
    if (file) UNIT_ICONS[type] = { img: pngImgs[file], isPng: true };
  }

  // Load SVGs for remaining types
  for (const type of svgTypes) {
    const img = new Image();
    UNIT_ICONS[type] = { img, isPng: false };
    img.onload = img.onerror = done;
    img.src = `/icons/${type}.svg`;
  }

  if (needed === 0 && callback) callback();
}

// Parse '#rrggbb' or 'rgb(r,g,b)' → [r, g, b]
function parseRgb(css) {
  const m = css.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (m) return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
  const m2 = css.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (m2) return [+m2[1], +m2[2], +m2[3]];
  return [255, 255, 255];
}

// Create a tinted copy of the icon on an offscreen canvas, cached by key.
// PNGs: white-bg icons — convert luminance to alpha, apply team color.
// SVGs: transparent-bg icons — use source-in compositing.
function getTinted(type, color, size) {
  const key = `${type}_${color}_${size}`;
  if (TINT_CACHE.has(key)) return TINT_CACHE.get(key);
  const entry = UNIT_ICONS[type];
  if (!entry) return null;
  const { img, isPng } = entry;
  if (!img || !img.complete || !img.src) return null;
  if (!(img.naturalWidth > 0 || img.naturalHeight > 0)) return null;

  const oc = document.createElement('canvas');
  oc.width = oc.height = size;
  const oct = oc.getContext('2d');
  oct.drawImage(img, 0, 0, size, size);

  if (isPng) {
    // Transparent pixels stay transparent; dark strokes → team color; light bg → transparent
    const [r, g, b] = parseRgb(color);
    const idata = oct.getImageData(0, 0, size, size);
    const d = idata.data;
    for (let i = 0; i < d.length; i += 4) {
      const origAlpha = d[i + 3];
      const lum      = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000;
      const darkness = Math.max(0, Math.min(255, (200 - lum) * 3));
      d[i]     = r;
      d[i + 1] = g;
      d[i + 2] = b;
      d[i + 3] = Math.round(origAlpha * darkness / 255);
    }
    oct.putImageData(idata, 0, 0);
  } else {
    oct.globalCompositeOperation = 'source-in';
    oct.fillStyle = color;
    oct.fillRect(0, 0, size, size);
  }

  TINT_CACHE.set(key, oc);
  return oc;
}

// ─── Unit counter ─────────────────────────────────────────────────────────────
// Cantos chanfrados (octógono) — distingue a Força Vermelha da Azul por forma,
// não só por cor (redundância para daltonismo).
function cutCornerRect(ctx, x, y, w, h, cut) {
  ctx.beginPath();
  ctx.moveTo(x + cut, y);
  ctx.lineTo(x + w - cut, y);
  ctx.lineTo(x + w, y + cut);
  ctx.lineTo(x + w, y + h - cut);
  ctx.lineTo(x + w - cut, y + h);
  ctx.lineTo(x + cut, y + h);
  ctx.lineTo(x, y + h - cut);
  ctx.lineTo(x, y + cut);
  ctx.closePath();
}

function drawUnitCounter(ctx, unit, cx, cy, selected) {
  const isBlue = unit.team === 'blue';
  const bg     = isBlue ? '#0c2d5a' : '#5a0c0c';
  const border = isBlue ? '#82b1ff' : '#ff8a80';
  const R      = HEX_R * 0.50;
  const top    = cy - R * 0.72;

  if (selected) { ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 14; }

  ctx.fillStyle   = bg;
  ctx.strokeStyle = selected ? '#ffd700' : border;
  ctx.lineWidth   = selected ? 2.5 : 1.5;
  if (isBlue) roundRect(ctx, cx - R, top, R * 2, R * 1.44, 4);
  else        cutCornerRect(ctx, cx - R, top, R * 2, R * 1.44, 7);
  ctx.fill(); ctx.stroke();
  ctx.shadowBlur = 0;

  // ── Icon (upper portion) ──
  const iconSz = Math.ceil(R * 1.50);
  const tinted  = getTinted(unit.type, border, iconSz);
  if (tinted) {
    ctx.drawImage(tinted, cx - iconSz / 2, top + R * 0.02, iconSz, iconSz * 0.68);
  } else {
    // Fallback to procedural shape
    ctx.save();
    drawPlatformSilhouette(ctx, unit.type, cx, top + R * 0.48, R * 0.72, border);
    ctx.restore();
  }

  // ── Type abbreviation (lower portion) ──
  const abbr = TYPE_ABBR[unit.type] || unit.type.slice(0, 2).toUpperCase();
  ctx.fillStyle = border;
  ctx.font = `bold ${Math.max(6, Math.floor(R * 0.27))}px Courier New`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(abbr, cx, top + R * 1.18);

  // ── HP bar ──
  const hpFrac = unit.hp / unit.maxHp;
  const bw = R * 2 - 4, bh = 3;
  const bx = cx - R + 2, by = top + R * 1.44 + 2;
  ctx.fillStyle = '#050d15';
  ctx.fillRect(bx, by, bw, bh);
  ctx.fillStyle = hpFrac > 0.6 ? '#69f0ae' : hpFrac > 0.3 ? '#ffca28' : '#ff5252';
  ctx.fillRect(bx, by, bw * hpFrac, bh);
}

// ─── Silhouette dispatcher (fallback when SVG not loaded) ─────────────────────
function drawPlatformSilhouette(ctx, type, cx, cy, sz, color) {
  ctx.fillStyle   = color;
  ctx.strokeStyle = color;
  switch (type) {
    case 'carrier':     drawCarrierShape(ctx, cx, cy, sz); break;
    case 'amphib':      drawAmphibShape(ctx, cx, cy, sz); break;
    case 'cruzador':    drawShipShape(ctx, cx, cy, sz, 0.62, 0.54); break;
    case 'destroier':   drawShipShape(ctx, cx, cy, sz, 0.44, 0.58); break;
    case 'fragata':     drawShipShape(ctx, cx, cy, sz, 0.48, 0.52); break;
    case 'corveta':     drawShipShape(ctx, cx, cy, sz, 0.40, 0.44); break;
    case 'patrulha_oc': drawShipShape(ctx, cx, cy, sz, 0.42, 0.46); break;
    case 'patrulha_c':  drawShipShape(ctx, cx, cy, sz, 0.30, 0.36); break;
    case 'logistico':   drawCargoShape(ctx, cx, cy, sz); break;
    case 'tanque':      drawTankerShape(ctx, cx, cy, sz); break;
    case 'sub_nuclear': drawSubNuclearShape(ctx, cx, cy, sz); break;
    case 'submarino':   drawSubShape(ctx, cx, cy, sz); break;
    case 'patrulha':    drawAircraftShape(ctx, cx, cy, sz); break;
    case 'caca':        drawFighterShape(ctx, cx, cy, sz); break;
    case 'ataque':      drawAttackShape(ctx, cx, cy, sz); break;
    case 'aew':         drawAEWShape(ctx, cx, cy, sz); break;
    case 'helicoptero': drawHelicopterShape(ctx, cx, cy, sz); break;
    case 'bateria_costeira': drawBatteryShape(ctx, cx, cy, sz); break;
    case 'bateria_ada':      drawADAShape(ctx, cx, cy, sz); break;
    case 'fpso':       drawFPSOShape(ctx, cx, cy, sz); break;
    case 'porto':      drawPortShape(ctx, cx, cy, sz); break;
    case 'aeroporto':  drawAirportShape(ctx, cx, cy, sz); break;
    default: drawShipShape(ctx, cx, cy, sz, 0.48, 0.52); break;
  }
}

// ─── Shape functions (fallback procedural drawing) ────────────────────────────

function drawShipShape(ctx, cx, cy, sz, hw, hh) {
  const w = sz * hw, h = sz * hh;
  ctx.beginPath();
  ctx.moveTo(cx,           cy - h);
  ctx.lineTo(cx + w,       cy - h * 0.15);
  ctx.lineTo(cx + w * 0.88, cy + h);
  ctx.lineTo(cx - w * 0.88, cy + h);
  ctx.lineTo(cx - w,       cy - h * 0.15);
  ctx.closePath();
  ctx.fill();
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.38)';
  ctx.fillRect(cx - w * 0.38, cy - h * 0.05, w * 0.76, h * 0.52);
  ctx.restore();
}

function drawCarrierShape(ctx, cx, cy, sz) {
  const w = sz * 0.84, h = sz * 0.28;
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.60, cy - h);
  ctx.lineTo(cx + w,        cy - h);
  ctx.lineTo(cx + w,        cy + h);
  ctx.lineTo(cx - w * 0.60, cy + h);
  ctx.lineTo(cx - w,        cy);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.08, cy - h);
  ctx.lineTo(cx - w * 0.55, cy - h * 2.6);
  ctx.lineTo(cx - w * 0.22, cy - h * 2.6);
  ctx.lineTo(cx + w * 0.18, cy - h);
  ctx.closePath();
  ctx.fill();
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.40)';
  ctx.fillRect(cx + w * 0.30, cy - h, w * 0.24, h * 0.68);
  ctx.restore();
}

function drawAmphibShape(ctx, cx, cy, sz) {
  const w = sz * 0.56, h = sz * 0.50;
  ctx.beginPath();
  ctx.moveTo(cx,      cy - h);
  ctx.lineTo(cx + w,  cy - h * 0.45);
  ctx.lineTo(cx + w,  cy + h);
  ctx.lineTo(cx - w,  cy + h);
  ctx.lineTo(cx - w,  cy - h * 0.45);
  ctx.closePath();
  ctx.fill();
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.40)';
  ctx.fillRect(cx - w * 0.52, cy + h * 0.68, w * 1.04, h * 0.24);
  ctx.restore();
}

function drawCargoShape(ctx, cx, cy, sz) {
  const w = sz * 0.53, h = sz * 0.46;
  ctx.beginPath();
  ctx.moveTo(cx,           cy - h);
  ctx.lineTo(cx + w * 0.85, cy - h * 0.22);
  ctx.lineTo(cx + w * 0.85, cy + h);
  ctx.lineTo(cx - w * 0.85, cy + h);
  ctx.lineTo(cx - w * 0.85, cy - h * 0.22);
  ctx.closePath();
  ctx.fill();
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.38)';
  ctx.fillRect(cx - w * 0.65, cy - h * 0.06, w * 0.44, h * 0.48);
  ctx.fillRect(cx + w * 0.10, cy - h * 0.06, w * 0.44, h * 0.48);
  ctx.restore();
}

function drawTankerShape(ctx, cx, cy, sz) {
  ctx.beginPath();
  ctx.ellipse(cx, cy + sz * 0.04, sz * 0.58, sz * 0.36, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.38)';
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.ellipse(cx + i * sz * 0.26, cy + sz * 0.04, sz * 0.16, sz * 0.20, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawSubShape(ctx, cx, cy, sz) {
  ctx.beginPath();
  ctx.ellipse(cx, cy, sz * 0.56, sz * 0.20, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.50)';
  ctx.fillRect(cx - sz * 0.08, cy - sz * 0.20 - sz * 0.12, sz * 0.16, sz * 0.14);
  ctx.restore();
}

function drawSubNuclearShape(ctx, cx, cy, sz) {
  ctx.beginPath();
  ctx.ellipse(cx, cy, sz * 0.68, sz * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.44)';
  ctx.fillRect(cx - sz * 0.11, cy - sz * 0.22 - sz * 0.18, sz * 0.22, sz * 0.20);
  ctx.restore();
  const ax = cx, ay = cy - sz * 0.52;
  const nr = sz * 0.11;
  ctx.lineWidth = Math.max(0.8, sz * 0.045);
  ctx.beginPath();
  ctx.arc(ax, ay, sz * 0.04, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 3; i++) {
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate((i * Math.PI) / 3);
    ctx.beginPath();
    ctx.ellipse(0, 0, nr * 1.8, nr * 0.55, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawAircraftShape(ctx, cx, cy, sz) {
  ctx.beginPath();
  ctx.ellipse(cx, cy, sz * 0.10, sz * 0.46, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx,             cy - sz * 0.04);
  ctx.lineTo(cx + sz * 0.54, cy + sz * 0.12);
  ctx.lineTo(cx + sz * 0.50, cy + sz * 0.26);
  ctx.lineTo(cx,             cy + sz * 0.12);
  ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx,             cy - sz * 0.04);
  ctx.lineTo(cx - sz * 0.54, cy + sz * 0.12);
  ctx.lineTo(cx - sz * 0.50, cy + sz * 0.26);
  ctx.lineTo(cx,             cy + sz * 0.12);
  ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx,             cy + sz * 0.36);
  ctx.lineTo(cx + sz * 0.16, cy + sz * 0.46);
  ctx.lineTo(cx - sz * 0.16, cy + sz * 0.46);
  ctx.closePath(); ctx.fill();
}

function drawFighterShape(ctx, cx, cy, sz) {
  ctx.beginPath();
  ctx.ellipse(cx, cy, sz * 0.07, sz * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx,             cy - sz * 0.04);
  ctx.lineTo(cx + sz * 0.48, cy + sz * 0.34);
  ctx.lineTo(cx + sz * 0.28, cy + sz * 0.42);
  ctx.lineTo(cx,             cy + sz * 0.10);
  ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx,             cy - sz * 0.04);
  ctx.lineTo(cx - sz * 0.48, cy + sz * 0.34);
  ctx.lineTo(cx - sz * 0.28, cy + sz * 0.42);
  ctx.lineTo(cx,             cy + sz * 0.10);
  ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx,             cy + sz * 0.30);
  ctx.lineTo(cx + sz * 0.09, cy + sz * 0.42);
  ctx.lineTo(cx - sz * 0.09, cy + sz * 0.42);
  ctx.closePath(); ctx.fill();
}

function drawAttackShape(ctx, cx, cy, sz) {
  ctx.beginPath();
  ctx.ellipse(cx, cy, sz * 0.10, sz * 0.44, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx,             cy + sz * 0.02);
  ctx.lineTo(cx + sz * 0.52, cy + sz * 0.26);
  ctx.lineTo(cx + sz * 0.48, cy + sz * 0.40);
  ctx.lineTo(cx,             cy + sz * 0.20);
  ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx,             cy + sz * 0.02);
  ctx.lineTo(cx - sz * 0.52, cy + sz * 0.26);
  ctx.lineTo(cx - sz * 0.48, cy + sz * 0.40);
  ctx.lineTo(cx,             cy + sz * 0.20);
  ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx,             cy + sz * 0.34);
  ctx.lineTo(cx + sz * 0.17, cy + sz * 0.44);
  ctx.lineTo(cx - sz * 0.17, cy + sz * 0.44);
  ctx.closePath(); ctx.fill();
}

function drawAEWShape(ctx, cx, cy, sz) {
  ctx.beginPath();
  ctx.ellipse(cx, cy - sz * 0.12, sz * 0.46, sz * 0.11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(cx - sz * 0.04, cy - sz * 0.01, sz * 0.08, sz * 0.15);
  ctx.beginPath();
  ctx.ellipse(cx, cy + sz * 0.14, sz * 0.09, sz * 0.34, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx,             cy + sz * 0.06);
  ctx.lineTo(cx + sz * 0.48, cy + sz * 0.24);
  ctx.lineTo(cx + sz * 0.42, cy + sz * 0.34);
  ctx.lineTo(cx,             cy + sz * 0.18);
  ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx,             cy + sz * 0.06);
  ctx.lineTo(cx - sz * 0.48, cy + sz * 0.24);
  ctx.lineTo(cx - sz * 0.42, cy + sz * 0.34);
  ctx.lineTo(cx,             cy + sz * 0.18);
  ctx.closePath(); ctx.fill();
}

function drawHelicopterShape(ctx, cx, cy, sz) {
  const blade = sz * 0.52;
  ctx.lineWidth = Math.max(1.5, sz * 0.08);
  ctx.beginPath();
  ctx.moveTo(cx - blade, cy); ctx.lineTo(cx + blade, cy);
  ctx.moveTo(cx, cy - blade); ctx.lineTo(cx, cy + blade);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(cx, cy, sz * 0.13, sz * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = Math.max(1, sz * 0.06);
  ctx.beginPath();
  ctx.moveTo(cx, cy + sz * 0.22);
  ctx.lineTo(cx, cy + sz * 0.50);
  ctx.stroke();
  ctx.lineWidth = Math.max(1, sz * 0.05);
  ctx.beginPath();
  ctx.moveTo(cx - sz * 0.11, cy + sz * 0.50);
  ctx.lineTo(cx + sz * 0.11, cy + sz * 0.50);
  ctx.stroke();
}

function drawBatteryShape(ctx, cx, cy, sz) {
  ctx.lineWidth = Math.max(1, sz * 0.08);
  ctx.beginPath();
  ctx.arc(cx - sz * 0.18, cy - sz * 0.08, sz * 0.28, Math.PI * 1.12, Math.PI * 1.88);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - sz * 0.18, cy - sz * 0.08);
  ctx.lineTo(cx - sz * 0.18, cy + sz * 0.20);
  ctx.stroke();
  ctx.save();
  ctx.translate(cx + sz * 0.26, cy + sz * 0.08);
  ctx.rotate(-Math.PI * 0.28);
  ctx.fillRect(-sz * 0.06, -sz * 0.28, sz * 0.12, sz * 0.28);
  ctx.beginPath();
  ctx.moveTo(-sz * 0.06, -sz * 0.28);
  ctx.lineTo(0,          -sz * 0.42);
  ctx.lineTo(sz * 0.06,  -sz * 0.28);
  ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.fillRect(cx - sz * 0.40, cy + sz * 0.30, sz * 0.80, sz * 0.14);
}

function drawADAShape(ctx, cx, cy, sz) {
  const lw = sz * 0.09, lh = sz * 0.36;
  const tubeTop = cy - sz * 0.10;
  [-sz * 0.22, 0, sz * 0.22].forEach(ox => {
    ctx.fillRect(cx + ox - lw / 2, tubeTop, lw, lh);
    ctx.beginPath();
    ctx.moveTo(cx + ox - lw / 2, tubeTop);
    ctx.lineTo(cx + ox,          tubeTop - sz * 0.14);
    ctx.lineTo(cx + ox + lw / 2, tubeTop);
    ctx.closePath(); ctx.fill();
  });
  ctx.fillRect(cx - sz * 0.40, cy + sz * 0.28, sz * 0.80, sz * 0.12);
}

function drawFPSOShape(ctx, cx, cy, sz) {
  const s = sz * 0.56;
  ctx.fillRect(cx - s / 2, cy - s / 2, s, s);
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.40)';
  const legS = sz * 0.12;
  [[-s/2,-s/2],[s/2-legS,-s/2],[-s/2,s/2-legS],[s/2-legS,s/2-legS]]
    .forEach(([lx, ly]) => ctx.fillRect(cx + lx, cy + ly, legS, legS));
  ctx.fillStyle = 'rgba(0,0,0,0.50)';
  ctx.fillRect(cx - sz * 0.08, cy - sz * 0.18, sz * 0.16, sz * 0.36);
  ctx.restore();
}

function drawPortShape(ctx, cx, cy, sz) {
  const lw = Math.max(1.5, sz * 0.10);
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.arc(cx, cy - sz * 0.32, sz * 0.12, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - sz * 0.30, cy - sz * 0.18);
  ctx.lineTo(cx + sz * 0.30, cy - sz * 0.18);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx, cy - sz * 0.18);
  ctx.lineTo(cx, cy + sz * 0.30);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx,             cy + sz * 0.30);
  ctx.lineTo(cx - sz * 0.26, cy + sz * 0.12);
  ctx.moveTo(cx,             cy + sz * 0.30);
  ctx.lineTo(cx + sz * 0.26, cy + sz * 0.12);
  ctx.stroke();
}

function drawAirportShape(ctx, cx, cy, sz) {
  ctx.fillRect(cx - sz * 0.44, cy - sz * 0.11, sz * 0.88, sz * 0.22);
  ctx.fillRect(cx - sz * 0.11, cy - sz * 0.44, sz * 0.22, sz * 0.88);
}

// ─── Utilities ────────────────────────────────────────────────────────────────
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y,     x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h,     x, y + h - r);
  ctx.lineTo(x, y + r);     ctx.quadraticCurveTo(x, y,         x + r, y);
  ctx.closePath();
}
