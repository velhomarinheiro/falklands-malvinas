'use strict';

// ─── DOM refs ─────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const lobbyScreen  = $('lobby-screen');
const gameScreen   = $('game-screen');
const canvas       = $('game-canvas');
const ctx          = canvas.getContext('2d');
const teamBadge    = $('team-badge');
const turnLabel    = $('turn-label');
const periodLabel  = $('period-label');
const phaseLabel   = $('phase-label');
const myTurnBanner = $('my-turn-banner');
const unitPanel    = $('unit-panel');
const endPhaseBtn  = $('end-phase-btn');
const combatBtn    = $('combat-btn');
const undoStepBtn  = $('undo-step-btn');
const cancelBtn    = $('cancel-btn');
const fleetBlue    = $('fleet-blue');
const fleetRed     = $('fleet-red');
const logEl        = $('battle-log');
const gameOver     = $('game-over');
const winnerMsg    = $('winner-msg');
const disconnected = $('disconnected');
const lobbyMenu    = $('lobby-menu');
const lobbyWaiting = $('lobby-waiting');
const lobbyErr     = $('lobby-err');
const roomDisplay  = $('room-display');
const roomInput    = $('room-input');
const btnCreate    = $('btn-create');
const btnJoin      = $('btn-join');
const terrainTip   = $('terrain-tip');
const stackPicker  = $('stack-picker');
const spList       = $('sp-list');
const spGroupBtn   = $('sp-group-btn');
const objectivesContent = $('objectives-content');
const exportLogBtn      = $('export-log-btn');
const exportFullLogBtn  = $('export-full-log-btn');
const abandonBtn        = $('abandon-btn');
const unitTooltipEl     = $('unit-tooltip');
const cardModal         = $('card-modal');
const cardModalImg      = $('card-modal-img');
const sfxToggle         = $('sfx-toggle');
const weaponPicker      = $('weapon-picker');
const wpBody            = $('wp-body');
const wpTargetName      = $('wp-target-name');
const wpConfirmBtn      = $('wp-confirm');
const wpCancelBtn       = $('wp-cancel');
const targetPicker      = $('target-picker');
const tpList            = $('tp-list');

// ─── Weapon metadata (mirrors server COMBAT_CONFIG) ──────────────────────────
const WEAPON_TARGETS = {
  ascm:['surface'], mss:['surface'], torpedo:['surface','submarine'],
  lacm:['land'], asbm:['surface'], navalGun:['surface','land'],
  airDefense:['air'], bmd:['air'], asw:['submarine'],
  airAttack:['surface','air','land'], raid:['land','surface'],
};
const WEAPON_EXPENDABLE = {ascm:true,mss:true,torpedo:true,lacm:true,asbm:true};
const WEAPON_LABELS = {
  ascm:'ASCM', mss:'MSS', torpedo:'TORPEDO', lacm:'LACM', asbm:'ASBM',
  navalGun:'CANHÃO', airDefense:'DEFA', bmd:'BMD', asw:'ASW',
  airAttack:'AT.AÉR', raid:'OP.ESP.',
};
// Nomes por extenso (tooltips e glossário da ajuda)
const WEAPON_GLOSSARY = {
  ascm:       'Míssil de Cruzeiro Antinavio — longo alcance contra navios de superfície',
  mss:        'Míssil Superfície-Superfície — curto alcance contra navios de superfície',
  torpedo:    'Torpedo — contra navios e submarinos; não pode ser interceptado',
  lacm:       'Míssil de Cruzeiro de Ataque Terrestre — longo alcance contra alvos em terra',
  asbm:       'Míssil Balístico Antinavio — só interceptável por defesa antimísseis (BMD)',
  navalGun:   'Canhão Naval — curto alcance, não consome munição do paiol',
  airDefense: 'Defesa Antiaérea — intercepta mísseis e ataca aeronaves',
  bmd:        'Defesa Antimísseis Balísticos — única defesa contra ASBM',
  asw:        'Guerra Antissubmarino — detecção e ataque a submarinos',
  airAttack:  'Ataque Aéreo — aeronaves contra navios, aeronaves ou alvos terrestres',
  raid:       'Incursão de Operações Especiais — ataques a instalações e navios',
};
// Default ranges for capability-based weapons (not present in unit.weapons)
const WEAPON_DEFAULT_RANGE = {
  ascm:6, mss:3, torpedo:2, lacm:10, asbm:10,
  navalGun:1, airDefense:1, bmd:1, asw:2, airAttack:4, raid:2,
};

function unitMovementRange(unit) {
  if (unit.category !== 'air') return unit.movement;
  return Math.floor((unit.fuel?.current ?? unit.movement) / 2);
}

// ─── Canvas setup ─────────────────────────────────────────────────────────────
canvas.width  = CVS_W;
canvas.height = CVS_H;

// ─── Zoom / pan state ─────────────────────────────────────────────────────────
let zoom = 1.0;
let panX = 0, panY = 0;
let isPanning = false, panStartX, panStartY, panStartPanX, panStartPanY;

function clampPan() {
  const minX = CVS_W  * (1 - zoom);
  const minY = CVS_H  * (1 - zoom);
  panX = Math.max(minX, Math.min(0, panX));
  panY = Math.max(minY, Math.min(0, panY));
}

function applyZoomAround(screenX, screenY, factor) {
  // Piso 1.0: no zoom 1 o mapa inteiro já está visível (o canvas cabe no
  // contêiner); abaixo disso só sobrariam margens mortas.
  const newZoom = Math.max(1.0, Math.min(3.0, zoom * factor));
  panX = screenX - (screenX - panX) * (newZoom / zoom);
  panY = screenY - (screenY - panY) * (newZoom / zoom);
  zoom = newZoom;
  clampPan();
  render();
}

// ─── Animation / flash system ─────────────────────────────────────────────────
const unitFlashes = new Map(); // unitId → { color, startTime, duration }
let   sceneFlash  = null;      // { text, color, startTime, duration }
let   animRunning = false;

function startAnimLoop() {
  if (animRunning) return;
  animRunning = true;
  requestAnimationFrame(animTick);
}

function animTick(ts) {
  let active = false;
  for (const [id, f] of unitFlashes) {
    if (ts - f.startTime < f.duration) active = true;
    else unitFlashes.delete(id);
  }
  if (sceneFlash) {
    if (ts - sceneFlash.startTime < sceneFlash.duration) active = true;
    else sceneFlash = null;
  }
  render();
  if (active) requestAnimationFrame(animTick);
  else animRunning = false;
}

function flashUnit(id, color, duration = 1200) {
  unitFlashes.set(id, { color, startTime: performance.now(), duration });
  startAnimLoop();
}

function flashScene(text, color, duration = 1600) {
  sceneFlash = { text, color, startTime: performance.now(), duration };
  startAnimLoop();
}

// ─── Map background image ─────────────────────────────────────────────────────
const mapImg  = new Image();
let   mapReady = false;
mapImg.onload  = () => { mapReady = true;  if (gameState) render(); };
mapImg.onerror = () => { mapReady = false; if (gameState) render(); };
mapImg.src = '/mapa.jpeg';

// ─── Game state ───────────────────────────────────────────────────────────────
let myTeam      = null;
let gameState   = null;
let isSolo      = false;
let currentRoomId = null;
let prevUnitPos = new Map(); // unitId → {col, row} — for movement flash detection
let selUnitId   = null;

// ─── Unit card images ─────────────────────────────────────────────────────────
const UNIT_CARD = {
  'BLUE-SAG-P':    'Blue_SAG_P.PNG',
  'BLUE-SAG-S1':   'Blue_SAG_S1.jpg',
  'BLUE-SAG-S2':   'Blue_SAG_S2.jpg',
  'BLUE-ANFIB':    'Blue_ANFIB.jpg',
  'BLUE-LOG-A':    'Blue_LOG_A.jpg',
  'BLUE-LOG-T':    'Blue_LOG_T.jpg',
  'BLUE-PAT-O1':   'Blue_PAT_01.jpg',
  'BLUE-PAT-O2':   'Blue_PAT_02.jpg',
  'BLUE-PAT-C1':   'Blue_PAT_C1.jpg',
  'BLUE-PAT-C2':   'Blue_PAT_C2.jpg',
  'BLUE-SUB-N':    'Blue_SUB_N.jpg',
  'BLUE-SUB-1':    'Blue_SUB_1.jpg',
  'BLUE-SUB-2':    'Blue_SUB_2.jpg',
  'BLUE-SUB-3':    'Blue_SUB_3.jpg',
  'BLUE-MPRA-1':   'Blue_MPRA_1.jpg',
  'BLUE-MPRA-2':   'Blue_MPRA_2.jpg',
  'BLUE-CACA-1':   'Blue_CACA_1.jpg',
  'BLUE-CACA-2':   'Blue_CACA_2.jpg',
  'BLUE-CJAT-1':   'Blue_CJAT_1.jpg',
  'BLUE-CJAT-2':   'Blue_CJAT_2.jpg',
  'BLUE-DCOST1':   'Blue_DCOST1.jpg',
  'BLUE-DCOST2':   'Blue_DCOST2.jpg',
  'BLUE-ADA-1':    'Blue_ADA_1.jpg',
  'BLUE-ADA-2':    'Blue_ADA_2.jpg',
  'BLUE-FPSO1':    'Blue_FPSO1.jpg',
  'BLUE-FPSO2':    'Blue_FPSO2.jpg',
  'BLUE-FPSO3':    'Blue_FPSO3.jpg',
  'BLUE-FPSO4':    'Blue_FPSO4.jpg',
  'BLUE-PORTO-S':  'Blue_PORTO_S.jpg',
  'BLUE-PORTO-RJ': 'Blue_PORTO_RJ.jpg',
  'BLUE-PORTO-V':  'Blue_PORTO_V.jpg',
  'BLUE-PORTO-ACU':'Blue_PORTO_ACU.jpg',
  'RED-GBPA':      'Red_GBPA.jpg',
  'RED-GE-1':      'Red_GE_1.jpg',
  'RED-GE-2':      'Red_GE_2.jpg',
  'RED-GE-3':      'Red_GE_3.jpg',
  'RED-AOR-G':     'Red_AOR_G.jpg',
  'RED-GANF':      'Red_GANF.jpg',
  'RED-GLOG':      'Red_GLOG.jpg',
  'RED-AKE':       'Red_AKE.jpg',
  'RED-KSN':       'Red_KSN.jpg',
  'RED-KS-1':      'Red_KS1.jpg',
  'RED-KMF-1':     'Red_KMF_1.jpg',
  'RED-KMF-2':     'Red_KMF_2.jpg',
  'RED-MPRA-K1':   'Red_MPRA_K1.jpg',
  'RED-MPRA-K2':   'Red_MPRA_K2.jpg',
  'RED-AWACS-K':   'Red_AWACS_K.jpg',
};
function cardUrl(unitId) {
  const f = UNIT_CARD[unitId];
  return f ? `/cards/${encodeURIComponent(f)}` : null;
}

// ─── Card modal (tier 3) ──────────────────────────────────────────────────────
function showCardModal(unitId) {
  const url = cardUrl(unitId);
  if (!url) return;
  cardModalImg.src = url;
  cardModal.classList.remove('hidden');
  SFX.play('card');
}
function hideCardModal() {
  cardModal.classList.add('hidden');
  cardModalImg.src = '';
}
$('card-modal-close').addEventListener('click', hideCardModal);
cardModal.addEventListener('click', e => { if (e.target === cardModal) hideCardModal(); });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { hideCardModal(); closeWeaponPicker(); hideTargetPicker(); hideHelpModal(); }
});

