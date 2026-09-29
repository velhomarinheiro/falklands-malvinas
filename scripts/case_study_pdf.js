'use strict';
/**
 * case_study_pdf.js — Gera o PDF do estudo de caso a partir da página
 * /estudo-de-caso (mesmo conteúdo, com a folha de estilo de impressão).
 * Saída: public/estudo-de-caso/Zona-de-Exclusao-Estudo-de-Caso.pdf
 *
 * Uso:  python3 scripts/build_case_study.py && node scripts/case_study_pdf.js
 * Requer Playwright com Chromium (apenas para build; não é dependência de runtime):
 *        npm install playwright --no-save
 */

const path      = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const PORT = 3990;
const OUT  = path.join(ROOT, 'public', 'estudo-de-caso', 'Zona-de-Exclusao-Estudo-de-Caso.pdf');

(async () => {
  const srv = spawn('node', ['server.js'], { cwd: ROOT, env: { ...process.env, PORT } });
  await new Promise((resolve, reject) => {
    srv.stdout.on('data', d => { if (String(d).includes(`${PORT}`)) resolve(); });
    srv.on('exit', code => reject(new Error(`servidor saiu (${code})`)));
  });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(`http://localhost:${PORT}/estudo-de-caso`, { waitUntil: 'networkidle' });
    // Imagens com loading="lazy" e o anexo recolhido precisam estar presentes no PDF.
    await page.evaluate(async () => {
      document.querySelectorAll('img').forEach(img => { img.loading = 'eager'; });
      document.querySelectorAll('details').forEach(d => { d.open = true; });
      await Promise.all([...document.images].map(img => img.complete ? null :
        new Promise(r => { img.onload = img.onerror = r; })));
    });
    await page.emulateMedia({ media: 'print' });
    await page.pdf({
      path: OUT,
      format: 'A4',
      preferCSSPageSize: true,
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate:
        '<div style="width:100%;font-family:Georgia,serif;font-size:8px;color:#666;padding:0 16mm;display:flex;justify-content:space-between">' +
        '<span>Zona de Exclusão — Atlântico Sul, 1982 · Estudo de Caso</span>' +
        '<span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>',
    });
    console.log('PDF gerado:', path.relative(ROOT, OUT));
  } finally {
    await browser.close();
    srv.kill();
  }
})().catch(err => { console.error(err); process.exit(1); });
