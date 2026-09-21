# Arena RoboMundo — Quiz EDUTEC

Abra `quiz.html` diretamente no navegador. Por solicitação do autor, as páginas anteriores
permanecem intactas, inclusive seus links. Apenas o menu da nova página aponta para o jogo.
Não há instalação, compilação ou biblioteca JavaScript. Também funciona abrindo o HTML diretamente.
A fonte Poppins é a mesma do site; se estiver offline, a fonte alternativa é Arial.
Robôs, cenário, ataques e sons são gerados localmente.

## Arquivos

- `quiz.html`: cabeçalho original, Canvas, HUD e telas.
- `quiz.css`: estilos exclusivos da nova página (não altera `style.css`).
- `quiz.js`: lógica e desenho do jogo, separados em funções.
- `testes/quiz.test.cjs`: testes de lógica sem dependências; execute `node --test testes/quiz.test.cjs`.

## Como jogar

WASD ou setas movem NEO em oito direções. Observe as áreas de aviso antes dos ataques.
Escape ou Pausar congela a batalha. Ao trocar de aba/janela, ela pausa automaticamente.
O botão de som silencia os efeitos. Telas pequenas também têm botões de movimento por toque.

Você começa com 3 vidas e fica invencível por 1,8 segundo após ser atingido.
Cada acerto remove 20% da vida de Ômega e recupera até 1 vida do jogador.
Um erro remove 1 vida, mas preserva a última: a questão entra no fim da fila para uma nova chance.
Todas as cinco questões precisam ser acertadas; repetir uma questão já vencida não causa dano adicional.

Cada rodada principal dura 32 segundos de combate. Após a primeira passagem pelas cinco
questões, as tentativas pendentes têm 14 segundos de combate. Há 1 segundo de transição
antes de cada questão e 2,5 segundos de animação final. A leitura das perguntas deixa
uma partida sem erros em aproximadamente 3–5 minutos. Não existe limite de tempo para responder.

## Organização do JavaScript

1. `CONFIG` concentra dimensões, velocidade e durações.
2. `PERGUNTAS` registra alternativas, gabarito, explicação e origem no site.
3. `player`, `boss`, `estado`, `fila` e `resolvidas` guardam a partida.
4. Funções de tela, áudio e HUD respondem às mudanças de estado.
5. `criarAtaque` e `atualizarAtaques` cuidam dos quatro padrões e suas colisões.
6. `moverPlayer` normaliza diagonais e limita o robô à arena.
7. `atualizar` avança somente o estado ativo; `desenhar` renderiza Canvas.
8. `loop` usa um único `requestAnimationFrame`. Não há timers de ataque ou intervalos.

Estados: início → combate → transição → pergunta → resposta → combate.
Acertar as cinco questões leva a morte do chefe → vitória; perder todas as vidas leva a derrota.
Pausa guarda o estado anterior. Reiniciar redefine filas, vidas, ataques, partículas e relógios,
sem registrar novamente os eventos ou criar outro loop.

## Padrões de ataque

- **Projéteis:** mira tracejada, seguida por disparos na direção marcada; a mira não acompanha o jogador.
- **Chuva:** círculos avisam onde a energia vai cair.
- **Laser:** faixa marcada antes de um disparo horizontal ou vertical.
- **Onda:** um anel cresce a partir do centro; o setor azul fica seguro.

Só um padrão permanece ativo de cada vez. Em 60–40% de vida, Ômega dispara mais projéteis;
em 20%, velocidade e frequência sobem moderadamente. Os avisos continuam com pelo menos 1,2 s.
A área de colisão do jogador é menor que seu desenho, para tornar os desvios mais tolerantes.

## Fontes das perguntas

| Questão | Conteúdo | Arquivo e seção |
| --- | --- | --- |
| 1 | Mecânica, eletrônica e programação | `o-que-e-robotica.html`, introdução |
| 2 | Sensores captam informações | `o-que-e-robotica.html`, Entrada |
| 3 | Nem todo robô usa IA | `o-que-e-robotica.html`, aviso |
| 4 | Exploradores estudam locais arriscados | `tipos-de-robo.html`, Robôs Exploradores |
| 5 | Segurança, privacidade e responsabilidade | `robotica-no-futuro.html`, Impactos e desafios |

## Verificação

Os testes de lógica exercitam os botões das quatro alternativas, erros com a última vida,
repetição das cinco questões, progressão, quatro ataques, pausa, colisões e reinício após vitória/derrota.
Uma simulação completa movimenta o robô pelas áreas seguras, sem desativar dano ou ataques.
As páginas antigas são comparadas com a versão original: nenhum byte deve mudar.
Esses testes não substituem a inspeção visual e uma partida em navegador real.
