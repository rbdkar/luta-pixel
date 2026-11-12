# Luta Pixel

Jogo de luta 2D no estilo Street Fighter, em HTML, CSS e JavaScript puro, desenhado em `<canvas>`.
Não precisa instalar nada nem rodar servidor: abra o `index.html` no navegador (duplo clique).

## Modos

- **Arcade**: 4 lutas contra a CPU, cada uma melhor de 3 rounds de 60 s: três adversários
  sorteados entre os outros onze (Corvo, Ampulheta e Órbita lutam na casa deles: Bambuzal,
  Deserto ou Observatório; os outros num mapa sorteado) e, no fim,
  **a Sombra**, uma cópia sombria do seu lutador, no Telhado da Cidade à noite, com a CPU um
  nível mais difícil.
- **Versus 2P**: dois jogadores no mesmo teclado (ou com controles), escolhendo lutadores e mapa.
- **Sobrevivência**: lutas seguidas de 1 round contra adversários cada vez mais fortes; a vida
  só volta 30% entre as lutas. A cada 5 lutas aparece a sua Sombra. O recorde fica salvo no navegador.
- **Equipes 3x3** (novo): clique em até 3 lutadores para montar a sua equipe (no teclado,
  `Enter` ou `J` em cima da carta marca e desmarca; faltando, o resto é sorteado) contra 3 da
  CPU. Cada luta vale 1 round: quem vence fica na arena com a vida que sobrou (recupera 20) e o
  próximo da equipe que perdeu entra. Os rostinhos embaixo da barra de super mostram quem está
  lutando, quem vem depois e quem já caiu. Ganha quem derrubar os 3.
- **Caos** (novo): luta contra a CPU em que **uma regra maluca muda a cada 12 segundos** (o nome
  e a barrinha do tempo ficam embaixo do relógio): lua (gravidade baixa), turbo, câmera lenta,
  super à vontade, dano em dobro, vampiro (quem bate recupera metade do dano), chuva de
  meteoros (saia de baixo das sombras), chão de gelo e tudo ao contrário (esquerda vira direita
  para os dois). A contagem para na pose do super, no embate de domínios e no tempo parado.
- **Desafios** (novo): 7 ou 8 missões com cada lutador contra um boneco parado: combo,
  rasteira, especiais, cancelar o combo no especial, um golpe característico (puxar com o fio,
  deixar a bomba-relógio explodir no boneco, congelar, fazer flutuar...), super e domínio. O
  painel no alto mostra a missão e as teclas; o progresso fica salvo no navegador e o menu
  mostra quantas você já fez.
- **Treino**: arena com vida infinita, barra de super sempre cheia (dá para testar o domínio
  quantas vezes quiser), dano do último combo na tela e **zonas de ataque visíveis** (tecla `N`
  ou menu de pausa). O boneco pode ficar parado, agachado, defender tudo, pular sem parar ou
  lutar de verdade (lutando, ele responde ao seu domínio com o dele: treine o embate).
- **Fase livre**: a fase de plataforma original, com caixas para quebrar e bonecos (o garoto de
  óculos) que fogem e caem com socos. `Q` troca de personagem.

## Controles

| Ação | Teclado | Toque | Controle |
|------|---------|-------|----------|
| Andar | `A` `D` ou `←` `→` | direcional (metade esquerda) | direcional / analógico |
| Defender | segure **para trás** (em pé ou agachado) | direcional para trás | para trás |
| Agachar | `S` ou `↓` | direcional para baixo | para baixo |
| Pular | `W`, `↑` ou `Espaço` | direcional para cima ou PULO | cima ou Y |
| Soco | `J` ou `X` (aperte de novo: soco, soco, **chute**) | SOCO | A ou X |
| **Rasteira** (golpe baixo) | `↓` + soco (também fecha o combo: soco, soco, `↓` + soco) | baixo + SOCO | baixo + A |
| Especial | `K` ou `C` | ESP | B |
| Especial pelo comando | `↓` `↘` `→` + soco | gire o direcional + SOCO | idem |
| Segundo especial (Trovão, Soldador, Corvo, Ampulheta, Órbita, Marionete e Pavio) | `↓` + `K`, ou `↓` `↙` `←` + soco | baixo + ESP | idem |
| Bomba do Pavio | sem direção ela mira no adversário; segurando `←` cai perto, `→` vai longe | idem | idem |
| Planar (só o Órbita) | segure o pulo no ar | segure PULO | segure cima/Y |
| **Super** (meia barra) | `L` ou `V` | SUPER (acende com meia barra) | RB ou RT |
| **Expansão de Domínio** (barra toda) | `I` ou `B` | DOMÍNIO (acende com a barra cheia) | LB ou LT |
| **Agarrão** | `→` + soco colado no adversário (`←` + soco joga para trás) | direcional + SOCO | idem |
| Escapar do agarrão | soco logo que for agarrado | SOCO | A |
| Sair do gelo / embate de domínios | aperte soco sem parar | SOCO | A |
| Dash | dois toques rápidos para frente ou para trás (soco ou especial no meio do dash saem com o embalo) | dois toques no direcional | idem |
| Pausa | `Esc` ou `P` | botão ❚❚ | Start |
| Som / dicas / zonas de ataque (treino) | `M` / `H` / `N` | menu de pausa | — |

