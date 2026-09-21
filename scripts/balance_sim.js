'use strict';
// Calibragem de balanceamento por selfplay bot-vs-bot.
// Uso: node scripts/balance_sim.js [N]        (padrão N=40)
//
// Reporta taxa de vitória por time, turno da vitória, progresso por objetivo e —
// crítico para o diagnóstico de gargalo — se as unidades vermelhas terminam com
// MUNIÇÃO sobrando (gargalo = combustível) ou com COMBUSTÍVEL sobrando
// (gargalo = munição).
const {
  newGame, computeObjectives, computeBotMoves, computeBotAttacks,
  applyBotMovesToState, buildCombatQueue, resolveBattleRound,
  nextTurn, checkWinner, MAX_TURNS,
} = require('../server');

const N = parseInt(process.argv[2], 10) || 40;
const LACM_UNITS = ['RED-GE-1', 'RED-GE-2', 'RED-KSN'];

function playOne() {
  const s = newGame();
  const lacm0 = new Map(LACM_UNITS.map(id => {
    const u = s.units.find(x => x.id === id);
    return [id, u?.weapons?.lacm?.quantity ?? 0];
  }));
  let periods = 0;
  while (!s.winner && s.turn <= MAX_TURNS && periods < MAX_TURNS * 2 + 2) {
    for (const team of ['blue', 'red']) {
      applyBotMovesToState(s, team, computeBotMoves(s, team));
    }
    s.phase = 'combat';
    s.blueAttacks = computeBotAttacks(s, 'blue');
    s.redAttacks  = computeBotAttacks(s, 'red');
    s.combatQueue = buildCombatQueue(s);
    for (const eng of s.combatQueue) { eng.battleRound = 1; resolveBattleRound(s, eng); }
    s.combatQueue = []; s.currentEngagementIndex = 0;
    const w = checkWinner(s);
    if (w) { s.winner = w; break; }
    nextTurn(s);
    periods++;
  }

  const obj = computeObjectives(s);
  // Gargalo vermelho: LACM restante em unidades vivas vs FP restante
  let lacmLeft = 0, lacmUsed = 0, fpLeft = 0, fpUnits = 0, deadPlatforms = 0;
  for (const id of LACM_UNITS) {
    const u = s.units.find(x => x.id === id);
    if (!u) continue;
    const q0 = lacm0.get(id) ?? 0;
    if ((u.hp ?? 0) <= 0) { deadPlatforms++; lacmUsed += q0 - (u.weapons?.lacm?.quantity ?? 0); continue; }
    const q = u.weapons?.lacm?.quantity ?? 0;
    lacmLeft += q; lacmUsed += q0 - q;
    if (u.fuel?.fuelType === 'naval') { fpLeft += u.fuel.current ?? 0; fpUnits++; }
  }
  const portCond = obj.red.conditions.find(c => c.id === 'ports');
  const fpsoCond = obj.red.conditions.find(c => c.id === 'fpsos');
  return {
    winner: s.winner, turn: s.turn,
    blueAchieved: obj.blue.achieved, redAchieved: obj.red.achieved,
    portsPct: parseInt(String(portCond?.current).match(/(\d+)%/)?.[1] ?? '0', 10),
    fpsoNeut: parseInt(String(fpsoCond?.current).match(/^(\d+)/)?.[1] ?? '0', 10),
    lacmLeft, lacmUsed, fpLeft, fpUnits, deadPlatforms,
  };
}

const runs = [];
for (let i = 0; i < N; i++) runs.push(playOne());

const count = f => runs.filter(f).length;
const avg = f => runs.reduce((a, r) => a + f(r), 0) / runs.length;
const pct = n => `${(100 * n / runs.length).toFixed(0)}%`;

console.log(`\n═══ SELFPLAY ${runs.length} partidas (MAX_TURNS=${MAX_TURNS}) ═══\n`);
console.log(`Vitórias  Azul: ${count(r => r.winner === 'blue')} (${pct(count(r => r.winner === 'blue'))})`);
console.log(`      Vermelho: ${count(r => r.winner === 'red')} (${pct(count(r => r.winner === 'red'))})`);
console.log(`   sem vencedor: ${count(r => !r.winner)}`);
console.log(`\nTurno médio final: ${avg(r => r.turn).toFixed(1)}`);
console.log(`Objetivos médios — Azul ${avg(r => r.blueAchieved).toFixed(2)}/3 · Vermelho ${avg(r => r.redAchieved).toFixed(2)}/2`);
console.log(`\nProgresso vermelho:`);
console.log(`  portos: média ${avg(r => r.portsPct).toFixed(1)}% · máx ${Math.max(...runs.map(r => r.portsPct))}%`);
console.log(`  FPSOs neutralizadas: média ${avg(r => r.fpsoNeut).toFixed(2)}/4 · partidas com >=3: ${count(r => r.fpsoNeut >= 3)}`);
console.log(`\nGargalo vermelho (plataformas LACM: ${LACM_UNITS.join(', ')}):`);
console.log(`  LACM gastos: média ${avg(r => r.lacmUsed).toFixed(1)} · sobrando: média ${avg(r => r.lacmLeft).toFixed(1)}`);
console.log(`  FP restante nas plataformas vivas c/ combustível: média ${avg(r => r.fpLeft).toFixed(1)}`);
console.log(`  plataformas LACM destruídas: média ${avg(r => r.deadPlatforms).toFixed(2)}/3`);
const stuck = count(r => r.lacmLeft > 0 && r.fpLeft === 0 && r.fpUnits > 0);
console.log(`  partidas c/ LACM sobrando E 0 FP (gargalo = combustível): ${stuck} (${pct(stuck)})`);
