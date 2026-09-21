"""
gen_cards.py — Gera cards Super Trunfo para Guerra das Malvinas/Falkland 1982
Formato: PowerPoint, 1 card por slide (63.5 mm × 88.9 mm)
Saída:   cards_super_trunfo.pptx
"""

import os
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
    'BLUE-VM':       14, 'BLUE-VE':      10, 'BLUE-BV':      10,
    'BLUE-B':        10, 'BLUE-BS':      10,
    'BLUE-LOG-1':    30, 'BLUE-LOG-2':   34,
    'BLUE-PAT':       8, 'BLUE-MCM':      8, 'BLUE-ISR':     10,
    'BLUE-LG':        8, 'BLUE-CARGO':   30,
    'RED-HERMES':    14, 'RED-INVINCIBLE':14,
    'RED-SCR-1':     10, 'RED-SCR-2':    10,
    'RED-ESC-1':     10, 'RED-ESC-2':    10,
    'RED-TRAIL':     10, 'RED-LAND-SCR': 10, 'RED-SG-SCR':   10, 'RED-SG-ICE': 10,
    'RED-LPD':       10, 'RED-TROOP':    10,
    'RED-LOG-1':     30, 'RED-LOG-2':    34, 'RED-LOG-3':    34,
    'RED-TANK':      40, 'RED-MCM':       8, 'RED-HOSP':     12,
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
    'bateria_ada':           'Bateria AAA/SAM',
    'base_naval':            'Batalhão ADA',
    'infantaria':            'Efetivo Terrestre',
    'operacoes_especiais':   'Operações Especiais',
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
    {"id":"BLUE-VM","name":"GT Porta-Aviões","fullName":"GT Porta-Aviões","category":"surface","composition":[{"type":"navio_aeródromo","quantity":1},{"type":"helicoptero_ASW","quantity":2},{"type":"helicoptero_ASup","quantity":2}],"stayingPower":8,"movement":4,"detectionRange":{"surface":3,"air":2,"submarine":1,"land":1},"attackRange":{"surface":1,"air":1,"submarine":1,"land":0},"weapons":{},"capabilities":{"airDefense":1,"asw":2},"notes":"ARA Veinticinco de Mayo (ex-HMS Venerable). Porta-aviões leve a vapor. Base da 1ª Esquadrilha de A-4Q."},
    {"id":"BLUE-VM-AIR","name":"1ª Esq. A-4Q","fullName":"1ª Esq. A-4Q","category":"air","composition":[{"type":"ataque","quantity":8}],"stayingPower":4,"movement":9,"detectionRange":{"surface":2,"air":1,"submarine":0,"land":1},"attackRange":{"surface":2,"air":0,"submarine":0,"land":2},"weapons":{"mss":{"quantity":6,"range":2}},"capabilities":{"airAttack":6},"notes":"8× A-4Q Skyhawk embarcados. Único esquadrão naval a operar de porta-aviões no conflito."},
    {"id":"BLUE-VE","name":"Escolta GT-PA","fullName":"Escolta GT-PA","category":"surface","composition":[{"type":"destroyer","quantity":2},{"type":"helicoptero_ASup","quantity":1}],"stayingPower":6,"movement":5,"detectionRange":{"surface":2,"air":2,"submarine":1,"land":1},"attackRange":{"surface":2,"air":1,"submarine":1,"land":1},"weapons":{"ascm":{"quantity":8,"range":6},"mss":{"quantity":6,"range":3}},"capabilities":{"navalGun":2,"airDefense":5,"asw":2},"notes":"ARA Hércules + ARA Santísima Trinidad (Type 42, Sea Dart/Exocet). Escolta principal do GT porta-aviões."},
    {"id":"BLUE-BV","name":"Esquadra de Corvetas","fullName":"Esquadra de Corvetas","category":"surface","composition":[{"type":"corveta","quantity":3}],"stayingPower":6,"movement":5,"detectionRange":{"surface":2,"air":1,"submarine":1,"land":1},"attackRange":{"surface":2,"air":1,"submarine":1,"land":0},"weapons":{"ascm":{"quantity":9,"range":6}},"capabilities":{"navalGun":3,"airDefense":3,"asw":2},"notes":"ARA Drummond, Guerrico e Granville (classe A69). Guerrico avariada em Grytviken, 3 abr 1982."},
    {"id":"BLUE-B","name":"Belgrano","fullName":"Belgrano","category":"surface","composition":[{"type":"cruzador","quantity":1}],"stayingPower":10,"movement":4,"detectionRange":{"surface":2,"air":1,"submarine":0,"land":1},"attackRange":{"surface":3,"air":0,"submarine":0,"land":2},"weapons":{},"capabilities":{"navalGun":8,"airDefense":2},"notes":"ARA General Belgrano (ex-USS Phoenix). Forte artilharia de 6\". Afundado por torpedos em 2 mai 1982 — 323 mortos."},
    {"id":"BLUE-BS","name":"Escolta Belgrano","fullName":"Escolta Belgrano","category":"surface","composition":[{"type":"destroyer","quantity":2}],"stayingPower":6,"movement":5,"detectionRange":{"surface":2,"air":1,"submarine":1,"land":1},"attackRange":{"surface":2,"air":1,"submarine":1,"land":1},"weapons":{"ascm":{"quantity":6,"range":6}},"capabilities":{"navalGun":5,"airDefense":3,"asw":2},"notes":"ARA Hipólito Bouchard + ARA Piedrabuena (ex-Fletcher/Sumner). Escolta do Belgrano."},
    {"id":"BLUE-LOG-1","name":"Petroleiro GT-PA","fullName":"Petroleiro GT-PA","category":"surface","composition":[{"type":"navio_tanque","quantity":1}],"stayingPower":4,"movement":2,"detectionRange":{"surface":1,"air":1,"submarine":0,"land":0},"attackRange":{"surface":0,"air":0,"submarine":0,"land":0},"weapons":{},"capabilities":{},"notes":"ARA Punta Médanos. Petroleiro de esquadra do GT porta-aviões."},
    {"id":"BLUE-LOG-2","name":"Petroleiro Geral","fullName":"Petroleiro Geral","category":"surface","composition":[{"type":"navio_tanque","quantity":2}],"stayingPower":5,"movement":2,"detectionRange":{"surface":1,"air":1,"submarine":0,"land":0},"attackRange":{"surface":0,"air":0,"submarine":0,"land":0},"weapons":{},"capabilities":{},"notes":"ARA Punta Delgada + petroleiro de serviço geral. Abastece o GT Belgrano e a retaguarda continental."},
    {"id":"BLUE-SUB-1","name":"Santa Fe","fullName":"Santa Fe","category":"submarine","composition":[{"type":"submarino_convencional","quantity":1}],"stayingPower":2,"movement":2,"detectionRange":{"surface":2,"air":0,"submarine":1,"land":0},"attackRange":{"surface":2,"air":0,"submarine":1,"land":0},"weapons":{"torpedo":{"quantity":4,"range":2}},"capabilities":{},"notes":"ARA Santa Fe (ex-USS Catfish, classe Guppy). Avariada e encalhada em Grytviken, 25 abr 1982."},
    {"id":"BLUE-SUB-2","name":"San Luis","fullName":"San Luis","category":"submarine","composition":[{"type":"submarino_convencional","quantity":1}],"stayingPower":3,"movement":3,"detectionRange":{"surface":2,"air":0,"submarine":1,"land":0},"attackRange":{"surface":2,"air":0,"submarine":1,"land":0},"weapons":{"torpedo":{"quantity":4,"range":2}},"capabilities":{},"notes":"ARA San Luis (Type 209). Realizou vários ataques frustrados contra a Força-Tarefa britânica."},
    {"id":"BLUE-PAT","name":"Patrulha Costeira","fullName":"Patrulha Costeira","category":"surface","composition":[{"type":"navio_patrulha","quantity":4}],"stayingPower":4,"movement":4,"detectionRange":{"surface":1,"air":1,"submarine":0,"land":1},"attackRange":{"surface":1,"air":1,"submarine":0,"land":0},"weapons":{"mss":{"quantity":4,"range":1}},"capabilities":{"airDefense":2},"notes":"Lanchas Z-28 (Islas Malvinas, Río Iguazú) + patrulheiros Dabur. Vigilância costeira das ilhas."},
    {"id":"BLUE-MCM","name":"Grupo Caça-Minas","fullName":"Grupo Caça-Minas","category":"surface","composition":[{"type":"navio_patrulha","quantity":4}],"stayingPower":5,"movement":3,"detectionRange":{"surface":1,"air":0,"submarine":0,"land":1},"attackRange":{"surface":0,"air":0,"submarine":0,"land":0},"weapons":{},"capabilities":{},"notes":"Grupos M1/M2. Lança e localiza campos minados no Estreito de San Carlos."},
    {"id":"BLUE-ISR","name":"Piquete de Vigilância","fullName":"Piquete de Vigilância","category":"surface","composition":[{"type":"navio_patrulha","quantity":5}],"stayingPower":3,"movement":2,"detectionRange":{"surface":3,"air":1,"submarine":0,"land":1},"attackRange":{"surface":0,"air":0,"submarine":0,"land":0},"weapons":{},"capabilities":{},"notes":"Traineiras e mercantes civis reconvertidos em piquetes de vigilância (Narwal, Alejandra, Costanza e outros)."},
    {"id":"BLUE-LG","name":"Grupo de Desembarque","fullName":"Grupo de Desembarque","category":"surface","composition":[{"type":"navio_desembarque","quantity":2},{"type":"navio_doca","quantity":1}],"stayingPower":6,"movement":3,"detectionRange":{"surface":1,"air":1,"submarine":0,"land":1},"attackRange":{"surface":1,"air":0,"submarine":0,"land":1},"weapons":{},"capabilities":{"navalGun":1,"airDefense":1},"notes":"2× LST + 1 rebocador de alto-mar. Liga o continente a Porto Argentino com reforços e suprimentos."},
    {"id":"BLUE-CARGO","name":"Cargueiros de Suprimento","fullName":"Cargueiros de Suprimento","category":"surface","composition":[{"type":"navio_logistico","quantity":3}],"stayingPower":6,"movement":2,"detectionRange":{"surface":1,"air":1,"submarine":0,"land":0},"attackRange":{"surface":0,"air":0,"submarine":0,"land":0},"weapons":{},"capabilities":{},"notes":"Formosa/Río Carcarañá, Río Cincel/Mar del Norte, Lago Argentino/Puerto Rosales. Mantêm a guarnição de Porto Argentino suprida."},
    {"id":"BLUE-SOF","name":"Comandos Anfíbios","fullName":"Comandos Anfíbios","category":"specops","composition":[{"type":"operacoes_especiais","quantity":1}],"stayingPower":2,"movement":2,"detectionRange":{"surface":0,"air":0,"submarine":0,"land":1},"attackRange":{"surface":1,"air":0,"submarine":0,"land":2},"weapons":{"raid":{"quantity":3,"range":2}},"capabilities":{},"notes":"Comandos Anfíbios / Buzos Tácticos. Embarcados no ARA San Luis."},
    {"id":"BLUE-CACA","name":"Mirage III / Dagger","fullName":"Mirage III / Dagger","category":"air","composition":[{"type":"caca","quantity":15}],"stayingPower":8,"movement":6,"detectionRange":{"surface":1,"air":2,"submarine":0,"land":1},"attackRange":{"surface":1,"air":2,"submarine":0,"land":1},"weapons":{},"capabilities":{"airDefense":8,"airAttack":4},"notes":"Mirage IIIEA (Grupo 8) + Dagger (Grupo 6). Alcance limitado sobre as ilhas — poucos minutos de permanência."},
    {"id":"BLUE-ATQ-SKYHAWK","name":"A-4B/C Skyhawk","fullName":"A-4B/C Skyhawk","category":"air","composition":[{"type":"ataque","quantity":30}],"stayingPower":10,"movement":6,"detectionRange":{"surface":2,"air":1,"submarine":0,"land":1},"attackRange":{"surface":2,"air":0,"submarine":0,"land":2},"weapons":{"mss":{"quantity":10,"range":2}},"capabilities":{"airAttack":9},"notes":"A-4B (Grupo 5) + A-4C (Grupo 4). Principal força de ataque continental contra a Força-Tarefa."},
    {"id":"BLUE-ATQ-ETEN","name":"Super Étendard","fullName":"Super Étendard","category":"air","composition":[{"type":"ataque","quantity":5}],"stayingPower":3,"movement":7,"detectionRange":{"surface":2,"air":1,"submarine":0,"land":0},"attackRange":{"surface":3,"air":0,"submarine":0,"land":0},"weapons":{"ascm":{"quantity":5,"range":6}},"capabilities":{"airAttack":2},"notes":"2ª Esquadrilha Aeronaval de Caça e Ataque. Apenas 5 mísseis AM39 Exocet ar-superfície disponíveis em toda a guerra."},
    {"id":"BLUE-BOM-CANB","name":"Canberra","fullName":"Canberra","category":"air","composition":[{"type":"ataque","quantity":7}],"stayingPower":5,"movement":6,"detectionRange":{"surface":1,"air":0,"submarine":0,"land":1},"attackRange":{"surface":2,"air":0,"submarine":0,"land":2},"weapons":{"lacm":{"quantity":4,"range":8}},"capabilities":{"airAttack":3},"notes":"Grupo 2 de Bombardeo. Bombardeiro de longo alcance, baixa sobrevivência diante de caças modernos."},
    {"id":"BLUE-ISR-AIR","name":"Lear Jet / SP-2 Neptune","fullName":"Lear Jet / SP-2 Neptune","category":"air","composition":[{"type":"patrulha_maritima","quantity":6}],"stayingPower":3,"movement":10,"detectionRange":{"surface":4,"air":1,"submarine":1,"land":1},"attackRange":{"surface":0,"air":0,"submarine":0,"land":0},"weapons":{},"capabilities":{},"notes":"Lear Jet 35A (Esc. Fénix) + SP-2H Neptune. ISR de longo alcance, sem armamento."},
    {"id":"BLUE-PUCARA","name":"Pucará","fullName":"Pucará","category":"air","composition":[{"type":"ataque","quantity":16}],"stayingPower":8,"movement":4,"detectionRange":{"surface":1,"air":0,"submarine":0,"land":2},"attackRange":{"surface":1,"air":0,"submarine":0,"land":2},"weapons":{},"capabilities":{"airAttack":5},"notes":"IA-58 Pucará — esquadrilhas de Porto Argentino/Ganso Verde/Ilha Pebble, já incluindo reforços dos turnos 3 e 4. Ataque ao solo, baixa velocidade."},
    {"id":"BLUE-GARR-STANLEY","name":"Guarnição de Porto Argentino","fullName":"Guarnição de Porto Argentino","category":"land","composition":[{"type":"infantaria","quantity":5},{"type":"bateria_ada","quantity":4}],"stayingPower":14,"movement":1,"detectionRange":{"surface":1,"air":2,"submarine":0,"land":3},"attackRange":{"surface":2,"air":0,"submarine":0,"land":3},"weapons":{},"capabilities":{"navalGun":4,"airDefense":6},"notes":"10ª Brigada de Infantería (3º, 6º, 7º, 25º RI) + 5º Batalhão de Infantaria de Marinha. ~5.000 efetivos. Artilharia 105mm + baterias Tigercat/Roland/35mm."},
    {"id":"BLUE-EXOCET-STANLEY","name":"Bateria Exocet MM38","fullName":"Bateria Exocet MM38","category":"land","composition":[{"type":"bateria_costeira","quantity":1}],"stayingPower":3,"movement":0,"detectionRange":{"surface":2,"air":0,"submarine":0,"land":0},"attackRange":{"surface":3,"air":0,"submarine":0,"land":0},"weapons":{"ascm":{"quantity":2,"range":3}},"capabilities":{},"notes":"2× lançadores MM38 Exocet improvisados por técnicos navais. Atingiu o HMS Glamorgan em 12 jun 1982 — sem reabastecimento possível."},
    {"id":"BLUE-GARR-GOOSE","name":"Guarnição de Ganso Verde","fullName":"Guarnição de Ganso Verde","category":"land","composition":[{"type":"infantaria","quantity":2},{"type":"bateria_ada","quantity":2}],"stayingPower":6,"movement":1,"detectionRange":{"surface":1,"air":1,"submarine":0,"land":2},"attackRange":{"surface":1,"air":0,"submarine":0,"land":2},"weapons":{},"capabilities":{"navalGun":1,"airDefense":2},"notes":"12º Regimiento de Infantería (Cia A + B). Defende Ganso Verde/Prado do Ganso."},
    {"id":"BLUE-GARR-WEST","name":"Guarnição da Falkland Ocidental","fullName":"Guarnição da Falkland Ocidental","category":"land","composition":[{"type":"infantaria","quantity":2}],"stayingPower":4,"movement":1,"detectionRange":{"surface":1,"air":1,"submarine":0,"land":1},"attackRange":{"surface":1,"air":0,"submarine":0,"land":1},"weapons":{},"capabilities":{"airDefense":1},"notes":"Forças de Segurança de Port Howard e Fox Bay, Falkland Ocidental."},
    {"id":"BLUE-GARR-SG","name":"Guarnição da Geórgia do Sul","fullName":"Guarnição da Geórgia do Sul","category":"land","composition":[{"type":"infantaria","quantity":1}],"stayingPower":2,"movement":1,"detectionRange":{"surface":1,"air":0,"submarine":0,"land":1},"attackRange":{"surface":1,"air":0,"submarine":0,"land":1},"weapons":{},"capabilities":{},"notes":"Pequeno destacamento em Grytviken/Leith. Capturado em 25 abr 1982 após ataque naval e aéreo britânico."},
    {"id":"BLUE-AERO-N","name":"BAM Rivadavia / San Julián","fullName":"BAM Rivadavia / San Julián","category":"land","composition":[{"type":"aeroporto","quantity":2}],"stayingPower":12,"movement":0,"detectionRange":{"surface":1,"air":2,"submarine":0,"land":1},"attackRange":{"surface":0,"air":0,"submarine":0,"land":0},"weapons":{},"capabilities":{},"notes":"Bases Aéreas Militares de Comodoro Rivadavia e San Julián. Recompletamento de caças e bombardeiros Canberra."},
    {"id":"BLUE-AERO-RG","name":"BAM Río Gallegos","fullName":"BAM Río Gallegos","category":"land","composition":[{"type":"aeroporto","quantity":1}],"stayingPower":12,"movement":0,"detectionRange":{"surface":1,"air":2,"submarine":0,"land":1},"attackRange":{"surface":0,"air":0,"submarine":0,"land":0},"weapons":{},"capabilities":{},"notes":"Principal base continental de A-4B/C Skyhawk."},
    {"id":"BLUE-PORTO-RG","name":"Porto de Río Gallegos","fullName":"Porto de Río Gallegos","category":"land","composition":[{"type":"porto","quantity":1}],"stayingPower":10,"movement":0,"detectionRange":{"surface":1,"air":0,"submarine":0,"land":1},"attackRange":{"surface":0,"air":0,"submarine":0,"land":0},"weapons":{},"capabilities":{},"notes":"Hub logístico continental. Reabastece navios argentinos em operação."},
    {"id":"BLUE-AERO-RGR","name":"BAM Río Grande","fullName":"BAM Río Grande","category":"land","composition":[{"type":"aeroporto","quantity":1}],"stayingPower":12,"movement":0,"detectionRange":{"surface":1,"air":2,"submarine":0,"land":1},"attackRange":{"surface":0,"air":0,"submarine":0,"land":0},"weapons":{},"capabilities":{},"notes":"Base dos Super Étendard e A-4Q. A mais próxima das ilhas entre as bases continentais."},
  ],
  "red": [
    {"id":"RED-HERMES","name":"HMS Hermes","fullName":"HMS Hermes","category":"surface","composition":[{"type":"navio_aeródromo","quantity":1},{"type":"helicoptero_ASW","quantity":6},{"type":"helicoptero_ASup","quantity":2}],"stayingPower":10,"movement":4,"detectionRange":{"surface":3,"air":2,"submarine":1,"land":1},"attackRange":{"surface":1,"air":1,"submarine":1,"land":0},"weapons":{},"capabilities":{"airDefense":1,"asw":3},"notes":"Nau capitânia da Força-Tarefa. Casco de 1959, grande grupo aéreo. Prime alvo de Exocet."},
    {"id":"RED-HAR-1","name":"800 NAS Sea Harrier","fullName":"800 NAS Sea Harrier","category":"air","composition":[{"type":"caca","quantity":12}],"stayingPower":6,"movement":10,"detectionRange":{"surface":2,"air":2,"submarine":0,"land":1},"attackRange":{"surface":2,"air":2,"submarine":0,"land":2},"weapons":{"mss":{"quantity":8,"range":2}},"capabilities":{"airDefense":9,"airAttack":6},"notes":"12× Sea Harrier FRS.1. CAP + ataque ao solo. Nenhuma perda em combate ar-ar durante toda a guerra."},
    {"id":"RED-INVINCIBLE","name":"HMS Invincible","fullName":"HMS Invincible","category":"surface","composition":[{"type":"navio_aeródromo","quantity":1},{"type":"helicoptero_ASW","quantity":4},{"type":"helicoptero_ASup","quantity":2}],"stayingPower":8,"movement":4,"detectionRange":{"surface":3,"air":2,"submarine":1,"land":1},"attackRange":{"surface":1,"air":1,"submarine":1,"land":0},"weapons":{},"capabilities":{"airDefense":1,"asw":3},"notes":"Porta-aviões leve (\"through-deck cruiser\"), mais moderno e resistente que o Hermes, grupo aéreo menor."},
    {"id":"RED-HAR-2","name":"801 NAS Sea Harrier","fullName":"801 NAS Sea Harrier","category":"air","composition":[{"type":"caca","quantity":9}],"stayingPower":5,"movement":10,"detectionRange":{"surface":2,"air":2,"submarine":0,"land":1},"attackRange":{"surface":2,"air":2,"submarine":0,"land":2},"weapons":{"mss":{"quantity":6,"range":2}},"capabilities":{"airDefense":7,"airAttack":5},"notes":"9× Sea Harrier FRS.1, reforçado em voo por Harriers ferry do Atlantic Conveyor em maio."},
    {"id":"RED-SCR-1","name":"Screen 1","fullName":"Screen 1","category":"surface","composition":[{"type":"destroyer","quantity":2}],"stayingPower":8,"movement":5,"detectionRange":{"surface":2,"air":2,"submarine":1,"land":1},"attackRange":{"surface":2,"air":1,"submarine":1,"land":1},"weapons":{"mss":{"quantity":12,"range":3}},"capabilities":{"navalGun":2,"airDefense":8,"asw":2},"notes":"HMS Glasgow + HMS Sheffield (Type 42, Sea Dart). Sheffield afundado por Exocet em 4 mai 1982 — 20 mortos."},
    {"id":"RED-SCR-2","name":"Screen 2","fullName":"Screen 2","category":"surface","composition":[{"type":"destroyer","quantity":1},{"type":"fragata","quantity":1}],"stayingPower":6,"movement":5,"detectionRange":{"surface":2,"air":2,"submarine":1,"land":1},"attackRange":{"surface":2,"air":1,"submarine":1,"land":1},"weapons":{"mss":{"quantity":6,"range":3}},"capabilities":{"navalGun":2,"airDefense":5,"asw":2},"notes":"HMS Coventry (Type 42) + HMS Arrow (Type 21). Coventry afundado em 25 mai após 3 ataques aéreos, abatendo 2 aeronaves antes."},
    {"id":"RED-ESC-1","name":"Escort 1","fullName":"Escort 1","category":"surface","composition":[{"type":"destroyer","quantity":1},{"type":"fragata","quantity":1}],"stayingPower":7,"movement":5,"detectionRange":{"surface":2,"air":1,"submarine":1,"land":1},"attackRange":{"surface":2,"air":1,"submarine":1,"land":2},"weapons":{"ascm":{"quantity":4,"range":6}},"capabilities":{"navalGun":3,"airDefense":2,"asw":2},"notes":"HMS Glamorgan (County) + HMS Broadsword (Type 22). Glamorgan sobreviveu a um Exocet lançado de terra em 12 jun — 13 mortos."},
    {"id":"RED-ESC-2","name":"Escort 2","fullName":"Escort 2","category":"surface","composition":[{"type":"fragata","quantity":2}],"stayingPower":5,"movement":5,"detectionRange":{"surface":2,"air":1,"submarine":1,"land":1},"attackRange":{"surface":1,"air":0,"submarine":1,"land":1},"weapons":{},"capabilities":{"navalGun":3,"airDefense":1,"asw":2},"notes":"HMS Yarmouth + HMS Alacrity (Leander/Type 21). Sem míssil dual-role — mais vulnerável ao ataque aéreo."},
    {"id":"RED-TRAIL","name":"Trail Screen","fullName":"Trail Screen","category":"surface","composition":[{"type":"fragata","quantity":2}],"stayingPower":5,"movement":5,"detectionRange":{"surface":2,"air":1,"submarine":1,"land":1},"attackRange":{"surface":2,"air":1,"submarine":1,"land":1},"weapons":{"ascm":{"quantity":4,"range":6}},"capabilities":{"navalGun":2,"airDefense":2,"asw":2},"notes":"HMS Ardent + HMS Argonaut. Ardent afundado em 22 mai após apoiar o raid do SAS em Ganso Verde — 22 mortos."},
    {"id":"RED-LAND-SCR","name":"Landing Screen","fullName":"Landing Screen","category":"surface","composition":[{"type":"fragata","quantity":2}],"stayingPower":4,"movement":5,"detectionRange":{"surface":2,"air":1,"submarine":1,"land":1},"attackRange":{"surface":1,"air":0,"submarine":1,"land":1},"weapons":{},"capabilities":{"navalGun":2,"airDefense":1,"asw":1},"notes":"HMS Antelope + HMS Ambuscade. Antelope afundado em 24 mai ao tentar desarmar uma bomba não detonada."},
    {"id":"RED-SG-SCR","name":"South Georgia Screen","fullName":"South Georgia Screen","category":"surface","composition":[{"type":"destroyer","quantity":1},{"type":"fragata","quantity":2}],"stayingPower":7,"movement":5,"detectionRange":{"surface":2,"air":2,"submarine":1,"land":1},"attackRange":{"surface":2,"air":1,"submarine":1,"land":1},"weapons":{"ascm":{"quantity":8,"range":6},"mss":{"quantity":6,"range":3}},"capabilities":{"navalGun":3,"airDefense":3,"asw":2},"notes":"HMS Antrim + HMS Plymouth + HMS Brilliant. Força-tarefa de vanguarda — retomou a Geórgia do Sul em 25 abr 1982 (Op. Paraquet)."},
    {"id":"RED-SG-ICE","name":"HMS Endurance","fullName":"HMS Endurance","category":"surface","composition":[{"type":"navio_patrulha","quantity":1},{"type":"helicoptero_ASup","quantity":1}],"stayingPower":3,"movement":4,"detectionRange":{"surface":1,"air":1,"submarine":0,"land":1},"attackRange":{"surface":0,"air":0,"submarine":0,"land":0},"weapons":{},"capabilities":{},"notes":"Navio de vigilância do Antártico. Sua retirada planejada em 1981 é citada como sinal que motivou a invasão argentina."},
    {"id":"RED-SOF","name":"SAS / SBS","fullName":"SAS / SBS","category":"specops","composition":[{"type":"operacoes_especiais","quantity":2}],"stayingPower":2,"movement":2,"detectionRange":{"surface":0,"air":0,"submarine":0,"land":1},"attackRange":{"surface":1,"air":0,"submarine":0,"land":2},"weapons":{"raid":{"quantity":4,"range":2}},"capabilities":{},"notes":"Equipes do 22 SAS e do Special Boat Squadron. Reconhecimento e ação direta — Ganso Verde, Monte Kent, Ilha Pebble."},
    {"id":"RED-SUB-CONQ","name":"HMS Conqueror","fullName":"HMS Conqueror","category":"submarine","composition":[{"type":"submarino_nuclear","quantity":1}],"stayingPower":3,"movement":4,"detectionRange":{"surface":3,"air":0,"submarine":2,"land":0},"attackRange":{"surface":3,"air":0,"submarine":2,"land":0},"weapons":{"torpedo":{"quantity":12,"range":2}},"capabilities":{},"notes":"SSN classe Churchill. Afundou o ARA General Belgrano em 2 mai 1982 — primeiro ataque de submarino nuclear da história."},
    {"id":"RED-SUB-SPART","name":"HMS Spartan","fullName":"HMS Spartan","category":"submarine","composition":[{"type":"submarino_nuclear","quantity":1}],"stayingPower":3,"movement":4,"detectionRange":{"surface":3,"air":0,"submarine":2,"land":0},"attackRange":{"surface":3,"air":0,"submarine":2,"land":0},"weapons":{"torpedo":{"quantity":12,"range":2}},"capabilities":{},"notes":"SSN classe Swiftsure. Um dos primeiros submarinos a chegar à zona de exclusão, em 12 abr 1982."},
    {"id":"RED-SUB-SPLEN","name":"HMS Splendid","fullName":"HMS Splendid","category":"submarine","composition":[{"type":"submarino_nuclear","quantity":1}],"stayingPower":3,"movement":4,"detectionRange":{"surface":3,"air":0,"submarine":2,"land":0},"attackRange":{"surface":3,"air":0,"submarine":2,"land":0},"weapons":{"torpedo":{"quantity":12,"range":2}},"capabilities":{},"notes":"SSN classe Swiftsure. Patrulhou a costa continental argentina em busca do porta-aviões 25 de Mayo."},
    {"id":"RED-LPD","name":"Fearless / Intrepid","fullName":"Fearless / Intrepid","category":"surface","composition":[{"type":"navio_doca","quantity":2},{"type":"helicoptero_ASup","quantity":4}],"stayingPower":14,"movement":3,"detectionRange":{"surface":2,"air":1,"submarine":0,"land":2},"attackRange":{"surface":1,"air":0,"submarine":0,"land":1},"weapons":{},"capabilities":{"navalGun":1,"airDefense":2},"notes":"HMS Fearless + HMS Intrepid (LPD). Únicos meios de desembarcar tropas e viaturas em San Carlos. Vulnerabilidade crítica."},
    {"id":"RED-TROOP","name":"Canberra / QE2 / Atlantic Conveyor","fullName":"Canberra / QE2 / Atlantic Conveyor","category":"surface","composition":[{"type":"navio_desembarque","quantity":3}],"stayingPower":12,"movement":2,"detectionRange":{"surface":1,"air":1,"submarine":0,"land":1},"attackRange":{"surface":0,"air":0,"submarine":0,"land":0},"weapons":{},"capabilities":{"airDefense":1},"notes":"SS Canberra + SS Queen Elizabeth II + SS Atlantic Conveyor. Transportam a 3ª Bda Comando e a 5ª Bda de Infantaria. Conveyor afundado por Exocet em 25 mai — 12 mortos, perda de helicópteros Chinook."},
    {"id":"RED-LOG-1","name":"Petroleiro do GT-PA","fullName":"Petroleiro do GT-PA","category":"surface","composition":[{"type":"navio_tanque","quantity":1}],"stayingPower":4,"movement":2,"detectionRange":{"surface":1,"air":1,"submarine":0,"land":0},"attackRange":{"surface":0,"air":0,"submarine":0,"land":0},"weapons":{},"capabilities":{},"notes":"RFA Olmeda. Reabastece o grupo porta-aviões."},
    {"id":"RED-LOG-2","name":"Petroleiro de Escolta","fullName":"Petroleiro de Escolta","category":"surface","composition":[{"type":"navio_tanque","quantity":2}],"stayingPower":5,"movement":2,"detectionRange":{"surface":1,"air":1,"submarine":0,"land":0},"attackRange":{"surface":0,"air":0,"submarine":0,"land":0},"weapons":{},"capabilities":{},"notes":"RFA Appleleaf + RFA Plumleaf. Reabastece as escoltas."},
    {"id":"RED-LOG-3","name":"Petroleiro de Desembarque","fullName":"Petroleiro de Desembarque","category":"surface","composition":[{"type":"navio_tanque","quantity":2}],"stayingPower":5,"movement":2,"detectionRange":{"surface":1,"air":1,"submarine":0,"land":0},"attackRange":{"surface":0,"air":0,"submarine":0,"land":0},"weapons":{},"capabilities":{},"notes":"RFA Tidespring + RFA Bayleaf. Reabastece o grupo de desembarque e a força da Geórgia do Sul."},
    {"id":"RED-TANK","name":"Petroleiros-Lançadeira","fullName":"Petroleiros-Lançadeira","category":"surface","composition":[{"type":"navio_tanque","quantity":3}],"stayingPower":6,"movement":2,"detectionRange":{"surface":1,"air":1,"submarine":0,"land":0},"attackRange":{"surface":0,"air":0,"submarine":0,"land":0},"weapons":{},"capabilities":{},"notes":"RFA British Tay + British Tamar + British Esk. Ponte logística com Ascensão — só reabastecem outros petroleiros."},
    {"id":"RED-MCM","name":"Esquadrilha Caça-Minas","fullName":"Esquadrilha Caça-Minas","category":"surface","composition":[{"type":"navio_patrulha","quantity":4}],"stayingPower":7,"movement":3,"detectionRange":{"surface":1,"air":0,"submarine":0,"land":1},"attackRange":{"surface":0,"air":0,"submarine":0,"land":0},"weapons":{},"capabilities":{},"notes":"HMS Junella, Cordella, Farnella, Northella — traineiras convertidas em caça-minas. Abrem caminho para o Estreito de San Carlos."},
    {"id":"RED-HOSP","name":"Navio-Hospital","fullName":"Navio-Hospital","category":"surface","composition":[{"type":"navio_logistico","quantity":1}],"stayingPower":5,"movement":2,"detectionRange":{"surface":1,"air":0,"submarine":0,"land":0},"attackRange":{"surface":0,"air":0,"submarine":0,"land":0},"weapons":{},"capabilities":{},"notes":"SS Uganda + navios-ambulância Hecla/Hydra/Herald. Protegido pela Convenção de Genebra — sem combate."},
    {"id":"RED-MPRA","name":"Nimrod","fullName":"Nimrod","category":"air","composition":[{"type":"patrulha_maritima","quantity":8}],"stayingPower":3,"movement":12,"detectionRange":{"surface":4,"air":1,"submarine":2,"land":1},"attackRange":{"surface":1,"air":0,"submarine":1,"land":0},"weapons":{},"capabilities":{"asw":2},"notes":"Hawker Siddeley Nimrod MR.1/2, base em Ascensão. Reabastecimento em voo estende o alcance a milhares de km."},
    {"id":"RED-BOM","name":"Vulcan","fullName":"Vulcan","category":"air","composition":[{"type":"ataque","quantity":2}],"stayingPower":2,"movement":12,"detectionRange":{"surface":0,"air":0,"submarine":0,"land":1},"attackRange":{"surface":0,"air":0,"submarine":0,"land":3},"weapons":{"lacm":{"quantity":3,"range":12}},"capabilities":{},"notes":"Avro Vulcan B.2, Operação Black Buck — 6 missões de bombardeio desde Ascensão, a maior distância percorrida em combate até então."},
    {"id":"RED-TANKER-AIR","name":"Victor K.2","fullName":"Victor K.2","category":"air","composition":[{"type":"patrulha_maritima","quantity":4}],"stayingPower":2,"movement":10,"detectionRange":{"surface":1,"air":0,"submarine":0,"land":0},"attackRange":{"surface":0,"air":0,"submarine":0,"land":0},"weapons":{},"capabilities":{},"notes":"Handley Page Victor K.2. Reabastecimento em voo — cada missão Black Buck exigiu até 11 petroleiros em cadeia."},
  ],
}

# ── Helpers ───────────────────────────────────────────────────────────────────

def fp_value(unit):
    uid = unit['id']
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

    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'cards_super_trunfo.pptx')
    prs.save(out)
    print(f"Salvo: {out}  ({total} cards)")

if __name__ == '__main__':
    main()