**Versus no teclado**: Jogador 1 usa `W A S D`, `F` soco, `G` especial, `H` super, `T` domínio.
Jogador 2 usa as setas, `K` soco, `L` especial, `Ç` super, `O` domínio (ou `1 2 3 0` do teclado numérico).
Com controles conectados, o primeiro é do Jogador 1 e o segundo do Jogador 2.

Nos menus: setas escolhem; `Enter`, `Espaço` ou `J` confirmam. Tudo também funciona com mouse e toque.
O jogo pausa sozinho se você trocar de aba ou de janela no meio da luta.

## Regras da luta

- **Vida 100**. A barra fica amarela; o dano recente aparece em vermelho e some logo depois.
- **Defesa**: segurando para trás você não leva dano, só um empurrão. Especiais e supers
  defendidos tiram um pouquinho, mas nunca nocauteiam. Agachado defende golpes no chão, mas
  **golpes aéreos só se defendem em pé** e a **rasteira só se defende agachado** (o jogo de
  "alto e baixo": pulo com chute em quem agacha, rasteira em quem defende em pé).
- **Guarda de perto**: segurando para trás com um golpe, projétil ou super vindo na sua
  direção, o lutador para e já fica em guarda em vez de andar para trás.
- **Contra-golpe**: acertar o adversário no começo do golpe dele (antes do soco dele chegar)
  tira 25% a mais, deixa ele mais tempo sem reação e aparece **CONTRA!** na tela.
- **Botões com memória curta**: um aperto vale por alguns centésimos de segundo; apertando o
  próximo golpe um pouco antes do anterior terminar, ele sai assim que der (combos e especiais
  saem mais fácil), mas um aperto velho não sai do nada depois.
- **Chão que quica**: quem cai forte depois de um chute ou golpe que derruba quica uma vez no chão.
- **Combo rende menos a cada golpe**: do 3º golpe seguido em diante cada acerto tira um pouco
  menos (até a metade), para ninguém morrer num combo só. Supers e acertos garantidos não diminuem.
- **Agarrão**: não dá para defender — é a resposta para quem só fica na defesa. Apertar soco
  logo depois de ser agarrado escapa.
- **Barra de super com 2 níveis**: enche ao bater, apanhar e defender e passa de um round
  para o outro. **Meia barra** (dourada) solta o super: a tela escurece, aparece o nome do golpe
  e o relógio para por um instante. **Barra cheia** (na cor do lutador, escrito DOMÍNIO!) solta
  a Expansão de Domínio. Gastar no super ou guardar para o domínio é a sua escolha.
- **Agachar** faz a bola de energia pequena e o livro alto passarem por cima.
- **Combos**: golpes que acertam deixam o adversário sem reação por um instante; o próximo
  golpe da sequência emenda. Um golpe do combo que acertou pode ser cancelado no especial ou no super.
- **Tontura**: cada golpe recebido enche a barrinha azul embaixo da vida. Cheia, o lutador
  fica tonto, com estrelas na cabeça, por 2 s.
- **Derrubada**: golpes de finalização, agarrões e qualquer golpe no ar derrubam. Caído e
  levantando, o lutador não pode ser atingido.
- **Canto**: preso na borda, quem apanha não recua; quem bate é empurrado para trás.
- **Um projétil por vez** (fora do domínio). Dois projéteis que se encontram se anulam; o raio
  do Encapuzado e a Nevasca desmancham os projéteis que encostam neles.
- **Congelado**: o pico de gelo, a Nevasca e alguns golpes de domínio prendem o lutador num
  bloco de gelo. Apertar botões racha o gelo mais rápido; um golpe em quem está congelado
  estilhaça o gelo e tira um pouco mais.
- **Queimado**: no domínio do Brasa, cada golpe deixa o adversário pegando fogo (perde vida
  devagar por alguns segundos, mas o fogo sozinho nunca nocauteia).
