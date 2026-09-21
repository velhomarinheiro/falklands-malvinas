"""
gen_cards.py — Gera cards Super Trunfo para Operação Atlântico Sul
Formato: PowerPoint, 1 card por slide (63.5 mm × 88.9 mm)
Saída:   cards_super_trunfo.pptx
"""

from pptx import Presentation
from pptx.util import Mm, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.util import Inches

# ── Card dimensions (poker card) ──────────────────────────────────────────────
CARD_W = Mm(63.5)
CARD_H = Mm(88.9)

# ── Palette ───────────────────────────────────────────────────────────────────
BLUE_DARK   = RGBColor(0x00, 0x33, 0x80)
BLUE_MID    = RGBColor(0x00, 0x5B, 0xB5)
BLUE_LIGHT  = RGBColor(0xD6, 0xE8, 0xFF)
RED_DARK    = RGBColor(0x7F, 0x00, 0x00)
RED_MID     = RGBColor(0xBB, 0x00, 0x00)
RED_LIGHT   = RGBColor(0xFF, 0xD6, 0xD6)
GOLD        = RGBColor(0xFF, 0xCC, 0x00)
WHITE       = RGBColor(0xFF, 0xFF, 0xFF)
DARK_GRAY   = RGBColor(0x33, 0x33, 0x33)
MED_GRAY    = RGBColor(0x88, 0x88, 0x88)
LIGHT_GRAY  = RGBColor(0xF0, 0xF0, 0xF0)

# ── FP values (from fuel_model.js) ────────────────────────────────────────────
UNIT_FP = {
    'BLUE-SAG-P':  12, 'BLUE-SAG-S1': 10, 'BLUE-SAG-S2': 10,
    'BLUE-ANFIB':   8, 'BLUE-LOG-A':  30, 'BLUE-LOG-T':  40,
    'BLUE-PAT-O1': 10, 'BLUE-PAT-O2': 10,
    'BLUE-PAT-C1':  6, 'BLUE-PAT-C2':  6,
    'RED-GE-1':    12, 'RED-GE-2':    12, 'RED-GE-3':    10,
    'RED-AOR-G':   24, 'RED-GANF':    12, 'RED-GLOG':    30, 'RED-AKE': 8,
}
SUB_FP = 20  # conventional submarine

# ── Category labels & icons (Unicode) ────────────────────────────────────────
CAT_META = {
    'surface':    ('Superfície', '⚓'),
    'submarine':  ('Submarino',  '〰'),
    'air':        ('Aéreo',      '✈'),
    'land':       ('Terra',      '⬛'),
}

# ── Composition type → readable label ────────────────────────────────────────
COMP_LABELS = {
    'navio_aeródromo':       'Porta-Aviões',
    'helicoptero_ASW':       'Helo ASW',
    'helicoptero_ASup':      'Helo ASup',
    'fragata':               'Fragata',
    'corveta':               'Corveta',
    'navio_doca':            'Navio Doca',
    'navio_desembarque':     'Navio Desembarque',
    'navio_logistico':       'Navio Logístico',
    'navio_tanque':          'Navio Tanque',
    'navio_patoc':           'NPaOc',
    'navio_patrulha':        'NPa',
    'submarino_nuclear':     'Sub Nuclear',
    'submarino_convencional':'Sub Convencional',
    'patrulha_maritima':     'Patrulha Marítima',
    'caca':                  'Caça',
    'ataque':                'Ataque',
    'aew':                   'AEW/AWACS',
    'bateria_costeira':      'Bateria Costeira',
    'base_naval':            'Batalhão ADA',
    'plataforma':            'Plataforma FPSO',
    'porto':                 'Porto',
    'aeroporto':             'Aeroporto',
    'cruzador':              'Cruzador',
    'destroyer':             'Destroyer',
}

# ── Capability labels ─────────────────────────────────────────────────────────
CAP_LABELS = {
    'airDefense': 'Def. Aérea',
    'asw':        'ASW',
    'airAttack':  'Ataque Aéreo',
    'navalGun':   'Artilharia',
    'bmd':        'BMD',
}

WEAPON_LABELS = {
    'mss':   'MSS',
    'ascm':  'ASCM',
    'lacm':  'LACM',
    'torpedo': 'Torpedo',
}