// ─── Ajuda em jogo (manual rápido) ────────────────────────────────────────────
const helpModal = $('help-modal');
const HELP_SECTIONS = {
  fases: `
    <h4>ESTRUTURA DO TURNO</h4>
    <p>Cada <b>turno</b> é um dia de operação com dois períodos: <b>☀ Diurno</b> e
    <b>🌙 Noturno</b>. Cada período tem uma fase de <b>Movimentação</b> e uma de
    <b>Combate</b>.</p>
    <h4>MOVIMENTAÇÃO SIMULTÂNEA</h4>
    <p>Os dois lados planejam ao mesmo tempo. O inimigo aparece na posição
    anterior até ambos confirmarem — encerre com <b>Encerrar Movimentação</b>.
    Hexágonos <b>verdes</b> são os passos possíveis da unidade selecionada.</p>
    <h4>DETECÇÃO E NOITE</h4>
    <p>Você só vê inimigos dentro do alcance de detecção das suas unidades
    (névoa de guerra). À noite a detecção cai (−2), <b>exceto submarinos</b>,
    que usam sonar. Submarinos em águas profundas são mais difíceis de detectar.</p>
    <h4>PRAZO OPERACIONAL</h4>
    <p>A operação dura no máximo <b>12 dias</b>. Ao fim do prazo, vence quem
    tiver maior progresso nos seus objetivos.</p>`,
  combate: `
    <h4>DECLARAR ATAQUES</h4>
    <p>Na fase de combate, selecione uma unidade e clique em alvos
    <b>vermelhos</b> (detectados e no alcance). Escolha a arma e o tamanho da
    salva, e confirme com <b>Confirmar Ataques</b>. A resolução é simultânea.</p>
    <h4>RODADAS DE COMBATE</h4>
    <p>Cada engajamento tem até <b>2 rodadas</b>. Após a primeira, ambos decidem
    <b>CONTINUAR</b> ou <b>PARAR</b>. Quem continua sozinho ganha
    <b>vantagem de iniciativa</b> (rola 2d6 e usa o maior). Na segunda rodada o
    grupo defensor <b>contra-ataca</b> com armas de curto alcance.</p>
    <h4>INTERCEPTAÇÃO E GRUPO</h4>
    <p>Mísseis podem ser interceptados pela defesa antiaérea do alvo — navios
    <b>empilhados no mesmo hexágono</b> somam suas defesas e se defendem como
    grupo. Torpedos não são interceptáveis; ASBM só é parado por BMD.</p>
    <h4>DANO E DEGRADAÇÃO</h4>
    <p>O dano reduz o <b>SP</b> (poder de permanência). Golpes não fatais também
    <b>degradam</b> um subsistema aleatório: detecção, movimento, capacidade de
    combate ou combustível máximo.</p>`,
  logistica: `
    <h4>PONTOS DE COMBUSTÍVEL (FP)</h4>
    <p>Navios e submarinos convencionais têm FP limitados. Custo por período:
    parado = 1 FP, mover 1 hex = 1, 2 hexes = 2, 3+ = 3 (máx. 4 FP/turno).
    Atacar e absorver dano custam +1 FP cada.</p>
    <p><b>0 FP = unidade inoperante</b>: não move, não ataca e não se defende
    até reabastecer.</p>
    <h4>REABASTECIMENTO</h4>
    <p>Termine o período <b>empilhado</b> com um navio-tanque, navio logístico
    ou porto aliado: os FP voltam ao máximo. Unidades nucleares e FPSOs não
    consomem FP.</p>
    <h4>AERONAVES</h4>
    <p>Aeronaves têm FP = 2× movimento e retornam à base após o combate.
    Aeronave no ar com 0 FP e sem base ao alcance é <b>perdida</b>. Em base ou
    porta-aviões, reabastece e fica pronta no turno seguinte.</p>
    <h4>MUNIÇÃO</h4>
    <p>Mísseis e torpedos são <b>finitos</b> (veja N/N no painel). Recompletamento:
    unidades Azuis paradas em porto, aeronaves em base e unidades terrestres.
    A força Vermelha <b>não recompleta armas navais em mar</b> — economize salvas.</p>`,
};

// A aba "Vitória" é gerada a partir dos objetivos que o servidor envia (cujos
// rótulos derivam das constantes de limiar), para que o manual não possa
// divergir da regra em vigor. Texto fixo só como fallback pré-partida.
function buildVictoryHtml() {
  const obj = gameState?.objectives;
  const side = (o, titulo) => `
    <h4>${titulo} — ${o.needed} DE ${o.conditions.length} OBJETIVOS</h4>
    <ul>${o.conditions.map(c => `<li>${c.label}</li>`).join('')}</ul>`;
  const listas = obj
    ? side(obj.blue, 'FORÇA AZUL') + side(obj.red, 'FORÇA VERMELHA')
    : '<p>As condições aparecem aqui quando a partida começa.</p>';
  const prazo = gameState?.maxTurns ?? 12;
  return `${listas}
    <h4>PRAZO</h4>
    <p>Ao fim de <b>${prazo} dias</b> sem vencedor, ganha quem tiver maior
    progresso nos seus objetivos — o progresso conta <b>dano parcial</b>, não só
    condições concluídas. O painel <b>OBJETIVOS DE VITÓRIA</b> acompanha os dois
    lados em tempo real.</p>`;
}

function buildGlossaryHtml() {
  const general = [
    ['SP',  'Poder de Permanência — os "pontos de vida" da unidade'],
    ['FP',  'Pontos de Combustível — autonomia da unidade'],
    ['MOV', 'Movimento — hexágonos por período'],
    ['Det S/Aé/Sb/T', 'Alcance de detecção contra Superfície / Aéreo / Submarino / Terra'],
  ];
  const rows = [
    ...general,
    ...Object.entries(WEAPON_GLOSSARY).map(([k, v]) => [WEAPON_LABELS[k] || k.toUpperCase(), v]),
  ];
  return '<h4>TERMOS E SIGLAS</h4><ul>' +
    rows.map(([t, d]) => `<li><span class="help-gloss-term">${t}</span> — ${d}</li>`).join('') +
    '</ul>';
}

function showHelpTab(tab) {
  document.querySelectorAll('.help-tab').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === tab));
  $('help-content').innerHTML =
    tab === 'glossario' ? buildGlossaryHtml() :
    tab === 'vitoria'   ? buildVictoryHtml()  : (HELP_SECTIONS[tab] || '');
}
function showHelpModal() { showHelpTab('fases'); helpModal.classList.remove('hidden'); }
function hideHelpModal() { helpModal.classList.add('hidden'); }

$('help-toggle').addEventListener('click', () => { SFX.play('click'); showHelpModal(); });
$('help-close').addEventListener('click', hideHelpModal);
helpModal.addEventListener('click', e => { if (e.target === helpModal) hideHelpModal(); });
$('help-tabs').addEventListener('click', e => {
  const btn = e.target.closest('.help-tab');
  if (btn) { SFX.play('click'); showHelpTab(btn.dataset.tab); }
});

// ─── Tooltip (tier 1) ─────────────────────────────────────────────────────────
let _tooltipTimer = null;
let _tooltipHex   = null; // 'col,row' key of last hex that triggered tooltip

function _showTooltip(units, clientX, clientY) {
  const u = units[0];
  const hpPct = Math.round(u.hp / u.maxHp * 100);
  const det   = u.detectionRange || {};
  const extra = units.length > 1
    ? `<div class="ut-hint">${units.length} unidades neste hexágono</div>` : '';
  const hasCard = units.some(x => UNIT_CARD[x.id]);
  const cardHint = hasCard ? '<div class="ut-hint">Clique direito · card completo</div>' : '';
  unitTooltipEl.innerHTML = `
    <div class="ut-name ${u.team}">${u.name}</div>
    <div class="ut-stats">
      <span>SP</span><b>${u.hp}/${u.maxHp} (${hpPct}%)</b>
      <span>MOV</span><b>${u.movement}</b>
      <span>Det S/A/Sb</span><b>${det.surface||0}/${det.air||0}/${det.submarine||0}</b>
    </div>
    ${extra}${cardHint}`;
  _positionTooltip(clientX, clientY);
  unitTooltipEl.classList.remove('hidden');
}
function _positionTooltip(cx, cy) {
  const x = cx + 18, y = cy + 12;
  unitTooltipEl.style.left = Math.min(x, window.innerWidth  - 220) + 'px';
  unitTooltipEl.style.top  = Math.min(y, window.innerHeight - 140) + 'px';
}
function _hideTooltip() {
  clearTimeout(_tooltipTimer);
  _tooltipTimer = null;
  _tooltipHex   = null;
  unitTooltipEl.classList.add('hidden');
}
let moveHexes   = [];   // valid next-step neighbors for selected unit
let atkHexes    = [];
let pendingAtks = [];
let hoverHex    = null;
let activePath   = [];          // [{col,row},...] path being traced; [0] = unit start
let plannedMoves = new Map();   // unitId → [{col,row},...] committed trajectories
let wpPickerCtx  = null;        // {attackerId, targetId} when weapon picker is open
let selGroupIds  = [];          // unit ids acting together as a group (empty = single)
let reachableHexes = new Map(); // "col,row" → {col,row,dist,prev} — preview de alcance (BFS)

// BFS de hexes alcançáveis a partir do fim do caminho ativo, respeitando o
// terreno de todas as unidades (grupo) e sem revisitar hexes do caminho.
// prev encadeia o caminho mais curto para auto-rota ao clicar no destino.
function computeReachable(units, startHex, maxSteps, inPath) {
  const out = new Map();
  if (maxSteps <= 0) return out;
  const key   = (c, r) => `${c},${r}`;
  const start = { col: startHex.col, row: startHex.row, dist: 0, prev: null };
  const seen  = new Set([key(start.col, start.row)]);
  const queue = [start];
  while (queue.length) {
    const cur = queue.shift();
    if (cur.dist >= maxSteps) continue;
    for (const nb of hexNeighbors(cur.col, cur.row)) {
      const k = key(nb.col, nb.row);
      if (seen.has(k) || inPath.has(k)) continue;
      if (!units.every(u => canEnterTerrain(u.category, TERRAIN_MAP[nb.row][nb.col]))) continue;
      seen.add(k);
      const node = { col: nb.col, row: nb.row, dist: cur.dist + 1, prev: cur };
      out.set(k, node);
      queue.push(node);
    }
  }
  return out;
}

// ─── Socket ───────────────────────────────────────────────────────────────────
const socket = io();

function rangeAgainst(rangeTable, targetCategory) {
  if (!rangeTable) return 0;
  return Number(rangeTable[targetCategory] || 0);
}

socket.on('connect', () => {
  const action = sessionStorage.getItem('pendingAction');
  if (action === 'create') {
    sessionStorage.removeItem('pendingAction');
    socket.emit('create_room');
  } else if (action === 'join') {
    const code = sessionStorage.getItem('pendingCode');
    sessionStorage.removeItem('pendingAction');
    sessionStorage.removeItem('pendingCode');
    if (code) socket.emit('join_room', { roomId: code });
  } else if (action === 'solo') {
    const team = sessionStorage.getItem('soloTeam') || 'blue';
    sessionStorage.removeItem('pendingAction');
    sessionStorage.removeItem('soloTeam');
    socket.emit('create_solo_room', { team });
  } else {
    // Sem ação pendente: se há sessão salva (F5 ou queda de rede), tenta
    // reassumir o assento dentro do período de graça do servidor.
    const saved = localStorage.getItem('oas_session');
    if (saved) {
      try { socket.emit('rejoin_room', JSON.parse(saved)); }
      catch { localStorage.removeItem('oas_session'); }
    }
  }
});

// ─── Reconexão: banner persistente + sessão de rejoin ─────────────────────────
let _reconTimer = null;
function showReconnectBanner(text, seconds) {
  const el = $('reconnect-banner');
  clearInterval(_reconTimer); _reconTimer = null;
  if (seconds > 0) {
    let left = seconds;
    el.textContent = `${text} (${left}s)`;
    _reconTimer = setInterval(() => {
      left -= 1;
      if (left <= 0) { clearInterval(_reconTimer); _reconTimer = null; return; }
      el.textContent = `${text} (${left}s)`;
    }, 1000);
  } else {
    el.textContent = text;
  }
  el.classList.remove('hidden');
}
function hideReconnectBanner() {
  clearInterval(_reconTimer); _reconTimer = null;
  $('reconnect-banner').classList.add('hidden');
}

socket.on('rejoin_failed', () => {
  localStorage.removeItem('oas_session');
  hideReconnectBanner();
  // Só é terminal se o jogador estava no meio de uma partida
  if (!gameScreen.classList.contains('hidden') && gameOver.classList.contains('hidden')) {
    $('disconnect-msg').textContent = 'Não foi possível reconectar — a partida foi encerrada.';
    disconnected.classList.remove('hidden');
  }
});

socket.on('opponent_reconnected', () => {
  hideReconnectBanner();
  if (gameState) { gameState.log?.unshift('🔌 Adversário reconectou.'); updateUI(); }
});

socket.on('room_created', ({roomId, team}) => {
  myTeam = team;
  roomDisplay.textContent = roomId;
  lobbyMenu.classList.add('hidden');
  lobbyWaiting.classList.remove('hidden');
});
socket.on('join_error', msg => showLobbyErr(msg));

