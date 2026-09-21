# Roteiro de Aperfeiçoamentos — Design e Jogabilidade

Registro dos aperfeiçoamentos aplicados em *Operação Atlântico Sul* (wargame naval
por turnos, hexagonal, Node/Express/Socket.IO + cliente canvas em JS puro),
escrito para ser **reaplicado em outro jogo de características semelhantes**.

Cada item segue o formato **Sintoma → Causa raiz → Correção → Padrão reutilizável**,
porque o que transfere entre projetos é o padrão, não o diff.

## Como usar este roteiro

1. Leia a seção **Método de verificação** primeiro. É a parte mais transferível:
   metade dos defeitos abaixo só apareceu porque o jogo foi *executado e operado*,
   não apenas lido.
2. Rode a **Auditoria inicial** (abaixo) no jogo-alvo. Ela produz a sua lista de
   itens reais — não presuma que os mesmos defeitos existem.
3. Execute na ordem do **Checklist priorizado** ao final.
4. Um commit por item, com verificação própria. Itens de regra e de UI não devem
   viajar no mesmo commit.

Este documento também serve como *briefing* para um agente de IA trabalhando no
outro jogo: entregue-o junto do pedido "aplique o que fizer sentido aqui, mas
audite antes de assumir".

### Premissas do jogo-alvo

O roteiro assume um jogo com estas características (ajuste o que não se aplicar):

- Turnos com fases, dois lados, condições de vitória assimétricas.
- Servidor autoritativo com estado central; cliente renderizando um tabuleiro.
- Sessão em tempo real (websocket) com salas de 2 jogadores e/ou modo solo vs. IA.
- Dados de cenário declarativos (ordem de batalha / roster) separados da lógica.

### Auditoria inicial (faça antes de codar)

| # | Pergunta | Como responder |
|---|---|---|
| 1 | Toda regra **prometida** em texto existe no código? | Colete todo texto narrativo (notas de unidade, landing, tutorial, manual) e confronte com a implementação. |
| 2 | A partida tem **estado terminal garantido**? | Existe limite de turnos/tempo? O que acontece se ninguém cumprir objetivos? |
| 3 | O que acontece se um jogador **cair** a cada momento do fluxo? | Percorra fase por fase, inclusive durante decisões interativas. |
| 4 | Há **duas fontes de verdade** para a mesma grandeza? | Ex.: alcance por categoria vs. alcance por arma; rótulos duplicados cliente/servidor. |
| 5 | A informação crítica **aparece quando mais importa**? | Recursos esgotados, condições quase cumpridas, motivo de ação bloqueada. |
| 6 | O jogo é **operável em toque** de ponta a ponta? | Teste em tablet **paisagem** e retrato, e em celular estreito. |
| 7 | A IA conhece as **condições de vitória**? | Procure a função de checagem de vitória e veja se a IA a consulta. |

---

## 1. Integridade de regras: o que o texto promete, o código cumpre

### 1.1 Mecânica prometida que não existe

**Sintoma.** A ficha de uma unidade dizia "único rearmamento em mar — crítico,
proteger", criando uma missão inteira na cabeça do jogador. Não havia
recompletamento de munição em mar no código: os mísseis daquele lado eram
*one-shot* pela partida inteira.

**Causa raiz.** Texto de cenário escrito na fase de design, implementação
divergiu, ninguém reconciliou.

**Correção.** Duas saídas legítimas: implementar a mecânica, ou corrigir o texto.
Escolhemos corrigir o texto (decisão do dono do jogo) e registrar a mecânica como
dívida — porque implementá-la mudaria o balanceamento sem playtest.

**Padrão reutilizável.** *Texto de cenário é especificação.* Trate divergência
texto↔código como bug, e resolva explicitamente em uma das duas direções —
nunca deixe pendente. Quem decide qual direção é o dono do design, não quem
codifica.

### 1.2 Número anunciado maior que a capacidade real → clique morto