# ── All units ─────────────────────────────────────────────────────────────────
UNITS = {
  "blue": [
    {"id":"BLUE-SAG-P","name":"SAG-P","fullName":"SAG Principal","category":"surface",
     "composition":[{"type":"navio_aeródromo","quantity":1},{"type":"helicoptero_ASW","quantity":4},{"type":"helicoptero_ASup","quantity":4}],
     "stayingPower":4,"movement":4,
     "detectionRange":{"surface":4,"air":3,"submarine":2,"land":2},
     "attackRange":{"surface":3,"air":1,"submarine":2,"land":2},
     "weapons":{"mss":{"quantity":16,"range":3}},
     "capabilities":{"airDefense":3,"asw":4,"airAttack":6},
     "notes":"NAM Atlântico + Helicópteros orgânicos"},
    {"id":"BLUE-SAG-S1","name":"SAG-1","fullName":"SAG Secundário 1","category":"surface",
     "composition":[{"type":"fragata","quantity":3},{"type":"helicoptero_ASup","quantity":3}],
     "stayingPower":9,"movement":4,
     "detectionRange":{"surface":2,"air":2,"submarine":1,"land":1},
     "attackRange":{"surface":2,"air":1,"submarine":1,"land":1},
     "weapons":{"mss":{"quantity":18,"range":2}},
     "capabilities":{"navalGun":3,"airDefense":6,"asw":3,"airAttack":3},
     "notes":"3× Fragatas Tamandaré"},
    {"id":"BLUE-SAG-S2","name":"SAG-2","fullName":"SAG Secundário 2","category":"surface",
     "composition":[{"type":"fragata","quantity":2},{"type":"corveta","quantity":2},{"type":"helicoptero_ASup","quantity":2}],
     "stayingPower":10,"movement":4,
     "detectionRange":{"surface":3,"air":2,"submarine":1,"land":1},
     "attackRange":{"surface":2,"air":1,"submarine":1,"land":1},
     "weapons":{"mss":{"quantity":24,"range":2}},
     "capabilities":{"navalGun":4,"airDefense":6,"asw":4,"airAttack":2},
     "notes":"2× Fragatas Tamandaré + 2× Corvetas Barroso"},
    {"id":"BLUE-ANFIB","name":"ANFIB","fullName":"Força de Desembarque","category":"surface",
     "composition":[{"type":"navio_doca","quantity":2},{"type":"navio_desembarque","quantity":1},{"type":"helicoptero_ASW","quantity":4}],
     "stayingPower":10,"movement":2,
     "detectionRange":{"surface":3,"air":2,"submarine":2,"land":2},
     "attackRange":{"surface":3,"air":1,"submarine":2,"land":2},
     "weapons":{},
     "capabilities":{"navalGun":3,"airDefense":3,"asw":4},
     "notes":"NDM Bahia + Oiapoque + NCC Sabóia"},
    {"id":"BLUE-LOG-A","name":"APLOG","fullName":"Apoio Logístico","category":"surface",
     "composition":[{"type":"navio_logistico","quantity":1}],
     "stayingPower":3,"movement":2,
     "detectionRange":{"surface":1,"air":1,"submarine":0,"land":0},
     "attackRange":{"surface":0,"air":0,"submarine":0,"land":0},
     "weapons":{},"capabilities":{},
     "notes":"NApLog. Reabastece unidades amigas. 30 FP."},
    {"id":"BLUE-LOG-T","name":"REAB","fullName":"Navio Tanque","category":"surface",
     "composition":[{"type":"navio_tanque","quantity":1}],
     "stayingPower":3,"movement":2,
     "detectionRange":{"surface":1,"air":1,"submarine":0,"land":0},
     "attackRange":{"surface":0,"air":0,"submarine":0,"land":0},
     "weapons":{},"capabilities":{},
     "notes":"NT Alte Gastão Motta. 40 FP."},
    {"id":"BLUE-PAT-O1","name":"PAOC1","fullName":"Patrulha Oceânica 1","category":"surface",
     "composition":[{"type":"navio_patoc","quantity":2},{"type":"helicoptero_ASup","quantity":2}],
     "stayingPower":4,"movement":4,
     "detectionRange":{"surface":2,"air":2,"submarine":0,"land":1},
     "attackRange":{"surface":2,"air":1,"submarine":0,"land":0},
     "weapons":{"mss":{"quantity":4,"range":2}},
     "capabilities":{"navalGun":2,"airDefense":2,"airAttack":2},
     "notes":"2× NPaOc Apa. ISR oceânico norte."},
    {"id":"BLUE-PAT-O2","name":"PAOC2","fullName":"Patrulha Oceânica 2","category":"surface",
     "composition":[{"type":"navio_patoc","quantity":2},{"type":"helicoptero_ASup","quantity":2}],
     "stayingPower":4,"movement":4,
     "detectionRange":{"surface":2,"air":2,"submarine":0,"land":1},
     "attackRange":{"surface":2,"air":1,"submarine":0,"land":0},
     "weapons":{"mss":{"quantity":4,"range":2}},
     "capabilities":{"navalGun":2,"airDefense":2,"airAttack":2},
     "notes":"2× NPaOc Amazonas. ISR oceânico sul."},
    {"id":"BLUE-PAT-C1","name":"PATC1","fullName":"Patrulha Costeira 1","category":"surface",
     "composition":[{"type":"navio_patrulha","quantity":2}],
     "stayingPower":2,"movement":3,
     "detectionRange":{"surface":1,"air":1,"submarine":0,"land":1},
     "attackRange":{"surface":1,"air":0,"submarine":0,"land":0},
     "weapons":{"mss":{"quantity":2,"range":1}},
     "capabilities":{"navalGun":2},
     "notes":"2× NPa Macaé. Zona costeira."},
    {"id":"BLUE-PAT-C2","name":"PATC2","fullName":"Patrulha Costeira 2","category":"surface",
     "composition":[{"type":"navio_patrulha","quantity":2}],
     "stayingPower":2,"movement":3,
     "detectionRange":{"surface":1,"air":1,"submarine":0,"land":1},
     "attackRange":{"surface":1,"air":0,"submarine":0,"land":0},
     "weapons":{"mss":{"quantity":2,"range":1}},
     "capabilities":{"navalGun":2},
     "notes":"4× NPa Grajaú. Zona costeira."},
    {"id":"BLUE-SUB-N","name":"SBN","fullName":"Submarino Nuclear","category":"submarine",
     "composition":[{"type":"submarino_nuclear","quantity":1}],
     "stayingPower":3,"movement":4,
     "detectionRange":{"surface":3,"air":0,"submarine":2,"land":0},
     "attackRange":{"surface":3,"air":0,"submarine":2,"land":1},
     "weapons":{"ascm":{"quantity":2,"range":6},"mss":{"quantity":4,"range":2},"torpedo":{"quantity":12,"range":2}},
     "capabilities":{"asw":1},
     "notes":"SNAC Álvaro Alberto. Nuclear. Posição secreta."},
    {"id":"BLUE-SUB-1","name":"SB1","fullName":"Submarino Convencional 1","category":"submarine",
     "composition":[{"type":"submarino_convencional","quantity":1}],
     "stayingPower":2,"movement":2,
     "detectionRange":{"surface":2,"air":0,"submarine":1,"land":0},
     "attackRange":{"surface":2,"air":0,"submarine":1,"land":0},
     "weapons":{"mss":{"quantity":2,"range":2},"torpedo":{"quantity":6,"range":2}},
     "capabilities":{"asw":1},
     "notes":"S40 Riachuelo. Posição secreta."},
    {"id":"BLUE-SUB-2","name":"SB2","fullName":"Submarino Convencional 2","category":"submarine",
     "composition":[{"type":"submarino_convencional","quantity":1}],
     "stayingPower":2,"movement":2,
     "detectionRange":{"surface":2,"air":0,"submarine":1,"land":0},
     "attackRange":{"surface":2,"air":0,"submarine":1,"land":0},
     "weapons":{"mss":{"quantity":2,"range":2},"torpedo":{"quantity":6,"range":2}},
     "capabilities":{"asw":1},
     "notes":"S41 Humaitá. Posição secreta."},
    {"id":"BLUE-SUB-3","name":"SB3","fullName":"Submarino Convencional 3","category":"submarine",
     "composition":[{"type":"submarino_convencional","quantity":1}],
     "stayingPower":2,"movement":2,
     "detectionRange":{"surface":2,"air":0,"submarine":1,"land":0},
     "attackRange":{"surface":2,"air":0,"submarine":1,"land":0},
     "weapons":{"mss":{"quantity":2,"range":2},"torpedo":{"quantity":6,"range":2}},
     "capabilities":{"asw":1},
     "notes":"S42 Tonelero. Posição secreta."},
    {"id":"BLUE-MPRA-1","name":"PATMAR1","fullName":"Patrulha Marítima 1","category":"air",
     "composition":[{"type":"patrulha_maritima","quantity":2}],
     "stayingPower":2,"movement":16,
     "detectionRange":{"surface":4,"air":1,"submarine":1,"land":2},
     "attackRange":{"surface":3,"air":0,"submarine":1,"land":0},
     "weapons":{"mss":{"quantity":4,"range":2},"torpedo":{"quantity":2,"range":2}},
     "capabilities":{"asw":2,"airAttack":2},
     "notes":"P-3AM Orion. ASW + anti-superfície. Base Santos."},
    {"id":"BLUE-MPRA-2","name":"PATMAR2","fullName":"Patrulha Marítima 2","category":"air",
     "composition":[{"type":"patrulha_maritima","quantity":2}],
     "stayingPower":2,"movement":16,
     "detectionRange":{"surface":4,"air":1,"submarine":1,"land":2},
     "attackRange":{"surface":3,"air":0,"submarine":1,"land":0},
     "weapons":{"mss":{"quantity":4,"range":2},"torpedo":{"quantity":2,"range":2}},
     "capabilities":{"asw":2,"airAttack":2},
     "notes":"P-3AM Orion. Base Vitória."},
    {"id":"BLUE-CACA-1","name":"PAC1","fullName":"Esquadrão de Caça 1","category":"air",
     "composition":[{"type":"caca","quantity":6}],
     "stayingPower":6,"movement":8,
     "detectionRange":{"surface":2,"air":2,"submarine":0,"land":1},
     "attackRange":{"surface":0,"air":2,"submarine":0,"land":0},
     "weapons":{},
     "capabilities":{"airDefense":6,"airAttack":6},
     "notes":"F-39E Gripen 5ª ger. Base RJ."},
    {"id":"BLUE-CACA-2","name":"PAC2","fullName":"Esquadrão de Caça 2","category":"air",
     "composition":[{"type":"caca","quantity":6}],
     "stayingPower":6,"movement":8,
     "detectionRange":{"surface":2,"air":2,"submarine":0,"land":1},
     "attackRange":{"surface":0,"air":2,"submarine":0,"land":0},
     "weapons":{},
     "capabilities":{"airDefense":6,"airAttack":6},
     "notes":"F-39E Gripen 5ª ger. Base Santos."},
    {"id":"BLUE-CJAT-1","name":"APAER1","fullName":"Ataque Embarcado 1","category":"air",
     "composition":[{"type":"ataque","quantity":2}],
     "stayingPower":2,"movement":6,
     "detectionRange":{"surface":2,"air":1,"submarine":0,"land":1},
     "attackRange":{"surface":1,"air":1,"submarine":0,"land":1},
     "weapons":{"ascm":{"quantity":4,"range":6},"mss":{"quantity":2,"range":2},"lacm":{"quantity":2,"range":10}},
     "capabilities":{"airAttack":2},
     "notes":"AF-1 A-4 Skyhawk. Buddy-tank. Base Santos/NAM."},
    {"id":"BLUE-CJAT-2","name":"APAER2","fullName":"Ataque Embarcado 2","category":"air",
     "composition":[{"type":"ataque","quantity":2}],
     "stayingPower":2,"movement":6,
     "detectionRange":{"surface":2,"air":1,"submarine":0,"land":1},
     "attackRange":{"surface":1,"air":1,"submarine":0,"land":1},
     "weapons":{"ascm":{"quantity":4,"range":6},"mss":{"quantity":2,"range":2},"lacm":{"quantity":2,"range":10}},
     "capabilities":{"airAttack":2},
     "notes":"AF-1 A-4 Skyhawk. Base Vitória."},
    {"id":"BLUE-DCOST1","name":"DEFCOST1","fullName":"Defesa Costeira 1","category":"land",
     "composition":[{"type":"bateria_costeira","quantity":2}],
     "stayingPower":2,"movement":1,
     "detectionRange":{"surface":2,"air":0,"submarine":0,"land":1},
     "attackRange":{"surface":3,"air":0,"submarine":0,"land":0},
     "weapons":{"mss":{"quantity":10,"range":3}},
     "capabilities":{"airDefense":2},
     "notes":"2× Baterias MANSUP-ER. Fixo."},
    {"id":"BLUE-DCOST2","name":"DEFCOST2","fullName":"Defesa Costeira 2","category":"land",
     "composition":[{"type":"bateria_costeira","quantity":2}],
     "stayingPower":2,"movement":1,
     "detectionRange":{"surface":2,"air":0,"submarine":0,"land":1},
     "attackRange":{"surface":3,"air":0,"submarine":0,"land":0},
     "weapons":{"mss":{"quantity":10,"range":3}},
     "capabilities":{"airDefense":2},
     "notes":"2× Baterias MANSUP-ER. Fixo."},
    {"id":"BLUE-ADA-1","name":"BDA1","fullName":"Batalhão ADA 1","category":"land",
     "composition":[{"type":"base_naval","quantity":2}],
     "stayingPower":2,"movement":1,
     "detectionRange":{"surface":1,"air":2,"submarine":0,"land":1},
     "attackRange":{"surface":0,"air":2,"submarine":0,"land":0},
     "weapons":{},
     "capabilities":{"airDefense":6,"bmd":2},
     "notes":"Btl ADA EB SHORAD/MANPADS. Rio de Janeiro."},
    {"id":"BLUE-ADA-2","name":"BDA2","fullName":"Batalhão ADA 2","category":"land",
     "composition":[{"type":"base_naval","quantity":2}],
     "stayingPower":2,"movement":1,
     "detectionRange":{"surface":1,"air":2,"submarine":0,"land":1},
     "attackRange":{"surface":0,"air":2,"submarine":0,"land":0},
     "weapons":{},
     "capabilities":{"airDefense":6,"bmd":2},
     "notes":"Btl ADA EB GBAD Médio. Santos."},
    {"id":"BLUE-FPSO1","name":"FPSO1","fullName":"Plataforma FPSO 1","category":"surface",
     "composition":[{"type":"plataforma","quantity":1}],
     "stayingPower":6,"movement":0,
     "detectionRange":{"surface":1,"air":1,"submarine":0,"land":0},
     "attackRange":{"surface":0,"air":0,"submarine":0,"land":0},
     "weapons":{},"capabilities":{},"notes":"Objetivo estratégico. Sem combate."},
    {"id":"BLUE-FPSO2","name":"FPSO2","fullName":"Plataforma FPSO 2","category":"surface",
     "composition":[{"type":"plataforma","quantity":1}],
     "stayingPower":6,"movement":0,
     "detectionRange":{"surface":1,"air":1,"submarine":0,"land":0},
     "attackRange":{"surface":0,"air":0,"submarine":0,"land":0},
     "weapons":{},"capabilities":{},"notes":"Objetivo estratégico. Sem combate."},
    {"id":"BLUE-FPSO3","name":"FPSO3","fullName":"Plataforma FPSO 3","category":"surface",
     "composition":[{"type":"plataforma","quantity":1}],
     "stayingPower":6,"movement":0,
     "detectionRange":{"surface":1,"air":1,"submarine":0,"land":0},
     "attackRange":{"surface":0,"air":0,"submarine":0,"land":0},
     "weapons":{},"capabilities":{},"notes":"Objetivo estratégico. Sem combate."},
    {"id":"BLUE-FPSO4","name":"FPSO4","fullName":"Plataforma FPSO 4","category":"surface",
     "composition":[{"type":"plataforma","quantity":1}],
     "stayingPower":6,"movement":0,
     "detectionRange":{"surface":1,"air":1,"submarine":0,"land":0},
     "attackRange":{"surface":0,"air":0,"submarine":0,"land":0},
     "weapons":{},"capabilities":{},"notes":"Objetivo estratégico. Sem combate."},
    {"id":"BLUE-PORTO-S","name":"Pto.Santos","fullName":"Porto de Santos","category":"land",
     "composition":[{"type":"porto","quantity":1}],
     "stayingPower":20,"movement":0,
     "detectionRange":{"surface":1,"air":0,"submarine":0,"land":1},
     "attackRange":{"surface":0,"air":0,"submarine":0,"land":0},
     "weapons":{},"capabilities":{},"notes":"SP=20. Hub logístico sul."},
    {"id":"BLUE-PORTO-RJ","name":"Pto.RJ","fullName":"Porto do Rio de Janeiro","category":"land",
     "composition":[{"type":"porto","quantity":1}],
     "stayingPower":20,"movement":0,
     "detectionRange":{"surface":1,"air":0,"submarine":0,"land":1},
     "attackRange":{"surface":0,"air":0,"submarine":0,"land":0},
     "weapons":{},"capabilities":{},"notes":"SP=20. Hub naval central."},
    {"id":"BLUE-PORTO-V","name":"Pto.Vitória","fullName":"Porto de Vitória","category":"land",
     "composition":[{"type":"porto","quantity":1}],
     "stayingPower":16,"movement":0,
     "detectionRange":{"surface":1,"air":0,"submarine":0,"land":1},
     "attackRange":{"surface":0,"air":0,"submarine":0,"land":0},
     "weapons":{},"capabilities":{},"notes":"SP=16."},
    {"id":"BLUE-PORTO-ACU","name":"Pto.Açu","fullName":"Porto do Açu","category":"land",
     "composition":[{"type":"porto","quantity":1}],
     "stayingPower":12,"movement":0,
     "detectionRange":{"surface":1,"air":0,"submarine":0,"land":1},
     "attackRange":{"surface":0,"air":0,"submarine":0,"land":0},
     "weapons":{},"capabilities":{},"notes":"SP=12. Terminal offshore."},
    {"id":"BLUE-AERO-RJ","name":"BA Santa Cruz","fullName":"BA Santa Cruz / Galeão","category":"land",
     "composition":[{"type":"aeroporto","quantity":1}],
     "stayingPower":10,"movement":0,
     "detectionRange":{"surface":1,"air":2,"submarine":0,"land":1},
     "attackRange":{"surface":0,"air":0,"submarine":0,"land":0},
     "weapons":{},"capabilities":{},"notes":"Recompletamento F-39 Gripen. Fixo."},
    {"id":"BLUE-AERO-SP","name":"BA Santos","fullName":"BA Santos / Campo de Marte","category":"land",
     "composition":[{"type":"aeroporto","quantity":1}],
     "stayingPower":10,"movement":0,
     "detectionRange":{"surface":1,"air":2,"submarine":0,"land":1},
     "attackRange":{"surface":0,"air":0,"submarine":0,"land":0},
     "weapons":{},"capabilities":{},"notes":"Recompletamento P-3AM. Fixo."},
    {"id":"BLUE-AERO-CF","name":"AeroCF/BANS","fullName":"Aeroporto Cabo Frio / BAN S.Pedro","category":"land",
     "composition":[{"type":"aeroporto","quantity":1}],
     "stayingPower":10,"movement":0,
     "detectionRange":{"surface":1,"air":2,"submarine":0,"land":1},
     "attackRange":{"surface":0,"air":0,"submarine":0,"land":0},
     "weapons":{},"capabilities":{},"notes":"Alternativa de recompletamento. Fixo."},
  ],
  "red": [
    {"id":"RED-GBPA","name":"CSG","fullName":"Grupo de Batalha (CSG)","category":"surface",
     "composition":[{"type":"navio_aeródromo","quantity":1},{"type":"helicoptero_ASup","quantity":6},{"type":"helicoptero_ASW","quantity":6}],
     "stayingPower":6,"movement":4,
     "detectionRange":{"surface":5,"air":4,"submarine":2,"land":2},
     "attackRange":{"surface":4,"air":1,"submarine":2,"land":2},
     "weapons":{"mss":{"quantity":10,"range":3}},
     "capabilities":{"airDefense":3,"asw":6,"airAttack":8},
     "notes":"KCV Aurelius Magnus. Nuclear. Imune ao FP."},
    {"id":"RED-GE-1","name":"ESCCSG","fullName":"Escolta CSG","category":"surface",
     "composition":[{"type":"cruzador","quantity":1},{"type":"destroyer","quantity":2},{"type":"helicoptero_ASW","quantity":6}],
     "stayingPower":12,"movement":4,
     "detectionRange":{"surface":3,"air":2,"submarine":2,"land":1},
     "attackRange":{"surface":6,"air":1,"submarine":2,"land":8},
     "weapons":{"ascm":{"quantity":14,"range":6},"mss":{"quantity":18,"range":3},"lacm":{"quantity":8,"range":10}},
     "capabilities":{"navalGun":6,"airDefense":13,"bmd":4,"asw":11},
     "notes":"1× CG Drakhmar + 2× DDG Volnaria. SAM/BMD/ASCM."},
    {"id":"RED-GE-2","name":"SAG1","fullName":"SAG Vermelho 1","category":"surface",
     "composition":[{"type":"destroyer","quantity":1},{"type":"fragata","quantity":2},{"type":"helicoptero_ASW","quantity":4}],
     "stayingPower":10,"movement":4,
     "detectionRange":{"surface":3,"air":2,"submarine":2,"land":1},
     "attackRange":{"surface":6,"air":1,"submarine":2,"land":8},
     "weapons":{"ascm":{"quantity":8,"range":6},"mss":{"quantity":12,"range":3},"lacm":{"quantity":2,"range":10}},
     "capabilities":{"navalGun":4,"airDefense":8,"bmd":1,"asw":8},
     "notes":"1× DDG + 2× FFG + Helos ASW."},
    {"id":"RED-GE-3","name":"SAG2","fullName":"SAG Vermelho 2","category":"surface",
     "composition":[{"type":"fragata","quantity":3}],
     "stayingPower":9,"movement":4,
     "detectionRange":{"surface":2,"air":2,"submarine":1,"land":1},
     "attackRange":{"surface":2,"air":1,"submarine":1,"land":1},
     "weapons":{"mss":{"quantity":12,"range":3}},
     "capabilities":{"navalGun":3,"airDefense":6,"asw":3},
     "notes":"3× Fragatas Cl. Volnaria."},
    {"id":"RED-AOR-G","name":"REAB","fullName":"Reabastecedor CSG","category":"surface",
     "composition":[{"type":"navio_tanque","quantity":1}],
     "stayingPower":3,"movement":2,
     "detectionRange":{"surface":1,"air":1,"submarine":0,"land":0},
     "attackRange":{"surface":0,"air":0,"submarine":0,"land":0},
     "weapons":{},"capabilities":{},"notes":"AOR Cl. Korvas. 24 FP. Proteger."},
    {"id":"RED-GANF","name":"ANFIB-E","fullName":"Grupo Anfíbio","category":"surface",
     "composition":[{"type":"navio_doca","quantity":2},{"type":"navio_desembarque","quantity":2}],
     "stayingPower":14,"movement":3,
     "detectionRange":{"surface":2,"air":1,"submarine":0,"land":2},
     "attackRange":{"surface":2,"air":1,"submarine":0,"land":2},
     "weapons":{},
     "capabilities":{"navalGun":4,"airDefense":4},
     "notes":"1× LPD Harnax + 2× LST Morvask. Crítico."},
    {"id":"RED-GLOG","name":"LOG1","fullName":"Grupo Logístico","category":"surface",
     "composition":[{"type":"navio_logistico","quantity":2}],
     "stayingPower":6,"movement":2,
     "detectionRange":{"surface":1,"air":1,"submarine":0,"land":0},
     "attackRange":{"surface":0,"air":0,"submarine":0,"land":0},
     "weapons":{},"capabilities":{},"notes":"AOR Korvas + AOT Brennar. 30 FP."},
    {"id":"RED-AKE","name":"LOG2","fullName":"Navio de Munições","category":"surface",
     "composition":[{"type":"navio_logistico","quantity":2}],
     "stayingPower":6,"movement":2,
     "detectionRange":{"surface":1,"air":1,"submarine":0,"land":0},
     "attackRange":{"surface":0,"air":0,"submarine":0,"land":0},
     "weapons":{},"capabilities":{},"notes":"AKE Cl. Yarven. 8 FP. Único rearm. em mar."},
    {"id":"RED-KSN","name":"SBN","fullName":"Submarino Nuclear","category":"submarine",
     "composition":[{"type":"submarino_nuclear","quantity":1}],
     "stayingPower":3,"movement":4,
     "detectionRange":{"surface":3,"air":0,"submarine":2,"land":0},
     "attackRange":{"surface":3,"air":0,"submarine":2,"land":8},
     "weapons":{"ascm":{"quantity":8,"range":6},"torpedo":{"quantity":12,"range":2},"lacm":{"quantity":4,"range":10}},
     "capabilities":{"asw":1},
     "notes":"KAR Veylan (SSN). Nuclear. Posição secreta."},
    {"id":"RED-KS-1","name":"SB","fullName":"Submarino Convencional","category":"submarine",
     "composition":[{"type":"submarino_convencional","quantity":1}],
     "stayingPower":2,"movement":2,
     "detectionRange":{"surface":2,"air":0,"submarine":1,"land":0},
     "attackRange":{"surface":2,"air":0,"submarine":1,"land":0},
     "weapons":{"ascm":{"quantity":4,"range":6},"torpedo":{"quantity":6,"range":2}},
     "capabilities":{"asw":1},
     "notes":"KAR Skarn. Posição secreta."},
    {"id":"RED-KMF-1","name":"PAC1","fullName":"Esquadrão de Caça 1","category":"air",
     "composition":[{"type":"caca","quantity":8}],
     "stayingPower":8,"movement":10,
     "detectionRange":{"surface":2,"air":2,"submarine":0,"land":1},
     "attackRange":{"surface":2,"air":2,"submarine":0,"land":1},
     "weapons":{},
     "capabilities":{"airDefense":8,"airAttack":8},
     "notes":"KMF-22 Sturmadler 4.5ª ger. Embarcado KCV."},
    {"id":"RED-KMF-2","name":"PAC2","fullName":"Esquadrão de Caça 2","category":"air",
     "composition":[{"type":"caca","quantity":8}],
     "stayingPower":8,"movement":10,
     "detectionRange":{"surface":2,"air":2,"submarine":0,"land":1},
     "attackRange":{"surface":2,"air":2,"submarine":0,"land":1},
     "weapons":{},
     "capabilities":{"airDefense":8,"airAttack":8},
     "notes":"KMF-22 Sturmadler 4.5ª ger. Embarcado KCV."},
    {"id":"RED-MPRA-K1","name":"PATMAR1","fullName":"Patrulha Marítima 1","category":"air",
     "composition":[{"type":"patrulha_maritima","quantity":2}],
     "stayingPower":2,"movement":12,
     "detectionRange":{"surface":3,"air":1,"submarine":2,"land":1},
     "attackRange":{"surface":2,"air":0,"submarine":1,"land":0},
     "weapons":{"ascm":{"quantity":2,"range":6},"mss":{"quantity":2,"range":2},"torpedo":{"quantity":2,"range":2}},
     "capabilities":{"asw":2,"airAttack":2},
     "notes":"K-32 Stormwatch. ASW + anti-superfície."},
    {"id":"RED-MPRA-K2","name":"PATMAR2","fullName":"Patrulha Marítima 2","category":"air",
     "composition":[{"type":"patrulha_maritima","quantity":2}],
     "stayingPower":2,"movement":12,
     "detectionRange":{"surface":3,"air":1,"submarine":2,"land":1},
     "attackRange":{"surface":2,"air":0,"submarine":1,"land":0},
     "weapons":{"ascm":{"quantity":2,"range":6},"mss":{"quantity":2,"range":2},"torpedo":{"quantity":2,"range":2}},
     "capabilities":{"asw":2,"airAttack":2},
     "notes":"K-32 Stormwatch. Embarcado KCV."},
    {"id":"RED-AWACS-K","name":"AWACS","fullName":"AEW / AWACS","category":"air",
     "composition":[{"type":"aew","quantity":2}],
     "stayingPower":2,"movement":10,
     "detectionRange":{"surface":3,"air":4,"submarine":0,"land":1},
     "attackRange":{"surface":0,"air":0,"submarine":0,"land":0},
     "weapons":{},"capabilities":{},"notes":"K-99 Argus. ISR 9 hex. Crítico. Embarcado KCV."},
  ]
}