socket.on('game_start', ({team, state, solo, roomId, rejoinToken, rejoined}) => {
  myTeam = team; gameState = state; isSolo = !!solo;
  if (roomId) currentRoomId = roomId;
  if (roomId && rejoinToken) {
    localStorage.setItem('oas_session', JSON.stringify({ roomId, team, token: rejoinToken }));
  }
  hideReconnectBanner();
  disconnected.classList.add('hidden');
  if (rejoined) { gameState.log?.unshift('🔌 Você reconectou à partida.'); }
  if (isSolo) document.title = 'Operação Atlântico Sul · Solo vs BOT';
  selUnitId = null; selGroupIds = []; moveHexes = []; atkHexes = []; reachableHexes = new Map(); pendingAtks = [];
  activePath = []; plannedMoves.clear(); hideStackPicker(); hideTargetPicker(); closeWeaponPicker();
  closeBrPanel();
  prevUnitPos = new Map(state.units.map(u => [u.id, {col: u.col, row: u.row}]));
  lobbyScreen.classList.add('hidden');
  gameScreen.classList.remove('hidden');
  gameOver.classList.add('hidden');
  // Preload SVG icons — renders once ready
  initIcons(() => { TINT_CACHE.clear(); render(); });
  updateUI(); render();
});

socket.on('game_update', state => {
  const prevTurn   = gameState?.turn;
  const prevPhase  = gameState?.phase;
  const prevMyDone = myTeam && gameState
    ? (myTeam === 'blue' ? gameState.blueDone : gameState.redDone)
    : false;

  // Flash units that moved since last snapshot
  for (const u of state.units) {
    if (u.hp <= 0) continue;
    const prev = prevUnitPos.get(u.id);
    if (prev && (prev.col !== u.col || prev.row !== u.row)) {
      const color = u.team === 'blue' ? '#82b1ff' : '#ff8a80';
      flashUnit(u.id, color, 900);
    }
  }
  prevUnitPos = new Map(state.units.map(u => [u.id, {col: u.col, row: u.row}]));

  gameState = state;
  const myDoneNow = myTeam === 'blue' ? state.blueDone : state.redDone;
  // Reset on: new turn, combat→movement, or my done flag was reset (new round)
  if (state.turn !== prevTurn
      || (prevPhase === 'combat' && state.phase === 'movement')
      || (state.phase === 'movement' && prevMyDone && !myDoneNow)) {
    activePath = []; plannedMoves.clear(); selGroupIds = [];
    selUnitId = null; moveHexes = []; atkHexes = []; reachableHexes = new Map();
    hideStackPicker();
    // Only force-close the BR panel if the player isn't reading a final result.
    // If the OK button is visible, the player must click it — let the panel
    // close naturally and just flush the queue so OK closes cleanly.
    if ($('br-ok-area').classList.contains('hidden')) {
      closeBrPanel();
    } else {
      brQueue = [];
    }
    if (state.turn !== prevTurn) {
      const per = state.period === 'day' ? '☀ Diurno' : '🌙 Noturno';
      flashScene(`TURNO ${state.turn}  ·  ${per}`, 'rgba(0,0,0,0.55)', 1800);
      SFX.play('turnChange');
    }
  } else if (selUnitId) {
    const u = gameState.units.find(u => u.id === selUnitId && u.hp > 0);
    if (u) {
      if (selGroupIds.length > 0) {
        const gUnits = gameState.units.filter(u => selGroupIds.includes(u.id) && u.hp > 0);
        if (gUnits.length > 0) recalcHighlightsGroup(gUnits); else deselect();
      } else {
        recalcHighlights(u);
      }
    } else { deselect(); }
  }
  updateUI(); render();
});

socket.on('game_over', ({winner, state, objectives, reason}) => {
  localStorage.removeItem('oas_session');
  hideReconnectBanner();
  gameState = state; updateUI(); render();
  const mine = winner === myTeam;
  if (reason === 'abandon') {
    winnerMsg.textContent = mine ? '🏆 VITÓRIA! Adversário abandonou.' : '🏳 Você abandonou o jogo.';
    $('winner-sub').textContent = mine ? 'Vitória por W.O.' : '';
  } else if (reason === 'timeout') {
    winnerMsg.textContent = mine ? '🏆 VITÓRIA!' : '💀 DERROTA';
    $('winner-sub').textContent =
      `Limite operacional atingido — ${winner === 'blue' ? 'Força Azul' : 'Força Vermelha'} venceu por maior progresso nos objetivos.`;
  } else {
    winnerMsg.textContent = mine ? '🏆 VITÓRIA!' : '💀 DERROTA';
    $('winner-sub').textContent = mine
      ? `${winner === 'blue' ? 'Força Azul' : 'Força Vermelha'} atingiu seus objetivos.`
      : `${winner === 'blue' ? 'Força Azul' : 'Força Vermelha'} atingiu seus objetivos.`;
  }
  winnerMsg.className = mine ? 'victory' : 'defeat';
  renderOverObjectives(objectives, winner, reason);
  gameOver.classList.remove('hidden');
});
socket.on('opponent_disconnected', (info = {}) => {
  if (info.grace) {
    // Queda com período de graça: aviso não-terminal enquanto o servidor espera
    showReconnectBanner('⌛ Adversário desconectou — aguardando reconexão', info.seconds || 75);
    return;
  }
  hideReconnectBanner();
  localStorage.removeItem('oas_session');
  if (!gameOver.classList.contains('hidden')) return; // partida já encerrada normalmente
  $('disconnect-msg').textContent = 'Oponente desconectou.';
  disconnected.classList.remove('hidden');
});
// Própria conexão caiu (rede/aba/sleep): o socket.io tenta reconectar sozinho;
// ao reconectar, o handler de 'connect' reassume o assento via rejoin_room.
socket.on('disconnect', reason => {
  if (reason === 'io client disconnect') return; // navegação intencional (ex.: Voltar ao Lobby)
  if (gameScreen.classList.contains('hidden')) return; // ainda no lobby
  if (!gameOver.classList.contains('hidden')) return;   // partida já tinha terminado normalmente
  if (!disconnected.classList.contains('hidden')) return; // já exibindo aviso terminal
  showReconnectBanner('⌛ Conexão perdida — tentando reconectar...', 0);
});
socket.on('action_error', msg => {
  SFX.play('error');
  flashError(msg);
  // Reverse optimistic done flag so the button becomes available again
  if (gameState?.phase === 'movement') {
    if (myTeam === 'blue') gameState.blueDone = false; else gameState.redDone = false;
    updateUI();
  }
});
socket.on('battle_round_result', data => {
  handleBrResult(data);
  const eng = data.engagement;
  if (eng) {
    flashUnit(eng.attackerId, '#ffd700', 900);
    const hitColor = data.totalDamage > 0 ? '#ff5252' : '#888';
    flashUnit(eng.targetId, hitColor, data.destroyed ? 1800 : 1000);
    if (data.destroyed) { flashScene('💥 DESTRUÍDO', 'rgba(180,0,0,0.45)', 1200); SFX.play('destroy'); }
    else if (data.totalDamage > 0) SFX.play('hit');
    else SFX.play('miss');
  }
});
socket.on('fuel_alert', ({ name, type }) => {
  const msg = type === 'air_lost'
    ? `✈ ${name} perdida por falta de combustível!`
    : `⛽ ${name} sem combustível — imóvel e indefesa até reabastecimento.`;
  SFX.play('error');
  flashError(msg);
});

// ─── SFX button hover delegation ─────────────────────────────────────────────
document.addEventListener('mouseover', e => SFX.onButtonMouseover(e.target));
document.addEventListener('mouseout',  e => SFX.onButtonMouseout(e.target));

// ─── SFX mute toggle ─────────────────────────────────────────────────────────
function _updateSfxBtn() {
  const m = SFX.muted;
  sfxToggle.textContent = m ? '🔇' : '🔊';
  sfxToggle.classList.toggle('muted', m);
}
sfxToggle.addEventListener('click', () => { SFX.toggleMute(); _updateSfxBtn(); });
_updateSfxBtn();
document.addEventListener('keydown', e => {
  if (e.ctrlKey || e.metaKey || document.activeElement.tagName === 'INPUT') return;
  if (e.key === 's') { SFX.toggleMute(); _updateSfxBtn(); }
  if (e.key === 'h') {
    helpModal.classList.contains('hidden') ? showHelpModal() : hideHelpModal();
  }
});

// ─── Lobby actions ────────────────────────────────────────────────────────────
btnCreate.addEventListener('click', () => { SFX.init(); socket.emit('create_room'); });
btnJoin.addEventListener('click', () => {
  const code = roomInput.value.trim().toUpperCase();
  if (code) { SFX.init(); socket.emit('join_room', {roomId: code}); }
});
roomInput.addEventListener('keydown', e => { if (e.key === 'Enter') btnJoin.click(); });

// ─── Game actions ─────────────────────────────────────────────────────────────
endPhaseBtn.addEventListener('click', () => {
  if (!isMyTurn()) return;
  SFX.play('confirm');
  // Save active path (individual or group) before submitting
  if (selUnitId !== null && activePath.length > 1) {
    const ids = selGroupIds.length > 0 ? selGroupIds : [selUnitId];
    for (const id of ids) plannedMoves.set(id, [...activePath]);
  }
  const moves = [];
  for (const [unitId, path] of plannedMoves) {
    if (path.length > 1) moves.push({ unitId, path });
  }
  socket.emit('commit_moves', { moves });
  // Optimistically mark done to prevent double-submission; reversed on action_error
  if (myTeam === 'blue') gameState.blueDone = true; else gameState.redDone = true;
  activePath = []; plannedMoves.clear(); selGroupIds = [];
  selUnitId = null; moveHexes = []; atkHexes = []; reachableHexes = new Map();
  hideStackPicker();
  updateUI(); render();
});

combatBtn.addEventListener('click', () => {
  if (!isMyTurn()) return;
  SFX.play('confirm');
  socket.emit('declare_attacks', pendingAtks);
  pendingAtks = []; deselect();
});

undoStepBtn.addEventListener('click', () => { SFX.play('deselect'); undoStep(); });

cancelBtn.addEventListener('click', () => { SFX.play('click'); hideStackPicker(); deselect(false); });

$('btn-restart').addEventListener('click', () => { SFX.play('click'); socket.emit('restart'); gameOver.classList.add('hidden'); });
$('btn-export-over').addEventListener('click', () => exportLog());
$('btn-export-full-over').addEventListener('click', () => exportFullLog());
$('br-btn-continue').addEventListener('click', () => { SFX.play('click'); sendBrDecision('continue'); });
$('br-btn-stop'    ).addEventListener('click', () => { SFX.play('click'); sendBrDecision('stop'); });
$('br-btn-ok'      ).addEventListener('click', () => { SFX.play('click'); onBrOk(); });
$('btn-back').addEventListener('click', () => location.reload());

exportLogBtn.addEventListener('click', () => exportLog());
exportFullLogBtn.addEventListener('click', () => exportFullLog());

abandonBtn.addEventListener('click', () => {
  if (!gameState || gameState.winner) return;
  if (!confirm('Tem certeza que deseja abandonar o jogo? O adversário será declarado vencedor.')) return;
  socket.emit('abandon_game');
});

// Amount +/- controls in unit panel (event delegation)
$('unit-panel').addEventListener('click', e => {
  // Card thumbnail → open modal
  const thumb = e.target.closest('[data-card-unit]');
  if (thumb) { showCardModal(thumb.dataset.cardUnit); return; }

  const btn = e.target.closest('[data-atk-adj]');
  if (!btn) return;
  const attackerId = btn.dataset.attacker;
  const targetId   = btn.dataset.target;
  const delta      = Number(btn.dataset.atk_adj);
  const atk = pendingAtks.find(a => a.attackerId === attackerId && a.targetId === targetId);
  if (!atk) return;
  const maxAmt = Number(btn.dataset.max) || 4;
  atk.amount = Math.max(1, Math.min(maxAmt, (atk.amount || 1) + delta));
  updateUI(); render();
});