- **Pés soldados**: no domínio do Soldador, o maçarico e o acerto garantido soldam os pés
  do adversário no chão por um instante: ele não anda, não pula e não dá dash, mas ainda
  defende e bate.
- **Cópia** (Corvo): o olho rubro copia o último especial que o adversário usou, de qualquer
  distância; o `K` do Corvo passa a soltar esse golpe (a cópia aparece embaixo da barra de super).
  Sem cópia, ele joga a Kunai Rubra.
- **Leitura** (Corvo): uma postura de contra-ataque. Se um golpe ou projétil encostar nela, o
  Corvo some numa explosão de penas, reaparece **atrás** de quem bateu (até de longe) e corta.
  Agarrões, supers e acertos garantidos passam por ela.
- **Câmera lenta** (Ampulheta): dentro da Bolha do Tempo o adversário (e os projéteis dele)
  anda mais devagar: andar, pular, golpes, tudo. A bolha estoura depois de 2 golpes dela em quem
  está lá dentro (5 no domínio).
- **Rebobinar** (Ampulheta): ela volta 1,2 s no tempo: para onde estava e com a vida que tinha
  (recupera até 10). Bom logo depois de levar um combo.
- **Tempo parado** (super da Ampulheta): o mundo fica cinza e só ela se mexe por 1,5 s. Os golpes
  em quem está parado não empurram: o dano fica guardado (o número aparece em cima dele) e cai
  todo de uma vez quando o tempo volta (até 22).
- **Puxão** (Órbita): o buraco negro arrasta o adversário para o miolo, mesmo defendendo, e
  engole projéteis. Dá para escapar pulando entre um pulso e outro.
- **Flutuando** (Órbita): a Antigravidade levanta o adversário, que fica no ar sem controle
  (dá para bater nele lá em cima) e depois despenca, levando dano na queda.
- **Preso no fio** (Marionete): o fio fica ligado aos dois por uns 3 s (longe demais, arrebenta).
  Apertando o especial de novo vem o **Puxão**: o adversário vem deslizando até ela sem poder
  defender e chega aberto para o combo.
- **Controles trocados** (Marionete): os Fios Trocados (de perto, ou de qualquer distância pelo
  fio preso) trocam a esquerda e a direita do adversário por ~2,5 s; duas setas em cima da
  cabeça avisam. Vale para a CPU também, que demora um pouco a se acostumar.
- **Espetáculo** (super da Marionete): a cruz de marionete segue o adversário e desce em cima
  dele. Quem sair de baixo a tempo (dash ou pulo para o lado) escapa; quem ficar é pendurado nos
  fios, dança, apanha 6 vezes e cai quando ela corta os fios.
- **Bomba-relógio** (Pavio): gruda no adversário com um tapa que empurra, conta 3, 2, 1 e explode
  só em quem estiver com ela (17 de dano, não dá para defender). **Batata quente**: quem está com
  a bomba passa para o outro acertando um golpe nele — mas logo depois de grudar ela fica presa
  com fita (o X em cima dela) por 1,5 s. De capacete, o Pavio leva só metade da própria bomba.
  Se não tiver ninguém perto, ela fica no chão e explode ali.
- **Fim do round**: K.O. (câmera lenta) ou fim do tempo; no tempo vence quem tiver mais vida.

### Lutadores

