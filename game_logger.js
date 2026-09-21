'use strict';
/**
 * game_logger.js — Registrador de partidas para treinamento de ML
 *
 * Grava um arquivo JSONL por partida em data/game-logs/.
 * Cada linha é um evento JSON com: evento, timestamp, estado do jogo
 * e a decisão tomada pelo jogador naquele momento.
 *
 * Eventos registrados:
 *   game_start          — estado inicial completo
 *   movement_committed  — decisão de movimentação de uma equipe (estado + movimentos)
 *   attacks_declared    — declaração de ataques de uma equipe (estado + ataques)
 *   engagement_resolved — resultado de cada engajamento de combate
 *   game_over           — estado final, vencedor e objetivos
 *
 * Os arquivos ficam em data/game-logs/ dentro do repositório e devem ser
 * comitados periodicamente para acumular o dataset de treinamento.
 */

const fs   = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, 'data', 'game-logs');

if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// ── Serialização do estado ─────────────────────────────────────────────────────
// Inclui apenas campos relevantes para ML; omite buffers internos de controle de turno.
function snapshotState(state) {
  return {
    turn:   state.turn,
    period: state.period,
    phase:  state.phase,
    units:  state.units.map(u => ({
      id:        u.id,
      team:      u.team,
      col:       u.col,
      row:       u.row,
      hp:        u.hp,
      maxHp:     u.maxHp,
      category:  u.category,
      type:      u.type,
      moved:     u.moved   || false,
      fuel:      u.fuel    ? { current: u.fuel.current, max: u.fuel.max } : null,
      weapons:   u.weapons || null,
      airStatus: u.airStatus || null,
    })),
  };
}

// ── Handles de arquivo abertos (roomId → { path }) ────────────────────────────
const _handles = new Map();

function _append(roomId, record) {
  const h = _handles.get(roomId);
  if (!h) return;
  try {
    fs.appendFileSync(h.path, JSON.stringify(record) + '\n');
  } catch (err) {
    console.error('[GameLogger] Erro ao gravar log:', err.message);
  }
}

function _ts() { return new Date().toISOString(); }

// ── API pública ────────────────────────────────────────────────────────────────

/**
 * Abre o arquivo de log de uma nova partida e registra o estado inicial.
 * Deve ser chamado logo após newGame() no join_room.
 */
function logStart(roomId, state) {
  const ts   = _ts();
  const date = ts.slice(0, 10).replace(/-/g, '');
  const time = ts.slice(11, 19).replace(/:/g, '');
  const file = path.join(LOG_DIR, `game_${date}_${time}_${roomId}.jsonl`);
  _handles.set(roomId, { path: file });
  _append(roomId, {
    event: 'game_start',
    ts,
    room:  roomId,
    state: snapshotState(state),
  });
}

/**
 * Registra a decisão de movimentação de uma equipe.
 * Deve ser chamado ANTES de aplicar os movimentos ao estado.
 * @param {string[]} moves  Array de { unitId, path }
 */
function logMoves(roomId, turn, period, team, moves, stateBefore) {
  _append(roomId, {
    event:  'movement_committed',
    ts:     _ts(),
    room:   roomId,
    turn,
    period,
    team,
    moves:  (moves || []).map(({ unitId, path }) => ({ unitId, path })),
    state:  snapshotState(stateBefore),
  });
}

/**
 * Registra os ataques declarados por uma equipe.
 * Deve ser chamado logo após receber declare_attacks, antes da resolução.
 * @param {object[]} attacks  Array de { attackerId, targetId, amount }
 */
function logAttacks(roomId, turn, period, team, attacks, stateBefore) {
  _append(roomId, {
    event:   'attacks_declared',
    ts:      _ts(),
    room:    roomId,
    turn,
    period,
    team,
    attacks: (attacks || []).map(({ attackerId, targetId, amount }) =>
      ({ attackerId, targetId, amount: amount ?? null })
    ),
    state:   snapshotState(stateBefore),
  });
}

/**
 * Registra o resultado de um engajamento resolvido.
 * Deve ser chamado em finishCurrentEngagement antes de avançar o índice.
 */
function logEngagement(roomId, turn, period, engagement) {
  _append(roomId, {
    event:  'engagement_resolved',
    ts:     _ts(),
    room:   roomId,
    turn,
    period,
    engagement: {
      id:              engagement.id,
      attackerId:      engagement.attackerId,
      targetId:        engagement.targetId,
      weaponType:      engagement.weaponType,
      amount:          engagement.amount,
      maxBattleRounds: engagement.maxBattleRounds,
      results:         engagement.results,
    },
  });
}

/**
 * Registra o encerramento da partida e fecha o arquivo.
 * Deve ser chamado em finishCombatPhase (victory / timeout), abandon_game,
 * restart e disconnect.
 * @param {string|null} winner  'blue' | 'red' | null (partida incompleta)
 * @param {string}      reason  'victory' | 'timeout' | 'abandon' | 'restart' | 'disconnect'
 */
function logGameOver(roomId, turn, winner, reason, objectives, state) {
  _append(roomId, {
    event:      'game_over',
    ts:         _ts(),
    room:       roomId,
    turn,
    winner,
    reason,
    objectives,
    state:      snapshotState(state),
  });
  _handles.delete(roomId);
}

module.exports = { logStart, logMoves, logAttacks, logEngagement, logGameOver };
