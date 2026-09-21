# Prompt para nova conversa — Treinamento do bot

Cole o texto abaixo no início de uma nova conversa com Claude Code
(GitHub Codespaces ou claude.ai/code conectado ao repositório):

---

Estou desenvolvendo um wargame naval multiplayer chamado "Operação Atlântico Sul"
(Node.js + Socket.IO) e quero treinar um bot de imitation learning usando PyTorch.

**Repositório:** velhomarinheiro/wargame-naval
**Branch de trabalho:** claude/wargame-web-multiplayer-OlPTM

**Contexto do projeto:**
- O jogo já registra todas as partidas em `data/game-logs/*.jsonl`
- Cada arquivo JSONL contém eventos: `game_start`, `movement_committed`,
  `attacks_declared`, `engagement_resolved`, `game_over`
- O estado do jogo usa um grid hexagonal flat-top de 10×16 células
- Unidades têm: posição (col, row), HP, categoria, combustível e armas

**O que precisa ser feito agora:**
1. Instalar as dependências: `pip install -r ml/requirements.txt`
2. Executar o script de treino: `python ml/train_bot.py`
3. Verificar os modelos gerados em `ml/models/` (move_net.onnx, attack_net.onnx)
4. Se os logs ainda forem insuficientes (menos de ~50 partidas completas),
   me diga quantos exemplos foram encontrados e o que podemos fazer

Se o treino rodar com sucesso, o próximo passo é integrar os modelos `.onnx`
no `server.js` usando `onnxruntime-node` para que o bot jogue automaticamente
quando um dos lados não tiver jogador humano conectado.

Leia o arquivo `ml/train_bot.py` para entender o pipeline antes de começar.