| | Combo | Especial | Super |
|-|-------|----------|-------|
| **Encapuzado** | jab → gancho de energia → chute que derruba | bola de energia (segure para a grande, que derruba) | **Raio Sombrio**: raio que atravessa a arena, vários acertos |
| **Garoto** | jab → direto → chute que derruba | investida que derruba (defendida, deixa ele aberto) | **Rajada de Socos**: avança e, se encostar, solta 7 socos |
| **Óculos** | jab → direto de longo alcance → chute que derruba | livro voador | **Chuva de Livros**: 5 livros seguidos, alternando alto e baixo |
| **Brasa** | jab → direto → chute flamejante | **Chama ascendente**: gancho que sobe, invencível no começo (ótimo contra pulos; se errar, fica aberto ao cair) | **Inferno**: sobe girando em chamas carregando o adversário |
| **Gélida** | jab → soco de gelo → chute que derruba | **Pico de gelo**: a mão no chão faz o gelo brotar embaixo do adversário (aviso no chão, depois congela). No ar, soco faz o **Mergulho glacial**, um chute na diagonal até o chão | **Nevasca**: uma parede de neve que avança, prende, acerta 6 vezes e congela no fim |
| **Soldador** (novo) | o próprio Óculos de serralheiro: jab → direto → chute de bota | **Maçarico**: abaixa a máscara de solda e solta uma chama curta que acerta 4 vezes e queima projéteis. **Portão de ferro** (`↓` + `K`): um portão despenca à frente, derruba quem estiver embaixo e fica de pé uns segundos como barreira (o adversário não atravessa andando, projéteis batem nele; pulando dá para passar) | **Jaula de Ferro**: uma jaula cai no adversário onde ele estiver, é soldada com ele dentro e explode |
| **Corvo** (novo, da sua imagem) | soco → mão em faca → chute alto que derruba | **Olho Rubro**: solta o último especial que ele copiou do adversário (qualquer um dos 14 do jogo); sem cópia, **Kunai Rubra**. **Leitura** (`↓` + `K`): postura que contra-ataca qualquer golpe ou projétil, reaparecendo atrás de quem bateu | **Revoada**: um bando de 12 corvos atravessa a tela em cima do adversário; o último é gigante e derruba |
| **Ampulheta** (nova) | jab → direto → chute que derruba | **Bolha do Tempo**: joga uma ampulheta de areia que vira uma bolha de câmera lenta. **Rebobinar** (`↓` + `K`): volta no tempo e recupera a vida perdida | **Parada do Tempo**: o tempo para para todo mundo menos ela; o dano guardado cai de uma vez |
| **Órbita** (novo) | jab → direto → chute que derruba | **Buraco Negro**: abre à frente, puxa o adversário e engole projéteis. **Antigravidade** (`↓` + `K`): o chão embaixo do adversário brilha e ele sai flutuando. Segurando o pulo no ar, **plana** | **Supernova**: uma estrela arremessada vira um buraco negro em volta do adversário, acerta 6 vezes e explode |
| **Marionete** (nova) | jab → direto → chute que derruba | **Fio e Puxão**: lança um fio que prende o adversário; `K` de novo puxa ele até ela, aberto para o combo. **Fios Trocados** (`↓` + `K`): de perto, ou a qualquer distância pelo fio preso, troca a esquerda e a direita do adversário por alguns segundos | **Espetáculo**: a cruz de marionete desce em cima do adversário; preso nos fios, ele dança, apanha 6 vezes e cai quando ela corta os fios |
| **Pavio** (novo) | jab → direto → chute que derruba | **Bomba**: joga uma bomba em arco que cai em cima do adversário (`←` cai perto, `→` vai longe; colado, ela vai direto nele), quica e explode ao encostar. **Bomba-relógio** (`↓` + `K`): gruda no adversário com um tapa; quem estiver com ela quando o relógio zerar leva a explosão, e cada golpe de quem está com ela passa a bomba para o outro | **Barril de Pólvora**: acende o pavio e chuta um barril que rola pelo chão e explode em quem encostar |
| **Trovão** | jab → cotovelada → chute que derruba | **Passo relâmpago**: some e reaparece atrás do adversário (se estiver perto) ou à frente; com ← foge para trás; dá para socar logo ao reaparecer. **Raio celeste** (`↓` + `K`): um raio cai em cima do adversário se ele estiver no chão à frente (com um aviso curto: andando dá para escapar); longe, cai a uma distância fixa (pega até quem pula) | **Fúria do Trovão**: seis raios seguidos em cima do adversário, onde ele estiver |

Todos têm a **rasteira** (`↓` + soco) e o **chute aéreo** (soco no ar; a Gélida mergulha e o
Trovão dá um soco aéreo). Cada um tem frases de vitória, e a pausa mostra a lista de golpes do seu lutador.

**Equilíbrio**: os números de dano, alcance e tempo de cada especial foram ajustados com
torneios CPU x CPU (todos contra todos, dos dois lados, centenas de lutas, agora com os 12).
Ninguém ganha mais de ~2/3 das lutas nem menos de ~1/3; o resto depende de quem está jogando.

### Expansão de Domínio

Inspirada em Jujutsu Kaisen. Com a barra toda cheia, aperte `I` (ou `B`, ou o botão DOMÍNIO):
o lutador faz o sinal de mão, a tela escurece, a faixa anuncia **EXPANSÃO DE DOMÍNIO** e um
cenário ligado ao poder dele se abre a partir do próprio corpo e engole a arena por **10 segundos**
(o tempo aparece numa faixa embaixo do relógio). A música também muda.

Dentro do domínio, quem expandiu:

- bate **25% mais forte**, anda mais rápido e deixa o adversário mais lento;
- tem os especiais turbinados e cada golpe que acerta puxa um **eco** do cenário (um segundo golpe);
- ganha o **acerto garantido**: de tempos em tempos uma mira fecha em volta do adversário e o
  cenário ataca sozinho — **não dá para defender**, só esperar ou tentar não estar de pé;