**Sintoma.** Baterias antiaéreas declaravam alcance 2, mas suas únicas armas
tinham alcance 1. O tabuleiro destacava o alvo a distância 2 como atacável, o
jogador tocava e **nada acontecia** (o seletor de armas abria vazio e retornava
em silêncio).

**Causa raiz.** Duas fontes de verdade para "alcance": um valor por categoria de
alvo, hand-authored no roster e usado para *destacar* alvos; e o alcance por arma,
usado para *resolver* o ataque. Elas divergiram.

**Correção.** Alinhamos o dado (2 → 1). Não unificamos os dois sistemas: as outras
divergências eram **conservadoras** (escondem alcance real em vez de prometer
alcance falso), então não quebram a experiência.

**Padrão reutilizável.** Ao encontrar fontes de verdade duplicadas, classifique
cada divergência por direção:
- **Otimista** (anuncia mais do que entrega) → corrija já, quebra a UX.
- **Conservadora** (entrega mais do que anuncia) → dívida tolerável.

Unificar tudo é refator de risco; priorize pela direção do erro. E adicione uma
regra de ouro: **nunca destaque como acionável algo que a ação vai recusar.**

### 1.3 Regra de duplo checkpoint que parecia bug

**Sintoma.** Relato de playtest: unidades "movimentando empilhadas" com o
reabastecedor não recompletavam combustível.

**Causa raiz.** A regra exigia estar empilhado no **início E no fim** do turno
(anti-exploit de "reabastecimento de passagem"). Quem chegava no meio do turno
não reabastecia — comportamento correto pelo código, incompreensível para o
jogador. A partida acabava antes de completar um turno inteiro empilhado.

**Correção.** Relaxado para **um checkpoint** (fim do turno), por decisão do dono
do design entre três opções apresentadas.

**Padrão reutilizável.** Quando um relato de bug revela uma regra intencional mas
opaca, o defeito é de *comunicação ou de design*, não necessariamente de código.
Apresente as opções (manter + explicar na UI / relaxar / remover) e deixe a
escolha com o dono. E: **use os logs de partida reais como prova** — foi lendo o
log da partida relatada que localizamos o turno exato e provamos a mecânica.

---

## 2. Estado terminal: toda partida precisa acabar

### 2.1 Ausência de limite de turnos

**Sintoma.** Nada encerrava uma partida em que ninguém cumprisse objetivos.
Combinado com munição finita, dois lados passivos ficavam em impasse eterno.

**Correção.** Limite operacional (12 "dias" de jogo, configurável por variável de
ambiente) com **adjudicação por progresso proporcional** nos objetivos
(`cumpridos / necessários` de cada lado; empate mantém o desempate já existente).
O contador aparece no cabeçalho (`Turno 3/12`) e a tela de fim de jogo tem
mensagem própria para o encerramento por tempo.

**Padrão reutilizável.**
- Todo jogo competitivo precisa de **relógio operacional** + **regra de
  adjudicação** — e o limite deve ser **visível desde o turno 1**, senão vira
  surpresa.
- Reaproveite a função de checagem de vitória para adjudicar; não escreva uma
  segunda lógica de "quem está ganhando".
- Deixe o limite **configurável por env** — é o que torna o teste automatizado
  viável (rodamos partidas completas com limite 2 e 4).

### 2.2 Reconexão inexistente

**Sintoma.** Qualquer queda de conexão destruía a sala na hora. Um soluço de
Wi-Fi perdia uma partida longa.

**Correção.** Período de graça de 75s: o assento é marcado como vago, a sala
sobrevive, o oponente vê um aviso **não-terminal** com contagem regressiva, e o
cliente reassume automaticamente usando um token guardado em `localStorage`.
Na expiração, aplica-se o encerramento que já existia.

**Padrão reutilizável.**
- Token de reingresso emitido no início da partida + persistido no cliente.
- Valide **token, assento vago e partida ainda viva** antes de aceitar o
  reingresso; recuse silenciosa e explicitamente (evento de falha) nos demais casos.
