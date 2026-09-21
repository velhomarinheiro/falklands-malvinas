# Prompt condensado — auditoria e aperfeiçoamento de jogo por turnos

Cole o bloco abaixo, inteiro, para um agente de IA trabalhando no outro jogo.
É autocontido: não depende de acesso a este repositório.

Versão completa e comentada: `docs/ROTEIRO_APERFEICOAMENTOS.md`.

---

```
Você vai auditar e aperfeiçoar o design e a jogabilidade deste jogo. Ele é um jogo
por turnos com dois lados, servidor autoritativo, tabuleiro renderizado no cliente,
sessão em tempo real (salas de 2 jogadores e/ou modo solo contra IA) e dados de
cenário declarativos separados da lógica. Confirme essas características no código
antes de começar e me diga o que não se aplica.

Este roteiro vem de uma série de melhorias validadas em um jogo semelhante. NÃO
presuma que os mesmos defeitos existem aqui: audite primeiro, depois corrija o que
for real.

## REGRA DE MÉTODO (governa tudo abaixo)

Verificação é observação em execução: suba o jogo, opere-o até o código alterado
rodar, e capture o que você viu. Rodar a suíte de testes prova que o CI funciona,
não que a mudança funciona. Especificamente:

- Mudanças visuais ou de toque: automação de navegador em viewports reais (celular
  estreito, TABLET EM PAISAGEM, desktop). Meça geometria (retângulo do elemento vs.
  viewport) além de tirar screenshot — número detecta corte, olho humano não. Teste
  tocando, não olhando: "elemento visível" não implica "elemento clicável".
- Mudanças de rede/multiplayer: dois clientes reais, partida de verdade, quedas
  provocadas nos momentos críticos. Não simule a camada que você está testando.
- Heurísticas e regras: testes de função pura, incluindo um validador que replique
  as regras de validação do servidor e confira TODA saída gerada.
- Refatoração "sem mudança de comportamento": prove igualdade comparando a saída da
  função antes e depois (carregue a versão anterior do histórico do Git ao lado da
  nova).
- Para cada correção, teste também o caso adjacente e o de erro (recurso em zero,
  credencial inválida, alvo fora de alcance, prazo expirado). Um teste desses que
  não acha nada continua sendo informação: relate-o.
- Torne limites de partida configuráveis por variável de ambiente — é o que permite
  rodar partidas completas em segundos no teste.
- Não polua dados de produção: partidas de teste podem gerar registros em datasets;
  inspecione e apague os artefatos antes de commitar.

## FASE 1 — AUDITORIA (não altere nada ainda)

Responda estas sete perguntas com evidência (arquivo:linha) e me apresente a lista
de achados reais antes de codar:

1. Toda regra PROMETIDA em texto existe no código? Colete todo texto narrativo
   (notas de unidade, landing, tutorial, manual, tooltips) e confronte com a
   implementação.
2. A partida tem estado terminal garantido? Existe limite de turnos/tempo? O que
   acontece se ninguém cumprir os objetivos?
3. O que acontece se um jogador cair em CADA momento do fluxo? Percorra fase por
   fase, inclusive durante decisões interativas em que o servidor bloqueia
   esperando input.
4. Há duas fontes de verdade para a mesma grandeza (ex.: alcance por categoria vs.
   alcance por arma; rótulos duplicados cliente/servidor)? Onde divergem, e em que
   direção?
5. A informação crítica aparece quando mais importa (recurso esgotado, condição
   quase cumprida, motivo de ação bloqueada)?
6. O jogo é operável em toque de ponta a ponta? Teste tablet em paisagem e retrato,
   e celular estreito.
7. A IA consulta a mesma definição de vitória que o juiz do jogo?

## FASE 2 — EXECUÇÃO (na ordem; um commit por item, com verificação própria)

BLOCO 1 — INTEGRIDADE (são bugs, não melhorias)
1. Divergência texto↔código é bug. Resolva em uma das duas direções (implementar a
   mecânica ou corrigir o texto) e PERGUNTE-ME qual — muda balanceamento.
2. Nunca destaque como acionável algo que a ação vai recusar. Ao achar fontes de
   verdade duplicadas, classifique cada divergência: OTIMISTA (anuncia mais do que
   entrega) corrija já, quebra a UX; CONSERVADORA (entrega mais do que anuncia) é
   dívida tolerável. Priorize pela direção do erro em vez de unificar tudo.
3. Recursos consumíveis sempre exibem atual/inicial, e o estado ZERADO é o mais
   importante de todos — nunca esconda por "estar vazio".
4. Mudança de regra de vitória tem raio maior que o código: landing, tutorial,
   mocks, manuais, textos de fim de jogo. Busque textualmente os números antigos.

BLOCO 2 — ESTADO TERMINAL
5. Limite de turnos + regra de adjudicação, reaproveitando a função de checagem de
   vitória (não escreva uma segunda lógica de "quem está ganhando"). O limite deve
   ser visível desde o turno 1.
6. Reconexão com período de graça (~75s) + token emitido no início e persistido no
   cliente. Valide token, assento vago e partida viva. Distinga aviso TRANSITÓRIO
   de TERMINAL na UI — reutilizar o overlay de "fim" para uma queda temporária faz
   o jogador desistir. Conserta F5 acidental de graça.
7. O MAIS IMPORTANTE: reconexão não é restaurar o estado, é restaurar o estado E o
   PONTO DE INTERAÇÃO. Faça o inventário de todos os momentos em que o servidor
   bloqueia esperando input (decisões, escolhas simultâneas, confirmações) e, para
   cada um, garanta que o jogador reconectado receba a pergunta de volta. Atenção:
   estruturas que você filtra do payload por serem "internas" são exatamente as que
   guardam esse ponto — foi assim que uma partida travou permanentemente.

BLOCO 3 — TOQUE (se houver público mobile/tablet)
8. INVARIANTE: em qualquer viewport, todo ponto interativo do tabuleiro deve ser
   alcançável por algum gesto disponível. Se você desativa a rolagem nativa
   (touch-action), assume a responsabilidade integral pela navegação. Cuidado com a
   combinação fatal: elemento limitado só pela largura + rolagem nativa desativada
   + arrasto travado no zoom mínimo = faixa do tabuleiro que nenhum gesto alcança.
   Solução: o tabuleiro cabe sempre inteiro na área visível (limitado por largura E
   altura, centralizado) e a navegação é só zoom + arrasto internos. Teste o PONTO
   EXTREMO do conteúdo em TABLET PAISAGEM — é o formato que mais quebra e o mais
   esquecido.
9. Gestos: um dedo arrasta; dois dedos pinça ancorada no ponto médio; TOQUE DUPLO
   alterna visão geral ↔ aproximação ancorada no ponto (mais eficiente que caçar
   botões de zoom); toque longo (~500ms) substitui o clique direito. Distinga toque
   de arrasto por limiar de deslocamento (~8px) — sem isso todo arrasto seleciona
   por acidente. Cancele o temporizador do toque longo ao detectar movimento. Todo
   gesto exclusivo de mouse (hover, clique direito) precisa de equivalente em toque.
10. Painel lateral: ofereça TRÊS formas de fechar (botão explícito, fundo
    escurecido, gesto de deslize). Reserve uma faixa da borda (~24px) para o gesto
    de abrir e exclua-a dos gestos do tabuleiro. Alvos de toque ≥ 40px.
11. Ao introduzir painel sobreposto, declare explicitamente o empilhamento
    (z-index) de TODOS os elementos da região — cabeçalho, botão de abrir, fundo,
    painel. Um elemento posicionado renderiza acima de irmão não posicionado
    independentemente da ordem no DOM. Dois defeitos reais dessa família: o painel
    cobriu o próprio botão que o abria; e um botão de fechar ficou visível mas não
    tocável porque outro elemento interceptava o evento.

BLOCO 4 — COMPREENSÃO
12. Mostre o ENVELOPE INTEIRO da ação, não só o próximo passo (alcance total de
    movimento/tiro/área). Ofereça o atalho (clicar no destino → rota automática por
    busca em largura, reconstruída pelo predecessor de cada nó) SEM remover o
    controle fino passo-a-passo: substituir um pelo outro irrita quem precisa de
    precisão.
13. Ajuda dentro da partida (modal com abas + atalho de teclado), não só na porta
    de entrada. Todo jargão de domínio precisa de UM dicionário central consumido
    por tooltip E glossário — uma fonte, dois consumidores.
14. Redundância de canal: toda informação essencial em dois canais (cor + forma,
    cor + textura ou cor + ícone). Respeite prefers-reduced-motion e foco visível.
15. Onde o servidor recusa uma ação, o cliente diz POR QUÊ (mensagem específica).

BLOCO 5 — OPONENTE DE IA E ACABAMENTO
16. A IA deve consultar a MESMA definição de vitória que o juiz do jogo: extraia as
    listas de objetivos para uma constante única compartilhada. Duas listas
    dessincronizam na primeira mudança de cenário. Recalcule prioridades a cada
    decisão, PULANDO condições já cumpridas, para a IA se re-tarefar sozinha.
17. Objetivo > tipo de unidade. Uma IA puramente ofensiva parece burra de um jeito
    específico: ignora o que o jogo pede. Mas mantenha defesa oportunista: ameaça
    próxima vence objetivo distante, senão a IA desfila ao lado de quem a mata.
18. Consciência de recursos: abaixo de um limiar, trocar a missão por
    reabastecimento no provedor ALCANÇÁVEL mais próximo (respeite restrições de
    terreno/acesso — um provedor inacessível é pior que nenhum). Autopreservação de
    unidades de apoio (fuga maximizando distância mínima às ameaças) + uma escolta
    para a mais valiosa.
19. Decisões táticas por heurística explícita, com a semântica LIDA no resolvedor
    (não presumida). Concentre limiares num único bloco de tunáveis — dificuldade é
    ajuste de constantes, não de código.
20. Se a IA produz ações que o pipeline descarta em silêncio, você tem bug
    invisível: torne o descarte ruidoso. Extraia a aplicação de ações numa função
    pura, separada da camada de rede — é o que viabiliza teste e selfplay (IA vs.
    IA, partida completa) como teste de fumaça.
21. Higiene: código morto, ramos de compatibilidade com eventos não mais emitidos,
    idioma inconsistente na UI, nomes de arquivo enganosos, arquivos-lixo
    commitados, README ausente ("o que é, como rodar, estrutura").

## ANTI-PADRÕES (não repita)

- Filtrar do payload exatamente o que guarda o ponto de interação.
- Esconder o estado zerado de um recurso por parecer "vazio".
- Desativar a rolagem nativa sem assumir a navegação inteira.
- Confiar na ordem do DOM para empilhamento com elementos posicionados.
- Duas fontes de verdade para a mesma grandeza.
- IA com noção própria de prioridade, desconectada das regras de vitória.
- Substituir controle fino por atalho em vez de oferecer os dois.
- Aceitar relato de bug sem ler os dados reais (logs de partida dão o momento
  exato e a mecânica envolvida).
- Marcar "verificado" com base em revisão de código, para mudança visual, de toque
  ou de rede.

## ENTREGA

- Primeiro a lista de achados da Fase 1, para eu priorizar. Só então codifique.
- Um commit por item, mensagem descritiva explicando o SINTOMA e a causa raiz.
- Itens de regra e de interface não viajam no mesmo commit.
- Para cada item, diga como verificou e cole a evidência (saída, medição,
  screenshot). Se algo ficou sem verificar, diga explicitamente.
- Pergunte antes de qualquer mudança que altere balanceamento ou regra de vitória.
```