- não enche a barra enquanto o domínio durar.

| Lutador | Domínio | O que muda | Acerto garantido |
|-|-|-|-|
| Encapuzado | **Abismo Violeta**: o vazio roxo com uma fenda de energia no céu | a bola de energia já sai grande e dá para lançar várias; ecos são espinhos roxos | espinho do abismo brotando do chão |
| Garoto | **Ringue Sem Fim**: um ringue que não acaba, com plateia, telão e holofotes | cada soco acerta duas vezes (punho fantasma); a investida fica mais rápida e atravessa projéteis | punho fantasma gigante |
| Óculos | **Biblioteca Infinita**: estantes sem fim, velas e páginas voando | arremessa três livros de uma vez; cada acerto derruba um livro na cabeça | enciclopédia caindo do alto |
| Brasa | **Fornalha Eterna**: vulcões, mar de lava e colunas de basalto | todo golpe queima; o gancho ascendente deixa um pilar de fogo | pilar de chamas |
| Gélida | **Inverno Absoluto**: noite de aurora, lua enorme e agulhas de gelo | três picos de gelo por vez, congelamento mais longo e o mergulho congela | estalactite que congela |
| Trovão | **Céu da Tempestade**: pilares com runas acima de um mar de nuvens, chuva e relâmpagos | teleporte sem espera e com choque ao reaparecer; o raio cai duas vezes; cada acerto chama um raio | raio do céu |
| Soldador | **Serralheria Infinita**: uma oficina sem fim, com um portão gigante na frente do forno, portões pendurados em correntes, chuva de faíscas e clarões de solda | o maçarico vai mais longe e **solda os pés** do adversário no chão (não anda nem pula, mas ainda defende e bate); o portão vira uma **cela**: cai um de cada lado do adversário; cada acerto solta faíscas | **Portão Fechado**: as duas folhas de um portão se fecham em cima dele e a emenda é soldada (pés soldados) |
| Corvo | **Lua Rubra**: uma lua vermelha gigante que é um olho (a pupila segue o adversário), árvores mortas cheias de corvos, lanternas de pedra e um campo de lírios vermelhos; penas caindo | as cópias saem sem espera (e com o bônus do domínio do dono original), a kunai sai tripla e a Leitura segura mais tempo; cada acerto chama um corvo | um corvo gigante mergulha do céu |
| Ampulheta | **Deserto do Tempo**: pôr do sol parado com um relógio no sol (os ponteiros disparam), ampulhetas e relógios flutuando, arco e engrenagens na areia | o adversário fica em **câmera lenta** o domínio inteiro; a bolha é maior e dura mais; o Rebobinar recarrega rápido | o ponteiro gigante de um relógio desce em cima dele |
| Marionete | **Teatro das Marionetes**: um palco com cortinas de veludo, holofote que segue o adversário, ribalta acesa, pétalas caindo e marionetes penduradas | o adversário fica **sempre preso por um fio**: o Puxão sai a qualquer hora e os Fios Trocados duram mais e não gastam o fio; cada acerto estala um fio | a cruz gigante desce, levanta o adversário e solta |
| Pavio | **Pedreira Explosiva**: paredões de pedra ao pôr do sol, caixas de TNT, vagonete no trilho, poeira caindo e explosões ao longe | cada bomba solta **duas bombinhas** ao explodir; a bomba-relógio conta mais rápido; cada acerto solta um estouro | uma mina brota do chão e explode |
| Órbita | **Horizonte de Eventos**: o espaço, com um buraco negro gigante (o disco gira), planeta com anel, asteroides com cristais e estrelas cadentes | **gravidade baixa** para os dois (pulos altos e lentos); buraco negro maior e mais longo; a Antigravidade segura mais tempo | um meteoro cai do céu |

**Embate de domínios**: se o adversário também estiver com a barra cheia, ele pode expandir o
domínio dele por cima do seu. Tudo para, a tela se divide entre os dois cenários e começa um
cabo de guerra: **quem apertar soco mais rápido** empurra a divisa. Quem vencer fica com o
domínio (10 segundos de novo) e o outro fica atordoado; empate quebra os dois. A CPU sabe
expandir, guardar barra para isso e responder com o próprio domínio.

### Mapas

- **Campo Aberto** (o cenário original), também ao entardecer e à noite.
- **Telhado da Cidade**: prédios com janelas acesas, lua e letreiro neon, em duas camadas
  que se movem em velocidades diferentes com a câmera (paralaxe).
