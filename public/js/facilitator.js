'use strict';
// ═════════════════════════════════════════════════════════════════════════════
// FACILITADOR / INSTRUTOR
// Painéis e interação do facilitador numa sala com facilitador. O servidor é
// a autoridade: aqui só se montam os comandos fac_* e se mostra o estado.
// Depende de client.js (socket, gameState, selUnitId, render, updateUI...).
// ═════════════════════════════════════════════════════════════════════════════

// Modo "posicionar": o próximo clique no mapa define o hexágono.
//   { kind: 'move', unitId }                  → reposiciona uma unidade
//   { kind: 'neutral', template, name }       → cria um neutro ali
let facPlace = null;
const facHpEdits = new Map();     // ratificação: unitId → SP proposto
let facEditState = { unitId: null, sig: '', dirty: false };

const NEUTRAL_TPL_CATEGORY = { mercante: 'surface', pesqueiro: 'surface', hospital: 'surface', pesquisa: 'surface', aeronave: 'air' };
const hexTxt = (col, row) => `${hexLabel(col)}${row + 1}`;
const teamCls = team => team === 'blue' ? 'cm-blue' : team === 'red' ? 'cm-red' : 'cm-neutral';
const unitById = id => gameState?.units.find(u => u.id === id);

// ─── Interação com o mapa ────────────────────────────────────────────────────
function facHandleClick(col, row) {
  if (facPlace) {
    if (facPlace.kind === 'move') {
      socket.emit('fac_move_unit', { unitId: facPlace.unitId, col, row });
    } else {
      socket.emit('fac_add_neutral', { template: facPlace.template, name: facPlace.name, col, row });
    }
    SFX.play('confirm');
    facSetPlace(null);
    return;
  }
  const units = gameState.units.filter(u => u.col === col && u.row === row && u.hp > 0);
  if (!units.length) { deselect(false); return; }
  if (units.length > 1) { showStackPicker(col, row, units); return; }
  facSelect(units[0].id);
}

function facSelect(unitId) {
  selUnitId = unitId; selGroupIds = []; activePath = [];
  moveHexes = []; atkHexes = []; reachableHexes = new Map();
  SFX.play('select');
  updateUI(); render();
}

function facSetPlace(place) {
  facPlace = place;
  const hint = $('fac-place-hint');
  if (!place) { hint.classList.add('hidden'); render(); return; }
  const what = place.kind === 'move' ? unitById(place.unitId)?.name : (place.name || t(`fac.tpl${place.template[0].toUpperCase()}${place.template.slice(1)}`));
  hint.textContent = t('fac.placeHint', { name: what || '?' });
  hint.classList.remove('hidden');
  render();
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && facPlace) facSetPlace(null);
});

// Algo depende do facilitador agora? (acende o "SUA VEZ")
function facNeedsAction() {
  const s = gameState;
  if (!s || s.winner) return false;
  if (s.phase === 'setup') return !!(s.seats?.blue && s.seats?.red);
  return s.phase === 'movement_approval' || s.phase === 'combat_approval';
}

// ─── Desenho no mapa ─────────────────────────────────────────────────────────
function facDrawOverlays() {
  const s = gameState;
  // Rotas dos movimentos aguardando autorização (negados não aparecem).
  if (s.phase === 'movement_approval') {
    for (const m of s.fac?.pendingMoves || []) {
      if (m.denied || !m.path || m.path.length < 2) continue;
      const c = m.team === 'blue' ? '100,180,255' : '255,120,110';
      drawPathTrail(m.path, `rgba(${c},0.14)`, `rgba(${c},0.55)`, `rgba(${c},0.30)`, `rgba(${c},0.95)`);
    }
  }
  // Posicionamento: hexágono sob o cursor em dourado (válido) ou vermelho.
  if (facPlace && hoverHex && hoverHex.col >= 0 && hoverHex.col < GRID_W && hoverHex.row >= 0 && hoverHex.row < GRID_H) {
    const cat = facPlace.kind === 'move' ? unitById(facPlace.unitId)?.category : NEUTRAL_TPL_CATEGORY[facPlace.template];
    const ok  = canEnterTerrain(cat, TERRAIN_MAP[hoverHex.row][hoverHex.col]);
    const {x, y} = hexToPixel(hoverHex.col, hoverHex.row);
    drawHex(ctx, x, y, ok ? 'rgba(255,213,79,0.30)' : 'rgba(255,60,60,0.25)',
                       ok ? 'rgba(255,213,79,0.95)' : 'rgba(255,80,80,0.9)', 2.2);
  }
}

