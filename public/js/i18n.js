'use strict';

// ─── Minimal i18n runtime — no build step, plain JSON dictionaries ──────────
// Locales supported in this build: pt (default/base) and en.
// Dictionaries live at public/locales/{locale}.json (served as static files).

const I18N_DEFAULT_LOCALE = 'pt';
const I18N_LOCALES = ['pt', 'en'];
const I18N_STORAGE_KEY = 'malvinas_locale';

let i18nDict = {};
let i18nLocale = I18N_DEFAULT_LOCALE;
let i18nReadyPromise = null;

function i18nGet(key) {
  const parts = key.split('.');
  let cur = i18nDict;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return typeof cur === 'string' ? cur : undefined;
}

// t('server.roomNotFound', {room: 'ABC123'}) → interpolates {{room}} placeholders.
// Falls back to the key itself if missing, so a gap is visible instead of blank.
function t(key, params) {
  let str = i18nGet(key);
  if (str === undefined) return key;
  if (params) {
    for (const k of Object.keys(params)) {
      str = str.split(`{{${k}}}`).join(String(params[k]));
    }
  }
  return str;
}

// tRaw('weapon.labels') → returns the raw dictionary entry (object/array), not
// just strings — used for lookup tables (per-weapon labels, glossary rows...).
function tRaw(key) {
  const parts = key.split('.');
  let cur = i18nDict;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

function applyI18nToDom(root) {
  root = root || document;
  root.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.getAttribute('data-i18n'));
  });
  root.querySelectorAll('[data-i18n-html]').forEach(el => {
    el.innerHTML = t(el.getAttribute('data-i18n-html'));
  });
  root.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder')));
  });
  root.querySelectorAll('[data-i18n-title]').forEach(el => {
    el.setAttribute('title', t(el.getAttribute('data-i18n-title')));
  });
  root.querySelectorAll('[data-i18n-aria-label]').forEach(el => {
    el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria-label')));
  });
  root.querySelectorAll('[data-i18n-content]').forEach(el => {
    el.setAttribute('content', t(el.getAttribute('data-i18n-content')));
  });
  root.querySelectorAll('[data-i18n-alt]').forEach(el => {
    el.setAttribute('alt', t(el.getAttribute('data-i18n-alt')));
  });
}

async function i18nLoad(locale) {
  const res = await fetch(`/locales/${locale}.json`, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`i18n: failed to load locale "${locale}"`);
  i18nDict = await res.json();
  i18nLocale = locale;
}

async function i18nSetLocale(locale) {
  if (!I18N_LOCALES.includes(locale)) locale = I18N_DEFAULT_LOCALE;
  await i18nLoad(locale);
  try { localStorage.setItem(I18N_STORAGE_KEY, locale); } catch (e) { /* private mode, etc. */ }
  document.documentElement.setAttribute('lang', locale === 'en' ? 'en' : 'pt-BR');
  applyI18nToDom();
  document.querySelectorAll('[data-i18n-switch] [data-locale]').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-locale') === locale);
  });
  document.dispatchEvent(new CustomEvent('i18n:changed', { detail: { locale } }));
}

function i18nGetLocale() {
  return i18nLocale;
}

function i18nInit() {
  if (i18nReadyPromise) return i18nReadyPromise;
  let saved = null;
  try { saved = localStorage.getItem(I18N_STORAGE_KEY); } catch (e) { /* ignore */ }
  const locale = I18N_LOCALES.includes(saved) ? saved : I18N_DEFAULT_LOCALE;
  i18nReadyPromise = i18nSetLocale(locale).then(() => {
    document.querySelectorAll('[data-i18n-switch]').forEach(box => {
      box.addEventListener('click', (ev) => {
        const btn = ev.target.closest('[data-locale]');
        if (btn) i18nSetLocale(btn.getAttribute('data-locale'));
      });
    });
  });
  return i18nReadyPromise;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', i18nInit);
} else {
  i18nInit();
}
