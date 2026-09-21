'use strict';
// gen_unit_cards.js — Gera as cartas ilustradas de cada unidade (public/cards/*.jpg)
// a partir de shared/order_of_battle.js, renderizando um template HTML via Chromium
// headless. Sem arte fotográfica (não há gerador de imagens disponível): o "hero"
// da carta usa os mesmos ícones vetoriais de plataforma já usados no tabuleiro.
//
// Uso: node scripts/gen_unit_cards.js [--only=ID1,ID2] [--chrome=/path/to/chrome]

const fs   = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const { ORDER_OF_BATTLE } = require('../shared/order_of_battle.js');
const { COMBAT_CONFIG }   = require('../shared/combat_config.js');

const ROOT       = path.join(__dirname, '..');
const OUT_DIR    = path.join(ROOT, 'public', 'cards');
const TMP_DIR    = path.join(ROOT, '.card_render_tmp');
const CARD_W = 700, CARD_H = 1000;

// ── FP (combustível) — espelha fuel_model.js ──────────────────────────────────
const NAVAL_FP_SURFACE = 12, NAVAL_FP_SUB = 20;
const UNIT_FP = {
  'BLUE-VM':14,'BLUE-VE':10,'BLUE-BV':10,'BLUE-B':10,'BLUE-BS':10,
  'BLUE-LOG-1':30,'BLUE-LOG-2':34,'BLUE-PAT':8,'BLUE-MCM':8,'BLUE-ISR':10,
  'BLUE-LG':8,'BLUE-CARGO':30,
  'RED-HERMES':14,'RED-INVINCIBLE':14,'RED-SCR-1':10,'RED-SCR-2':10,
  'RED-ESC-1':10,'RED-ESC-2':10,'RED-TRAIL':10,'RED-LAND-SCR':10,'RED-SG-SCR':10,
  'RED-SG-ICE':10,'RED-LPD':10,'RED-TROOP':10,'RED-LOG-1':30,'RED-LOG-2':34,
  'RED-LOG-3':34,'RED-TANK':40,'RED-MCM':8,'RED-HOSP':12,
};
function fpFor(u) {
  if (u.category === 'submarine') return NAVAL_FP_SUB;
  if (u.category !== 'surface') return null;
  return UNIT_FP[u.id] ?? NAVAL_FP_SURFACE;
}

// ── Ícone de plataforma por tipo de composição → arquivo em public/icons/ ─────
const COMP_DISPLAY_TYPE = {
  'operacoes_especiais':'specops','navio_aeródromo':'carrier','navio_doca':'amphib',
  'navio_desembarque':'amphib','fragata':'fragata','corveta':'corveta',
  'destroier':'destroier','destroyer':'destroier','cruzador':'cruzador',
  'navio_patoc':'patrulha_oc','navio_patrulha':'patrulha_c','navio_logistico':'logistico',
  'navio_tanque':'tanque','submarino_nuclear':'sub_nuclear','submarino_convencional':'submarino',
  'patrulha_maritima':'patrulha','caca':'caca','ataque':'ataque','aew':'aew',
  'helicoptero_ASW':'helicoptero','helicoptero_ASup':'helicoptero',
  'bateria_costeira':'bateria_costeira','bateria_ada':'bateria_ada','infantaria':'infantaria',
  'porto':'porto','aeroporto':'aeroporto',
};
const PNG_ICON = {
  carrier:'porta-avioes.png', amphib:'navio-de-guerra.png', cruzador:'navio-de-guerra.png',
  destroier:'navio-de-guerra.png', fragata:'barco.png', corveta:'barco.png',
  patrulha_oc:'barco.png', patrulha_c:'barco.png', logistico:'barco-de-carga.png',
  tanque:'tanque-de-oleo.png', submarino:'submarino.png', sub_nuclear:'submarino 2.png',
  patrulha:'aviao-de-combate.png', caca:'aeronaves.png', ataque:'aeronaves.png',
  fpso:'plataforma-de-petroleo.png', porto:'porto.png', aeroporto:'aeroporto.png',
  bateria_costeira:'Military Tank.png', bateria_ada:'Military Tank.png', infantaria:'Military Tank.png',
  specops:'Military Tank.png',
};
function iconFor(unit) {
  const primary = unit.composition[0];
  if (!primary) return 'navio-de-guerra.png';
  const disp = COMP_DISPLAY_TYPE[primary.type] || 'fragata';
  return PNG_ICON[disp] || 'navio-de-guerra.png';
}

