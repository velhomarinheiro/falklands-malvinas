'use strict';

// ─── Terrain type constants ──────────────────────────────────────────────────
const T_LAND    = 0;  // Área Terrestre       — impassável
const T_SHALLOW = 1;  // Águas Rasas / Estreitos — sem submarinos
const T_SHELF   = 2;  // Plataforma Continental
const T_DEEP    = 3;  // Águas Profundas      — subs ganham furtividade

// ─── Terrain map 20 × 10 — flat-top hexagons, odd-q offset ─────────────────
//  Teatro de operações: Atlântico Sul — Patagônia Argentina (Oeste) até
//  Geórgia do Sul (Leste), com as Ilhas Malvinas/Falkland no centro-leste.
//  Col: A → T  (0=costa continental, 19=Geórgia do Sul)
//  Row: N → S  (0≈45°S Comodoro Rivadavia, 9≈57°S Atlântico Sul aberto)
//
//   0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15 16 17 18 19  ← col
const TERRAIN_MAP = [
  [0, 0, 1, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],  // row 0  ~45°S Comodoro Rivadavia
  [0, 0, 1, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],  // row 1  ~49°S San Julián
  [0, 0, 1, 2, 2, 3, 3, 3, 3, 3, 3, 2, 1, 0, 2, 3, 3, 3, 3, 3],  // row 2  ~51°S Río Gallegos · Ilha Pebble
  [0, 1, 2, 2, 3, 3, 3, 3, 3, 3, 2, 0, 1, 0, 2, 3, 3, 3, 3, 3],  // row 3  ~52°S Falkland Ocidental/Oriental · Porto Argentino
  [0, 1, 2, 2, 3, 3, 3, 3, 3, 3, 2, 0, 1, 0, 2, 3, 3, 3, 2, 0],  // row 4  ~53°S Río Grande · Ganso Verde · Geórgia do Sul (N)
  [0, 1, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 2, 0],  // row 5  ~54°S Geórgia do Sul (centro)
  [1, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 2, 0],  // row 6  ~55°S Geórgia do Sul (S)
  [2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],  // row 7  ~56°S Atlântico Sul aberto
  [2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],  // row 8  ~57°S Atlântico Sul aberto
  [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],  // row 9  ~58°S limite sul
];

// ─── Grid border per terrain ─────────────────────────────────────────────────
const T_BORDER = {
  [T_LAND]:    'rgba(140,100,40, 0.50)',
  [T_SHALLOW]: 'rgba(80,190,220, 0.35)',
  [T_SHELF]:   'rgba(50,140,200, 0.28)',
  [T_DEEP]:    'rgba(40,100,180, 0.20)',
};

// ─── Terrain names ────────────────────────────────────────────────────────────
const T_NAME = {
  [T_LAND]:    'Área Terrestre',
  [T_SHALLOW]: 'Águas Rasas / Estreito',
  [T_SHELF]:   'Plataforma Continental',
  [T_DEEP]:    'Águas Profundas',
};

// ─── Infrastructure markers (posições visuais no mapa) ───────────────────────
const INFRA = [
  { col: 1,  row: 0, type: 'aero', label: '✈', name: 'BAM Comodoro Rivadavia'    },
  { col: 1,  row: 1, type: 'aero', label: '✈', name: 'BAM San Julián'            },
  { col: 1,  row: 2, type: 'aero', label: '✈', name: 'BAM Río Gallegos'          },
  { col: 0,  row: 2, type: 'port', label: '⚓', name: 'Porto Río Gallegos'        },
  { col: 0,  row: 4, type: 'aero', label: '✈', name: 'BAM Río Grande'            },
  { col: 13, row: 2, type: 'aero', label: '✈', name: 'Pista Ilha Pebble'         },
  { col: 11, row: 3, type: 'land', label: '⚑', name: 'Port Howard'               },
  { col: 13, row: 3, type: 'capital', label: '★', name: 'Puerto Argentino / Port Stanley' },
  { col: 11, row: 4, type: 'land', label: '⚑', name: 'Fox Bay'                   },
  { col: 13, row: 4, type: 'aero', label: '✈', name: 'Ganso Verde / Goose Green' },
  { col: 19, row: 5, type: 'land', label: '⚑', name: 'Geórgia do Sul'            },
];

// ─── Movement rules ───────────────────────────────────────────────────────────
function canEnterTerrain(unitTypeOrCategory, terrain) {
  if (unitTypeOrCategory === 'air' || unitTypeOrCategory === 'helicoptero' || unitTypeOrCategory === 'patrulha' || unitTypeOrCategory === 'specops')
    return true;
  if (unitTypeOrCategory === 'land')
    return terrain === T_LAND || terrain === T_SHALLOW;
  if (unitTypeOrCategory === 'submarine' || unitTypeOrCategory === 'submarino')
    return terrain !== T_LAND && terrain !== T_SHALLOW;
  return terrain !== T_LAND; // surface
}
