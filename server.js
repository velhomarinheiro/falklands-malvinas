'use strict';
const express  = require('express');
const crypto   = require('crypto');
const http     = require('http');
const { Server } = require('socket.io');
const path     = require('path');
const fs       = require('fs');
const archiver = require('archiver');
const { ORDER_OF_BATTLE }  = require('./shared/order_of_battle');
const { COMBAT_CONFIG }    = require('./shared/combat_config');
const { resolveEngagement, getWeaponQuantity, getWeaponRange } = require('./shared/combat_engine');
const {
  initializeFuel, isFuelDisabled,
  canMove, canAttack, canDefend,
  navalMoveCost, spendNavalFuel, spendAirFuel,
  spendEngagementFuel, spendDamageFuel,
  recoverNavalFuel, isNavalRefuelProvider,
  checkNavalFuelZero, checkAirFuelLosses,
  recoverAircraft, resetFuelTurnCounters,
  FUEL_TURN_LIMIT,
} = require('./fuel_model');
const gameLogger = require('./game_logger');

const PORT   = process.env.PORT || 3000;
const GRID_W = 16;
const GRID_H = 10;
// Limite operacional em dias de jogo (turnos dia+noite); configurável p/ testes
const MAX_TURNS = parseInt(process.env.MAX_TURNS, 10) || 12;

// ─── Terrain (mirror of public/js/terrain.js) ────────────────────────────────
const T_LAND = 0, T_SHALLOW = 1, T_SHELF = 2, T_DEEP = 3, T_OIL = 4;
const TERRAIN_MAP = [
  [0,0,0,0,0,0,1,2,3,3,3,3,3,3,3,3],
  [0,0,0,0,0,1,1,2,3,3,3,3,3,3,3,3],
  [0,0,0,0,1,1,2,4,3,3,3,3,3,3,3,3],
  [0,0,0,1,1,2,4,4,3,3,3,3,3,3,3,3],
  [0,0,1,1,2,4,4,2,3,3,3,3,3,3,3,3],
  [0,1,1,2,4,4,2,3,3,3,3,3,3,3,3,3],
  [1,1,2,4,4,2,3,3,3,3,3,3,3,3,3,3],
  [1,2,2,4,2,2,3,3,3,3,3,3,3,3,3,3],
  [1,2,2,2,2,3,3,3,3,3,3,3,3,3,3,3],
  [1,2,2,2,3,3,3,3,3,3,3,3,3,3,3,3],
];
function getTerrain(col, row) {
  if (row < 0 || row >= GRID_H || col < 0 || col >= GRID_W) return T_LAND;
  return TERRAIN_MAP[row][col];
}
function canEnterTerrain(category, terrain) {
  if (category === 'air' || category === 'specops') return true;
  if (category === 'land')      return terrain === T_LAND || terrain === T_SHALLOW;
  if (category === 'submarine') return terrain !== T_LAND && terrain !== T_SHALLOW;
  return terrain !== T_LAND; // surface
}

// ─── Display type: primary composition type → counter icon type ───────────────
const COMP_DISPLAY_TYPE = {
  'operacoes_especiais':   'specops',
  'navio_aeródromo':       'carrier',
  'navio_doca':            'amphib',
  'navio_desembarque':     'amphib',
  'fragata':               'fragata',
  'corveta':               'corveta',
  'destroier':             'destroier',
  'destroyer':             'destroier',
  'cruzador':              'cruzador',
  'navio_patoc':           'patrulha_oc',
  'navio_patrulha':        'patrulha_c',
  'navio_logistico':       'logistico',
  'navio_tanque':          'tanque',
  'submarino_nuclear':     'sub_nuclear',
  'submarino_convencional':'submarino',
  'patrulha_maritima':     'patrulha',
  'caca':                  'caca',
  'ataque':                'ataque',
  'aew':                   'aew',
  'helicoptero_ASW':       'helicoptero',
  'helicoptero_ASup':      'helicoptero',
  'bateria_costeira':      'bateria_costeira',
  'bateria_ada':           'bateria_ada',
  'base_naval':            'bateria_ada',
  'plataforma':            'fpso',
  'porto':                 'porto',
  'aeroporto':             'aeroporto',
};
const DISPLAY_TYPE_FALLBACK = { surface: 'fragata', submarine: 'submarino', air: 'patrulha', land: 'corveta', specops: 'specops' };

// ─── Range helper ─────────────────────────────────────────────────────────────
function rangeAgainst(rangeTable, targetCategory) {
  if (!rangeTable) return 0;
  return Number(rangeTable[targetCategory] || 0);
}

// ─── Hex math (odd-q offset, flat-top) — matches client hex.js ──────────────
function oddqToCube(col, row) {
  const x = col;
  const z = row - (col - (col & 1)) / 2;
  return { x, y: -x - z, z };
}
function cubeToOddq(x, z) { return { col: x, row: z + (x - (x & 1)) / 2 }; }
const CUBE_DIRS = [
  {dx:+1,dy:-1,dz:0},{dx:+1,dy:0,dz:-1},{dx:0,dy:+1,dz:-1},
  {dx:-1,dy:+1,dz:0},{dx:-1,dy:0,dz:+1},{dx:0,dy:-1,dz:+1},
];
function hexNeighbors(col, row) {
  const c = oddqToCube(col, row);
  return CUBE_DIRS.map(d => cubeToOddq(c.x+d.dx, c.z+d.dz))
    .filter(({col:nc,row:nr}) => nc>=0 && nc<GRID_W && nr>=0 && nr<GRID_H);
}
function hexDist(c1,r1,c2,r2) {
  const a=oddqToCube(c1,r1), b=oddqToCube(c2,r2);
  return Math.max(Math.abs(a.x-b.x), Math.abs(a.y-b.y), Math.abs(a.z-b.z));
}

// ─── Air refuel location check ────────────────────────────────────────────────
// An aircraft may recover fuel when it ends its turn here without moving.
// Blue: any T_LAND hex (land air base) or a friendly carrier unit in the same hex.
// Red:  only a friendly carrier unit in the same hex.
function isAirRefuelLocation(unit, state) {
  return state.units.some(o =>
    o.id !== unit.id &&
    o.team === unit.team &&
    (o.hp ?? 0) > 0 &&
    (o.type === 'aeroporto' || o.type === 'carrier') &&
    o.col === unit.col && o.row === unit.row
  );
}

// ─── Fog of war ──────────────────────────────────────────────────────────────
function saveMovementSnapshot(state) {
  state.movementSnapshot = {};
  for (const u of state.units) {
    state.movementSnapshot[u.id] = { col: u.col, row: u.row };
  }
}

function stateFor(state, team) {
  const night = state.period === 'night';

  // Strip server-internal combat queue fields — clients don't need them
  const { combatQueue: _cq, battleRoundDecisions: _brd, ...stateRest } = state;

  // During movement phase, show enemy units at their pre-movement positions
  // so moves are hidden until both sides commit (simultaneous movement reveal).
  const enemyActual = state.units.filter(u => u.team !== team && u.hp > 0);
  const enemies = (state.phase === 'movement' && state.movementSnapshot)
    ? enemyActual.map(u => {
        const snap = state.movementSnapshot[u.id];
        return snap ? { ...u, col: snap.col, row: snap.row } : u;
      })
    : enemyActual;

  const mine = state.units.filter(u => u.team === team && u.hp > 0);

  // Detection during movement uses pre-movement positions for both sides so the
  // first player to commit cannot see enemies they only approached this turn.
  const mineForDetection = (state.phase === 'movement' && state.movementSnapshot)
    ? mine.map(u => {
        const snap = state.movementSnapshot[u.id];
        return snap ? { ...u, col: snap.col, row: snap.row } : u;
      })
    : mine;

  // Specops are always invisible to the enemy; land units are always detected
  const enemiesForDetection = enemies.filter(e => e.category !== 'specops');

  const detected = enemiesForDetection.filter(enemy => {
    if (enemy.category === 'land') return true; // fixed positions always known
    const stealthy  = !!enemy.stealthy;
    const deepBonus = getTerrain(enemy.col, enemy.row) === T_DEEP ? 1 : 0;
    return mineForDetection.some(f => {
      let range = stealthy
        ? rangeAgainst(f.detectionRange, 'submarine') - deepBonus
        : rangeAgainst(f.detectionRange, enemy.category);
      // Submarines use sonar — unaffected by daylight
      if (night && f.category !== 'submarine') range -= stealthy ? 1 : 2;
      return range >= 1 && hexDist(f.col, f.row, enemy.col, enemy.row) <= range;
    });
  }).map(e => ({ ...e, detected: true }));

  return {
    ...stateRest,
    units:       [...state.units.filter(u => u.team === team), ...detected],
    blueAttacks: team === 'blue' ? state.blueAttacks : (state.blueAttacks !== null ? '✓' : null),
    redAttacks:  team === 'red'  ? state.redAttacks  : (state.redAttacks  !== null ? '✓' : null),
    objectives:  computeObjectives(state),
    maxTurns:    MAX_TURNS,
  };
}

// ─── Weapon priority per target category ─────────────────────────────────────
const WEAPON_PRIORITY = {
  surface:   ['ascm', 'asbm', 'mss', 'torpedo', 'airAttack', 'navalGun', 'raid'],
  submarine: ['asw', 'torpedo'],
  air:       ['airDefense', 'airAttack'],
  land:      ['lacm', 'airAttack', 'navalGun', 'raid'],
};

