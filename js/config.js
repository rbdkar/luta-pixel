/*
 * Configurações centrais do jogo.
 * Medidas em "pixels do jogo" (1 pixel de arte), tempos em segundos.
 */
window.Game = window.Game || {};

Game.config = {
  tileSize: 16,

  // Área visível: 16:9 com altura próxima de view.height pixels do jogo.
  // pixelPerfect = true usa só escalas inteiras (pixels todos do mesmo tamanho).
  view: {
    height: 270,         // modo treino (fase de plataforma)
    fightHeight: 160,    // luta: câmera mais perto, lutadores maiores
    aspect: 16 / 9,
    pixelPerfect: true,
  },

  physics: {
    gravity: 1300,       // px/s²
    maxFallSpeed: 420,   // px/s
    fixedStep: 1 / 120,  // passo fixo da física (a tela é interpolada entre passos)
  },

  // Movimento no modo treino (plataforma) e base dos golpes
  player: {
    hitbox: { w: 12, h: 26 },
    maxSpeed: 100,
    groundAccel: 900,
    groundDecel: 1300,
    airAccel: 650,
    airDecel: 350,
    turnBoost: 1.7,
    jumpSpeed: 400,
    jumpCutGravity: 2.6,
    fallGravity: 1.25,
    coyoteTime: 0.1,
    jumpBuffer: 0.12,
    punchBuffer: 0.18,   // soco apertado durante outro golpe entra na fila
    comboWindow: 0.35,   // tempo após um golpe para o próximo continuar o combo
    crossLunge: 70,
  },

  // Modo luta (estilo Street Fighter)
  fight: {
    maxHp: 100,
    roundTime: 60,
    roundsToWin: 2,
    walkForward: 88,
    walkBack: 66,
    jump: { vy: 370, vxForward: 100, vxBack: 90 }, // arco fixo, sem controle no ar
    dash: { speed: 240, time: 0.17, doubleTap: 0.22, cooldown: 0.25 },
    blockstun: 0.2,
    chip: 0.2,              // fração do dano de especiais que passa pela defesa
    hitstun: { light: 0.3, heavy: 0.45 },
    pushback: { hit: 95, block: 120 },
    stun: { max: 100, perHit: 16, decayPerSec: 14, dizzyTime: 2.2 },
    downTime: 0.85,         // tempo caído antes de levantar
    crouchHeight: 13,       // agachado a bola pequena e o livro passam por cima
    startGap: 120,          // distância inicial entre os lutadores
    screenMargin: 10,       // os dois sempre cabem na tela
    floorLine: 0.86,        // altura do chão na tela (fração da altura visível)
    koSlowmo: { scale: 0.3, time: 0.9 },
    hitStop: { light: 0.05, heavy: 0.075, block: 0.035, multi: 0.02 },
    // Barra de super com 2 níveis: 1 nível (100) solta o super, os 2 cheios (200) a
    // Expansão de Domínio. Quanto enche por ponto de dano dado/recebido e por defesa.
    meter: { max: 200, superCost: 100, domainCost: 200, dealt: 1.0, taken: 0.65, blocked: 2.5, blocking: 1.5, special: 3 },
    superFreeze: 0.62,
    // Congelado (Gélida): apertar botões quebra o gelo mais rápido; golpe em quem está
    // congelado estilhaça o gelo e tira um pouco mais
    freeze: { mashCut: 0.07, shatterBonus: 3 },
    // Agarrão: → + soco colado no adversário (← + soco joga para trás)
    grab: { range: 22, techWindow: 0.25, damage: 12 },
  },

  // Expansão de Domínio (js/domains.js): o lutador cria um cenário onde fica mais forte
  domain: {
    duration: 10,        // segundos de domínio
    cinematic: 1.2,      // pose do sinal de mão (tudo parado)
    reveal: 0.45,        // o cenário se abre a partir do lutador
    breakTime: 0.55,     // o cenário se desfaz
    damage: 1.25,        // golpes de quem expandiu tiram mais
    ownerSpeed: 1.1,     // quem expandiu anda mais rápido...
    foeSpeed: 0.85,      // ...e o adversário, mais devagar
    sureFirst: 1.1,      // acerto garantido: o primeiro sai depois desse tempo
    sureEvery: 2.5,      // e depois a cada tantos segundos
    sureWarn: 0.4,       // a mira aparece antes do golpe
    sureDamage: 4,
    clashTime: 2.4,      // embate de domínios: tempo para apertar soco
  },

  // Inteligência da CPU por dificuldade
  // Marionete: o Fio (K) prende o adversário; K de novo puxa (Puxão)
  thread: {
    speed: 360,
    range: 150,       // até onde o fio vai
    attachTime: 3.2,  // segundos preso
    maxDist: 240,     // mais longe que isso o fio arrebenta
    cooldown: 0.85,
    hit: { damage: 3, knockback: 30, special: true },
    yank: { damage: 3, stun: 0.46, cooldown: 0.45, domainCooldown: 0.6 },
  },
  // Fios Trocados (↓ + K): de perto, ou a qualquer distância pelo fio preso
  tangle: {
    range: 44,
    invert: 2.6,      // segundos com esquerda e direita trocadas
    cooldown: 3.6,
    hit: { damage: 4, knockback: 60, special: true },
  },
  // Espetáculo (super da Marionete)
  // a cruz segue o adversário por "track" s e desce até "warn" s: dá para sair de baixo (dash ou pulo)
  puppet: { warn: 0.52, track: 0.14, width: 22, dance: 1.45, tickEvery: 0.24, ticks: 6, tickDamage: 2, finalDamage: 12 },
  // Pavio: bomba em arco (← perto, → longe)
  bomb: {
    vx: 140, vxNear: 85, vxFar: 205, vy: 250,
    vxMin: 40, flight: 0.86, // sem direção: velocidade para cair em cima do adversário (tempo de voo)
    gravity: 640, bounce: 0.42, fuse: 1.05, cooldown: 1.15,
    pointBlank: 14, // adversário colado: a bomba vai direto nele
    radius: 22, miniRadius: 11,
    hit: { damage: 9, knockback: 150, heavy: true, special: true, launch: true, breakPower: 2 },
    miniHit: { damage: 3, knockback: 80, special: true, stop: 'multi' },
  },
  // Bomba-relógio (↓ + K): gruda e conta; quem está com ela passa acertando um golpe
  timebomb: {
    reach: 30, fuse: 3.4, domainFuse: 2.4, minPass: 0.75, cooldown: 5.5, radius: 20,
    // presa com fita: logo depois de grudar (ou de passar) a bomba não troca de dono
    plantLock: 1.5, passLock: 0.5,
    selfScale: 0.5, // de capacete, o Pavio leva só metade da própria bomba
    // o tapa que gruda a bomba empurra o adversário (abre espaço para o Pavio)
    slap: { damage: 2, knockback: 170, shove: 190, stun: 0.36, unblockable: true, special: true, stop: 'light' },
    hit: { damage: 17, knockback: 170, heavy: true, special: true, launch: true, unblockable: true },
    floorHit: { damage: 11, knockback: 160, heavy: true, special: true, launch: true },
  },
  // Barril de Pólvora (super do Pavio)
  barrel: {
    speed: 150, life: 4, radius: 30,
    hit: { damage: 24, knockback: 180, heavy: true, super: true, launch: true, breakPower: 3 },
  },
  // Ademoir: Raiz de Corte (K) corre por baixo da terra até o adversário e faz duas curvas:
  // a 1ª sobe por baixo (defende agachado) e a 2ª desce de cima (defende em pé), mais forte
  root: {
    speed: 190, range: 170, cooldown: 1.3,
    curveGap: 0.2, // tempo entre as curvas
    hit1: { damage: 3, knockback: 24, special: true, low: true, stun: 0.34, stop: 'light' },
    hit2: { damage: 7, knockback: 150, heavy: true, special: true, high: true, launch: true },
    hit3: { damage: 5, knockback: 120, heavy: true, special: true, launch: true }, // 3ª curva (só no domínio)
  },
  // Armadura de Carvalho Sagrado (↓ + K): aguenta golpes sem recuar e leva metade do dano
  // Armadura de Carvalho Sagrado: o cajado vira uma armadura no corpo todo (forma maior, sem o cajado)
  armor: {
    time: 8,          // segundos na forma (dentro da Nova Floresta ela não acaba pelo tempo)
    toughness: 30,    // quanto dano a casca aguenta antes de quebrar
    defense: 0.75,    // dano recebido na forma (25% a menos)
    power: 1.2,       // dano dos golpes na forma (20% a mais)
    cooldown: 7,      // espera para vestir de novo depois que ela sai
    forestRegen: 3,   // na Nova Floresta a casca se refaz (pontos por segundo)
  },
  // Fúria do Carvalho (super): investida com o cajado; acertando, três golpes e o carvalho brota
  oak: {
    dashSpeed: 290, dashTime: 0.3,
    hits: [
      { damage: 3, knockback: 30, super: true, stop: 'multi' },
      { damage: 4, knockback: 30, super: true, stop: 'multi' },
      { damage: 5, knockback: 30, super: true, stop: 'multi' },
    ],
    root: { damage: 12, knockback: 160, heavy: true, super: true, launch: true, breakPower: 3 },
  },
  // Dama: Peão em Marcha (K) anda casa a casa; captura na diagonal quem estiver na casa da frente
  // e, se chegar ao fim do caminho (ou na parede), é promovido a dama, que avança no adversário
  pawn: {
    square: 16,        // tamanho da casa (px)
    rise: 0.16,        // o peão brota do chão
    stepTime: 0.44,    // espera entre um passo e outro
    firstLook: 0.05,   // depois de brotar, espera só isso para o primeiro passo (ou a captura)
    hopTime: 0.14,     // duração do pulinho de uma casa
    promoteAt: 6,      // casas andadas até a promoção
    cooldown: 1.0,
    capture: { damage: 10, knockback: 110, heavy: true, special: true, launch: true },
    queenWarn: 0.4,    // a dama brilha antes de avançar
    queenSpeed: 330, queenRange: 300,
    queen: { damage: 12, knockback: 180, heavy: true, special: true, launch: true, breakPower: 2 },
  },
  // Salto do Cavalo (↓ + K): sobe duas casas, atravessa por cima e desce pisando na casa marcada
  // atrás do adversário (segurando para trás, salta três casas para trás e foge). No ar não leva
  // golpe (o cavalo pula por cima das peças); o pisão é que pode ser defendido, em pé e do lado certo
  knight: {
    crouch: 0.08, height: 40, riseSpeed: 430, crossSpeed: 320, dropSpeed: 540,
    range: 124,        // até onde ela alcança o adversário para pousar atrás dele
    behind: 17,        // quantos px atrás do adversário fica a casa
    back: 52,          // segurando para trás: casas para trás
    cooldown: 1.8, domainCooldown: 0.3,
    stomp: { damage: 10, knockback: 140, heavy: true, special: true, high: true, launch: true },
    whiff: 0.08,       // tempo vulnerável a mais quando o pisão não acerta ninguém
  },
  // XEQUE-MATE (super): a fileira de casas corre pelo chão; acertando ("xeque"), torre, bispo e
  // cavalo caem no adversário e a dama gigante fecha o mate
  checkmate: {
    lineSpeed: 430, lineRange: 230,
    check: { damage: 3, knockback: 0, super: true, stop: 'multi' },
    pieces: { damage: 4, knockback: 0, super: true, stop: 'multi' },
    mate: { damage: 11, knockback: 190, heavy: true, super: true, launch: true, breakPower: 3 },
  },
  // Tabuleiro Infinito (domínio da Dama): ficar parado é Zugzwang (obrigado a se mexer, ou apanha)
  zugzwang: { still: 1.2, every: 1.0, hit: { damage: 3, knockback: 50, special: true, unblockable: true, echo: true, stop: 'multi' } },

  cpu: {
    easy:   { think: 0.34, block: 0.22, aggro: 0.35, antiAir: 0.15, special: 0.12, react: 0.32, combo: 0.35 },
    normal: { think: 0.22, block: 0.48, aggro: 0.55, antiAir: 0.4,  special: 0.22, react: 0.2,  combo: 0.65 },
    hard:   { think: 0.12, block: 0.72, aggro: 0.7,  antiAir: 0.7,  special: 0.3,  react: 0.12, combo: 0.9 },
  },

  camera: {
    followSpeed: 8,
    groundLine: 0.65,
    margin: 28,
  },

  // Teclas por ação (valores de KeyboardEvent.code)
  keys: {
    left: ['KeyA', 'ArrowLeft'],
    right: ['KeyD', 'ArrowRight'],
    up: ['KeyW', 'ArrowUp'],
    down: ['KeyS', 'ArrowDown'],
    jump: ['Space', 'KeyW', 'ArrowUp'],
    punch: ['KeyJ', 'KeyX'],
    special: ['KeyK', 'KeyC'],
    super: ['KeyL', 'KeyV'],
    domain: ['KeyI', 'KeyB'],
    switch: ['KeyQ'],
    mute: ['KeyM'],
    help: ['KeyH'],
    pause: ['Escape', 'KeyP'],
    confirm: ['Enter', 'NumpadEnter', 'Space', 'KeyJ', 'KeyX'], // menus
    hitboxes: ['KeyN'],   // treino: mostra as zonas de ataque
  },

  // Versus no mesmo teclado: cada jogador com um lado do teclado
  keysVersus: {
    p1: {
      left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'], jump: ['KeyW', 'Space'],
      punch: ['KeyF'], special: ['KeyG'], super: ['KeyH'], domain: ['KeyT'],
    },
    p2: {
      left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'], jump: ['ArrowUp'],
      punch: ['KeyK', 'Numpad1', 'Comma'], special: ['KeyL', 'Numpad2', 'Period'], super: ['Semicolon', 'Numpad3', 'Slash'],
      domain: ['KeyO', 'Numpad0', 'Quote'],
    },
  },

  // Bola de energia do Encapuzado
  energyBall: {
    speed: 210,
    life: 1.4,
    chargeTime: 0.45,    // segurando o especial por esse tempo, sai a bola grande
    maxCharge: 1.4,
    cooldown: 0.35,
    small: { radius: 3, damage: 7, knockback: 140, heavy: true, special: true },
    big: { radius: 5, damage: 12, knockback: 200, heavy: true, launch: true, special: true, breakPower: 2 },
  },

  // Livro do Óculos
  book: {
    speed: 190,
    life: 1.6,
    cooldown: 0.75,
    size: { w: 7, h: 5 },
    hit: { damage: 9, knockback: 120, heavy: true, special: true },
  },

  // Investida do Garoto
  dash: {
    speed: 280,
    cooldown: 0.45,
  },

  // Gancho ascendente do Brasa
  rise: {
    cooldown: 0.5,
    landLag: 0.24,   // ao cair fica vulnerável por esse tempo
  },

  // Pico de Gelo da Gélida: brota embaixo do adversário (até "range" à frente)
  iceSpike: {
    range: 165,
    warn: 0.22,      // tempo do aviso no chão antes de brotar
    cooldown: 0.8,
    freeze: 0.85,    // segundos congelado
    hit: { damage: 10, knockback: 60, heavy: true, special: true },
  },

  // Passo Relâmpago do Trovão
  teleport: {
    near: 140,       // adversário até essa distância: reaparece atrás dele
    forward: 80,     // senão anda essa distância (para trás se estiver segurando para trás)
    cooldown: 0.5,
  },

  // Maçarico do Soldador: chama curta que acerta várias vezes (no domínio vai mais longe e solda os pés)
  torch: {
    range: 38,
    domainRange: 60,
    cooldown: 0.8,
    root: 1.0,       // segundos com os pés soldados no chão (só no domínio)
  },

  // Portão de Ferro do Soldador: cai à frente e fica de pé como barreira
  gate: {
    distance: 44,
    life: 2.6,
    cooldown: 1.3,
    width: 12,
    height: 34,      // dá para passar pulando, se acertar o tempo
    hit: { damage: 8, knockback: 150, heavy: true, launch: true, special: true },
  },

  // Raio Celeste do Trovão: cai em cima do adversário (se ele estiver no chão entre near e far
  // à frente); senão, a "distance" pixels à frente
  bolt: {
    distance: 92,
    near: 34,
    far: 140,
    warn: 0.14,      // aviso antes do raio cair (dá para escapar andando)
    cooldown: 0.85,
    hit: { damage: 13, knockback: 140, heavy: true, launch: true, special: true },
  },

  // ---------------- Corvo ----------------
  // Kunai Rubra: o especial dele enquanto o olho não copiou nada
  kunai: {
    speed: 270,
    life: 1.2,
    cooldown: 0.85,
    hit: { damage: 5, knockback: 90, special: true },
  },
  // Leitura: postura de contra-ataque; acertado nela, some e reaparece atrás de quem bateu
  counter: {
    cooldown: 1.6,
    reach: 210,      // até essa distância ele reaparece atrás de quem bateu (projétil de longe também)
  },

  // ---------------- Ampulheta ----------------
  // Bolha do Tempo: a ampulheta voa um pouco e vira uma bolha; dentro dela o tempo do adversário anda devagar
  bubble: {
    speed: 160,
    travel: 0.5,     // segundos voando antes de abrir sozinha
    cooldown: 4.0,
    radius: 28,
    domainRadius: 44,
    life: 1.7,
    domainLife: 3.0,
    scale: 0.78,     // velocidade do tempo dentro da bolha
    hits: 2,         // golpes da Ampulheta em quem está lá dentro até a bolha estourar
    domainHits: 5,
    hit: { damage: 2, knockback: 60, special: true },
  },
  // Rebobinar: volta "back" segundos no tempo e recupera até maxHeal de vida perdida nesse intervalo
  rewind: {
    back: 1.2,
    maxHeal: 10,
    cooldown: 8,
    domainCooldown: 1.5,
  },
  // Parada do Tempo (super): só ela se mexe; o dano dado fica guardado e cai de uma vez quando o tempo volta
  timestop: {
    duration: 1.5,
    maxDebt: 22,
  },

  // ---------------- Órbita ----------------
  // Buraco Negro: abre à frente e puxa o adversário (e engole projéteis)
  blackhole: {
    distance: 64,
    radius: 92,       // alcance da puxada
    domainRadius: 140,
    life: 1.8,
    domainLife: 2.6,
    pull: 55,         // px/s na borda
    pullCore: 85,     // a mais perto do miolo
    cooldown: 1.6,
    tickEvery: 0.42,  // entre um pulso e outro dá para pular ou defender
    tickHit: { damage: 1, knockback: 0, special: true, stop: 'multi' },
    finalHit: { damage: 7, knockback: 130, heavy: true, special: true },
  },
  // Antigravidade: o chão embaixo do adversário brilha e ele flutua sem controle; depois despenca
  antigrav: {
    range: 150,
    warn: 0.3,
    cooldown: 1.7,
    float: 1.0,
    domainFloat: 1.5,
    slam: 7,          // dano ao cair de volta no chão
    hit: { damage: 3, knockback: 0, special: true },
  },
  // Planar: segurando o pulo no ar o Órbita cai devagar
  glide: { gravity: 0.18, maxFall: 55, airSpeed: 70 },

  effects: {
    hitStop: 0.06,
    shakeTime: 0.12,
    shakePower: 1,
  },

  // Bonecos de treino (modo treino)
  npc: {
    hitbox: { w: 14, h: 30 },
    maxHp: 3,              // golpes até ser nocauteado
    recoverDelay: 2.5,
    walkSpeed: 30,
    fleeSpeed: 58,
    accel: 400,
    groundFriction: 420,
    noticeRange: 60,
    alertTime: 0.45,
    alertCooldown: 2.5,
    idleTime: [0.8, 2.2],
    walkTime: [1.2, 3.2],
    fleeTime: [1.4, 2.2],
    launch: { vx: 140, vy: 300 },
    flashTime: 0.04,
  },
};