# ── Helpers ───────────────────────────────────────────────────────────────────

def fp_value(unit):
    uid = unit['id']
    if uid == 'RED-GBPA' or 'nuclear' in str(unit.get('composition',[])):
        if uid == 'RED-GBPA': return '∞ (Nuclear)'
        # check if nuclear sub
        for c in unit.get('composition', []):
            if c['type'] == 'submarino_nuclear': return '∞ (Nuclear)'
    if unit['category'] == 'air':
        return f"{unit['movement']} FP"
    if uid in UNIT_FP:
        return f"{UNIT_FP[uid]} FP"
    if unit['category'] == 'submarine':
        for c in unit.get('composition', []):
            if c['type'] == 'submarino_convencional': return f"{SUB_FP} FP"
    return '—'

def best_det(unit):
    dr = unit.get('detectionRange', {})
    v = max((dr.get(k, 0) for k in dr), default=0)
    return str(v) if v > 0 else '0'

def best_atk(unit):
    ar = unit.get('attackRange', {})
    v = max((ar.get(k, 0) for k in ar), default=0)
    return str(v) if v > 0 else '0'

def total_weapons(unit):
    total = sum(w.get('quantity', 0) for w in unit.get('weapons', {}).values())
    return str(total) if total > 0 else '—'

def composition_str(unit):
    parts = []
    for c in unit.get('composition', []):
        label = COMP_LABELS.get(c['type'], c['type'])
        parts.append(f"{c['quantity']}× {label}")
    return '  |  '.join(parts)