- Diferencie aviso **transitório** de aviso **terminal** na UI. Reutilizar o
  overlay de "fim" para uma queda temporária faz o jogador desistir.
- Bônus quase gratuito: isso conserta **F5 acidental**, inclusive no modo solo.

### 2.3 Reconexão que travava a partida para sempre (o pior defeito da série)

**Sintoma.** Reingressar funcionava — mas se a queda acontecesse **durante uma
decisão interativa** (continuar/parar um engajamento), a partida travava
permanentemente: o servidor esperava uma decisão que o cliente reconectado não
tinha interface para enviar.

**Causa raiz.** O reingresso reemitia só o "estado do jogo", e a serialização do
estado para o cliente **remove de propósito** as estruturas internas de combate
(fila de engajamentos, decisões pendentes). O jogador voltava sem o painel.

**Correção.** No reingresso, se existe engajamento corrente com resultado já
resolvido, o servidor **reconstrói e reemite o evento da última rodada**, com a
flag de "precisa decidir" conforme a decisão daquele lado ainda estar pendente.
O cliente já sabia renderizar esse evento — nenhuma UI nova foi necessária.

**Padrão reutilizável.** Este é o item mais importante para copiar:

> Reconexão não é restaurar o estado — é restaurar **o estado *e* o ponto de
> interação**. Para cada momento em que o servidor **bloqueia esperando input**,
> pergunte: "se este jogador reconectar agora, ele recebe de volta a pergunta?"

Faça um inventário dos pontos de bloqueio (decisões, leilões, escolhas
simultâneas, confirmações) e garanta reemissão em cada um. Note que estruturas
que você *filtra* do payload por serem "internas" são exatamente as que guardam
o ponto de interação.

---

## 3. Transparência: mostrar o que decide o jogo

### 3.1 Informação desaparecendo quando mais importa

**Sintoma.** Armas com quantidade 0 **sumiam** do painel da unidade, em vez de
aparecer como `0/16` — justamente a informação de esgotamento que muda a decisão
do jogador.

**Causa raiz.** Um filtro usava o objeto da arma como chave de índice em vez da
chave do par (`initW[w]` em vez de `initW[k]`) — sempre `undefined`, então o item
zerado nunca passava o teste.

**Correção.** Uma linha.

**Padrão reutilizável.** Recursos consumíveis devem sempre exibir
**atual / inicial**, e o estado **zerado é o mais importante de todos** — nunca
esconda por "estar vazio". Vale para munição, combustível, cargas, cooldowns.
Colateral: bugs de indexação em filtros de exibição são silenciosos; a suíte de
verificação deve incluir um caso com o recurso **em zero**.

### 3.2 Documentação de vitória desatualizada

**Sintoma.** O "como jogar" dizia "vence quem destruir todas as unidades
inimigas". A regra real era objetivos assimétricos (3 de 5 para um lado, 2 de 2
para o outro). O mock do tutorial mostrava números de uma versão anterior.

**Padrão reutilizável.** Mudança de regra de vitória tem um **raio de alcance**
maior que o código: landing, tutorial, mocks/screenshots, manuais, textos de fim
de jogo. Faça uma busca textual pelos números antigos (`2 de 3`, `precisa de 2`)
antes de fechar a mudança. Considere gerar esses textos a partir da configuração
quando possível.

### 3.3 Ajuda dentro do jogo (não só na porta de entrada)

**Sintoma.** Todas as regras viviam na landing page. Dentro da partida: nenhuma
referência. Manuais existiam como arquivos soltos, não linkados.

**Correção.** Modal de "manual rápido" com abas (Fases, Combate, Logística,
Vitória, Glossário), aberto por botão `?` no cabeçalho ou tecla `H`, fechado por
`Esc`/clique fora/botão. O **glossário é gerado a partir do dicionário de armas**
usado nos tooltips — uma fonte, dois consumidores.

### 3.4 Jargão cru na interface

**Sintoma.** Siglas técnicas (ASCM, MSS, LACM, ASW, BMD) apareciam sem tradução
no painel e no seletor de armas.

