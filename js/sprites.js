/*
 * Definição dos sprite sheets: tamanho dos quadros, ponto de apoio e animações.
 * Os quadros ficam lado a lado no PNG; o índice conta da esquerda para a direita
 * a partir de 0. Cada animação usa "fps" (mesmo tempo para todos os quadros) ou
 * "durations" (segundos por quadro). loop: false para no último quadro.
 *
 * Golpes têm "hit": em qual quadro acerta e a área (x, y, w, h em pixels relativos
 * aos pés, olhando para a direita; é espelhada para a esquerda).
 *   damage    pontos de vida tirados no modo luta (vida cheia = 100)
 *   knockback empurrão em quem apanha (px/s)
 *   heavy     usa a reação forte          launch  derruba
 *   special   tira um pouco mesmo defendido ("chip")
 *   sweep     fica ativo do quadro "frame" até "lastFrame" (investida, golpes aéreos)
 *   breakPower  dano em caixas (padrão 1)
 * lunge: avanço ao começar o golpe (px/s). grab: animação do agarrão.
 * Os supers ficam em js/supers.js (são programados, não só animações).
 */
window.Game = window.Game || {};

Game.sprites = {
  // ---------------- Garoto ----------------
  player: {
    image: 'player',
    frameWidth: 40,
    frameHeight: 32,
    anchor: { x: 20, y: 32 },
    // 0–15 folha original · 16 respiração · 17–19 jab · 20–22 direto
    // 23–24 apanhando (tronco para trás) · 25 caído · 26 agachado · 27 guarda respirando
    // 28 chute (preparação) · 29 chute esticado · 30 rasteira · 31 chute aéreo (pernas redesenhadas)
    animations: {
      idle: { frames: [0, 16], fps: 1.6 },
      stance: { frames: [17, 27], fps: 2.2 },
      walk: { frames: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11], fps: 13 },
      jump: { frames: [4], fps: 1 },
      fall: { frames: [8], fps: 1 },
      block: { frames: [17], fps: 1 },
      crouch: { frames: [26], fps: 1 },
      hurt: { frames: [23], fps: 1 },
      hurtHeavy: { frames: [24], fps: 1 },
      knockFly: { frames: [24], fps: 1 },
      lie: { frames: [25], fps: 1 },
      getup: { frames: [26, 0], durations: [0.22, 0.12], loop: false },
      dizzy: { frames: [23, 24], fps: 3 },
      win: { frames: [18, 17], durations: [0.5, 0.35] },
      jab: {
        frames: [17, 18, 19], durations: [0.05, 0.09, 0.1], loop: false,
        hit: { frame: 1, x: 2, y: -18, w: 18, h: 13, damage: 5, knockback: 70 },
      },
      cross: {
        frames: [20, 21, 22], durations: [0.06, 0.1, 0.11], loop: false, lunge: 70,
        hit: { frame: 1, x: 2, y: -18, w: 20, h: 13, damage: 8, knockback: 120, heavy: true },
      },
      airJab: {
        frames: [18, 19], durations: [0.14, 0.2], loop: false,
        hit: { frame: 0, lastFrame: 1, sweep: true, x: 0, y: -22, w: 19, h: 22, damage: 6, knockback: 90 },
      },
      kick: {
        frames: [28, 29, 29, 28], durations: [0.06, 0.08, 0.1, 0.12], loop: false, lunge: 100,
        hit: { frame: 1, x: 2, y: -16, w: 19, h: 12, damage: 10, knockback: 160, heavy: true, launch: true },
      },
      airKick: {
        frames: [28, 31], durations: [0.1, 0.24], loop: false,
        hit: { frame: 0, lastFrame: 1, sweep: true, x: 0, y: -20, w: 19, h: 20, damage: 7, knockback: 110, heavy: true },
      },
      sweep: {
        frames: [26, 30, 30, 26], durations: [0.07, 0.07, 0.1, 0.16], loop: false,
        hit: { frame: 1, x: 0, y: -9, w: 21, h: 9, damage: 8, knockback: 110, heavy: true, launch: true, trip: true, low: true },
      },
      dash: {
        frames: [20, 21, 22], durations: [0.05, 0.2, 0.24], loop: false,
        dash: { frame: 1 },
        hit: { frame: 1, sweep: true, x: 0, y: -20, w: 21, h: 17, damage: 13, knockback: 170, heavy: true, launch: true, special: true },
      },
      grab: { frames: [20, 21], durations: [0.08, 0.3], loop: false },
      flurry: { frames: [18, 19, 21, 22], fps: 22 },
      superPose: { frames: [17], fps: 1 },
      domain: { frames: [17], fps: 1 },
    },
  },

  // ---------------- Encapuzado ----------------
  hood: {
    image: 'hood',
    frameWidth: 38,
    frameHeight: 36,
    anchor: { x: 19, y: 36 },
    // 0–1 parado · 2–25 andar · 26–27 pulo · 28–29 guarda · 30–43 golpes e aura
    // 44–45 apanhando · 46 caído · 47 agachado (quadro 10 da folha de luta) · 48 rasteira
    animations: {
      idle: { frames: [0, 1], fps: 1.6 },
      walk: { frames: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25], fps: 20 },
      jump: { frames: [26], fps: 1 },
      fall: { frames: [27], fps: 1 },
      stance: { frames: [28, 29], fps: 2.2 },
      block: { frames: [28], fps: 1 },
      crouch: { frames: [47], fps: 1 },
      hurt: { frames: [44], fps: 1 },
      hurtHeavy: { frames: [45], fps: 1 },
      knockFly: { frames: [45], fps: 1 },
      lie: { frames: [46], fps: 1 },
      getup: { frames: [47, 28], durations: [0.22, 0.12], loop: false },
      dizzy: { frames: [44, 45], fps: 3 },
      win: { frames: [43, 28], durations: [0.6, 0.4] },
      jab: {
        frames: [30, 31, 32], durations: [0.05, 0.09, 0.1], loop: false,
        hit: { frame: 1, x: 2, y: -24, w: 19, h: 13, damage: 5, knockback: 70 },
      },
      cross: {
        frames: [33, 34, 35], durations: [0.06, 0.11, 0.12], loop: false,
        hit: { frame: 1, x: 1, y: -28, w: 20, h: 19, damage: 7, knockback: 120, heavy: true },
      },
      kick: {
        frames: [36, 37, 38, 39], durations: [0.06, 0.08, 0.13, 0.12], loop: false, lunge: 110,
        hit: { frame: 1, x: 1, y: -29, w: 19, h: 26, damage: 11, knockback: 160, heavy: true, launch: true },
      },
      airKick: {
        frames: [37, 38], durations: [0.12, 0.2], loop: false,
        hit: { frame: 0, lastFrame: 1, sweep: true, x: 0, y: -25, w: 19, h: 26, damage: 8, knockback: 130, heavy: true },
      },
      sweep: {
        frames: [47, 48, 48, 47], durations: [0.07, 0.07, 0.1, 0.16], loop: false,
        hit: { frame: 1, x: 0, y: -9, w: 22, h: 9, damage: 8, knockback: 110, heavy: true, launch: true, trip: true, low: true },
      },
      charge: { frames: [40], fps: 1 },
      charged: { frames: [41, 40], fps: 14 },
      fire: { frames: [42], durations: [0.22], loop: false, muzzle: { x: 16, y: -17 } },
      aura: { frames: [43], durations: [0.45], loop: false },
      grab: { frames: [33, 34], durations: [0.08, 0.3], loop: false },
      superPose: { frames: [41, 40], fps: 14 },
      beam: { frames: [42], fps: 1 },
      domain: { frames: [43], fps: 1 },
    },
  },

  // ---------------- Óculos ----------------
  npc: {
    image: 'npc',
    frameWidth: 50,
    frameHeight: 43,
    anchor: { x: 25, y: 43 },
    // 0–43 folhas enviadas (andar, apanhar, nocaute) · 44 defesa · 45 guarda
    // 46 soco curto · 47 soco esticado (braço desenhado sobre o 46) · 48 guarda respirando
    // 49 chute (preparação) · 50 chute esticado · 51 rasteira · 52 chute aéreo (pernas redesenhadas)
    animations: {
      idle: { frames: [0, 1], fps: 1.5 },
      stance: { frames: [45, 48], fps: 2 },
      walk: { frames: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11], fps: 10 },
      jump: { frames: [12], fps: 1 },
      fall: { frames: [5], fps: 1 },
      alert: { frames: [12], fps: 1 },
      block: { frames: [44], fps: 1 },
      crouch: { frames: [41], fps: 1 },
      hurtLight: { frames: [13, 14], durations: [0.12, 0.22], loop: false },
      hurt: { frames: [13, 14], durations: [0.12, 0.22], loop: false },
      hurtHeavy: {
        frames: [15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25],
        durations: [0.14, 0.1, 0.12, 0.14, 0.16, 0.16, 0.12, 0.12, 0.12, 0.12, 0.14],
        loop: false,
      },
      hurtHeavyShort: { frames: [15, 16, 17], durations: [0.14, 0.12, 0.2], loop: false },
      knock: { frames: [26], fps: 1 },
      fly: { frames: [27, 28, 29, 30, 31, 32, 33], fps: 16, loop: false },
      knockFly: { frames: [26, 27, 28, 29, 30, 31, 32, 33], durations: [0.08, 0.06, 0.06, 0.06, 0.06, 0.06, 0.06, 0.06], loop: false },
      land: { frames: [34, 35], durations: [0.1, 0.12], loop: false },
      lie: { frames: [34, 35, 36, 37, 38, 39], durations: [0.1, 0.12, 0.25, 0.25, 0.3, 0.4], loop: false },
      getup: { frames: [40, 41, 42, 43], durations: [0.14, 0.14, 0.14, 0.18], loop: false },
      dizzy: { frames: [18, 19, 20, 19], fps: 4 },
      win: { frames: [47, 46], durations: [0.5, 0.35] },
      jab: {
        frames: [45, 46, 45], durations: [0.05, 0.09, 0.1], loop: false,
        hit: { frame: 1, x: 3, y: -22, w: 17, h: 13, damage: 5, knockback: 70 },
      },
      cross: {
        frames: [44, 47, 46], durations: [0.06, 0.11, 0.12], loop: false, lunge: 50,
        hit: { frame: 1, x: 3, y: -23, w: 22, h: 13, damage: 8, knockback: 120, heavy: true },
      },
      airJab: {
        frames: [47, 46], durations: [0.14, 0.2], loop: false,
        hit: { frame: 0, lastFrame: 1, sweep: true, x: 1, y: -24, w: 20, h: 24, damage: 6, knockback: 90 },
      },
      kick: {
        frames: [49, 50, 50, 49], durations: [0.06, 0.08, 0.11, 0.12], loop: false, lunge: 90,
        hit: { frame: 1, x: 2, y: -17, w: 22, h: 12, damage: 10, knockback: 160, heavy: true, launch: true },
      },
      airKick: {
        frames: [49, 52], durations: [0.1, 0.24], loop: false,
        hit: { frame: 0, lastFrame: 1, sweep: true, x: 0, y: -20, w: 21, h: 20, damage: 7, knockback: 110, heavy: true },
      },
      sweep: {
        frames: [41, 51, 51, 41], durations: [0.07, 0.07, 0.1, 0.16], loop: false,
        hit: { frame: 1, x: 0, y: -9, w: 24, h: 9, damage: 8, knockback: 110, heavy: true, launch: true, trip: true, low: true },
      },
      throw: { frames: [45, 47, 46], durations: [0.12, 0.16, 0.14], loop: false, release: 1, muzzle: { x: 18, y: -18 } },
      toss: { frames: [47, 46], durations: [0.07, 0.07], loop: false },
      grab: { frames: [44, 47], durations: [0.08, 0.3], loop: false },
      superPose: { frames: [45], fps: 1 },
      domain: { frames: [45], fps: 1 },
    },
  },
};

