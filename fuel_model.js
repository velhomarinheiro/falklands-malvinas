'use strict';

// ─── Constants ────────────────────────────────────────────────────────────────
const FUEL_TURN_LIMIT = 4;            // max FP a naval unit may spend per turn

const NAVAL_FP = {
  surface:   12,  // fallback for unlisted surface units
  submarine: 20,  // 20 turns = 10 days at 2 turns/day (conventional AIP)
};

// Per-unit FP overrides (surface ships only; subs use NAVAL_FP.submarine).
// v2: valores das tabelas de Fuel Points dos dois cadernos (planilha do autor,
// aba "Divergências e Notas" — unidades sem entrada aqui usam NAVAL_FP.surface).
const UNIT_FP = {
  // ── Força Azul (Argentina) ──────────────────────────────────────────────────
  'BLUE-VM':       12,   // GT Porta-Aviões
  'BLUE-VE':       10,   // Escolta GT-PA
  'BLUE-BV':       10,   // Esquadra de Corvetas
  'BLUE-B':        10,   // Belgrano
  'BLUE-BS':       10,   // Escolta Belgrano
  'BLUE-LOG-1':    24,   // Petroleiro ARA Punta Médanos
  'BLUE-LOG-2':    24,   // Petroleiro ARA Punta Delgada
  'BLUE-LOG-3':    24,   // Petroleiro de Serviço Geral
  'BLUE-MCM':       6,   // Grupo Caça-Minas
  'BLUE-LG':       12,   // Grupo de Desembarque
  // ── Força Vermelha (Reino Unido) ────────────────────────────────────────────
  'RED-HERMES':    12,   // HMS Hermes
  'RED-INVINCIBLE':12,   // HMS Invincible
  'RED-SCR-1':     10,   // Screen 1
  'RED-SCR-2':     10,   // Screen 2
  'RED-ESC-1':     10,   // Escort 1
  'RED-ESC-2':     10,   // Escort 2
  'RED-LOG-1':     24,   // RFA Olmeda
  'RED-LOG-2':     24,   // RFA Appleleaf
  'RED-SG-SCR':    10,   // South Georgia Screen
  'RED-SG-ICE':    10,   // HMS Endurance
  'RED-LOG-3':     24,   // RFA Tidespring
  'RED-TRAIL':     10,   // Trail Screen
  'RED-LOG-4':     24,   // RFA Plumleaf
  'RED-TANK':      48,   // RFA British Tay
  'RED-LAND-SCR':  10,   // Landing Screen
  'RED-LPD':       12,   // Fearless / Intrepid
  'RED-TROOP':     10,   // SS Canberra / QE2
  'RED-AC':        10,   // SS Atlantic Conveyor
  'RED-LOG-5':     24,   // RFA Bayleaf
  'RED-MCM':        6,   // Esquadrilha Caça-Minas
  'RED-HOSP':      12,   // Navio-Hospital
  'RED-LR':        10,   // SS Norland / Atlantic Causeway
  'RED-TANK-2':    48,   // RFA British Tamar / British Esk
};

// Unidades que começam com o tanque pela metade (petroleiros de escalões
// posteriores, ainda não completados na zona de exclusão) — mesma fonte.
const UNIT_FP_INITIAL = {
  'BLUE-LOG-1': 12, 'BLUE-LOG-2': 12,
  'RED-LOG-1': 12, 'RED-LOG-2': 12, 'RED-LOG-3': 12, 'RED-LOG-4': 12, 'RED-LOG-5': 12,
};

// unit.type values (from COMP_DISPLAY_TYPE in server.js)
const NUCLEAR_SUB_TYPE    = 'sub_nuclear';

// ─── Classification ───────────────────────────────────────────────────────────
function isNuclearSub(unit)     { return unit.category === 'submarine' && unit.type === NUCLEAR_SUB_TYPE; }
function isConventionalSub(unit){ return unit.category === 'submarine' && !isNuclearSub(unit); }
function isTanker(unit)         { return unit.type === 'tanque'; }
function isLogistics(unit)      { return unit.type === 'logistico'; }
function isPort(unit)           { return unit.type === 'porto'; }

// Can this naval/sub unit refuel other naval units when stacked?
function isNavalRefuelProvider(unit) {
  return (unit.hp ?? 0) > 0 && (isTanker(unit) || isLogistics(unit) || isPort(unit));
}

// Does this unit consume naval FP?
function usesNavalFuel(unit) {
  if (isNuclearSub(unit)) return false;
  if (unit.category === 'surface') return true;
  return isConventionalSub(unit);
}

// ─── Initialization ───────────────────────────────────────────────────────────
function initializeFuel(unit) {
  if (unit.category === 'air') {
    unit.airStatus = 'ready';     // ready | airborne
    // FP = 2 × movement so that movement_range = floor(FP/2) = movement
    const fp = (unit.movement ?? 0) * 2;
    unit.fuel = {
      usesFuel: true,
      fuelType: 'air',
      current:  fp,
      max:      fp,
      wasAtRefuelLocation: false,
    };
    return;
  }

  if (!usesNavalFuel(unit)) {
    unit.fuel = { usesFuel: false, fuelType: 'none' };
    return;
  }

  const max = isConventionalSub(unit)
    ? NAVAL_FP.submarine
    : (UNIT_FP[unit.id] ?? NAVAL_FP.surface);
  unit.fuel = {
    usesFuel: true,
    fuelType: 'naval',
    current:  UNIT_FP_INITIAL[unit.id] ?? max,
    max,
    spentThisTurn: 0,
  };
}