- **Dojo**: painéis de papel, pergaminho com um círculo de tinta, pilares e lanternas, também em paralaxe.
- **Bambuzal ao Luar** (casa do Corvo): bambuzal à noite com névoa, lua cheia, portal vermelho,
  lanternas de pedra acesas e caminho de pedra com musgo.
- **Ruínas do Deserto** (casa da Ampulheta): pôr do sol enorme, dunas, pirâmide, obelisco e
  muros de arenito com relevos (sol, olho e ampulheta), chão de areia.
- **Observatório** (casa do Órbita): topo de montanha à noite com a Via Láctea, picos nevados,
  a cúpula aberta com o telescópio, antena parabólica, pinheiros e piso de metal.

A Cidade, o Dojo, o Deserto e o Observatório têm música chiptune própria (o Bambuzal usa a do
Dojo), e a luta contra a Sombra tem um tema mais sombrio.

### A CPU

`js/ai.js`. Ela usa exatamente os mesmos comandos que você (é um "controle" que aperta
botões), então segue as mesmas regras. Escolhe planos (chegar perto, pressionar, defender,
recuar, pular para atacar, agarrar quem só defende) e reage a projéteis, pulos (antiaéreo),
golpes que erraram, agarrões (às vezes escapa) e aos próprios acertos (continua o combo,
cancela no especial ou no super). Usa a rasteira em quem defende em pé, agacha para defender
rasteiras (nem sempre a tempo) e corre para estilhaçar quem ficou congelado. Usa o pico de gelo e o mergulho da Gélida, o teleporte (até
para fugir de projéteis) e o raio do Trovão; com o Corvo, usa o golpe copiado conforme a
distância e a Leitura na hora em que o golpe ou o projétil chega; com a Ampulheta, joga a bolha
e rebobina depois de apanhar; com o Órbita, abre buracos negros, faz o adversário flutuar e pula
atrás dele, e plana no ar; com a Marionete, prende com o fio, puxa e emenda o combo e troca os
controles de quem está perto; com o Pavio, mira as bombas, gruda a bomba-relógio e foge (ou
segura com bombas) enquanto o relógio corre. Quem está com a bomba-relógio corre para passar com
um golpe, e quem vê a cruz do Espetáculo descendo dá um dash para sair de baixo. Guarda barra para a Expansão de Domínio em boa
parte dos rounds, quebra o gelo apertando botões e disputa o embate de domínios. A dificuldade
muda defesa, agressividade, reação, combos e a velocidade com que ela aperta no embate.

## Estrutura

