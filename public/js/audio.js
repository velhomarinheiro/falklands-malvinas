'use strict';

// ─── SFX — Tactical / Military UI sounds (Web Audio API, no external files) ──
// All sounds are synthesized from filtered white noise + oscillators.
// Style target: CS:GO / PUBG — dry, metallic, mechanical, no reverb.
const SFX = (() => {
  let ctx     = null;
  let master  = null;
  let muted   = (localStorage.getItem('sfx_muted') === '1');

  function _init() {
    if (ctx) return;
    ctx    = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.75;
    master.connect(ctx.destination);
  }

  function _resume() {
    if (ctx?.state === 'suspended') ctx.resume();
  }

  // ── White-noise buffer source ─────────────────────────────────────────────
  function _noiseSrc(dur) {
    const len = Math.max(1, Math.ceil(ctx.sampleRate * (dur + 0.01)));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d   = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const s = ctx.createBufferSource();
    s.buffer = buf;
    return s;
  }

  // ── Filtered noise layer ──────────────────────────────────────────────────
  // freq: bandpass centre, Q: resonance, vol: peak gain, dur/decay: seconds
  function _noise({ freq = 2000, Q = 6, vol = 0.15, dur = 0.04,
                    decay = 0.03, delay = 0, filterType = 'bandpass' } = {}) {
    const at  = ctx.currentTime + delay;
    const src = _noiseSrc(dur);
    const f   = ctx.createBiquadFilter();
    f.type = filterType;
    f.frequency.value = freq;
    f.Q.value = Q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + decay);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(at);
    src.stop(at + Math.max(dur, decay) + 0.02);
  }

  // ── Oscillator tone ───────────────────────────────────────────────────────
  function _osc({ type = 'sine', freq = 800, freqStart, vol = 0.08,
                  attack = 0.002, decay = 0.06, delay = 0 } = {}) {
    const at  = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    osc.type  = type;
    osc.frequency.setValueAtTime(freqStart ?? freq, at);
    if (freqStart && freqStart !== freq) {
      osc.frequency.exponentialRampToValueAtTime(freq, at + attack + 0.004);
    }
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(vol, at + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
    osc.connect(g); g.connect(master);
    osc.start(at);
    osc.stop(at + attack + decay + 0.05);
  }

  // ─────────────────────────── SOUND LIBRARY ────────────────────────────────
  const S = {

    // Hover: unit hex on map (subtle metallic radar-tick)
    hoverUnit() {
      _noise({ freq: 3800, Q: 14, vol: 0.055, dur: 0.012, decay: 0.010 });
    },

    // Hover: UI button (lighter switch-prep)
    hoverBtn() {
      _noise({ freq: 2600, Q: 10, vol: 0.042, dur: 0.010, decay: 0.008 });
    },

    // Generic button click (mechanical switch)
    click() {
      _noise({ freq: 1700, Q:  7, vol: 0.18, dur: 0.025, decay: 0.020 });
      _noise({ freq:  650, Q:  4, vol: 0.09, dur: 0.020, decay: 0.015, delay: 0.002 });
    },

    // Unit selected (tactical confirmation — slight metallic ring)
    select() {
      _noise({ freq: 2300, Q: 10, vol: 0.22, dur: 0.022, decay: 0.018 });
      _osc({ type: 'square', freq: 1300, vol: 0.055, attack: 0.001, decay: 0.045, delay: 0.004 });
    },

    // Deselect / cancel (softer, lower, "negative")
    deselect() {
      _noise({ freq: 1100, Q: 6, vol: 0.12, dur: 0.018, decay: 0.016 });
      _osc({ type: 'sine', freq: 700, freqStart: 900, vol: 0.03, attack: 0.001, decay: 0.04, delay: 0.003 });
    },

    // Movement step added to path (very quiet metronome tick)
    step() {
      _noise({ freq: 3500, Q: 16, vol: 0.048, dur: 0.009, decay: 0.007 });
    },

    // Attack declared (trigger engagement — more aggressive)
    attack() {
      _noise({ freq: 1500, Q:  5, vol: 0.21, dur: 0.030, decay: 0.026 });
      _osc({ type: 'sawtooth', freq: 280, freqStart: 480, vol: 0.065, attack: 0.001, decay: 0.065, delay: 0.003 });
    },

    // Attack removed / undeclared
    attackRemove() {
      _noise({ freq: 1200, Q: 6, vol: 0.11, dur: 0.018, decay: 0.014 });
    },

    // End phase / major confirmation (heavy magazine lock)
    confirm() {
      _noise({ freq: 1100, Q: 4, vol: 0.28, dur: 0.050, decay: 0.042 });
      _noise({ freq:  320, Q: 3, vol: 0.18, dur: 0.045, decay: 0.065, delay: 0.010 });
      _osc({ type: 'square', freq: 820, vol: 0.045, attack: 0.002, decay: 0.090, delay: 0.022 });
    },

    // Combat hit (armour impact)
    hit() {
      _noise({ freq: 900, Q: 3, vol: 0.30, dur: 0.055, decay: 0.060 });
      _noise({ freq: 180, Q: 2, vol: 0.18, dur: 0.060, decay: 0.085, delay: 0.012 });
    },

    // Combat miss / dry fire (hollow metallic click)
    miss() {
      _noise({ freq: 3200, Q: 11, vol: 0.09, dur: 0.025, decay: 0.022 });
      _osc({ type: 'sine', freq: 550, freqStart: 850, vol: 0.035, attack: 0.001, decay: 0.055, delay: 0.005 });
    },

    // Unit destroyed (heavy impact + sub-bass rumble)
    destroy() {
      _noise({ freq: 280, Q: 2, vol: 0.40, dur: 0.100, decay: 0.130 });
      _noise({ freq:  90, Q: 2, vol: 0.25, dur: 0.120, decay: 0.160, delay: 0.018 });
      _osc({ type: 'sawtooth', freq: 65, freqStart: 180, vol: 0.085, attack: 0.002, decay: 0.220, delay: 0.010 });
    },

    // Turn change: two tactical radio blips
    turnChange() {
      _osc({ type: 'square', freq: 1200, vol: 0.078, attack: 0.002, decay: 0.055 });
      _osc({ type: 'square', freq: 1550, vol: 0.078, attack: 0.002, decay: 0.055, delay: 0.110 });
      _noise({ freq: 2800, Q: 8, vol: 0.04, dur: 0.015, decay: 0.012, delay: 0.001 });
      _noise({ freq: 2800, Q: 8, vol: 0.04, dur: 0.015, decay: 0.012, delay: 0.111 });
    },

    // Error / invalid action (negative buzz)
    error() {
      _noise({ freq: 380, Q: 3, vol: 0.22, dur: 0.055, decay: 0.050 });
      _osc({ type: 'sawtooth', freq: 190, vol: 0.060, attack: 0.001, decay: 0.080, delay: 0.010 });
    },

    // Card / file open (light digital swipe)
    card() {
      _noise({ freq: 5500, Q: 18, vol: 0.065, dur: 0.018, decay: 0.013 });
      _noise({ freq: 2200, Q:  8, vol: 0.040, dur: 0.028, decay: 0.022, delay: 0.008 });
    },

    // Stack picker appears
    stackPick() {
      _noise({ freq: 3000, Q: 12, vol: 0.075, dur: 0.013, decay: 0.011 });
    },
  };

  // ── Throttling for rapid-fire events ──────────────────────────────────────
  let _lastHoverUnit  = 0;
  let _lastHoverBtn   = 0;
  let _lastHoveredBtn = null;  // DOM element — prevents repeat on child moves

  // ── Public API ─────────────────────────────────────────────────────────────
  return {
    get muted() { return muted; },

    toggleMute() {
      muted = !muted;
      localStorage.setItem('sfx_muted', muted ? '1' : '0');
      return muted;
    },

    // Call once on first user interaction to initialise context
    init() { _init(); _resume(); },

    play(name) {
      if (muted) return;
      try {
        _init(); _resume();
        if (S[name]) S[name]();
      } catch (_) { /* fail silently */ }
    },

    // Throttled hover for unit hexes (max 10/s)
    hoverUnit() {
      const now = Date.now();
      if (muted || now - _lastHoverUnit < 100) return;
      _lastHoverUnit = now;
      try { _init(); _resume(); S.hoverUnit(); } catch (_) {}
    },

    // Delegated hover for buttons — fires once per distinct button
    onButtonMouseover(el) {
      const btn = el?.closest?.('button, .act-btn, .sp-unit-btn, .card-thumb');
      if (!btn || btn === _lastHoveredBtn) return;
      _lastHoveredBtn = btn;
      const now = Date.now();
      if (muted || now - _lastHoverBtn < 60) return;
      _lastHoverBtn = now;
      try { _init(); _resume(); S.hoverBtn(); } catch (_) {}
    },
    onButtonMouseout(el) {
      if (el?.closest?.('button, .act-btn, .sp-unit-btn, .card-thumb') === _lastHoveredBtn) {
        _lastHoveredBtn = null;
      }
    },
  };
})();