// ─── Canvas input ─────────────────────────────────────────────────────────────
canvas.addEventListener('mousemove', e => {
  const {x, y} = toGamePx(e.clientX, e.clientY);
  const h = pixelToHex(x, y);
  hoverHex = h;
  if (h.col >= 0 && h.col < GRID_W && h.row >= 0 && h.row < GRID_H) {
    const t = TERRAIN_MAP[h.row][h.col];
    const inf = INFRA.filter(i => i.col === h.col && i.row === h.row);
    let tip = `${hexLabel(h.col)}${h.row + 1} · ${T_NAME[t]}`;
    if (inf.length) tip += ' · ' + inf.map(i => i.name).join(', ');
    terrainTip.textContent = tip;
    terrainTip.style.display = 'block';

    // Unit tooltip: appear after 350 ms hovering the same hex
    if (gameState) {
      const hexKey = `${h.col},${h.row}`;
      const visUnits = gameState.units.filter(u => u.col === h.col && u.row === h.row && u.hp > 0);
      if (visUnits.length > 0) {
        _positionTooltip(e.clientX, e.clientY); // keep it tracking cursor even while waiting
        if (_tooltipHex !== hexKey) {
          _tooltipHex = hexKey;
          clearTimeout(_tooltipTimer);
          _tooltipTimer = setTimeout(() => _showTooltip(visUnits, e.clientX, e.clientY), 350);
          SFX.hoverUnit();
        }
      } else {
        _hideTooltip();
      }
    }
  } else {
    terrainTip.style.display = 'none';
    _hideTooltip();
  }
  render();
});
canvas.addEventListener('mouseleave', () => {
  hoverHex = null;
  terrainTip.style.display = 'none';
  _hideTooltip();
  render();
});
// Convert screen pixels → game world pixels (accounting for zoom/pan)
function toGamePx(clientX, clientY) {
  const r  = canvas.getBoundingClientRect();
  const sx = CVS_W / r.width;
  const sy = CVS_H / r.height;
  return {
    x: ((clientX - r.left) * sx - panX) / zoom,
    y: ((clientY - r.top)  * sy - panY) / zoom,
  };
}

canvas.addEventListener('click', e => {
  if (isPanning) return;
  if (!gameState) return;
  const {x, y} = toGamePx(e.clientX, e.clientY);
  const h = pixelToHex(x, y);
  handleClick(h.col, h.row);
});

// Right-click → show full card modal (tier 3)
canvas.addEventListener('contextmenu', e => {
  e.preventDefault();
  if (!gameState) return;
  const {x, y} = toGamePx(e.clientX, e.clientY);
  const h = pixelToHex(x, y);
  if (h.col < 0 || h.col >= GRID_W || h.row < 0 || h.row >= GRID_H) return;
  const units = gameState.units.filter(u => u.col === h.col && u.row === h.row && u.hp > 0);
  if (units.length === 0) return;
  const target = units.find(u => UNIT_CARD[u.id]) || units[0];
  showCardModal(target.id);
});

// Zoom via scroll wheel
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  const r   = canvas.getBoundingClientRect();
  const sx  = CVS_W / r.width;
  const sy  = CVS_H / r.height;
  const screenX = (e.clientX - r.left) * sx;
  const screenY = (e.clientY - r.top)  * sy;
  const factor  = e.deltaY < 0 ? 1.12 : 1 / 1.12;
  applyZoomAround(screenX, screenY, factor);
}, { passive: false });

// Pan via middle-mouse drag or alt+left drag
canvas.addEventListener('mousedown', e => {
  if (e.button === 1 || (e.button === 0 && e.altKey)) {
    isPanning = true;
    panStartX = e.clientX; panStartY = e.clientY;
    panStartPanX = panX; panStartPanY = panY;
    e.preventDefault();
  }
});
window.addEventListener('mousemove', e => {
  if (!isPanning) return;
  const r   = canvas.getBoundingClientRect();
  const sx  = CVS_W / r.width;
  const sy  = CVS_H / r.height;
  panX = panStartPanX + (e.clientX - panStartX) * sx;
  panY = panStartPanY + (e.clientY - panStartY) * sy;
  clampPan();
  render();
});
window.addEventListener('mouseup', () => { isPanning = false; });

// ─── Controles touch: pan com 1 dedo, pinch zoom, tap seleciona, ──────────────
// long-press (~500ms) abre o card da unidade (substitui o clique-direito).
let _touchState = null;
let _longPressTimer = null;

canvas.addEventListener('touchstart', e => {
  e.preventDefault(); // evita scroll da página e mouse events sintetizados
  if (e.touches.length === 1) {
    const t = e.touches[0];
    // Borda direita em telas pequenas é reservada ao gesto de abrir o drawer
    if (window.innerWidth <= 860 && t.clientX >= window.innerWidth - 24) {
      _touchState = null;
      return;
    }
    _touchState = {
      mode: 'pan', moved: false, longPressed: false,
      startX: t.clientX, startY: t.clientY,
      lastX: t.clientX,  lastY: t.clientY,
      panX0: panX, panY0: panY,
    };
    clearTimeout(_longPressTimer);
    _longPressTimer = setTimeout(() => {
      if (!_touchState || _touchState.moved || !gameState) return;
      _touchState.longPressed = true;
      const { x, y } = toGamePx(_touchState.startX, _touchState.startY);
      const h = pixelToHex(x, y);
      const units = gameState.units.filter(u => u.col === h.col && u.row === h.row && u.hp > 0);
      const target = units.find(u => UNIT_CARD[u.id]) || units[0];
      if (target && UNIT_CARD[target.id]) showCardModal(target.id);
    }, 500);
  } else if (e.touches.length === 2) {
    clearTimeout(_longPressTimer);
    const [a, b] = e.touches;
    _touchState = { mode: 'pinch', dist: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) };
  }
}, { passive: false });

canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  if (!_touchState) return;
  if (_touchState.mode === 'pan' && e.touches.length === 1) {
    const t  = e.touches[0];
    const dx = t.clientX - _touchState.startX;
    const dy = t.clientY - _touchState.startY;
    _touchState.lastX = t.clientX; _touchState.lastY = t.clientY;
    if (!_touchState.moved && Math.hypot(dx, dy) > 8) {
      _touchState.moved = true;
      clearTimeout(_longPressTimer);
    }
    if (_touchState.moved) {
      const r  = canvas.getBoundingClientRect();
      panX = _touchState.panX0 + dx * (CVS_W / r.width);
      panY = _touchState.panY0 + dy * (CVS_H / r.height);
      clampPan(); render();
    }
  } else if (_touchState.mode === 'pinch' && e.touches.length === 2) {
    const [a, b] = e.touches;
    const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    if (_touchState.dist > 0 && d > 0) {
      const r    = canvas.getBoundingClientRect();
      const midX = ((a.clientX + b.clientX) / 2 - r.left) * (CVS_W / r.width);
      const midY = ((a.clientY + b.clientY) / 2 - r.top)  * (CVS_H / r.height);
      applyZoomAround(midX, midY, d / _touchState.dist);
    }
    _touchState.dist = d;
  }
}, { passive: false });

let _lastTap = { t: 0, x: 0, y: 0 };
canvas.addEventListener('touchend', e => {
  clearTimeout(_longPressTimer);
  const st = _touchState;
  if (!st) return;
  if (e.touches.length === 0) {
    _touchState = null;
    if (st.mode === 'pan' && !st.moved && !st.longPressed && gameState) {
      // Double-tap: alterna entre visão geral (zoom 1) e aproximação no ponto
      const now = Date.now();
      const isDouble = now - _lastTap.t < 350 &&
        Math.hypot(st.lastX - _lastTap.x, st.lastY - _lastTap.y) < 30;
      _lastTap = { t: now, x: st.lastX, y: st.lastY };
      if (isDouble) {
        _lastTap.t = 0; // evita triple-tap encadear
        if (zoom > 1.05) { zoom = 1; panX = 0; panY = 0; render(); }
        else {
          const r = canvas.getBoundingClientRect();
          applyZoomAround((st.lastX - r.left) * (CVS_W / r.width),
                          (st.lastY - r.top)  * (CVS_H / r.height), 2.2 / zoom);
        }
        return;
      }
      const { x, y } = toGamePx(st.lastX, st.lastY);
      const h = pixelToHex(x, y);
      handleClick(h.col, h.row);
    }
  } else if (e.touches.length === 1 && st.mode === 'pinch') {
    // Um dedo saiu do pinch: o dedo restante passa a arrastar (pan)
    const t = e.touches[0];
    _touchState = { mode: 'pan', moved: true, longPressed: false,
                    startX: t.clientX, startY: t.clientY,
                    lastX: t.clientX,  lastY: t.clientY,
                    panX0: panX, panY0: panY };
  }
}, { passive: false });

canvas.addEventListener('touchcancel', () => {
  clearTimeout(_longPressTimer);
  _touchState = null;
}, { passive: true });

// ─── Gestos do drawer lateral (mobile <=860px) ────────────────────────────────
// Deslizar da borda direita para dentro abre o painel; deslizar o painel para
// a direita fecha. Complementa o botão ☰ e o backdrop.
(function initSidebarSwipe() {
  const body = document.querySelector('.game-body');
  if (!body) return;
  let track = null;
  document.addEventListener('touchstart', e => {
    if (window.innerWidth > 860 || e.touches.length !== 1) { track = null; return; }
    const t = e.touches[0];
    const open = body.classList.contains('sidebar-open');
    if (!open && t.clientX >= window.innerWidth - 24)  track = { mode: 'open',  x: t.clientX };
    else if (open && e.target.closest('.sidebar'))      track = { mode: 'close', x: t.clientX };
    else track = null;
  }, { passive: true });
  document.addEventListener('touchmove', e => {
    if (!track) return;
    const dx = e.touches[0].clientX - track.x;
    if      (track.mode === 'open'  && dx < -40) { body.classList.add('sidebar-open');    track = null; }
    else if (track.mode === 'close' && dx >  50) { body.classList.remove('sidebar-open'); track = null; }
  }, { passive: true });
  document.addEventListener('touchend', () => { track = null; }, { passive: true });
})();

// Zoom control buttons
$('zoom-in' ).addEventListener('click', () => applyZoomAround(CVS_W/2, CVS_H/2, 1.25));
$('zoom-out').addEventListener('click', () => applyZoomAround(CVS_W/2, CVS_H/2, 1/1.25));
$('zoom-reset').addEventListener('click', () => { zoom = 1; panX = 0; panY = 0; render(); });

// ─── Click logic ──────────────────────────────────────────────────────────────
function handleClick(col, row) {
  if (!gameState || gameState.winner) return;
  if (col < 0 || col >= GRID_W || row < 0 || row >= GRID_H) return;
  const {phase} = gameState;

  // Dismiss open pickers
  if (!stackPicker.classList.contains('hidden'))  { hideStackPicker();   return; }
  if (!targetPicker.classList.contains('hidden')) { hideTargetPicker();  return; }
  if (!weaponPicker.classList.contains('hidden')) { closeWeaponPicker(); return; }

  // ── Combat phase ──
  if (phase === 'combat') {
    if (isMyTurn() && selUnitId !== null) {
      const hexAtks = atkHexes.filter(h => h.col === col && h.row === row);
      if (hexAtks.length > 0) {
        if (hexAtks.length > 1) {
          showTargetPicker(col, row, hexAtks);
        } else {
          _onTargetChosen(hexAtks[0]);
        }
        return;
      }
    }
    const ownUnits = gameState.units.filter(u => u.col === col && u.row === row && u.hp > 0 && u.team === myTeam);
    if (ownUnits.length > 1) { showStackPicker(col, row, ownUnits); return; }
    if (ownUnits.length === 1) {
      selGroupIds = []; selUnitId = ownUnits[0].id;
      SFX.play('select');
      recalcHighlights(ownUnits[0]); updateUI(); render();
    } else { if (!tryShowEnemyCard(col, row)) deselect(); }
    return;
  }

  // ── Movement phase ──
  if (phase === 'movement' && isMyTurn()) {
    // Extend current path: adjacent step, or auto-route to any reachable hex
    if (selUnitId !== null) {
      const move  = moveHexes.find(h => h.col === col && h.row === row);
      const reach = !move && reachableHexes.get(`${col},${row}`);
      if (move || reach) {
        if (move) {
          activePath.push({col, row});
        } else {
          // Reconstrói o caminho mais curto (BFS) até o hex clicado
          const steps = [];
          for (let n = reach; n && n.dist > 0; n = n.prev) steps.unshift({ col: n.col, row: n.row });
          activePath.push(...steps);
        }
        SFX.play('step');
        if (selGroupIds.length > 0) {
          const gUnits = gameState.units.filter(u => selGroupIds.includes(u.id) && u.hp > 0);
          recalcHighlightsGroup(gUnits);
        } else {
          const u = gameState.units.find(u => u.id === selUnitId && u.hp > 0);
          if (u) recalcHighlights(u);
        }
        updateUI(); render(); return;
      }
    }
    // Click on own unit(s)
    const ownUnits = gameState.units.filter(u => u.col === col && u.row === row && u.hp > 0 && u.team === myTeam);
    if (ownUnits.length === 0) { if (!tryShowEnemyCard(col, row)) deselect(true); return; }
    if (ownUnits.length > 1) { deselect(true); showStackPicker(col, row, ownUnits); return; }
    const unit = ownUnits[0];
    if (selUnitId === unit.id && selGroupIds.length === 0) return; // already selected alone
    deselect(true);
    selUnitId = unit.id; selGroupIds = [];
    SFX.play('select');
    const saved = plannedMoves.get(unit.id);
    activePath = saved ? [...saved] : [{col: unit.col, row: unit.row}];
    recalcHighlights(unit); updateUI(); render();
    return;
  }
}