```
index.html              palco 16:9, HUD, telas (menu, VS, resultado, pausa) e controles de toque
css/style.css           pixels nítidos, HUD, menus e controles de toque (tudo escala com o palco)
js/config.js            tela, física, luta (vida, tempo, super, agarrão, gelo), domínio, CPU, teclas
js/events.js            mensageiro de acontecimentos (som, HUD e luta escutam)
js/audio.js             efeitos 8-bit e 7 músicas chiptune sintetizados (uma só do domínio)
js/assets.js            lista de imagens
js/sprites.js           quadros, animações e áreas de golpe de cada sprite sheet
js/characters.js        lutadores: animações, golpes, especial, super, retrato e frases
js/tiles.js             tipos de tile (grama, telhado, assoalho, caixas, decoração) e legenda do mapa
js/levels/level1.js     fase de plataforma (fase livre)
js/levels/arena.js      arenas, climas e mapas de luta (com camadas de paralaxe)
js/input.js             teclado e toque viram "ações" (uma instância por jogador no versus)
js/pads.js              controles de videogame (Gamepad API)
js/animation.js         SpriteSheet, Animator e a versão "Sombra" das folhas
js/tilemap.js           mapa, variação dos tiles, colisão, blocos quebráveis e cache de desenho
js/camera.js            câmera da fase livre (segue) e da luta (entre os dois lutadores)
js/renderer.js          canvas em escala inteira, fundo em camada separada e interpolação da câmera
js/effects.js           lascas, faíscas, tremida e hit-stop
js/entities/entity.js   corpo com física, colisão e interpolação de posição
js/entities/fighter.js  o lutador: movimento, combos, especiais, super, domínio, agarrão, defesa,
                        reações, gelo, queimadura, mergulho e teleporte
js/entities/npc.js      boneco da fase livre: passeia, se assusta, foge e cai com socos
js/entities/projectile.js  bola de energia, livro e livros do super
js/supers.js            os supers de cada lutador e o raio do Encapuzado
js/entities/strike.js   golpes que caem num ponto: pico de gelo, raios, ecos e acertos garantidos;
                        rastro do teleporte e a onda da Nevasca
js/entities/forge.js    golpes do Soldador: chama do maçarico, portão de ferro (barreira) e a jaula
js/entities/powers.js   poderes dos lutadores novos: kunai, corvos da Revoada, bolha do tempo,
                        rastro do Rebobinar, tempo parado, buraco negro, estrela e Supernova,
                        e os golpes dos domínios novos (corvo, ponteiro, meteoro)
js/entities/powers2.js  Marionete e Pavio: fio, Puxão, Espetáculo, bomba, explosão, bomba-relógio,
                        Barril de Pólvora e os golpes dos domínios deles (cruz, fio, mina, estouro)
js/domains.js           Expansão de Domínio: cenários, bônus, ecos, acerto garantido e embate
js/modes.js             regras dos modos Equipes 3x3, Caos e Desafios
js/ai.js                CPU e boneco do treino
js/scene.js             fase, entidades, câmera, paralaxe, pose do super, zonas de ataque, golpes,
                        câmera lenta de cada entidade e o tempo parado
js/fight.js             rounds, relógio, K.O., tempo, câmera lenta, vitórias, treino
js/hud.js               vida, tontura, barra de 2 níveis, retratos, vitórias, relógio, combos,
                        faixa do super/domínio, tempo do domínio, barra do embate, rostinhos da
                        equipe e a regra do Caos
js/touch.js             direcional analógico e botões de toque (com vibração)
js/ui.js                avisos, dicas, selo e combo da fase livre, info do treino, aviso de foco
js/menu.js              menu, tela VS e painéis (resultado, pausa)
js/app.js               telas, modos, recordes e laço principal
js/main.js              carrega as imagens e inicia
assets/sprites/         player.png (Garoto), hood.png (Encapuzado), brasa.png (Brasa), npc.png (Óculos),
                        gelida.png (Gélida), trovao.png (Trovão), welder.png (Soldador),
                        corvo.png (Corvo), ampulheta.png (Ampulheta), orbita.png (Órbita),
                        marionete.png (Marionete) e pavio.png (Pavio)
assets/tiles/           grama, terra, telhado, tijolos, assoalho, vigas, pedra, areia, metal,
                        caixas e decoração (16×16)
assets/backgrounds/     sky.png (original), city, dojo, bamboo, desert e observ (_far e _mid)
assets/domains/         os 12 cenários de domínio, em 3 camadas cada (fundo, meio e chão)
```

## Fluidez

- A física roda em passos fixos de 1/120 s e a tela mistura o passo anterior com o atual
  (interpolação): o movimento fica liso em monitores de 60, 75, 120 ou 144 Hz.
- O céu fica num canvas separado; o terreno parado é pintado uma vez numa imagem e copiado
  a cada quadro. O HUD só mexe no HTML quando algum número muda.
- O dash vira golpe ou especial direto, sem parar.
- Os golpes não deixam rastro colorido nem o dash deixa "fantasmas": o que aparece na tela é o
  próprio golpe (faíscas e tremida só no acerto).

## Como estender

**Novo lutador**: monte o sprite sheet, registre em `js/assets.js`, descreva as animações em
`js/sprites.js` (parado, andar, pulo, guarda, defesa, agachado, apanhar, voar, caído, levantar,
tonto, vitória, golpes, `grab` e `superPose`) e crie a entrada em `js/characters.js`
(`combo`, `airAttack`, `special`, `super`, `portrait`, `quotes`), acrescentando a chave em
`Game.characterOrder`. O Brasa é um bom exemplo de lutador novo feito a partir de outra folha;
a Gélida e o Trovão, de lutadores com golpes próprios (`dive`, `release`, `teleport`, `special2`).
Para ele ter domínio, crie a entrada em `Game.DOMAINS` (`js/domains.js`) com as três imagens.

**Novo golpe**: animação em `js/sprites.js` com `hit` (`frame`, área `x/y/w/h` relativa aos pés,
`damage`, `knockback`, `heavy`, `launch`, `special`, `sweep` + `lastFrame`) e `lunge`.

**Novo super**: um roteiro em `Game.Supers` (`js/supers.js`) e o nome dele em `super` do lutador.

**Novo mapa**: um mapa em `js/levels/arena.js` (`Game.levels`), uma entrada em `Game.stages`
com as camadas (`layers`: imagem, `factor` de paralaxe) e a cor de fundo, e a chave em
`Game.stageOrder`. Tiles novos vão em `js/tiles.js`.

**Ajuste fino**: vida, tempo, barra (níveis e quanto enche), agarrão, gelo, tontura, pulo e dash
em `config.fight`; duração, bônus e acerto garantido do domínio em `config.domain`; pico de gelo,
teleporte e raio em `config.iceSpike`, `config.teleport` e `config.bolt`; a CPU por dificuldade em
`config.cpu`; teclas em `config.keys` e `config.keysVersus`.