/*
 * Brasa: mesma folha do Encapuzado, recolorida para fogo (assets/sprites/brasa.png),
 * com golpes próprios: gancho ascendente (especial) e o super Inferno.
 */
(function () {
  const hood = Game.sprites.hood;
  const anims = Object.assign({}, hood.animations, {
    jab: {
      frames: [30, 31, 32], durations: [0.05, 0.08, 0.1], loop: false,
      hit: { frame: 1, x: 2, y: -24, w: 19, h: 13, damage: 5, knockback: 70 },
    },
    cross: {
      frames: [33, 34, 35], durations: [0.06, 0.1, 0.12], loop: false, lunge: 40,
      hit: { frame: 1, x: 1, y: -28, w: 20, h: 19, damage: 8, knockback: 120, heavy: true },
    },
    kick: {
      frames: [36, 37, 38, 39], durations: [0.06, 0.08, 0.13, 0.12], loop: false, lunge: 120,
      hit: { frame: 1, x: 1, y: -29, w: 19, h: 26, damage: 10, knockback: 170, heavy: true, launch: true },
    },
    // Chama Ascendente: sobe girando o gancho; invencível no começo; derruba
    rise: {
      frames: [33, 34, 43, 27], durations: [0.04, 0.1, 0.22, 0.6], loop: false, rise: { frame: 1, vy: 360, vx: 55, invuln: 0.16 },
      hit: { frame: 1, lastFrame: 2, sweep: true, x: -2, y: -36, w: 20, h: 36, damage: 12, knockback: 150, heavy: true, launch: true, special: true },
    },
    superPose: { frames: [43], fps: 1 },
    inferno: { frames: [34, 43], fps: 14 },
  });
  Game.sprites.brasa = Object.assign({}, hood, { image: 'brasa', animations: anims });
})();