// ─── Painéis ─────────────────────────────────────────────────────────────────
function facRenderPanels() {
  const s = gameState;
  const open = !s.winner;
  $('fac-panel').classList.remove('hidden');
  $('fac-neutral-panel').classList.toggle('hidden', !open);
  $('fac-msg-panel').classList.toggle('hidden', !open || s.phase === 'setup');
  facRenderStatus();
  facRenderPhase();
  facRenderEditor();
  facRenderSentMessages();
}

function facRenderStatus() {
  const s = gameState;
  const seat = (team, label) => {
    const on = s.seats?.[team];
    return `<div class="fac-seat ${on ? teamCls(team) : 'fac-dim'}">${on ? '●' : '○'} ${label} — ${on ? t('fac.seatConnected') : t('fac.seatWaiting')}</div>`;
  };
  setHtml($('fac-status'), `
    <div class="fac-room-line">
      <span class="fac-dim">${t('fac.roomCode')}</span>
      <span class="fac-room-code">${currentRoomId || '——'}</span>
      <button type="button" class="fac-mini-btn" data-fac-copy>${t('game.copyCode')}</button>
    </div>
    ${seat('blue', t('team.blueTitle'))}
    ${seat('red',  t('team.redTitle'))}`);
}

function facRenderPhase() {
  const s = gameState;
  const el = $('fac-phase');
  const done = v => v ? `<span class="fac-ok">✓</span>` : `<span class="fac-dim">…</span>`;

  if (s.winner) { setHtml(el, `<p class="fac-hint">${t('fac.gameEnded')}</p>`); return; }

  if (s.phase === 'setup') {
    const ready = s.seats?.blue && s.seats?.red;
    setHtml(el, `
      <p class="fac-hint">${t('fac.setupHelp')}</p>
      <button type="button" class="act-btn yellow" data-fac="start" ${ready ? '' : 'disabled'}>${t('fac.startGame')}</button>
      ${ready ? '' : `<p class="fac-hint">${t('fac.waitPlayers')}</p>`}`);
    return;
  }

  if (s.phase === 'movement') {
    setHtml(el, `<div class="fac-progress">${t('fac.teamsMoving')}
      <div>${t('team.blueTitle')} ${done(s.blueDone)} · ${t('team.redTitle')} ${done(s.redDone)}</div></div>`);
    return;
  }

  if (s.phase === 'combat') {
    const n = a => Array.isArray(a) ? a.length : 0;
    const resolving = s.blueAttacks !== null && s.redAttacks !== null;
    setHtml(el, `<div class="fac-progress">${resolving ? t('fac.resolving') : t('fac.teamsAttacking')}
      <div>${t('team.blueTitle')} ${done(s.blueAttacks !== null)} ${s.blueAttacks !== null ? `(${n(s.blueAttacks)})` : ''}
        · ${t('team.redTitle')} ${done(s.redAttacks !== null)} ${s.redAttacks !== null ? `(${n(s.redAttacks)})` : ''}</div></div>`);
    return;
  }

  if (s.phase === 'movement_approval') {
    const moves = s.fac?.pendingMoves || [];
    const rows = moves.map(m => {
      const u = unitById(m.unitId);
      if (!u) return '';
      const status = m.denied ? `<span class="fac-denied">${t('fac.denied')}</span>`
        : `${hexTxt(m.from.col, m.from.row)} → ${hexTxt(m.to.col, m.to.row)}`;
      return `<div class="fac-move-row">
        <span class="${teamCls(m.team)}">${escapeHtml(u.name)}</span>
        <span class="fac-dim">${status}</span>
        <span class="fac-row-btns">
          ${m.denied ? '' : `<button type="button" class="fac-mini-btn" data-fac="deny" data-unit="${m.unitId}" title="${t('fac.denyTitle')}">↩ ${t('fac.deny')}</button>`}
          <button type="button" class="fac-mini-btn" data-fac="place" data-unit="${m.unitId}" title="${t('fac.repositionTitle')}">📍</button>
        </span>
      </div>`;
    }).join('');
    setHtml(el, `
      <p class="fac-hint">${t('fac.moveApprovalHelp')}</p>
      <div class="fac-list">${rows || `<p class="fac-dim">${t('fac.noMoves')}</p>`}</div>
      <button type="button" class="act-btn yellow" data-fac="approve-moves">${t('fac.approveMoves')}</button>`);
    return;
  }

  if (s.phase === 'combat_approval') {
    const report = s.fac?.combatReport || [];
    const engRows = report.map(e => {
      const att = unitById(e.attackerId), def = unitById(e.targetId);
      const dmg = e.rounds.reduce((a, r) => a + r.damage, 0);
      const killed = e.rounds.some(r => r.destroyed);
      const res = killed ? `💥 ${t('battle.destroyed')}` : dmg > 0 ? `−${dmg}SP` : t('fac.noEffect');
      return `<div class="fac-eng-row">
        <span class="fac-dim">${e.id}</span>
        <span class="${teamCls(att?.team)}">${escapeHtml(att?.name || e.attackerId)}</span> →
        <span class="${teamCls(def?.team)}">${escapeHtml(def?.name || e.targetId)}</span>
        <span class="fac-dim">[${weaponLabel(e.weaponType)}]</span> <b>${res}</b>
      </div>`;
    }).join('');

    // Unidades cujo SP mudou no combate (inclui contra-ataques e perdas junto
    // com o transporte), mais qualquer uma que o facilitador já tenha ajustado.
    const snap = s.fac?.combatHpSnapshot || {};
    const changed = s.units.filter(u => u.team !== 'neutral' &&
      ((snap[u.id] != null && snap[u.id] !== u.hp) || facHpEdits.has(u.id)));
    const hpRows = changed.map(u => {
      const before = snap[u.id] ?? u.hp;
      const val = facHpEdits.has(u.id) ? facHpEdits.get(u.id) : u.hp;
      return `<div class="fac-hp-row">
        <span class="${teamCls(u.team)}">${escapeHtml(u.name)}</span>
        <span class="fac-dim">${before} → ${u.hp}</span>
        <input type="number" class="fac-hp-input" min="0" max="${u.maxHp}" value="${val}" data-hp-unit="${u.id}"
               aria-label="${t('fac.ratifiedSp')} ${escapeHtml(u.name)}"><span class="fac-dim">/${u.maxHp}</span>
      </div>`;
    }).join('');

    setHtml(el, `
      <p class="fac-hint">${t('fac.combatApprovalHelp')}</p>
      <div class="fac-sub">${t('fac.engagements')}</div>
      <div class="fac-list">${engRows || `<p class="fac-dim">${t('fac.noEngagements')}</p>`}</div>
      <div class="fac-sub">${t('fac.spChanges')}</div>
      <div class="fac-list">${hpRows || `<p class="fac-dim">${t('fac.noSpChanges')}</p>`}</div>
      <button type="button" class="act-btn yellow" data-fac="ratify">${t('fac.ratify')}</button>`);
    return;
  }
  setHtml(el, '');
}

