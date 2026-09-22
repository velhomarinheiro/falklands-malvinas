'use strict';

// ─── Terrain type constants ──────────────────────────────────────────────────
const T_LAND    = 0;  // Área Terrestre       — impassável
const T_SHALLOW = 1;  // Águas Rasas / Costa  — sem submarinos
const T_SHELF   = 2;  // Plataforma Continental
const T_DEEP    = 3;  // Águas Profundas      — subs ganham furtividade

// ─── Terrain map 20 × 10 — flat-top hexagons, odd-q offset ─────────────────
//  Derivado do mapa georreferenciado real (mapa_source/, Lambert conforme,
//  Natural Earth 1:10M) — terra/costa por fração de terra no hexágono,
//  plataforma/profundo pela sombra batimétrica da própria carta.
//  Col: A → T  (0=costa continental, 19=Geórgia do Sul)
//  Row: N → S  (0≈45°S Comodoro Rivadavia, 9≈56°S Atlântico Sul aberto)
//
//   0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15 16 17 18 19  ← col
const TERRAIN_MAP = [
  [0, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],  // row 0  ~45°S Comodoro Rivadavia
  [0, 1, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],  // row 1  ~46-47°S
  [0, 0, 1, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],  // row 2  ~47-48°S San Julián/Santa Cruz
  [0, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 2, 3, 3, 3, 3, 3, 3],  // row 3  ~48-49°S
  [0, 1, 2, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3],  // row 4  ~50°S Río Gallegos · Porto Argentino
  [0, 1, 2, 2, 2, 1, 1, 2, 2, 2, 2, 3, 2, 3, 2, 3, 2, 3, 3, 3],  // row 5  ~51-52°S Falkland Ocidental/Ganso Verde
  [0, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 2, 2, 3, 3, 3, 3],  // row 6  ~52-53°S
  [1, 0, 1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 2, 2, 1, 1],  // row 7  ~53-54°S Río Grande · Geórgia do Sul (N)
  [1, 1, 0, 2, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 2, 1],  // row 8  ~54-55°S Ushuaia · Geórgia do Sul (S)
  [3, 3, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],  // row 9  ~56°S limite sul
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
  [T_SHALLOW]: 'Águas Rasas / Costa',
  [T_SHELF]:   'Plataforma Continental',
  [T_DEEP]:    'Águas Profundas',
};

// ─── Infrastructure markers (posições visuais no mapa) ───────────────────────
// Coordenadas resolvidas a partir de mapa_source/mapa_malvinas_1982_georef.json
// (hexágono mais próximo da lon/lat real de cada localidade).
const INFRA = [
  { col: 0,  row: 1, type: 'aero', label: '✈', name: 'BAM Comodoro Rivadavia'    },
  { col: 1,  row: 3, type: 'aero', label: '✈', name: 'BAM San Julián'            },
  { col: 1,  row: 5, type: 'aero', label: '✈', name: 'BAM Río Gallegos'          },
  { col: 1,  row: 5, type: 'port', label: '⚓', name: 'Porto Río Gallegos'        },
  { col: 2,  row: 7, type: 'aero', label: '✈', name: 'BAM Río Grande'            },
  { col: 5,  row: 5, type: 'land', label: '⚑', name: 'Falkland Ocidental'        },
  { col: 6,  row: 5, type: 'aero', label: '✈', name: 'Ganso Verde / Goose Green' },
  { col: 7,  row: 4, type: 'capital', label: '★', name: 'Puerto Argentino / Stanley' },
  { col: 19, row: 7, type: 'land', label: '⚑', name: 'Geórgia do Sul'            },
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