function selectBestWeapon(attacker, target, dist) {
  const priority = WEAPON_PRIORITY[target.category] || [];
  for (const wpnType of priority) {
    const qty = getWeaponQuantity(attacker, wpnType);
    if (qty <= 0) continue;
    const profile = COMBAT_CONFIG.weaponProfiles?.[wpnType];
    if (!profile) continue;
    if (!profile.targets.includes(target.category)) continue;
    const range = getWeaponRange(attacker, wpnType);
    if (dist <= range) return wpnType;
  }
  return null;
}

// ─── Air movement range (FP/2, matching the doubled fuel model) ───────────────
function airMovementRange(unit) {
  if (unit.category !== 'air') return unit.movement;
  return Math.floor((unit.fuel?.current ?? unit.movement) / 2);
}

// ─── Unit factory ─────────────────────────────────────────────────────────────
function makeUnit(team, spec) {
  const pos     = spec.position || spec.start || { col: 0, row: 0 };
  const weapons = spec.weapons ? JSON.parse(JSON.stringify(spec.weapons)) : {};
  const unit = {
    id:            spec.id,
    team,
    name:          spec.name,
    category:      spec.category,
    type:          (spec.composition && spec.composition[0] && COMP_DISPLAY_TYPE[spec.composition[0].type]) || DISPLAY_TYPE_FALLBACK[spec.category] || 'fragata',
    composition:   spec.composition || [],
    movement:      spec.movement,
    detectionRange: spec.detectionRange,
    attackRange:   spec.attackRange,
    col:           pos.col,
    row:           pos.row,
    hp:            spec.stayingPower,
    maxHp:         spec.stayingPower,
    stealthy:      spec.category === 'submarine' || !!spec.stealthy,
    moved:         false,
    weapons,
    initWeapons:   JSON.parse(JSON.stringify(weapons)),
    capabilities:  spec.capabilities ? { ...spec.capabilities } : {},
  };
  initializeFuel(unit);
  unit.initMovement       = unit.movement;
  unit.initDetectionRange = JSON.parse(JSON.stringify(unit.detectionRange || {}));
  unit.initCapabilities   = JSON.parse(JSON.stringify(unit.capabilities   || {}));
  unit.initFuelMax        = unit.fuel?.max ?? 0;
  unit.baseHex            = { col: pos.col, row: pos.row };
  unit.baseUnitId         = spec.embarked || null;
  unit.hostId             = spec.hostId   || null;
  return unit;
}

function initialUnits() {
  const units = [];
  for (const spec of ORDER_OF_BATTLE.forces.blue) {
    units.push(makeUnit('blue', spec));
  }
  for (const spec of ORDER_OF_BATTLE.forces.red) {
    units.push(makeUnit('red', spec));
  }
  return units;
}

function newGame() {
  const state = {
    turn: 1, period: 'day', phase: 'movement',
    blueDone: false, redDone: false,
    blueAttacks: null, redAttacks: null,
    units: initialUnits(),
    log: ['──── Turno 1 · Período Diurno ────', 'Fase de Movimentação iniciada.'],
    winner: null,
    movementSnapshot: {},
    combatQueue: [],
    currentEngagementIndex: 0,
    battleRoundDecisions: { blue: null, red: null },
  };
  saveMovementSnapshot(state);
  return state;
}

// ─── Battle-round system ─────────────────────────────────────────────────────
// Default salvo sizes (conservative); client may request a specific amount
const SALVO_SIZE = { ascm: 2, mss: 2, torpedo: 1, lacm: 1, asbm: 1 };

function isSingleRoundWeapon(weaponType) {
  return ['lacm', 'asbm'].includes(weaponType);
}

// Intercala os ataques declarados pelas duas equipes, alternando a ordem de
// avaliação/aplicação de dano. Sem isso, todos os ataques azuis seriam
// resolvidos antes de qualquer ataque vermelho, dando vantagem involuntária
// ao azul (alvos podem morrer antes de conseguir atacar de volta). A equipe
// que age primeiro também alterna a cada turno para não fixar a vantagem.
function interleaveAttacks(blueAtks, redAtks, turn) {
  const blueFirst = (turn % 2) === 1;
  const [first, second] = blueFirst ? [blueAtks, redAtks] : [redAtks, blueAtks];
  const result  = [];
  const maxLen  = Math.max(first.length, second.length);
  for (let i = 0; i < maxLen; i++) {
    if (i < first.length)  result.push(first[i]);
    if (i < second.length) result.push(second[i]);
  }
  return result;
}

function buildCombatQueue(state) {
  const all = interleaveAttacks(state.blueAttacks || [], state.redAttacks || [], state.turn);
  return all.map((atk, i) => {
    const att = state.units.find(u => u.id === atk.attackerId && u.hp > 0);
    const def = state.units.find(u => u.id === atk.targetId   && u.hp > 0);
    if (!att || !def) return null;
    const dist      = hexDist(att.col, att.row, def.col, def.row);
    const reqWpn    = atk.weaponType;
    const wpnType   = (reqWpn && getWeaponQuantity(att, reqWpn) > 0)
      ? reqWpn
      : selectBestWeapon(att, def, dist);
    if (!wpnType) return null;
    const profile   = COMBAT_CONFIG.weaponProfiles?.[wpnType];
    const qty       = getWeaponQuantity(att, wpnType);
    // Use client-requested amount if provided, capped at available quantity
    const requested = atk.amount ?? (SALVO_SIZE[wpnType] || 1);
    const amount    = profile?.expendable ? Math.min(qty, Math.max(1, requested)) : 1;
    return {
      id:              `ENG-${String(i + 1).padStart(2, '0')}`,
      attackerId:      atk.attackerId,
      targetId:        atk.targetId,
      weaponType:      wpnType,
      amount,
      battleRound:     1,
      maxBattleRounds: isSingleRoundWeapon(wpnType) ? 1 : 2,
      status:          'pending',
      results:         [],
      // Snapshot of the target's hex/identity at queue-build time, so the
      // defending stack can be reconstructed for the group counter-attack even
      // if the primary target is destroyed by the incoming volley first.
      targetCol:       def.col,
      targetRow:       def.row,
      targetTeam:      def.team,
      targetCategory:  def.category,
    };
  }).filter(Boolean);
}

// Units that form the defending stack on a hex: alive same-team units sharing
// the same cell. A surface unit stacked with allies defends — and counter-attacks
// — as a group; the attacker's chosen target only sets the primary recipient of
// the incoming damage. Lone units (or non-surface targets) keep 1-on-1 behavior.
function defendingGroup(state, col, row, team, category) {
  if (category !== 'surface') return null;
  const stack = state.units.filter(u =>
    (u.hp ?? 0) > 0 && u.team === team && u.col === col && u.row === row);
  return stack.length > 1 ? stack : null;
}

function resolveBattleRound(state, engagement, initiativeBonusTeam = null) {
  const att = state.units.find(u => u.id === engagement.attackerId && u.hp > 0);
  const def = state.units.find(u => u.id === engagement.targetId   && u.hp > 0);
  const brTag = `${engagement.id}·BR${engagement.battleRound}`;

  if (!att || !def) {
    engagement.status = 'ended';
    state.log.unshift(`[${brTag}] Unidade destruída — engajamento encerrado.`);
    return null;
  }

  // Skip attack if attacker is fuel-disabled
  if (!canAttack(att)) {
    state.log.unshift(`⛽ ${att.name} não pode atacar: sem combustível.`);
    return { ok: false, reason: 'Atacante sem combustível' };
  }

  const initLabel = initiativeBonusTeam ? ` ★${initiativeBonusTeam.toUpperCase()}` : '';
  state.log.unshift(`──── ${brTag}${initLabel} ────`);

  // Group defense: a stacked surface task group pools its interceptors. Only
  // units that can still defend (naval FP > 0) contribute.
  const stack = defendingGroup(state, def.col, def.row, def.team, def.category);
  const interceptors = stack
    ? stack.filter(canDefend)
    : (isFuelDisabled(def) ? [] : [def]);
  if (stack && interceptors.length > 1 && !engagement.id.includes('CTR')) {
    state.log.unshift(`🛡 ${def.name} defende em grupo (${interceptors.length} unid. no mesmo hex).`);
  }

  const dist = hexDist(att.col, att.row, def.col, def.row);
  const eng  = resolveEngagement({
    attacker: att, defender: def,
    defenders:  interceptors,
    weaponType: engagement.weaponType,
    amount:     engagement.amount,
    distance:   dist,
    initiativeBonusTeam,
    defenderDisabled: isFuelDisabled(def),  // 0-FP naval unit has no interception
  });

  if (!eng.ok) {
    state.log.unshift(`⚠ ${att.name} → ${def.name}: ${eng.reason}`);
  } else {
    // Spend engagement FP for attacker
    spendEngagementFuel(att);

    if (eng.destroyed) {
      state.log.unshift(`💥 ${def.name} DESTRUÍDO por ${att.name} [${eng.weaponLabel}]`);
      // Cascade: kill embarked aircraft and hosted specops
      for (const u of state.units) {
        if ((u.hp ?? 0) <= 0) continue;
        if (u.baseUnitId === def.id || u.hostId === def.id) {
          u.hp = 0;
          state.log.unshift(`💥 ${u.name} perdido com ${def.name}`);
        }
      }
    } else if (eng.totalDamage > 0) {
      const intStr = eng.interception?.intercepted > 0 ? ` (${eng.interception.intercepted} intercept.)` : '';
      state.log.unshift(`✓ ${att.name} → ${def.name} −${eng.totalDamage}SP [${eng.weaponLabel}${intStr}]`);
      spendDamageFuel(def);    // defender burns extra FP absorbing the hit
      const degrad = applyDegradation(def, eng.totalDamage);
      if (degrad) { state.log.unshift(`  ↘ ${def.name}: ${degrad}`); eng.degradation = degrad; }
    } else {
      const intStr = eng.interception?.intercepted > 0 ? ` (${eng.interception.intercepted} intercept.)` : '';
      state.log.unshift(`✗ ${att.name} → ${def.name} falhou [${eng.weaponLabel}${intStr}]`);
    }
  }

  if (state.log.length > 80) state.log = state.log.slice(0, 80);
  engagement.results.push({ battleRound: engagement.battleRound, initiativeBonusTeam, result: eng });
  return eng;
}