**Correção.** Dicionário sigla → nome por extenso, aplicado como tooltip no
inventário, nas capacidades e no seletor; o mesmo dicionário alimenta o glossário
da ajuda.

**Padrão reutilizável.** Todo jargão de domínio precisa de **um** dicionário
central consumido por tooltip + glossário. Sem isso, o vocabulário do jogo é uma
barreira de entrada permanente.

---

## 4. Fricção de operação: o custo por jogada

### 4.1 Alcance de movimento invisível

**Sintoma.** Para mover, o jogador clicava **hexágono por hexágono**, sem ver o
alcance total da unidade. Incomum para um jogo de tabuleiro hexagonal e o maior
atrito momento-a-momento do jogo.

**Correção.** Ao selecionar, um BFS calcula **todos** os hexes alcançáveis com o
movimento restante (respeitando terreno e o caminho já traçado) e os pinta em
tom suave; o anel adjacente mantém o destaque forte de "próximo passo". Clicar em
qualquer hex alcançável **constrói a rota mais curta automaticamente**; o
passo-a-passo continua disponível para rotas precisas, e o desfazer segue
funcionando.

**Padrão reutilizável.**
- **Mostre o envelope inteiro da ação, não só o próximo passo.** Vale para
  movimento, alcance de tiro, área de efeito.
- Ofereça o **atalho** (clique no destino → rota automática) **sem remover o
  controle fino** (passo-a-passo). Substituir um pelo outro irrita quem precisa
  de precisão.
- O BFS deve encadear o predecessor de cada nó — a rota sai de graça na
  reconstrução.

### 4.2 Ação bloqueada sem explicação

Onde o servidor recusa uma ação, o cliente deve dizer **por quê** (mensagem
específica: terreno, alcance, combustível, fase). Onde o cliente já sabe que a
ação é inválida, ele não deve oferecê-la (ver 1.2).

---

## 5. Celular e tablet: o bloco de maior impacto

### 5.1 Região do tabuleiro inalcançável (o defeito mais grave de UX)

**Sintoma relatado.** "No tablet, só conseguia selecionar as unidades no extremo
inferior do mapa se girasse o aparelho para a vertical."

**Causa raiz — três decisões corretas isoladamente que se combinam em bug:**
1. O canvas era limitado **só pela largura** (`max-width: 100%`), então em
   paisagem ficava mais alto que a área visível e a base saía da tela.
2. A rolagem nativa estava desativada (`touch-action: none`) porque os gestos são
   tratados pelo jogo.
3. O arrasto interno (pan) é **travado no zoom 1** — nada a deslocar, por design.

Resultado: existia uma faixa do tabuleiro que **nenhum gesto alcançava**.

**Correção.** O tabuleiro passa a caber **sempre inteiro** na área visível
(limitado por largura **e** altura, centralizado); a navegação é exclusivamente
por zoom + arrasto internos. Piso do zoom elevado a 1 (abaixo disso só havia
margens mortas).

**Padrão reutilizável — regra de invariante:**

> Em qualquer viewport, **todo ponto interativo do tabuleiro deve ser alcançável
> por algum gesto disponível**. Se você desativa a rolagem nativa, você assume a
> responsabilidade integral pela navegação.

Verificação obrigatória: **tablet em paisagem** é o formato que mais quebra
(pouca altura, muita largura) e o mais esquecido nos testes. Teste o **ponto
extremo** do conteúdo (última fileira, canto inferior), não o centro.

### 5.2 Gestos de zoom e navegação

**Correção.** Um dedo arrasta; dois dedos fazem pinça ancorada no ponto médio;
**toque duplo alterna** entre visão geral e aproximação (2,2×) ancorada no ponto
tocado; toque longo (~500ms) abre a ficha da unidade (substituto do clique
direito, inexistente em toque).

**Padrão reutilizável.**
- Distinga **toque** de **arrasto** por limiar de deslocamento (~8px): abaixo
  disso é toque, acima é navegação. Sem isso, todo arrasto seleciona algo por
  acidente.