/*
 * Gélida e Trovão: folhas desenhadas do zero no mesmo tamanho do Encapuzado
 * (quadros de 38×36, pés na linha de baixo). Mesma ordem de quadros nas duas:
 *   0–1 parada · 2–3 guarda · 4–11 andar · 12 pulo · 13 queda · 14 defesa · 15 agachada
 *   16–17 apanhando · 18 voando · 19 caída · 20 levantando · 21–22 tonta · 23–24 vitória
 *   25–27 jab · 28–30 direto/cotovelada · 31–34 chute · 35–40 golpes próprios
 *   41–42 agarrão · 43–44 pose do super · 45 sinal de mão (expansão de domínio)
 * release: quadro em que o golpe solta o efeito (pico de gelo, raio).
 * dive: mergulho no ar (velocidade fixa até tocar o chão).
 * teleport: quadro 1 some, quadro 2 reaparece; cancelInto: o fim do golpe aceita soco.
 */
(function () {
  const base = {
    idle: { frames: [0, 1], fps: 1.6 },
    stance: { frames: [2, 3], fps: 2.2 },
    walk: { frames: [4, 5, 6, 7, 8, 9, 10, 11], fps: 12 },
    jump: { frames: [12], fps: 1 },
    fall: { frames: [13], fps: 1 },
    block: { frames: [14], fps: 1 },
    crouch: { frames: [15], fps: 1 },
    hurt: { frames: [16], fps: 1 },
    hurtHeavy: { frames: [17], fps: 1 },
    knockFly: { frames: [18], fps: 1 },
    lie: { frames: [19], fps: 1 },
    getup: { frames: [20, 2], durations: [0.22, 0.12], loop: false },
    dizzy: { frames: [21, 22], fps: 3 },
    win: { frames: [23, 24], durations: [0.6, 0.4] },
    grab: { frames: [41, 42], durations: [0.08, 0.3], loop: false },
    superPose: { frames: [43, 44], fps: 14 },
    domain: { frames: [45], fps: 1 },
    intro: { frames: [43, 44, 43, 44, 2], durations: [0.08, 0.08, 0.08, 0.08, 0.25], loop: false },
    sweep: {
      frames: [15, 46, 46, 15], durations: [0.07, 0.07, 0.1, 0.16], loop: false,
      hit: { frame: 1, x: 0, y: -9, w: 22, h: 9, damage: 8, knockback: 110, heavy: true, launch: true, trip: true, low: true },
    },
  };
  const sheet = (image, anims) => ({
    image, frameWidth: 38, frameHeight: 36, anchor: { x: 19, y: 36 }, animations: Object.assign({}, base, anims),
  });

  Game.sprites.gelida = sheet('gelida', {
    jab: {
      frames: [25, 26, 27], durations: [0.05, 0.09, 0.1], loop: false,
      hit: { frame: 1, x: 2, y: -24, w: 20, h: 12, damage: 5, knockback: 70 },
    },
    cross: {
      frames: [28, 29, 30], durations: [0.06, 0.1, 0.12], loop: false, lunge: 40,
      hit: { frame: 1, x: 2, y: -24, w: 21, h: 13, damage: 7, knockback: 120, heavy: true },
    },
    kick: {
      frames: [31, 32, 33, 34], durations: [0.06, 0.09, 0.12, 0.12], loop: false, lunge: 100,
      hit: { frame: 1, x: 2, y: -22, w: 21, h: 16, damage: 10, knockback: 160, heavy: true, launch: true },
    },
    // Mergulho Glacial: desce na diagonal com o pé na frente até tocar o chão
    dive: {
      frames: [35, 36], durations: [0.07, 2], loop: false, dive: { frame: 1, vx: 190, vy: 300 },
      hit: { frame: 1, lastFrame: 1, sweep: true, x: -3, y: -16, w: 18, h: 16, damage: 7, knockback: 120, heavy: true },
    },
    // Pico de Gelo: a mão no chão faz o gelo brotar embaixo do adversário
    spikeCast: { frames: [37, 38], durations: [0.11, 0.3], loop: false, release: 1, spike: true },
    blizzard: { frames: [39, 40], durations: [0.1, 0.5], loop: false },
  });

  Game.sprites.trovao = sheet('trovao', {
    jab: {
      frames: [25, 26, 27], durations: [0.05, 0.08, 0.1], loop: false,
      hit: { frame: 1, x: 2, y: -25, w: 21, h: 15, damage: 5, knockback: 70 },
    },
    cross: {
      frames: [28, 29, 30], durations: [0.06, 0.1, 0.11], loop: false, lunge: 60,
      hit: { frame: 1, x: 1, y: -31, w: 19, h: 19, damage: 8, knockback: 120, heavy: true },
    },
    kick: {
      frames: [31, 32, 33, 34], durations: [0.06, 0.08, 0.13, 0.12], loop: false, lunge: 100,
      hit: { frame: 1, x: 2, y: -26, w: 21, h: 16, damage: 10, knockback: 160, heavy: true, launch: true },
    },
    airPunch: {
      frames: [35, 36], durations: [0.1, 0.22], loop: false,
      hit: { frame: 0, lastFrame: 1, sweep: true, x: 0, y: -25, w: 20, h: 19, damage: 8, knockback: 110, heavy: true },
    },
    // Passo Relâmpago: some no quadro 1 e reaparece no 2 (atrás do adversário se ele estiver perto)
    teleport: { frames: [37, 37, 38], durations: [0.07, 0.1, 0.15], loop: false, teleport: true, cancelInto: 2 },
    // Raio Celeste: o raio cai à frente quando a mão desce
    boltCast: { frames: [39, 40], durations: [0.13, 0.3], loop: false, release: 1, bolt: true },
  });
})();