function emitBrResult(room, engagement, result, mustDecide, extra = {}) {
  const payload = { engagement, result, mustDecide, ...extra };
  if (room.players.blue) io.to(room.players.blue).emit('battle_round_result', payload);
  if (room.players.red)  io.to(room.players.red ).emit('battle_round_result', payload);
}

function startCurrentEngagement(room) {
  const state      = room.state;
  const engagement = state.combatQueue[state.currentEngagementIndex];
  engagement.battleRound = 1;

  const result = resolveBattleRound(state, engagement);

  // Immediate resolution: single-round weapon, invalid result, OR target destroyed in BR#1.
  // If destroyed, server must NOT request decisions — client shows OK but never sends
  // battle_round_decision, causing a permanent stall.
  if (!result || !result.ok || engagement.maxBattleRounds === 1 || result.destroyed) {
    emitBrResult(room, engagement, result, false);
    finishCurrentEngagement(room);
    return;
  }

  // Multi-round weapon, target survived: ask both players
  state.battleRoundDecisions = { blue: null, red: null };
  emitBrResult(room, engagement, result, true);
}

function resolveCounterAttacks(state, engagement, blue, red) {
  // The defending stack fires back at the original attacker in BR#2.
  // Restricted to close-range weapons (no LACM / ASBM strategic strikes).
  const att = state.units.find(u => u.id === engagement.attackerId && u.hp > 0);
  if (!att) return [];

  // Reconstruct the defending group from the target's hex (the primary target
  // may already be destroyed by the incoming volley, but surviving stackmates —
  // even a single one — still counter-attack). For a non-surface target, only
  // the target itself counters, matching the classic 1-on-1 behavior.
  let group;
  if (engagement.targetCategory === 'surface') {
    group = state.units.filter(u =>
      (u.hp ?? 0) > 0 && u.team === engagement.targetTeam &&
      u.col === engagement.targetCol && u.row === engagement.targetRow);
  } else {
    const def = state.units.find(u => u.id === engagement.targetId && (u.hp ?? 0) > 0);
    group = def ? [def] : [];
  }

  // Initiative for the counter: if the defending team chose continue and the
  // attacker chose stop, the whole defending group counters with advantage.
  const defDecision = engagement.targetTeam === 'blue' ? blue : red;
  const attDecision = att.team === 'blue' ? blue : red;
  const counterInit = (defDecision === 'continue' && attDecision === 'stop')
    ? engagement.targetTeam : null;

  const results = [];
  let idx = 0;
  for (const unit of group) {
    if ((unit.hp ?? 0) <= 0 || !canAttack(unit) || unit.id === att.id) continue;

    const dist       = hexDist(unit.col, unit.row, att.col, att.row);
    const counterWpn = selectBestWeapon(unit, att, dist);
    if (!counterWpn || isSingleRoundWeapon(counterWpn)) continue;

    const profile    = COMBAT_CONFIG.weaponProfiles?.[counterWpn];
    const qty        = getWeaponQuantity(unit, counterWpn);
    const counterAmt = profile?.expendable ? Math.min(qty, SALVO_SIZE[counterWpn] || 1) : 1;

    const counterEng = {
      id: `${engagement.id}-CTR${++idx}`,
      attackerId:      unit.id,
      targetId:        att.id,
      weaponType:      counterWpn,
      amount:          counterAmt,
      battleRound:     2,
      maxBattleRounds: 2,
      status:          'pending',
      results:         [],
    };

    const r = resolveBattleRound(state, counterEng, counterInit);
    if (r) results.push(r);
    // Attacker destroyed by the counter-fire: remaining stackmates have nothing to hit.
    if (!state.units.find(u => u.id === att.id && (u.hp ?? 0) > 0)) break;
  }

  return results;
}

function processBattleRoundDecision(room) {
  const state      = room.state;
  const engagement = state.combatQueue[state.currentEngagementIndex];
  const { blue, red } = state.battleRoundDecisions;

  const bothStop   = blue === 'stop' && red === 'stop';
  const maxReached = engagement.battleRound >= engagement.maxBattleRounds;

  if (bothStop || maxReached) {
    emitBrResult(room, engagement, null, false, { decisions: { blue, red } });
    finishCurrentEngagement(room);
    return;
  }

  // BR#2: determine initiative advantage
  let initiativeBonusTeam = null;
  if (blue === 'continue' && red === 'stop')  initiativeBonusTeam = 'blue';
  if (red  === 'continue' && blue === 'stop') initiativeBonusTeam = 'red';

  engagement.battleRound = 2;
  const result         = resolveBattleRound(state, engagement, initiativeBonusTeam);
  const counterResults = resolveCounterAttacks(state, engagement, blue, red);

  emitBrResult(room, engagement, result, false,
    { decisions: { blue, red }, initiativeBonusTeam, counterResults });
  finishCurrentEngagement(room);
}

function finishCurrentEngagement(room) {
  const state = room.state;
  const eng = state.combatQueue[state.currentEngagementIndex];
  eng.status = 'ended';
  gameLogger.logEngagement(room.id, state.turn, state.period, eng);
  state.currentEngagementIndex += 1;

  if (state.currentEngagementIndex < state.combatQueue.length) {
    startCurrentEngagement(room);
  } else {
    finishCombatPhase(room);
  }
}

function returnAircraftToBases(state) {
  for (const u of state.units) {
    if (u.category !== 'air' || (u.hp ?? 0) <= 0) continue;
    if (u.airStatus !== 'airborne') continue;
    if (u.baseUnitId) {
      const base = state.units.find(b => b.id === u.baseUnitId && (b.hp ?? 0) > 0);
      if (base) { u.col = base.col; u.row = base.row; }
    } else if (u.baseHex) {
      u.col = u.baseHex.col;
      u.row = u.baseHex.row;
    }
    u.fuel.wasAtRefuelLocation = true;
  }
}

function finishCombatPhase(room) {
  const state = room.state;
  returnAircraftToBases(state);
  state.log.unshift('── Fase de Combate encerrada. ──');

  state.combatQueue             = [];
  state.currentEngagementIndex  = 0;
  state.battleRoundDecisions    = { blue: null, red: null };

  const winner = checkWinner(state);
  if (winner) {
    state.winner = winner;
    state.log.unshift(`🏆 ${winner === 'blue' ? 'Força Azul' : 'Força Vermelha'} VENCEU!`);
    const obj = computeObjectives(state);
    gameLogger.logGameOver(room.id, state.turn, winner, 'victory', obj, state);
    const payload = { winner, objectives: obj, reason: 'victory' };
    if (room.players.blue) io.to(room.players.blue).emit('game_over', { ...payload, state: stateFor(state, 'blue') });
    if (room.players.red)  io.to(room.players.red ).emit('game_over', { ...payload, state: stateFor(state, 'red')  });
    return;
  }

  nextTurn(state);

  // ── Limite operacional: ao fim do dia MAX_TURNS, vence o maior progresso ────
  if (state.turn > MAX_TURNS) {
    const obj = computeObjectives(state);
    const blueProg = objectiveProgress(obj.blue);
    const redProg  = objectiveProgress(obj.red);
    const winner = redProg > blueProg ? 'red' : 'blue';   // empate → Azul
    state.winner = winner;
    state.log.unshift(`⏱ Limite operacional de ${MAX_TURNS} dias atingido — adjudicação por progresso nos objetivos (Azul ${(blueProg * 100).toFixed(0)}% · Vermelho ${(redProg * 100).toFixed(0)}%).`);
    state.log.unshift(`🏆 ${winner === 'blue' ? 'Força Azul' : 'Força Vermelha'} VENCEU!`);
    gameLogger.logGameOver(room.id, state.turn, winner, 'timeout', obj, state);
    const payload = { winner, objectives: obj, reason: 'timeout' };
    if (room.players.blue) io.to(room.players.blue).emit('game_over', { ...payload, state: stateFor(state, 'blue') });
    if (room.players.red)  io.to(room.players.red ).emit('game_over', { ...payload, state: stateFor(state, 'red')  });
    return;
  }

  broadcast(room);
}

// IDs das condições de vitória — fonte única, compartilhada com o bot
// (botObjectiveWeights) para que a IA persiga exatamente o que pontua.
const OBJECTIVE_IDS = {
  blueTargets: {
    carrier:   'RED-GBPA',
    logistics: ['RED-AOR-G', 'RED-GLOG', 'RED-AKE'],
    amphib:    'RED-GANF',
    nucsub:    'RED-KSN',
    surface:   ['RED-GBPA', 'RED-GE-1', 'RED-GE-2', 'RED-GE-3', 'RED-GANF'],
  },
  redTargets: {
    fpsos: ['BLUE-FPSO1', 'BLUE-FPSO2', 'BLUE-FPSO3', 'BLUE-FPSO4'],
    ports: ['BLUE-PORTO-S', 'BLUE-PORTO-RJ', 'BLUE-PORTO-V', 'BLUE-PORTO-ACU'],
  },
};