- **Toque duplo** é o gesto mais eficiente para "aproximar e voltar" — melhor que
  caçar botões de zoom.
- Todo gesto exclusivo de mouse (hover, clique direito) precisa de **equivalente
  em toque** (toque longo, painel dedicado). Hover não existe em toque.
- Cancele o temporizador do toque longo ao detectar movimento, e o toque simples
  quando o longo disparar.

### 5.3 Painel lateral (drawer)

**Correção.** Abre e fecha por **deslize** (da borda direita para dentro abre;
sobre o painel para a direita fecha), além do botão `☰` e do fundo escurecido.
Botão `✕` dentro do painel. Alvos de toque de 40px.

**Padrão reutilizável.**
- Ofereça **três formas de fechar**: botão explícito, fundo escurecido e gesto.
  Painel sem saída óbvia é a reclamação clássica de mobile.
- Reserve uma faixa da borda (~24px) para o gesto de abrir e **exclua-a dos
  gestos do tabuleiro**, senão os dois competem.
- Alvos de toque ≥ 40px.

### 5.4 Armadilha de empilhamento (z-index) — apareceu duas vezes

**Sintoma 1.** O painel deslizante cobria o próprio botão que o abria.
**Sintoma 2.** O botão `✕` dentro do painel era *visível mas não tocável* — um
elemento do cabeçalho interceptava o toque.

**Causa raiz.** Um elemento `position: fixed` com z-index renderiza acima de
qualquer irmão sem posicionamento, independentemente da ordem no DOM. E "visível"
não implica "clicável": um elemento invisível ou irrelevante pode estar por cima.

**Padrão reutilizável.**
- Ao introduzir um painel sobreposto, **declare explicitamente o empilhamento de
  todos os elementos da região** (cabeçalho, botão de abrir, fundo, painel) — não
  confie na ordem do DOM.
- **Teste tocando, não olhando.** Ferramentas de automação acusam
  "outro elemento intercepta o evento" — esse erro é um achado, não um obstáculo
  ao teste. Foi exatamente assim que o `✕` inacessível apareceu.

---

## 6. Acessibilidade: redundância de canal

**Sintoma.** Lados (azul/vermelho) e estados do tabuleiro (verde = movimento,
vermelho = alvo) eram codificados **apenas por cor**.

**Correção.** Lados ganham **forma** distinta (um com cantos arredondados, outro
com cantos chanfrados); estados ganham **textura** (alvos com hachura diagonal,
movimento liso); a legenda replica a hachura.

**Padrão reutilizável.** Toda informação essencial precisa de **dois canais**:
cor + forma, ou cor + textura, ou cor + ícone. Aplique também ao respeito por
`prefers-reduced-motion` e a foco visível em teclado.

---

## 7. Oponente de IA: jogar o jogo, não perseguir inimigos

**Sintoma.** O bot do modo solo perseguia o inimigo de maior prioridade **por
tipo de unidade**, ignorava as condições de vitória, ignorava combustível,
não protegia a própria logística e **sempre** escolhia "continuar" nas decisões
de combate. Unidades especiais dele nunca atacavam (um tipo de arma faltava na
tabela de prioridade, e o ataque era descartado em silêncio).

**Correções, em ordem de impacto:**

1. **Alvos derivados das condições de vitória.** As listas de IDs que definem os
   objetivos foram extraídas para uma **constante única** consumida pela checagem
   de vitória *e* pela IA. Pesos de alvo são recalculados a cada decisão,
   **pulando condições já cumpridas** — o bot se re-tarefa sozinho.
2. **Defesa oportunista.** Inimigo combatente dentro de um raio curto vence
   qualquer objetivo distante — evita o bot desfilar ao lado de quem o mata.
3. **Consciência de recursos.** Abaixo do custo estimado da viagem (ou de um
   piso), a unidade troca a missão por reabastecimento, escolhendo o provedor
   **alcançável** mais próximo — respeitando restrições de terreno (um provedor
   em terra é inútil para navios; um em água rasa, para submarinos).
