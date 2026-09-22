'use strict';

// Ordem de batalha — Guerra das Malvinas/Falklands (1982)
// Azul = Argentina (defende as ilhas já ocupadas + litoral patagônico)
// Vermelho = Reino Unido (força-tarefa expedicionária vinda de Ascensão)
// Fonte: NWC "War at Sea" Falklands/Malvinas OAF Docs (Reino Unido v1.4, Argentina v1.4.1)
const ORDER_OF_BATTLE = {
  "forces": {
    "blue": [
      {
        "id":"BLUE-VM","name":"GT Porta-Aviões","category":"surface",
        "composition":[{"type":"navio_aeródromo","quantity":1},{"type":"helicoptero_ASW","quantity":2},{"type":"helicoptero_ASup","quantity":2}],
        "stayingPower":8,"movement":4,
        "detectionRange":{"surface":3,"air":2,"submarine":1,"land":1},
        "attackRange":{"surface":1,"air":1,"submarine":1,"land":0},
        "weapons":{},
        "capabilities":{"navalGun":2,"airDefense":1,"asw":2},
        "position":{"col":5,"row":1},
        "notes":"ARA Veinticinco de Mayo (ex-HMS Venerable). Porta-aviões leve a vapor. Base da 1ª Esquadrilha de A-4Q."
      },
      {
        "id":"BLUE-VM-AIR","name":"1ª Esq. A-4Q","category":"air",
        "composition":[{"type":"ataque","quantity":8}],
        "stayingPower":4,"movement":9,
        "detectionRange":{"surface":2,"air":1,"submarine":0,"land":1},
        "attackRange":{"surface":2,"air":0,"submarine":0,"land":2},
        "weapons":{"mss":{"quantity":6,"range":2}},
        "capabilities":{"airAttack":6},
        "position":{"col":5,"row":1},
        "embarked":"BLUE-VM",
        "notes":"8× A-4Q Skyhawk embarcados. Único esquadrão naval a operar de porta-aviões no conflito."
      },
      {
        "id":"BLUE-VE","name":"Escolta GT-PA","category":"surface",
        "composition":[{"type":"destroyer","quantity":2},{"type":"helicoptero_ASup","quantity":1}],
        "stayingPower":5,"movement":4,
        "detectionRange":{"surface":2,"air":2,"submarine":1,"land":1},
        "attackRange":{"surface":2,"air":1,"submarine":1,"land":1},
        "weapons":{"ascm":{"quantity":2,"range":6},"mss":{"quantity":6,"range":3}},
        "capabilities":{"navalGun":1,"airDefense":2,"asw":2},
        "position":{"col":6,"row":1},
        "notes":"ARA Hércules + ARA Santísima Trinidad (Type 42, Sea Dart/Exocet). Escolta principal do GT porta-aviões."
      },
      {
        "id":"BLUE-BV","name":"Esquadra de Corvetas","category":"surface",
        "composition":[{"type":"corveta","quantity":3}],
        "stayingPower":3,"movement":4,
        "detectionRange":{"surface":2,"air":1,"submarine":1,"land":1},
        "attackRange":{"surface":2,"air":1,"submarine":1,"land":0},
        "weapons":{"ascm":{"quantity":3,"range":6}},
        "capabilities":{"navalGun":2,"airDefense":3,"asw":2},
        "position":{"col":6,"row":2},
        "notes":"ARA Drummond, Guerrico e Granville (classe A69). Guerrico avariada em Grytviken, 3 abr 1982."
      },
      {
        "id":"BLUE-B","name":"Belgrano","category":"surface",
        "composition":[{"type":"cruzador","quantity":1}],
        "stayingPower":6,"movement":4,
        "detectionRange":{"surface":2,"air":1,"submarine":0,"land":1},
        "attackRange":{"surface":3,"air":0,"submarine":0,"land":2},
        "weapons":{},
        "capabilities":{"navalGun":8,"airDefense":2},
        "position":{"col":5,"row":7},
        "notes":"ARA General Belgrano (ex-USS Phoenix). Forte artilharia de 6\". Afundado por torpedos em 2 mai 1982 — 323 mortos."
      },
      {
        "id":"BLUE-BS","name":"Escolta Belgrano","category":"surface",
        "composition":[{"type":"destroyer","quantity":2}],
        "stayingPower":3,"movement":4,
        "detectionRange":{"surface":2,"air":1,"submarine":1,"land":1},
        "attackRange":{"surface":2,"air":1,"submarine":1,"land":1},
        "weapons":{"ascm":{"quantity":2,"range":6}},
        "capabilities":{"navalGun":6,"airDefense":2,"asw":2},
        "position":{"col":5,"row":7},
        "notes":"ARA Hipólito Bouchard + ARA Piedrabuena (ex-Fletcher/Sumner). Escolta do Belgrano."
      },
      {
        "id":"BLUE-LOG-1","name":"Petroleiro GT-PA","category":"surface",
        "composition":[{"type":"navio_tanque","quantity":1}],
        "stayingPower":4,"movement":2,
        "detectionRange":{"surface":1,"air":1,"submarine":0,"land":0},
        "attackRange":{"surface":0,"air":0,"submarine":0,"land":0},
        "weapons":{},"capabilities":{},
        "position":{"col":4,"row":1},
        "notes":"ARA Punta Médanos. Petroleiro de esquadra do GT porta-aviões."
      },
      {
        "id":"BLUE-LOG-2","name":"Petroleiro Geral","category":"surface",
        "composition":[{"type":"navio_tanque","quantity":2}],
        "stayingPower":4,"movement":2,
        "detectionRange":{"surface":1,"air":1,"submarine":0,"land":0},
        "attackRange":{"surface":0,"air":0,"submarine":0,"land":0},
        "weapons":{},"capabilities":{},
        "position":{"col":4,"row":7},
        "notes":"ARA Punta Delgada + petroleiro de serviço geral. Abastece o GT Belgrano e a retaguarda continental."
      },
      {
        "id":"BLUE-SUB-1","name":"Santa Fe","category":"submarine",
        "composition":[{"type":"submarino_convencional","quantity":1}],
        "stayingPower":2,"movement":2,
        "detectionRange":{"surface":2,"air":0,"submarine":1,"land":0},
        "attackRange":{"surface":2,"air":0,"submarine":1,"land":0},
        "weapons":{"torpedo":{"quantity":4,"range":2}},
        "capabilities":{},
        "position":{"col":17,"row":7},
        "notes":"ARA Santa Fe (ex-USS Catfish, classe Guppy). Avariada e encalhada em Grytviken, 25 abr 1982."
      },
      {
        "id":"BLUE-SUB-2","name":"San Luis","category":"submarine",
        "composition":[{"type":"submarino_convencional","quantity":1}],
        "stayingPower":2,"movement":2,
        "detectionRange":{"surface":2,"air":0,"submarine":1,"land":0},
        "attackRange":{"surface":2,"air":0,"submarine":1,"land":0},
        "weapons":{"torpedo":{"quantity":4,"range":2}},
        "capabilities":{},
        "position":{"col":8,"row":4},
        "notes":"ARA San Luis (Type 209). Realizou vários ataques frustrados contra a Força-Tarefa britânica."
      },
      {
        "id":"BLUE-PAT","name":"Patrulha Costeira","category":"surface",
        "composition":[{"type":"navio_patrulha","quantity":4}],
        "stayingPower":4,"movement":4,
        "detectionRange":{"surface":1,"air":1,"submarine":0,"land":1},
        "attackRange":{"surface":1,"air":1,"submarine":0,"land":0},
        "weapons":{},
        "capabilities":{"airDefense":1},
        "position":{"col":7,"row":5},
        "notes":"Lanchas Z-28 (Islas Malvinas, Río Iguazú) + patrulheiros Dabur. Vigilância costeira das ilhas."
      },
      {
        "id":"BLUE-MCM","name":"Grupo Caça-Minas","category":"surface",
        "composition":[{"type":"navio_patrulha","quantity":4}],
        "stayingPower":5,"movement":2,
        "detectionRange":{"surface":1,"air":0,"submarine":0,"land":1},
        "attackRange":{"surface":0,"air":0,"submarine":0,"land":0},
        "weapons":{},"capabilities":{},
        "position":{"col":6,"row":5},
        "notes":"Grupos M1/M2. Lança e localiza campos minados no Estreito de San Carlos."
      },
      {
        "id":"BLUE-ISR","name":"Piquete de Vigilância","category":"surface",
        "composition":[{"type":"navio_patrulha","quantity":5}],
        "stayingPower":3,"movement":2,
        "detectionRange":{"surface":3,"air":1,"submarine":0,"land":1},
        "attackRange":{"surface":0,"air":0,"submarine":0,"land":0},
        "weapons":{},"capabilities":{},
        "position":{"col":9,"row":3},
        "notes":"Traineiras e mercantes civis reconvertidos em piquetes de vigilância (Narwal, Alejandra, Costanza e outros)."
      },
      {
        "id":"BLUE-LG","name":"Grupo de Desembarque","category":"surface",
        "composition":[{"type":"navio_desembarque","quantity":2},{"type":"navio_doca","quantity":1}],
        "stayingPower":6,"movement":2,
        "detectionRange":{"surface":1,"air":1,"submarine":0,"land":1},
        "attackRange":{"surface":1,"air":0,"submarine":0,"land":1},
        "weapons":{},
        "capabilities":{"airDefense":1},
        "position":{"col":6,"row":5},
        "notes":"2× LST + 1 rebocador de alto-mar. Liga o continente a Porto Argentino com reforços e suprimentos."
      },
      {
        "id":"BLUE-CARGO","name":"Cargueiros de Suprimento","category":"surface",
        "composition":[{"type":"navio_logistico","quantity":3}],
        "stayingPower":6,"movement":2,
        "detectionRange":{"surface":1,"air":1,"submarine":0,"land":0},
        "attackRange":{"surface":0,"air":0,"submarine":0,"land":0},
        "weapons":{},"capabilities":{},
        "position":{"col":2,"row":5},
        "notes":"Formosa/Río Carcarañá, Río Cincel/Mar del Norte, Lago Argentino/Puerto Rosales. Mantêm a guarnição de Porto Argentino suprida."
      },
      {
        "id":"BLUE-SOF","name":"Comandos Anfíbios","category":"specops",
        "composition":[{"type":"operacoes_especiais","quantity":1}],
        "stayingPower":2,"movement":2,
        "detectionRange":{"surface":0,"air":0,"submarine":0,"land":1},
        "attackRange":{"surface":1,"air":0,"submarine":0,"land":2},
        "weapons":{"raid":{"quantity":3,"range":2}},
        "capabilities":{},
        "position":{"col":8,"row":4},
        "hostId":"BLUE-SUB-2",
        "stealthy":true,
        "notes":"Comandos Anfíbios / Buzos Tácticos. Embarcados no ARA San Luis."
      },
      {
        "id":"BLUE-CACA","name":"Mirage III / Dagger","category":"air",
        "composition":[{"type":"caca","quantity":15}],
        "stayingPower":8,"movement":6,
        "detectionRange":{"surface":1,"air":2,"submarine":0,"land":1},
        "attackRange":{"surface":1,"air":2,"submarine":0,"land":1},
        "weapons":{},
        "capabilities":{"airDefense":8,"airAttack":4},
        "position":{"col":1,"row":5},
        "notes":"Mirage IIIEA (Grupo 8) + Dagger (Grupo 6). Alcance limitado sobre as ilhas — poucos minutos de permanência."
      },
      {
        "id":"BLUE-ATQ-SKYHAWK","name":"A-4B/C Skyhawk","category":"air",
        "composition":[{"type":"ataque","quantity":30}],
        "stayingPower":10,"movement":6,
        "detectionRange":{"surface":2,"air":1,"submarine":0,"land":1},
        "attackRange":{"surface":2,"air":0,"submarine":0,"land":2},
        "weapons":{"mss":{"quantity":10,"range":2}},
        "capabilities":{"airAttack":9},
        "position":{"col":1,"row":5},
        "notes":"A-4B (Grupo 5) + A-4C (Grupo 4). Principal força de ataque continental contra a Força-Tarefa."
      },
      {
        "id":"BLUE-ATQ-ETEN","name":"Super Étendard","category":"air",
        "composition":[{"type":"ataque","quantity":5}],
        "stayingPower":3,"movement":7,
        "detectionRange":{"surface":2,"air":1,"submarine":0,"land":0},
        "attackRange":{"surface":3,"air":0,"submarine":0,"land":0},
        "weapons":{"ascm":{"quantity":2,"range":6}},
        "capabilities":{"airAttack":2},
        "position":{"col":2,"row":7},
        "notes":"2ª Esquadrilha Aeronaval de Caça e Ataque. Apenas 5 mísseis AM39 Exocet ar-superfície disponíveis em toda a guerra."
      },
      {
        "id":"BLUE-BOM-CANB","name":"Canberra","category":"air",
        "composition":[{"type":"ataque","quantity":7}],
        "stayingPower":5,"movement":6,
        "detectionRange":{"surface":1,"air":0,"submarine":0,"land":1},
        "attackRange":{"surface":2,"air":0,"submarine":0,"land":2},
        "weapons":{"lacm":{"quantity":4,"range":8}},
        "capabilities":{"airAttack":3},
        "position":{"col":0,"row":1},
        "notes":"Grupo 2 de Bombardeo. Bombardeiro de longo alcance, baixa sobrevivência diante de caças modernos."
      },
      {
        "id":"BLUE-ISR-AIR","name":"Lear Jet / SP-2 Neptune","category":"air",
        "composition":[{"type":"patrulha_maritima","quantity":6}],
        "stayingPower":3,"movement":10,
        "detectionRange":{"surface":4,"air":1,"submarine":1,"land":1},
        "attackRange":{"surface":0,"air":0,"submarine":0,"land":0},
        "weapons":{},"capabilities":{},
        "position":{"col":1,"row":3},
        "notes":"Lear Jet 35A (Esc. Fénix) + SP-2H Neptune. ISR de longo alcance, sem armamento."
      },
      {
        "id":"BLUE-PUCARA","name":"Pucará","category":"air",
        "composition":[{"type":"ataque","quantity":16}],
        "stayingPower":8,"movement":4,
        "detectionRange":{"surface":1,"air":0,"submarine":0,"land":2},
        "attackRange":{"surface":1,"air":0,"submarine":0,"land":2},
        "weapons":{},
        "capabilities":{"airAttack":5},
        "position":{"col":6,"row":5},
        "notes":"IA-58 Pucará — esquadrilhas de Porto Argentino/Ganso Verde/Ilha Pebble, já incluindo reforços dos turnos 3 e 4. Ataque ao solo, baixa velocidade."
      },
      {
        "id":"BLUE-GARR-STANLEY","name":"Guarnição de Porto Argentino","category":"land",
        "composition":[{"type":"infantaria","quantity":5},{"type":"bateria_ada","quantity":4}],
        "stayingPower":14,"movement":1,
        "detectionRange":{"surface":1,"air":2,"submarine":0,"land":3},
        "attackRange":{"surface":2,"air":0,"submarine":0,"land":3},
        "weapons":{},
        "capabilities":{"navalGun":4,"airDefense":5},
        "position":{"col":7,"row":4},
        "notes":"10ª Brigada de Infantería (3º, 6º, 7º, 25º RI) + 5º Batalhão de Infantaria de Marinha. ~5.000 efetivos. Artilharia 105mm + baterias Tigercat/Roland/35mm."
      },
      {
        "id":"BLUE-EXOCET-STANLEY","name":"Bateria Exocet MM38","category":"land",
        "composition":[{"type":"bateria_costeira","quantity":1}],
        "stayingPower":3,"movement":0,
        "detectionRange":{"surface":2,"air":0,"submarine":0,"land":0},
        "attackRange":{"surface":3,"air":0,"submarine":0,"land":0},
        "weapons":{"ascm":{"quantity":2,"range":3}},
        "capabilities":{},
        "position":{"col":7,"row":4},
        "notes":"2× lançadores MM38 Exocet improvisados por técnicos navais. Atingiu o HMS Glamorgan em 12 jun 1982 — sem reabastecimento possível."
      },
      {
        "id":"BLUE-GARR-GOOSE","name":"Guarnição de Ganso Verde","category":"land",
        "composition":[{"type":"infantaria","quantity":2},{"type":"bateria_ada","quantity":2}],
        "stayingPower":12,"movement":1,
        "detectionRange":{"surface":1,"air":1,"submarine":0,"land":2},
        "attackRange":{"surface":1,"air":0,"submarine":0,"land":2},
        "weapons":{},
        "capabilities":{"navalGun":1,"airDefense":2},
        "position":{"col":6,"row":5},
        "notes":"12º Regimiento de Infantería (Cia A + B). Defende Ganso Verde/Prado do Ganso."
      },
      {
        "id":"BLUE-GARR-WEST","name":"Guarnição da Falkland Ocidental","category":"land",
        "composition":[{"type":"infantaria","quantity":2}],
        "stayingPower":4,"movement":1,
        "detectionRange":{"surface":1,"air":1,"submarine":0,"land":1},
        "attackRange":{"surface":1,"air":0,"submarine":0,"land":1},
        "weapons":{},
        "capabilities":{"airDefense":1},
        "position":{"col":5,"row":5},
        "notes":"Forças de Segurança de Port Howard e Fox Bay, Falkland Ocidental."
      },
      {
        "id":"BLUE-GARR-SG","name":"Guarnição da Geórgia do Sul","category":"land",
        "composition":[{"type":"infantaria","quantity":1}],
        "stayingPower":2,"movement":1,
        "detectionRange":{"surface":1,"air":0,"submarine":0,"land":1},
        "attackRange":{"surface":1,"air":0,"submarine":0,"land":1},
        "weapons":{},"capabilities":{},
        "position":{"col":19,"row":7},
        "notes":"Pequeno destacamento em Grytviken/Leith. Capturado em 25 abr 1982 após ataque naval e aéreo britânico."
      },
      {
        "id":"BLUE-AERO-N","name":"BAM Rivadavia / San Julián","category":"land",
        "composition":[{"type":"aeroporto","quantity":2}],
        "stayingPower":12,"movement":0,
        "detectionRange":{"surface":1,"air":2,"submarine":0,"land":1},
        "attackRange":{"surface":0,"air":0,"submarine":0,"land":0},
        "weapons":{},"capabilities":{},
        "position":{"col":0,"row":1},
        "notes":"Bases Aéreas Militares de Comodoro Rivadavia e San Julián. Recompletamento de caças e bombardeiros Canberra."
      },
      {
        "id":"BLUE-AERO-RG","name":"BAM Río Gallegos","category":"land",
        "composition":[{"type":"aeroporto","quantity":1}],
        "stayingPower":12,"movement":0,
        "detectionRange":{"surface":1,"air":2,"submarine":0,"land":1},
        "attackRange":{"surface":0,"air":0,"submarine":0,"land":0},
        "weapons":{},"capabilities":{},
        "position":{"col":1,"row":5},
        "notes":"Principal base continental de A-4B/C Skyhawk."
      },
      {
        "id":"BLUE-PORTO-RG","name":"Porto de Río Gallegos","category":"land",
        "composition":[{"type":"porto","quantity":1}],
        "stayingPower":10,"movement":0,
        "detectionRange":{"surface":1,"air":0,"submarine":0,"land":1},
        "attackRange":{"surface":0,"air":0,"submarine":0,"land":0},
        "weapons":{},"capabilities":{},
        "position":{"col":1,"row":5},
        "notes":"Hub logístico continental. Reabastece navios argentinos em operação."
      },
      {
        "id":"BLUE-AERO-RGR","name":"BAM Río Grande","category":"land",
        "composition":[{"type":"aeroporto","quantity":1}],
        "stayingPower":12,"movement":0,
        "detectionRange":{"surface":1,"air":2,"submarine":0,"land":1},
        "attackRange":{"surface":0,"air":0,"submarine":0,"land":0},
        "weapons":{},"capabilities":{},
        "position":{"col":2,"row":7},
        "notes":"Base dos Super Étendard e A-4Q. A mais próxima das ilhas entre as bases continentais."
      }
    ],
    "red": [
      {
        "id":"RED-HERMES","name":"HMS Hermes","category":"surface",
        "composition":[{"type":"navio_aeródromo","quantity":1},{"type":"helicoptero_ASW","quantity":6},{"type":"helicoptero_ASup","quantity":2}],
        "stayingPower":8,"movement":4,
        "detectionRange":{"surface":3,"air":2,"submarine":1,"land":1},
        "attackRange":{"surface":1,"air":1,"submarine":1,"land":0},
        "weapons":{},
        "capabilities":{"airDefense":1,"asw":2},
        "position":{"col":13,"row":3},
        "notes":"Nau capitânia da Força-Tarefa. Casco de 1959, grande grupo aéreo. Prime alvo de Exocet."
      },
      {
        "id":"RED-HAR-1","name":"800 NAS Sea Harrier","category":"air",
        "composition":[{"type":"caca","quantity":12}],
        "stayingPower":6,"movement":10,
        "detectionRange":{"surface":2,"air":2,"submarine":0,"land":1},
        "attackRange":{"surface":2,"air":2,"submarine":0,"land":2},
        "weapons":{"mss":{"quantity":8,"range":2}},
        "capabilities":{"airDefense":9,"airAttack":6},
        "position":{"col":13,"row":3},
        "embarked":"RED-HERMES",
        "notes":"12× Sea Harrier FRS.1. CAP + ataque ao solo. Nenhuma perda em combate ar-ar durante toda a guerra."
      },
      {
        "id":"RED-INVINCIBLE","name":"HMS Invincible","category":"surface",
        "composition":[{"type":"navio_aeródromo","quantity":1},{"type":"helicoptero_ASW","quantity":4},{"type":"helicoptero_ASup","quantity":2}],
        "stayingPower":8,"movement":4,
        "detectionRange":{"surface":3,"air":2,"submarine":1,"land":1},
        "attackRange":{"surface":1,"air":1,"submarine":1,"land":0},
        "weapons":{},
        "capabilities":{"airDefense":1,"asw":2},
        "position":{"col":13,"row":2},
        "notes":"Porta-aviões leve (\"through-deck cruiser\"), mais moderno e resistente que o Hermes, grupo aéreo menor."
      },
      {
        "id":"RED-HAR-2","name":"801 NAS Sea Harrier","category":"air",
        "composition":[{"type":"caca","quantity":9}],
        "stayingPower":5,"movement":10,
        "detectionRange":{"surface":2,"air":2,"submarine":0,"land":1},
        "attackRange":{"surface":2,"air":2,"submarine":0,"land":2},
        "weapons":{"mss":{"quantity":6,"range":2}},
        "capabilities":{"airDefense":7,"airAttack":5},
        "position":{"col":13,"row":2},
        "embarked":"RED-INVINCIBLE",
        "notes":"9× Sea Harrier FRS.1, reforçado em voo por Harriers ferry do Atlantic Conveyor em maio."
      },
      {
        "id":"RED-SCR-1","name":"Screen 1","category":"surface",
        "composition":[{"type":"destroyer","quantity":2}],
        "stayingPower":7,"movement":4,
        "detectionRange":{"surface":2,"air":2,"submarine":1,"land":1},
        "attackRange":{"surface":2,"air":1,"submarine":1,"land":1},
        "weapons":{"mss":{"quantity":6,"range":3}},
        "capabilities":{"navalGun":1,"airDefense":2,"asw":2},
        "position":{"col":13,"row":3},
        "notes":"HMS Glasgow + HMS Sheffield (Type 42, Sea Dart). Sheffield afundado por Exocet em 4 mai 1982 — 20 mortos."
      },
      {
        "id":"RED-SCR-2","name":"Screen 2","category":"surface",
        "composition":[{"type":"destroyer","quantity":1},{"type":"fragata","quantity":1}],
        "stayingPower":5,"movement":4,
        "detectionRange":{"surface":2,"air":2,"submarine":1,"land":1},
        "attackRange":{"surface":2,"air":1,"submarine":1,"land":1},
        "weapons":{"mss":{"quantity":3,"range":3}},
        "capabilities":{"navalGun":1,"airDefense":2,"asw":2},
        "position":{"col":13,"row":4},
        "notes":"HMS Coventry (Type 42) + HMS Arrow (Type 21). Coventry afundado em 25 mai após 3 ataques aéreos, abatendo 2 aeronaves antes."
      },
      {
        "id":"RED-ESC-1","name":"Escort 1","category":"surface",
        "composition":[{"type":"destroyer","quantity":1},{"type":"fragata","quantity":1}],
        "stayingPower":5,"movement":4,
        "detectionRange":{"surface":2,"air":1,"submarine":1,"land":1},
        "attackRange":{"surface":2,"air":1,"submarine":1,"land":2},
        "weapons":{"ascm":{"quantity":2,"range":6}},
        "capabilities":{"navalGun":1,"airDefense":2,"asw":2},
        "position":{"col":12,"row":3},
        "notes":"HMS Glamorgan (County) + HMS Broadsword (Type 22). Glamorgan sobreviveu a um Exocet lançado de terra em 12 jun — 13 mortos."
      },
      {
        "id":"RED-ESC-2","name":"Escort 2","category":"surface",
        "composition":[{"type":"fragata","quantity":2}],
        "stayingPower":4,"movement":4,
        "detectionRange":{"surface":2,"air":1,"submarine":1,"land":1},
        "attackRange":{"surface":1,"air":0,"submarine":1,"land":1},
        "weapons":{"ascm":{"quantity":2,"range":6}},
        "capabilities":{"navalGun":1,"airDefense":2,"asw":2},
        "position":{"col":12,"row":4},
        "notes":"HMS Yarmouth + HMS Alacrity (Leander/Type 21). Sem míssil dual-role — mais vulnerável ao ataque aéreo."
      },
      {
        "id":"RED-TRAIL","name":"Trail Screen","category":"surface",
        "composition":[{"type":"fragata","quantity":2}],
        "stayingPower":4,"movement":4,
        "detectionRange":{"surface":2,"air":1,"submarine":1,"land":1},
        "attackRange":{"surface":2,"air":1,"submarine":1,"land":1},
        "weapons":{"ascm":{"quantity":2,"range":6}},
        "capabilities":{"navalGun":1,"airDefense":2,"asw":2},
        "position":{"col":10,"row":4},
        "notes":"HMS Ardent + HMS Argonaut. Ardent afundado em 22 mai após apoiar o raid do SAS em Ganso Verde — 22 mortos."
      },
      {
        "id":"RED-LAND-SCR","name":"Landing Screen","category":"surface",
        "composition":[{"type":"fragata","quantity":2}],
        "stayingPower":4,"movement":4,
        "detectionRange":{"surface":2,"air":1,"submarine":1,"land":1},
        "attackRange":{"surface":1,"air":0,"submarine":1,"land":1},
        "weapons":{"ascm":{"quantity":2,"range":6}},
        "capabilities":{"navalGun":1,"airDefense":2,"asw":2},
        "position":{"col":10,"row":5},
        "notes":"HMS Antelope + HMS Ambuscade. Antelope afundado em 24 mai ao tentar desarmar uma bomba não detonada."
      },
      {
        "id":"RED-SG-SCR","name":"South Georgia Screen","category":"surface",
        "composition":[{"type":"destroyer","quantity":1},{"type":"fragata","quantity":2}],
        "stayingPower":7,"movement":4,
        "detectionRange":{"surface":2,"air":2,"submarine":1,"land":1},
        "attackRange":{"surface":2,"air":1,"submarine":1,"land":1},
        "weapons":{"ascm":{"quantity":3,"range":6},"mss":{"quantity":3,"range":3}},
        "capabilities":{"navalGun":1,"airDefense":3,"asw":3},
        "position":{"col":17,"row":5},
        "notes":"HMS Antrim + HMS Plymouth + HMS Brilliant. Força-tarefa de vanguarda — retomou a Geórgia do Sul em 25 abr 1982 (Op. Paraquet)."
      },
      {
        "id":"RED-SG-ICE","name":"HMS Endurance","category":"surface",
        "composition":[{"type":"navio_patrulha","quantity":1},{"type":"helicoptero_ASup","quantity":1}],
        "stayingPower":3,"movement":4,
        "detectionRange":{"surface":1,"air":1,"submarine":0,"land":1},
        "attackRange":{"surface":0,"air":0,"submarine":0,"land":0},
        "weapons":{},"capabilities":{"airDefense":1,"asw":1},
        "position":{"col":18,"row":6},
        "notes":"Navio de vigilância do Antártico. Sua retirada planejada em 1981 é citada como sinal que motivou a invasão argentina."
      },
      {
        "id":"RED-SOF","name":"SAS / SBS","category":"specops",
        "composition":[{"type":"operacoes_especiais","quantity":2}],
        "stayingPower":2,"movement":2,
        "detectionRange":{"surface":0,"air":0,"submarine":0,"land":1},
        "attackRange":{"surface":1,"air":0,"submarine":0,"land":2},
        "weapons":{"raid":{"quantity":4,"range":2}},
        "capabilities":{},
        "position":{"col":18,"row":6},
        "hostId":"RED-SG-ICE",
        "stealthy":true,
        "notes":"Equipes do 22 SAS e do Special Boat Squadron. Reconhecimento e ação direta — Ganso Verde, Monte Kent, Ilha Pebble."
      },
      {
        "id":"RED-SUB-CONQ","name":"HMS Conqueror","category":"submarine",
        "composition":[{"type":"submarino_nuclear","quantity":1}],
        "stayingPower":2,"movement":4,
        "detectionRange":{"surface":3,"air":0,"submarine":2,"land":0},
        "attackRange":{"surface":3,"air":0,"submarine":2,"land":0},
        "weapons":{"torpedo":{"quantity":6,"range":2}},
        "capabilities":{},
        "position":{"col":5,"row":8},
        "notes":"SSN classe Churchill. Afundou o ARA General Belgrano em 2 mai 1982 — primeiro ataque de submarino nuclear da história."
      },
      {
        "id":"RED-SUB-SPART","name":"HMS Spartan","category":"submarine",
        "composition":[{"type":"submarino_nuclear","quantity":1}],
        "stayingPower":2,"movement":4,
        "detectionRange":{"surface":3,"air":0,"submarine":2,"land":0},
        "attackRange":{"surface":3,"air":0,"submarine":2,"land":0},
        "weapons":{"torpedo":{"quantity":6,"range":2}},
        "capabilities":{},
        "position":{"col":8,"row":5},
        "notes":"SSN classe Swiftsure. Um dos primeiros submarinos a chegar à zona de exclusão, em 12 abr 1982."
      },
      {
        "id":"RED-SUB-SPLEN","name":"HMS Splendid","category":"submarine",
        "composition":[{"type":"submarino_nuclear","quantity":1}],
        "stayingPower":2,"movement":4,
        "detectionRange":{"surface":3,"air":0,"submarine":2,"land":0},
        "attackRange":{"surface":3,"air":0,"submarine":2,"land":0},
        "weapons":{"torpedo":{"quantity":6,"range":2}},
        "capabilities":{},
        "position":{"col":8,"row":6},
        "notes":"SSN classe Swiftsure. Patrulhou a costa continental argentina em busca do porta-aviões 25 de Mayo."
      },
      {
        "id":"RED-LPD","name":"Fearless / Intrepid","category":"surface",
        "composition":[{"type":"navio_doca","quantity":2},{"type":"helicoptero_ASup","quantity":4}],
        "stayingPower":14,"movement":2,
        "detectionRange":{"surface":2,"air":1,"submarine":0,"land":2},
        "attackRange":{"surface":1,"air":0,"submarine":0,"land":1},
        "weapons":{},
        "capabilities":{"airDefense":2},
        "position":{"col":11,"row":4},
        "notes":"HMS Fearless + HMS Intrepid (LPD). Únicos meios de desembarcar tropas e viaturas em San Carlos. Vulnerabilidade crítica."
      },
      {
        "id":"RED-TROOP","name":"Canberra / QE2 / Atlantic Conveyor","category":"surface",
        "composition":[{"type":"navio_desembarque","quantity":3}],
        "stayingPower":12,"movement":2,
        "detectionRange":{"surface":1,"air":1,"submarine":0,"land":1},
        "attackRange":{"surface":0,"air":0,"submarine":0,"land":0},
        "weapons":{},
        "capabilities":{"airDefense":1},
        "position":{"col":12,"row":3},
        "notes":"SS Canberra + SS Queen Elizabeth II + SS Atlantic Conveyor. Transportam a 3ª Bda Comando e a 5ª Bda de Infantaria. Conveyor afundado por Exocet em 25 mai — 12 mortos, perda de helicópteros Chinook."
      },
      {
        "id":"RED-LOG-1","name":"Petroleiro do GT-PA","category":"surface",
        "composition":[{"type":"navio_tanque","quantity":1}],
        "stayingPower":4,"movement":2,
        "detectionRange":{"surface":1,"air":1,"submarine":0,"land":0},
        "attackRange":{"surface":0,"air":0,"submarine":0,"land":0},
        "weapons":{},"capabilities":{},
        "position":{"col":14,"row":2},
        "notes":"RFA Olmeda. Reabastece o grupo porta-aviões."
      },
      {
        "id":"RED-LOG-2","name":"Petroleiro de Escolta","category":"surface",
        "composition":[{"type":"navio_tanque","quantity":2}],
        "stayingPower":4,"movement":2,
        "detectionRange":{"surface":1,"air":1,"submarine":0,"land":0},
        "attackRange":{"surface":0,"air":0,"submarine":0,"land":0},
        "weapons":{},"capabilities":{},
        "position":{"col":14,"row":3},
        "notes":"RFA Appleleaf + RFA Plumleaf. Reabastece as escoltas."
      },
      {
        "id":"RED-LOG-3","name":"Petroleiro de Desembarque","category":"surface",
        "composition":[{"type":"navio_tanque","quantity":2}],
        "stayingPower":5,"movement":2,
        "detectionRange":{"surface":1,"air":1,"submarine":0,"land":0},
        "attackRange":{"surface":0,"air":0,"submarine":0,"land":0},
        "weapons":{},"capabilities":{},
        "position":{"col":14,"row":4},
        "notes":"RFA Tidespring + RFA Bayleaf. Reabastece o grupo de desembarque e a força da Geórgia do Sul."
      },
      {
        "id":"RED-TANK","name":"Petroleiros-Lançadeira","category":"surface",
        "composition":[{"type":"navio_tanque","quantity":3}],
        "stayingPower":6,"movement":2,
        "detectionRange":{"surface":1,"air":1,"submarine":0,"land":0},
        "attackRange":{"surface":0,"air":0,"submarine":0,"land":0},
        "weapons":{},"capabilities":{},
        "position":{"col":16,"row":3},
        "notes":"RFA British Tay + British Tamar + British Esk. Ponte logística com Ascensão — só reabastecem outros petroleiros."
      },
      {
        "id":"RED-MCM","name":"Esquadrilha Caça-Minas","category":"surface",
        "composition":[{"type":"navio_patrulha","quantity":4}],
        "stayingPower":7,"movement":2,
        "detectionRange":{"surface":1,"air":0,"submarine":0,"land":1},
        "attackRange":{"surface":0,"air":0,"submarine":0,"land":0},
        "weapons":{},"capabilities":{},
        "position":{"col":9,"row":4},
        "notes":"HMS Junella, Cordella, Farnella, Northella — traineiras convertidas em caça-minas. Abrem caminho para o Estreito de San Carlos."
      },
      {
        "id":"RED-HOSP","name":"Navio-Hospital","category":"surface",
        "composition":[{"type":"navio_logistico","quantity":1}],
        "stayingPower":6,"movement":2,
        "detectionRange":{"surface":1,"air":0,"submarine":0,"land":0},
        "attackRange":{"surface":0,"air":0,"submarine":0,"land":0},
        "weapons":{},"capabilities":{},
        "position":{"col":16,"row":2},
        "notes":"SS Uganda + navios-ambulância Hecla/Hydra/Herald. Protegido pela Convenção de Genebra — sem combate."
      },
      {
        "id":"RED-MPRA","name":"Nimrod","category":"air",
        "composition":[{"type":"patrulha_maritima","quantity":8}],
        "stayingPower":3,"movement":12,
        "detectionRange":{"surface":4,"air":1,"submarine":2,"land":1},
        "attackRange":{"surface":1,"air":0,"submarine":1,"land":0},
        "weapons":{},
        "capabilities":{"asw":2},
        "position":{"col":19,"row":0},
        "notes":"Hawker Siddeley Nimrod MR.1/2, base em Ascensão. Reabastecimento em voo estende o alcance a milhares de km."
      },
      {
        "id":"RED-BOM","name":"Vulcan","category":"air",
        "composition":[{"type":"ataque","quantity":2}],
        "stayingPower":2,"movement":12,
        "detectionRange":{"surface":0,"air":0,"submarine":0,"land":1},
        "attackRange":{"surface":0,"air":0,"submarine":0,"land":3},
        "weapons":{"lacm":{"quantity":3,"range":12}},
        "capabilities":{},
        "position":{"col":19,"row":0},
        "notes":"Avro Vulcan B.2, Operação Black Buck — 6 missões de bombardeio desde Ascensão, a maior distância percorrida em combate até então."
      },
      {
        "id":"RED-TANKER-AIR","name":"Victor K.2","category":"air",
        "composition":[{"type":"patrulha_maritima","quantity":4}],
        "stayingPower":2,"movement":10,
        "detectionRange":{"surface":1,"air":0,"submarine":0,"land":0},
        "attackRange":{"surface":0,"air":0,"submarine":0,"land":0},
        "weapons":{},"capabilities":{},
        "position":{"col":19,"row":0},
        "notes":"Handley Page Victor K.2. Reabastecimento em voo — cada missão Black Buck exigiu até 11 petroleiros em cadeia."
      }
    ]
  }
};

if (typeof module !== 'undefined') module.exports = { ORDER_OF_BATTLE };