// Limiares das condições de vitória — fonte única; os rótulos exibidos são
// derivados destes números para que UI e regra nunca divirjam.
const OBJECTIVE_THRESHOLDS = {
  blueLogisticsKills: 2,   // de 3 navios logísticos vermelhos
  blueSurfaceDegPct:  50,  // % do SP agregado dos combatentes de superfície
  redFpsoKills:       3,   // de 4 plataformas FPSO
  redPortDegPct:      40,  // % do SP agregado dos 4 portos
};

// `progress` é a fração real de conclusão (0..1) de cada condição, inclusive
// crédito parcial nas condições binárias (dano relativo no alvo). É o que a
// adjudicação por limite de turnos usa, para recompensar dano entregue em vez
// de contagem de condições baratas.
const frac = (cur, need) => (need > 0 ? Math.min(1, Math.max(0, cur / need)) : 0);
const killProgress = unit => (!unit ? 1 : frac(unit.maxHp - Math.max(0, unit.hp), unit.maxHp));

function computeObjectives(state) {
  const u = state.units;
  const BT = OBJECTIVE_IDS.blueTargets, RT = OBJECTIVE_IDS.redTargets;
  const TH = OBJECTIVE_THRESHOLDS;

  // ─── Blue objectives (need ≥ 3 of 5) ────────────────────────────────────────
  const carrier  = u.find(x => x.id === BT.carrier);
  const carrierMet = !carrier || carrier.hp <= 0;

  const logUnits  = BT.logistics.map(id => u.find(x => x.id === id)).filter(Boolean);
  const logDead   = logUnits.filter(x => x.hp <= 0).length;
  const logMet    = logDead >= TH.blueLogisticsKills;

  const amphib    = u.find(x => x.id === BT.amphib);
  const amphibMet = !amphib || amphib.hp <= 0;

  const nucsub    = u.find(x => x.id === BT.nucsub);
  const nucsubMet = !nucsub || nucsub.hp <= 0;

  const surfUnits = BT.surface.map(id => u.find(x => x.id === id)).filter(Boolean);
  const surfMax   = surfUnits.reduce((s, x) => s + x.maxHp, 0);
  const surfCur   = surfUnits.reduce((s, x) => s + Math.max(0, x.hp), 0);
  const surfDegPct = surfMax > 0 ? Math.round((1 - surfCur / surfMax) * 100) : 0;
  const surfMet   = surfDegPct >= TH.blueSurfaceDegPct;

  const blueConds = [
    { id: 'carrier',   label: 'Destruir Porta-Aviões',          met: carrierMet,
      progress: killProgress(carrier),
      current: carrier   ? `SP: ${carrier.hp}/${carrier.maxHp}` : 'Destruído ✓' },
    { id: 'logistics', label: `Neutralizar ${TH.blueLogisticsKills} de ${logUnits.length} Logísticos`, met: logMet,
      progress: frac(logDead, TH.blueLogisticsKills),
      current: `${logDead}/${logUnits.length} neutralizados (precisa ${TH.blueLogisticsKills})` },
    { id: 'amphib',    label: 'Neutralizar GT Anfíbio',          met: amphibMet,
      progress: killProgress(amphib),
      current: amphib    ? `SP: ${amphib.hp}/${amphib.maxHp}` : 'Neutralizado ✓' },
    { id: 'nucsub',    label: 'Destruir Submarino Nuclear',      met: nucsubMet,
      progress: killProgress(nucsub),
      current: nucsub    ? `SP: ${nucsub.hp}/${nucsub.maxHp}` : 'Destruído ✓' },
    { id: 'surface',   label: `Degradar ≥${TH.blueSurfaceDegPct}% Nav. Combatentes`, met: surfMet,
      progress: frac(surfDegPct, TH.blueSurfaceDegPct),
      current: `${surfDegPct}% degradado` },
  ];
  const blueAchieved = blueConds.filter(c => c.met).length;

  // ─── Red objectives (need both) ──────────────────────────────────────────────
  const fpsoUnits = RT.fpsos.map(id => u.find(x => x.id === id)).filter(Boolean);
  const fpsoNeut  = fpsoUnits.filter(x => x.hp <= 0).length;
  const fpsoMet   = fpsoNeut >= TH.redFpsoKills;

  const portUnits = RT.ports.map(id => u.find(x => x.id === id)).filter(Boolean);
  const portMax   = portUnits.reduce((s, x) => s + x.maxHp, 0);
  const portCur   = portUnits.reduce((s, x) => s + Math.max(0, x.hp), 0);
  const portDegPct = portMax > 0 ? Math.round((1 - portCur / portMax) * 100) : 0;
  const portsMet  = portDegPct >= TH.redPortDegPct;

  const redConds = [
    { id: 'fpsos', label: `Neutralizar ${TH.redFpsoKills} de ${fpsoUnits.length} FPSOs`, met: fpsoMet,
      progress: frac(fpsoNeut, TH.redFpsoKills),
      current: `${fpsoNeut}/${fpsoUnits.length} neutralizadas (precisa ${TH.redFpsoKills})` },
    { id: 'ports', label: `Degradar ≥${TH.redPortDegPct}% Portos`,   met: portsMet,
      progress: frac(portDegPct, TH.redPortDegPct),
      current: `${portDegPct}% degradado  (SP: ${portCur}/${portMax})` },
  ];
  const redAchieved = redConds.filter(c => c.met).length;

  return {
    blue: { conditions: blueConds, needed: 3, achieved: blueAchieved, won: blueAchieved >= 3 },
    red:  { conditions: redConds,  needed: 2, achieved: redAchieved,  won: redAchieved  >= 2 },
  };
}

// Progresso de um lado para a adjudicação por tempo: média das `needed` maiores
// frações de conclusão. Assim os dois lados recebem crédito parcial e condições
// extras irrelevantes não inflam o placar de quem tem mais condições.
function objectiveProgress(side) {
  const fr = side.conditions.map(c => c.progress ?? (c.met ? 1 : 0))
                            .sort((a, b) => b - a)
                            .slice(0, side.needed);
  return fr.length ? fr.reduce((a, b) => a + b, 0) / fr.length : 0;
}

function checkWinner(state) {
  const obj = computeObjectives(state);
  if (obj.blue.won && obj.red.won) return 'blue'; // tiebreak
  if (obj.blue.won) return 'blue';
  if (obj.red.won)  return 'red';
  return null;
}

function nextTurn(state) {
  // ── Reload check (before moved flags are cleared) ────────────────────────────
  const portHexes = new Set(
    state.units.filter(u => u.team === 'blue' && u.hp > 0 && u.type === 'porto')
               .map(u => `${u.col},${u.row}`)
  );
  for (const u of state.units) {
    if (u.hp <= 0) continue;
    if (!u.initWeapons || Object.keys(u.initWeapons).length === 0) continue;

    const hexKey = `${u.col},${u.row}`;
    let reload = false;

    if (u.team === 'blue') {
      if (u.category === 'land') {
        reload = true;
      } else if (u.category === 'air') {
        reload = u.fuel?.wasAtRefuelLocation === true;
      } else if (!u.moved) {
        if (u.category === 'surface' || u.category === 'submarine') {
          reload = portHexes.has(hexKey);
        }
      }
    } else if (u.team === 'red') {
      if (u.category === 'air') {
        reload = u.fuel?.wasAtRefuelLocation === true;
      }
    }

    if (reload) {
      const restored = [];
      for (const [wpn, init] of Object.entries(u.initWeapons)) {
        const cur = u.weapons[wpn]?.quantity ?? 0;
        if (cur < init.quantity) {
          u.weapons[wpn] = { ...init };
          restored.push(wpn.toUpperCase());
        }
      }
      if (restored.length > 0) {
        state.log.unshift(`🔄 ${u.name} recompletou: ${restored.join(', ')}`);
      }
    }
  }

  // ── Fuel: naval refuel for units stacked with a provider at end of turn ──────
  const fuelReports = recoverNavalFuel(state);
  for (const { unit: u } of fuelReports) {
    state.log.unshift(`⛽ ${u.name}(${u.team}) reabasteceu: ${u.fuel.current}/${u.fuel.max} FP.`);
  }

  // ── Fuel: aircraft that landed last turn become ready ─────────────────────
  recoverAircraft(state);

  // ── Advance turn ────────────────────────────────────────────────────────────
  state.units.forEach(u => { u.moved = false; });
  resetFuelTurnCounters(state);

  state.period    = state.period === 'day' ? 'night' : 'day';
  if (state.period === 'day') state.turn++;
  state.phase     = 'movement';
  state.blueDone  = state.redDone = false;
  state.blueAttacks = state.redAttacks = null;
  const per = state.period === 'day' ? 'Diurno' : 'Noturno';
  state.log.unshift(`──── Turno ${state.turn} · Período ${per} ────`);
  state.log.unshift('Fase de Movimentação iniciada.');
  if (state.log.length > 50) state.log = state.log.slice(0, 50);
  saveMovementSnapshot(state);
}

