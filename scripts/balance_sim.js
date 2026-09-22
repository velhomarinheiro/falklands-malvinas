'use strict';
// Calibragem de balanceamento por selfplay bot-vs-bot.
// Uso: node scripts/balance_sim.js [N]        (padrão N=40)
//
// Reporta taxa de vitória por time, turno da vitória e progresso médio nos
// objetivos de cada lado (Argentina/Azul vs. Reino Unido/Vermelho).
const {
  newGame, computeObjectives, computeBotMoves, computeBotAttacks,
  applyBotMovesToState, buildCombatQueue, resolveBattleRound,
  nextTurn, checkWinner, MAX_TURNS,
} = require('../server');

const N = parseInt(process.argv[2], 10) || 40;

function playOne() {
  const s = newGame();
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
  const garrisonCond  = obj.red.conditions.find(c => c.id === 'garrison');
  const airsupCond    = obj.red.conditions.find(c => c.id === 'airsup');
  const landingCond   = obj.red.conditions.find(c => c.id === 'landing');
  const strandedNaval = s.units.filter(u =>
    u.hp > 0 && u.fuel?.fuelType === 'naval' && u.fuel.current === 0).length;
  return {
    winner: s.winner, turn: s.turn,
    blueAchieved: obj.blue.achieved, redAchieved: obj.red.achieved, redNeeded: obj.red.needed,
    garrisonPct: garrisonCond?.currentParams?.pct ?? 0,
    airsupMet: !!airsupCond?.met,
    landingMet: !!landingCond?.met,
    strandedNaval,
  };
}

const runs = [];
for (let i = 0; i < N; i++) runs.push(playOne());

const count = f => runs.filter(f).length;
const avg = f => runs.reduce((a, r) => a + f(r), 0) / runs.length;
const pct = n => `${(100 * n / runs.length).toFixed(0)}%`;

console.log(`\n═══ SELFPLAY ${runs.length} partidas (MAX_TURNS=${MAX_TURNS}) ═══\n`);
console.log(`Vitórias  Argentina (Azul): ${count(r => r.winner === 'blue')} (${pct(count(r => r.winner === 'blue'))})`);
console.log(`      Reino Unido (Vermelho): ${count(r => r.winner === 'red')} (${pct(count(r => r.winner === 'red'))})`);
console.log(`   sem vencedor: ${count(r => !r.winner)}`);
console.log(`\nTurno médio final: ${avg(r => r.turn).toFixed(1)} (limite ${MAX_TURNS})`);
console.log(`Objetivos médios — Azul ${avg(r => r.blueAchieved).toFixed(2)}/3 · Vermelho ${avg(r => r.redAchieved).toFixed(2)}/${runs[0]?.redNeeded ?? 3}`);
console.log(`\nProgresso vermelho:`);
console.log(`  guarnição das ilhas degradada: média ${avg(r => r.garrisonPct).toFixed(1)}% · máx ${Math.max(...runs.map(r => r.garrisonPct))}%`);
console.log(`  esquadrão Pucará destruído: ${count(r => r.airsupMet)} partidas (${pct(count(r => r.airsupMet))})`);
console.log(`  desembarque nas Ilhas: ${count(r => r.landingMet)} partidas (${pct(count(r => r.landingMet))})`);
console.log(`\nUnidades navais a 0 FP ao fim da partida: média ${avg(r => r.strandedNaval).toFixed(1)}`);