4. **Autopreservação da logística.** Navios de apoio fogem de ameaças próximas
   (BFS maximizando a distância mínima) e o mais valioso recebe **uma** escolta.
5. **Decisão de combate real.** Recua sem munição ou muito danificado, salvo se o
   alvo está a um golpe de cair; como defensor, continua enquanto houver
   contra-ataque possível (a semântica exata foi lida no resolvedor de combate,
   não presumida).
6. **Constantes de calibragem** num único bloco (agressividade, raios, limiares),
   para ajustar dificuldade sem tocar na lógica.

**Padrões reutilizáveis.**
- **A IA deve consultar a mesma definição de vitória que o juiz do jogo.** Duas
  listas de objetivos dessincronizam na primeira mudança de cenário.
- Uma IA puramente ofensiva parece burra de um jeito específico: ela **ignora o
  que o jogo pede**. Objetivo > tipo de unidade.
- Concentre limiares em **um bloco de tunáveis**; dificuldade é ajuste de
  constantes, não de código.
- Se a IA produz ações que o pipeline **descarta em silêncio** (arma faltando na
  tabela, ação inválida), você tem um bug invisível. Torne o descarte ruidoso em
  desenvolvimento.
- Ao refatorar a IA, **extraia a aplicação de ações em uma função pura**
  (`aplicar(estado, lado, ações)`) separada da camada de rede: é o que torna
  possível o teste automatizado e o *selfplay*.

---

## 8. Higiene (baixo custo, faça junto)

- Código morto: funções nunca chamadas, constantes sem referência, ramos de
  compatibilidade com eventos que o servidor não emite mais.
- Idioma inconsistente: um rótulo em inglês no meio de uma UI em português.
- Nomes de arquivo enganosos (um ícone `porta.png` para "porto").
- Arquivos-lixo commitados por acidente (arquivos de 1 byte).
- Ausência de `README` com "o que é, como rodar, estrutura de pastas".

---

## Método de verificação (a parte que mais transfere)

**Regra central: verificação é observação em execução.** Compile, rode, opere o
jogo até o código alterado executar, e capture o que você viu. Rodar a suíte de
testes prova que o CI funciona — não que a mudança funciona.

O que isso rendeu neste projeto (defeitos que **só** apareceram operando o jogo):

| Defeito | Achado como |
|---|---|
| Painel cobrindo o próprio botão | Screenshot em viewport estreito |
| `✕` visível mas não tocável | Erro "outro elemento intercepta o toque" na automação |
| Base do tabuleiro inalcançável em tablet | Medição da geometria do canvas vs. viewport |
| Travamento na reconexão durante decisão | Partida real com dois clientes e queda provocada |

### Receita aplicada

1. **Automação de navegador em viewports reais** (celular estreito, tablet
   paisagem, desktop) para tudo que é visual ou de toque. Meça geometria
   (`getBoundingClientRect` vs. viewport) além de tirar screenshot — número
   detecta corte, olho humano não.
2. **Clientes de socket reais** para tudo que é multiplayer: dois clientes, uma
   partida de verdade, quedas provocadas nos momentos críticos. Não simule a
   camada de rede que você está testando.
3. **Testes de função pura** para heurísticas e regras (a IA ganhou 28 asserts,
   incluindo um **validador que replica as regras de validação do servidor** e
   confere *todo* caminho gerado — invariante crítica, já que a aplicação de
   ações da IA não revalida).
4. **Selfplay** (IA vs. IA, partida completa) como teste de fumaça: termina sem
   exceção? Alguma unidade em posição ilegal? Métricas de comportamento
   comparáveis antes/depois?
5. **Regressão em refatorações "sem mudança de comportamento":** ao extrair as
   constantes de objetivos, comparei a saída da função antes e depois — carregando
   a versão anterior direto do histórico do Git ao lado da nova. Refator só é
   seguro quando provado idêntico.
