/*
 * Expansão de Domínio (inspirada em Jujutsu Kaisen).
 *
 * Com as 2 barras de super cheias (I ou B; no versus T e O), o lutador faz o sinal
 * de mão, a tela escurece e um cenário ligado ao poder dele se abre a partir do
 * próprio corpo, cobrindo a arena inteira por 10 segundos. Dentro do domínio:
 *
 *   - os golpes de quem expandiu tiram 25% a mais e ele anda mais rápido;
 *     o adversário fica mais lento;
 *   - cada golpe que acerta puxa um "eco" (um segundo golpe do cenário);
 *   - os especiais mudam (veja "perk" de cada domínio abaixo);
 *   - ACERTO GARANTIDO: de tempos em tempos o cenário ataca sozinho. Uma mira
 *     aparece no adversário e o golpe vem sem chance de defesa;
 *   - a barra de quem expandiu não enche enquanto o domínio durar.
 *
 * Se o adversário também tiver as 2 barras, pode expandir o dele por cima:
 * começa um EMBATE DE DOMÍNIOS. Os dois apertam soco o mais rápido que puderem;
 * quem empurrar a divisa para o outro lado fica com o domínio (10 s de novo) e o
 * outro é desmanchado. Empate: os dois cenários quebram.
 *
 * Os lutadores novos também mudam as regras do domínio: no Deserto do Tempo o
 * adversário fica em câmera lenta (slowFoe) e no Horizonte de Eventos a gravidade
 * cai para os dois (lowGravity).
 *
 * As imagens de cada cenário ficam em assets/domains (três camadas com paralaxe:
 * fundo, meio e chão); as partículas e luzes são desenhadas aqui.
 */
window.Game = window.Game || {};

Game.DOMAINS = {
  hood: {
    name: 'ABISMO VIOLETA', color: '#a46cff', light: '#e2c4ff', dark: '#1a0833',
    layers: ['domHoodFar', 'domHoodMid', 'domHoodFloor'], fx: 'motes', sure: 'abyss', echo: 'abyss',
    perk: 'bola de energia já sai carregada e dá para lançar várias',
  },
  kid: {
    name: 'RINGUE SEM FIM', color: '#ff5d4a', light: '#ffd7d0', dark: '#140a10',
    layers: ['domKidFar', 'domKidMid', 'domKidFloor'], fx: 'spotlights', sure: 'fist', echo: 'fist',
    perk: 'cada soco acerta duas vezes; investida mais rápida, atravessa projéteis',
  },
  glasses: {
    name: 'BIBLIOTECA INFINITA', color: '#e8c15a', light: '#fff3c4', dark: '#170d06',
    layers: ['domGlassesFar', 'domGlassesMid', 'domGlassesFloor'], fx: 'pages', sure: 'book', echo: 'book',
    perk: 'arremessa três livros de uma vez, sem esperar',
  },
  brasa: {
    name: 'FORNALHA ETERNA', color: '#ff7a2f', light: '#ffd166', dark: '#1a0604',
    layers: ['domBrasaFar', 'domBrasaMid', 'domBrasaFloor'], fx: 'embers', sure: 'flame', echo: null,
    perk: 'todo golpe queima; o gancho ascendente deixa um pilar de fogo',
  },
  gelida: {
    name: 'INVERNO ABSOLUTO', color: '#7cc8ff', light: '#e8f8ff', dark: '#06101f',
    layers: ['domGelidaFar', 'domGelidaMid', 'domGelidaFloor'], fx: 'snow', sure: 'icicle', echo: 'icicle',
    perk: 'três picos de gelo, congelamento mais longo e o mergulho congela',
  },
  trovao: {
    name: 'CÉU DA TEMPESTADE', color: '#ffd23f', light: '#fff3b0', dark: '#05060f',
    layers: ['domTrovaoFar', 'domTrovaoMid', 'domTrovaoFloor'], fx: 'storm', sure: 'bolt', echo: 'bolt',
    perk: 'teleporte sem espera e com choque; o raio cai duas vezes',
  },
  // Soldador: uma serralheria sem fim, cheia de portões de ferro, faíscas e clarões de solda
  welder: {
    name: 'SERRALHERIA INFINITA', color: '#ff9d2e', light: '#ffe0a8', dark: '#0b0908',
    layers: ['domWelderFar', 'domWelderMid', 'domWelderFloor'], fx: 'forge', sure: 'gateClose', echo: 'sparks',
    perk: 'maçarico mais longo que solda os pés do adversário no chão; o portão vira uma cela dupla; cada acerto solta faíscas',
  },
  // Corvo: lua vermelha gigante que é um olho (a pupila segue o adversário), corvos e lírios vermelhos
  corvo: {
    name: 'LUA RUBRA', color: '#e0303a', light: '#ffb0b0', dark: '#0b0104',
    layers: ['domCorvoFar', 'domCorvoMid', 'domCorvoFloor'], fx: 'moon', sure: 'crow', echo: 'peck',
    perk: 'as cópias saem sem espera, a kunai sai tripla e a Leitura segura mais tempo; um corvo bica a cada acerto',
  },
  // Ampulheta: pôr do sol parado, ampulhetas no céu; o adversário fica em câmera lenta
  ampulheta: {
    name: 'DESERTO DO TEMPO', color: '#3fe0c5', light: '#fff1b8', dark: '#24164a',
    layers: ['domAmpulhetaFar', 'domAmpulhetaMid', 'domAmpulhetaFloor'], fx: 'sand', sure: 'clockHand', echo: 'tick',
    slowFoe: 0.8,
    perk: 'o adversário fica em câmera lenta o tempo todo; a bolha é maior e dura mais; o Rebobinar recarrega rápido',
  },
  // Órbita: espaço com um buraco negro gigante; gravidade baixa para os dois
  orbita: {
    name: 'HORIZONTE DE EVENTOS', color: '#ff5fd2', light: '#ffd6f4', dark: '#020108',
    layers: ['domOrbitaFar', 'domOrbitaMid', 'domOrbitaFloor'], fx: 'space', sure: 'meteor', echo: 'pebble',
    lowGravity: 0.55,
    perk: 'gravidade baixa para os dois (pulos altos e lentos); buraco negro maior e mais longo; a Antigravidade segura mais tempo',
  },
  // Marionete: palco de teatro com cortinas de veludo e bonecos pendurados; um holofote segue o adversário
  marionete: {
    name: 'TEATRO DAS MARIONETES', color: '#de3550', light: '#ffb3c4', dark: '#12030a',
    layers: ['domMarioneteFar', 'domMarioneteMid', 'domMarioneteFloor'], fx: 'stage', sure: 'puppetDrop', echo: 'snap',
    perk: 'o adversário fica sempre preso por um fio: o Puxão sai a qualquer hora e os Fios Trocados duram mais e não gastam o fio',
  },
  // Pavio: pedreira ao pôr do sol, detonações ao longe; minas brotam do chão
  pavio: {
    name: 'PEDREIRA EXPLOSIVA', color: '#ff9a3c', light: '#ffe0a8', dark: '#1e1418',
    layers: ['domPavioFar', 'domPavioMid', 'domPavioFloor'], fx: 'quarry', sure: 'mine', echo: 'blast',
    perk: 'cada bomba solta duas bombinhas ao explodir; a bomba-relógio conta mais rápido; minas brotam do chão',
  },
  ademoir: {
    name: 'NOVA FLORESTA', color: '#7cc456', light: '#e8f8b0', dark: '#0e1c12',
    layers: ['domAdemoirFar', 'domAdemoirMid1', 'domAdemoirFloor'], fx: 'forest', sure: 'oakRoot', echo: 'thorn',
    // a floresta cresce enquanto o domínio dura: as árvores brotam do chão em três estágios
    stages: ['domAdemoirMid1', 'domAdemoirMid2', 'domAdemoirMid3'],
    perk: 'a floresta cresce enquanto dura: a Armadura de Carvalho brota na hora e não acaba; as raízes garantidas ficam mais fortes; a Raiz de Corte faz uma 3ª curva',
  },
  dama: {
    name: 'TABULEIRO INFINITO', color: '#ff8fb3', light: '#ffe0ea', dark: '#140a1c',
    layers: ['domDamaFar', 'domDamaMid', 'domDamaFloor'], fx: 'chess', sure: 'chessDrop', echo: 'pawnPop',
    // Zugzwang: quem fica parado no tabuleiro é obrigado a se mexer (ou um peão brota embaixo dele)
    zugzwang: true,
    perk: 'Zugzwang: o adversário parado apanha; o peão anda duas casas (até três peões) e o Salto do Cavalo sai sem espera',
  },
};

