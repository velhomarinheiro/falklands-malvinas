# Guerra das Malvinas / Falkland 1982 — Wargame Naval Histórico

Wargame naval histórico por turnos, multiplayer online, ambientado no
Atlântico Sul de 1982: a Força Azul (**Argentina**) defende as Ilhas
Malvinas/Falkland já ocupadas contra a Força Vermelha (**Reino Unido**),
a força-tarefa expedicionária que parte de Ascensão para retomá-las.
Cenário e ordem de batalha inspirados na série *War at Sea* do
U.S. Naval War College; dinâmicas de movimento e combate herdadas do
motor original do projeto.

## Como rodar

```bash
npm install
node server.js
```

O servidor sobe em `http://localhost:3000` (porta configurável via `PORT`).

## Modos de jogo

- **2 jogadores** — um jogador cria a sala (Argentina/Azul) e compartilha o
  código de 6 letras; o outro entra como Reino Unido/Vermelha.
- **Solo vs. computador** — escolha um dos lados e jogue contra o bot.

## Idiomas

Interface disponível em **português (padrão) e inglês**, com seletor PT/EN no
topo da landing page, do lobby e do HUD em jogo. A escolha fica salva no
navegador (`localStorage`) e é aplicada imediatamente, sem recarregar a
página. Dicionários em `public/locales/{pt,en}.json`, carregados por
`public/js/i18n.js`; mensagens do servidor (erros, log de batalha, rótulos de
objetivos) trafegam como `{code, params}` para cada cliente resolver no seu
próprio idioma. Cartas ilustradas das unidades (`public/cards/`) e o texto
histórico de cada unidade (`notes` em `shared/order_of_battle.js`) ainda são
só em português.

## Mecânicas principais

- Grade hexagonal 20×10 (1 hex = 75 NM) sobre carta náutica georreferenciada
  (projeção Lambert conforme, Natural Earth 1:10M), cobrindo a costa
  patagônica argentina, as Ilhas Malvinas/Falkland e a Geórgia do Sul, com
  terrenos (terra, águas rasas/costa, plataforma continental, águas
  profundas) derivados da geografia real.
- Turnos com períodos diurno/noturno; movimentação simultânea seguida de fase
  de combate com rodadas, interceptação e contra-ataques.
- Névoa de guerra com alcances de detecção por categoria (noite reduz detecção;
  submarinos usam sonar).
- Logística: pontos de combustível (FP) por unidade, reabastecimento por
  empilhamento com navios-tanque/logísticos/portos, munição limitada.
- Vitória por objetivos assimétricos: Argentina (Azul) precisa de 3 de 5
  (afundar porta-aviões, logística, grupo anfíbio, submarino nuclear ou
  degradar a esquadra britânica); Reino Unido (Vermelho), de seus 2 — ambos
  restritos ao teatro insular, já que a Inglaterra operava sob regras de
  engajamento que proibiam ataques ao continente argentino (degradar a
  presença aérea/naval local — Pucará, patrulhas, caça-minas — e a
  guarnição das ilhas). Limite operacional de 8 dias com adjudicação por progresso (configurável
  via `MAX_TURNS`).

## Estrutura do repositório

| Pasta | Conteúdo |
|---|---|
| `server.js` | Servidor Express + Socket.IO: salas, turnos, combate, bot |
| `fuel_model.js` | Modelo de combustível/logística naval e aérea |
| `game_logger.js` | Gravação de partidas em JSONL para o dataset de ML |
| `shared/` | Ordem de batalha, configuração e motor de combate (usados por servidor e cliente) |
| `public/` | Cliente web (landing, jogo em canvas, CSS, ícones, cards) |
| `public/locales/` | Dicionários de idioma (`pt.json`, `en.json`) usados por `public/js/i18n.js` |
| `mapa_source/` | Fonte da carta náutica georreferenciada (`public/mapa.png`): gerador Python, GeoJSON com lon/lat e terreno por hexágono, imagem em resolução plena |
| `scripts/gen_unit_cards.js` | Gera as cartas ilustradas de cada unidade (`public/cards/`) |
| `data/game-logs/` | Logs de partidas reais (dataset para treinar o bot) |
| `ml/` | Scripts de treinamento do bot por imitação |