// ─── Damage degradation ───────────────────────────────────────────────────────
function applyDegradation(unit, damageDealt) {
  const ratio = damageDealt / (unit.maxHp || 1);

  // Build pool of categories that can still lose at least 1 point
  const pool = [];

  if (unit.initDetectionRange && Object.values(unit.detectionRange || {}).some(v => v > 1))
    pool.push('detection');
  if ((unit.movement ?? 0) > 1)
    pool.push('movement');
  if (Object.values(unit.capabilities || {}).some(v => v > 1))
    pool.push('combat_capability');
  if (unit.fuel?.fuelType === 'naval' && (unit.fuel.max ?? 0) > 1)
    pool.push('fuel');

  if (pool.length === 0) return null;

  const category = pool[Math.floor(Math.random() * pool.length)];

  if (category === 'detection') {
    const initMax   = Math.max(1, ...Object.values(unit.initDetectionRange));
    const reduction = Math.max(1, Math.floor(ratio * initMax));
    for (const key of Object.keys(unit.detectionRange)) {
      if ((unit.detectionRange[key] ?? 0) > 0)
        unit.detectionRange[key] = Math.max(1, unit.detectionRange[key] - reduction);
    }
    return `Detecção −${reduction}`;
  }

  if (category === 'movement') {
    const reduction = Math.max(1, Math.floor(ratio * (unit.initMovement || 1)));
    unit.movement = Math.max(1, unit.movement - reduction);
    return `Movimentação −${reduction}`;
  }

  if (category === 'combat_capability') {
    const caps = unit.capabilities || {};
    const sorted = Object.entries(caps).filter(([, v]) => v > 1).sort(([, a], [, b]) => b - a);
    if (sorted.length === 0) return null;
    const [capKey, capVal] = sorted[0];
    const initVal   = unit.initCapabilities?.[capKey] ?? capVal;
    const reduction = Math.max(1, Math.floor(ratio * initVal));
    caps[capKey] = Math.max(1, capVal - reduction);
    return `${capKey} −${reduction}`;
  }

  if (category === 'fuel') {
    const reduction = Math.max(1, Math.floor(ratio * (unit.initFuelMax || 1) * 0.5));
    unit.fuel.max     = Math.max(1, unit.fuel.max - reduction);
    if (unit.fuel.current > unit.fuel.max) unit.fuel.current = unit.fuel.max;
    return `Combustível −${reduction}FP`;
  }

  return null;
}

// ─── Bot player (solo mode) ───────────────────────────────────────────────────
// O bot é deliberadamente onisciente (lê state.units sem filtro de detecção):
// compensa a ausência de planejamento humano com informação perfeita.

const BOT_TUNING = {
  aggressiveness:      1.0,             // 0..1 — menor = mais distraível p/ defesa
  opportunityRadius:   2,               // combatente inimigo a este raio vira alvo imediato
  refuelFloor:         FUEL_TURN_LIMIT, // FP mínimo antes de buscar reabastecimento
  logisticsFleeRadius: 4,               // logística foge de combatentes a este raio
  stopHpFrac:          0.4,             // rodada: recua abaixo desta fração de SP
  finishHpThreshold:   2,               // ...exceto se o alvo está a isto de cair
};

const BOT_COMBATANT_TYPES =
  ['carrier','amphib','fragata','destroier','corveta','cruzador','sub_nuclear','submarino','caca','ataque'];
function botIsCombatant(u) { return BOT_COMBATANT_TYPES.includes(u.type); }

function botGenericPrio(u) {
  if (u.type === 'carrier')  return 0;
  if (u.type === 'amphib')   return 1;
  if (['fragata','destroier','corveta','cruzador'].includes(u.type)) return 2;
  if (['sub_nuclear','submarino'].includes(u.type)) return 3;
  if (['caca','ataque','patrulha','patrulha_oc','patrulha_c'].includes(u.type)) return 4;
  return 5;
}

// Pesos de alvo derivados das condições de vitória (menor = mais prioritário).
// Condições já cumpridas são puladas — o bot se re-tarefa ao completar objetivos.
function botObjectiveWeights(state, botTeam) {
  const w   = new Map();
  const obj = computeObjectives(state);
  if (botTeam === 'blue') {
    const met = Object.fromEntries(obj.blue.conditions.map(c => [c.id, c.met]));
    const T   = OBJECTIVE_IDS.blueTargets;
    if (!met.carrier)   w.set(T.carrier, 0);
    if (!met.logistics) T.logistics.forEach(id => w.set(id, 0));
    if (!met.amphib)    w.set(T.amphib, 0);
    if (!met.nucsub)    w.set(T.nucsub, 0);
    if (!met.surface)   T.surface.forEach(id => { if (!w.has(id)) w.set(id, 1); });
  } else {
    const met = Object.fromEntries(obj.red.conditions.map(c => [c.id, c.met]));
    const T   = OBJECTIVE_IDS.redTargets;
    if (!met.fpsos) T.fpsos.forEach(id => w.set(id, 0));
    if (!met.ports) T.ports.forEach(id => w.set(id, 0));
  }
  return w;
}

function botPickTarget(unit, enemies, objWeights = new Map()) {
  const attackable = enemies.filter(e => rangeAgainst(unit.attackRange, e.category) > 0);
  if (!attackable.length) return null;
  const d = e => hexDist(unit.col, unit.row, e.col, e.row);

  // Defesa oportunista: combatente inimigo já colado vence qualquer objetivo
  const oppRadius = Math.round(BOT_TUNING.opportunityRadius * (2 - BOT_TUNING.aggressiveness));
  const near = attackable.filter(e => botIsCombatant(e) && d(e) <= oppRadius);
  if (near.length) {
    return near.sort((a, b) => botGenericPrio(a) - botGenericPrio(b) || d(a) - d(b))[0];
  }
  return attackable.sort((a, b) =>
    (objWeights.get(a.id) ?? 9) - (objWeights.get(b.id) ?? 9) ||
    botGenericPrio(a) - botGenericPrio(b) ||
    d(a) - d(b)
  )[0];
}

// Provedor de reabastecimento aliado mais próximo cujo hex a unidade pode ocupar
// (PORTO-S fica em terra — inacessível a navios; portos rasos, a submarinos).
function botRefuelProvider(unit, state) {
  let best = null, bestD = Infinity;
  for (const o of state.units) {
    if (o.id === unit.id || o.team !== unit.team || (o.hp ?? 0) <= 0) continue;
    if (!isNavalRefuelProvider(o)) continue;
    if (!canEnterTerrain(unit.category, getTerrain(o.col, o.row))) continue;
    const d = hexDist(unit.col, unit.row, o.col, o.row);
    if (d < bestD) { bestD = d; best = o; }
  }
  return best;
}

// FP baixo o suficiente para priorizar reabastecimento sobre a missão.
// Custo estimado da viagem: ~3 FP por turno de deslocamento + 1 de folga.
function botNeedsRefuel(unit, provider) {
  if (unit.fuel?.fuelType !== 'naval' || !provider) return false;
  if (isNavalRefuelProvider(unit)) return false;
  const dist = hexDist(unit.col, unit.row, provider.col, provider.row);
  const tripCost = Math.ceil(dist / Math.max(1, unit.movement)) * 3 + 1;
  return unit.fuel.current <= Math.max(BOT_TUNING.refuelFloor, tripCost);
}

function botMoveToward(unit, target, state) {
  let bestPath = null;
  let bestDist = hexDist(unit.col, unit.row, target.col, target.row);
  const queue   = [{ pos: { col: unit.col, row: unit.row }, path: [{ col: unit.col, row: unit.row }], steps: 0 }];
  const visited = new Set([`${unit.col},${unit.row}`]);
  while (queue.length) {
    const { pos, path, steps } = queue.shift();
    if (steps > 0) {
      const d = hexDist(pos.col, pos.row, target.col, target.row);
      if (d < bestDist) { bestDist = d; bestPath = path; }
    }
    if (steps >= airMovementRange(unit)) continue;
    for (const nb of hexNeighbors(pos.col, pos.row)) {
      const key = `${nb.col},${nb.row}`;
      if (visited.has(key)) continue;
      if (!canEnterTerrain(unit.category, getTerrain(nb.col, nb.row))) continue;
      visited.add(key);
      queue.push({ pos: nb, path: [...path, nb], steps: steps + 1 });
    }
  }
  return bestPath;
}

// Como botMoveToward, mas maximiza a distância mínima às ameaças (fuga).
// BFS raso-primeiro garante o desempate natural por menos passos (menos FP).
function botMoveAway(unit, threats, state) {
  if (!threats.length) return null;
  const minD = (c, r) => Math.min(...threats.map(t => hexDist(c, r, t.col, t.row)));
  let bestPath  = null;
  let bestScore = minD(unit.col, unit.row);
  const queue   = [{ pos: { col: unit.col, row: unit.row }, path: [{ col: unit.col, row: unit.row }], steps: 0 }];
  const visited = new Set([`${unit.col},${unit.row}`]);
  while (queue.length) {
    const { pos, path, steps } = queue.shift();
    if (steps > 0) {
      const s = minD(pos.col, pos.row);
      if (s > bestScore) { bestScore = s; bestPath = path; }
    }
    if (steps >= airMovementRange(unit)) continue;
    for (const nb of hexNeighbors(pos.col, pos.row)) {
      const key = `${nb.col},${nb.row}`;
      if (visited.has(key)) continue;
      if (!canEnterTerrain(unit.category, getTerrain(nb.col, nb.row))) continue;
      visited.add(key);
      queue.push({ pos: nb, path: [...path, nb], steps: steps + 1 });
    }
  }
  return bestPath;
}