/*
 * Soldador: o próprio Óculos (mesma arte) com óculos de solda na testa, luvas de
 * couro, garrafinha de tampa vermelha na mochila e os cachos atrás da cabeça.
 * Quadros 0–48 iguais aos do Óculos; 49 óculos de solda abaixados (guarda),
 * 50 maçarico esticado, 51 maçarico recolhendo.
 */
(function () {
  const npc = Game.sprites.npc;
  const anims = Object.assign({}, npc.animations, {
    // Maçarico: a chama sai do bico no quadro 1 e fica acesa enquanto ele segura
    torch: { frames: [49, 50, 51], durations: [0.13, 0.36, 0.16], loop: false, release: 1, flame: true },
    // Portão de Ferro: braço para frente, o portão despenca à frente
    gateCall: { frames: [44, 47, 46], durations: [0.1, 0.22, 0.14], loop: false, release: 1, gate: true },
    weldPose: { frames: [49, 50], durations: [0.5, 0.5] },
    // chutes do Óculos com o equipamento (quadros 52–55)
    kick: Object.assign({}, npc.animations.kick, { frames: [52, 53, 53, 52] }),
    airKick: Object.assign({}, npc.animations.airKick, { frames: [52, 55] }),
    sweep: Object.assign({}, npc.animations.sweep, { frames: [41, 54, 54, 41] }),
    superPose: { frames: [49], fps: 1 },
    domain: { frames: [49], fps: 1 },
    intro: { frames: [45, 49, 51, 49, 45], durations: [0.15, 0.18, 0.14, 0.14, 0.2], loop: false },
  });
  Game.sprites.welder = Object.assign({}, npc, { image: 'welder', animations: anims });
})();