def cap_str(unit):
    caps = unit.get('capabilities', {})
    if not caps:
        return '—'
    parts = []
    for k, v in caps.items():
        label = CAP_LABELS.get(k, k)
        parts.append(f"{label}: {v}")
    return '  |  '.join(parts)

def weapon_str(unit):
    wps = unit.get('weapons', {})
    if not wps:
        return '—'
    parts = []
    for k, v in wps.items():
        label = WEAPON_LABELS.get(k, k.upper())
        parts.append(f"{label} ×{v['quantity']} (R:{v['range']})")
    return '  |  '.join(parts)

# ── Text helpers ──────────────────────────────────────────────────────────────

def add_text_box(slide, text, left, top, width, height,
                 font_size=10, bold=False, color=None,
                 bg_color=None, align=PP_ALIGN.LEFT, wrap=True):
    txBox = slide.shapes.add_textbox(left, top, width, height)
    tf = txBox.text_frame
    tf.word_wrap = wrap
    p = tf.paragraphs[0]
    p.alignment = align
    run = p.add_run()
    run.text = text
    run.font.size = Pt(font_size)
    run.font.bold = bold
    if color:
        run.font.color.rgb = color
    if bg_color:
        fill = txBox.fill
        fill.solid()
        fill.fore_color.rgb = bg_color
    return txBox