function computeBotMoves(state, botTeam) {
  const moves    = [];
  const handled  = new Set();
  const enemies  = state.units.filter(u => u.team !== botTeam && u.hp > 0);
  const own      = state.units.filter(u => u.team === botTeam && u.hp > 0 && !u.moved);
  const objW     = botObjectiveWeights(state, botTeam);
  const enemyCombatants = enemies.filter(botIsCombatant);
  const mobile   = u => u.movement > 0 && u.category !== 'land' && !isFuelDisabled(u);
  const nearest  = (u, list) => list.reduce((best, e) =>
    !best || hexDist(u.col, u.row, e.col, e.row) < hexDist(u.col, u.row, best.col, best.row) ? e : best, null);

  // 1. Logística própria foge de combatentes inimigos próximos
  const plannedDest = new Map();
  const providers = own.filter(u => isNavalRefuelProvider(u) && u.category === 'surface');
  for (const logi of providers) {
    if (!mobile(logi)) continue;
    const threat = nearest(logi, enemyCombatants);
    if (!threat || hexDist(logi.col, logi.row, threat.col, threat.row) > BOT_TUNING.logisticsFleeRadius) continue;
    const path = botMoveAway(logi, enemyCombatants, state);
    if (path && path.length >= 2) {
      moves.push({ unitId: logi.id, path });
      plannedDest.set(logi.id, path[path.length - 1]);
    }
    handled.add(logi.id);
  }

  // 2. Escolta: 1 combatente de superfície cola no logístico mais valioso
  const prime = providers
    .filter(mobile)
    .sort((a, b) => (a.type === 'tanque' ? 0 : 1) - (b.type === 'tanque' ? 0 : 1))[0];
  if (prime) {
    const goal = plannedDest.get(prime.id) ?? { col: prime.col, row: prime.row };
    const escort = own
      .filter(u => botIsCombatant(u) && u.category === 'surface' && mobile(u) &&
                   !handled.has(u.id) && !botNeedsRefuel(u, botRefuelProvider(u, state)))
      .sort((a, b) => hexDist(a.col, a.row, goal.col, goal.row) - hexDist(b.col, b.row, goal.col, goal.row))[0];
    if (escort) {
      if (hexDist(escort.col, escort.row, goal.col, goal.row) > 1) {
        const path = botMoveToward(escort, goal, state);
        if (path && path.length >= 2) moves.push({ unitId: escort.id, path });
      }
      handled.add(escort.id);
    }
  }

  // 3. Demais unidades: reabastecer, decolar com critério, ou avançar ao alvo
  for (const unit of own) {
    if (handled.has(unit.id) || !mobile(unit)) continue;

    const provider = botRefuelProvider(unit, state);
    if (botNeedsRefuel(unit, provider)) {
      if (unit.col === provider.col && unit.row === provider.row) continue; // já empilhado
      const path = botMoveToward(unit, provider, state);
      if (path && path.length >= 2) moves.push({ unitId: unit.id, path });
      continue;
    }

    const target = botPickTarget(unit, enemies, objW);
    if (!target) continue;
    const dist = hexDist(unit.col, unit.row, target.col, target.row);
    const atkR = rangeAgainst(unit.attackRange, target.category);
    if (dist <= atkR) continue;

    // Aeronave pronta só decola se alcançar posição de ataque neste turno
    if (unit.category === 'air' && unit.airStatus === 'ready' &&
        dist - atkR > airMovementRange(unit)) continue;

    const path = botMoveToward(unit, target, state);
    if (path && path.length >= 2) moves.push({ unitId: unit.id, path });
  }
  return moves;
}

function computeBotAttacks(state, botTeam) {
  const attacks = [];
  const objW    = botObjectiveWeights(state, botTeam);
  const enemies = state.units.filter(u => u.team !== botTeam && u.hp > 0);
  for (const unit of state.units.filter(u => u.team === botTeam && u.hp > 0)) {
    if (!canAttack(unit)) continue;
    const d = e => hexDist(unit.col, unit.row, e.col, e.row);
    const inRange = enemies
      .filter(e => {
        const r = rangeAgainst(unit.attackRange, e.category);
        return r > 0 && d(e) <= r;
      })
      .sort((a, b) =>
        (objW.get(a.id) ?? 9) - (objW.get(b.id) ?? 9) ||
        botGenericPrio(a) - botGenericPrio(b) ||
        d(a) - d(b));
    if (inRange.length) attacks.push({ attackerId: unit.id, targetId: inRange[0].id });
  }
  return attacks;
}

// Decisão CONTINUAR/PARAR do bot após a 1ª rodada de um engajamento.
function botBattleRoundDecision(state, engagement, botTeam) {
  const att = state.units.find(u => u.id === engagement.attackerId);
  const def = state.units.find(u => u.id === engagement.targetId);
  const attAlive = att && att.hp > 0;
  const defAlive = def && def.hp > 0;

  if (att && att.team === botTeam) {
    // Atacante: recua sem munição, ou ferido demais com o alvo longe de cair
    if (!attAlive || !defAlive) return 'stop';
    if (getWeaponQuantity(att, engagement.weaponType) <= 0) return 'stop';
    const wounded  = att.hp / att.maxHp < BOT_TUNING.stopHpFrac;
    const nearKill = def.hp <= BOT_TUNING.finishHpThreshold;
    return (wounded && !nearKill) ? 'stop' : 'continue';
  }

  // Defensor: continuar se o grupo tem contra-arma utilizável (ganha iniciativa
  // se o atacante parar); parar só quando nenhum contra-ataque é possível.
  if (!attAlive) return 'stop';
  let group;
  if (engagement.targetCategory === 'surface') {
    group = state.units.filter(u => (u.hp ?? 0) > 0 && u.team === engagement.targetTeam &&
      u.col === engagement.targetCol && u.row === engagement.targetRow);
  } else {
    group = defAlive ? [def] : [];
  }
  const canCounter = group.some(u => {
    if (!canAttack(u) || u.id === att.id) return false;
    const w = selectBestWeapon(u, att, hexDist(u.col, u.row, att.col, att.row));
    return w && !isSingleRoundWeapon(w);
  });
  return canCounter ? 'continue' : 'stop';
}

// Aplica movimentos do bot ao estado (sem I/O de sala) — exportado p/ testes.
function applyBotMovesToState(state, botTeam, moves) {
  for (const { unitId, path } of moves) {
    if (!Array.isArray(path) || path.length < 2) continue;
    const unit = state.units.find(u => u.id === unitId && u.hp > 0);
    if (!unit) continue;
    const dest = path[path.length - 1];
    unit.col = dest.col; unit.row = dest.row; unit.moved = true;
    state.log.unshift(`${unit.name}(${botTeam}) → ${String.fromCharCode(65 + dest.col)}${dest.row + 1}`);
    const dist = path.length - 1;
    if (unit.category !== 'air') {
      spendNavalFuel(unit, navalMoveCost(dist));
    } else {
      unit.airStatus = 'airborne';
      spendAirFuel(unit, dist);
      if (isAirRefuelLocation(unit, state)) unit.fuel.wasAtRefuelLocation = true;
    }
  }
  for (const u of state.units) {
    if (u.hp <= 0 || u.team !== botTeam || u.moved) continue;
    if (u.category === 'air') {
      if (u.airStatus === 'airborne') {
        if (isAirRefuelLocation(u, state)) u.fuel.wasAtRefuelLocation = true;
        else spendAirFuel(u, 1);
      }
    } else { spendNavalFuel(u, navalMoveCost(0)); }
  }
  state[botTeam === 'blue' ? 'blueDone' : 'redDone'] = true;
}

function applyBotMoves(room) {
  const { state } = room;
  if (!state || state.phase !== 'movement') return;
  const bt  = room.botTeam;
  const key = bt === 'blue' ? 'blueDone' : 'redDone';
  if (state[key]) return;

  const moves = computeBotMoves(state, bt);
  gameLogger.logMoves(room.id, state.turn, state.period, bt, moves, state);
  applyBotMovesToState(state, bt, moves);

  if (state.blueDone && state.redDone) {
    const navalEmpty = checkNavalFuelZero(state);
    for (const u of navalEmpty) {
      const pid = room.players[u.team];
      if (pid) io.to(pid).emit('fuel_alert', { unitId: u.id, name: u.name, type: 'naval_empty' });
      state.log.unshift(`⛽ ${u.name}(${u.team}) sem combustível: não pode mover, atacar ou se defender.`);
    }
    const airLost = checkAirFuelLosses(state);
    for (const u of airLost) {
      const pid = room.players[u.team];
      if (pid) io.to(pid).emit('fuel_alert', { unitId: u.id, name: u.name, type: 'air_lost' });
      state.log.unshift(`✈ ${u.name}(${u.team}) perdida por falta de combustível.`);
    }
    state.phase = 'combat';
    state.log.unshift('Fase de Combate iniciada. Declare seus ataques.');
  } else {
    state.log.unshift('BOT encerrou a movimentação.');
  }
  if (state.log.length > 50) state.log = state.log.slice(0, 50);
  broadcast(room);
}

// ─── Server ───────────────────────────────────────────────────────────────────
const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*' } });