// Editor da unidade selecionada. Não é redesenhado enquanto o facilitador
// digita (dirty), para uma atualização do servidor não apagar a edição.
function facRenderEditor() {
  const panel = $('fac-edit-panel');
  const u = selUnitId ? unitById(selUnitId) : null;
  if (!u || u.hp <= 0 || gameState.winner) {
    panel.classList.add('hidden');
    facEditState = { unitId: null, sig: '', dirty: false };
    return;
  }
  panel.classList.remove('hidden');
  const setup = gameState.phase === 'setup';
  const sig = JSON.stringify([u.id, u.name, u.hp, u.maxHp, u.movement, u.col, u.row, u.weapons, gameState.phase]);
  if (facEditState.unitId === u.id && (facEditState.dirty || facEditState.sig === sig)) return;
  facEditState = { unitId: u.id, sig, dirty: false };

  const wpnInputs = Object.entries(u.weapons || {}).map(([k, w]) => `
    <label class="fac-field fac-field-inline">
      <span title="${weaponGlossary(k)}">${weaponLabel(k)}</span>
      <input type="number" min="0" max="99" value="${w.quantity ?? 0}" data-wpn="${k}">
    </label>`).join('');

  const spField = setup
    ? `<label class="fac-field fac-field-inline"><span>${t('fac.spFull')}</span>
         <input id="fe-maxhp" type="number" min="1" max="99" value="${u.maxHp}"></label>`
    : `<label class="fac-field fac-field-inline"><span>${t('ui.sp')}</span>
         <input id="fe-hp" type="number" min="0" max="${u.maxHp}" value="${u.hp}"></label>
       <label class="fac-field fac-field-inline"><span>${t('fac.spMax')}</span>
         <input id="fe-maxhp" type="number" min="1" max="99" value="${u.maxHp}"></label>`;

  $('fac-edit-body').innerHTML = `
    <div class="fac-edit-head"><span class="${teamCls(u.team)}">${escapeHtml(u.name)}</span>
      <span class="fac-dim">${hexTxt(u.col, u.row)}</span></div>
    <label class="fac-field"><span>${t('fac.name')}</span>
      <input id="fe-name" type="text" maxlength="40" value="${escapeHtml(u.name)}"></label>
    <div class="fac-edit-grid">
      ${spField}
      <label class="fac-field fac-field-inline"><span>${t('ui.mov')}</span>
        <input id="fe-mov" type="number" min="0" max="20" value="${u.movement}"></label>
      ${wpnInputs}
    </div>
    ${setup ? `<p class="fac-hint">${t('fac.setupEditHint')}</p>` : ''}
    <div class="fac-edit-actions">
      <button type="button" class="act-btn yellow" data-fac="apply">${t('fac.apply')}</button>
      <button type="button" class="act-btn gray" data-fac="place" data-unit="${u.id}">${t('fac.reposition')}</button>
      ${u.team !== 'neutral' ? `<button type="button" class="act-btn gray" data-fac="clone" data-unit="${u.id}">${t('fac.duplicate')}</button>` : ''}
      <button type="button" class="act-btn red-dim" data-fac="remove" data-unit="${u.id}">${t('fac.remove')}</button>
    </div>`;
}

