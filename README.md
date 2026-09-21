# Operação Atlântico Sul — Wargame Naval

Wargame naval por turnos, multiplayer online, ambientado no Atlântico Sul:
a Força Azul (Marinha do Brasil) defende suas águas jurisdicionais contra a
Força Vermelha, uma força expedicionária adversária.

## Como rodar

```bash
npm install
node server.js
```

O servidor sobe em `http://localhost:3000` (porta configurável via `PORT`).

## Modos de jogo

- **2 jogadores** — um jogador cria a sala (Força Azul) e compartilha o código
  de 6 letras; o outro entra como Força Vermelha.
- **Solo vs. computador** — escolha um dos lados e jogue contra o bot.

## Mecânicas principais

- Grade hexagonal 16×10 sobre carta náutica, com terrenos (terra, águas rasas,
  plataforma, águas profundas, campos de petróleo).
- Turnos com períodos diurno/noturno; movimentação simultânea seguida de fase
  de combate com rodadas, interceptação e contra-ataques.
- Névoa de guerra com alcances de detecção por categoria (noite reduz detecção;
  submarinos usam sonar).
- Logística: pontos de combustível (FP) por unidade, reabastecimento por
  empilhamento com navios-tanque/logísticos/portos, munição limitada.
- Vitória por objetivos assimétricos: Azul precisa de 3 de 5; Vermelho, de
  seus 2. Limite operacional de 12 dias com adjudicação por progresso
  (configurável via `MAX_TURNS`).

## Estrutura do repositório

| Pasta | Conteúdo |
|---|---|
| `server.js` | Servidor Express + Socket.IO: salas, turnos, combate, bot |
| `fuel_model.js` | Modelo de combustível/logística naval e aérea |
| `game_logger.js` | Gravação de partidas em JSONL para o dataset de ML |
| `shared/` | Ordem de batalha, configuração e motor de combate (usados por servidor e cliente) |
| `public/` | Cliente web (landing, jogo em canvas, CSS, ícones, cards) |
| `data/game-logs/` | Logs de partidas reais (dataset para treinar o bot) |
| `ml/` | Scripts de treinamento do bot por imitação |