const CAT_META = {
  surface:   ['SUPERFÍCIE', '#2196f3'],
  submarine: ['SUBMARINO',  '#7c4dff'],
  air:       ['AÉREO',      '#00bcd4'],
  land:      ['TERRESTRE',  '#8d6e33'],
  specops:   ['ESPECIAL',   '#ffca28'],
};
const COMP_LABELS = {
  navio_aeródromo:'Porta-Aviões', helicoptero_ASW:'Helo ASW', helicoptero_ASup:'Helo ASup',
  fragata:'Fragata', corveta:'Corveta', destroyer:'Destroyer', destroier:'Destroyer',
  cruzador:'Cruzador', navio_doca:'Navio Doca (LPD)', navio_desembarque:'Navio Desembarque',
  navio_logistico:'Navio Logístico', navio_tanque:'Navio Tanque', navio_patrulha:'Patrulheiro',
  submarino_nuclear:'Sub. Nuclear', submarino_convencional:'Sub. Convencional',
  patrulha_maritima:'Aeronave ISR/MPA', caca:'Caça', ataque:'Ataque', aew:'AEW',
  operacoes_especiais:'Equipe OpEsp', bateria_costeira:'Bateria Costeira',
  bateria_ada:'Bateria AAA/SAM', infantaria:'Efetivo Terrestre', porto:'Porto', aeroporto:'Aeródromo',
};
const CAP_LABELS = { airDefense:'Defesa Aérea', asw:'ASW', airAttack:'Ataque Aéreo', navalGun:'Artilharia', bmd:'BMD' };
const WEAPON_ICON = { ascm:'🚀', mss:'🛰', torpedo:'🌀', lacm:'☄', raid:'⚔' };

const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

function bar(value, max, color) {
  const pct = Math.max(0, Math.min(100, Math.round((value / max) * 100)));
  return `<div class="barTrack"><div class="barFill" style="width:${pct}%;background:${color}"></div></div>`;
}