// ─── Fuel-state queries ───────────────────────────────────────────────────────
function isFuelDisabled(unit) {
  return unit.fuel?.fuelType === 'naval' && (unit.fuel.current ?? 1) <= 0;
}

// Naval units with 0 FP can't move, attack or defend.
// Air: only 'recovering' aircraft can't attack.
function canMove(unit)   { return !isFuelDisabled(unit); }
function canAttack(unit) {
  if (unit.category === 'air') return true;
  return !isFuelDisabled(unit);
}
function canDefend(unit) {
  if (unit.category === 'air') return true;
  return !isFuelDisabled(unit);
}

// ─── Naval fuel spending ──────────────────────────────────────────────────────
// Returns FP cost for a naval unit given movement distance.
function navalMoveCost(distance) {
  if (distance === 0) return 1;   // stationary / holding position
  if (distance >= 3)  return 3;
  return distance;                // 1 or 2
}

function spendNavalFuel(unit, amount) {
  if (!unit.fuel?.usesFuel || unit.fuel.fuelType !== 'naval') return;
  const cap     = Math.max(0, FUEL_TURN_LIMIT - (unit.fuel.spentThisTurn || 0));
  const actual  = Math.min(amount, cap, unit.fuel.current ?? 0);
  unit.fuel.current      = Math.max(0, (unit.fuel.current ?? 0) - actual);
  unit.fuel.spentThisTurn = (unit.fuel.spentThisTurn || 0) + actual;
}

// ─── Air fuel spending ────────────────────────────────────────────────────────
// Only airborne aircraft burn FP.
function spendAirFuel(unit, amount) {
  if (unit.category !== 'air' || unit.airStatus !== 'airborne') return;
  unit.fuel.current = Math.max(0, (unit.fuel.current ?? 0) - amount);
}

// ─── Convenience wrappers used in server.js ───────────────────────────────────
function spendEngagementFuel(unit) {
  if (unit.category === 'air') { spendAirFuel(unit, 1); return; }
  spendNavalFuel(unit, 1);
}

function spendDamageFuel(unit) {
  if (unit.category === 'air') { spendAirFuel(unit, 1); return; }
  spendNavalFuel(unit, 1);
}

// ─── Stacking / refuel (naval) ────────────────────────────────────────────────
function hasRefuelProvider(unit, allUnits) {
  return allUnits.some(o =>
    o.id !== unit.id && o.team === unit.team &&
    o.col === unit.col && o.row === unit.row &&
    isNavalRefuelProvider(o)
  );
}

// Called at the END of each turn (before the next turn begins).
// A naval unit is refuelled if it is stacked with a provider at that moment,
// regardless of whether it arrived there during the turn just finished.
function recoverNavalFuel(state) {
  const reports = [];
  for (const u of state.units) {
    if ((u.hp ?? 0) <= 0 || u.fuel?.fuelType !== 'naval') continue;
    if (!hasRefuelProvider(u, state.units)) continue;
    if ((u.fuel.current ?? 0) >= u.fuel.max) continue;
    const before = u.fuel.current;
    u.fuel.current = u.fuel.max;
    reports.push({ unit: u, recovered: u.fuel.max - before });
  }
  return reports;
}

// ─── End-of-movement-phase checks ─────────────────────────────────────────────
// Returns naval units that are at 0 FP (need alerting).
function checkNavalFuelZero(state) {
  return state.units.filter(u =>
    (u.hp ?? 0) > 0 && u.fuel?.fuelType === 'naval' && (u.fuel.current ?? 1) <= 0
  );
}

// Airborne aircraft with 0 FP that didn't reach a base are lost (hp → 0).
function checkAirFuelLosses(state) {
  const lost = [];
  for (const u of state.units) {
    if ((u.hp ?? 0) <= 0 || u.category !== 'air') continue;
    if (u.airStatus !== 'airborne') continue;
    if (u.fuel?.wasAtRefuelLocation) continue;   // made it back safely
    if ((u.fuel?.current ?? 1) <= 0) {
      u.hp = 0;
      lost.push(u);
    }
  }
  return lost;
}

// ─── Turn transition ──────────────────────────────────────────────────────────
// Aircraft that ended their turn at a base → 'ready' (full fuel); called at turn start.
// Weapon restoration is done in server.js nextTurn using the same flag.
function recoverAircraft(state) {
  for (const u of state.units) {
    if (u.category !== 'air' || !u.fuel?.wasAtRefuelLocation) continue;
    u.airStatus               = 'ready';
    u.fuel.current            = u.fuel.max;
    u.fuel.wasAtRefuelLocation = false;
  }
}

function resetFuelTurnCounters(state) {
  for (const u of state.units) {
    if (u.fuel?.spentThisTurn !== undefined) u.fuel.spentThisTurn = 0;
  }
}

module.exports = {
  initializeFuel,
  usesNavalFuel,
  isNavalRefuelProvider,
  isFuelDisabled,
  canMove,
  canAttack,
  canDefend,
  navalMoveCost,
  spendNavalFuel,
  spendAirFuel,
  spendEngagementFuel,
  spendDamageFuel,
  hasRefuelProvider,
  recoverNavalFuel,
  checkNavalFuelZero,
  checkAirFuelLosses,
  recoverAircraft,
  resetFuelTurnCounters,
  FUEL_TURN_LIMIT,
};