// If there is a visible enemy unit at col,row with a card, show it and return true.
function tryShowEnemyCard(col, row) {
  const enemies = gameState.units.filter(
    u => u.col === col && u.row === row && u.hp > 0 && u.team !== myTeam
  );
  if (enemies.length === 0) return false;
  const target = enemies.find(u => UNIT_CARD[u.id]) || enemies[0];
  if (UNIT_CARD[target.id]) { showCardModal(target.id); return true; }
  return false;
}

// save=true saves activePath to plannedMoves; save=false discards it
function deselect(save = true) {
  if (selUnitId !== null) SFX.play('deselect');
  if (selUnitId !== null) {
    const ids = selGroupIds.length > 0 ? selGroupIds : [selUnitId];
    if (save && activePath.length > 1) {
      for (const id of ids) plannedMoves.set(id, [...activePath]);
    } else if (!save) {
      for (const id of ids) plannedMoves.delete(id);
    }
  }
  selUnitId = null; selGroupIds = []; activePath = []; moveHexes = []; atkHexes = []; reachableHexes = new Map();
  updateUI(); render();
}

function undoStep() {
  if (activePath.length <= 1) return;
  activePath.pop();
  if (selGroupIds.length > 0) {
    const gUnits = gameState?.units.filter(u => selGroupIds.includes(u.id) && u.hp > 0) || [];
    if (gUnits.length > 0) recalcHighlightsGroup(gUnits);
  } else {
    const u = gameState?.units.find(u => u.id === selUnitId && u.hp > 0);
    if (u) recalcHighlights(u);
  }
  updateUI(); render();
}

// ─── Group recalc ─────────────────────────────────────────────────────────────
function recalcHighlightsGroup(units) {
  const {phase} = gameState;
  if (phase === 'movement' && isMyTurn()) {
    const minMov     = Math.min(...units.map(u => unitMovementRange(u)));
    const stepsTaken = activePath.length - 1;
    if (stepsTaken < minMov) {
      const lastHex = activePath[activePath.length - 1];
      const inPath  = new Set(activePath.map(h => `${h.col},${h.row}`));
      moveHexes = hexNeighbors(lastHex.col, lastHex.row).filter(nb => {
        if (inPath.has(`${nb.col},${nb.row}`)) return false;
        return units.every(u => canEnterTerrain(u.category, TERRAIN_MAP[nb.row][nb.col]));
      });
      reachableHexes = computeReachable(units, lastHex, minMov - stepsTaken, inPath);
    } else { moveHexes = []; reachableHexes = new Map(); }
  } else { moveHexes = []; reachableHexes = new Map(); }

  if (phase === 'combat' && isMyTurn()) {
    atkHexes = [];
    const enemies = gameState.units.filter(u => u.team !== myTeam && u.hp > 0 && u.detected);
    for (const e of enemies) {
      if (units.some(u => hexDist(u.col, u.row, e.col, e.row) <= rangeAgainst(u.attackRange, e.category))) {
        atkHexes.push({col: e.col, row: e.row, unitId: e.id, category: e.category});
      }
    }
  } else { atkHexes = []; }
}

// ─── Stack picker ─────────────────────────────────────────────────────────────
function showStackPicker(col, row, units) {
  spList.innerHTML = '';
  for (const u of units) {
    const btn = document.createElement('button');
    btn.className = 'sp-unit-btn';
    const c = u.team === 'blue' ? 'var(--blue-l)' : 'var(--red-l)';
    btn.innerHTML = `<span style="color:${c}">${u.name}</span> · ${u.hp}/${u.maxHp}SP`;
    btn.addEventListener('click', () => { hideStackPicker(); _selectUnit(u); });
    spList.appendChild(btn);
  }
  spGroupBtn.onclick = () => { hideStackPicker(); _selectGroup(units); };

  const {x, y} = hexToPixel(col, row);
  const rect  = canvas.getBoundingClientRect();
  const wrap  = canvas.parentElement.getBoundingClientRect();
  const scale = rect.width / canvas.width;
  // Account for zoom/pan transform
  const wx = (x * zoom + panX) * scale;
  const wy = ((y + HEX_R) * zoom + panY) * scale;
  const sx = rect.left - wrap.left + wx;
  const sy = rect.top  - wrap.top  + wy + 6;
  stackPicker.style.left = `${Math.round(sx - 85)}px`;
  stackPicker.style.top  = `${Math.round(sy)}px`;
  stackPicker.classList.remove('hidden');
  SFX.play('stackPick');
}

function hideStackPicker() { stackPicker.classList.add('hidden'); }

// ─── Target picker (enemy stacked units in combat phase) ──────────────────────
function showTargetPicker(col, row, atkEntries) {
  tpList.innerHTML = '';
  for (const entry of atkEntries) {
    const enemy = gameState.units.find(u => u.id === entry.unitId);
    const btn   = document.createElement('button');
    btn.className = 'sp-unit-btn';
    const hpPct = enemy ? Math.round((enemy.hp / enemy.maxHp) * 100) : 0;
    btn.innerHTML = `<span style="color:var(--red-l)">${enemy?.name || entry.unitId}</span> · ${enemy?.hp ?? '?'}/${enemy?.maxHp ?? '?'}SP (${hpPct}%)`;
    btn.addEventListener('click', () => {
      hideTargetPicker();
      _onTargetChosen(entry);
    });
    tpList.appendChild(btn);
  }

  // Position near the clicked hex (same logic as stack-picker)
  const {x, y} = hexToPixel(col, row);
  const rect  = canvas.getBoundingClientRect();
  const wrap  = canvas.parentElement.getBoundingClientRect();
  const scale = rect.width / canvas.width;
  const wx = (x * zoom + panX) * scale;
  const wy = ((y + HEX_R) * zoom + panY) * scale;
  const sx = rect.left - wrap.left + wx;
  const sy = rect.top  - wrap.top  + wy + 6;
  targetPicker.style.left = `${Math.round(sx - 85)}px`;
  targetPicker.style.top  = `${Math.round(sy)}px`;
  targetPicker.classList.remove('hidden');
  SFX.play('stackPick');
}

function hideTargetPicker() { targetPicker.classList.add('hidden'); }

function _onTargetChosen(atk) {
  if (selGroupIds.length > 0) {
    const allDeclared = selGroupIds.every(id =>
      pendingAtks.some(a => a.attackerId === id && a.targetId === atk.unitId));
    if (allDeclared) {
      pendingAtks = pendingAtks.filter(a =>
        !(selGroupIds.includes(a.attackerId) && a.targetId === atk.unitId));
      SFX.play('attackRemove');
    } else {
      for (const id of selGroupIds) {
        const gu = gameState.units.find(u => u.id === id && u.hp > 0);
        if (!gu) continue;
        if (rangeAgainst(gu.attackRange, atk.category) >= 1 &&
            hexDist(gu.col, gu.row, atk.col, atk.row) <= rangeAgainst(gu.attackRange, atk.category) &&
            !pendingAtks.some(a => a.attackerId === id && a.targetId === atk.unitId)) {
          pendingAtks.push({ attackerId: id, targetId: atk.unitId, amount: 1 });
        }
      }
      SFX.play('attack');
    }
    updateUI(); render();
  } else {
    const existing = pendingAtks.findIndex(a => a.attackerId === selUnitId && a.targetId === atk.unitId);
    if (existing >= 0) {
      pendingAtks.splice(existing, 1);
      SFX.play('attackRemove');
      updateUI(); render();
    } else {
      const attUnit = gameState.units.find(u => u.id === selUnitId);
      const dist = hexDist(attUnit?.col ?? 0, attUnit?.row ?? 0, atk.col, atk.row);
      openWeaponPicker(selUnitId, atk.unitId, atk.category, dist);
    }
  }
}

// ─── Weapon picker ────────────────────────────────────────────────────────────
function openWeaponPicker(attackerId, targetId, targetCategory, dist) {
  const attUnit = gameState?.units.find(u => u.id === attackerId);
  if (!attUnit) return;

  // Expendable weapons live in unit.weapons; combat-capability weapons
  // (navalGun, airDefense, bmd, asw, airAttack) live in unit.capabilities
  // and are unlimited / non-expendable.
  const available = [];
  for (const [wpn, info] of Object.entries(attUnit.weapons || {})) {
    if ((info.quantity ?? 0) <= 0) continue;
    const targets = WEAPON_TARGETS[wpn] || [];
    if (!targets.includes(targetCategory)) continue;
    const range = info.range ?? WEAPON_DEFAULT_RANGE[wpn] ?? 0;
    if (dist > range) continue;
    available.push([wpn, { quantity: info.quantity, range, expendable: true }]);
  }
  for (const [wpn, val] of Object.entries(attUnit.capabilities || {})) {
    if (attUnit.weapons?.[wpn] != null) continue; // already covered above
    if ((val ?? 0) <= 0) continue;
    const targets = WEAPON_TARGETS[wpn] || [];
    if (!targets.includes(targetCategory)) continue;
    const range = WEAPON_DEFAULT_RANGE[wpn] ?? 1;
    if (dist > range) continue;
    available.push([wpn, { quantity: val, range, expendable: false }]);
  }

  if (available.length === 0) return;

  // Single non-expendable weapon: skip picker
  if (available.length === 1 && !available[0][1].expendable) {
    const [wpnType] = available[0];
    addOrToggleAttack(attackerId, targetId, wpnType, 1);
    return;
  }

  const tgtUnit = gameState?.units.find(u => u.id === targetId);
  wpTargetName.textContent = `→ ${tgtUnit?.name || targetId}`;

  wpBody.innerHTML = available.map(([wpn, info], i) => {
    const label  = WEAPON_LABELS[wpn] || wpn.toUpperCase();
    const qty    = info.quantity ?? 0;
    const isExp  = !!info.expendable;
    return `<div class="wp-row">
      <label class="wp-label">
        <input type="radio" name="wp-radio" value="${wpn}" ${i === 0 ? 'checked' : ''}>
        <span class="wp-name" title="${WEAPON_GLOSSARY[wpn] || ''}">${label}</span>
        <span class="wp-qty">${isExp ? `(${qty} disp.)` : '(ilimitado)'}</span>
      </label>
      ${isExp ? `<div class="wp-qty-ctrl" data-max="${qty}">
        <button class="wp-adj" data-adj="-1">−</button>
        <span class="wp-amt">1</span>
        <button class="wp-adj" data-adj="1">+</button>
      </div>` : ''}
    </div>`;
  }).join('');

  // Quantity controls
  wpBody.querySelectorAll('.wp-adj').forEach(btn => {
    btn.addEventListener('click', () => {
      const ctrl  = btn.closest('.wp-qty-ctrl');
      const max   = parseInt(ctrl.dataset.max) || 1;
      const amtEl = ctrl.querySelector('.wp-amt');
      let val = parseInt(amtEl.textContent) + parseInt(btn.dataset.adj);
      amtEl.textContent = String(Math.max(1, Math.min(max, val)));
    });
  });

  wpPickerCtx = { attackerId, targetId };
  weaponPicker.classList.remove('hidden');
}

function closeWeaponPicker() {
  weaponPicker.classList.add('hidden');
  wpPickerCtx = null;
}

function addOrToggleAttack(attackerId, targetId, weaponType, amount) {
  const idx = pendingAtks.findIndex(a => a.attackerId === attackerId && a.targetId === targetId);
  if (idx >= 0) { pendingAtks.splice(idx, 1); SFX.play('attackRemove'); }
  else { pendingAtks.push({ attackerId, targetId, weaponType, amount }); SFX.play('attack'); }
  updateUI(); render();
}

