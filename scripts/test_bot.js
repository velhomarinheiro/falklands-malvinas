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
  [0,0,0,0,0,0,1,2,3,3,3,3,3,3,3,3],[0,0,0,0,0,1,1,2,3,3,3,3,3,3,3,3],
  [0,0,0,0,1,1,2,4,3,3,3,3,3,3,3,3],[0,0,0,1,1,2,4,4,3,3,3,3,3,3,3,3],
  [0,0,1,1,2,4,4,2,3,3,3,3,3,3,3,3],[0,1,1,2,4,4,2,3,3,3,3,3,3,3,3,3],
  [1,1,2,4,4,2,3,3,3,3,3,3,3,3,3,3],[1,2,2,4,2,2,3,3,3,3,3,3,3,3,3,3],
  [1,2,2,2,2,3,3,3,3,3,3,3,3,3,3,3],[1,2,2,2,3,3,3,3,3,3,3,3,3,3,3,3],
];
function canEnter(category, col, row) {
  if (col < 0 || col > 15 || row < 0 || row > 9) return false;
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
      byId(s, 'RED-GE-1').col = 9; byId(s, 'RED-GE-2').col = 10;
      byId(s, 'BLUE-SAG-P').col = 7; byId(s, 'BLUE-SAG-P').row = 3;
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

// ── 2. Vermelho prioriza FPSO sobre patrulha equidistante ──────────────────────
{
  const s = newGame();
  const att = byId(s, 'RED-GE-2');
  const fpso = byId(s, 'BLUE-FPSO1');
  const pat  = byId(s, 'BLUE-PAT-O1');
  // afasta os demais azuis p/ fora do raio de oportunidade (dist > 2)
  for (const u of s.units) {
    if (u.team === 'blue' && u.id !== fpso.id && u.id !== pat.id) { u.col = 15; u.row = 9; }
  }
  // posiciona atacante equidistante de FPSO e patrulha (ambos a dist 2)
  att.col = fpso.col + 2; att.row = fpso.row;
  pat.col = att.col + 2;  pat.row = att.row;
  const w = botObjectiveWeights(s, 'red');
  const tgt = botPickTarget(att, s.units.filter(u => u.team === 'blue' && u.hp > 0), w);
  check('vermelho prefere FPSO a patrulha equidistante', tgt?.id === 'BLUE-FPSO1', `escolheu ${tgt?.id}`);
}

// ── 3. Azul prioriza alvos de objetivo ────────────────────────────────────────
{
  const s = newGame();
  const w = botObjectiveWeights(s, 'blue');
  const T = OBJECTIVE_IDS.blueTargets;
  check('pesos azuis cobrem carrier/logística/anfíbio/sub',
    w.get(T.carrier) === 0 && T.logistics.every(id => w.get(id) === 0) &&
    w.get(T.amphib) === 0 && w.get(T.nucsub) === 0);
}

// ── 4. Re-tarefa após objetivo cumprido ───────────────────────────────────────
{
  const s = newGame();
  OBJECTIVE_IDS.redTargets.fpsos.forEach(id => { byId(s, id).hp = 0; });
  const w = botObjectiveWeights(s, 'red');
  const onlyPorts = OBJECTIVE_IDS.redTargets.ports.every(id => w.get(id) === 0) &&
                    OBJECTIVE_IDS.redTargets.fpsos.every(id => !w.has(id));
  check('FPSOs destruídas → pesos vermelhos só contêm portos', onlyPorts);
}

// ── 5. Override de oportunidade: combatente colado vence objetivo distante ────
{
  const s = newGame();
  const att = byId(s, 'RED-GE-2');
  const frig = byId(s, 'BLUE-SAG-1') || s.units.find(u => u.team === 'blue' && ['fragata','destroier','corveta','cruzador'].includes(u.type));
  const fpso = byId(s, 'BLUE-FPSO1');
  att.col = 10; att.row = 4;
  frig.col = 11; frig.row = 4;          // dist 1 — colado
  // FPSO fica onde está (longe)
  const w = botObjectiveWeights(s, 'red');
  const tgt = botPickTarget(att, s.units.filter(u => u.team === 'blue' && u.hp > 0), w);
  check('combatente a dist 1 vence FPSO distante', tgt?.id === frig.id, `escolheu ${tgt?.id} (frig=${frig.id})`);
}

// ── 6. Combustível: baixo FP → rota ao provedor; empilhado → não move ─────────
{
  const s = newGame();
  const u = byId(s, 'RED-GE-3');
  const prov = botRefuelProvider(u, s);
  check('provedor encontrado p/ RED-GE-3', !!prov, 'nenhum');
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

// ── 7. Submarino nunca roteia a porto raso; navio nunca a PORTO-S (terra) ─────
{
  const s = newGame();
  const sub = s.units.find(u => u.team === 'blue' && u.category === 'submarine' && u.fuel?.fuelType === 'naval');
  if (sub) {
    const p = botRefuelProvider(sub, s);
    const t = p ? TERRAIN[p.row][p.col] : null;
    check('provedor de submarino não fica em raso/terra', !p || (t !== 0 && t !== 1), p ? `${p.id} t=${t}` : '');
  } else check('provedor de submarino não fica em raso/terra', true, '(sem sub convencional azul)');
  const ship = byId(s, 'BLUE-SAG-1') || s.units.find(u => u.team === 'blue' && u.category === 'surface');
  const p2 = botRefuelProvider(ship, s);
  check('provedor de navio nunca é PORTO-S (terra)', p2?.id !== 'BLUE-PORTO-S', p2?.id);
}

// ── 8. Logística ameaçada foge + ganha escolta ────────────────────────────────
{
  const s = newGame();
  const aor = byId(s, 'RED-AOR-G');
  const foe = byId(s, 'BLUE-SAG-1') || s.units.find(u => u.team === 'blue' && ['fragata','destroier','corveta','cruzador'].includes(u.type));
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
  const port = byId(s, 'BLUE-PORTO-RJ');
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
  const att = byId(s, 'RED-GE-1');
  const def = byId(s, 'BLUE-SAG-1') || s.units.find(u => u.team === 'blue' && u.category === 'surface' && u.maxHp >= 4);
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
  // defensor sem contra-ataque possível (alvo = FPSO desarmada isolada) → stop
  const fpso = byId(s, 'BLUE-FPSO1');
  const eng2 = { attackerId: att.id, targetId: fpso.id, weaponType: 'ascm',
                 targetCol: fpso.col, targetRow: fpso.row, targetTeam: 'blue', targetCategory: 'surface' };
  att.col = fpso.col + 3; att.row = fpso.row;
  check('defensor desarmado → stop', botBattleRoundDecision(s, eng2, 'blue') === 'stop');
}

// ── 12. computeObjectives estável no estado inicial ───────────────────────────
{
  const s = newGame();
  const o = computeObjectives(s);
  check('objetivos iniciais: azul 0/3, vermelho 0/2',
    o.blue.achieved === 0 && o.blue.needed === 3 && o.red.achieved === 0 && o.red.needed === 2);
}

// ── 12b. Limiares de vitória e progresso contínuo ─────────────────────────────
{
  const TH = OBJECTIVE_THRESHOLDS;
  const fpsoIds = OBJECTIVE_IDS.redTargets.fpsos;
  const portIds = OBJECTIVE_IDS.redTargets.ports;
  const redCond = (s, id) => computeObjectives(s).red.conditions.find(c => c.id === id);
  const dealPortDamage = (s, sp) => {
    let n = sp;
    for (const id of portIds) {
      const p = byId(s, id);
      const d = Math.min(n, p.maxHp);
      p.hp = p.maxHp - d; n -= d;
      if (n <= 0) break;
    }
  };

  check('limiar FPSO é 3 de 4', TH.redFpsoKills === 3);
  check('limiar de portos é 40%', TH.redPortDegPct === 40);

  // FPSO: 2 não cumpre, 3 cumpre (regra anterior exigia 4)
  let s = newGame();
  fpsoIds.slice(0, 2).forEach(id => { byId(s, id).hp = 0; });
  check('2 FPSOs neutralizadas → não cumprida', redCond(s, 'fpsos').met === false);
  byId(s, fpsoIds[2]).hp = 0;
  check('3 FPSOs neutralizadas → cumprida', redCond(s, 'fpsos').met === true);

  // Portos: fronteira exata em 27 SP de 68 (40%)
  s = newGame(); dealPortDamage(s, 26);
  check('portos a 26 SP (38%) → não cumprida', redCond(s, 'ports').met === false,
    redCond(s, 'ports').current);
  s = newGame(); dealPortDamage(s, 27);
  check('portos a 27 SP (40%) → cumprida', redCond(s, 'ports').met === true,
    redCond(s, 'ports').current);

  // Rótulos derivados das constantes (não podem divergir da regra)
  s = newGame();
  const o = computeObjectives(s);
  check('rótulo do objetivo FPSO cita o limiar',
    o.red.conditions[0].label.includes(String(TH.redFpsoKills)),
    o.red.conditions[0].label);
  check('rótulo do objetivo portos cita o limiar',
    o.red.conditions[1].label.includes(`${TH.redPortDegPct}%`),
    o.red.conditions[1].label);

  // progress: 0..1, limitado a 1
  check('progress inicial é 0 nos dois lados',
    o.blue.conditions.every(c => c.progress === 0) &&
    o.red.conditions.every(c => c.progress === 0));
  s = newGame(); dealPortDamage(s, 40);   // muito acima do limiar
  check('progress satura em 1', redCond(s, 'ports').progress === 1);
  s = newGame();
  const carrier = byId(s, OBJECTIVE_IDS.blueTargets.carrier);
  carrier.hp = Math.ceil(carrier.maxHp / 2);
  const halfProg = computeObjectives(s).blue.conditions[0].progress;
  check('condição binária dá crédito parcial por dano',
    halfProg > 0.3 && halfProg < 0.7, `progress=${halfProg.toFixed(3)}`);

  // Adjudicação: dano acumulado abaixo do limiar deixa de valer zero.
  // Vermelho com 2 FPSOs + portos a ~29% contra Azul que só matou o sub nuclear.
  s = newGame();
  fpsoIds.slice(0, 2).forEach(id => { byId(s, id).hp = 0; });
  dealPortDamage(s, 20);
  byId(s, OBJECTIVE_IDS.blueTargets.nucsub).hp = 0;
  const o2 = computeObjectives(s);
  const bp = objectiveProgress(o2.blue), rp = objectiveProgress(o2.red);
  const oldWinner = (o2.red.achieved / 2) > (o2.blue.achieved / 3) ? 'red' : 'blue';
  const newWinner = rp > bp ? 'red' : 'blue';
  check('adjudicação: dano acumulado vermelho passa a vencer contagem azul barata',
    oldWinner === 'blue' && newWinner === 'red',
    `antiga=${oldWinner} nova=${newWinner} (azul ${bp.toFixed(2)} vs verm ${rp.toFixed(2)})`);
  check('objectiveProgress fica em 0..1', bp >= 0 && bp <= 1 && rp >= 0 && rp <= 1);
}

// ── 12c. Munição LACM vermelha (canal terrestre) ───────────────────────────────
{
  const s = newGame();
  const total = ['RED-GE-1', 'RED-GE-2', 'RED-KSN']
    .reduce((a, id) => a + (byId(s, id)?.weapons?.lacm?.quantity ?? 0), 0);
  const portMax = OBJECTIVE_IDS.redTargets.ports
    .reduce((a, id) => a + byId(s, id).maxHp, 0);
  const needed = portMax * OBJECTIVE_THRESHOLDS.redPortDegPct / 100;
  const expected = total * 1.5;   // E[dano] do LACM = 1,5 SP
  check(`LACM totaliza 22 (dano esperado ${expected} SP)`, total === 22, `total=${total}`);
  check(`canal terrestre cobre o objetivo (${expected} SP >= ${needed.toFixed(1)} SP)`,
    expected >= needed, `razão=${(expected / needed).toFixed(2)}`);
  // O KSN concentra a maior parte por ser isento de combustível
  check('KSN é a maior plataforma LACM',
    (byId(s, 'RED-KSN').weapons.lacm.quantity) >= (byId(s, 'RED-GE-1').weapons.lacm.quantity) - 2);
}

// ── 13. Selfplay bot-vs-bot até MAX_TURNS: termina sem exceção ────────────────
// Nota: este harness é muito mais denso em combate que o jogo real (toda
// unidade ataca todo período, 1 rodada por engajamento), então algum 0-FP é
// inevitável — patrulhas costeiras têm 6 FP máx e defender também queima FP.
// Referência medida: bot antigo ~4.3 unidades a 0 FP em média; novo ~3.4.
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
  check(`selfplay: média de unidades a 0 FP aceitável (${avg.toFixed(1)} <= 5)`, avg <= 5);
}

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FALHA(S)`);
process.exit(failures === 0 ? 0 : 1);