function cardHtml(unit, side) {
  const isBlue   = side === 'blue';
  const nation   = isBlue ? 'ARGENTINA' : 'REINO UNIDO';
  const teamName = isBlue ? 'FORÇA AZUL' : 'FORÇA VERMELHA';
  const teamCol  = isBlue ? '#2196f3' : '#e53935';
  const teamColL = isBlue ? '#82b1ff' : '#ff8a80';
  const [catLabel, catColor] = CAT_META[unit.category] || ['—', '#888'];
  const icon = iconFor(unit);

  const compRows = unit.composition.map(c =>
    `<span class="compChip">${c.quantity}× ${esc(COMP_LABELS[c.type] || c.type)}</span>`).join('');

  const detMax = Math.max(0, ...Object.values(unit.detectionRange || {}));
  const atkMax = Math.max(0, ...Object.values(unit.attackRange || {}));
  const wpnTotal = Object.values(unit.weapons || {}).reduce((s, w) => s + (w.quantity || 0), 0);
  const fp = fpFor(unit);

  const capRows = Object.entries(unit.capabilities || {}).filter(([,v]) => v > 0).map(([k,v]) =>
    `<div class="capItem"><span class="capLabel">${CAP_LABELS[k] || k}</span><span class="capVal">${v}</span></div>`).join('')
    || '<div class="capItem dim">— nenhuma —</div>';

  const wpnRows = Object.entries(unit.weapons || {}).map(([k,w]) =>
    `<div class="wpnItem"><span class="wpnIcon">${WEAPON_ICON[k] || '•'}</span>
       <span class="wpnLabel">${(COMBAT_CONFIG.weaponProfiles[k] || {}).label || k.toUpperCase()}</span>
       <span class="wpnVal">×${w.quantity} <small>(alc. ${w.range})</small></span></div>`).join('')
    || '<div class="wpnItem dim">— sem armamento dedicado —</div>';

  const statRows = [
    ['SP (Staying Power)', unit.stayingPower, 16, '#e53935'],
    ['Movimento',          unit.movement,     12, '#ff9800'],
    ['Detecção (melhor)',  detMax,             6, '#ffd54f'],
    ['Alcance Ataque (melhor)', atkMax,        6, '#66bb6a'],
    ['Armamento (total)',  wpnTotal,          30, '#42a5f5'],
  ];
  if (fp !== null) statRows.push(['Combustível (FP)', fp, 40, '#26c6da']);

  const statHtml = statRows.map(([label, val, max, color]) => `
    <div class="statRow">
      <span class="statLabel">${label}</span>
      ${bar(val, max, color)}
      <span class="statVal">${val}</span>
    </div>`).join('');

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    * { box-sizing:border-box; margin:0; padding:0; }
    body { width:${CARD_W}px; height:${CARD_H}px; font-family:'Courier New',monospace;
           background:#050d17; color:#d6e8f7; overflow:hidden; }
    .card { width:100%; height:100%; border:3px solid rgba(201,168,76,0.35); position:relative; }
    .topbar { display:flex; justify-content:space-between; align-items:center;
              padding:14px 20px; background:${isBlue ? '#0c2d5a' : '#5a0c0c'}; }
    .teamTag { font-size:15px; font-weight:bold; letter-spacing:1px; color:${teamColL}; }
    .catTag  { font-size:14px; font-weight:bold; letter-spacing:1px; color:${catColor}; }
    .nameBlock { padding:14px 22px 6px; }
    .uname { font-size:40px; font-weight:bold; letter-spacing:1px; line-height:1.05;
             color:#fff; text-transform:uppercase; }
    .ufull { font-size:15px; color:${teamColL}; margin-top:4px; letter-spacing:1px; }
    .hero { height:230px; margin:10px 20px; border-radius:8px;
            background:linear-gradient(160deg, ${isBlue?'#0d3050':'#4a0d0d'} 0%, #050d17 100%);
            display:flex; align-items:center; justify-content:center; position:relative;
            border:1px solid rgba(255,255,255,0.08); }
    .hero img { max-height:150px; max-width:70%; filter: drop-shadow(0 4px 10px rgba(0,0,0,0.6)); }
    .flag { position:absolute; top:8px; right:10px; width:46px; height:30px; border-radius:2px;
            overflow:hidden; border:1px solid rgba(255,255,255,0.3); }
    .compStrip { padding:8px 20px; display:flex; flex-wrap:wrap; gap:6px; }
    .compChip { font-size:11px; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12);
                border-radius:4px; padding:3px 8px; color:#b8ccdd; }
    .stats { padding:6px 20px; }
    .statRow { display:grid; grid-template-columns: 150px 1fr 34px; align-items:center; gap:8px; margin:5px 0; }
    .statLabel { font-size:11px; color:#9db6c8; }
    .statVal { font-size:15px; font-weight:bold; text-align:right; color:#fff; }
    .barTrack { height:8px; background:#0a1520; border-radius:4px; overflow:hidden; border:1px solid rgba(255,255,255,0.08); }
    .barFill { height:100%; }
    .caps { display:flex; gap:10px; padding:10px 20px; flex-wrap:wrap; border-top:1px solid rgba(255,255,255,0.08); }
    .capItem { font-size:12px; background:rgba(255,255,255,0.05); border-radius:4px; padding:5px 9px; }
    .capLabel { color:#9db6c8; margin-right:6px; }
    .capVal { color:#fff; font-weight:bold; }
    .dim { color:#5a7286; }
    .wpns { padding:6px 20px; border-top:1px solid rgba(255,255,255,0.08); }
    .wpnItem { font-size:13px; display:flex; align-items:center; gap:8px; margin:4px 0; color:#dbe7f2; }
    .wpnIcon { font-size:15px; }
    .wpnVal { margin-left:auto; color:#fff; font-weight:bold; }
    .footer { position:absolute; bottom:0; left:0; right:0; padding:10px 20px;
              background:rgba(0,0,0,0.35); border-top:1px solid rgba(201,168,76,0.25);
              font-size:10.5px; color:#8aa0b2; line-height:1.35; }
    .footer b { color:#c9a84c; }
  </style></head><body>
    <div class="card">
      <div class="topbar">
        <span class="teamTag">${teamName} · ${nation}</span>
        <span class="catTag">${catLabel}</span>
      </div>
      <div class="nameBlock">
        <div class="uname">${esc(unit.name)}</div>
        <div class="ufull">${esc(unit.id)}</div>
      </div>
      <div class="hero"><img src="file://${path.join(ROOT,'public','icons',icon)}"></div>
      <div class="compStrip">${compRows}</div>
      <div class="stats">${statHtml}</div>
      <div class="caps">${capRows}</div>
      <div class="wpns">${wpnRows}</div>
      <div class="footer">${esc(unit.notes || '')}</div>
    </div>
  </body></html>`;
}

function cropAndSave(rawPngPath, outJpgPath, w, h) {
  execFileSync('python3', ['-c', `
from PIL import Image
im = Image.open("${rawPngPath}").convert("RGB")
im.crop((0,0,${w},${h})).save("${outJpgPath}", quality=90)
`]);
}

function findChrome(cliArg) {
  if (cliArg) return cliArg;
  const candidates = [
    '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  ];
  for (const c of candidates) if (fs.existsSync(c)) return c;
  throw new Error('Chromium not found — pass --chrome=/path/to/chrome');
}

function main() {
  const args = process.argv.slice(2);
  const chromeArg = (args.find(a => a.startsWith('--chrome=')) || '').split('=')[1];
  const onlyArg   = (args.find(a => a.startsWith('--only=')) || '').split('=')[1];
  const only = onlyArg ? new Set(onlyArg.split(',')) : null;

  const chrome = findChrome(chromeArg);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(TMP_DIR, { recursive: true });

  const cardMap = {};
  let count = 0;
  for (const side of ['blue', 'red']) {
    for (const unit of ORDER_OF_BATTLE.forces[side]) {
      if (only && !only.has(unit.id)) continue;
      const html = cardHtml(unit, side);
      const htmlPath = path.join(TMP_DIR, unit.id + '.html');
      fs.writeFileSync(htmlPath, html);
      const fileName = unit.id.replace(/^BLUE-/, 'Blue_').replace(/^RED-/, 'Red_').replace(/-/g, '_') + '.jpg';
      const outPath = path.join(OUT_DIR, fileName);
      const rawPath = path.join(TMP_DIR, unit.id + '.png');
      // Headless Chrome's --screenshot clips ~85-90px off the bottom of the
      // requested --window-size and can show a scrollbar artifact. Overshoot
      // the height, hide scrollbars, then crop to the exact target size.
      execFileSync(chrome, [
        '--headless', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
        '--force-device-scale-factor=1',
        `--screenshot=${rawPath}`,
        `--window-size=${CARD_W},${CARD_H + 150}`,
        '--default-background-color=00000000',
        'file://' + htmlPath,
      ], { stdio: ['ignore', 'ignore', 'ignore'] });
      cropAndSave(rawPath, outPath, CARD_W, CARD_H);
      cardMap[unit.id] = fileName;
      count++;
    }
  }
  fs.rmSync(TMP_DIR, { recursive: true, force: true });

  console.log(`Generated ${count} cards in ${OUT_DIR}`);
  console.log('\n// Paste into public/js/client.js UNIT_CARD:');
  console.log('const UNIT_CARD = {');
  for (const [id, file] of Object.entries(cardMap)) console.log(`  '${id}': '${file}',`);
  console.log('};');
}

main();