/*
 * Corvo: a cabeça (cabelo branco, olho vermelho e máscara) vem pixel a pixel da
 * imagem enviada; o corpo (casaco preto comprido com forro e punhos vermelhos) foi
 * desenhado no rig para ter todas as poses. Quadros de 60×52, pés na linha de baixo:
 *   0–1 parado · 2–3 guarda · 4–11 andar · 12 pulo · 13 queda · 14 defesa · 15 agachado
 *   16–17 apanhando · 18 voando · 19 caído · 20 levantando · 21–22 tonto · 23–24 vitória
 *   25–27 soco · 28–30 mão em faca · 31–34 chute alto · 35–36 chute aéreo · 37–38 agarrão
 *   39–41 kunai · 42–43 Leitura (postura) · 44–46 corte pelas costas · 47–48 carregando
 *   49–51 palma para a frente · 52–53 mão para cima · 54–55 mão no chão · 56–59 gancho
 *   60–61 sumir · 62–63 pose do super · 64 sinal de mão
 * As poses genéricas (palma, mão para cima, mão no chão, gancho, sumir) servem para os
 * especiais que ele copia: cada um tem o nome da animação usada pelo dono original.
 */
(function () {
  Game.sprites.corvo = {
    image: 'corvo',
    frameWidth: 60,
    frameHeight: 52,
    anchor: { x: 30, y: 52 },
    headY: 8,
    eye: { x: 3, y: -33 },
    animations: {
      idle: { frames: [0, 1], fps: 1.6 },
      stance: { frames: [2, 3], fps: 2.2 },
      walk: { frames: [4, 5, 6, 7, 8, 9, 10, 11], fps: 11 },
      jump: { frames: [12], fps: 1 },
      fall: { frames: [13], fps: 1 },
      block: { frames: [14], fps: 1 },
      crouch: { frames: [15], fps: 1 },
      hurt: { frames: [16], fps: 1 },
      hurtHeavy: { frames: [17], fps: 1 },
      knockFly: { frames: [18], fps: 1 },
      lie: { frames: [19], fps: 1 },
      getup: { frames: [20, 2], durations: [0.22, 0.12], loop: false },
      dizzy: { frames: [21, 22], fps: 3 },
      win: { frames: [23, 24], durations: [0.6, 0.4] },
      jab: {
        frames: [25, 26, 27], durations: [0.05, 0.08, 0.1], loop: false,
        hit: { frame: 1, x: 2, y: -30, w: 20, h: 20, damage: 5, knockback: 70 },
      },
      cross: {
        frames: [28, 29, 30], durations: [0.06, 0.1, 0.12], loop: false, lunge: 60,
        hit: { frame: 1, x: 2, y: -30, w: 22, h: 20, damage: 8, knockback: 120, heavy: true },
      },
      kick: {
        frames: [31, 32, 33, 34], durations: [0.06, 0.09, 0.13, 0.12], loop: false, lunge: 90,
        hit: { frame: 1, x: 2, y: -30, w: 22, h: 20, damage: 10, knockback: 160, heavy: true, launch: true },
      },
      airKick: {
        frames: [35, 36], durations: [0.12, 0.22], loop: false,
        hit: { frame: 0, lastFrame: 1, sweep: true, x: 0, y: -26, w: 22, h: 24, damage: 8, knockback: 120, heavy: true },
      },
      grab: { frames: [37, 38], durations: [0.08, 0.3], loop: false },
      // Kunai Rubra: o especial dele enquanto não copiou nada
      kunaiThrow: { frames: [39, 40, 41], durations: [0.08, 0.12, 0.12], loop: false, release: 1, kunai: true, muzzle: { x: 20, y: -21 } },
      // cópias dos especiais da Marionete e do Pavio
      threadCast: { frames: [39, 40, 41], durations: [0.08, 0.1, 0.16], loop: false, release: 1, thread: true, muzzle: { x: 20, y: -21 } },
      yank: { frames: [37, 38, 38], durations: [0.06, 0.12, 0.12], loop: false, release: 1, yank: true },
      tangle: { frames: [42, 43, 43], durations: [0.08, 0.1, 0.16], loop: false, release: 1, tangle: true },
      bombThrow: { frames: [39, 40, 41], durations: [0.12, 0.12, 0.14], loop: false, release: 1, bomb: true, muzzle: { x: 12, y: -34 } },
      plant: { frames: [37, 38, 38], durations: [0.1, 0.1, 0.16], loop: false, release: 1, plant: true },
      // Leitura: postura do olho rubro; se alguém acertar nela, some em penas e corta pelas costas
      counter: { frames: [42, 43, 43], durations: [0.05, 0.32, 0.26], loop: false, counter: { until: 1 } },
      slash: {
        frames: [44, 45, 46], durations: [0.05, 0.12, 0.2], loop: false,
        hit: { frame: 1, x: -6, y: -40, w: 32, h: 40, damage: 8, knockback: 170, heavy: true, launch: true, special: true },
      },
      // golpes copiados (mesmos nomes de animação dos donos originais)
      charge: { frames: [47], fps: 1 },
      charged: { frames: [48, 47], fps: 14 },
      fire: { frames: [50], durations: [0.22], loop: false, muzzle: { x: 20, y: -19 } },
      throw: { frames: [39, 40, 41], durations: [0.12, 0.16, 0.14], loop: false, release: 1, muzzle: { x: 20, y: -19 } },
      dash: {
        frames: [28, 29, 30], durations: [0.05, 0.2, 0.24], loop: false,
        dash: { frame: 1 },
        hit: { frame: 1, sweep: true, x: 0, y: -32, w: 24, h: 20, damage: 10, knockback: 170, heavy: true, launch: true, special: true },
      },
      rise: {
        frames: [56, 57, 58, 59], durations: [0.04, 0.1, 0.22, 0.6], loop: false, rise: { frame: 1, vy: 360, vx: 55, invuln: 0.16 },
        hit: { frame: 1, lastFrame: 2, sweep: true, x: -2, y: -48, w: 22, h: 48, damage: 12, knockback: 150, heavy: true, launch: true, special: true },
      },
      spikeCast: { frames: [54, 55], durations: [0.11, 0.3], loop: false, release: 1, spike: true },
      torch: { frames: [49, 50, 51], durations: [0.13, 0.36, 0.16], loop: false, release: 1, flame: true, nozzle: { x: 24, y: -24 } },
      teleport: { frames: [60, 60, 61], durations: [0.07, 0.1, 0.15], loop: false, teleport: true, cancelInto: 2 },
      boltCast: { frames: [52, 53], durations: [0.13, 0.3], loop: false, release: 1, bolt: true },
      gateCall: { frames: [49, 50, 51], durations: [0.1, 0.22, 0.14], loop: false, release: 1, gate: true },
      bubbleCast: { frames: [49, 50, 51], durations: [0.1, 0.14, 0.16], loop: false, release: 1, bubble: true, muzzle: { x: 20, y: -20 } },
      rewind: { frames: [42, 43], durations: [0.12, 0.3], loop: false, rewind: { frame: 1 } },
      holeCast: { frames: [49, 50, 51], durations: [0.12, 0.16, 0.16], loop: false, release: 1, hole: true },
      liftCast: { frames: [52, 53], durations: [0.12, 0.28], loop: false, release: 1, lift: true },
      superPose: { frames: [62, 63], fps: 14 },
      revoada: { frames: [50], fps: 1 },
      domain: { frames: [64], fps: 1 },
      sweep: {
        frames: [15, 65, 65, 15], durations: [0.07, 0.07, 0.1, 0.16], loop: false,
        hit: { frame: 1, x: 0, y: -9, w: 24, h: 9, damage: 8, knockback: 110, heavy: true, launch: true, trip: true, low: true },
      },
      intro: { frames: [62, 63, 62, 63, 2], durations: [0.1, 0.1, 0.1, 0.1, 0.25], loop: false },
    },
  };
})();