function facRenderSentMessages() {
  const msgs = gameState.messages || [];
  const to = m => m.to === 'all' ? t('fac.toAll') : m.to === 'blue' ? t('fac.toBlue') : t('fac.toRed');
  setHtml($('fac-msg-list'), msgs.slice().reverse().map(m => `
    <div class="fac-msg-item">
      <div class="fac-msg-meta">→ ${to(m)} · ${t('ui.turnLabel', { turn: m.turn })}</div>
      <div class="fac-msg-body">${escapeHtml(m.text)}</div>
    </div>`).join(''));
}

// Só troca o HTML quando ele muda — preserva foco e rolagem entre updates.
function setHtml(el, html) {
  if (el._facHtml === html) return;
  el._facHtml = html;
  el.innerHTML = html;
}

// ─── Ações (delegação de eventos) ────────────────────────────────────────────
function facApplyEdits() {
  const u = unitById(selUnitId);
  if (!u) return;
  const changes = {};
  const name = $('fe-name')?.value.trim();
  if (name && name !== u.name) changes.name = name;
  const maxHp = Number($('fe-maxhp')?.value);
  if ($('fe-maxhp') && maxHp !== u.maxHp) changes.maxHp = maxHp;
  if ($('fe-hp')) { const hp = Number($('fe-hp').value); if (hp !== u.hp) changes.hp = hp; }
  const mov = Number($('fe-mov')?.value);
  if ($('fe-mov') && mov !== u.movement) changes.movement = mov;
  const weapons = {};
  document.querySelectorAll('#fac-edit-body [data-wpn]').forEach(inp => {
    const k = inp.dataset.wpn, q = Number(inp.value);
    if (q !== (u.weapons?.[k]?.quantity ?? 0)) weapons[k] = q;
  });
  if (Object.keys(weapons).length) changes.weapons = weapons;
  facEditState.dirty = false;
  if (!Object.keys(changes).length) return;
  socket.emit('fac_edit_unit', { unitId: u.id, changes });
  SFX.play('confirm');
}

