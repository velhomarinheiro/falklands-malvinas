'use strict';
/**
 * make-og-image.js — Gera a imagem de compartilhamento social (1200×630).
 *
 * Compõe o mapa real do teatro (public/mapa.jpeg) como fundo, com um overlay
 * escuro para legibilidade e a marca do jogo (classificação, título, tagline,
 * chips das forças e rosa-dos-ventos) por cima. Saída: public/og-image.jpg.
 *
 * Uso:  node scripts/make-og-image.js
 * Requer "sharp" instalado (apenas para build; não é dependência de runtime):
 *        npm install sharp --no-save
 */

const path  = require('path');
const sharp = require('sharp');

const W = 1200, H = 630;
const PUBLIC = path.join(__dirname, '..', 'public');
const MAP    = path.join(PUBLIC, 'mapa.jpeg');
const OUT    = path.join(PUBLIC, 'og-image.jpg');

const FONT = 'DejaVu Sans Mono';

// Overlay vetorial (gradiente de legibilidade + marca + rosa-dos-ventos).
const overlay = Buffer.from(`
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="shade" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0"    stop-color="#071929" stop-opacity="0.94"/>
      <stop offset="0.55" stop-color="#071929" stop-opacity="0.78"/>
      <stop offset="1"    stop-color="#071929" stop-opacity="0.40"/>
    </linearGradient>
    <linearGradient id="vign" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0"   stop-color="#000000" stop-opacity="0.35"/>
      <stop offset="0.4" stop-color="#000000" stop-opacity="0"/>
      <stop offset="1"   stop-color="#000000" stop-opacity="0.45"/>
    </linearGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#shade)"/>
  <rect width="${W}" height="${H}" fill="url(#vign)"/>

  <!-- Moldura dourada -->
  <rect x="16" y="16" width="${W - 32}" height="${H - 32}" fill="none"
        stroke="#c9a84c" stroke-opacity="0.55" stroke-width="2"/>

  <g font-family="${FONT}, monospace">
    <!-- Classificação -->
    <rect x="70" y="108" width="360" height="40" fill="none"
          stroke="#c9a84c" stroke-opacity="0.8" stroke-width="1.5"/>
    <text x="90" y="135" font-size="22" letter-spacing="6" fill="#c9a84c"
          font-weight="bold">SIMULAÇÃO TÁTICA NAVAL</text>

    <!-- Título -->
    <text x="68" y="270" font-size="78" letter-spacing="6" font-weight="bold"
          fill="#d6e8f7">OPERAÇÃO</text>
    <text x="68" y="356" font-size="78" letter-spacing="6" font-weight="bold"
          fill="#c9a84c">ATLÂNTICO SUL</text>

    <!-- Tagline -->
    <text x="72" y="418" font-size="27" letter-spacing="3" fill="#82b1ff"
          font-weight="bold">Wargame Naval por Turnos</text>
    <text x="72" y="454" font-size="22" letter-spacing="2" fill="#7aa5c5">Multiplayer Online · Combate Hexagonal</text>

    <!-- Chips das forças -->
    <g font-size="20" font-weight="bold" letter-spacing="2">
      <rect x="72" y="500" width="180" height="44" rx="3"
            fill="#0c2d5a" stroke="#82b1ff" stroke-opacity="0.7" stroke-width="1.5"/>
      <text x="100" y="528" fill="#82b1ff">FORÇA AZUL</text>

      <rect x="272" y="500" width="240" height="44" rx="3"
            fill="#5a0c0c" stroke="#ff8a80" stroke-opacity="0.7" stroke-width="1.5"/>
      <text x="300" y="528" fill="#ff8a80">FORÇA VERMELHA</text>
    </g>
  </g>

  <!-- Rosa-dos-ventos -->
  <g transform="translate(1010,330) scale(2.0) translate(-50,-50)">
    <circle cx="50" cy="50" r="44" fill="none" stroke="#c9a84c" stroke-opacity="0.4" stroke-width="1.5"/>
    <polygon points="50,6 56,46 50,54 44,46" fill="#c9a84c"/>
    <polygon points="50,94 56,54 50,46 44,54" fill="#7a8a9a"/>
    <polygon points="6,50 46,44 54,50 46,56" fill="#7a8a9a"/>
    <polygon points="94,50 54,44 46,50 54,56" fill="#7a8a9a"/>
    <circle cx="50" cy="50" r="5" fill="#c9a84c" stroke="#fff" stroke-width="0.8"/>
    <text x="50" y="4" text-anchor="middle" font-size="10" fill="#ffd54f"
          font-weight="bold" font-family="${FONT}, monospace">N</text>
  </g>
</svg>
`);

(async () => {
  const bg = await sharp(MAP)
    .resize(W, H, { fit: 'cover', position: 'centre' })
    .toBuffer();

  await sharp(bg)
    .composite([{ input: overlay, top: 0, left: 0 }])
    .jpeg({ quality: 86, mozjpeg: true })
    .toFile(OUT);

  console.log(`OK: ${OUT}`);
})().catch(err => { console.error(err); process.exit(1); });
