'use strict';
/**
 * export_quick_guide.js — Exporta o "Manual Rápido" do jogo (botão ? / tecla H)
 * para um arquivo de texto editável em Markdown.
 *
 * O texto vem dos mesmos campos que o jogo exibe — locales/{pt,en}.json
 * (help.*, glossary.*, weapon.*, obj.*) — e as condições de vitória vêm do
 * próprio servidor (computeObjectives), então a exportação acompanha as regras.
 *
 * Uso:  node scripts/export_quick_guide.js
 * Saída: docs/guia-rapido.md (português) e docs/quick-guide.md (inglês)
 *
 * Também exporta buildGuide(lang) → estrutura de seções, para outros formatos.
 */

const fs   = require('fs');
const path = require('path');
const { newGame, computeObjectives, MAX_TURNS } = require('../server');

const ROOT    = path.join(__dirname, '..');
const OUTPUTS = { pt: 'docs/guia-rapido.md', en: 'docs/quick-guide.md' };
// Mesma lista do cliente (GLOSSARY_HIDDEN em public/js/client.js).
const GLOSSARY_HIDDEN = ['asbm', 'bmd'];
const TABS = ['partida', 'fases', 'combate', 'logistica'];

const TITLES = {
  pt: {
    doc: 'Zona de Exclusão — Atlântico Sul, 1982 · Manual Rápido',
    intro: 'Guia rápido do jogo, o mesmo exibido no botão **?** (tecla **H**) durante a partida.',
    tabs: { partida: 'Partida', fases: 'Fases', combate: 'Combate', logistica: 'Logística', vitoria: 'Vitória', glossario: 'Glossário' },
    weapons: 'ARMAS E CAPACIDADES',
  },
  en: {
    doc: 'Exclusion Zone — South Atlantic, 1982 · Quick Manual',
    intro: 'Quick game guide — the same one shown by the **?** button (**H** key) during a game.',
    tabs: { partida: 'Game', fases: 'Phases', combate: 'Combat', logistica: 'Logistics', vitoria: 'Victory', glossario: 'Glossary' },
    weapons: 'WEAPONS AND CAPABILITIES',
  },
};

function interpolate(str, params = {}) {
  return Object.entries(params).reduce((s, [k, v]) => s.split(`{{${k}}}`).join(String(v)), str);
}

// HTML simples do manual (h4, p, ul/li, b, em) → blocos estruturados.
function htmlToBlocks(html) {
  const blocks = [];
  const re = /<h4>(.*?)<\/h4>|<p>(.*?)<\/p>|<ul>(.*?)<\/ul>/gs;
  let m;
  while ((m = re.exec(html))) {
    if (m[1] !== undefined) blocks.push({ type: 'heading', text: m[1] });
    else if (m[2] !== undefined) blocks.push({ type: 'para', text: m[2] });
    else blocks.push({ type: 'list', items: [...m[3].matchAll(/<li>(.*?)<\/li>/gs)].map(x => x[1]) });
  }
  return blocks;
}

function buildGuide(lang) {
  const dict = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'locales', `${lang}.json`), 'utf8'));
  const T = TITLES[lang];
  const sections = TABS.map(tab => ({
    title: T.tabs[tab],
    blocks: htmlToBlocks(interpolate(dict.help[tab], { days: MAX_TURNS })),
  }));

  const obj = computeObjectives(newGame());
  const side = (o, team) => [
    { type: 'heading', text: `${dict.log[team === 'blue' ? 'TEAM_BLUE' : 'TEAM_RED']} — ${o.needed} ${dict.help.of} ${o.conditions.length} ${dict.help.objectives}` },
    { type: 'list', items: o.conditions.map(c => interpolate(dict.obj[c.labelCode], c.labelParams)) },
  ];
  sections.push({
    title: T.tabs.vitoria,
    blocks: [...side(obj.blue, 'blue'), ...side(obj.red, 'red'),
             ...htmlToBlocks(interpolate(dict.help.victoryDeadline, { days: MAX_TURNS }))],
  });

  const weaponRows = Object.keys(dict.weapon.glossary)
    .filter(k => !GLOSSARY_HIDDEN.includes(k))
    .map(k => `<b>${dict.weapon.labels[k] || k.toUpperCase()}</b> — ${dict.weapon.glossary[k]}`);
  sections.push({
    title: T.tabs.glossario,
    blocks: [
      { type: 'heading', text: dict.glossary.termsTitle },
      { type: 'list', items: dict.glossary.general.map(([term, d]) => `<b>${term}</b> — ${d}`) },
      { type: 'heading', text: T.weapons },
      { type: 'list', items: weaponRows },
    ],
  });
  return { title: T.doc, intro: T.intro, sections };
}

// Marcação inline (<b>, <em>) → Markdown.
function inlineMd(s) {
  return s.replace(/<b>(.*?)<\/b>/g, '**$1**').replace(/<em>(.*?)<\/em>/g, '*$1*').replace(/<[^>]+>/g, '');
}

function toMarkdown(guide) {
  const out = [`# ${guide.title}`, '', guide.intro, ''];
  for (const sec of guide.sections) {
    out.push(`## ${sec.title}`, '');
    for (const b of sec.blocks) {
      if (b.type === 'heading') out.push(`### ${inlineMd(b.text)}`, '');
      else if (b.type === 'para') out.push(inlineMd(b.text), '');
      else out.push(...b.items.map(i => `- ${inlineMd(i)}`), '');
    }
  }
  return out.join('\n');
}

if (require.main === module) {
  for (const [lang, rel] of Object.entries(OUTPUTS)) {
    fs.writeFileSync(path.join(ROOT, rel), toMarkdown(buildGuide(lang)));
    console.log('Gerado:', rel);
  }
}

module.exports = { buildGuide, toMarkdown };