def add_rect(slide, left, top, width, height, fill_color, line_color=None, line_width=None):
    from pptx.util import Pt as PtU
    shape = slide.shapes.add_shape(
        1,  # MSO_SHAPE_TYPE.RECTANGLE
        left, top, width, height
    )
    shape.fill.solid()
    shape.fill.fore_color.rgb = fill_color
    if line_color:
        shape.line.color.rgb = line_color
        if line_width:
            shape.line.width = line_width
    else:
        shape.line.fill.background()
    return shape

# ── Card builder ──────────────────────────────────────────────────────────────

def build_card(slide, unit, team):
    is_blue = (team == 'blue')
    dark   = BLUE_DARK  if is_blue else RED_DARK
    mid    = BLUE_MID   if is_blue else RED_MID
    light  = BLUE_LIGHT if is_blue else RED_LIGHT
    team_label = 'FORÇA AZUL' if is_blue else 'FORÇA VERMELHA'
    cat_label, cat_icon = CAT_META.get(unit['category'], ('', ''))

    W, H = CARD_W, CARD_H

    # ── Background ────────────────────────────────────────────────────────────
    add_rect(slide, 0, 0, W, H, WHITE, dark, Mm(0.5))

    # ── Top stripe: team color band ───────────────────────────────────────────
    add_rect(slide, 0, 0, W, Mm(11), dark)

    # Team label
    add_text_box(slide, team_label,
                 Mm(1), Mm(0.5), Mm(45), Mm(5),
                 font_size=6, bold=True, color=WHITE, align=PP_ALIGN.LEFT)

    # Category badge (right side of stripe)
    add_text_box(slide, f"{cat_icon} {cat_label}",
                 Mm(1), Mm(5.5), W - Mm(2), Mm(5),
                 font_size=7, bold=False, color=GOLD, align=PP_ALIGN.RIGHT)

    # ── Unit code / ID ────────────────────────────────────────────────────────
    add_rect(slide, 0, Mm(11), W, Mm(8), mid)
    add_text_box(slide, unit['name'],
                 Mm(1), Mm(11.2), W - Mm(2), Mm(7.5),
                 font_size=14, bold=True, color=WHITE, align=PP_ALIGN.CENTER)

    # ── Full name ─────────────────────────────────────────────────────────────
    add_rect(slide, 0, Mm(19), W, Mm(6), light)
    add_text_box(slide, unit['fullName'],
                 Mm(1), Mm(19.2), W - Mm(2), Mm(5.5),
                 font_size=7.5, bold=False, color=dark, align=PP_ALIGN.CENTER)

    # ── Silhouette / icon area ────────────────────────────────────────────────
    add_rect(slide, Mm(1.5), Mm(25.5), W - Mm(3), Mm(14), LIGHT_GRAY, MED_GRAY, Mm(0.3))
    big_icon = cat_icon
    add_text_box(slide, big_icon,
                 Mm(1.5), Mm(26), W - Mm(3), Mm(13),
                 font_size=28, bold=False, color=mid, align=PP_ALIGN.CENTER)

    # Composition label inside icon area
    add_text_box(slide, composition_str(unit),
                 Mm(1.5), Mm(36.5), W - Mm(3), Mm(4),
                 font_size=5.5, bold=False, color=DARK_GRAY, align=PP_ALIGN.CENTER)

    # ── Stats section ─────────────────────────────────────────────────────────
    stats_top = Mm(40.5)

    def stat_row(label, value, y, alt=False):
        row_h = Mm(5.8)
        bg = LIGHT_GRAY if alt else WHITE
        add_rect(slide, 0, y, W, row_h, bg)
        add_text_box(slide, label,
                     Mm(1.5), y + Mm(0.3), Mm(34), row_h - Mm(0.5),
                     font_size=7.5, bold=False, color=DARK_GRAY, align=PP_ALIGN.LEFT)
        add_text_box(slide, value,
                     W - Mm(25), y + Mm(0.3), Mm(23.5), row_h - Mm(0.5),
                     font_size=7.5, bold=True, color=dark, align=PP_ALIGN.RIGHT)
        # divider line
        add_rect(slide, Mm(1.5), y + row_h - Mm(0.2), W - Mm(3), Mm(0.2),
                 RGBColor(0xDD, 0xDD, 0xDD))

    # Stats label header
    add_rect(slide, 0, stats_top, W, Mm(4.5), dark)
    add_text_box(slide, 'ATRIBUTOS',
                 Mm(1), stats_top + Mm(0.3), W - Mm(2), Mm(4),
                 font_size=6.5, bold=True, color=WHITE, align=PP_ALIGN.CENTER)

    y = stats_top + Mm(4.5)
    stat_row('Staying Power (HP)',      str(unit['stayingPower']),  y,       alt=False)
    stat_row('Movimento (hexes/turno)', str(unit['movement']),      y+Mm(5.8), alt=True)
    stat_row('Detecção (melhor)',       best_det(unit),             y+Mm(11.6),alt=False)
    stat_row('Alcance Ataque (melhor)', best_atk(unit),             y+Mm(17.4),alt=True)
    stat_row('Armamento (total)',       total_weapons(unit),        y+Mm(23.2),alt=False)
    stat_row('Combustível (FP)',        fp_value(unit),             y+Mm(29),  alt=True)

    # ── Capabilities bar ──────────────────────────────────────────────────────
    cap_top = y + Mm(35)
    add_rect(slide, 0, cap_top, W, Mm(4.5), mid)
    add_text_box(slide, 'CAPACIDADES',
                 Mm(1), cap_top + Mm(0.2), W - Mm(2), Mm(4),
                 font_size=6, bold=True, color=WHITE, align=PP_ALIGN.CENTER)

    cap_text = cap_str(unit)
    cap_box_h = Mm(7)
    add_rect(slide, 0, cap_top + Mm(4.5), W, cap_box_h, WHITE)
    add_text_box(slide, cap_text,
                 Mm(1.5), cap_top + Mm(4.8), W - Mm(3), cap_box_h - Mm(0.5),
                 font_size=6, bold=False, color=DARK_GRAY, align=PP_ALIGN.CENTER, wrap=True)

    # ── Weapons detail ────────────────────────────────────────────────────────
    wpn_top = cap_top + Mm(11.5)
    add_rect(slide, 0, wpn_top, W, Mm(4.5), mid)
    add_text_box(slide, 'ARMAMENTO',
                 Mm(1), wpn_top + Mm(0.2), W - Mm(2), Mm(4),
                 font_size=6, bold=True, color=WHITE, align=PP_ALIGN.CENTER)

    wpn_text = weapon_str(unit)
    wpn_box_h = Mm(8)
    add_rect(slide, 0, wpn_top + Mm(4.5), W, wpn_box_h, LIGHT_GRAY)
    add_text_box(slide, wpn_text,
                 Mm(1.5), wpn_top + Mm(4.8), W - Mm(3), wpn_box_h - Mm(0.5),
                 font_size=5.5, bold=False, color=DARK_GRAY, align=PP_ALIGN.CENTER, wrap=True)

    # ── Notes footer ──────────────────────────────────────────────────────────
    notes_top = wpn_top + Mm(12.5)
    remaining = H - notes_top - Mm(1)
    notes_text = unit.get('notes', '')
    add_rect(slide, 0, notes_top, W, remaining + Mm(1), dark)
    if notes_text:
        add_text_box(slide, f'ℹ {notes_text}',
                     Mm(1.5), notes_top + Mm(0.5), W - Mm(3), remaining,
                     font_size=5.5, bold=False, color=WHITE, align=PP_ALIGN.LEFT, wrap=True)

    # ── Card border (top layer) ───────────────────────────────────────────────
    border = slide.shapes.add_shape(1, 0, 0, W, H)
    border.fill.background()
    border.line.color.rgb = dark
    border.line.width = Mm(0.6)


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    prs = Presentation()
    prs.slide_width  = CARD_W
    prs.slide_height = CARD_H

    blank_layout = prs.slide_layouts[6]  # truly blank

    total = 0
    for team, units in UNITS.items():
        for unit in units:
            slide = prs.slides.add_slide(blank_layout)
            build_card(slide, unit, team)
            total += 1

    out = '/home/user/wargame-naval/cards_super_trunfo.pptx'
    prs.save(out)
    print(f"Salvo: {out}  ({total} cards)")

if __name__ == '__main__':
    main()
