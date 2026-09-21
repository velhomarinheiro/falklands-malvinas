'use strict';

const { COMBAT_CONFIG: COMBAT } = require('./combat_config');

function d6() { return Math.ceil(Math.random() * 6); }

function getWeaponQuantity(unit, weaponType) {
  if (unit.weapons?.[weaponType] != null) return unit.weapons[weaponType].quantity;
  if (unit.capabilities?.[weaponType] != null) return unit.capabilities[weaponType];
  return 0;
}

function getWeaponRange(unit, weaponType) {
  if (unit.weapons?.[weaponType]?.range != null) return unit.weapons[weaponType].range;
  const profile = COMBAT.weaponProfiles?.[weaponType];
  if (!profile) return 0;
  return profile.defaultRange ?? 0;
}

function spendWeapon(unit, weaponType, amount) {
  const profile = COMBAT.weaponProfiles?.[weaponType];
  if (!profile?.expendable) return;
  if (unit.weapons?.[weaponType]) {
    unit.weapons[weaponType].quantity = Math.max(0, unit.weapons[weaponType].quantity - amount);
  }
}

// advantage=true: roll 2d6 take highest (initiative bonus in BR#2)
function resolveDamageRoll(team, damageProfile, targetCategory, advantage = false) {
  const table = COMBAT.damageTables?.[team]?.[damageProfile]?.[targetCategory];
  if (!table) return { roll: 0, reroll: null, damage: 0 };
  let roll = d6();
  if (advantage) { const r2 = d6(); if (r2 > roll) roll = r2; }
  const value = table[String(roll)] ?? 0;
  let reroll = null;
  let damage;
  if (value === '1d6') {
    reroll = d6();
    damage = reroll;
  } else {
    damage = Number(value) || 0;
  }
  return { roll, reroll, damage };
}

function applyDamage(unit, damage) {
  if (damage > 0) unit.hp = Math.max(0, unit.hp - damage);
}

// Returns how many incoming missiles are shot down by the defending group's
// interceptors. `defenders` is an array of units sharing the target's hex that
// contribute to the defense (stacked task group); for a lone target it is just
// [target]. Interceptor capacity for each weapon type is pooled across the group.
function resolveInterception(defenders, incomingWeaponType, incomingAmount) {
  const group = Array.isArray(defenders) ? defenders : [defenders];
  if (group.length === 0) return { intercepted: 0, remaining: incomingAmount, details: [] };
  const profile = COMBAT.weaponProfiles?.[incomingWeaponType];
  if (!profile?.interceptableBy?.length) {
    return { intercepted: 0, remaining: incomingAmount, details: [] };
  }

  const team = group[0].team;
  let remaining = incomingAmount;
  const details = [];

  for (const defWeapon of profile.interceptableBy) {
    // Pool the interceptor capacity of the whole stack for this weapon type.
    const defQty = group.reduce((sum, u) => sum + getWeaponQuantity(u, defWeapon), 0);
    if (defQty <= 0) continue;

    const defProfile = COMBAT.weaponProfiles?.[defWeapon];
    if (!defProfile) continue;

    const shots = Math.min(remaining, defQty);
    let intercepted = 0;
    const rolls = [];
    for (let i = 0; i < shots; i++) {
      // Interception rolls never receive initiative advantage
      const r = resolveDamageRoll(team, defProfile.damageProfile, 'missile');
      rolls.push(r.roll);
      if (r.damage > 0) intercepted++;
    }
    remaining = Math.max(0, remaining - intercepted);
    details.push({ weapon: defWeapon, shots, intercepted, rolls });
    if (remaining <= 0) break;
  }

  return { intercepted: incomingAmount - remaining, remaining, details };
}

// initiativeBonusTeam: team name that rolled with advantage this round, or null
// defenderDisabled: true when defender has 0 naval FP — skips its own interception
// defenders: optional array of units forming the defending stack (group defense).
//            When omitted, falls back to the lone defender (or none, if disabled).
function resolveEngagement({ attacker, defender, defenders, weaponType, amount, distance, initiativeBonusTeam = null, defenderDisabled = false }) {
  const profile = COMBAT.weaponProfiles?.[weaponType];
  if (!profile) return { ok: false, reason: 'Tipo de arma desconhecido: ' + weaponType };

  if (!profile.targets.includes(defender.category)) {
    return { ok: false, reason: `${weaponType} não ataca ${defender.category}` };
  }

  const range = getWeaponRange(attacker, weaponType);
  if (distance > range) {
    return { ok: false, reason: 'Fora de alcance', distance, range };
  }

  const qty = getWeaponQuantity(attacker, weaponType);
  if (qty <= 0) return { ok: false, reason: 'Sem armamento disponível' };

  const launched = Math.min(amount, qty);
  spendWeapon(attacker, weaponType, launched);

  const interceptors = Array.isArray(defenders)
    ? defenders
    : (defenderDisabled ? [] : [defender]);
  const interception = resolveInterception(interceptors, weaponType, launched);
  const effectiveShots = interception.remaining;

  const advantage = initiativeBonusTeam !== null && initiativeBonusTeam === attacker.team;
  const attackRolls = [];
  let totalDamage = 0;
  for (let i = 0; i < effectiveShots; i++) {
    const roll = resolveDamageRoll(attacker.team, profile.damageProfile, defender.category, advantage);
    attackRolls.push(roll);
    totalDamage += roll.damage;
  }

  applyDamage(defender, totalDamage);
  const destroyed = defender.hp <= 0;

  return {
    ok: true,
    attackerId:          attacker.id,
    defenderId:          defender.id,
    weaponType,
    weaponLabel:         profile.label,
    targetCategory:      defender.category,
    distance,
    range,
    launched,
    expendable:          profile.expendable,
    interception,
    effectiveShots,
    attackRolls,
    totalDamage,
    remainingHp:         defender.hp,
    destroyed,
    initiativeBonusTeam,
    advantage,
  };
}

module.exports = {
  d6,
  getWeaponQuantity,
  getWeaponRange,
  spendWeapon,
  resolveDamageRoll,
  applyDamage,
  resolveInterception,
  resolveEngagement,
};