wpConfirmBtn.addEventListener('click', () => {
  if (!wpPickerCtx) return;
  const { attackerId, targetId } = wpPickerCtx;
  const radio = wpBody.querySelector('input[name="wp-radio"]:checked');
  if (!radio) return;
  const wpn = radio.value;
  const ctrl = wpBody.querySelector(`.wp-qty-ctrl`);
  const amount = ctrl ? parseInt(ctrl.querySelector('.wp-amt').textContent) || 1 : 1;
  closeWeaponPicker();
  addOrToggleAttack(attackerId, targetId, wpn, amount);
});

wpCancelBtn.addEventListener('click', closeWeaponPicker);

function _selectUnit(unit) {
  selGroupIds = [];
  SFX.play('select');
  if (gameState.phase === 'movement') {
    deselect(true);
    selUnitId = unit.id;
    const saved = plannedMoves.get(unit.id);
    activePath = saved ? [...saved] : [{col: unit.col, row: unit.row}];
    recalcHighlights(unit);
  } else {
    selUnitId = unit.id; recalcHighlights(unit);
  }
  updateUI(); render();
}

function _selectGroup(units) {
  const ids = units.map(u => u.id);
  SFX.play('select');
  if (gameState.phase === 'movement') {
    deselect(true);
    selGroupIds = ids; selUnitId = ids[0];
    for (const id of ids) plannedMoves.delete(id);
    const lead = units[0];
    activePath = [{col: lead.col, row: lead.row}];
    recalcHighlightsGroup(units);
  } else {
    selGroupIds = ids; selUnitId = ids[0];
    recalcHighlightsGroup(units);
  }
  updateUI(); render();
}

function recalcHighlights(unit) {
  const {phase} = gameState;

  if (phase === 'movement' && isMyTurn()) {
    const stepsTaken = activePath.length - 1;
    if (stepsTaken < unitMovementRange(unit)) {
      const lastHex = activePath[activePath.length - 1];
      const inPath  = new Set(activePath.map(h => `${h.col},${h.row}`));
      moveHexes = hexNeighbors(lastHex.col, lastHex.row).filter(nb => {
        if (inPath.has(`${nb.col},${nb.row}`)) return false;
        return canEnterTerrain(unit.category, TERRAIN_MAP[nb.row][nb.col]);
      });
      reachableHexes = computeReachable([unit], lastHex, unitMovementRange(unit) - stepsTaken, inPath);
    } else {
      moveHexes = [];
      reachableHexes = new Map();
    }
  } else {
    moveHexes = [];
    reachableHexes = new Map();
  }

  if (phase === 'combat' && isMyTurn()) {
    atkHexes = [];
    const enemies = gameState.units.filter(u => u.team !== myTeam && u.hp > 0 && u.detected);
    for (const e of enemies) {
      if (hexDist(unit.col, unit.row, e.col, e.row) <= rangeAgainst(unit.attackRange, e.category)) {
        atkHexes.push({col: e.col, row: e.row, unitId: e.id, category: e.category});
      }
    }
  } else {
    atkHexes = [];
  }
}

function isMyTurn() {
  if (!gameState) return false;
  const {phase, blueDone, redDone} = gameState;
  if (phase === 'movement') return myTeam === 'blue' ? !blueDone : !redDone;
  if (phase === 'combat')   return myTeam === 'blue' ? gameState.blueAttacks === null : gameState.redAttacks === null;
  return false;
}

function fuelRow(unit) {
  const f = unit.fuel;
  if (!f || !f.usesFuel) {
    return `<span>Combustível</span><span class="fp-inf">∞</span>`;
  }
  if (unit.category === 'air') {
    const STATUS = { ready: 'Pronta', airborne: 'Em voo', recovering: 'Reabastecendo' };
    const statusLabel = STATUS[unit.airStatus] || unit.airStatus || '—';
    const fpLabel = unit.airStatus === 'ready' || unit.airStatus === 'recovering'
      ? `${f.max} FP` : `${f.current ?? 0}/${f.max} FP`;
    const fpClass = (f.current ?? f.max) <= Math.ceil(f.max * 0.25) ? 'fp-low' : 'fp-ok';
    return `<span>Status</span><span>${statusLabel}</span>
            <span>Combustível</span><span class="${fpClass}">${fpLabel}</span>`;
  }
  // Naval
  const cur = f.current ?? 0;
  const pct = f.max > 0 ? cur / f.max : 0;
  const cls = cur <= 0 ? 'fp-empty' : pct <= 0.25 ? 'fp-low' : 'fp-ok';
  return `<span>Combustível</span><span class="${cls}">${cur}/${f.max} FP</span>`;
}

function buildAtkListHtml(atks) {
  if (!atks.length) return '';
  const items = atks.map(a => {
    const tgt     = gameState?.units.find(u => u.id === a.targetId);
    const tgtName = tgt?.name || a.targetId;
    const attUnit = gameState?.units.find(u => u.id === a.attackerId);
    const wpnInfo = attUnit?.weapons?.[a.weaponType];
    const isExp   = a.weaponType ? !!WEAPON_EXPENDABLE[a.weaponType] : false;
    const maxAmt  = wpnInfo?.quantity ?? (attUnit ? Math.max(1, ...Object.values(attUnit.weapons || {}).map(w => w.quantity || 0)) : 4);
    const amt     = a.amount || 1;
    const wpnTag  = a.weaponType ? `<span class="atk-wpn-tag">[${WEAPON_LABELS[a.weaponType] || a.weaponType.toUpperCase()}]</span>` : '';
    return `<div class="atk-entry">
      <span class="atk-target">→ ${tgtName} ${wpnTag}</span>
      ${isExp ? `<span class="atk-amt-ctrl">
        <button class="atk-adj-btn" data-atk-adj data-attacker="${a.attackerId}" data-target="${a.targetId}" data-atk_adj="-1" data-max="${maxAmt}">−</button>
        <span class="atk-amt-val">${amt}</span>
        <button class="atk-adj-btn" data-atk-adj data-attacker="${a.attackerId}" data-target="${a.targetId}" data-atk_adj="1" data-max="${maxAmt}">+</button>
      </span>` : ''}
    </div>`;
  }).join('');
  return `<div class="atk-list"><div class="atk-list-title">Ataques declarados:</div>${items}</div>`;
}

// ─── UI update ────────────────────────────────────────────────────────────────
function updateUI() {
  if (!gameState) return;
  const {turn, period, phase, units, log, winner} = gameState;

  teamBadge.textContent  = myTeam === 'blue' ? 'FORÇA AZUL' : 'FORÇA VERMELHA';
  teamBadge.className    = `team-badge ${myTeam}`;
  turnLabel.textContent  = gameState.maxTurns ? `Turno ${turn}/${gameState.maxTurns}` : `Turno ${turn}`;
  periodLabel.textContent= period === 'day' ? '☀ Diurno' : '🌙 Noturno';
  phaseLabel.textContent = phase === 'movement' ? 'Movimentação' : 'Combate';

  myTurnBanner.classList.toggle('visible', isMyTurn() && !winner);

  endPhaseBtn.classList.add('hidden');
  combatBtn.classList.add('hidden');
  undoStepBtn.classList.add('hidden');
  cancelBtn.classList.toggle('hidden', selUnitId === null);

  if (isMyTurn() && !winner) {
    if (phase === 'movement') {
      endPhaseBtn.classList.remove('hidden');
      const n = plannedMoves.size + (selUnitId !== null && activePath.length > 1 && !plannedMoves.has(selUnitId) ? 1 : 0);
      endPhaseBtn.textContent = n > 0 ? `Encerrar Movimentação (${n})` : 'Encerrar Movimentação';
      if (selUnitId !== null && activePath.length > 1) {
        undoStepBtn.classList.remove('hidden');
      }
    }
    if (phase === 'combat') combatBtn.classList.remove('hidden');
  }
  combatBtn.textContent = `Confirmar Ataques (${pendingAtks.length})`;

  const b = units.filter(u => u.team === 'blue' && u.hp > 0).length;
  const r = units.filter(u => u.team === 'red'  && u.hp > 0).length;
  fleetBlue.textContent = `Azul: ${b}`;
  fleetRed.textContent  = `Verm: ${r}`;

  const sel = selUnitId ? gameState.units.find(u => u.id === selUnitId && u.hp > 0) : null;
  if (sel) {
    const hpPct = sel.hp / sel.maxHp * 100;
    const bar   = hpPct > 60 ? '#69f0ae' : hpPct > 30 ? '#ffca28' : '#ff5252';
    const t     = sel.col >= 0 ? TERRAIN_MAP[sel.row][sel.col] : 3;
    const pathSteps    = activePath.length - 1;
    const pathStepsMov = selGroupIds.length > 0
      ? Math.min(...selGroupIds.map(id => { const u2 = gameState.units.find(u => u.id === id); return u2 ? u2.movement : 99; }))
      : sel.movement;
    const pathHint  = pathSteps > 0
      ? `<div class="u-hint">Caminho: ${pathSteps}/${pathStepsMov} passo(s)</div>` : '';
    const groupHint = selGroupIds.length > 1
      ? `<div class="u-hint">Grupo: ${selGroupIds.length} unidades em conjunto</div>` : '';
    const myAtks = selGroupIds.length > 0
      ? pendingAtks.filter(a => selGroupIds.includes(a.attackerId))
      : pendingAtks.filter(a => a.attackerId === sel.id);
    const det  = sel.detectionRange || {};
    const comp = (sel.composition||[]).map(c=>`${c.quantity}× ${c.type}`).join(' · ');

    // Weapons inventory
    const wpns = sel.weapons || {};
    const initW = sel.initWeapons || {};
    const wpnLines = Object.entries(wpns)
      .filter(([k, w]) => w.quantity > 0 || (initW[k]?.quantity ?? 0) > 0)
      .map(([k, w]) => `<span title="${WEAPON_GLOSSARY[k] || ''}">${(WEAPON_LABELS[k] || k).toUpperCase()}: <b>${w.quantity}</b>/${initW[k]?.quantity ?? w.quantity}</span>`);

    // Persistent capabilities
    const caps = sel.capabilities || {};
    const capLines = Object.entries(caps)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => `<span title="${WEAPON_GLOSSARY[k] || ''}">${(WEAPON_LABELS[k] || k).toUpperCase()}: ${v}</span>`);

    const cardFile = cardUrl(sel.id);
    const cardThumb = cardFile ? `
      <div class="card-thumb-wrap">
        <img class="card-thumb" src="${cardFile}" alt="Card ${sel.name}"
             data-card-unit="${sel.id}" title="Clique para ver o card completo">
        <div class="card-thumb-hint">CLIQUE · CARD COMPLETO</div>
      </div>` : '';

    unitPanel.innerHTML = `
      <div class="u-name ${sel.team}">${sel.name}</div>
      <div class="hp-bar"><div class="hp-fill" style="width:${hpPct}%;background:${bar}"></div></div>
      <div class="u-stats">
        <span>SP</span><span>${sel.hp}/${sel.maxHp}</span>
        <span>MOV</span><span>${sel.movement}</span>
        <span>Categoria</span><span>${sel.category}</span>
        ${fuelRow(sel)}
        <span>Det S/Aé/Sb/T</span><span>${det.surface||0}/${det.air||0}/${det.submarine||0}/${det.land||0}</span>
        <span>Terreno</span><span style="font-size:0.7em">${T_NAME[t]}</span>
      </div>
      ${wpnLines.length ? `<div class="u-hint" style="font-size:0.67rem;line-height:1.7">🚀 ${wpnLines.join(' · ')}</div>` : ''}
      ${capLines.length ? `<div class="u-hint" style="color:var(--text-dim);font-size:0.67rem;line-height:1.7">⚙ ${capLines.join(' · ')}</div>` : ''}
      ${comp ? `<div class="u-hint" style="color:var(--dim);font-size:0.67rem;line-height:1.5">${comp}</div>` : ''}
      ${groupHint}
      ${pathHint}
      ${atkHexes.length ? '<div class="u-hint">Clique em alvos vermelhos p/ declarar ataque</div>' : ''}
      ${myAtks.length ? buildAtkListHtml(myAtks) : ''}
      ${cardThumb}
    `;
  } else {
    unitPanel.innerHTML = '<p class="no-sel">Clique em uma unidade sua</p>';
  }
  logEl.innerHTML = (log && log.length)
    ? log.map(l=>`<p>${l}</p>`).join('')
    : '<p class="no-sel no-log">Nenhum evento registrado ainda</p>';

  // Show/hide game-level buttons
  const inGame = !winner;
  exportLogBtn.classList.toggle('hidden', !gameState);
  exportFullLogBtn.classList.toggle('hidden', !gameState || !currentRoomId);
  abandonBtn.classList.toggle('hidden', !inGame);

  updateObjectives();
}

