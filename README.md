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

## Mecânicas principais

- Grade hexagonal 20×10 sobre carta náutica estilizada, cobrindo a costa
  patagônica argentina, as Ilhas Malvinas/Falkland e a Geórgia do Sul, com
  terrenos (terra, águas rasas/estreitos, plataforma continental, águas
  profundas).
- Turnos com períodos diurno/noturno; movimentação simultânea seguida de fase
  de combate com rodadas, interceptação e contra-ataques.
- Névoa de guerra com alcances de detecção por categoria (noite reduz detecção;
  submarinos usam sonar).
- Logística: pontos de combustível (FP) por unidade, reabastecimento por
  empilhamento com navios-tanque/logísticos/portos, munição limitada.
- Vitória por objetivos assimétricos: Argentina (Azul) precisa de 3 de 5
  (afundar porta-aviões, logística, grupo anfíbio, submarino nuclear ou
  degradar a esquadra britânica); Reino Unido (Vermelho), de seus 2
  (neutralizar bases aéreas continentais e degradar a guarnição das ilhas).
  Limite operacional de 8 dias com adjudicação por progresso (configurável
  via `MAX_TURNS`).

## Estrutura do repositório

| Pasta | Conteúdo |
|---|---|
| `server.js` | Servidor Express + Socket.IO: salas, turnos, combate, bot |
| `fuel_model.js` | Modelo de combustível/logística naval e aérea |
| `game_logger.js` | Gravação de partidas em JSONL para o dataset de ML |
| `shared/` | Ordem de batalha, configuração e motor de combate (usados por servidor e cliente) |
| `public/` | Cliente web (landing, jogo em canvas, CSS, ícones, cards) |
| `mapa_source.svg` | Fonte vetorial da carta náutica (`public/mapa.png`) |
| `scripts/gen_unit_cards.js` | Gera as cartas ilustradas de cada unidade (`public/cards/`) |
| `data/game-logs/` | Logs de partidas reais (dataset para treinar o bot) |
| `ml/` | Scripts de treinamento do bot por imitação |