document.addEventListener('click', e => {
  if (!isFacilitator) return;
  if (e.target.closest('[data-fac-copy]')) {
    const code = currentRoomId || '';
    navigator.clipboard?.writeText(code).catch(() => {});
    flashScene(code, 'rgba(0,0,0,0.35)', 900);
    return;
  }
  const btn = e.target.closest('[data-fac]');
  if (!btn || btn.disabled) return;
  const unitId = btn.dataset.unit;
  switch (btn.dataset.fac) {
    case 'start':         socket.emit('fac_start_game'); SFX.play('confirm'); break;
    case 'approve-moves': socket.emit('fac_approve_movements'); SFX.play('confirm'); break;
    case 'deny':          socket.emit('fac_deny_move', { unitId }); SFX.play('attackRemove'); break;
    case 'place':         facSetPlace({ kind: 'move', unitId }); break;
    case 'apply':         facApplyEdits(); break;
    case 'clone':         socket.emit('fac_clone_unit', { unitId }); SFX.play('confirm'); break;
    case 'remove': {
      const u = unitById(unitId);
      if (u && confirm(t('fac.confirmRemove', { name: u.name }))) {
        socket.emit('fac_remove_unit', { unitId });
        deselect(false);
      }
      break;
    }
    case 'ratify': {
      const hpChanges = [...facHpEdits.entries()].map(([id, hp]) => ({ unitId: id, hp }));
      socket.emit('fac_ratify_combat', { hpChanges });
      facHpEdits.clear();
      SFX.play('confirm');
      break;
    }
  }
});

// SP proposto na ratificação: registrado ao confirmar o campo (change).
document.addEventListener('change', e => {
  const inp = e.target.closest('[data-hp-unit]');
  if (!inp || !isFacilitator) return;
  const u = unitById(inp.dataset.hpUnit);
  const hp = Math.max(0, Math.min(u?.maxHp ?? 99, Math.round(Number(inp.value) || 0)));
  inp.value = hp;
  facHpEdits.set(inp.dataset.hpUnit, hp);
});

$('fac-edit-body').addEventListener('input', () => { facEditState.dirty = true; });
$('fac-edit-body').addEventListener('keydown', e => { if (e.key === 'Enter') facApplyEdits(); });

$('fac-neutral-add').addEventListener('click', () => {
  facSetPlace({ kind: 'neutral', template: $('fac-neutral-tpl').value, name: $('fac-neutral-name').value.trim() });
  $('fac-neutral-name').value = '';
});

$('fac-msg-send').addEventListener('click', () => {
  const text = $('fac-msg-text').value.trim();
  if (!text) return;
  socket.emit('fac_message', { to: $('fac-msg-to').value, text });
  $('fac-msg-text').value = '';
  SFX.play('confirm');
});

// Ratificação concluída ou nova fase: limpa ajustes de SP pendentes.
socket.on('game_update', s => {
  if (isFacilitator && s.phase !== 'combat_approval') facHpEdits.clear();
});
