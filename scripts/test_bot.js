'use strict';
// Testes do bot heurístico do modo solo. Uso: node scripts/test_bot.js
// Sai com código != 0 se qualquer assert falhar.
const srv = require('../server');
const {
  newGame, computeObjectives, OBJECTIVE_IDS, OBJECTIVE_THRESHOLDS, objectiveProgress,
  BOT_TUNING,
  computeBotMoves, computeBotAttacks, applyBotMovesToState,
  botObjectiveWeights, botPickTarget, botNeedsRefuel, botRefuelProvider,
  botMoveAway, botBattleRoundDecision, buildCombatQueue,
  resolveBattleRound, resolveCounterAttacks, nextTurn, checkWinner, MAX_TURNS,
} = srv;

let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? '✅' : '❌'} ${name}${ok || !detail ? '' : ' — ' + detail}`);
  if (!ok) failures++;
}
const byId = (state, id) => state.units.find(u => u.id === id);
const dist = (a, b) => {
  const cube = (c, r) => { const x = c, z = r - (c - (c & 1)) / 2; return { x, z }; };
  const p = cube(a.col, a.row), q = cube(b.col, b.row);
  return Math.max(Math.abs(p.x - q.x), Math.abs(p.z - q.z),
    Math.abs((-p.x - p.z) - (-q.x - q.z)));
};

// Espelho do terreno p/ validar legalidade dos caminhos (igual a server.js)
const TERRAIN = [
  [0,1,1,2,2,2,2,3,3,3,3,3,3,3,3,3,3,3,3,3],
  [0,1,2,2,2,2,2,3,3,3,3,3,3,3,3,3,3,3,3,3],
  [0,0,1,2,2,2,2,2,2,2,3,3,3,3,3,3,3,3,3,3],
  [0,1,1,2,2,2,2,2,2,2,2,2,3,2,3,3,3,3,3,3],
  [0,1,2,2,2,2,2,1,2,2,2,2,2,2,2,2,2,3,3,3],
  [0,1,2,2,2,1,1,2,2,2,2,3,2,3,2,3,2,3,3,3],
  [0,1,2,2,2,2,2,2,2,2,2,2,3,3,2,2,3,3,3,3],
  [1,0,1,1,2,2,2,2,2,3,3,3,3,3,3,3,2,2,1,1],
  [1,1,0,2,1,3,3,3,3,3,3,3,3,3,3,3,3,3,2,1],
  [3,3,1,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3],
];
function canEnter(category, col, row) {
  if (col < 0 || col > 19 || row < 0 || row > 9) return false;
  const t = TERRAIN[row][col];
  if (category === 'air' || category === 'specops') return true;
  if (category === 'land')      return t === 0 || t === 1;
  if (category === 'submarine') return t !== 0 && t !== 1;
  return t !== 0;
}
// Valida um caminho como o commit_moves humano validaria
function pathLegal(state, unitId, path) {
  const u = byId(state, unitId);
  if (!u) return `unidade ${unitId} não existe`;
  if (path[0].col !== u.col || path[0].row !== u.row) return 'não começa na unidade';
  const maxRange = u.category === 'air'
    ? Math.floor((u.fuel?.current ?? u.movement) / 2) : u.movement;
  if (path.length - 1 > maxRange) return `excede alcance (${path.length - 1} > ${maxRange})`;
  for (let i = 1; i < path.length; i++) {
    if (dist(path[i - 1], path[i]) !== 1) return `passo ${i} não adjacente`;
    if (!canEnter(u.category, path[i].col, path[i].row)) return `terreno ilegal em ${i}`;
  }
  return null;
}

// ── 1. Legalidade de todos os caminhos gerados (os dois times, vários estados) ──
{
  for (const mut of [0, 1, 2]) {
    const s = newGame();
    if (mut === 1) { // frotas avançadas
      byId(s, 'RED-SCR-1').col = 9; byId(s, 'RED-SCR-2').col = 10;
      byId(s, 'BLUE-VM').col = 7; byId(s, 'BLUE-VM').row = 3;
    }
    if (mut === 2) { // combustíveis baixos
      for (const u of s.units) if (u.fuel?.fuelType === 'naval') u.fuel.current = 3;
    }
    let bad = 0;
    for (const team of ['blue', 'red']) {
      for (const { unitId, path } of computeBotMoves(s, team)) {
        const err = pathLegal(s, unitId, path);
        if (err) { bad++; console.log(`   caminho ilegal [${team}/${unitId}]: ${err}`); }
      }
    }
    check(`caminhos legais (estado ${mut})`, bad === 0);
  }
}

// ── 2. Vermelho prioriza guarnição (objetivo) sobre cargueiro equidistante ─────
// botPickTarget ordena TODOS os alvos "atacáveis por tipo de arma" por peso de
// objetivo, não só os próximos — usa um alvo fora de qualquer lista de
// objetivo (cargueiro) e mesma prioridade genérica (5, "outros") que a
// guarnição, para isolar o efeito do peso puro sem interferência de
// desempate por tipo de plataforma.
{
  const s = newGame();
  const att   = byId(s, 'RED-SCR-1');
  const garr  = byId(s, 'BLUE-GARR-STANLEY');
  const cargo = byId(s, 'BLUE-CARGO');
  // neutraliza os outros alvos do objetivo "airsup" (peso 0, prioridade
  // genérica mais alta que garr) para não interferirem no desempate
  for (const id of OBJECTIVE_IDS.redTargets.airsup) byId(s, id).hp = 0;
  for (const u of s.units) {
    if (u.team === 'blue' && u.id !== garr.id && u.id !== cargo.id) { u.col = 19; u.row = 9; }
  }
  att.col = 9; att.row = 4;
  garr.col  = att.col + 1; garr.row  = att.row;   // dist 1
  cargo.col = att.col - 1; cargo.row = att.row;   // dist 1
  const w = botObjectiveWeights(s, 'red');
  const tgt = botPickTarget(att, s.units.filter(u => u.team === 'blue' && u.hp > 0), w);
  check('vermelho prefere guarnição a cargueiro equidistante', tgt?.id === 'BLUE-GARR-STANLEY', `escolheu ${tgt?.id}`);
}

// ── 3. Azul prioriza alvos de objetivo ────────────────────────────────────────
{
  const s = newGame();
  const w = botObjectiveWeights(s, 'blue');
  const T = OBJECTIVE_IDS.blueTargets;
  check('pesos azuis cobrem carrier/logística/anfíbio/sub',
    w.get(T.carrier) === 0 && T.logistics.every(id => w.get(id) === 0) &&
    T.amphib.every(id => w.get(id) === 0) && w.get(T.nucsub) === 0);
}

// ── 4. Re-tarefa após objetivo cumprido ───────────────────────────────────────
{
  const s = newGame();
  OBJECTIVE_IDS.redTargets.airsup.forEach(id => { byId(s, id).hp = 0; });
  const w = botObjectiveWeights(s, 'red');
  const onlyGarrison = OBJECTIVE_IDS.redTargets.garrison.every(id => w.get(id) === 0) &&
                        OBJECTIVE_IDS.redTargets.airsup.every(id => !w.has(id));
  check('Presença aérea/naval local destruída → pesos vermelhos só contêm guarnição', onlyGarrison);
}

// ── 5. Override de oportunidade: combatente colado vence objetivo distante ────
{
  const s = newGame();
  const att  = byId(s, 'RED-SCR-1');
  const frig = s.units.find(u => u.team === 'blue' && ['fragata','destroier','corveta','cruzador'].includes(u.type));
  const garr = byId(s, 'BLUE-GARR-STANLEY');
  // afasta outros combatentes/anfíbios azuis (prioridade de oportunidade) do raio
  for (const u of s.units) {
    if (u.team === 'blue' && u.id !== frig.id && u.id !== garr.id &&
        ['carrier','amphib','fragata','destroier','corveta','cruzador'].includes(u.type)) {
      u.col = 19; u.row = 9;
    }
  }
  att.col = 10; att.row = 4;
  frig.col = 11; frig.row = 4;          // dist 1 — colado
  // Guarnição (objetivo) fica onde está (longe)
  const w = botObjectiveWeights(s, 'red');
  const tgt = botPickTarget(att, s.units.filter(u => u.team === 'blue' && u.hp > 0), w);
  check('combatente a dist 1 vence guarnição distante', tgt?.id === frig.id, `escolheu ${tgt?.id} (frig=${frig.id}, garr=${garr.id})`);
}

// ── 6. Combustível: baixo FP → rota ao provedor; empilhado → não move ─────────
{
  const s = newGame();
  const u = byId(s, 'RED-ESC-2');
  const prov = botRefuelProvider(u, s);
  check('provedor encontrado p/ RED-ESC-2', !!prov, 'nenhum');
  u.fuel.current = 3;
  check('3 FP → precisa reabastecer', botNeedsRefuel(u, prov) === true);
  const moves = computeBotMoves(s, 'red');
  const mv = moves.find(m => m.unitId === u.id);
  if (mv) {
    const before = dist(u, prov);
    const after  = dist(mv.path[mv.path.length - 1], prov);
    check('movimento aproxima do provedor', after < before, `dist ${before}→${after}`);
  } else {
    check('movimento aproxima do provedor', dist(u, prov) === 0, 'sem movimento e não empilhado');
  }
  // empilhado: não deve mover
  u.col = prov.col; u.row = prov.row; u.moved = false;
  const again = computeBotMoves(s, 'red').find(m => m.unitId === u.id);
  check('empilhado com provedor → não move', !again);
}

// ── 7. Provedor de reabastecimento sempre fica em terreno que a unidade alcança ─
{
  const s = newGame();
  const sub = s.units.find(u => u.team === 'blue' && u.category === 'submarine' && u.fuel?.fuelType === 'naval');
  if (sub) {
    const p = botRefuelProvider(sub, s);
    const t = p ? TERRAIN[p.row][p.col] : null;
    check('provedor de submarino não fica em raso/terra', !p || (t !== 0 && t !== 1), p ? `${p.id} t=${t}` : '');
  } else check('provedor de submarino não fica em raso/terra', true, '(sem sub convencional azul)');
  const ship = s.units.find(u => u.team === 'blue' && u.category === 'surface');
  const p2 = botRefuelProvider(ship, s);
  const t2 = p2 ? TERRAIN[p2.row][p2.col] : null;
  check('provedor de navio nunca fica em terra', !p2 || t2 !== 0, p2 ? `${p2.id} t=${t2}` : '');
}

// ── 8. Logística ameaçada foge + ganha escolta ────────────────────────────────
{
  const s = newGame();
  const aor = byId(s, 'RED-LOG-1');
  const foe = s.units.find(u => u.team === 'blue' && ['fragata','destroier','corveta','cruzador'].includes(u.type));
  foe.col = aor.col - 2; foe.row = aor.row; // ameaça a dist 2
  const moves = computeBotMoves(s, 'red');
  const flee = moves.find(m => m.unitId === aor.id);
  if (flee) {
    const d0 = dist(aor, foe);
    const d1 = dist(flee.path[flee.path.length - 1], foe);
    check('AOR ameaçado afasta-se da ameaça', d1 > d0, `dist ${d0}→${d1}`);
  } else check('AOR ameaçado afasta-se da ameaça', false, 'não moveu');
  // exatamente 1 escolta termina a <= 1 hex do destino do tanque
  const dest = flee ? flee.path[flee.path.length - 1] : { col: aor.col, row: aor.row };
  const combatants = s.units.filter(u => u.team === 'red' && u.category === 'surface' &&
    ['fragata','destroier','corveta','cruzador','carrier','amphib'].includes(u.type));
  const escorts = moves.filter(m => combatants.some(c => c.id === m.unitId) &&
    dist(m.path[m.path.length - 1], dest) <= 1);
  const already = combatants.some(c => !moves.some(m => m.unitId === c.id) && dist(c, dest) <= 1);
  check('há escolta a <=1 hex do destino do tanque', escorts.length >= 1 || already,
    `escorts em movimento=${escorts.length}, parado próximo=${already}`);
}

// ── 9. Aeronave não decola sem alcançar posição de ataque ─────────────────────
{
  const s = newGame();
  const jet = s.units.find(u => u.team === 'blue' && u.category === 'air' && u.airStatus === 'ready');
  // inimigos todos muito longe: empurra todos os vermelhos para o canto
  for (const u of s.units) if (u.team === 'red') { u.col = 15; u.row = 9; }
  jet.fuel.current = 4; // alcance de voo 2
  const mv = computeBotMoves(s, 'blue').find(m => m.unitId === jet.id);
  check('caça com 2 hexes de voo não decola p/ alvo inalcançável', !mv, mv && `moveu ${mv.path.length - 1}`);
}

// ── 10. Specops do bot gera engajamento raid ──────────────────────────────────
{
  const s = newGame();
  const seop = s.units.find(u => u.category === 'specops' && u.team === 'red');
  const port = byId(s, 'BLUE-PORTO-RG');
  seop.col = port.col; seop.row = port.row; // dist 0 <= range 2
  const atks = computeBotAttacks(s, 'red').filter(a => a.attackerId === seop.id);
  check('specops do bot declara ataque', atks.length === 1);
  if (atks.length) {
    s.blueAttacks = []; s.redAttacks = atks;
    const q = buildCombatQueue(s);
    const eng = q.find(e => e.attackerId === seop.id);
    check('buildCombatQueue gera engajamento raid', eng?.weaponType === 'raid', `weapon=${eng?.weaponType}`);
  } else check('buildCombatQueue gera engajamento raid', false, 'sem ataque declarado');
}

// ── 11. Tabela-verdade da decisão de rodada ───────────────────────────────────
{
  const s = newGame();
  const att = byId(s, 'RED-ESC-1'); // possui arma 'ascm', usada pelo engajamento abaixo
  const def = s.units.find(u => u.team === 'blue' && u.category === 'surface' && u.weapons?.mss);
  def.col = att.col + 1; def.row = att.row;
  const eng = { attackerId: att.id, targetId: def.id, weaponType: 'ascm',
                targetCol: def.col, targetRow: def.row, targetTeam: 'blue', targetCategory: 'surface' };
  // atacante ferido (30%) vs alvo saudável → stop
  att.hp = Math.max(1, Math.floor(att.maxHp * 0.3)); def.hp = def.maxHp;
  check('atacante 30% vs alvo saudável → stop', botBattleRoundDecision(s, eng, 'red') === 'stop');
  // atacante ferido vs alvo a 1 SP → continue (finaliza)
  def.hp = 1;
  check('atacante 30% vs alvo a 1SP → continue', botBattleRoundDecision(s, eng, 'red') === 'continue');
  // atacante saudável → continue
  att.hp = att.maxHp; def.hp = def.maxHp;
  check('atacante saudável → continue', botBattleRoundDecision(s, eng, 'red') === 'continue');
  // sem munição → stop
  const savedW = JSON.parse(JSON.stringify(att.weapons));
  if (att.weapons?.ascm) att.weapons.ascm.quantity = 0;
  check('sem munição → stop', botBattleRoundDecision(s, eng, 'red') === 'stop');
  att.weapons = savedW;
  // defensor com contra-arma (MSS a dist 1) → continue
  check('defensor com contra-arma → continue', botBattleRoundDecision(s, eng, 'blue') === 'continue');
  // defensor sem contra-ataque possível (alvo = petroleiro desarmado isolado) → stop
  const oiler = byId(s, 'BLUE-LOG-1');
  const eng2 = { attackerId: att.id, targetId: oiler.id, weaponType: 'ascm',
                 targetCol: oiler.col, targetRow: oiler.row, targetTeam: 'blue', targetCategory: 'surface' };
  att.col = oiler.col + 3; att.row = oiler.row;
  check('defensor desarmado → stop', botBattleRoundDecision(s, eng2, 'blue') === 'stop');
}

// ── 12. computeObjectives estável no estado inicial ───────────────────────────
{
  const s = newGame();
  const o = computeObjectives(s);
  check('objetivos iniciais: azul 0/3, vermelho 0/3',
    o.blue.achieved === 0 && o.blue.needed === 3 && o.red.achieved === 0 && o.red.needed === 3);
}

// ── 12b. Limiares de vitória e progresso contínuo ─────────────────────────────
{
  const TH = OBJECTIVE_THRESHOLDS;
  const airsupIds   = OBJECTIVE_IDS.redTargets.airsup;
  const garrisonIds = OBJECTIVE_IDS.redTargets.garrison;
  const redCond = (s, id) => computeObjectives(s).red.conditions.find(c => c.id === id);
  const dealDamage = (s, ids, sp) => {
    let n = sp;
    for (const id of ids) {
      const p = byId(s, id);
      const d = Math.min(n, p.maxHp);
      p.hp = p.maxHp - d; n -= d;
      if (n <= 0) break;
    }
  };
  const dealGarrisonDamage = (s, sp) => dealDamage(s, garrisonIds, sp);

  check('limiar de guarnição é 40%', TH.redGarrisonDegPct === 40);
  check('limiar de presença aérea/naval local é 50%', TH.redAirSupDegPct === 50);
  check('nenhum objetivo vermelho mira o continente (RCE histórica)',
    !garrisonIds.some(id => id.includes('AERO')) && !airsupIds.some(id => id.includes('AERO')));

  // Presença aérea/naval local: fronteira exata em 9 SP de 17 (50%)
  let s = newGame();
  check('presença aérea/naval intacta → não cumprida', redCond(s, 'airsup').met === false);
  dealDamage(s, airsupIds, 8);
  check('presença a 8 SP (47%) → não cumprida', redCond(s, 'airsup').met === false,
    JSON.stringify(redCond(s, 'airsup').currentParams));
  s = newGame(); dealDamage(s, airsupIds, 9);
  check('presença a 9 SP (53%) → cumprida', redCond(s, 'airsup').met === true,
    JSON.stringify(redCond(s, 'airsup').currentParams));

  // Guarnição: fronteira exata em 12 SP de 29 (41%) — pool cresceu após o
  // ajuste de BLUE-GARR-GOOSE (6→12 SP) para bater com o OAF original.
  s = newGame(); dealGarrisonDamage(s, 11);
  check('guarnição a 11 SP (38%) → não cumprida', redCond(s, 'garrison').met === false,
    JSON.stringify(redCond(s, 'garrison').currentParams));
  s = newGame(); dealGarrisonDamage(s, 12);
  check('guarnição a 12 SP (41%) → cumprida', redCond(s, 'garrison').met === true,
    JSON.stringify(redCond(s, 'garrison').currentParams));

  // Rótulos (por código, i18n-friendly) derivados das constantes — não podem divergir da regra
  s = newGame();
  const o = computeObjectives(s);
  check('rótulo do objetivo aéreo é o código de degradação da presença local (Pucará/patrulhas/caça-minas)',
    o.red.conditions[0].labelCode === 'DEGRADE_AIRSUP',
    o.red.conditions[0].labelCode);
  check('rótulo do objetivo guarnição cita o limiar',
    o.red.conditions[1].labelCode === 'DEGRADE_GARRISON' && o.red.conditions[1].labelParams.pct === TH.redGarrisonDegPct,
    JSON.stringify(o.red.conditions[1].labelParams));

  // progress: 0..1, limitado a 1
  check('progress inicial é 0 nos dois lados',
    o.blue.conditions.every(c => c.progress === 0) &&
    o.red.conditions.every(c => c.progress === 0));
  s = newGame(); dealGarrisonDamage(s, 30);   // muito acima do limiar (garrMax=23)
  check('progress satura em 1', redCond(s, 'garrison').progress === 1);
  s = newGame();
  const carrier = byId(s, OBJECTIVE_IDS.blueTargets.carrier);
  carrier.hp = Math.ceil(carrier.maxHp / 2);
  const halfProg = computeObjectives(s).blue.conditions[0].progress;
  check('condição binária dá crédito parcial por dano',
    halfProg > 0.3 && halfProg < 0.7, `progress=${halfProg.toFixed(3)}`);

  // Adjudicação: dano acumulado abaixo do limiar deixa de valer zero.
  // Vermelho com guarnição a 31% e presença aérea/naval a 41% (quase lá nas
  // duas, mas nenhuma condição cumprida — e o 3º objetivo, desembarque, segue
  // em 0) contra Azul que só matou o sub nuclear (1 condição barata cumprida).
  // Precisa de progresso em 2 das 3 condições vermelhas porque uma só, sozinha,
  // não supera mais a média de 3 (era suficiente quando o vermelho precisava
  // de só 2 condições, antes do objetivo de desembarque).
  s = newGame();
  dealGarrisonDamage(s, 9);
  dealDamage(s, airsupIds, 7);
  byId(s, OBJECTIVE_IDS.blueTargets.nucsub).hp = 0;
  const o2 = computeObjectives(s);
  const bp = objectiveProgress(o2.blue), rp = objectiveProgress(o2.red);
  const oldWinner = (o2.red.achieved / o2.red.needed) > (o2.blue.achieved / o2.blue.needed) ? 'red' : 'blue';
  const newWinner = rp > bp ? 'red' : 'blue';
  check('adjudicação: dano acumulado vermelho passa a vencer contagem azul barata',
    oldWinner === 'blue' && newWinner === 'red',
    `antiga=${oldWinner} nova=${newWinner} (azul ${bp.toFixed(2)} vs verm ${rp.toFixed(2)})`);
  check('objectiveProgress fica em 0..1', bp >= 0 && bp <= 1 && rp >= 0 && rp <= 1);
}

// ── 12c. Capacidade terrestre vermelha (canal land: LACM + artilharia naval) ──
{
  const s = newGame();
  const lacmTotal = s.units.filter(u => u.team === 'red')
    .reduce((a, u) => a + (u.weapons?.lacm?.quantity ?? 0), 0);
  const navalGunTotal = s.units.filter(u => u.team === 'red')
    .reduce((a, u) => a + (u.capabilities?.navalGun ?? 0), 0);
  const garrisonMax = OBJECTIVE_IDS.redTargets.garrison
    .reduce((a, id) => a + byId(s, id).maxHp, 0);
  check('vermelho tem alcance terrestre (LACM do Vulcan)', lacmTotal > 0, `lacmTotal=${lacmTotal}`);
  check('vermelho tem artilharia naval (canhões de apoio) para o canal land',
    navalGunTotal > 0, `navalGunTotal=${navalGunTotal}`);
  check(`guarnição-alvo tem SP agregado plausível (${garrisonMax} SP)`,
    garrisonMax > 0 && garrisonMax < 100, `garrisonMax=${garrisonMax}`);
}

// ── 13. Selfplay bot-vs-bot até MAX_TURNS: termina sem exceção ────────────────
// Nota: este harness é muito mais denso em combate que o jogo real (toda
// unidade ataca todo período, 1 rodada por engajamento), então algum 0-FP é
// inevitável. Mapa 20×10 (Malvinas) tem distâncias maiores até os provedores
// de combustível que o mapa 16×10 original — medido ~5.8 unidades a 0 FP em
// média ao longo de 60 partidas (scripts/balance_sim.js 60).
{
  const RUNS = 3;
  let err = null, strandedTotal = 0, progressed = true;
  try {
    for (let r = 0; r < RUNS; r++) {
      const s = newGame();
      let periods = 0;
      while (!s.winner && s.turn <= MAX_TURNS && periods < MAX_TURNS * 2 + 2) {
        for (const team of ['blue', 'red']) {
          const moves = computeBotMoves(s, team);
          for (const { unitId, path } of moves) {
            const e = pathLegal(s, unitId, path);
            if (e) throw new Error(`caminho ilegal ${team}/${unitId}: ${e}`);
          }
          applyBotMovesToState(s, team, moves);
        }
        s.phase = 'combat';
        s.blueAttacks = computeBotAttacks(s, 'blue');
        s.redAttacks  = computeBotAttacks(s, 'red');
        // resolve engajamentos de forma simplificada: 1 rodada cada
        s.combatQueue = buildCombatQueue(s);
        for (const eng of s.combatQueue) {
          eng.battleRound = 1;
          resolveBattleRound(s, eng);
        }
        s.combatQueue = []; s.currentEngagementIndex = 0;
        const w = checkWinner(s);
        if (w) { s.winner = w; break; }
        nextTurn(s);
        periods++;
      }
      const stranded = s.units.filter(u =>
        u.hp > 0 && u.fuel?.fuelType === 'naval' && u.fuel.current === 0).length;
      strandedTotal += stranded;
      progressed = progressed && (!!s.winner || s.turn > MAX_TURNS || periods >= MAX_TURNS * 2);
      console.log(`   selfplay ${r}: winner=${s.winner ?? '—'} turno=${s.turn} 0FP=${stranded}`);
    }
  } catch (e) { err = e; }
  check('selfplay termina sem exceção', !err, err?.message);
  check('selfplay: partidas progridem (vencedor ou limite)', progressed);
  const avg = strandedTotal / RUNS;
  // Limiar subiu de 8 para 14 após a ordem de batalha v2 (72 unidades, mais
  // navios consumindo FP e vários petroleiros começando com metade do
  // tanque — ver UNIT_FP_INITIAL em fuel_model.js): a média natural de
  // unidades encalhadas nesse harness (3 partidas, muito mais denso em
  // combate que o jogo real) subiu de ~3-6 para ~6-12, com variância alta.
  check(`selfplay: média de unidades a 0 FP aceitável (${avg.toFixed(1)} <= 14)`, avg <= 14);
}

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FALHA(S)`);
process.exit(failures === 0 ? 0 : 1);