/*
 * Ampulheta (tempo e areia) e Órbita (gravidade): desenhados do zero no rig, no mesmo
 * tamanho da Gélida e do Trovão (38×36). Mesma ordem nos dois até o quadro 38:
 *   0–1 parada · 2–3 guarda · 4–11 andar · 12 pulo · 13 queda · 14 defesa · 15 agachada
 *   16–17 apanhando · 18 voando · 19 caída · 20 levantando · 21–22 tonta · 23–24 vitória
 *   25–27 jab · 28–30 direto · 31–34 chute · 35–36 chute aéreo · 37–38 agarrão
 * Ampulheta: 39–41 Bolha do Tempo · 42–43 Rebobinar · 44–45 super · 46 estalo · 47 sinal
 * Órbita:    39–40 flutuando · 41–43 Buraco Negro · 44–45 Antigravidade · 46–47 super
 *            48 arremesso da estrela · 49 sinal de mão
 */
(function () {
  const base = {
    idle: { frames: [0, 1], fps: 1.6 },
    stance: { frames: [2, 3], fps: 2.2 },
    walk: { frames: [4, 5, 6, 7, 8, 9, 10, 11], fps: 12 },
    jump: { frames: [12], fps: 1 },
    fall: { frames: [13], fps: 1 },
    block: { frames: [14], fps: 1 },
    crouch: { frames: [15], fps: 1 },
    hurt: { frames: [16], fps: 1 },
    hurtHeavy: { frames: [17], fps: 1 },
    knockFly: { frames: [18], fps: 1 },
    lie: { frames: [19], fps: 1 },
    getup: { frames: [20, 2], durations: [0.22, 0.12], loop: false },
    dizzy: { frames: [21, 22], fps: 3 },
    win: { frames: [23, 24], durations: [0.6, 0.4] },
    jab: {
      frames: [25, 26, 27], durations: [0.05, 0.08, 0.1], loop: false,
      hit: { frame: 1, x: 2, y: -24, w: 20, h: 12, damage: 5, knockback: 70 },
    },
    cross: {
      frames: [28, 29, 30], durations: [0.06, 0.1, 0.12], loop: false, lunge: 50,
      hit: { frame: 1, x: 2, y: -24, w: 21, h: 13, damage: 7, knockback: 120, heavy: true },
    },
    kick: {
      frames: [31, 32, 33, 34], durations: [0.06, 0.09, 0.12, 0.12], loop: false, lunge: 100,
      hit: { frame: 1, x: 2, y: -22, w: 21, h: 16, damage: 10, knockback: 160, heavy: true, launch: true },
    },
    airKick: {
      frames: [35, 36], durations: [0.12, 0.22], loop: false,
      hit: { frame: 0, lastFrame: 1, sweep: true, x: 0, y: -24, w: 19, h: 24, damage: 8, knockback: 120, heavy: true },
    },
    grab: { frames: [37, 38], durations: [0.08, 0.3], loop: false },
  };
  const sheet = (image, anims) => ({
    image, frameWidth: 38, frameHeight: 36, anchor: { x: 19, y: 36 }, animations: Object.assign({}, base, anims),
  });

  Game.sprites.ampulheta = sheet('ampulheta', {
    // Bolha do Tempo: joga a ampulheta de areia por baixo; ela vira uma bolha de câmera lenta
    bubbleCast: { frames: [39, 40, 41], durations: [0.1, 0.14, 0.16], loop: false, release: 1, bubble: true, muzzle: { x: 15, y: -20 } },
    // Rebobinar: volta para onde estava um instante atrás (e recupera a vida perdida nesse tempo)
    rewind: { frames: [42, 43], durations: [0.12, 0.3], loop: false, rewind: { frame: 1 } },
    superPose: { frames: [44, 45], fps: 14 },
    snap: { frames: [46], fps: 1 },
    domain: { frames: [47], fps: 1 },
    sweep: {
      frames: [15, 48, 48, 15], durations: [0.07, 0.07, 0.1, 0.16], loop: false,
      hit: { frame: 1, x: 0, y: -9, w: 22, h: 9, damage: 8, knockback: 110, heavy: true, launch: true, trip: true, low: true },
    },
    intro: { frames: [44, 45, 44, 45, 2], durations: [0.08, 0.08, 0.08, 0.08, 0.25], loop: false },
  });

  Game.sprites.orbita = sheet('orbita', {
    float: { frames: [39, 40], fps: 3 },
    // Buraco Negro: abre à frente e puxa o adversário
    holeCast: { frames: [41, 42, 43], durations: [0.12, 0.16, 0.16], loop: false, release: 1, hole: true },
    // Antigravidade: as palmas sobem e o adversário flutua
    liftCast: { frames: [44, 45], durations: [0.12, 0.28], loop: false, release: 1, lift: true },
    superPose: { frames: [46, 47], fps: 14 },
    hurl: { frames: [48], fps: 1 },
    domain: { frames: [49], fps: 1 },
    sweep: {
      frames: [15, 50, 50, 15], durations: [0.07, 0.07, 0.1, 0.16], loop: false,
      hit: { frame: 1, x: 0, y: -9, w: 22, h: 9, damage: 8, knockback: 110, heavy: true, launch: true, trip: true, low: true },
    },
    intro: { frames: [46, 47, 46, 47, 2], durations: [0.08, 0.08, 0.08, 0.08, 0.25], loop: false },
  });

  /*
   * Marionete (fios de teatro) e Pavio (bombas), desenhados no mesmo rig (make_newfighters2.py):
   * Marionete: 39–41 Fio · 42–43 Puxão · 44–45 Fios Trocados · 46–47 super · 48–49 conduzindo os
   *            fios · 50 sinal de mão · 51 rasteira
   * Pavio:     39–41 arremesso da bomba · 42–43 Bomba-relógio · 44–45 acendendo o barril ·
   *            46–47 chute no barril · 48 sinal de mão · 49 rasteira
   */
  const sweep = (frame) => ({
    frames: [15, frame, frame, 15], durations: [0.07, 0.07, 0.1, 0.16], loop: false,
    hit: { frame: 1, x: 0, y: -9, w: 22, h: 9, damage: 8, knockback: 110, heavy: true, launch: true, trip: true, low: true },
  });
  Game.sprites.marionete = sheet('marionete', {
    threadCast: { frames: [39, 40, 41], durations: [0.08, 0.1, 0.16], loop: false, release: 1, thread: true, muzzle: { x: 14, y: -21 } },
    yank: { frames: [42, 43, 43], durations: [0.06, 0.12, 0.12], loop: false, release: 1, yank: true },
    tangle: { frames: [44, 45, 45], durations: [0.08, 0.1, 0.16], loop: false, release: 1, tangle: true },
    superPose: { frames: [46, 47], fps: 14 },
    conduct: { frames: [48, 49], fps: 7 },
    domain: { frames: [50], fps: 1 },
    sweep: sweep(51),
    intro: { frames: [48, 49, 48, 49, 2], durations: [0.1, 0.1, 0.1, 0.1, 0.25], loop: false },
  });
  Game.sprites.pavio = sheet('pavio', {
    bombThrow: { frames: [39, 40, 41], durations: [0.1, 0.1, 0.16], loop: false, release: 1, bomb: true, muzzle: { x: 6, y: -30 } },
    plant: { frames: [42, 43, 43], durations: [0.1, 0.1, 0.18], loop: false, release: 1, plant: true },
    superPose: { frames: [44, 45], fps: 14 },
    barrelKick: { frames: [46, 47], durations: [0.14, 0.22], loop: false },
    domain: { frames: [48], fps: 1 },
    sweep: sweep(49),
    intro: { frames: [23, 24, 23, 24, 2], durations: [0.12, 0.12, 0.12, 0.12, 0.25], loop: false },
  });
})();