// Paralaxe das três camadas (0 = parada na tela, 1 = presa ao chão)
Game.DOMAIN_FACTORS = [0.2, 0.55, 1];

Game.Domain = class Domain {
  /** Chamado pelo lutador ao expandir (Fighter.tryDomain). */
  static expand(user, scene) {
    const cfg = Game.config.domain;
    const def = Game.DOMAINS[user.charKey];
    scene.startCinematic(user, { time: cfg.cinematic, domain: true, color: user.shadow ? '#b47cff' : def.color });
    Game.events.emit('domainCast', { fighter: user, name: def.name });
    const cur = scene.domain;
    if (cur && cur.owner !== user && cur.phase !== 'break') cur.challenger = user; // embate!
    else scene.domain = new Game.Domain(user, scene);
  }

  /** opts.phase: 'cast' (padrão, espera a cena do sinal de mão), 'reveal' ou 'preview' (só desenho). */
  constructor(owner, scene, opts = {}) {
    this.owner = owner;
    this.def = Game.DOMAINS[owner.charKey];
    this.cfg = Game.config.domain;
    this.phase = opts.phase || 'cast';
    this.t = 0;
    this.clock = 0;
    this.left = this.cfg.duration;
    this.sureTimer = this.cfg.sureFirst;
    this.parts = [];
    this.flash = 0;
    this.nextFlash = 1;
    this.skyBolt = null;
    this.clash = null;
    this.challenger = null;
    this.lastRect = null;
    this.origin = { x: owner.cx, y: owner.feet - 16 };
    this.stage = 0;     // Nova Floresta: quanto a floresta já cresceu (1–3)
    this.stageT = 0;    // tempo desde que ela cresceu da última vez
    if (this.phase === 'reveal') this.begin(scene);
  }

  get foe() {
    return this.owner.opponent;
  }

  /** O cenário cobre a tela toda (dá para pular o desenho da arena). */
  covers() {
    return !this.clash && (this.phase === 'active' || (this.phase === 'reveal' && this.t >= this.cfg.reveal));
  }

  /** Segundos que faltam (para o HUD). */
  get remaining() {
    return this.phase === 'reveal' || this.phase === 'active' ? Math.max(0, this.left) : 0;
  }

  // ------------------------------------------------------------------ ciclo
  begin(scene) {
    this.phase = 'reveal';
    this.t = 0;
    this.origin = { x: this.owner.cx, y: this.owner.feet - 16 };
    this.applyBuffs(true);
    scene.effects.shake(0.25, 2);
    Game.events.emit('domainOpen', { domain: this, owner: this.owner });
    if (this.def.stages) this.growForest(1, scene);
  }

  /**
   * Nova Floresta: a floresta cresce (as árvores novas brotam do chão). Ao abrir, o dono veste a
   * Armadura de Carvalho; depois, a cada vez que a floresta cresce, a casca dele se refaz inteira.
   */
  growForest(n, scene) {
    this.stage = n;
    this.stageT = 0;
    const o = this.owner;
    if (o.char.special2 === 'armor' && !o.ko) {
      if (!o.armor) o.putArmor(scene, n > 1);
      else o.armor.hp = o.armor.max;
    }
    if (this.lastRect && n > 1) {
      const r = this.lastRect;
      for (let i = 0; i < 18; i++) {
        Game.leafBurst(scene, r.x + Math.random() * r.w, (o.groundY || r.y + r.h) - 2, 1);
      }
    }
    Game.events.emit('forestGrow', { owner: o, stage: n });
  }

  applyBuffs(on) {
    const o = this.owner;
    const f = this.foe;
    o.inDomain = on;
    // a floresta acabou: a Armadura de Carvalho que ela sustentava dura só mais um pouco
    if (!on && o.armor && o.char.special2 === 'armor') o.armor.t = Math.min(o.armor.t, 3);
    o.speedMult = on ? this.cfg.ownerSpeed : 1;
    if (f) f.speedMult = on ? this.cfg.foeSpeed : 1;
  }

  update(dt, scene) {
    this.t += dt;
    this.clock += dt;
    this.updateParticles(dt);
    if (this.phase === 'preview' || scene.cinematic) return; // espera a cena do sinal de mão
    if (this.phase === 'cast') {
      this.begin(scene); // a cena do sinal de mão acabou
      return;
    }
    if (this.challenger && !this.clash && this.phase !== 'break') {
      this.startClash(scene);
      return;
    }
    if (this.phase === 'reveal' && this.t >= this.cfg.reveal) {
      this.phase = 'active';
      this.t = 0;
    }
    if (this.phase === 'reveal' || this.phase === 'active') {
      this.left -= dt;
      if (this.owner.ko || this.left <= 0) {
        this.collapse(scene);
        return;
      }
      if (this.def.stages) {
        this.stageT += dt;
        const k = this.def.stages.length;
        const n = Math.min(k, Math.floor((this.cfg.duration - this.left) / (this.cfg.duration / k)) + 1);
        if (n > this.stage) this.growForest(n, scene);
      }
      if (!scene.locked) this.updateSure(dt, scene);
      if (this.def.zugzwang && !scene.locked) this.updateZugzwang(dt, scene);
    } else if (this.phase === 'break' && this.t >= this.cfg.breakTime) {
      if (scene.domain === this) scene.domain = null;
      Game.events.emit('domainEnd', { owner: this.owner });
    }
  }

  /** O domínio se desfaz (tempo acabou, dono nocauteado ou embate empatado). */
  collapse(scene) {
    if (this.phase === 'break') return;
    this.phase = 'break';
    this.t = 0;
    this.applyBuffs(false);
    this.clearSure(scene);
    scene.effects.shake(0.25, 2);
    const r = this.lastRect;
    if (r) {
      for (let i = 0; i < 40; i++) {
        scene.effects.burst(r.x + Math.random() * r.w, r.y + Math.random() * r.h,
          [this.def.light, this.def.color, '#ffffff'], 1, { speed: 160, lift: 140, gravity: 500 });
      }
    }
    Game.events.emit('domainBreak', { owner: this.owner });
  }

  /** Tira da arena os acertos garantidos que ainda não caíram. */
  clearSure(scene) {
    for (const e of scene.entities) if (e instanceof Game.Strike && e.sure && e.owner === this.owner && e.phase === 'warn') e.dead = true;
  }

  // ------------------------------------------------------------------ acerto garantido
  updateSure(dt, scene) {
    const foe = this.foe;
    if (!foe || foe.ko) return;
    const damage = this.cfg.sureDamage;
    this.sureTimer -= dt;
    if (this.sureTimer > 0) return;
    this.sureTimer = this.cfg.sureEvery;
    const kind = this.def.sure;
    const hit = { damage, knockback: 60, heavy: true, special: true, unblockable: true, sure: true, echo: true };
    if (kind === 'icicle') hit.freeze = 0.5;
    if (kind === 'flame') hit.burn = 2;
    if (kind === 'gateClose') {
      hit.root = 0.8; // o portão fecha e a emenda é soldada com os pés dele junto
      hit.knockback = 20;
    }
    if (kind === 'bolt' || kind === 'fist' || kind === 'crow') hit.knockback = 40;
    if (kind === 'clockHand') hit.knockback = 30;
    if (kind === 'meteor') hit.knockback = 70;
    if (kind === 'puppetDrop') hit.knockback = 30;
    if (kind === 'mine') hit.knockback = 90;
    if (kind === 'chessDrop') hit.knockback = 70;
    if (kind === 'oakRoot') {
      // quanto maior a floresta, mais forte a raiz; com a floresta inteira ela arremessa
      hit.knockback = 70 + this.stage * 20;
      if (this.stage >= this.def.stages.length) hit.launch = true;
    }
    scene.add(new Game.Strike(this.owner, kind, foe.cx, { sure: true, track: foe, warn: this.cfg.sureWarn, hit }));
    Game.events.emit('sureWarn', { owner: this.owner, target: foe });
  }

  /**
   * Tabuleiro Infinito: o adversário parado (de pé, agachado ou defendendo, sem andar) tempo demais
   * entra em Zugzwang: um peão brota embaixo dele, sem defesa, e a conta recomeça.
   */
  updateZugzwang(dt, scene) {
    const foe = this.foe;
    const c = Game.config.zugzwang;
    if (!foe || foe.ko || foe.hidden) return;
    const still = foe.onGround && Math.abs(foe.vx) < 8 && !foe.attack && ['idle', 'crouch', 'block'].includes(foe.state);
    this.zug = still ? (this.zug || 0) + dt : 0;
    if (this.zug >= c.still) {
      this.zug = c.still - c.every;
      scene.add(new Game.Strike(this.owner, 'pawnPop', foe.cx, { warn: 0.14, track: foe, hit: Object.assign({}, c.hit) }));
      Game.events.emit('zugzwang', { owner: this.owner, target: foe });
    }
  }

  // ------------------------------------------------------------------ golpes
  /** Golpes de quem expandiu ficam mais fortes (e ganham efeitos do cenário). */
  modifyHit(hit, owner) {
    if (owner !== this.owner || !owner.inDomain || hit.echo || hit.sure) return hit;
    const h = Object.assign({}, hit);
    h.damage = Math.max(1, Math.round(h.damage * this.cfg.damage));
    const key = owner.charKey;
    if (key === 'brasa') h.burn = 2.4;
    if (key === 'gelida' && owner.attack && owner.attack.def.dive) h.freeze = 0.55;
    return h;
  }

  /** Um golpe de quem expandiu acertou: o cenário responde com um eco. */
  onOwnerHit(target, hit, attacker, owner, scene) {
    if (owner !== this.owner || !owner.inDomain || hit.echo || hit.sure || hit.super || hit.throw) return;
    if (this.phase !== 'reveal' && this.phase !== 'active') return;
    // gancho do Brasa: pilar de fogo no ponto do golpe
    if (owner.charKey === 'brasa' && owner.attack && owner.attack.def.rise && !owner.attack.pillar) {
      owner.attack.pillar = true;
      scene.add(new Game.Strike(owner, 'flame', target.cx, { warn: 0.12, track: target,
        hit: { damage: 4, knockback: 60, special: true, unblockable: true, echo: true, burn: 2 } }));
      return;
    }
    const kind = this.def.echo;
    if (!kind) return;
    const damage = owner.charKey === 'kid' ? Math.max(2, Math.round(hit.damage * 0.5)) : 2;
    scene.add(new Game.Strike(owner, kind, target.cx, {
      warn: kind === 'fist' || kind === 'peck' || kind === 'snap' ? 0.07 : kind === 'sparks' || kind === 'tick' || kind === 'pebble' || kind === 'blast' || kind === 'thorn' || kind === 'pawnPop' ? 0.1 : 0.15,
      track: target, small: true,
      hit: { damage, knockback: 30, special: true, unblockable: true, echo: true, stop: 'multi' },
    }));
  }

  // ------------------------------------------------------------------ embate
  startClash(scene) {
    const a = this.owner;
    const b = this.challenger;
    this.challenger = null;
    this.clash = { a, b, t: 0, balance: 0, other: new Game.Domain(b, scene, { phase: 'preview' }), sparks: 0 };
    this.clash.other.lastRect = this.lastRect;
    for (const f of [a, b]) {
      f.aura = this.cfg.clashTime + 0.3;
      // quem está livre (ou fazendo o sinal de mão) faz a pose; quem está apanhando continua apanhando
      if (f.onGround && (f.canAct() || f.state === 'super')) {
        f.attack = null;
        f.charging = null;
        f.vx = 0;
        f.play('domain', true);
      }
    }
    this.clearSure(scene);
    Game.events.emit('domainClashStart', { a, b });
  }

  /** Durante o embate tudo para; só contam os botões apertados. */
  updateClash(dt, input, scene) {
    const c = this.clash;
    c.t += dt;
    this.clock += dt;
    this.updateParticles(dt);
    c.other.clock += dt;
    c.other.updateParticles(dt);
    for (const [f, sign] of [[c.a, 1], [c.b, -1]]) {
      const inp = f.controller || input;
      let n = 0;
      for (const act of ['punch', 'special', 'super', 'domain']) if (inp.consumePress(act)) n += 1;
      if (inp.mash && inp.mash(dt)) n += 1; // CPU
      f.flash = Math.max(0, f.flash - dt);
      f.clock += dt; // a aura continua piscando
      if (n) {
        c.balance = Math.max(-1, Math.min(1, c.balance + sign * n * 0.085));
        f.flash = 0.03;
      }
    }
    c.sparks -= dt;
    if (c.sparks <= 0 && this.lastRect) {
      c.sparks = 0.03;
      const bx = this.clashBoundary(this.lastRect);
      scene.effects.burst(bx, this.lastRect.y + Math.random() * this.lastRect.h, ['#ffffff', '#fff3b0', this.def.light, c.other.def.light], 2,
        { speed: 120, lift: 60, gravity: 0 });
    }
    if (c.t >= this.cfg.clashTime || Math.abs(c.balance) >= 1) this.resolveClash(scene);
  }

  resolveClash(scene) {
    const c = this.clash;
    this.clash = null;
    const winner = c.balance > 0.1 ? c.a : c.balance < -0.1 ? c.b : null;
    for (const f of [c.a, c.b]) {
      f.aura = 0;
      if (f.state === 'super') {
        f.superData = null;
        f.enterIdle();
      } else if (f.canAct() && f.onGround) {
        f.enterIdle(); // sai da pose do sinal de mão
      }
    }
    scene.effects.shake(0.3, 3);
    if (!winner) {
      this.collapse(scene);
      Game.events.emit('domainClash', { winner: null });
      return;
    }
    const loser = winner === c.a ? c.b : c.a;
    if (!loser.ko && loser.onGround && !Game.INVULNERABLE_STATES.has(loser.state)) {
      // quem perdeu o embate fica atordoado um instante
      loser.state = 'hurt';
      loser.stateTime = 0;
      loser.stateTimer = 0.6;
      loser.play('hurtHeavy', true);
    }
    Game.events.emit('domainClash', { winner, loser });
    if (winner === this.owner) {
      this.phase = 'active';
      this.t = 0;
      this.left = this.cfg.duration;
      this.sureTimer = this.cfg.sureFirst;
      this.applyBuffs(true);
    } else {
      this.applyBuffs(false);
      scene.domain = new Game.Domain(winner, scene, { phase: 'reveal' });
      scene.domain.parts = c.other.parts;
    }
  }

  /** Fração da tela do lado esquerdo no embate (para a barra do HUD). */
  clashShare() {
    const c = this.clash;
    if (!c) return 0.5;
    const ownerLeft = c.a.cx <= c.b.cx;
    return 0.5 + 0.5 * c.balance * (ownerLeft ? 1 : -1);
  }

  /** Posição da divisa entre os dois cenários no embate. */
  clashBoundary(r) {
    const c = this.clash;
    if (!c) return r.x + r.w / 2;
    const ownerLeft = c.a.cx <= c.b.cx;
    const k = 0.5 + 0.38 * c.balance * (ownerLeft ? 1 : -1);
    return r.x + r.w * k;
  }

  // ------------------------------------------------------------------ partículas
  updateParticles(dt) {
    const r = this.lastRect;
    if (!r) return;
    const fx = this.def.fx;
    const P = this.parts;
    const rnd = Math.random;
    const add = (o) => P.length < 220 && P.push(Object.assign({ t: 0 }, o));
    const floor = this.owner.groundY !== undefined ? this.owner.groundY : r.y + r.h;
    if (fx === 'snow') {
      for (let i = 0; i < 3; i++) {
        if (rnd() < dt * 22) {
          const front = rnd() < 0.35;
          add({ x: r.x + rnd() * (r.w + 40) - 20, y: r.y - 4, vx: -6 + rnd() * 12, vy: front ? 34 + rnd() * 20 : 16 + rnd() * 14,
            life: 7, size: front ? 2 : 1, color: front ? '#ffffff' : '#bfe6ff', front, sway: rnd() * 6 });
        }
      }
    } else if (fx === 'storm') {
      for (let i = 0; i < 4; i++) {
        if (rnd() < dt * 40) {
          add({ x: r.x + rnd() * (r.w + 80), y: r.y - 6, vx: -70, vy: 320 + rnd() * 60, life: 1, len: 4 + Math.floor(rnd() * 3),
            color: rnd() < 0.5 ? 'rgba(180, 200, 255, 0.55)' : 'rgba(140, 160, 230, 0.45)', front: rnd() < 0.5, rain: true });
        }
      }
      this.flash = Math.max(0, this.flash - dt);
      this.nextFlash -= dt;
      if (this.nextFlash <= 0) {
        this.nextFlash = 1.1 + rnd() * 1.8;
        this.flash = 0.16;
        this.skyBolt = { x: r.x + 20 + rnd() * (r.w - 40), t: 0, seed: Math.floor(rnd() * 1e6) };
        Game.events.emit('domainThunder');
      }
      if (this.skyBolt) {
        this.skyBolt.t += dt;
        if (this.skyBolt.t > 0.2) this.skyBolt = null;
      }
    } else if (fx === 'embers') {
      if (rnd() < dt * 30) {
        const front = rnd() < 0.3;
        add({ x: r.x + rnd() * r.w, y: floor + 2, vx: -8 + rnd() * 16, vy: -(26 + rnd() * 40), life: 1.6 + rnd() * 1.6,
          size: front ? 2 : 1, color: Game.FIRE_COLORS[Math.floor(rnd() * 4)], front, sway: rnd() * 6 });
      }
    } else if (fx === 'motes') {
      if (rnd() < dt * 22) {
        const front = rnd() < 0.25;
        add({ x: r.x + rnd() * r.w, y: floor - rnd() * 20, vx: -5 + rnd() * 10, vy: -(10 + rnd() * 22), life: 2.5 + rnd() * 2,
          size: front ? 2 : 1, color: rnd() < 0.5 ? '#d6a8ff' : rnd() < 0.5 ? '#8b45f0' : '#ffffff', front, sway: rnd() * 6 });
      }
    } else if (fx === 'pages') {
      if (rnd() < dt * 5) {
        const front = rnd() < 0.3;
        add({ x: r.x + rnd() * (r.w + 40) - 20, y: r.y - 6, vx: -10 + rnd() * 20, vy: 14 + rnd() * 10, life: 9,
          page: true, color: rnd() < 0.7 ? '#f3efe4' : '#e8dcc0', front, sway: rnd() * 6 });
      }
      if (rnd() < dt * 10) {
        add({ x: r.x + rnd() * r.w, y: r.y + rnd() * r.h * 0.8, vx: -3 + rnd() * 6, vy: -3 + rnd() * 6, life: 2 + rnd() * 2,
          size: 1, color: '#fff3c4', front: false });
      }
    } else if (fx === 'forge') {
      // chuva de faíscas de alguém soldando lá em cima
      if (rnd() < dt * 4) {
        const sx = r.x + rnd() * r.w;
        const n = 5 + Math.floor(rnd() * 6);
        for (let i = 0; i < n; i++) {
          add({ x: sx, y: r.y + rnd() * 10, vx: -50 + rnd() * 100, vy: rnd() * 40, g: 380, life: 1.2 + rnd() * 0.8,
            size: 1, spark: true, color: ['#ffffff', '#fff1b8', '#ffd166', '#ff9a3c'][Math.floor(rnd() * 4)], front: rnd() < 0.35 });
        }
      }
      // clarão azul de solda em algum ponto da oficina
      this.flash = Math.max(0, this.flash - dt);
      this.nextFlash -= dt;
      if (this.nextFlash <= 0) {
        this.nextFlash = 0.5 + rnd() * 0.9;
        this.flash = 0.12 + rnd() * 0.06;
        this.flashSpot = { x: r.x + 20 + rnd() * (r.w - 40), y: floor - 30 - rnd() * 80 };
        for (let i = 0; i < 6; i++) {
          add({ x: this.flashSpot.x, y: this.flashSpot.y, vx: -70 + rnd() * 140, vy: -60 + rnd() * 50, g: 380, life: 0.8,
            size: 1, spark: true, color: rnd() < 0.5 ? '#ffffff' : '#ffd166', front: false });
        }
      }
    } else if (fx === 'moon') {
      // penas pretas caindo, pétalas vermelhas e corvos atravessando o céu
      if (rnd() < dt * 9) {
        const front = rnd() < 0.3;
        add({ x: r.x + rnd() * (r.w + 40) - 20, y: r.y - 4, vx: -8 + rnd() * 16, vy: 12 + rnd() * 12, life: 9, feather: true,
          color: rnd() < 0.18 ? '#e0303a' : '#14121a', front, sway: rnd() * 6 });
      }
      if (rnd() < dt * 0.7) {
        const dir = rnd() < 0.5 ? 1 : -1;
        add({ x: dir > 0 ? r.x - 12 : r.x + r.w + 12, y: r.y + 12 + rnd() * 50, vx: dir * (70 + rnd() * 50), vy: -6 + rnd() * 12, life: 6,
          crow: true, dir, front: rnd() < 0.2 });
      }
    } else if (fx === 'sand') {
      // areia soprando de um lado para o outro
      for (let i = 0; i < 3; i++) {
        if (rnd() < dt * 26) {
          add({ x: r.x - 10, y: floor - 4 - rnd() * 100, vx: 110 + rnd() * 130, vy: -4 + rnd() * 8, life: 4, streak: true,
            color: rnd() < 0.5 ? '#ffe9a8' : '#f2c14e', front: rnd() < 0.35 });
        }
      }
    } else if (fx === 'space') {
      // estrelas piscando, poeira cósmica e estrelas cadentes
      if (rnd() < dt * 8) {
        add({ x: r.x + rnd() * r.w, y: r.y + rnd() * r.h * 0.75, vx: 0, vy: 0, life: 0.5 + rnd() * 0.8, twinkle: true,
          color: rnd() < 0.6 ? '#ffffff' : '#ffb3ee', front: false });
      }
      if (rnd() < dt * 0.7) {
        add({ x: r.x + rnd() * r.w, y: r.y + rnd() * 30, vx: -170 - rnd() * 80, vy: 80 + rnd() * 30, life: 0.7, shoot: true, color: '#ffffff', front: false });
      }
      if (rnd() < dt * 9) {
        add({ x: r.x + rnd() * r.w, y: floor - 6 - rnd() * 110, vx: -4 + rnd() * 8, vy: -5 + rnd() * 10, life: 3, size: 1,
          color: rnd() < 0.5 ? '#8a82c8' : '#ff9ae6', front: rnd() < 0.2 });
      }
    } else if (fx === 'stage') {
      // pétalas de rosa jogadas no palco e poeira brilhando no holofote
      if (rnd() < dt * 6) {
        const front = rnd() < 0.35;
        add({ x: r.x + rnd() * (r.w + 40) - 20, y: r.y - 4, vx: -8 + rnd() * 16, vy: 18 + rnd() * 14, life: 8, petal: true,
          color: rnd() < 0.7 ? '#de3550' : '#ff8aa0', front, sway: rnd() * 6 });
      }
      const foe = this.foe;
      if (foe && rnd() < dt * 14) {
        add({ x: foe.cx - 18 + rnd() * 36, y: floor - rnd() * 60, vx: -3 + rnd() * 6, vy: -(4 + rnd() * 8), life: 1.6 + rnd(),
          size: 1, color: rnd() < 0.5 ? '#fff6d8' : '#ffe8a8', front: rnd() < 0.3 });
      }
    } else if (fx === 'forest') {
      // folhas caindo (mais conforme a floresta cresce) e vaga-lumes subindo do chão
      const grow = Math.max(1, this.stage || 1);
      if (rnd() < dt * (4 + grow * 3)) {
        const front = rnd() < 0.35;
        add({ x: r.x + rnd() * (r.w + 40) - 20, y: r.y - 4, vx: -10 + rnd() * 20, vy: 14 + rnd() * 12, life: 9, petal: true, leaf: true,
          color: ['#57a33e', '#8fd05a', '#c8d850', '#e09040'][Math.floor(rnd() * 4)], front, sway: rnd() * 6 });
      }
      if (rnd() < dt * 6) {
        add({ x: r.x + rnd() * r.w, y: floor - 4 - rnd() * 50, vx: -4 + rnd() * 8, vy: -(3 + rnd() * 7), life: 2.4 + rnd() * 1.5,
          size: 1, color: rnd() < 0.6 ? '#f0ff9a' : '#c8ff70', front: rnd() < 0.25 });
      }
    } else if (fx === 'chess') {
      // casinhas do tabuleiro soltando do chão e subindo devagar, e brilhos no céu
      if (rnd() < dt * 6) {
        add({ x: r.x + rnd() * r.w, y: floor - 2 - rnd() * 10, vx: -3 + rnd() * 6, vy: -(6 + rnd() * 10), life: 5, square: true,
          size: 2 + Math.floor(rnd() * 2), color: rnd() < 0.5 ? '#ffe0ea' : '#3a2142', front: rnd() < 0.25 });
      }
      if (rnd() < dt * 5) {
        add({ x: r.x + rnd() * r.w, y: r.y + rnd() * Math.max(10, floor - r.y - 40), vx: 0, vy: 0, life: 0.8 + rnd(), twinkle: true,
          color: '#ffd0e0', front: false });
      }
    } else if (fx === 'quarry') {
      // poeira e pedrinhas caindo dos paredões
      if (rnd() < dt * 7) {
        add({ x: r.x + rnd() * r.w, y: r.y - 4, vx: -4 + rnd() * 8, vy: 30 + rnd() * 30, g: 120, life: 4, size: rnd() < 0.2 ? 2 : 1,
          color: ['#c8a070', '#9a7a52', '#e0c090'][Math.floor(rnd() * 3)], front: rnd() < 0.3 });
      }
      // detonação ao longe: clarão e uma nuvem de fumaça subindo no fundo
      this.flash = Math.max(0, this.flash - dt);
      this.nextFlash -= dt;
      if (this.nextFlash <= 0) {
        this.nextFlash = 1.6 + rnd() * 2.2;
        this.flash = 0.16;
        this.flashSpot = { x: r.x + 30 + rnd() * (r.w - 60), y: floor - 70 - rnd() * 40 };
        for (let i = 0; i < 14; i++) {
          add({ x: this.flashSpot.x + (rnd() - 0.5) * 10, y: this.flashSpot.y, vx: (rnd() - 0.5) * 30, vy: -(10 + rnd() * 30), life: 2.4,
            puff: true, size: 2 + Math.floor(rnd() * 3), color: rnd() < 0.5 ? '#8a7a76' : '#a8968e', front: false });
        }
        Game.events.emit('boomFar');
      }
    } else if (fx === 'spotlights') {
      if (rnd() < dt * 2.5) {
        // flash de câmera na plateia
        add({ x: r.x + rnd() * r.w, y: floor - 46 - rnd() * 40, vx: 0, vy: 0, life: 0.12, size: 2, color: '#ffffff', front: false, flashbulb: true });
      }
      if (rnd() < dt * 9) {
        const colors = ['#ff5d4a', '#ffd23f', '#5fe8ff', '#ffffff', '#8bff7a'];
        add({ x: r.x + rnd() * (r.w + 40) - 20, y: r.y - 4, vx: -10 + rnd() * 20, vy: 26 + rnd() * 18, life: 6,
          size: 1, confetti: true, color: colors[Math.floor(rnd() * colors.length)], front: rnd() < 0.5, sway: rnd() * 6 });
      }
    }
    for (const p of P) {
      p.t += dt;
      if (p.g) p.vy += p.g * dt;
      const sway = p.sway !== undefined ? Math.sin((this.clock + p.sway) * 2.2) * 10 : 0;
      p.x += (p.vx + sway) * dt;
      p.y += p.vy * dt;
    }
    this.parts = P.filter((p) => p.t < p.life && p.y < floor + 8 && p.y > r.y - 30);
  }

  // ------------------------------------------------------------------ desenho
  /** Desenha o cenário (atrás dos lutadores), com abertura, quebra ou embate. */
  drawBack(ctx, r, scene) {
    this.lastRect = r;
    if (this.phase === 'cast' || this.phase === 'preview') return;
    if (this.clash) {
      this.clash.other.lastRect = r;
      this.drawClash(ctx, r, scene);
      return;
    }
    if (this.phase === 'reveal' && this.t < this.cfg.reveal) {
      const k = this.t / this.cfg.reveal;
      const ease = 1 - Math.pow(1 - k, 3);
      const far = Math.hypot(Math.max(this.origin.x - r.x, r.x + r.w - this.origin.x), Math.max(this.origin.y - r.y, r.y + r.h - this.origin.y));
      const radius = Math.max(2, ease * (far + 8));
      ctx.save();
      Game.Domain.clipCircle(ctx, Math.round(this.origin.x), Math.round(this.origin.y), radius);
      this.drawScene(ctx, r, scene);
      ctx.restore();
      Game.Domain.ringPixels(ctx, this.origin.x, this.origin.y, radius, this.def.light);
      Game.Domain.ringPixels(ctx, this.origin.x, this.origin.y, radius + 1, '#ffffff');
      return;
    }
    if (this.phase === 'break') {
      const k = Math.min(1, this.t / this.cfg.breakTime);
      ctx.save();
      ctx.globalAlpha = 1 - k;
      this.drawScene(ctx, r, scene);
      ctx.restore();
      if (k < 0.35) this.drawCracks(ctx, r, k / 0.35);
      return;
    }
    this.drawScene(ctx, r, scene);
  }

  /** Partículas na frente dos lutadores (neve, chuva, brasas). */
  drawFront(ctx, r) {
    if (this.phase === 'cast' || this.phase === 'preview') return;
    const alpha = this.phase === 'break' ? 1 - Math.min(1, this.t / this.cfg.breakTime) : 1;
    ctx.save();
    ctx.globalAlpha = alpha;
    if (this.clash) {
      const bx = this.clashBoundary(r);
      const ownerLeft = this.clash.a.cx <= this.clash.b.cx;
      const [left, right] = ownerLeft ? [this, this.clash.other] : [this.clash.other, this];
      ctx.save();
      ctx.beginPath();
      ctx.rect(r.x - 4, r.y - 4, bx - r.x + 4, r.h + 8);
      ctx.clip();
      left.drawParticles(ctx, true);
      ctx.restore();
      ctx.save();
      ctx.beginPath();
      ctx.rect(bx, r.y - 4, r.x + r.w - bx + 4, r.h + 8);
      ctx.clip();
      right.drawParticles(ctx, true);
      ctx.restore();
      this.drawBoundary(ctx, r, bx);
    } else {
      this.drawParticles(ctx, true);
      if (this.def.fx === 'storm' && this.flash > 0) {
        ctx.fillStyle = 'rgba(220, 230, 255, ' + (this.flash * 1.6).toFixed(3) + ')';
        ctx.fillRect(r.x - 4, r.y - 4, r.w + 8, r.h + 8);
      }
      if (this.def.fx === 'forge' && this.flash > 0) {
        ctx.fillStyle = 'rgba(200, 228, 255, ' + (this.flash * 0.7).toFixed(3) + ')';
        ctx.fillRect(r.x - 4, r.y - 4, r.w + 8, r.h + 8);
      }
    }
    ctx.restore();
  }

  drawClash(ctx, r, scene) {
    const bx = this.clashBoundary(r);
    const ownerLeft = this.clash.a.cx <= this.clash.b.cx;
    const [left, right] = ownerLeft ? [this, this.clash.other] : [this.clash.other, this];
    ctx.save();
    ctx.beginPath();
    ctx.rect(r.x - 4, r.y - 4, bx - r.x + 4, r.h + 8);
    ctx.clip();
    left.drawScene(ctx, r, scene);
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.rect(bx, r.y - 4, r.x + r.w - bx + 4, r.h + 8);
    ctx.clip();
    right.drawScene(ctx, r, scene);
    ctx.restore();
  }

  /** Divisa elétrica entre os dois cenários do embate. */
  drawBoundary(ctx, r, bx) {
    let seed = Math.floor(this.clock * 30) * 977 + 13;
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    let x = bx;
    for (let y = Math.floor(r.y) - 2; y < r.y + r.h + 2; y += 3) {
      const nx = bx + Math.round((rnd() - 0.5) * 6);
      const x0 = Math.min(x, nx);
      ctx.fillStyle = '#fff3b0';
      ctx.fillRect(Math.round(x0) - 1, y, Math.abs(nx - x) + 3, 3);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.round(x0), y, Math.abs(nx - x) + 1, 3);
      x = nx;
    }
  }

  /** Rachaduras brancas quando o domínio quebra. */
  drawCracks(ctx, r, k) {
    let seed = 4242;
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    const cx = this.origin.x;
    const cy = this.origin.y;
    ctx.save();
    ctx.globalAlpha = 1 - k;
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 9; i++) {
      let a = rnd() * Math.PI * 2;
      let x = cx;
      let y = cy;
      const len = 60 + rnd() * 160;
      for (let d = 0; d < len * Math.min(1, k * 3 + 0.3); d += 2) {
        a += (rnd() - 0.5) * 0.5;
        x += Math.cos(a) * 2;
        y += Math.sin(a) * 2;
        ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
      }
    }
    ctx.restore();
  }

  /** Cenário completo: camadas com paralaxe, luzes animadas e partículas do fundo. */
  drawScene(ctx, r, scene) {
    const def = this.def;
    const mapW = scene.map.pixelWidth;
    const floor = scene.floorY;
    const imgs = def.layers.map((k) => Game.assets.get(k));
    ctx.fillStyle = def.dark;
    ctx.fillRect(r.x - 4, r.y - 4, r.w + 8, r.h + 8);
    const placeX = (img, factor) => {
      const mid = (mapW - r.w) / 2;
      const shift = (r.x - mid) * (1 - factor);
      return Math.round((mapW - img.width) / 2 + shift);
    };
    const [far, midL, floorImg] = imgs;
    const [f0, f1] = Game.DOMAIN_FACTORS;
    ctx.drawImage(far, placeX(far, f0), Math.round(floor - far.height));
    this.drawLights(ctx, r, floor, placeX(far, f0));
    if (def.stages) {
      // Nova Floresta: o meio é a floresta do tamanho atual; quando ela cresce, a nova brota do chão
      const n = Math.max(1, Math.min(def.stages.length, this.stage || 1));
      const cur = Game.assets.get(def.stages[n - 1]);
      const mx = placeX(cur, f1);
      const my = Math.round(floor - cur.height);
      const grow = n > 1 ? Math.min(1, this.stageT / 0.8) : 1;
      if (grow < 1) {
        const prev = Game.assets.get(def.stages[n - 2]);
        ctx.drawImage(prev, mx, my);
        const h = Math.round(cur.height * (1 - Math.pow(1 - grow, 2)));
        ctx.save();
        ctx.beginPath();
        ctx.rect(mx, my + cur.height - h, cur.width, h);
        ctx.clip();
        ctx.drawImage(cur, mx, my);
        ctx.restore();
      } else {
        ctx.drawImage(cur, mx, my);
      }
    } else {
      ctx.drawImage(midL, placeX(midL, f1), Math.round(floor - midL.height));
    }
    this.drawParticles(ctx, false);
    ctx.drawImage(floorImg, Math.round((mapW - floorImg.width) / 2), Math.round(floor));
    if (this.owner.shadow) {
      // domínio da Sombra: tudo afundado em roxo
      ctx.fillStyle = 'rgba(26, 8, 52, 0.5)';
      ctx.fillRect(r.x - 4, r.y - 4, r.w + 8, r.h + 8);
    }
  }

  /** Luzes que se mexem: aurora, holofotes, brilho da lava, fenda do abismo, relâmpagos. */
  drawLights(ctx, r, floor, farX) {
    const fx = this.def.fx;
    const t = this.clock;
    ctx.save();
    if (fx === 'snow') {
      // aurora: faixas onduladas verde-azuladas
      const bands = [['rgba(110, 255, 200, 0.16)', 0], ['rgba(120, 200, 255, 0.14)', 1.7], ['rgba(190, 140, 255, 0.10)', 3.1]];
      for (const [color, off] of bands) {
        ctx.fillStyle = color;
        for (let x = Math.floor(r.x) - 2; x < r.x + r.w + 2; x += 2) {
          const y = floor - 118 + Math.sin(x * 0.03 + t * 0.8 + off) * 10 + Math.sin(x * 0.011 + off) * 8;
          const h = 14 + Math.sin(x * 0.05 + t * 1.3 + off) * 6;
          ctx.fillRect(x, Math.round(y), 2, Math.max(2, Math.round(h)));
        }
      }
    } else if (fx === 'spotlights') {
      // holofotes varrendo o ringue
      for (let i = 0; i < 3; i++) {
        const sx = farX + 70 + i * 120;
        const ang = Math.sin(t * 0.9 + i * 2.1) * 0.5;
        ctx.fillStyle = i === 1 ? 'rgba(255, 240, 200, 0.10)' : 'rgba(255, 210, 160, 0.08)';
        for (let y = floor - 140; y < floor; y += 2) {
          const d = y - (floor - 140);
          const cx = sx + Math.tan(ang) * d;
          const half = 2 + d * 0.16;
          ctx.fillRect(Math.round(cx - half), y, Math.round(half * 2), 2);
        }
      }
    } else if (fx === 'embers') {
      // a lava pulsa
      const glow = 0.12 + 0.08 * Math.sin(t * 2.4);
      ctx.fillStyle = 'rgba(255, 110, 30, ' + glow.toFixed(3) + ')';
      ctx.fillRect(r.x - 4, floor - 60, r.w + 8, 60);
    } else if (fx === 'motes') {
      // a fenda do abismo respira
      const glow = 0.1 + 0.07 * Math.sin(t * 1.8);
      ctx.fillStyle = 'rgba(164, 108, 255, ' + glow.toFixed(3) + ')';
      const cx = farX + 192;
      for (let y = floor - 130; y < floor - 20; y += 2) {
        const half = 30 * Math.sin(((y - (floor - 130)) / 110) * Math.PI) + 4 + Math.sin(t * 3 + y * 0.2) * 2;
        ctx.fillRect(Math.round(cx - half), y, Math.round(half * 2), 2);
      }
    } else if (fx === 'storm' && this.skyBolt) {
      // relâmpago no fundo
      let seed = this.skyBolt.seed;
      const rnd = () => {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        return seed / 0x7fffffff;
      };
      let x = this.skyBolt.x;
      ctx.fillStyle = 'rgba(255, 250, 220, 0.9)';
      for (let y = floor - 150; y < floor - 50; y += 3) {
        const nx = x + Math.round((rnd() - 0.5) * 8);
        ctx.fillRect(Math.min(x, nx), y, Math.abs(nx - x) + 1, 3);
        if (rnd() < 0.12) ctx.fillRect(nx, y, Math.round((rnd() - 0.5) * 14), 1);
        x = nx;
      }
    } else if (fx === 'forge') {
      // o forno lá no fundo respira
      const glow = 0.1 + 0.06 * Math.sin(t * 2.1);
      ctx.fillStyle = 'rgba(255, 140, 40, ' + glow.toFixed(3) + ')';
      ctx.fillRect(r.x - 4, floor - 70, r.w + 8, 70);
      if (this.flash > 0 && this.flashSpot) {
        const k = this.flash / 0.18;
        for (let i = 4; i >= 1; i--) {
          ctx.fillStyle = 'rgba(190, 225, 255, ' + (0.12 * k * (5 - i) / 4).toFixed(3) + ')';
          const sz = i * 7;
          ctx.fillRect(Math.round(this.flashSpot.x - sz), Math.round(this.flashSpot.y - sz), sz * 2, sz * 2);
        }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(Math.round(this.flashSpot.x) - 1, Math.round(this.flashSpot.y) - 1, 3, 3);
      }
    } else if (fx === 'moon') {
      // a lua é um olho: a pupila (fenda preta) segue o adversário
      const mx = farX + 120;
      const my = floor - 168 + 80;
      const foe = this.foe;
      const dx = foe ? Math.max(-11, Math.min(11, (foe.cx - mx) * 0.08)) : 0;
      const px = Math.round(mx + dx);
      const blink = (t % 5) > 4.82;
      ctx.fillStyle = 'rgba(255, 60, 60, 0.35)';
      ctx.fillRect(px - 6, my - 20, 13, 41);
      ctx.fillStyle = '#120206';
      for (let dy = -18; dy <= 18; dy++) {
        const half = Math.round(3.5 * Math.sqrt(1 - (dy / 18.5) ** 2));
        if (blink && Math.abs(dy) > 2) continue;
        ctx.fillRect(px - half, my + dy, half * 2 + 1, 1);
      }
      ctx.fillStyle = '#ff9a9a';
      ctx.fillRect(px - 1, my - 10, 1, 3);
    } else if (fx === 'sand') {
      // o relógio do sol anda muito rápido (o tempo aqui não obedece ninguém)
      const cx = farX + 192;
      const cy = floor - 168 + 92;
      const hand = (ang, len, color) => {
        ctx.fillStyle = color;
        for (let k = 0; k < len; k++) ctx.fillRect(Math.round(cx + Math.cos(ang) * k), Math.round(cy + Math.sin(ang) * k), 1, 1);
      };
      hand(t * 3.2 - Math.PI / 2, 15, '#c8862f');
      hand(t * 0.4 - Math.PI / 2, 10, '#8a5a1a');
      ctx.fillStyle = 'rgba(255, 241, 184, ' + (0.08 + 0.05 * Math.sin(t * 2)).toFixed(3) + ')';
      ctx.fillRect(r.x - 4, floor - 40, r.w + 8, 40);
    } else if (fx === 'space') {
      // o disco de acreção gira em volta do buraco negro
      const cx = farX + 262;
      const cy = floor - 168 + 74;
      for (let i = 0; i < 40; i++) {
        const a = t * 1.6 + (i / 40) * Math.PI * 2;
        const rr = 34 + (i % 4) * 7;
        const x = Math.round(cx + Math.cos(a) * rr);
        const y = Math.round(cy + Math.sin(a) * rr * 0.19);
        if (Math.sin(a) < 0 && Math.abs(x - cx) < 26) continue; // atrás do buraco
        ctx.fillStyle = i % 5 === 0 ? '#ffffff' : i % 2 ? '#ffd6a0' : '#ff9ae6';
        ctx.fillRect(x, y, 2, 1);
      }
      const pulse = 0.12 + 0.08 * Math.sin(t * 2.4);
      ctx.fillStyle = 'rgba(255, 95, 210, ' + pulse.toFixed(3) + ')';
      for (let i = 0; i < 48; i++) {
        const a = (i / 48) * Math.PI * 2;
        ctx.fillRect(Math.round(cx + Math.cos(a) * 28), Math.round(cy + Math.sin(a) * 28), 1, 1);
      }
    } else if (fx === 'stage') {
      // holofote seguindo o adversário e o brilho da ribalta
      const foe = this.foe;
      if (foe) {
        const top = floor - 168;
        const sx = farX + 192 + Math.round((foe.cx - (farX + 192)) * 0.25);
        for (let y = top; y < floor; y += 2) {
          const k = (y - top) / (floor - top);
          const cx = sx + (foe.cx - sx) * k;
          const half = 3 + k * 20;
          ctx.fillStyle = 'rgba(255, 246, 216, ' + (0.05 + k * 0.08).toFixed(3) + ')';
          ctx.fillRect(Math.round(cx - half), y, Math.round(half * 2), 2);
        }
        ctx.fillStyle = 'rgba(255, 246, 216, 0.22)';
        ctx.fillRect(Math.round(foe.cx - 20), floor - 3, 40, 3);
        ctx.fillRect(Math.round(foe.cx - 14), floor - 5, 28, 2);
      }
      const glow = 0.1 + 0.04 * Math.sin(t * 3);
      ctx.fillStyle = 'rgba(255, 200, 120, ' + glow.toFixed(3) + ')';
      ctx.fillRect(r.x - 4, floor - 26, r.w + 8, 26);
    } else if (fx === 'forest') {
      // fachos de sol inclinados entre as copas, respirando devagar
      for (let i = 0; i < 4; i++) {
        const x0 = farX + 50 + i * 96 + Math.sin(t * 0.3 + i) * 6;
        const a = 0.05 + 0.03 * Math.sin(t * 0.9 + i * 1.7);
        ctx.fillStyle = 'rgba(255, 244, 180, ' + a.toFixed(3) + ')';
        for (let y = floor - 168; y < floor; y += 2) {
          const k = (y - (floor - 168)) / 168;
          ctx.fillRect(Math.round(x0 + k * 60), y, Math.round(10 + k * 14), 2);
        }
      }
      const glow = 0.05 + 0.02 * Math.sin(t * 1.3);
      ctx.fillStyle = 'rgba(200, 255, 140, ' + glow.toFixed(3) + ')';
      ctx.fillRect(r.x - 4, floor - 30, r.w + 8, 30);
    } else if (fx === 'chess') {
      // brilho rosa respirando sobre o tabuleiro e a casa do adversário marcada (Zugzwang chegando)
      const glow = 0.06 + 0.03 * Math.sin(t * 1.6);
      ctx.fillStyle = 'rgba(255, 143, 179, ' + glow.toFixed(3) + ')';
      ctx.fillRect(r.x - 4, floor - 34, r.w + 8, 34);
      const foe = this.foe;
      const c = Game.config.zugzwang;
      if (foe && !foe.ko && this.zug > c.still * 0.35 && (this.phase === 'active' || this.phase === 'reveal')) {
        const k = Math.min(1, this.zug / c.still);
        Game.drawSquare(ctx, Math.round(foe.cx), floor, 18, k, Math.floor(t * (8 + k * 16)) % 2);
      }
    } else if (fx === 'quarry') {
      // clarão laranja da detonação no fundo
      if (this.flash > 0 && this.flashSpot) {
        const k = this.flash / 0.16;
        for (let i = 4; i >= 1; i--) {
          ctx.fillStyle = 'rgba(255, 170, 80, ' + (0.1 * k * (5 - i) / 4).toFixed(3) + ')';
          const sz = i * 9;
          ctx.fillRect(Math.round(this.flashSpot.x - sz), Math.round(this.flashSpot.y - sz * 0.7), sz * 2, Math.round(sz * 1.4));
        }
      }
      const glow = 0.06 + 0.03 * Math.sin(t * 1.7);
      ctx.fillStyle = 'rgba(255, 150, 70, ' + glow.toFixed(3) + ')';
      ctx.fillRect(r.x - 4, floor - 50, r.w + 8, 50);
    } else if (fx === 'pages') {
      // velas tremulando: pequenos pontos de luz
      for (let i = 0; i < 6; i++) {
        const lx = farX + 30 + i * 62;
        const flick = Math.floor(t * 9 + i) % 3;
        ctx.fillStyle = 'rgba(255, 220, 140, 0.18)';
        ctx.fillRect(lx - 5, floor - 104 - flick, 11, 11);
      }
    }
    ctx.restore();
  }

  drawParticles(ctx, front) {
    for (const p of this.parts) {
      if (!!p.front !== front) continue;
      if (p.rain) {
        ctx.fillStyle = p.color;
        ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, p.len);
        continue;
      }
      if (p.page) {
        const flip = Math.floor((this.clock + p.sway) * 4) % 2;
        ctx.fillStyle = '#5c4a32';
        ctx.fillRect(Math.round(p.x) - 1, Math.round(p.y) - 1, flip ? 5 : 3, flip ? 3 : 5);
        ctx.fillStyle = p.color;
        ctx.fillRect(Math.round(p.x), Math.round(p.y), flip ? 3 : 1, flip ? 1 : 3);
        continue;
      }
      if (p.spark) {
        ctx.fillStyle = p.color;
        ctx.fillRect(Math.round(p.x), Math.round(p.y), p.front ? 2 : 1, 1);
        ctx.fillStyle = 'rgba(255, 154, 60, 0.6)';
        ctx.fillRect(Math.round(p.x - p.vx * 0.02), Math.round(p.y - p.vy * 0.02), 1, 1);
        continue;
      }
      if (p.feather) {
        const flip = Math.floor((this.clock + p.sway) * 3) % 2;
        ctx.fillStyle = p.color;
        ctx.fillRect(Math.round(p.x), Math.round(p.y), flip ? 3 : 1, flip ? 1 : 3);
        ctx.fillStyle = '#3a3445';
        ctx.fillRect(Math.round(p.x) + (flip ? 1 : 0), Math.round(p.y) + (flip ? 0 : 1), 1, 1);
        continue;
      }
      if (p.crow) {
        Game.drawCrow(ctx, p.x, p.y, p.dir, p.t, false);
        continue;
      }
      if (p.streak) {
        ctx.fillStyle = p.color;
        ctx.fillRect(Math.round(p.x), Math.round(p.y), p.front ? 3 : 2, 1);
        continue;
      }
      if (p.twinkle) {
        const k = Math.sin((p.t / p.life) * Math.PI);
        ctx.fillStyle = p.color;
        ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
        if (k > 0.5) {
          ctx.fillRect(Math.round(p.x) - 1, Math.round(p.y), 3, 1);
          ctx.fillRect(Math.round(p.x), Math.round(p.y) - 1, 1, 3);
        }
        continue;
      }
      if (p.shoot) {
        for (let i = 0; i < 8; i++) {
          ctx.fillStyle = i < 2 ? '#ffffff' : i < 5 ? 'rgba(255, 214, 244, 0.7)' : 'rgba(255, 150, 230, 0.35)';
          ctx.fillRect(Math.round(p.x - p.vx * 0.006 * i), Math.round(p.y - p.vy * 0.006 * i), 1, 1);
        }
        continue;
      }
      if (p.petal) {
        const flip = Math.floor((this.clock + p.sway) * 3) % 2;
        ctx.fillStyle = p.color;
        ctx.fillRect(Math.round(p.x), Math.round(p.y), flip ? 2 : 1, flip ? 1 : 2);
        ctx.fillStyle = p.leaf ? '#2f6a2a' : '#8e1a32';
        ctx.fillRect(Math.round(p.x) + (flip ? 1 : 0), Math.round(p.y) + 1, 1, 1);
        continue;
      }
      if (p.puff) {
        const k = p.t / p.life;
        const sz = Math.round(p.size * (1 + k * 1.5));
        ctx.save();
        ctx.globalAlpha *= Math.max(0, 0.8 - k * 0.8);
        ctx.fillStyle = p.color;
        ctx.fillRect(Math.round(p.x - sz / 2), Math.round(p.y - sz / 2), sz, sz);
        ctx.restore();
        continue;
      }
      if (p.square) {
        const sz = p.size;
        ctx.fillStyle = '#ff8fb3';
        ctx.fillRect(Math.round(p.x) - 1, Math.round(p.y) - 1, sz + 2, sz + 2);
        ctx.fillStyle = p.color;
        ctx.fillRect(Math.round(p.x), Math.round(p.y), sz, sz);
        continue;
      }
      if (p.flashbulb) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(Math.round(p.x) - 1, Math.round(p.y), 3, 1);
        ctx.fillRect(Math.round(p.x), Math.round(p.y) - 1, 1, 3);
        continue;
      }
      const fade = p.life < 3 && p.t > p.life * 0.7 ? Math.floor((p.t * 20) % 2) : 1;
      if (!fade) continue;
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size || 1, p.confetti ? 2 : (p.size || 1));
    }
  }

  // ------------------------------------------------------------------ utilidades
  /** Recorte em círculo feito de faixas (borda em pixels, sem serrilhado borrado). */
  static clipCircle(ctx, cx, cy, radius) {
    ctx.beginPath();
    const R = Math.ceil(radius);
    for (let dy = -R; dy <= R; dy += 2) {
      const half = Math.floor(Math.sqrt(Math.max(0, R * R - dy * dy)));
      ctx.rect(cx - half, cy + dy, half * 2 + 1, 2);
    }
    ctx.clip();
  }

  static ringPixels(ctx, cx, cy, radius, color) {
    ctx.fillStyle = color;
    const steps = Math.max(24, Math.round(radius * 6.3));
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      ctx.fillRect(Math.round(cx + Math.cos(a) * radius), Math.round(cy + Math.sin(a) * radius), 2, 2);
    }
  }
};