6. **Sempre um *probe*, nunca só o caminho feliz:** para cada correção, teste o
   caso adjacente e o de erro (token inválido, recurso em zero, alvo fora de
   alcance, expiração do prazo). Um probe que não acha nada continua sendo
   informação.
7. **Limite configurável por env** é o que viabiliza teste de ciclo longo: rodamos
   partidas completas com limite de 2 e 4 turnos em segundos.
8. **Não poluir dados de produção:** partidas de teste geravam registros no
   dataset de treinamento. Passe a inspecioná-los (contagem de eventos) e apague
   os artefatos antes de commitar.

---

## Checklist priorizado de execução

Ordem por (impacto ÷ esforço), do maior para o menor:

**Bloco 1 — Integridade (faça primeiro; são bugs, não melhorias)**
1. [ ] Auditar texto narrativo vs. código; resolver cada divergência (§1.1)
2. [ ] Corrigir números anunciados > capacidade real; nunca destacar o irrecusável (§1.2)
3. [ ] Exibir recursos consumíveis como *atual/inicial*, inclusive em zero (§3.1)
4. [ ] Atualizar toda documentação de vitória/regras, incluindo mocks (§3.2)

**Bloco 2 — Estado terminal (risco de partida inviável)**
5. [ ] Limite de turnos + adjudicação reaproveitando a checagem de vitória, visível na UI (§2.1)
6. [ ] Reconexão com período de graça + token; aviso transitório ≠ terminal (§2.2)
7. [ ] Inventariar **pontos de bloqueio** e reemitir a interação pendente no reingresso (§2.3)

**Bloco 3 — Jogabilidade em toque (se houver público mobile/tablet)**
8. [ ] Garantir a invariante: todo ponto do tabuleiro alcançável em qualquer viewport (§5.1)
9. [ ] Gestos completos: arrasto, pinça, toque duplo, toque longo, com limiar de arrasto (§5.2)
10. [ ] Painel lateral com três formas de fechar + faixa de borda reservada (§5.3)
11. [ ] Declarar empilhamento explícito da região sobreposta; testar tocando (§5.4)

**Bloco 4 — Compreensão do jogo**
12. [ ] Envelope completo da ação (alcance total) + atalho de rota mantendo controle fino (§4.1)
13. [ ] Ajuda dentro da partida, com glossário gerado da mesma fonte dos tooltips (§3.3, §3.4)
14. [ ] Redundância de canal (forma/textura além de cor) (§6)

**Bloco 5 — Oponente e acabamento**
15. [ ] IA consultando a definição única de vitória + defesa oportunista (§7.1, §7.2)
16. [ ] IA com consciência de recursos e autopreservação da logística (§7.3, §7.4)
17. [ ] Decisões táticas por heurística explícita + bloco de tunáveis (§7.5, §7.6)
18. [ ] Tornar descartes silenciosos ruidosos; extrair aplicação de ações como função pura (§7)
19. [ ] Higiene: código morto, idioma, nomes, lixo, README (§8)

---

## Anti-padrões observados (evite repetir)

1. **Filtrar do payload exatamente o que guarda o ponto de interação** — some a
   pergunta pendente na reconexão.
2. **Esconder o estado zerado** de um recurso por parecer "vazio" — é o estado
   mais informativo.
3. **Desativar a rolagem nativa sem assumir a navegação inteira** — cria regiões
   inalcançáveis.
4. **Confiar na ordem do DOM para empilhamento** com elementos posicionados.
5. **Duas fontes de verdade para a mesma grandeza** — divergem, e a divergência
   otimista quebra a UX.
6. **IA com sua própria noção de prioridade**, desconectada das regras de vitória.
7. **Substituir controle fino por atalho** em vez de oferecer os dois.
8. **Aceitar relato de bug sem ler os dados reais** — os logs de partida deram o
   turno exato e a mecânica envolvida.
9. **Marcar "verificado" com base em revisão de código** para mudanças visuais,
   de toque ou de rede.