// ─── Objectives panel ─────────────────────────────────────────────────────────
function updateObjectives() {
  if (!gameState?.objectives) {
    objectivesContent.innerHTML = '<p class="no-sel">Aguardando início...</p>';
    return;
  }
  const obj    = gameState.objectives;
  const isBlue = myTeam === 'blue';
  const mine   = isBlue ? obj.blue : obj.red;
  const theirs = isBlue ? obj.red  : obj.blue;
  const myColor  = isBlue ? '#82b1ff' : '#ff8a80';
  const oppColor = isBlue ? '#ff8a80' : '#82b1ff';

  const condRows = mine.conditions.map(c => `
    <div class="obj-row ${c.met ? 'obj-met' : 'obj-unmet'}">
      <span class="obj-check">${c.met ? '✓' : '○'}</span>
      <span class="obj-label">${c.label}</span>
      <span class="obj-prog">${c.current}</span>
    </div>`).join('');

  const oppRows = theirs.conditions.map(c => `
    <div class="obj-row obj-opp ${c.met ? 'obj-met' : 'obj-unmet'}">
      <span class="obj-check">${c.met ? '✓' : '○'}</span>
      <span class="obj-label">${c.label}</span>
      <span class="obj-prog">${c.current}</span>
    </div>`).join('');

  const myNeeded  = mine.needed;
  const myAch     = mine.achieved;
  const oppNeeded = theirs.needed;
  const oppAch    = theirs.achieved;

  objectivesContent.innerHTML = `
    <div class="obj-section">
      <div class="obj-section-title" style="color:${myColor}">SEUS OBJETIVOS</div>
      <div class="obj-summary ${myAch >= myNeeded ? 'obj-complete' : ''}">
        ${myAch >= myNeeded
          ? '🏆 CONDIÇÃO ATINGIDA!'
          : `${myAch}/${mine.conditions.length} condições · precisa de ${myNeeded}`}
      </div>
      ${condRows}
    </div>
    <div class="obj-divider"></div>
    <div class="obj-section">
      <div class="obj-section-title" style="color:${oppColor}">OBJ. ADVERSÁRIO</div>
      <div class="obj-summary ${oppAch >= oppNeeded ? 'obj-complete' : ''}">
        ${oppAch >= oppNeeded
          ? '⚠ ADVERSÁRIO ATINGIU OBJETIVO!'
          : `${oppAch}/${theirs.conditions.length} condições · precisa de ${oppNeeded}`}
      </div>
      ${oppRows}
    </div>`;
}

// ─── Victory screen objectives ────────────────────────────────────────────────
function renderOverObjectives(objectives, winner, reason) {
  if (!objectives || reason === 'abandon') { $('over-objectives').innerHTML = ''; return; }
  const winnerObj = winner === 'blue' ? objectives.blue : objectives.red;
  const rows = winnerObj.conditions.map(c =>
    `<div class="over-cond ${c.met ? 'over-cond-met' : 'over-cond-unmet'}">
      ${c.met ? '✓' : '○'} ${c.label}
      <span class="over-cond-prog">${c.current}</span>
    </div>`
  ).join('');
  const label = winner === 'blue' ? 'Força Azul' : 'Força Vermelha';
  $('over-objectives').innerHTML = `
    <div class="over-obj-title">${label} — condições atendidas (${winnerObj.achieved}/${winnerObj.conditions.length}):</div>
    ${rows}`;
}

// ─── Export log ───────────────────────────────────────────────────────────────
function exportLog() {
  if (!gameState) return;
  const teamLabel = myTeam === 'blue' ? 'Força Azul' : 'Força Vermelha';
  const lines = [
    '══════════════════════════════════════════════',
    '       OPERAÇÃO ATLÂNTICO SUL — LOG DE JOGO  ',
    '══════════════════════════════════════════════',
    `Equipe:   ${teamLabel}`,
    `Turno:    ${gameState.turn}`,
    `Período:  ${gameState.period === 'day' ? 'Diurno' : 'Noturno'}`,
    `Exportado: ${new Date().toLocaleString('pt-BR')}`,
    '',
    '── REGISTRO DE BATALHA ──────────────────────',
    ...(gameState.log || []).map(l => l.replace(/<[^>]+>/g, '')),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `oas_log_T${gameState.turn}_${Date.now()}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Exporta o log completo da partida (.jsonl com estado inicial, movimentos,
// ataques, engajamentos e estado final), gerado pelo game_logger no servidor.
async function exportFullLog() {
  if (!currentRoomId) { alert('ID da partida não disponível para exportação completa.'); return; }
  try {
    const res = await fetch(`/api/export-logs/${currentRoomId}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || 'Não foi possível exportar o log completo desta partida.');
      return;
    }
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `game_${currentRoomId}.jsonl`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (e) {
    alert('Erro ao exportar log completo: ' + e.message);
  }
}

// ═══ RENDERING ════════════════════════════════════════════════════════════════
function render() {
  if (!gameState) return;
  ctx.clearRect(0, 0, CVS_W, CVS_H);

  ctx.save();
  ctx.translate(panX, panY);
  ctx.scale(zoom, zoom);

  drawBackground();
  drawHighlights();
  drawGrid();
  drawInfrastructure();
  drawUnits();
  drawUnitFlashes();
  drawCoordLabels();
  if (hoverHex) drawHover();

  ctx.restore();

  // Scene-level overlay drawn WITHOUT zoom transform
  drawSceneFlash();
}

function drawUnitFlashes() {
  const now = performance.now();
  for (const [id, f] of unitFlashes) {
    const t = Math.max(0, 1 - (now - f.startTime) / f.duration);
    if (t <= 0) continue;
    const unit = gameState.units.find(u => u.id === id);
    if (!unit) continue;
    const {x, y} = hexToPixel(unit.col, unit.row);
    const R = HEX_R * 0.50;
    ctx.save();
    ctx.globalAlpha  = t * 0.85;
    ctx.shadowColor  = f.color;
    ctx.shadowBlur   = 22 * t;
    ctx.strokeStyle  = f.color;
    ctx.lineWidth    = 2.5;
    roundRect(ctx, x - R, y - R * 0.72, R * 2, R * 1.44, 4);
    ctx.stroke();
    ctx.restore();
  }
}

function drawSceneFlash() {
  if (!sceneFlash) return;
  const now = performance.now();
  const t   = Math.max(0, 1 - (now - sceneFlash.startTime) / sceneFlash.duration);
  if (t <= 0) return;
  // Fade in fast, hold, then fade out
  const a = t < 0.2 ? t / 0.2 : t > 0.7 ? (1 - t) / 0.3 : 1;
  ctx.save();
  ctx.globalAlpha = a * 0.72;
  ctx.fillStyle   = sceneFlash.color;
  ctx.fillRect(0, 0, CVS_W, CVS_H);
  ctx.globalAlpha = a;
  ctx.fillStyle   = '#fff';
  ctx.font        = `bold ${Math.round(CVS_W * 0.034)}px 'Courier New', monospace`;
  ctx.textAlign   = 'center';
  ctx.textBaseline= 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.9)';
  ctx.shadowBlur  = 18;
  ctx.fillText(sceneFlash.text, CVS_W / 2, CVS_H / 2);
  ctx.restore();
}

// ── Layer 1: Background ───────────────────────────────────────────────────────
function drawBackground() {
  if (mapReady) {
    ctx.drawImage(mapImg, 0, 0, CVS_W, CVS_H);
  } else {
    const g = ctx.createLinearGradient(0, 0, CVS_W, CVS_H);
    g.addColorStop(0.0, '#0d2a45');
    g.addColorStop(0.2, '#0a2238');
    g.addColorStop(1.0, '#071520');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, CVS_W, CVS_H);
  }
}

// ── Layer 3: Highlights ───────────────────────────────────────────────────────
function drawHighlights() {
  // Other units' planned paths (blue tint)
  for (const [unitId, path] of plannedMoves) {
    if (unitId === selUnitId) continue;
    drawPathTrail(path,
      'rgba(100,180,255,0.18)', 'rgba(100,180,255,0.55)',
      'rgba(100,180,255,0.35)', 'rgba(100,180,255,0.85)');
  }
  // Active path (yellow)
  if (selUnitId !== null && activePath.length > 1) {
    drawPathTrail(activePath,
      'rgba(255,220,0,0.20)', 'rgba(255,220,0,0.65)',
      'rgba(255,220,0,0.40)', 'rgba(255,220,0,0.95)');
  }
  // Full reachable range (dim green) — clicking auto-routes to the hex
  for (const h of reachableHexes.values()) {
    if (h.dist === 1) continue; // adjacent ring drawn brighter below
    const {x, y} = hexToPixel(h.col, h.row);
    drawHex(ctx, x, y, 'rgba(0,230,118,0.09)', 'rgba(0,230,118,0.30)', 1.0);
  }
  // Valid next steps (green)
  for (const h of moveHexes) {
    const {x, y} = hexToPixel(h.col, h.row);
    drawHex(ctx, x, y, 'rgba(0,230,118,0.22)', 'rgba(0,230,118,0.70)', 1.8);
  }
  // Attack hexes (red + diagonal hatch — shape cue for colorblind players)
  for (const h of atkHexes) {
    const {x, y} = hexToPixel(h.col, h.row);
    const declared = pendingAtks.some(a => a.targetId === h.unitId);
    drawHex(ctx, x, y,
      declared ? 'rgba(255,60,60,0.50)'  : 'rgba(255,60,60,0.22)',
      declared ? 'rgba(255,120,120,1.0)' : 'rgba(255,80,80,0.75)', 2.0);
    drawHexHatch(x, y, declared ? 'rgba(255,150,150,0.55)' : 'rgba(255,90,90,0.35)');
  }
}

// Hachura diagonal recortada ao hex — alvos de ataque distinguem-se dos hexes
// de movimento (lisos) pela textura, não só pela cor.
function drawHexHatch(cx, cy, color, lw = 1.2) {
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a  = (Math.PI / 3) * i;
    const vx = cx + HEX_R * Math.cos(a);
    const vy = cy + HEX_R * Math.sin(a);
    if (i === 0) ctx.moveTo(vx, vy); else ctx.lineTo(vx, vy);
  }
  ctx.closePath();
  ctx.clip();
  ctx.strokeStyle = color;
  ctx.lineWidth   = lw;
  ctx.beginPath();
  for (let d = -2 * HEX_R; d <= 2 * HEX_R; d += 14) {
    ctx.moveTo(cx + d - HEX_R, cy - HEX_R);
    ctx.lineTo(cx + d + HEX_R, cy + HEX_R);
  }
  ctx.stroke();
  ctx.restore();
}

// Draw a step-numbered path trail (skips index 0 = starting hex)
function drawPathTrail(path, fillMid, strokeMid, fillLast, strokeLast) {
  for (let i = 1; i < path.length; i++) {
    const {col, row} = path[i];
    const {x, y}     = hexToPixel(col, row);
    const isLast     = i === path.length - 1;
    drawHex(ctx, x, y,
      isLast ? fillLast  : fillMid,
      isLast ? strokeLast : strokeMid,
      isLast ? 2.2 : 1.6);
    ctx.save();
    ctx.fillStyle    = 'rgba(255,255,255,0.92)';
    ctx.font         = `bold ${Math.round(HEX_R * 0.30)}px sans-serif`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor  = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur   = 3;
    ctx.fillText(String(i), x, y);
    ctx.restore();
  }
}

// ── Layer 4: Hex grid ─────────────────────────────────────────────────────────
function drawGrid() {
  for (let r = 0; r < GRID_H; r++) {
    for (let c = 0; c < GRID_W; c++) {
      const t = TERRAIN_MAP[r][c];
      const {x, y} = hexToPixel(c, r);
      drawHex(ctx, x, y, null, T_BORDER[t], 0.8);
    }
  }
}

// ── Layer 5: Infrastructure ───────────────────────────────────────────────────
const INFRA_COLORS = { naval:'#82b1ff', port:'#80cbc4', aero:'#b0bec5', oil:'#ffcc02' };

function drawInfrastructure() {
  for (const inf of INFRA) {
    const {x, y} = hexToPixel(inf.col, inf.row);
    const col = INFRA_COLORS[inf.type] || '#fff';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur  = 4;
    ctx.fillStyle   = col;
    ctx.font        = `bold ${Math.round(HEX_R * 0.38)}px sans-serif`;
    ctx.textAlign   = 'center';
    ctx.textBaseline= 'middle';
    ctx.fillText(inf.label, x, y - HEX_R * 0.1);
    ctx.shadowBlur  = 0;
    ctx.fillStyle   = 'rgba(255,255,200,0.7)';
    ctx.font        = `${Math.round(HEX_R * 0.2)}px 'Courier New', monospace`;
    ctx.fillText(inf.name, x, y + HEX_R * 0.38);
  }
}