## Sobre as imagens

- **Garoto** (`player.png`): os 16 quadros da folha original e, desenhados a partir dele:
  respiração, jab, direto, apanhando, caído, agachado e guarda respirando (27).
- **Encapuzado** (`hood.png`): folhas de andar e de luta na mesma escala e paleta; apanhando,
  caído e agachado feitos a partir dos próprios quadros.
- **Brasa** (`brasa.png`): a folha do Encapuzado recolorida quadro a quadro — o roxo vira
  vermelho e a energia vira fogo (laranja e amarelo); a pele foi preservada.
- **Óculos** (`npc.png`): as 3 folhas enviadas, sem fundo e com contorno de 1 px. As poses de
  ataque vieram das próprias folhas dele; o soco esticado é o quadro 46 com o braço desenhado.
- **Gélida** e **Trovão** (`gelida.png`, `trovao.png`): criados do zero, no mesmo tamanho de
  quadro (38×36), altura e contorno de 1 px do Encapuzado, com 46 quadros cada (parado, guarda,
  andar, pulo, defesa, agachar, apanhar, voar, caído, levantar, tonto, vitória, golpes, golpes
  próprios, agarrão, pose do super e o sinal de mão do domínio). Foram montados por código, pose
  a pose, com luz vindo do alto à esquerda.
- **Soldador** (`welder.png`): é a folha do Óculos com o mínimo de mudanças, para continuar
  sendo ele: máscara de solda de ferro levantada na cabeça (abaixa sobre o rosto no maçarico),
  luvas de couro, a garrafinha de tampa vermelha no bolso da mochila e os cachos atrás da
  cabeça, inspirados na foto. Os quadros 49 a 51 são novos (máscara abaixada e maçarico).
- **Corvo** (`corvo.png`): o personagem da imagem enviada. A imagem era pixel art ampliada 3×
  (cada pixel da arte ocupava 3×3), com 20 quadros quase iguais da mesma pose de andar. A cabeça
  (cabelo branco espetado, olho vermelho com a marca embaixo e a máscara preta) foi copiada
  pixel a pixel da arte original, na resolução nativa e na paleta dela; o corpo (casaco preto
  comprido com forro, punhos e zíper vermelhos, calça e botas) foi montado no mesmo rig da
  Gélida, em quadros de 60×52, para ter as 65 poses de luta. É o maior lutador do jogo (47 px de
  altura), do tamanho da arte original. O forro vermelho do casaco aparece quando ele chuta.
- **Ampulheta** e **Órbita** (`ampulheta.png`, `orbita.png`): criados do zero no rig, em 38×36,
  como a Gélida e o Trovão (48 e 50 quadros), com poses próprias (arremesso da ampulheta,
  rebobinar, estalo do tempo, flutuar, buraco negro, antigravidade e a estrela).
- **Marionete** e **Pavio** (`marionete.png`, `pavio.png`): criados do zero no mesmo rig, em
  38×36 (52 e 50 quadros). A Marionete tem rosto de boneca de porcelana (bochecha rosada, olho
  escuro com uma lágrima vermelha), coque preto com laço vermelho, gola de renda branca, casaco
  vermelho com botões dourados e fios brancos saindo dos dedos; o Pavio tem capacete amarelo com
  óculos de proteção, colete laranja refletivo, macacão azul-marinho, luvas de couro e uma bomba
  de pavio aceso na mão. Poses próprias: lançar o fio, puxar, trocar os fios, reger o
  Espetáculo, jogar a bomba, grudar a bomba-relógio e chutar o barril.
- **Sombra**: o jogo escurece a folha do lutador e desenha um contorno roxo, na hora (no domínio
  da Sombra, o cenário inteiro afunda em roxo).
- **Domínios**: os 12 cenários foram desenhados por código em pixel art, em três camadas com
  paralaxe; neve, aurora, chuva, relâmpagos, brasas, páginas, confete, holofotes, faíscas,
  clarões de solda, pétalas, poeira e explosões ao longe são animados pelo jogo.
- **Mapas novos** (Cidade, Dojo, Bambuzal, Deserto e Observatório) e os tiles de telhado,
  tijolo, assoalho, pedra, areia, metal e decoração foram
  desenhados pixel a pixel por código, no mesmo estilo e tamanho de pixel dos personagens.
- **Fundo do Campo**: a imagem original, parada, recortada para 16:9 sem distorcer. Ao
  entardecer e à noite o jogo só muda a cor por cima (e acende estrelas).