app.use(express.static(path.join(__dirname, 'public')));
app.get('/',     (_, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/game', (_, res) => res.sendFile(path.join(__dirname, 'public', 'game.html')));

// Exporta os logs de partidas (data/game-logs/*.jsonl) gravados neste servidor
// como um .zip, para download manual e inclusão no dataset de treinamento.
app.get('/api/export-logs', (_, res) => {
  const logDir = path.join(__dirname, 'data', 'game-logs');
  const files = fs.existsSync(logDir)
    ? fs.readdirSync(logDir).filter(f => f.endsWith('.jsonl'))
    : [];

  if (files.length === 0) {
    return res.status(404).json({ error: 'Nenhum log de partida encontrado neste servidor.' });
  }

  res.attachment(`game-logs_${new Date().toISOString().slice(0, 10)}.zip`);
  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.on('error', err => res.status(500).end(String(err)));
  archive.pipe(res);
  for (const f of files) archive.file(path.join(logDir, f), { name: f });
  archive.finalize();
});

// Exporta o log completo (.jsonl) de UMA partida específica — usado pelo botão
// "Exportar Log Completo" ao final do jogo. Contém todos os eventos registrados
// pelo game_logger (estado inicial, movimentos, ataques, engajamentos e estado final).
app.get('/api/export-logs/:roomId', (req, res) => {
  const roomId = String(req.params.roomId || '').toUpperCase();
  if (!/^[A-Z0-9]+$/.test(roomId)) {
    return res.status(400).json({ error: 'ID de sala inválido.' });
  }
  const logDir = path.join(__dirname, 'data', 'game-logs');
  const file = fs.existsSync(logDir)
    ? fs.readdirSync(logDir).find(f => f.endsWith(`_${roomId}.jsonl`))
    : null;

  if (!file) {
    return res.status(404).json({ error: 'Log não encontrado para esta partida neste servidor.' });
  }
  res.download(path.join(logDir, file), file);
});

const rooms = new Map();
function genId()    { return Math.random().toString(36).slice(2,8).toUpperCase(); }
function genToken() { return crypto.randomBytes(16).toString('hex'); }

// Período de graça para reconexão (ms) — configurável para testes
const REJOIN_GRACE_MS = parseInt(process.env.REJOIN_GRACE_MS, 10) || 75000;

// Encerra a sala quando o período de graça expira sem rejoin.
function endRoomByDisconnect(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;
  room.graceTimer = null;
  if (room.state && !room.state.winner) {
    const obj = computeObjectives(room.state);
    gameLogger.logGameOver(roomId, room.state.turn, null, 'disconnect', obj, room.state);
  }
  const other = room.players.blue || room.players.red;
  if (other) io.to(other).emit('opponent_disconnected', { grace: false });
  rooms.delete(roomId);
}

function broadcast(room) {
  if (!room.state) return;
  if (room.players.blue) io.to(room.players.blue).emit('game_update', stateFor(room.state,'blue'));
  if (room.players.red)  io.to(room.players.red ).emit('game_update', stateFor(room.state,'red'));
}

io.on('connection', socket => {
  console.log('+ connect', socket.id);

  socket.on('create_room', () => {
    const id = genId();
    rooms.set(id, { id, players:{blue:socket.id,red:null}, state:null,
                    rejoinTokens:{blue:genToken(),red:genToken()} });
    socket.data.roomId=id; socket.data.team='blue';
    socket.join(id);
    socket.emit('room_created',{roomId:id,team:'blue'});
  });

  socket.on('create_solo_room', ({ team } = {}) => {
    if (!['blue','red'].includes(team)) { socket.emit('join_error','Equipe inválida.'); return; }
    const id      = genId();
    const botTeam = team === 'blue' ? 'red' : 'blue';
    const room    = { id, players: { blue: null, red: null }, state: null, solo: true, botTeam,
                      rejoinTokens: { blue: genToken(), red: genToken() } };
    room.players[team] = socket.id;
    rooms.set(id, room);
    socket.data.roomId = id; socket.data.team = team;
    socket.join(id);
    room.state = newGame();
    gameLogger.logStart(room.id, room.state);
    socket.emit('game_start', { team, state: stateFor(room.state, team), solo: true, roomId: room.id,
                                rejoinToken: room.rejoinTokens[team] });
  });

  socket.on('join_room', ({roomId}) => {
    const room=rooms.get(roomId?.toUpperCase?.());
    if (!room)           { socket.emit('join_error','Sala não encontrada.'); return; }
    if (room.players.red){ socket.emit('join_error','Sala cheia.');          return; }
    room.players.red=socket.id; socket.data.roomId=room.id; socket.data.team='red';
    socket.join(room.id);
    room.state=newGame();
    gameLogger.logStart(room.id, room.state);
    io.to(room.players.blue).emit('game_start',{team:'blue',state:stateFor(room.state,'blue'),roomId:room.id,
                                                rejoinToken:room.rejoinTokens.blue});
    socket.emit('game_start',{team:'red',state:stateFor(room.state,'red'),roomId:room.id,
                              rejoinToken:room.rejoinTokens.red});
  });

  // ── Rejoin após queda de conexão (período de graça) ────────────────────────
  socket.on('rejoin_room', ({ roomId, team, token } = {}) => {
    const room = rooms.get(roomId);
    if (!room || !room.state || room.state.winner)            { socket.emit('rejoin_failed'); return; }
    if (!['blue','red'].includes(team) || !token
        || room.rejoinTokens?.[team] !== token)               { socket.emit('rejoin_failed'); return; }
    if (room.players[team])                                   { socket.emit('rejoin_failed'); return; }
    room.players[team] = socket.id;
    socket.data.roomId = room.id; socket.data.team = team;
    socket.join(room.id);
    if (room.graceTimer) { clearTimeout(room.graceTimer); room.graceTimer = null; }
    // Em sala 2P, se o outro assento ainda está vago, o relógio continua p/ ele
    const stillVacant = !room.solo && (!room.players.blue || !room.players.red);
    if (stillVacant) room.graceTimer = setTimeout(() => endRoomByDisconnect(room.id), REJOIN_GRACE_MS);
    socket.emit('game_start', { team, state: stateFor(room.state, team), solo: !!room.solo,
                                roomId: room.id, rejoinToken: room.rejoinTokens[team], rejoined: true });

    // Se caiu no meio de um engajamento aguardando CONTINUAR/PARAR, reapresenta
    // a última rodada ao rejoinante — sem isso a partida trava para sempre
    // (o servidor fica esperando uma decisão que o cliente não tem como enviar).
    const st  = room.state;
    const eng = st.phase === 'combat' ? st.combatQueue?.[st.currentEngagementIndex] : null;
    if (eng && eng.results?.length > 0) {
      socket.emit('battle_round_result', {
        engagement: eng,
        result: eng.results[eng.results.length - 1].result,
        mustDecide: st.battleRoundDecisions?.[team] === null,
      });
    }

    const other = team === 'blue' ? room.players.red : room.players.blue;
    if (other) io.to(other).emit('opponent_reconnected');
  });

  // ── Movement ──────────────────────────────────────────────────────────────
  socket.on('commit_moves', ({moves}) => {
    const room=rooms.get(socket.data.roomId);
    if (!room?.state) return;
    const {state}=room, {team}=socket.data;

    if (state.phase!=='movement')                  { socket.emit('action_error','Não é a fase de movimentação.'); return; }
    if (state[team==='blue'?'blueDone':'redDone']) { socket.emit('action_error','Você já encerrou a movimentação.'); return; }

    // Validate all paths before applying any
    for (const {unitId, path} of (moves||[])) {
      if (!Array.isArray(path)||path.length<2) continue;
      const unit=state.units.find(u=>u.id===unitId&&u.team===team&&u.hp>0);
      if (!unit) { socket.emit('action_error',`Unidade ${unitId} inválida.`); return; }
      if (unit.movement === 0) { socket.emit('action_error',`${unit.name}: unidade fixa.`); return; }
      if (isFuelDisabled(unit)) { socket.emit('action_error',`${unit.name}: sem combustível — não pode se mover.`); return; }
      if (path[0].col!==unit.col||path[0].row!==unit.row) { socket.emit('action_error',`Caminho inválido para ${unit.name}.`); return; }
      const maxRange = unit.category === 'air' ? airMovementRange(unit) : unit.movement;
      if (path.length-1>maxRange) { socket.emit('action_error',`${unit.name}: caminho excede alcance máximo.`); return; }
      for (let i=1;i<path.length;i++) {
        const {col,row}=path[i];
        if (col<0||col>=GRID_W||row<0||row>=GRID_H) { socket.emit('action_error',`${unit.name}: posição fora do tabuleiro.`); return; }
        if (hexDist(path[i-1].col,path[i-1].row,col,row)!==1) { socket.emit('action_error',`${unit.name}: passo não adjacente.`); return; }
        if (!canEnterTerrain(unit.category,getTerrain(col,row))) { socket.emit('action_error',`${unit.name}: terreno intransponível em ${String.fromCharCode(65+col)}${row+1}.`); return; }
      }
    }

    // Log decision BEFORE applying moves (captures state the player acted on)
    gameLogger.logMoves(room.id, state.turn, state.period, team, moves, state);

    // Apply all moves and charge movement fuel
    for (const {unitId, path} of (moves||[])) {
      if (!Array.isArray(path)||path.length<2) continue;
      const unit=state.units.find(u=>u.id===unitId&&u.team===team&&u.hp>0);
      if (!unit) continue;
      const dest=path[path.length-1];
      unit.col=dest.col; unit.row=dest.row; unit.moved=true;
      state.log.unshift(`${unit.name}(${team}) → ${String.fromCharCode(65+dest.col)}${dest.row+1}`);
      const dist = path.length - 1;
      if (unit.category !== 'air') {
        spendNavalFuel(unit, navalMoveCost(dist));
      } else {
        // Aircraft that moved: become airborne, spend distance FP
        unit.airStatus = 'airborne';
        spendAirFuel(unit, dist);
        // If they flew to a base, mark for refuel and update home base
        if (isAirRefuelLocation(unit, state)) {
          unit.fuel.wasAtRefuelLocation = true;
          unit.baseHex = { col: dest.col, row: dest.row };
        }
      }
    }

    // Fuel for stationary units of this team
    for (const u of state.units) {
      if (u.hp <= 0 || u.team !== team || u.moved) continue;
      if (u.category === 'air') {
        if (u.airStatus === 'airborne') {
          if (isAirRefuelLocation(u, state)) {
            u.fuel.wasAtRefuelLocation = true;  // landed — ready next turn
          } else {
            spendAirFuel(u, 1);                 // patrol fuel cost
          }
        }
        // 'ready' aircraft: stay ready, no fuel cost
      } else {
        spendNavalFuel(u, navalMoveCost(0)); // stationary = 1 FP
      }
    }

    // Sync unmoved specops to their current host position
    for (const u of state.units) {
      if (u.category !== 'specops' || (u.hp ?? 0) <= 0 || u.moved || u.team !== team) continue;
      if (!u.hostId) continue;
      const host = state.units.find(h => h.id === u.hostId && (h.hp ?? 0) > 0);
      if (host) { u.col = host.col; u.row = host.row; }
    }

    if (team==='blue') state.blueDone=true; else state.redDone=true;
    if (state.blueDone&&state.redDone) {
      // ── End-of-movement fuel alerts ────────────────────────────────────────
      const navalEmpty = checkNavalFuelZero(state);
      for (const u of navalEmpty) {
        const pid = room.players[u.team];
        if (pid) io.to(pid).emit('fuel_alert', { unitId: u.id, name: u.name, type: 'naval_empty' });
        state.log.unshift(`⛽ ${u.name}(${u.team}) sem combustível: não pode mover, atacar ou se defender.`);
      }
      const airLost = checkAirFuelLosses(state);
      for (const u of airLost) {
        const pid = room.players[u.team];
        if (pid) io.to(pid).emit('fuel_alert', { unitId: u.id, name: u.name, type: 'air_lost' });
        state.log.unshift(`✈ ${u.name}(${u.team}) perdida por falta de combustível.`);
      }

      state.phase='combat';
      state.log.unshift('Fase de Combate iniciada. Declare seus ataques.');
    } else {
      const waiting=team==='blue'?'Força Vermelha':'Força Azul';
      state.log.unshift(`${team==='blue'?'Força Azul':'Força Vermelha'} encerrou a movimentação. Aguardando ${waiting}...`);
    }
    if (state.log.length>50) state.log=state.log.slice(0,50);
    broadcast(room);
    // Solo: agendar movimentação do bot após o humano confirmar
    if (room.solo) {
      const btKey = room.botTeam === 'blue' ? 'blueDone' : 'redDone';
      if (!state[btKey]) {
        const snap = state;
        setTimeout(() => { if (room.state === snap) applyBotMoves(room); },
          900 + Math.floor(Math.random() * 700));
      }
    }
  });

  // ── Combat ────────────────────────────────────────────────────────────────
  socket.on('declare_attacks', attacks => {
    const room=rooms.get(socket.data.roomId);
    if (!room?.state) return;
    const {state}=room, {team}=socket.data;
    if (state.phase!=='combat') { socket.emit('action_error','Não é a fase de combate.'); return; }
    gameLogger.logAttacks(room.id, state.turn, state.period, team, attacks, state);
    if (team==='blue') state.blueAttacks=attacks||[]; else state.redAttacks=attacks||[];
    state.log.unshift(`${team==='blue'?'Força Azul':'Força Vermelha'} confirmou ${(attacks||[]).length} ataque(s).`);
    // Solo: bot declara ataques imediatamente após o humano
    if (room.solo) {
      const btAtkKey = room.botTeam === 'blue' ? 'blueAttacks' : 'redAttacks';
      if (state[btAtkKey] === null) {
        const botAtks = computeBotAttacks(state, room.botTeam);
        gameLogger.logAttacks(room.id, state.turn, state.period, room.botTeam, botAtks, state);
        state[btAtkKey] = botAtks;
        const botLabel = room.botTeam === 'blue' ? 'Força Azul (BOT)' : 'Força Vermelha (BOT)';
        state.log.unshift(`${botLabel} confirmou ${botAtks.length} ataque(s).`);
      }
    }
    if (state.blueAttacks!==null && state.redAttacks!==null) {
      state.log.unshift('── Resolução de Combate ──');
      state.combatQueue            = buildCombatQueue(state);
      state.currentEngagementIndex = 0;
      state.battleRoundDecisions   = { blue: null, red: null };
      broadcast(room); // show "confirmed" status to both before first engagement
      if (state.combatQueue.length === 0) {
        finishCombatPhase(room);
      } else {
        startCurrentEngagement(room);
      }
    } else {
      broadcast(room);
    }
  });

  socket.on('battle_round_decision', ({ decision }) => {
    const room=rooms.get(socket.data.roomId);
    if (!room?.state) return;
    const {state}=room, {team}=socket.data;
    if (state.phase !== 'combat') return;
    state.battleRoundDecisions[team] = decision;
    if (room.solo) {
      const eng = state.combatQueue[state.currentEngagementIndex];
      state.battleRoundDecisions[room.botTeam] =
        eng ? botBattleRoundDecision(state, eng, room.botTeam) : 'stop';
    }
    const { blue, red } = state.battleRoundDecisions;
    if (blue && red) processBattleRoundDecision(room);
  });

  socket.on('restart', () => {
    const room=rooms.get(socket.data.roomId);
    if (!room) return;
    if (room.state && !room.state.winner) {
      const obj = computeObjectives(room.state);
      gameLogger.logGameOver(room.id, room.state.turn, null, 'restart', obj, room.state);
    }
    room.state=newGame();
    gameLogger.logStart(room.id, room.state);
    if (room.players.blue) io.to(room.players.blue).emit('game_start',{team:'blue',state:stateFor(room.state,'blue'),solo:!!room.solo,roomId:room.id,rejoinToken:room.rejoinTokens?.blue});
    if (room.players.red)  io.to(room.players.red ).emit('game_start',{team:'red', state:stateFor(room.state,'red'), solo:!!room.solo,roomId:room.id,rejoinToken:room.rejoinTokens?.red});
  });

  socket.on('abandon_game', () => {
    const room=rooms.get(socket.data.roomId); if (!room?.state) return;
    if (room.state.winner) return;
    const myTeam    = socket.data.team;
    const otherTeam = myTeam === 'blue' ? 'red' : 'blue';
    room.state.winner = otherTeam;
    const label = myTeam === 'blue' ? 'Força Azul' : 'Força Vermelha';
    room.state.log.unshift(`🏳 ${label} abandonou o jogo. ${otherTeam === 'blue' ? 'Força Azul' : 'Força Vermelha'} vence por W.O.`);
    const obj = computeObjectives(room.state);
    gameLogger.logGameOver(room.id, room.state.turn, otherTeam, 'abandon', obj, room.state);
    const payload = { winner: otherTeam, objectives: obj, reason: 'abandon' };
    if (room.players.blue) io.to(room.players.blue).emit('game_over', { ...payload, state: stateFor(room.state, 'blue') });
    if (room.players.red)  io.to(room.players.red ).emit('game_over', { ...payload, state: stateFor(room.state, 'red')  });
    if (room.graceTimer) { clearTimeout(room.graceTimer); room.graceTimer = null; }
  });

  socket.on('disconnect', () => {
    const {roomId,team}=socket.data; if (!roomId) return;
    const room=rooms.get(roomId); if (!room) return;
    if (room.players[team] !== socket.id) return; // assento já reocupado por rejoin

    // Sem partida em andamento (lobby) ou já encerrada: encerra na hora
    if (!room.state || room.state.winner) {
      const other=team==='blue'?room.players.red:room.players.blue;
      if (other) io.to(other).emit('opponent_disconnected', { grace: false });
      if (room.graceTimer) clearTimeout(room.graceTimer);
      rooms.delete(roomId);
      return;
    }

    // Partida em andamento: abre período de graça para reconexão
    room.players[team] = null;
    const other=team==='blue'?room.players.red:room.players.blue;
    if (other) io.to(other).emit('opponent_disconnected',
      { grace: true, seconds: Math.round(REJOIN_GRACE_MS / 1000) });
    if (room.graceTimer) clearTimeout(room.graceTimer);
    room.graceTimer = setTimeout(() => endRoomByDisconnect(roomId), REJOIN_GRACE_MS);
  });
});

if (require.main === module) {
  server.listen(PORT, () => console.log(`Servidor em http://localhost:${PORT}`));
}

// Exported for tests (combat internals). Importing the module does not start
// the HTTP/Socket.IO listener thanks to the require.main guard above.
module.exports = {
  newGame, buildCombatQueue, defendingGroup,
  resolveBattleRound, resolveCounterAttacks,
  computeObjectives, OBJECTIVE_IDS, OBJECTIVE_THRESHOLDS, objectiveProgress,
  WEAPON_PRIORITY, BOT_TUNING,
  computeBotMoves, computeBotAttacks, applyBotMovesToState,
  botObjectiveWeights, botPickTarget, botNeedsRefuel, botRefuelProvider,
  botMoveToward, botMoveAway, botBattleRoundDecision,
  nextTurn, checkWinner, MAX_TURNS,
};