// ── Layer 6: Units ────────────────────────────────────────────────────────────
function drawUnits() {
  if (!gameState) return;

  // Ghost units at planned destinations (semi-transparent)
  for (const [unitId, path] of plannedMoves) {
    if (path.length <= 1) continue;
    const unit = gameState.units.find(u => u.id === unitId && u.hp > 0);
    if (!unit) continue;
    const dest = path[path.length - 1];
    const {x, y} = hexToPixel(dest.col, dest.row);
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.arc(x, y, HEX_R * 0.58, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fill();
    drawUnitCounter(ctx, unit, x, y, false);
    ctx.restore();
  }
  // Ghost for the currently-being-traced path (if not yet saved)
  if (selUnitId !== null && activePath.length > 1) {
    const unit = gameState.units.find(u => u.id === selUnitId && u.hp > 0);
    if (unit) {
      const dest = activePath[activePath.length - 1];
      const {x, y} = hexToPixel(dest.col, dest.row);
      ctx.save();
      ctx.globalAlpha = 0.40;
      ctx.beginPath();
      ctx.arc(x, y, HEX_R * 0.58, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fill();
      drawUnitCounter(ctx, unit, x, y, false);
      ctx.restore();
    }
  }

  // Actual units at current (server-confirmed) positions
  for (const u of gameState.units) {
    if (u.hp <= 0) continue;
    const {x, y} = hexToPixel(u.col, u.row);
    ctx.beginPath();
    ctx.arc(x, y, HEX_R * 0.58, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fill();
    const isSelected = u.id === selUnitId || selGroupIds.includes(u.id);
    drawUnitCounter(ctx, u, x, y, isSelected);
  }

  // Stack count badges (shown on hexes with 2+ alive units)
  const hexStacks = {};
  for (const u of gameState.units) {
    if (u.hp <= 0) continue;
    const k = `${u.col},${u.row}`;
    if (!hexStacks[k]) hexStacks[k] = {col: u.col, row: u.row, count: 0};
    hexStacks[k].count++;
  }
  for (const {col, row, count} of Object.values(hexStacks)) {
    if (count < 2) continue;
    const {x, y} = hexToPixel(col, row);
    const r  = HEX_R * 0.22;
    const bx = x + HEX_R * 0.38;
    const by = y - HEX_R * 0.38;
    ctx.beginPath();
    ctx.arc(bx, by, r, 0, Math.PI * 2);
    ctx.fillStyle   = 'rgba(255,200,0,0.92)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth   = 1;
    ctx.stroke();
    ctx.fillStyle   = '#000';
    ctx.font        = `bold ${Math.round(r * 1.3)}px sans-serif`;
    ctx.textAlign   = 'center';
    ctx.textBaseline= 'middle';
    ctx.fillText(String(count), bx, by);
  }
}

// ── Layer 7: Coordinate labels ────────────────────────────────────────────────
function drawCoordLabels() {
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur  = 3;
  const fs        = Math.round(HEX_R * 0.27);
  ctx.fillStyle   = 'rgba(200,220,240,0.55)';
  ctx.font        = `${fs}px 'Courier New', monospace`;

  ctx.textAlign    = 'center';
  ctx.textBaseline = 'top';
  for (let c = 0; c < GRID_W; c++) {
    const {x} = hexToPixel(c, 0);
    ctx.fillText(hexLabel(c), x, OY / 2 - 6);
  }
  ctx.textAlign    = 'right';
  ctx.textBaseline = 'middle';
  for (let r = 0; r < GRID_H; r++) {
    const {y} = hexToPixel(0, r);
    ctx.fillText(r + 1, OX - 6, y);
  }
  ctx.shadowBlur = 0;
}

// ── Layer 8: Hover ────────────────────────────────────────────────────────────
function drawHover() {
  const {col, row} = hoverHex;
  if (col < 0 || col >= GRID_W || row < 0 || row >= GRID_H) return;
  const {x, y} = hexToPixel(col, row);
  drawHex(ctx, x, y, 'rgba(255,255,255,0.08)', 'rgba(255,255,255,0.35)', 1.2);
}

// ─── Utility ──────────────────────────────────────────────────────────────────
function flashError(msg) {
  const el = $('error-flash');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(flashError._t);
  flashError._t = setTimeout(() => el.classList.add('hidden'), 3500);
}
function showLobbyErr(msg) {
  lobbyErr.textContent = msg;
  lobbyErr.classList.remove('hidden');
  setTimeout(() => lobbyErr.classList.add('hidden'), 4000);
}

// ─── Battle Round Panel ───────────────────────────────────────────────────────
let brDecisionMade = false;
let brQueue = [];  // buffer for back-to-back mustDecide:false events

function closeBrPanel() {
  $('br-panel').classList.add('hidden');
  brDecisionMade = false;
  brQueue = [];
}

// Advance to next queued result, or close the panel when the queue is empty
function onBrOk() {
  if (brQueue.length > 0) {
    renderBrPanel(brQueue.shift());
  } else {
    closeBrPanel();
  }
}

// Enqueue result; show immediately if panel is hidden or in "waiting" state
function handleBrResult(data) {
  brQueue.push(data);
  const panelHidden = $('br-panel').classList.contains('hidden');
  const isWaiting   = !$('br-waiting').classList.contains('hidden');
  if (panelHidden || isWaiting) {
    renderBrPanel(brQueue.shift());
  }
}

function sendBrDecision(decision) {
  if (brDecisionMade) return;
  brDecisionMade = true;
  socket.emit('battle_round_decision', { decision });
  // Show waiting state while opponent decides
  $('br-decision').classList.add('hidden');
  $('br-waiting').classList.remove('hidden');
  const chosen = decision === 'continue' ? 'Você escolheu CONTINUAR.' : 'Você escolheu PARAR.';
  $('br-panel-body').insertAdjacentHTML('beforeend',
    `<div class="br-row br-decision-made">${chosen}</div>`);
}

function buildResultHtml(eng) {
  if (!eng) return '';
  if (!eng.ok) {
    return `<div class="br-row br-miss">⚠ ${eng.reason || 'Sem armamento válido.'}</div>`;
  }

  const intStr = eng.interception?.intercepted > 0
    ? `<span class="br-int"> [${eng.interception.intercepted} intercept.]</span>` : '';
  const wpnTag = eng.weaponLabel ? `<span class="br-wpn">[${eng.weaponLabel}]</span> ` : '';

  const rollsDesc = (eng.attackRolls || []).map(r => {
    if (r.reroll != null) return `d6=${r.roll}→${r.reroll}(${r.damage}SP)`;
    return `d6=${r.roll}(${r.damage}SP)`;
  }).join('  ') || '—';

  const advTag = eng.advantage ? '<span class="br-adv"> ★iniciativa</span>' : '';

  let cls, icon, detail;
  if (eng.destroyed) {
    cls = 'br-destroyed'; icon = '💥';
    detail = `−${eng.totalDamage}SP <strong>DESTRUÍDO!</strong>`;
  } else if (eng.totalDamage > 0) {
    cls = 'br-hit'; icon = '✓';
    detail = `−${eng.totalDamage}SP  (restante: ${eng.remainingHp}SP)`;
    if (eng.degradation) detail += `<div class="br-degrad">↘ Capacidade degradada: ${eng.degradation}</div>`;
  } else {
    cls = 'br-miss'; icon = '✗';
    detail = `sem dano  (restante: ${eng.remainingHp}SP)`;
  }

  return `
    <div class="br-row ${cls}">
      ${icon} ${wpnTag}${advTag}
      <span class="br-launched">Lançados: ${eng.launched}</span>${intStr}
      <span class="br-impacts"> Impactos: ${eng.effectiveShots}</span>
      <div class="br-detail">${detail}</div>
      <div class="br-rolls">${rollsDesc}</div>
    </div>`;
}

function renderBrPanel({ engagement, result, mustDecide, decisions, initiativeBonusTeam, counterResults }) {
  brDecisionMade = false;

  const brLabel = `${engagement.id} · Rodada de Combate ${engagement.battleRound}`;
  const singleRound = engagement.maxBattleRounds === 1;

  $('br-panel-header').textContent = `── ${brLabel} ──`;

  let html = '';

  // Show attacker/target info
  const att = gameState?.units.find(u => u.id === engagement.attackerId);
  const def = gameState?.units.find(u => u.id === engagement.targetId);
  const attName = att?.name || engagement.attackerId;
  const defName = def?.name || engagement.targetId;
  const attCls  = att?.team === 'blue' ? 'cm-blue' : 'cm-red';
  const defCls  = def?.team === 'blue' ? 'cm-blue' : 'cm-red';

  html += `<div class="br-combatants">
    <span class="${attCls}">${attName}</span>
    <span class="br-arrow"> → </span>
    <span class="${defCls}">${defName}</span>
    <span class="br-wpn-tag"> [${engagement.weaponType.toUpperCase()}]</span>
  </div>`;

  if (singleRound) {
    html += `<div class="br-single-label">Arma estratégica — rodada única</div>`;
  }

  if (initiativeBonusTeam) {
    const bonusTeamLabel = initiativeBonusTeam === myTeam ? 'SUA FORÇA' : 'FORÇA ADVERSÁRIA';
    html += `<div class="br-init-bonus">★ Bônus de iniciativa: ${bonusTeamLabel} (2d6, maior valor)</div>`;
  }

  // Result block
  if (result === null && decisions) {
    const blueDecided = decisions.blue === 'stop' ? 'PAROU' : 'CONTINUOU';
    const redDecided  = decisions.red  === 'stop' ? 'PAROU' : 'CONTINUOU';
    html += `<div class="br-row br-decision-summary">
      Azul: ${blueDecided} · Vermelho: ${redDecided} — combate encerrado.
    </div>`;
  } else if (result === null) {
    html += `<div class="br-row br-miss">⚠ Unidade já destruída — engajamento cancelado.</div>`;
  } else {
    html += buildResultHtml(result);
  }

  // Counter-attack block (BR#2 only) — the defending stack fires back as a
  // group, so several contributors may appear.
  const counters = counterResults || [];
  if (counters.length) {
    const grpLabel = counters.length > 1 ? ' em grupo' : '';
    html += `<div class="br-counter-header">── Contrataque${grpLabel} ──</div>`;
    for (const cr of counters) {
      const cAtt = gameState?.units.find(u => u.id === cr.attackerId);
      const cDef = gameState?.units.find(u => u.id === cr.defenderId);
      const cAttName = cAtt?.name || cr.attackerId;
      const cDefName = cDef?.name || cr.defenderId;
      const cAttCls  = cAtt?.team === 'blue' ? 'cm-blue' : 'cm-red';
      const cDefCls  = cDef?.team === 'blue' ? 'cm-blue' : 'cm-red';

      html += `<div class="br-combatants">
        <span class="${cAttCls}">${cAttName}</span>
        <span class="br-arrow"> ↩ </span>
        <span class="${cDefCls}">${cDefName}</span>
        <span class="br-wpn-tag"> [${(cr.weaponType || '').toUpperCase()}]</span>
      </div>`;
      if (cr.advantage) {
        const cBonusLabel = cAtt?.team === myTeam ? 'SUA FORÇA' : 'FORÇA ADVERSÁRIA';
        html += `<div class="br-init-bonus">★ Bônus de iniciativa: ${cBonusLabel} (2d6, maior valor)</div>`;
      }
      html += buildResultHtml(cr);
    }
  }

  $('br-panel-body').innerHTML = html;

  // Decision / OK UI
  const decisionEl = $('br-decision');
  const waitingEl  = $('br-waiting');
  const okAreaEl   = $('br-ok-area');
  decisionEl.classList.add('hidden');
  waitingEl.classList.add('hidden');
  okAreaEl.classList.add('hidden');

  if (mustDecide && !singleRound && !result?.destroyed) {
    decisionEl.classList.remove('hidden');        // show CONTINUAR / PARAR
  } else {
    const label = brQueue.length > 0 ? 'Próximo ▶' : 'OK ✓';
    $('br-btn-ok').textContent = label;
    okAreaEl.classList.remove('hidden');          // show OK / Próximo
  }

  $('br-panel').classList.remove('hidden');
}

