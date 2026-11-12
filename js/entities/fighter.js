/*
 * Fighter: lutador controlado pelo jogador ou pela CPU (mesmas regras para os dois).
 *
 * Modo "fight" (estilo Street Fighter): vida, defesa segurando para trás (em pé ou
 * agachado), golpes aéreos que só se defendem em pé, atordoamento, nocaute, pulo
 * com arco fixo, dash com toque duplo, agachar (desvia da bola pequena e do livro),
 * ↓ ↘ → + soco para o especial (↓ + especial ou ↓ ↙ ← + soco para o segundo),
 * cancelamento do golpe no especial, barra de super com 2 níveis (super e Expansão
 * de Domínio), agarrão (→ ou ← + soco colado no adversário; soco na hora certa
 * escapa), congelamento (apertar botões quebra o gelo), queimadura e pés soldados
 * no chão (Soldador: não anda nem pula, mas ainda defende e bate), cópia de especiais
 * e contra-ataque (Corvo), rebobinar e câmera lenta (Ampulheta), flutuar e planar (Órbita).
 * Modo "training": movimento de plataforma (aceleração, pulo variável) contra bonecos.
 *
 * Quem controla é um objeto com axisX(), isHeld(ação) e consumePress(ação):
 * o teclado/toque/controle (Game.Input) ou a CPU (Game.CpuController).
 * O que cada personagem sabe fazer vem de characters.js, sprites.js e supers.js.
 */
window.Game = window.Game || {};

// Estados em que o lutador não responde aos comandos
Game.REACT_STATES = new Set([
  'hurt', 'block', 'launched', 'down', 'getup', 'dizzy', 'ko', 'win', 'intro', 'frozen',
  'super', 'throwing', 'grabbed', 'recover', 'iced', 'floating', 'puppet',
]);
// Estados em que golpes atravessam o lutador
Game.INVULNERABLE_STATES = new Set(['launched', 'down', 'getup', 'ko', 'win', 'intro', 'frozen', 'throwing', 'grabbed']);

Game.Fighter = class Fighter extends Game.Entity {
  constructor(x, y, charKey, opts = {}) {
    const cfg = Game.config.player;
    super(x, y, cfg.hitbox.w, cfg.hitbox.h);
    this.cfg = cfg;
    this.fc = Game.config.fight;
    this.mode = opts.mode || 'training';
    this.team = opts.team || 1;
    this.shadow = !!opts.shadow;          // versão sombria (chefe do arcade)
    this.controller = opts.controller || null; // CPU ou outro jogador; sem controller usa a entrada principal
    this.opponent = null;
    this.facing = opts.facing || 1;
    this.maxHp = this.fc.maxHp;
    this.hp = this.maxHp;
    this.stun = 0;
    this.meter = 0;
    this.maxMeter = this.fc.meter.max;
    this.infiniteMeter = false;           // opção do treino
    this.ko = false;
    this.comboTaken = 0;                  // golpes seguidos recebidos sem se recuperar
    this.standH = cfg.hitbox.h;
    this.sheets = {};
    this.motion = [];                     // histórico de direções para ↓ ↘ →
    this.lastTap = { left: -9, right: -9 };
    this.clock = 0;
    this.specialBuffered = 0;
    this.speedMult = 1;                   // domínio: quem expandiu anda mais rápido, o outro mais devagar
    this.inDomain = false;                // está com a própria Expansão de Domínio ativa
    this.burn = null;                     // queimadura (Fornalha Eterna)
    this.hidden = false;                  // sumido no meio do teletransporte
    this.aura = 0;                        // contorno brilhante (sinal de mão do domínio)
    this.freezeImmune = 0;                // logo depois de sair do gelo não congela de novo
    this.rooted = 0;                      // pés soldados no chão (segundos)
    this.copied = null;                   // Corvo: especial copiado pelo olho
    this.eyeFlash = 0;                    // Corvo: brilho do olho ao copiar
    this.history = [];                    // posições e vida recentes (Rebobinar)
    this.histTimer = 0;
    this.floating = false;                // Órbita planando
    this.floatT = 0;                      // flutuando sem controle (Antigravidade)
    this.slamDamage = 0;                  // dano ao despencar depois de flutuar
    this.lastSpecial = null;
    this.inverted = 0;                    // Fios Trocados: esquerda e direita trocadas (segundos)
    this.resetTimers();
    this.setCharacter(charKey || Game.characterOrder[0]);
  }

  resetTimers() {
    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;
    this.punchBufferTimer = 0;
    this.punchQueued = 0;        // apertos de soco na fila (J J J rápido sai o combo inteiro)
    this.comboTimer = 0;
    this.comboIndex = -1;
    this.guardTimer = 0;
    this.specialCooldown = 0;
    this.specialBufferedKind = 'special';
    this.switchCooldown = 0;
    this.dashCooldown = 0;
    this.stateTimer = 0;
    this.stateTime = 0;
    this.invuln = 0;
    this.flash = 0;
    this.specialBuffered = 0;
  }

  setCharacter(key) {
    const ch = Game.characters[key];
    if (!ch) throw new Error('Personagem "' + key + '" não existe em characters.js.');
    this.charKey = key;
    this.char = ch;
    const sheetKey = ch.sprite + (this.shadow ? ':sombra' : '');
    if (!this.sheets[sheetKey]) {
      const image = this.shadow ? Game.shadowImage(ch.sprite) : null;
      this.sheets[sheetKey] = new Game.SpriteSheet(Game.sprites[ch.sprite], image);
    }
    this.sheet = this.sheets[sheetKey];
    this.anim = new Game.Animator(Game.sprites[ch.sprite]);
    this.attack = null;
    this.charging = null;
    this.comboIndex = -1;
    this.guardTimer = 0;
    this.state = 'idle';
    this.play('idle');
  }

  /** Nome mostrado no HUD. */
  get displayName() {
    return this.shadow ? 'SOMBRA' : this.char.short;
  }

  /** Toca a animação de um papel (idle, hurt...) traduzida pelo personagem. */
  play(role, restart = false) {
    const name = this.char.anims[role] || role;
    const anims = this.sheet.def.animations;
    this.anim.play(anims[name] ? name : this.char.anims.idle, restart);
  }

  // ------------------------------------------------------------------ utilidades
  get cx() { return this.x + this.w / 2; }
  get feet() { return this.y + this.h; }

  /** -1 se o outro está à esquerda, 1 se está à direita. */
  dirTo(other) {
    return other.x + other.w / 2 < this.cx ? -1 : 1;
  }

  canAct() {
    return !Game.REACT_STATES.has(this.state);
  }

  /** hit (opcional): golpes de super continuam acertando quem já está voando (malabarismo). */
  invulnerable(hit) {
    if (hit && hit.super && this.state === 'launched' && !this.ko) return this.invuln > 0;
    return this.invuln > 0 || Game.INVULNERABLE_STATES.has(this.state);
  }

  /** Desenhado por cima de quem não está atacando. */
  get layer() {
    return this.attack || this.state === 'super' || this.state === 'throwing' ? 2 : 1;
  }

  /** Muda a altura da hitbox mantendo os pés no lugar (agachar). */
  setHeight(h) {
    if (h === this.h) return;
    this.y += this.h - h;
    this.h = h;
  }

  /** Coloca de pé num ponto (começo de cada round). */
  placeAt(footX, footY) {
    this.setHeight(this.standH);
    this.x = footX - this.w / 2;
    this.y = footY - this.h;
    this.vx = 0;
    this.vy = 0;
    this.onGround = true;
    this.savePrev();
  }

  resetForRound() {
    this.hp = this.maxHp;
    this.stun = 0;
    this.ko = false;
    this.comboTaken = 0;
    this.attack = null;
    this.charging = null;
    this.superData = null;
    this.throwData = null;
    this.grabbedBy = null;
    this.motion = [];
    this.burn = null;
    this.hidden = false;
    this.aura = 0;
    this.freezeImmune = 0;
    this.rooted = 0;
    this.copied = null;
    this.eyeFlash = 0;
    this.history = [];
    this.floating = false;
    this.floatT = 0;
    this.slamDamage = 0;
    this.lastSpecial = null;
    this.inverted = 0;
    this.inDomain = false;
    this.speedMult = 1;
    this.resetTimers();
    this.state = 'intro';
    this.stateTime = 0;
    this.play(this.char.intro || 'guard', true);
  }

  /** Fim da apresentação do round: o lutador pode se mexer. */
  startFighting() {
    if (this.state === 'intro') this.enterIdle();
  }

  addMeter(n) {
    // durante a própria expansão a barra não enche (senão um domínio puxaria outro)
    if (this.mode !== 'fight' || !n || (this.inDomain && n > 0)) return;
    this.meter = Math.max(0, Math.min(this.maxMeter, this.meter + n));
  }

  /** 1 nível da barra: super. */
  get superReady() {
    return this.meter >= this.fc.meter.superCost;
  }

  /** As 2 barras cheias: Expansão de Domínio. */
  get domainReady() {
    return this.meter >= this.fc.meter.domainCost && !this.inDomain && !!Game.DOMAINS[this.charKey];
  }

  // ------------------------------------------------------------------ troca (fase livre)
  switchCharacter(scene) {
    const order = Game.characterOrder;
    const next = order[(order.indexOf(this.charKey) + 1) % order.length];
    this.setCharacter(next);
    this.switchCooldown = 0.45;
    scene.effects.burst(this.cx, this.y + this.h / 2, ['#ffffff', '#e2c4ff', '#a46cff', '#6a2fc0'], 28, { speed: 170, lift: 150, gravity: 160 });
    scene.effects.ring(this.cx, this.y + this.h / 2, '#d6a8ff');
    if (this.char.intro) this.startAttack(this.char.intro);
    Game.events.emit('switch', { key: next, character: this.char, fighter: this });
  }

  /**
   * Entrada com memória curta: um aperto vale por uma janela pequena (Fighter.BUFFER) e
   * depois some. Assim um golpe apertado durante outro sai assim que der, mas apertos
   * velhos (no meio de um combo que você levou, por exemplo) não disparam do nada depois.
   */
  buffered(raw, dt) {
    let b = this.inputBuf;
    // Fios Trocados: esquerda vira direita (andar, pular, defender, dash e comandos)
    const swap = (a) => (this.inverted > 0 ? (a === 'left' ? 'right' : a === 'right' ? 'left' : a) : a);
    if (!b || b.raw !== raw) {
      b = this.inputBuf = { raw, t: {} };
      b.wrapper = {
        axisX: () => (this.inverted > 0 ? -raw.axisX() : raw.axisX()),
        isHeld: (a) => raw.isHeld(swap(a)),
        consumePress: (a) => {
          const ok = (b.t[a] || 0) > 0;
          b.t[a] = 0;
          return ok;
        },
        clearPresses: () => {
          b.t = {};
          if (raw.clearPresses) raw.clearPresses();
          else if (raw.presses) raw.presses = {};
        },
      };
      if (raw.mash) b.wrapper.mash = (d) => raw.mash(d);
    }
    for (const a in b.t) b.t[a] -= dt;
    for (const [a, w] of Game.Fighter.BUFFER) if (raw.consumePress(a)) b.t[swap(a)] = w;
    return b.wrapper;
  }

  // ------------------------------------------------------------------ atualização
  update(dt, input, scene) {
    const raw = this.controller || input;
    this.sceneRef = scene;
    this.guarding = false;
    this.clock += dt;
    this.stateTime += dt;
    this.flash = Math.max(0, this.flash - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    this.switchCooldown -= dt;
    this.dashCooldown -= dt;
    this.aura = Math.max(0, this.aura - dt);
    this.eyeFlash = Math.max(0, this.eyeFlash - dt);
    this.inverted = Math.max(0, this.inverted - dt);
    if (this.mode === 'fight') this.recordHistory(dt);
    if (this.state !== 'iced') this.freezeImmune = Math.max(0, this.freezeImmune - dt);
    if (this.rooted > 0) {
      this.rooted = Math.max(0, this.rooted - dt);
      if (Math.random() < 0.25) Game.sparkBurst(scene, this.cx + (Math.random() - 0.5) * 8, this.feet - 1, 1, 50);
    }
    if (this.infiniteMeter) this.meter = this.maxMeter;
    if (this.mode === 'fight' && this.state !== 'dizzy') {
      this.stun = Math.max(0, this.stun - this.fc.stun.decayPerSec * dt);
    }
    if (this.burn) this.updateBurn(dt, scene);

    if (this.controller && this.controller.update) this.controller.update(dt, this, this.opponent, scene);
    // na luta, cada botão apertado fica "guardado" por alguns centésimos (não para sempre);
    // lido depois da CPU decidir, para ↓ + botão chegarem juntos
    const inp = this.mode === 'fight' ? this.buffered(raw, dt) : raw;
    this.lastInput = inp;

    if (this.state === 'grabbed') {
      // preso: quem agarrou controla a posição; soco na hora certa escapa
      if (inp.consumePress('punch')) this.techPressed = true;
      this.anim.update(dt);
      return;
    }
    if (this.state === 'puppet') {
      // pendurado nos fios do Espetáculo: quem mexe é a Marionete
      this.anim.update(dt);
      if (this.stateTime > 3) {
        this.state = 'launched'; // segurança: se o espetáculo sumiu, cai
        this.onGround = false;
        this.play('knockFly', true);
      }
      return;
    }
    // Teatro das Marionetes: o adversário fica sempre preso por um fio
    if (this.inDomain && this.char.special === 'thread' && this.mode === 'fight' && this.opponent && !this.opponent.ko
        && !scene.entities.some((e) => e instanceof Game.PuppetString && e.owner === this && !e.dead)) {
      Game.PuppetString.attach(this, this.opponent, scene, 99, true);
    }
    if (this.state === 'iced') {
      // congelado: cada botão apertado racha um pouco o gelo
      for (const a of ['punch', 'special', 'jump', 'super']) {
        if (inp.consumePress(a)) {
          this.stateTimer -= this.fc.freeze.mashCut;
          this.flash = 0.03;
        }
      }
    }

    let gravityScale = 1;
    if (this.state === 'super') Game.Supers[this.superData.kind].update(this, dt, scene);
    else if (this.state === 'throwing') this.updateThrow(dt, scene);
    else if (this.state === 'floating') gravityScale = this.updateFloat(dt, scene);
    else if (this.canAct() && !scene.locked) gravityScale = this.control(dt, inp, scene);
    else this.react(dt, scene);
    if (!this.canAct() || scene.locked) this.floating = false;

    const physics = Game.config.physics;
    // Horizonte de Eventos (domínio do Órbita): gravidade baixa para os dois
    const dom = scene.domain;
    const low = dom && dom.def.lowGravity && dom.owner.inDomain ? dom.def.lowGravity : 1;
    const chaosG = scene.chaos ? scene.chaos.gravity : 1; // Caos: Lua
    this.vy = Math.min(this.vy + physics.gravity * gravityScale * low * chaosG * dt, physics.maxFallSpeed);
    const wasAir = !this.onGround;
    const impact = this.vy;
    this.moveAndCollide(dt, scene.map);
    if (wasAir && this.onGround) this.onLand(scene, impact);

    this.updateAnimation(dt);
    this.resolveAttack(scene);
  }

  /** Estados sem controle: apanhando, defendendo, caído, apresentação, fim de round... */
  react(dt, scene) {
    const ice = scene.chaos && scene.chaos.ice ? 0.3 : 1; // Caos: chão de gelo, escorrega mais
    const slow = (v, rate) => {
      const d = rate * ice * dt;
      return Math.abs(v) <= d ? 0 : v - Math.sign(v) * d;
    };
    if (!this.onGround) return; // no ar só a gravidade age
    switch (this.state) {
      case 'hurt':
      case 'block':
      case 'recover':
        this.vx = slow(this.vx, 600);
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) this.enterIdle();
        break;
      case 'dizzy':
        this.vx = slow(this.vx, 600);
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) {
          this.stun = 0;
          this.enterIdle();
        }
        break;
      case 'down':
        this.vx = slow(this.vx, 500);
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) {
          this.state = 'getup';
          this.stateTime = 0;
          this.play('getup', true);
        }
        break;
      case 'getup':
        this.vx = 0;
        if (this.anim.finished) {
          this.stun = 0;
          this.invuln = 0.2;
          this.enterIdle();
        }
        break;
      case 'intro':
        this.vx = 0;
        if (this.anim.finished) this.play('guard');
        break;
      case 'iced':
        this.vx = slow(this.vx, 900);
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) {
          this.shatterIce(scene, false);
          this.enterIdle();
        }
        break;
      default: // ko, win, frozen ou cena travada (fim do tempo)
        this.vx = slow(this.vx, 500);
        if (this.attack && this.anim.finished) this.attack = null;
    }
  }

  enterIdle() {
    this.state = 'idle';
    this.stateTime = 0;
    this.attack = null;
    this.setHeight(this.standH);
    this.play(this.mode === 'fight' || this.guardTimer > 0 ? 'guard' : 'idle');
  }

  /** Breve momento vulnerável depois de um golpe arriscado. */
  enterRecover(time) {
    this.state = 'recover';
    this.stateTime = 0;
    this.stateTimer = time;
    this.attack = null;
    this.play('crouch', true);
  }

  onLand(scene, impact = 0) {
    if (this.state === 'launched' && !this.bounced && impact > 240 && this.mode === 'fight') {
      // queda forte: quica uma vez no chão antes de ficar caído (dá peso ao golpe)
      this.bounced = true;
      this.onGround = false;
      this.vy = -Math.min(150, impact * 0.32);
      this.vx *= 0.55;
      scene.effects.burst(this.cx, this.feet, ['#ece6d6', '#c8bfa9', '#a89f8a'], 8, { speed: 100, lift: 60 });
      scene.effects.shake(0.08, 1);
      Game.events.emit('bounce', { target: this });
      return;
    }
    if (this.state === 'launched' && this.slamDamage > 0) {
      // Antigravidade: despencou de volta no chão
      const dmg = this.slamDamage;
      this.slamDamage = 0;
      this.hp = Math.max(this.noKo ? 1 : 0, this.hp - (this.mode === 'fight' ? dmg : 0));
      this.flash = 0.06;
      scene.effects.shake(0.18, 3);
      scene.effects.ring(this.cx, this.feet - 2, '#ffb3ee', 18);
      Game.events.emit('gravSlam', { target: this, damage: dmg });
      if (this.hp <= 0 && !this.ko) {
        this.ko = true;
        Game.events.emit('ko', { loser: this, attacker: this.opponent || this });
      }
    }
    if (this.state === 'launched') {
      this.state = this.ko ? 'ko' : 'down';
      this.stateTime = 0;
      this.stateTimer = this.fc.downTime;
      this.vx *= 0.3;
      this.play('lie', true);
      scene.effects.burst(this.cx, this.feet, ['#ece6d6', '#c8bfa9', '#a89f8a'], 10, { speed: 120, lift: 70 });
      scene.effects.shake(0.1, 1);
      Game.events.emit('land', { target: this });
      return;
    }
    if (this.attack && this.attack.def.rise) {
      // gancho ascendente: cai e fica um instante aberto
      this.vx = 0;
      this.enterRecover(Game.config.rise.landLag);
      return;
    }
    if (this.attack && this.attack.diving) {
      // mergulho: poeira de gelo no chão e um instante aberto (menos se acertou)
      const a = this.attack;
      scene.effects.burst(this.cx + this.facing * 6, this.feet, ['#ffffff', '#cfefff', '#7cc8ff'], 8, { speed: 110, lift: 60 });
      this.vx = 0;
      this.attack = null;
      if (this.mode === 'fight') this.enterRecover(a.landed ? 0.06 : 0.16);
      return;
    }
    if (this.mode === 'fight') {
      // aterrissou do pulo: o golpe aéreo acaba junto
      if (this.state === 'super') return;
      this.vx = 0;
      if (this.attack && this.attack.kind === this.char.airAttack && this.attack.air) this.attack = null;
      if (this.state === 'jump') this.state = 'idle';
      Game.events.emit('landSoft', { target: this });
    }
  }

  // ------------------------------------------------------------------ comandos
  control(dt, inp, scene) {
    if (this.mode === 'training' && !this.controller && inp.consumePress('switch') && this.switchCooldown <= 0) {
      this.switchCharacter(scene);
    }
    if (this.mode === 'fight') {
      if (inp.consumePress('domain') && this.tryDomain(scene)) return 1;
      if (inp.consumePress('super') && this.trySuper(scene)) return 1;
      this.faceOpponent();
    } else {
      inp.consumePress('domain');
    }
    this.trackMotion(inp);
    this.updateSpecial(dt, inp, scene);
    this.updatePunch(dt, inp, scene);
    if (this.state === 'throwing') return 1;
    return this.mode === 'fight' ? this.moveFight(dt, inp) : this.movePlatform(dt, inp);
  }

  faceOpponent() {
    const o = this.opponent;
    if (!o || !this.onGround || this.attack || this.charging || this.state === 'dash') return;
    this.facing = this.dirTo(o);
  }

  /** Guarda a sequência de direções (relativas a quem está na frente) para ↓ ↘ →. */
  trackMotion(inp) {
    const x = inp.axisX() * this.facing; // 1 = para frente
    const down = inp.isHeld('down');
    const code = down ? (x > 0 ? 'df' : x < 0 ? 'db' : 'd') : (x > 0 ? 'f' : x < 0 ? 'b' : 'n');
    const last = this.motion[this.motion.length - 1];
    if (!last || last.code !== code) this.motion.push({ code, t: this.clock });
    if (this.motion.length > 8) this.motion.shift();
  }

  /** true se ↓ ↘ → foi feito nos últimos 0,5 s (o ↘ pode ser pulado no teclado). */
  quarterCircle() {
    const recent = this.motion.filter((m) => this.clock - m.t < 0.5).map((m) => m.code);
    const iD = recent.findIndex((c) => c === 'd' || c === 'db');
    if (iD < 0) return false;
    return recent.slice(iD + 1).includes('f');
  }

  /** true se ↓ ↙ ← foi feito nos últimos 0,5 s (segundo especial). */
  quarterCircleBack() {
    const recent = this.motion.filter((m) => this.clock - m.t < 0.5).map((m) => m.code);
    const iD = recent.findIndex((c) => c === 'd' || c === 'df');
    if (iD < 0) return false;
    return recent.slice(iD + 1).includes('b');
  }

  /** Tem golpe vindo na minha direção (para a defesa por proximidade)? */
  threatened() {
    const o = this.opponent;
    const scene = this.sceneRef;
    if (!o || !scene) return false;
    const d = Math.abs(o.cx - this.cx);
    if (o.state === 'super' && d < 230) return true;
    const a = o.attack;
    if (a && a.def.hit && !a.hitDone && d < 80) return true;
    if (a && (a.def.release !== undefined || a.def.flame) && d < 120) return true;
    for (const e of scene.entities) {
      if (e.dead || e === o || !e.team || e.team === this.team) continue;
      if (e instanceof Game.Projectile) {
        if (Math.sign(e.vx) === Math.sign(this.cx - e.cx) && Math.abs(e.cx - this.cx) < 110) return true;
      } else if (e instanceof Game.Strike) {
        if (e.phase === 'warn' && Math.abs(e.cxPos - this.cx) < 42) return true;
      } else if (e.x !== undefined && e.w && Math.abs(e.x + e.w / 2 - this.cx) < 110 && !(e instanceof Game.Fighter)) {
        if (e instanceof Game.TorchFlame || e instanceof Game.CrowFlock || e instanceof Game.Beam || e instanceof Game.BlizzardWave) return true;
      }
    }
    return false;
  }

  /** Mergulho (Gélida): desce em linha reta até o chão. Retorna a escala da gravidade. */
  handleDive() {
    const a = this.attack;
    if (!a || !a.def.dive || this.onGround || this.anim.index < a.def.dive.frame) return null;
    if (a.landed) {
      if (!a.bounced) {
        // acertou: quica para trás e cai normalmente
        a.bounced = true;
        a.diving = false;
        this.vy = -170;
        this.vx = -this.facing * 60;
      }
      return 1;
    }
    a.diving = true;
    this.vx = this.facing * a.def.dive.vx;
    this.vy = a.def.dive.vy;
    return 0;
  }

  /** Gancho ascendente: no quadro certo o lutador sai do chão. */
  handleRise() {
    const a = this.attack;
    if (!a || !a.def.rise || a.risen || this.anim.index < a.def.rise.frame) return false;
    a.risen = true;
    this.vy = -a.def.rise.vy;
    this.vx = this.facing * a.def.rise.vx;
    this.onGround = false;
    this.invuln = Math.max(this.invuln, a.def.rise.invuln);
    Game.events.emit('rise', { fighter: this });
    return true;
  }

  movePlatform(dt, inp) {
    const c = this.cfg;
    if (this.handleRise()) return 1;
    const dive = this.handleDive();
    if (dive !== null) return dive;
    let dir = inp.axisX();
    if ((this.attack || this.charging) && this.onGround) dir = 0;
    const dashing = this.attack && this.attack.def.dash && this.anim.index === this.attack.def.dash.frame;
    if (dashing) {
      this.vx = this.facing * Game.config.dash.speed;
    } else if (dir !== 0) {
      const accel = this.onGround ? c.groundAccel : c.airAccel;
      const turning = this.vx !== 0 && Math.sign(this.vx) !== dir;
      this.vx += dir * accel * (turning ? c.turnBoost : 1) * dt;
      this.vx = Math.max(-c.maxSpeed, Math.min(c.maxSpeed, this.vx));
      if (!this.attack && !this.charging) this.facing = dir;
    } else if (!(this.attack && this.attack.risen)) {
      const decel = (this.onGround ? c.groundDecel : c.airDecel) * dt;
      this.vx = Math.abs(this.vx) <= decel ? 0 : this.vx - Math.sign(this.vx) * decel;
    }
    this.coyoteTimer = this.onGround ? c.coyoteTime : this.coyoteTimer - dt;
    this.jumpBufferTimer = inp.consumePress('jump') ? c.jumpBuffer : this.jumpBufferTimer - dt;
    if (this.jumpBufferTimer > 0 && this.coyoteTimer > 0 && !this.charging && !this.attack) {
      this.vy = -c.jumpSpeed;
      this.onGround = false;
      this.coyoteTimer = 0;
      this.jumpBufferTimer = 0;
      Game.events.emit('jump');
    }
    this.state = this.onGround ? (Math.abs(this.vx) > 6 ? 'walk' : 'idle') : 'jump';
    if (this.vy < 0 && !inp.isHeld('jump') && !(this.attack && this.attack.risen)) return c.jumpCutGravity;
    if (this.vy > 0) return c.fallGravity;
    return 1;
  }

  moveFight(dt, inp) {
    const fc = this.fc;
    if (this.handleRise()) return 1;
    const dive = this.handleDive();
    if (dive !== null) return dive;
    const rooted = this.rooted > 0 && this.onGround;
    if (rooted) inp.consumePress('jump'); // pés soldados: não pula
    // dash com toque duplo (para frente ou para trás)
    for (const side of ['left', 'right']) {
      if (!inp.consumePress(side)) continue;
      const dir = side === 'left' ? -1 : 1;
      const free = this.onGround && !this.attack && !this.charging && this.state !== 'dash' && !rooted;
      if (free && this.dashCooldown <= 0 && this.clock - this.lastTap[side] < fc.dash.doubleTap) {
        this.state = 'dash';
        this.stateTime = 0;
        this.dashDir = dir;
        this.setHeight(this.standH);
        this.dashCooldown = fc.dash.cooldown;
        this.lastTap[side] = -9;
        Game.events.emit('dash', { fighter: this });
      } else {
        this.lastTap[side] = this.clock;
      }
    }
    if (this.state === 'dash') {
      if (this.stateTime < fc.dash.time) {
        const forward = this.dashDir === this.facing;
        this.vx = this.dashDir * fc.dash.speed * (forward ? 1 : 0.8);
        return 1;
      }
      this.state = 'idle';
    }
    if (!this.onGround) {
      // Órbita: segurando o pulo enquanto cai, plana devagar e escolhe a direção
      if (this.char.float && inp.isHeld('jump') && this.vy > -30 && !this.attack) {
        const g = Game.config.glide;
        this.floating = true;
        this.vx += (inp.axisX() * g.airSpeed - this.vx) * Math.min(1, dt * 5);
        if (this.vy > g.maxFall) this.vy = g.maxFall;
        return g.gravity;
      }
      this.floating = false;
      return 1; // pulo de arco fixo: sem controle no ar
    }
    this.floating = false;

    const dashing = this.attack && this.attack.def.dash && this.anim.index === this.attack.def.dash.frame;
    if (dashing) {
      // no Ringue Sem Fim a investida sai mais rápida e mais longa
      this.vx = this.facing * Game.config.dash.speed * (this.inDomain ? 1.35 : 1);
      return 1;
    }
    if (this.attack || this.charging) {
      const d = 900 * dt;
      this.vx = Math.abs(this.vx) <= d ? 0 : this.vx - Math.sign(this.vx) * d;
      return 1;
    }
    const dir = inp.axisX();
    const crouching = inp.isHeld('down');
    if (inp.consumePress('jump') && !crouching) {
      this.vy = -fc.jump.vy;
      this.vx = dir === 0 ? 0 : dir * (dir === this.facing ? fc.jump.vxForward : fc.jump.vxBack);
      this.onGround = false;
      this.state = 'jump';
      this.setHeight(this.standH);
      Game.events.emit('jump');
      return 1;
    }
    if (crouching) {
      this.state = 'crouch';
      this.vx = 0;
      this.setHeight(fc.crouchHeight);
      return 1;
    }
    this.setHeight(this.standH);
    const ice = this.sceneRef && this.sceneRef.chaos && this.sceneRef.chaos.ice;
    if (dir !== 0 && dir === -this.facing && this.threatened()) {
      // defesa por proximidade: segurando para trás com golpe chegando, para e defende
      this.vx = ice ? this.vx * Math.max(0, 1 - dt * 2) : 0;
      this.state = 'idle';
      this.guarding = true;
    } else if (dir !== 0) {
      // pés soldados: segurar para trás ainda defende, mas o corpo não sai do lugar
      const want = rooted ? 0 : dir * (dir === this.facing ? fc.walkForward : fc.walkBack) * this.speedMult;
      this.vx = ice ? this.vx + (want * 1.15 - this.vx) * Math.min(1, dt * 2.6) : want; // gelo: demora a pegar velocidade
      this.state = rooted ? 'idle' : 'walk';
    } else {
      this.vx = ice ? this.vx * Math.max(0, 1 - dt * 1.4) : 0; // gelo: continua deslizando
      this.state = Math.abs(this.vx) > 6 ? 'walk' : 'idle';
    }
    return 1;
  }

  // ------------------------------------------------------------------ golpes
  updatePunch(dt, inp, scene) {
    const c = this.cfg;
    if (inp.consumePress('punch')) {
      // cada aperto entra na fila (até 2 de reserva): apertando rápido sai o combo inteiro
      this.punchQueued = Math.min(3, (this.punchBufferTimer > 0 ? this.punchQueued : 0) + 1);
      this.punchBufferTimer = c.punchBuffer;
    } else {
      this.punchBufferTimer -= dt;
    }
    this.comboTimer -= dt;
    if (this.punchBufferTimer <= 0 || this.charging) return;
    // ↓ ↘ → + soco = especial; ↓ ↙ ← + soco = segundo especial (quem tiver)
    if (this.mode === 'fight' && this.char.special2 && this.quarterCircleBack() && this.trySpecial2(scene)) {
      this.punchBufferTimer = 0;
      this.motion = [];
      return;
    }
    if (this.mode === 'fight' && this.quarterCircle() && this.trySpecial(scene, true)) {
      this.punchBufferTimer = 0;
      this.motion = [];
      return;
    }
    // → ou ← + soco colado no adversário = agarrão
    if (!this.attack && this.tryGrab(inp, scene)) {
      this.punchBufferTimer = 0;
      return;
    }
    const combo = this.char.combo;
    const next = () => {
      this.comboIndex = (this.comboIndex + 1) % combo.length;
      return combo[this.comboIndex];
    };
    const queued = this.punchQueued;
    const keepQueue = () => {
      // depois de começar um golpe do combo pelo soco, o resto da fila continua valendo
      if (queued > 1 && this.comboIndex < combo.length - 1) {
        this.punchQueued = queued - 1;
        this.punchBufferTimer = c.punchBuffer;
      }
    };
    // ↓ + soco no chão: golpe baixo (rasteira), que só se defende agachado
    const low = this.mode === 'fight' && this.onGround && inp.isHeld('down') && !!this.sheet.def.animations.sweep;
    if (!this.attack) {
      if (this.state === 'dash') {
        if (this.stateTime < 0.05) return; // logo no começo do dash ainda não
        this.state = 'idle';               // o golpe sai com o embalo do dash
        this.vx *= 0.6;
      }
      if (!this.onGround && this.char.airAttack) {
        this.startAttack(this.char.airAttack);
        this.attack.air = true;
      } else if (this.onGround && low) {
        this.comboIndex = -1;
        this.setHeight(this.fc.crouchHeight);
        this.startAttack('sweep');
      } else if (this.onGround) {
        if (this.comboTimer <= 0) this.comboIndex = -1;
        this.setHeight(this.standH);
        this.startAttack(next());
        keepQueue();
      }
    } else if (this.attack.hitDone && this.attack.def.hit && this.anim.index > this.attack.def.hit.frame
               && combo.includes(this.attack.kind) && this.onGround) {
      if (low) {
        // soco, soco, ↓ + soco: o combo termina na rasteira
        this.comboIndex = -1;
        this.setHeight(this.fc.crouchHeight);
        this.startAttack('sweep');
      } else {
        this.startAttack(next()); // golpe recolhendo: emenda o próximo do combo
        keepQueue();
      }
    } else if (this.attack.def.cancelInto !== undefined && this.anim.index >= this.attack.def.cancelInto && this.onGround) {
      this.comboIndex = -1;
      this.startAttack(next()); // reapareceu do teletransporte: já pode bater
    }
  }

  /** Pode começar o especial agora? Também cancela um golpe que acabou de acertar. */
  canSpecial() {
    if (this.specialCooldown > 0 || this.charging || !this.onGround) return false;
    if (!this.attack) return this.state !== 'dash' || this.stateTime >= 0.05; // o dash também vira especial
    return this.attack.landed && (this.char.combo.includes(this.attack.kind) || this.attack.kind === 'sweep');
  }

  trySpecial(scene, instant) {
    if (!this.canSpecial()) return false;
    let kind = this.char.special;
    if (kind === 'copy') kind = this.copied || 'kunai'; // Corvo: usa o que o olho copiou
    return this.performSpecial(kind, scene, instant);
  }

  /** Segundo especial (↓ + especial ou ↓ ↙ ← + soco). */
  trySpecial2(scene) {
    const kind = this.char.special2;
    if (!kind || !this.canSpecial()) return false;
    return this.performSpecial(kind, scene, false);
  }

  /** Começa um especial pelo tipo (o Corvo usa isto para os golpes copiados). */
  performSpecial(kind, scene, instant) {
    const mine = (cls, test) => scene.entities.some((e) => e instanceof cls && e.owner === this && !e.dead && (!test || test(e)));
    // na luta, um projétil de cada vez (regra clássica dos jogos de luta); no domínio vale tudo
    if (this.mode === 'fight' && !this.inDomain && (kind === 'energyBall' || kind === 'book' || kind === 'kunai') && mine(Game.Projectile)) return false;
    if (this.mode === 'fight' && !this.inDomain && kind === 'iceSpike' && mine(Game.Strike, (e) => e.kind === 'spike')) return false;
    if (this.mode === 'fight' && !this.inDomain && kind === 'bomb' && mine(Game.Bomb, (e) => !e.mini)) return false;
    if (kind === 'thread' && mine(Game.Thread)) return false;
    if (kind === 'timebomb' && mine(Game.TimeBomb)) return false;
    if (kind === 'rewind' && this.mode !== 'fight') return false;
    const cancel = !!(this.attack && this.attack.landed); // cancelou um golpe que acertou
    if (this.state === 'dash') this.state = 'idle';
    this.setHeight(this.standH);
    this.addMeter(this.fc.meter.special);
    const ok = this.startSpecial(kind, scene, instant);
    if (!ok) return false;
    this.lastSpecial = kind;
    Game.events.emit('specialUsed', { fighter: this, kind, second: kind === this.char.special2, cancel });
    if (this.char.special === 'copy' && this.inDomain && kind !== 'counter') {
      // Lua Rubra: as cópias saem sem espera
      this.specialCooldown = Math.min(this.specialCooldown, 0.25);
    }
    // o olho do Corvo do outro lado vê o especial e copia
    const o = this.opponent;
    if (o && o !== this && o.char.special === 'copy' && Game.COPY_NAMES[kind]) o.learnCopy(kind, scene);
    return true;
  }

  startSpecial(kind, scene, instant) {
    const cfg = Game.config;
    const dom = this.inDomain;
    switch (kind) {
      case 'energyBall':
        this.attack = null;
        // no Abismo Violeta a bola já sai carregada
        this.charging = { t: 0, full: dom, spark: 0 };
        if (instant || dom) {
          this.fireBall(scene);
        } else {
          this.guardTimer = this.char.guardTime;
          Game.events.emit('charge');
        }
        return true;
      case 'dash':
        this.startAttack('dash');
        this.specialCooldown = cfg.dash.cooldown * (dom ? 0.6 : 1);
        if (dom) this.invuln = Math.max(this.invuln, 0.22); // atravessa projéteis
        Game.events.emit('dash', { fighter: this });
        return true;
      case 'book':
        this.startAttack('throw');
        this.specialCooldown = cfg.book.cooldown * (dom ? 0.6 : 1);
        return true;
      case 'rise':
        this.startAttack('rise');
        this.specialCooldown = cfg.rise.cooldown;
        return true;
      case 'iceSpike':
        this.startAttack('spikeCast');
        this.specialCooldown = cfg.iceSpike.cooldown * (dom ? 0.65 : 1);
        Game.events.emit('iceCast', { fighter: this });
        return true;
      case 'torch':
        this.startAttack('torch');
        this.specialCooldown = cfg.torch.cooldown * (dom ? 0.6 : 1);
        Game.events.emit('torchOn', { fighter: this });
        return true;
      case 'teleport': {
        this.startAttack('teleport');
        const inp = this.lastInput;
        this.attack.back = !!(inp && inp.axisX() === -this.facing); // segurando para trás: foge
        this.specialCooldown = dom ? 0.12 : cfg.teleport.cooldown;
        return true;
      }
      case 'bolt':
        this.startAttack('boltCast');
        this.specialCooldown = cfg.bolt.cooldown * (dom ? 0.5 : 1);
        Game.events.emit('boltCast', { fighter: this });
        return true;
      case 'gate':
        this.startAttack('gateCall');
        this.specialCooldown = cfg.gate.cooldown * (dom ? 0.6 : 1);
        return true;
      case 'kunai':
        this.startAttack('kunaiThrow');
        this.specialCooldown = cfg.kunai.cooldown;
        return true;
      case 'counter':
        this.startAttack('counter');
        this.specialCooldown = cfg.counter.cooldown;
        this.eyeFlash = 0.45;
        Game.events.emit('counterStance', { fighter: this });
        return true;
      case 'bubble':
        this.startAttack('bubbleCast');
        this.specialCooldown = cfg.bubble.cooldown * (dom ? 0.6 : 1);
        return true;
      case 'rewind':
        if (this.history.length < 2) return false;
        this.startAttack('rewind');
        this.specialCooldown = dom && this.char.special2 === 'rewind' ? cfg.rewind.domainCooldown : cfg.rewind.cooldown;
        Game.events.emit('rewindCast', { fighter: this });
        return true;
      case 'blackhole':
        this.startAttack('holeCast');
        this.specialCooldown = cfg.blackhole.cooldown * (dom ? 0.6 : 1);
        return true;
      case 'antigrav':
        this.startAttack('liftCast');
        this.specialCooldown = cfg.antigrav.cooldown * (dom ? 0.6 : 1);
        return true;
      case 'thread': {
        // com o fio preso, K de novo puxa o adversário (Puxão)
        const held = scene.entities.find((e) => e instanceof Game.PuppetString && e.owner === this && !e.dead);
        if (held) {
          this.startAttack('yank');
          this.specialCooldown = dom ? cfg.thread.yank.domainCooldown : cfg.thread.yank.cooldown;
          return true;
        }
        this.startAttack('threadCast');
        this.specialCooldown = cfg.thread.cooldown;
        Game.events.emit('threadShot', { fighter: this });
        return true;
      }
      case 'tangle':
        this.startAttack('tangle');
        this.specialCooldown = cfg.tangle.cooldown * (dom ? 0.6 : 1);
        return true;
      case 'bomb':
        this.startAttack('bombThrow');
        this.specialCooldown = cfg.bomb.cooldown * (dom ? 0.6 : 1);
        return true;
      case 'timebomb':
        this.startAttack('plant');
        this.specialCooldown = cfg.timebomb.cooldown * (dom ? 0.6 : 1);
        return true;
      default:
        return false;
    }
  }

  /** Corvo: o olho rubro copia o especial que acabou de ver. */
  learnCopy(kind, scene) {
    if (this.copied === kind) {
      this.eyeFlash = Math.max(this.eyeFlash, 0.25);
      return;
    }
    this.copied = kind;
    this.eyeFlash = 0.8;
    if (scene) scene.effects.ring(this.cx + this.facing * 3, this.feet - 33, '#ff3030', 8);
    Game.events.emit('copied', { fighter: this, kind, name: Game.COPY_NAMES[kind] });
  }

  updateSpecial(dt, inp, scene) {
    this.specialCooldown -= dt;
    if (this.charging) {
      const cfg = Game.config.energyBall;
      this.charging.t += dt;
      this.charging.spark -= dt;
      const hand = this.handPoint();
      if (this.charging.spark <= 0) {
        this.charging.spark = this.charging.full ? 0.04 : 0.08;
        scene.effects.burst(hand.x, hand.y, ['#ffffff', '#e2c4ff', '#b47cff'], 1, { speed: 60, lift: 40, gravity: -40 });
      }
      if (!this.charging.full && this.charging.t >= cfg.chargeTime) {
        this.charging.full = true;
        scene.effects.burst(hand.x, hand.y, ['#ffffff', '#e2c4ff', '#a46cff'], 10, { speed: 90, lift: 60, gravity: 0 });
        Game.events.emit('charged');
      }
      if (!inp.isHeld('special') || this.charging.t >= cfg.maxCharge) this.fireBall(scene);
      return;
    }
    if (inp.consumePress('special')) {
      // ↓ + especial: segundo especial (quem tiver)
      const second = !!this.char.special2 && inp.isHeld('down') && this.mode === 'fight';
      const ok = second ? this.trySpecial2(scene) : this.trySpecial(scene, false);
      if (!ok) {
        this.specialBuffered = 0.15;
        this.specialBufferedKind = second ? 'special2' : 'special';
      }
    } else if (this.specialBuffered > 0) {
      this.specialBuffered -= dt;
      if (this.canSpecial()) {
        this.specialBuffered = 0;
        if (this.specialBufferedKind === 'special2') this.trySpecial2(scene);
        else this.trySpecial(scene, !inp.isHeld('special'));
      }
    }
  }

  handPoint() {
    const fire = this.sheet.def.animations.fire;
    const muzzle = fire ? fire.muzzle : { x: 12, y: -18 };
    return { x: this.cx + this.facing * (muzzle.x - 4), y: this.feet + muzzle.y + 1 };
  }

  fireBall(scene) {
    const big = this.charging.full;
    this.charging = null;
    this.startAttack('fire');
    const muzzle = this.attack.def.muzzle;
    scene.add(new Game.Projectile(this.cx + this.facing * muzzle.x, this.feet + muzzle.y, this.facing, this, big ? 'energyBig' : 'energy'));
    this.specialCooldown = Game.config.energyBall.cooldown;
    Game.events.emit(big ? 'fireBig' : 'fire');
  }

  startAttack(kind) {
    const def = this.sheet.def.animations[kind];
    if (!def) throw new Error('Golpe "' + kind + '" não existe nas animações do personagem.');
    this.attack = { kind, def, hitDone: !def.hit, hitSet: new Set(), landed: false, released: false, air: false, risen: false };
    this.punchBufferTimer = 0;
    this.punchQueued = 0;
    this.anim.play(kind, true);
    this.guardTimer = this.char.guardTime || 0;
    if (def.lunge && this.onGround) this.vx = this.facing * def.lunge;
    if (def.hit && !def.dash) Game.events.emit('swing');
  }

  resolveAttack(scene) {
    const a = this.attack;
    if (!a) return;
    const hit = a.def.hit;
    if (hit && !Game.INVULNERABLE_STATES.has(this.state)) {
      if (hit.sweep) {
        // golpe que fica ativo por vários quadros (investida, golpes aéreos, gancho)
        const last = hit.lastFrame !== undefined ? hit.lastFrame : hit.frame;
        const i = this.anim.index;
        if (i >= hit.frame && i <= last && scene.punch(this.hitRect(hit), hit, this, a.hitSet)) a.landed = true;
        if (i > last) a.hitDone = true;
      } else if (!a.hitDone && this.anim.index >= hit.frame) {
        a.hitDone = true;
        if (scene.punch(this.hitRect(hit), hit, this)) a.landed = true;
      }
    }
    if (a.def.release !== undefined && !a.released && this.anim.index >= a.def.release) {
      a.released = true;
      this.releaseAttack(a, scene);
    }
    if (a.def.teleport) this.updateTeleport(a, scene);
    if (a.def.rewind && !a.rewound && this.anim.index >= a.def.rewind.frame) {
      a.rewound = true;
      this.doRewind(scene);
    }
    // o gancho ascendente só termina ao pousar
    if (this.anim.finished && this.attack === a && !(a.def.rise && !this.onGround)) {
      this.attack = null;
      this.comboTimer = this.cfg.comboWindow;
      if (this.mode === 'fight' && this.onGround && this.canAct()) this.state = 'idle';
    }
  }

  hitRect(h) {
    const x = this.facing > 0 ? this.cx + h.x : this.cx - h.x - h.w;
    return { x, y: this.feet + h.y, w: h.w, h: h.h };
  }

  /** O golpe solta o efeito: livro, pico de gelo, raio, chama do maçarico ou portão. */
  releaseAttack(a, scene) {
    const map = scene.map.pixelWidth;
    const clampX = (x) => Math.max(10, Math.min(map - 10, x));
    if (a.def.kunai) {
      const m = a.def.muzzle;
      // na Lua Rubra saem três kunais em leque
      const ys = this.inDomain ? [m.y - 7, m.y, m.y + 7] : [m.y];
      for (const y of ys) scene.add(new Game.Projectile(this.cx + this.facing * m.x, this.feet + y, this.facing, this, 'kunai'));
      Game.events.emit('kunai', { fighter: this });
      return;
    }
    if (a.def.bubble) {
      // uma bolha por vez: a nova desfaz a antiga
      for (const e of scene.entities) if ((e instanceof Game.TimeBubble || e instanceof Game.TimeOrb) && e.owner === this) e.pop(scene);
      const m = a.def.muzzle || { x: 15, y: -20 };
      scene.add(new Game.TimeOrb(this, this.cx + this.facing * m.x, this.feet + m.y));
      Game.events.emit('bubbleThrow', { fighter: this });
      return;
    }
    if (a.def.hole) {
      for (const e of scene.entities) if (e instanceof Game.BlackHole && e.owner === this) e.collapse(scene, false);
      const c = Game.config.blackhole;
      scene.add(new Game.BlackHole(this, clampX(this.cx + this.facing * c.distance)));
      Game.events.emit('blackHole', { fighter: this });
      return;
    }
    if (a.def.lift) {
      const c = Game.config.antigrav;
      const o = this.opponent;
      let x = this.cx + this.facing * Math.min(c.range, 70);
      if (o && Math.abs(o.cx - this.cx) <= c.range) x = o.cx;
      const float = this.inDomain && this.char.special2 === 'antigrav' ? c.domainFloat : c.float;
      // o anel aparece onde o adversário estava: dá para sair de cima dele a tempo
      scene.add(new Game.Strike(this, 'antigrav', clampX(x), { warn: c.warn, hit: Object.assign({ float }, c.hit) }));
      Game.events.emit('antigravCast', { fighter: this });
      return;
    }
    if (a.def.flame) {
      scene.add(new Game.TorchFlame(this, a));
      return;
    }
    if (a.def.thread) {
      const m = a.def.muzzle || { x: 14, y: -21 };
      scene.add(new Game.Thread(this, this.cx + this.facing * m.x, this.feet + m.y));
      return;
    }
    if (a.def.yank) {
      this.yank(scene);
      return;
    }
    if (a.def.tangle) {
      this.tangle(scene);
      return;
    }
    if (a.def.bomb) {
      // sem direção a bomba mira onde o adversário está; ← (para trás) cai perto, → (para frente) vai longe
      const c = Game.config.bomb;
      const inp = this.lastInput;
      const x = inp ? inp.axisX() * this.facing : 0;
      const m = a.def.muzzle || { x: 6, y: -30 };
      const o = this.opponent;
      let speed = x < 0 ? c.vxNear : x > 0 ? c.vxFar : c.vx;
      if (x === 0 && o && this.mode === 'fight') speed = Math.max(c.vxMin, Math.min(c.vxFar, ((o.cx - this.cx) * this.facing - m.x) / c.flight));
      const vx = speed * this.facing;
      const gap = o ? (o.cx - this.cx) * this.facing - (o.w + this.w) / 2 : 999;
      if (o && gap > -6 && gap <= c.pointBlank && !o.invulnerable() && !o.hidden) {
        // à queima-roupa: a bomba vai direto no peito do adversário (não passa por cima)
        scene.add(new Game.Bomb(this, o.cx - this.facing * (o.w / 2 - 1), o.y + o.h / 2, this.facing * 40, 0));
      } else {
        scene.add(new Game.Bomb(this, this.cx + this.facing * m.x, this.feet + m.y, vx, -c.vy));
      }
      Game.events.emit('bombThrow', { fighter: this });
      return;
    }
    if (a.def.plant) {
      this.plantBomb(scene);
      return;
    }
    if (a.def.gate) {
      const c = Game.config.gate;
      const edge = (x) => Math.max(c.width + 8, Math.min(map - c.width - 8, x));
      // um portão por vez (o novo derruba o antigo)
      for (const e of scene.entities) if (e instanceof Game.IronGate && e.owner === this) e.life = Math.min(e.life, e.t - e.fallTime);
      const o = this.opponent;
      if (this.inDomain && o && Math.abs(o.cx - this.cx) < 220) {
        // Serralheria Infinita: dois portões, um de cada lado do adversário (uma cela)
        const gap = o.w / 2 + c.width / 2 + 9;
        scene.add(new Game.IronGate(this, edge(o.cx - gap)));
        scene.add(new Game.IronGate(this, edge(o.cx + gap), { delay: 0.08 }));
      } else {
        scene.add(new Game.IronGate(this, edge(this.cx + this.facing * c.distance)));
      }
      return;
    }
    if (a.def.spike) {
      // embaixo do adversário, se estiver ao alcance; senão no limite do alcance
      const c = Game.config.iceSpike;
      const o = this.opponent;
      let x = this.cx + this.facing * c.range;
      if (o && Math.abs(o.cx - this.cx) <= c.range) x = o.cx;
      if (this.mode !== 'fight' && !o) x = this.cx + this.facing * 60;
      x = clampX(x);
      const freeze = c.freeze * (this.inDomain ? 1.5 : 1);
      const hit = Object.assign({ freeze }, c.hit);
      // no Inverno Absoluto brotam três picos em sequência
      const xs = this.inDomain ? [x, clampX(x - this.facing * 24), clampX(x + this.facing * 24)] : [x];
      xs.forEach((sx, i) => scene.add(new Game.Strike(this, 'spike', sx, { warn: c.warn + i * 0.1, hit })));
      return;
    }
    if (a.def.bolt) {
      const c = Game.config.bolt;
      // mira em quem está no chão à frente (onde ele estava na hora do raio); senão, distância fixa
      const o0 = this.opponent;
      const ahead = o0 ? (o0.cx - this.cx) * this.facing : -1;
      const aimed = o0 && o0.onGround && !o0.ko && ahead >= c.near && ahead <= c.far;
      const x = clampX(aimed ? o0.cx : this.cx + this.facing * c.distance);
      scene.add(new Game.Strike(this, 'bolt', x, { warn: c.warn, hit: Object.assign({}, c.hit) }));
      // no Céu da Tempestade cai um segundo raio em cima do adversário
      const o = this.opponent;
      if (this.inDomain && o) {
        scene.add(new Game.Strike(this, 'bolt', o.cx, { warn: 0.2, track: o, hit: Object.assign({}, c.hit, { damage: 6 }) }));
      }
      return;
    }
    // arremesso do livro (na Biblioteca Infinita, três de uma vez)
    const m = a.def.muzzle;
    const ys = this.inDomain ? [m.y - 6, m.y, m.y + 7] : [m.y];
    for (const y of ys) scene.add(new Game.Projectile(this.cx + this.facing * m.x, this.feet + y, this.facing, this, 'book'));
    Game.events.emit('throw');
  }

  /** Marionete: puxa quem está preso no fio para bem perto dela (abre para o combo). */
  yank(scene) {
    const s = scene.entities.find((e) => e instanceof Game.PuppetString && e.owner === this && !e.dead);
    if (!s) return;
    const t = s.target;
    s.dead = true;
    if (t.ko || t.invulnerable()) return;
    const c = Game.config.thread.yank;
    const gap = Math.max(0, Math.abs(t.cx - this.cx) - (this.w + t.w) / 2 - 6);
    const pull = Math.sqrt(2 * 600 * gap) + 30; // velocidade para parar bem na frente dela
    s.sourceX = this.cx;
    const res = scene.punch({ x: t.x, y: t.y, w: t.w, h: t.h },
      { damage: c.damage, knockback: 0, special: true, unblockable: true, pull, stun: c.stun, stop: 'light' }, s);
    scene.effects.burst((t.cx + this.cx) / 2, t.y + 8, ['#ffffff', '#ffb3c4'], 6, { speed: 80, lift: 30, gravity: 100 });
    if (res === 'hit') Game.events.emit('yank', { attacker: this, target: t });
  }

  /** Marionete: Fios Trocados. Pelo fio preso alcança a qualquer distância; senão, só de perto. */
  tangle(scene) {
    const c = Game.config.tangle;
    const s = scene.entities.find((e) => e instanceof Game.PuppetString && e.owner === this && !e.dead);
    const hit = Object.assign({ invert: c.invert * (this.inDomain ? 1.3 : 1) }, c.hit);
    if (s && !s.target.invulnerable()) {
      const t = s.target;
      s.pulse = 0.25;
      s.sourceX = this.cx;
      if (!this.inDomain) s.dead = true; // gasta o fio (no Teatro ele fica)
      scene.punch({ x: t.x, y: t.y, w: t.w, h: t.h }, Object.assign(hit, { unblockable: true }), s);
    } else {
      const r = { x: this.facing > 0 ? this.cx : this.cx - c.range, y: this.feet - 30, w: c.range, h: 30 };
      scene.punch(r, hit, this);
    }
    scene.effects.burst(this.cx + this.facing * 12, this.feet - 20, ['#ffffff', '#ffb3c4', '#de3550'], 10, { speed: 110, lift: 60, gravity: 80 });
    Game.events.emit('tangle', { fighter: this });
  }

  /** Pavio: Bomba-relógio. Gruda em quem estiver colado; senão fica no chão contando. */
  plantBomb(scene) {
    const c = Game.config.timebomb;
    const fuse = this.inDomain ? c.domainFuse : c.fuse;
    const o = this.opponent;
    const gap = o ? Math.abs(o.cx - this.cx) - (o.w + this.w) / 2 : 999;
    if (o && this.mode === 'fight' && gap <= c.reach && !o.invulnerable() && !o.ko && !o.hidden) {
      scene.add(new Game.TimeBomb(this, o, o.cx, fuse));
      // o tapa que gruda a bomba empurra o adversário para longe
      const rect = { x: Math.min(this.cx, o.cx) - 2, y: o.y, w: Math.abs(o.cx - this.cx) + 4, h: o.h };
      scene.punch(rect, Object.assign({ timebomb: true }, c.slap), this);
      scene.effects.burst(o.cx, o.y + 6, ['#ffffff', '#ffd166', '#ff9a3c'], 8, { speed: 70, lift: 50, gravity: 200 });
      Game.events.emit('timebombPlant', { attacker: this, target: o });
    } else {
      const x = Math.max(12, Math.min(scene.map.pixelWidth - 12, this.cx + this.facing * 18));
      scene.add(new Game.TimeBomb(this, null, x, fuse));
      Game.events.emit('timebombPlant', { attacker: this, target: null });
    }
  }

  /** Passo Relâmpago: some no quadro 1 e reaparece no quadro 2. */
  updateTeleport(a, scene) {
    if (!a.vanished && this.anim.index >= 1) {
      a.vanished = true;
      const from = { x: this.cx, y: this.feet - 16 };
      const c = Game.config.teleport;
      const o = this.opponent;
      const maxX = scene.map.pixelWidth;
      const half = this.w / 2;
      let dest;
      if (!a.back && o && Math.abs(o.cx - this.cx) <= c.near && o.onGround) {
        const side = Math.sign(o.cx - this.cx) || this.facing;
        dest = o.cx + side * (o.w / 2 + half + 5);
        // sem espaço atrás (adversário no canto): fica colado na frente
        if (dest - half < 2 || dest + half > maxX - 2) dest = o.cx - side * (o.w / 2 + half + 3);
      } else {
        dest = this.cx + (a.back ? -this.facing : this.facing) * c.forward;
      }
      dest = Math.max(half + 2, Math.min(maxX - half - 2, dest));
      const startX = this.x;
      this.x = dest - half;
      // fase de plataforma: não reaparece dentro de parede ou caixa (volta até achar espaço)
      const step = Math.sign(startX - this.x) * 2;
      for (let i = 0; i < 60 && step && this.overlapsSolid(scene.map); i++) this.x += step;
      if (this.overlapsSolid(scene.map)) this.x = startX;
      this.hidden = true;
      this.invuln = Math.max(this.invuln, 0.2);
      scene.add(new Game.Streak(from.x, from.y, this.cx, this.feet - 16));
      scene.effects.burst(from.x, from.y, ['#ffffff', '#fff3b0', '#ffd23f'], 10, { speed: 120, lift: 60, gravity: 0 });
      Game.events.emit('teleport', { fighter: this });
    }
    if (a.vanished && !a.appeared && this.anim.index >= 2) {
      a.appeared = true;
      this.hidden = false;
      if (this.opponent) this.facing = this.dirTo(this.opponent);
      scene.effects.burst(this.cx, this.feet - 16, ['#ffffff', '#fff3b0', '#ffd23f', '#7fd8ff'], 12, { speed: 110, lift: 80, gravity: 0 });
      scene.effects.ring(this.cx, this.feet - 16, '#fff3b0', 12);
      // no Céu da Tempestade, quem estiver colado leva um choque ao reaparecer
      if (this.inDomain) {
        scene.punch({ x: this.cx - 16, y: this.feet - 30, w: 32, h: 30 },
          { damage: 3, knockback: 60, special: true, stop: 'multi', echo: true }, this);
      }
    }
  }

  // ------------------------------------------------------------------ super
  trySuper(scene) {
    if (this.mode !== 'fight' || !this.superReady || !this.onGround || this.charging || !Game.Supers[this.char.super]) return false;
    if (scene.cinematic || (scene.domain && scene.domain.clash)) return false;
    // de dentro de um golpe só se ele acertou (cancelamento, como nos especiais)
    if (this.attack && !(this.attack.landed && this.char.combo.includes(this.attack.kind))) return false;
    this.meter -= this.fc.meter.superCost;
    this.attack = null;
    this.setHeight(this.standH);
    this.state = 'super';
    this.stateTime = 0;
    this.vx = 0;
    this.superData = { kind: this.char.super, t: 0, phase: 'start' };
    this.play('superPose', true);
    scene.startCinematic(this);
    Game.events.emit('super', { fighter: this, name: this.char.superName });
    return true;
  }

  finishSuper(recover = 0.2) {
    this.superData = null;
    if (recover > 0) this.enterRecover(recover);
    else this.enterIdle();
  }

  /**
   * Expansão de Domínio: com as 2 barras cheias, sinal de mão e o cenário muda por
   * 10 segundos (js/domains.js). Se o adversário já estiver no domínio dele, começa
   * um embate de domínios.
   */
  tryDomain(scene) {
    if (this.mode !== 'fight' || !this.domainReady || !this.onGround || this.charging || scene.locked) return false;
    if (scene.cinematic || (scene.domain && (scene.domain.clash || scene.domain.phase === 'break'))) return false;
    if (scene.domain && scene.domain.owner === this) return false;
    if (this.attack && !(this.attack.landed && this.char.combo.includes(this.attack.kind))) return false;
    this.meter -= this.fc.meter.domainCost;
    this.attack = null;
    this.setHeight(this.standH);
    this.state = 'super';
    this.stateTime = 0;
    this.vx = 0;
    this.superData = { kind: 'domain', t: 0, phase: 'start' };
    this.play('domain', true);
    this.aura = Game.config.domain.cinematic + 0.4;
    Game.Domain.expand(this, scene);
    return true;
  }

  // ------------------------------------------------------------------ gelo e fogo
  /** Congela no lugar por "time" segundos (só no chão; no ar o golpe derruba). */
  freeze(time, scene) {
    if (this.ko || !this.onGround || this.state === 'launched' || this.freezeImmune > 0) return false;
    this.state = 'iced';
    this.stateTime = 0;
    this.stateTimer = time;
    this.iceTotal = time;
    this.vx = 0;
    this.attack = null;
    this.charging = null;
    scene.effects.burst(this.cx, this.feet - 14, ['#ffffff', '#cfefff', '#7cc8ff'], 12, { speed: 100, lift: 80, gravity: 200 });
    Game.events.emit('freeze', { target: this });
    return true;
  }

  /** O gelo quebra (sozinho ou com um golpe). Por um tempo o lutador não congela de novo. */
  shatterIce(scene, byHit) {
    this.freezeImmune = 1.4;
    scene.effects.burst(this.cx, this.feet - 14, ['#ffffff', '#cfefff', '#9fdcff', '#5aa8e0'], byHit ? 22 : 14,
      { speed: byHit ? 170 : 110, lift: 120, gravity: 500 });
    Game.events.emit('shatter', { target: this, byHit });
  }

  /** Queimadura: 1 ponto de vida a cada pouco tempo (não nocauteia). */
  updateBurn(dt, scene) {
    const b = this.burn;
    b.t -= dt;
    b.tick -= dt;
    if (Math.random() < 0.35) {
      scene.effects.burst(this.cx + (Math.random() - 0.5) * 10, this.feet - 4 - Math.random() * 20, Game.FIRE_COLORS, 1, { speed: 20, lift: 50, gravity: -80 });
    }
    if (b.tick <= 0) {
      b.tick = 0.4;
      if (!this.ko && this.hp > 1 && !scene.locked) {
        this.hp = Math.max(1, this.hp - 1);
        this.flash = 0.03;
      }
    }
    if (b.t <= 0 || this.ko) this.burn = null;
  }

  // ------------------------------------------------------------------ agarrão
  canBeGrabbed() {
    return this.onGround && !this.invulnerable() && ['idle', 'walk', 'crouch', 'dash'].includes(this.state);
  }

  tryGrab(inp, scene) {
    const o = this.opponent;
    const dir = inp.axisX();
    if (this.mode !== 'fight' || !o || !this.onGround || dir === 0 || this.state === 'dash' || inp.isHeld('down')) return false;
    if (Math.abs(o.cx - this.cx) > this.fc.grab.range || Math.abs(o.feet - this.feet) > 4 || !o.canBeGrabbed()) return false;
    const back = dir !== this.facing;
    this.charging = null;
    this.setHeight(this.standH);
    this.state = 'throwing';
    this.stateTime = 0;
    this.vx = 0;
    this.throwData = { target: o, back, t: 0, phase: 'hold' };
    this.play('grab', true);
    o.attack = null;
    o.charging = null;
    o.setHeight(o.standH);
    o.state = 'grabbed';
    o.stateTime = 0;
    o.vx = 0;
    o.vy = 0;
    o.techPressed = false;
    o.grabbedBy = this;
    o.play('hurtHeavy', true);
    scene.effects.spark(this.cx + this.facing * 8, this.feet - 18, 'block');
    Game.events.emit('grab', { attacker: this, target: o });
    return true;
  }

  updateThrow(dt, scene) {
    const d = this.throwData;
    const o = d.target;
    d.t += dt;
    if (d.phase === 'hold' && scene.locked) {
      // o round acabou no meio do agarrão: solta sem dano
      o.grabbedBy = null;
      o.enterIdle();
      this.throwData = null;
      this.enterIdle();
      return;
    }
    if (d.phase === 'hold') {
      // segura o adversário colado à frente
      o.x = this.cx + this.facing * 13 - o.w / 2;
      o.y = this.feet - o.h;
      o.facing = -this.facing;
      if (o.techPressed && d.t > 0.04) return this.techThrow(scene);
      if (d.t >= this.fc.grab.techWindow) this.toss(scene);
    } else if (this.anim.finished || d.t > 0.32) {
      this.throwData = null;
      this.enterIdle();
    }
  }

  techThrow(scene) {
    const o = this.throwData.target;
    o.grabbedBy = null;
    this.throwData = null;
    for (const [f, dir] of [[this, -this.facing], [o, this.facing]]) {
      f.vx = dir * 150;
      f.enterRecover(0.22);
      f.play('block', true);
    }
    scene.effects.spark((this.cx + o.cx) / 2, this.feet - 18, 'block');
    scene.effects.ring((this.cx + o.cx) / 2, this.feet - 18, '#8fd3ff');
    Game.events.emit('tech', { fighter: o });
  }

  toss(scene) {
    const d = this.throwData;
    const o = d.target;
    const dir = d.back ? -this.facing : this.facing; // para onde o adversário voa
    if (d.back) {
      const maxX = scene.map.pixelWidth - o.w;
      o.x = Math.max(0, Math.min(maxX, this.cx + dir * 14 - o.w / 2));
    }
    o.grabbedBy = null;
    o.state = 'hurt'; // sai do "preso" para levar o golpe
    d.phase = 'toss';
    d.t = 0;
    this.anim.play('grab', true);
    this.anim.index = 1;
    const hit = { damage: this.fc.grab.damage, knockback: 150, heavy: true, launch: true, throw: true };
    o.receiveThrow(hit, this, -dir, scene);
    scene.effects.spark(o.cx, o.feet - 16, 'heavy');
    scene.effects.shake(0.15, 2);
    scene.effects.freeze(Game.config.fight.hitStop.heavy);
    this.addMeter(hit.damage * this.fc.meter.dealt);
    o.addMeter(hit.damage * this.fc.meter.taken);
    Game.events.emit('hit', { heavy: true, target: o, attacker: this, combo: 1 });
    Game.events.emit('toss', { attacker: this, target: o });
  }

  /** Dano do arremesso: não dá para defender. attackerSide: lado de onde veio o golpe. */
  receiveThrow(hit, from, attackerSide, scene) {
    this.comboTaken = 1;
    this.hp = Math.max(this.noKo ? 1 : 0, this.hp - hit.damage);
    this.flash = 0.06;
    this.stun += this.fc.stun.perHit;
    this.facing = attackerSide;
    if (this.hp <= 0) {
      this.ko = true;
      this.launch(attackerSide, 1.15, scene);
      Game.events.emit('ko', { loser: this, attacker: from });
      return;
    }
    this.launch(attackerSide, 1.05, scene);
  }

  // ------------------------------------------------------------------ apanhar
  /**
   * Está defendendo um golpe vindo do lado attackerDir? Precisa estar no chão,
   * sem atacar, segurando para trás. Agachado defende tudo, menos golpes aéreos.
   */
  blocking(attackerDir, from, hit) {
    if (this.mode !== 'fight' || !this.onGround || !this.lastInput || this.hidden) return false;
    if (!['idle', 'walk', 'crouch', 'block'].includes(this.state) || this.attack || this.charging) return false;
    if (this.lastInput.axisX() !== -attackerDir) return false;
    const crouched = this.lastInput.isHeld('down');
    // golpe baixo (rasteira) só se defende agachado
    if (hit && hit.low && !crouched) return false;
    const overhead = from instanceof Game.Fighter && !from.onGround;
    return !(overhead && crouched);
  }

  onHit(hit, from, scene) {
    if (this.invulnerable(hit) || (from.team && from.team === this.team)) return false;
    const ts = scene.timeStop;
    if (ts && ts.owner !== this && !hit.timeDebt) {
      // tempo parado: o golpe fica guardado e cai todo de uma vez quando o tempo voltar
      ts.debt = Math.min(Game.config.timestop.maxDebt, ts.debt + (this.mode === 'fight' ? hit.damage : 0));
      ts.hits += 1;
      return 'hit';
    }
    // Leitura do Corvo: acertado na postura, some em penas e corta pelas costas
    const a0 = this.attack;
    if (a0 && a0.def.counter && !a0.countered && !hit.unblockable && !hit.throw && !hit.super && !hit.echo
        && this.anim.index <= a0.def.counter.until + (this.inDomain ? 1 : 0)) {
      return this.counterHit(hit, from, scene);
    }
    const fc = this.fc;
    const fromX = from.sourceX !== undefined ? from.sourceX : from.x + from.w / 2;
    const dir = fromX < this.cx ? -1 : 1; // lado de quem bateu (o raio vale pela mão de quem lançou)
    if (!hit.unblockable && this.blocking(dir, from, hit)) {
      const crouched = this.lastInput.isHeld('down');
      this.state = 'block';
      this.stateTime = 0;
      this.stateTimer = fc.blockstun;
      this.play(crouched ? 'crouch' : 'block', true);
      if (!crouched) this.setHeight(this.standH);
      this.vx = -dir * fc.pushback.block * (hit.super ? 0.3 : 1);
      if (hit.special) this.hp = Math.max(1, this.hp - Math.max(1, Math.round(hit.damage * fc.chip)));
      this.pushAttacker(from, dir, scene, fc.pushback.block);
      return 'blocked';
    }
    const prev = this.state;
    // contra-golpe: acertado bem no começo do próprio golpe (ou carregando a bola)
    const punish = this.mode === 'fight' && !hit.super && !hit.sure && !hit.echo && !hit.throw && !hit.timeDebt
      && ((this.attack && this.attack.def.hit && !this.attack.hitDone) || !!this.charging);
    this.comboTaken = prev === 'hurt' || prev === 'dizzy' || prev === 'launched' || prev === 'iced' || prev === 'floating' || prev === 'puppet'
      ? this.comboTaken + 1 : 1;
    if (prev === 'dizzy') this.stun = 0; // apanhar acorda quem está tonto
    let damage = hit.damage;
    // combos longos tiram menos por golpe (do 3º golpe em diante); supers e acertos garantidos não
    if (this.mode === 'fight' && this.comboTaken > 2 && !hit.super && !hit.sure && !hit.echo && !hit.timeDebt) {
      damage = Math.max(1, Math.round(damage * Math.max(0.5, 1 - 0.12 * (this.comboTaken - 2))));
    }
    if (scene.chaos && scene.chaos.damage !== 1 && this.mode === 'fight') damage = Math.round(damage * scene.chaos.damage); // Caos: dano em dobro
    if (punish) {
      damage = Math.round(damage * 1.25) + 1;
      Game.events.emit('counterHit', { attacker: from.owner || from, target: this });
      scene.effects.ring(this.cx, this.feet - 16, '#fff3b0', 12);
    }
    if (prev === 'iced') {
      // golpe em quem está congelado: o gelo estilhaça e o golpe tira um pouco mais
      damage += this.fc.freeze.shatterBonus;
      this.shatterIce(scene, true);
    }
    if (hit.burn && this.mode === 'fight') this.burn = { t: hit.burn, tick: 0.4 };
    if (hit.root && this.mode === 'fight') {
      this.rooted = Math.max(this.rooted, hit.root);
      Game.events.emit('rooted', { target: this });
    }
    const before = this.hp;
    this.hp = Math.max(0, this.hp - (this.mode === 'fight' ? damage : 0));
    if (this.noKo && this.hp <= 0) this.hp = 1; // treino: ninguém é nocauteado
    const thief = from.owner || from;
    if (scene.chaos && scene.chaos.vampire && thief instanceof Game.Fighter && thief !== this && !thief.ko) {
      thief.hp = Math.min(thief.maxHp, thief.hp + (before - this.hp) * scene.chaos.vampire); // Caos: vampiro
    }
    this.flash = 0.06;
    this.facing = dir;
    this.attack = null;
    this.charging = null;
    this.setHeight(this.standH);
    if (this.mode === 'fight' && prev !== 'dizzy' && !hit.super) this.stun += fc.stun.perHit * (hit.heavy ? 1.3 : 1);
    if (this.hp <= 0) {
      this.ko = true;
      this.inverted = 0;
      this.launch(dir, 1.15, scene);
      Game.events.emit('ko', { loser: this, attacker: from });
      return true;
    }
    if (hit.invert && this.mode === 'fight') {
      this.inverted = Math.max(this.inverted, hit.invert);
      Game.events.emit('inverted', { target: this, attacker: from.owner || from });
    }
    if (prev === 'puppet' && hit.puppet) {
      // pendurado nos fios do Espetáculo: continua pendurado
      this.state = 'puppet';
      return true;
    }
    if (prev === 'floating') {
      // flutuando (Antigravidade): o golpe derruba, a queda ainda dói
      this.floatT = 0;
      this.launch(dir, hit.launch ? 1 : 0.6, scene);
      return true;
    }
    if (hit.float && this.mode === 'fight') {
      this.startFloat(hit.float, scene);
      return true;
    }
    if (prev === 'launched') {
      // malabarismo do super: continua no ar, empurrado de leve
      if (hit.carry && from.vy !== undefined) {
        this.vy = Math.min(from.vy, -180);
        this.vx = from.vx || 0;
      } else {
        this.vy = Math.min(this.vy, -150);
        this.vx = -dir * 60;
      }
      if (hit.launch) this.launch(dir, 1, scene);
      return true;
    }
    if (hit.carry && !hit.launch) {
      // sobe junto com quem bate (Inferno)
      this.state = 'launched';
      this.stateTime = 0;
      this.onGround = false;
      this.vy = Math.min(from.vy || -300, -300);
      this.vx = from.vx || 0;
      this.play('knockFly', true);
      return true;
    }
    if (hit.launch || !this.onGround) {
      this.launch(dir, hit.trip ? 0.5 : 1, scene);
      if (hit.pull) this.vx = dir * Math.min(220, hit.pull); // puxado no ar: cai perto dela
      return true;
    }
    if (this.stun >= fc.stun.max) {
      this.state = 'dizzy';
      this.stateTime = 0;
      this.stateTimer = fc.stun.dizzyTime;
      this.vx = -dir * 60;
      this.play('dizzy', true);
      Game.events.emit('dizzy', { target: this });
      return true;
    }
    this.state = 'hurt';
    this.stateTime = 0;
    this.stateTimer = (hit.heavy ? fc.hitstun.heavy : fc.hitstun.light) * (punish ? 1.35 : 1);
    this.play(hit.heavy ? 'hurtHeavy' : 'hurt', true);
    // empurrão curto: os golpes do combo continuam alcançando
    this.vx = -dir * (hit.knockback || 80) * (this.mode === 'fight' ? 0.5 : 0.8);
    if (hit.pull) this.vx = dir * hit.pull; // Puxão: vem deslizando até quem puxou
    if (hit.shove) this.vx = -dir * hit.shove; // empurrão de verdade (o tapa da bomba-relógio)
    if (hit.stun) this.stateTimer = hit.stun;
    this.pushAttacker(from, dir, scene, fc.pushback.hit);
    if (hit.freeze && this.mode === 'fight') this.freeze(hit.freeze, scene);
    return true;
  }

  /** Corvo: a Leitura pegou o golpe. Some em penas e reaparece atrás de quem bateu. */
  counterHit(hit, from, scene) {
    const a = this.attack;
    a.countered = true;
    const owner = from.owner || from;
    if (from instanceof Game.Projectile) from.explode(scene);
    if (from.onCountered) from.onCountered(scene);
    Game.featherBurst(scene, this.cx, this.feet - 22, 16);
    if (owner instanceof Game.Fighter && owner !== this && Math.abs(owner.cx - this.cx) <= Game.config.counter.reach) {
      const half = this.w / 2;
      const maxX = scene.map.pixelWidth;
      const side = Math.sign(owner.cx - this.cx) || this.facing;
      let dest = owner.cx + side * (owner.w / 2 + half + 4);
      // sem espaço atrás (adversário no canto): aparece colado na frente dele
      if (dest - half < 2 || dest + half > maxX - 2) dest = owner.cx - side * (owner.w / 2 + half + 3);
      dest = Math.max(half + 2, Math.min(maxX - half - 2, dest));
      this.x = dest - half;
      this.facing = this.dirTo(owner);
      this.savePrev();
    }
    this.invuln = Math.max(this.invuln, 0.3);
    this.vx = 0;
    this.startAttack('slash');
    this.attack.countered = true;
    this.eyeFlash = 0.6;
    Game.featherBurst(scene, this.cx, this.feet - 22, 12);
    scene.effects.freeze(0.08);
    Game.events.emit('counter', { fighter: this, attacker: owner });
    return false;
  }

  /** Guarda posição e vida a cada 1/30 s (o Rebobinar volta por esse caminho). */
  recordHistory(dt) {
    this.histTimer -= dt;
    if (this.histTimer > 0) return;
    this.histTimer = 1 / 30;
    const h = this.history;
    h.push({ t: this.clock, cx: this.cx, feet: this.feet, hp: this.hp, facing: this.facing, ground: this.onGround, frame: this.anim.frame });
    while (h.length > 2 && this.clock - h[0].t > 1.7) h.shift();
  }

  /** Ampulheta: volta para onde estava um instante atrás e recupera a vida perdida nesse tempo. */
  doRewind(scene) {
    const c = Game.config.rewind;
    const h = this.history;
    if (h.length < 2) return;
    const target = this.clock - c.back;
    let snap = h[0];
    for (const e of h) {
      if (e.t <= target) snap = e;
      else break;
    }
    const path = h.filter((e) => e.t >= snap.t);
    const heal = Math.max(0, Math.min(c.maxHeal, snap.hp - this.hp));
    if (this.mode === 'fight') this.hp = Math.min(this.maxHp, this.hp + heal);
    const maxX = scene.map.pixelWidth;
    this.setHeight(this.standH);
    this.x = Math.max(2, Math.min(maxX - this.w - 2, snap.cx - this.w / 2));
    const ground = this.groundY !== undefined ? this.groundY : snap.feet;
    if (snap.ground || snap.feet >= ground - 1) {
      this.y = ground - this.h;
      this.onGround = true;
    } else {
      this.y = snap.feet - this.h;
      this.onGround = false;
    }
    this.vx = 0;
    this.vy = 0;
    this.facing = this.opponent ? this.dirTo(this.opponent) : snap.facing;
    this.burn = null;
    this.rooted = 0;
    this.stun = Math.max(0, this.stun - 30);
    this.history = [];
    this.savePrev();
    scene.add(new Game.RewindTrail(this, path));
    if (heal > 0) scene.effects.burst(this.cx, this.feet - 16, ['#ffffff', '#9ffff0', '#3fe0c5', '#f2c14e'], 14, { speed: 80, lift: 60, gravity: -40 });
    Game.events.emit('rewind', { fighter: this, heal });
  }

  /** Antigravidade: flutua sem controle e depois despenca. */
  startFloat(time, scene) {
    this.state = 'floating';
    this.stateTime = 0;
    this.floatT = time;
    this.floatTotal = time;
    this.onGround = false;
    this.vy = -120;
    this.vx *= 0.2;
    this.attack = null;
    this.charging = null;
    this.play('hurtHeavy', true);
    scene.effects.ring(this.cx, this.feet - 2, '#ff9ae6', 14);
    Game.events.emit('floatUp', { target: this });
  }

  updateFloat(dt, scene) {
    this.floatT -= dt;
    const k = this.floatTotal ? this.floatT / this.floatTotal : 0;
    // sobe devagar, para lá em cima e balança
    this.vy = k > 0.45 ? -95 * ((k - 0.45) / 0.55) - 10 : Math.sin(this.stateTime * 9) * 8;
    this.vx *= Math.max(0, 1 - dt * 4);
    if (Math.random() < 0.3) {
      scene.effects.burst(this.cx + (Math.random() - 0.5) * 12, this.feet + 2, ['#ffb3ee', '#ff5fd2', '#ffffff'], 1, { speed: 20, lift: 30, gravity: -30 });
    }
    if (this.floatT <= 0) {
      // a gravidade volta de uma vez: despenca
      this.state = 'launched';
      this.stateTime = 0;
      this.vy = 260;
      this.slamDamage = Game.config.antigrav.slam;
      this.play('knockFly', true);
      return 1.4;
    }
    return 0;
  }

  launch(dir, power, scene) {
    this.bounced = power < 0.7; // rasteira: cai sem quicar
    this.state = 'launched';
    this.stateTime = 0;
    this.onGround = false;
    this.vx = -dir * 140 * power;
    this.vy = -300 * power;
    this.play('knockFly', true);
    scene.effects.freeze(0.1);
    scene.effects.shake(0.2, 2);
    Game.events.emit('knockdown', { target: this });
  }

  /** Encurralado no canto: quem bateu é que é empurrado para trás. */
  pushAttacker(from, dir, scene, power) {
    if (!(from instanceof Game.Fighter) || !from.onGround || from.state === 'super') return;
    const left = 0;
    const right = scene.map.pixelWidth;
    const atWall = dir > 0 ? this.x <= left + 2 : this.x + this.w >= right - 2;
    if (atWall) from.vx = dir * power;
  }

  // ------------------------------------------------------------------ desenho
  updateAnimation(dt) {
    if (this.state === 'iced') return; // congelado: a pose para
    if (this.attack || Game.REACT_STATES.has(this.state)) {
      this.anim.update(dt);
      return;
    }
    const a = this.char.anims;
    let role;
    if (this.charging) role = this.charging.full ? 'charged' : 'charge';
    else if (this.state === 'dash') role = 'walk';
    else if (this.floating && a.float) role = 'float';
    else if (!this.onGround) role = this.vy < 0 ? 'jump' : 'fall';
    else if (this.state === 'crouch') role = 'crouch';
    else if (this.guarding) role = 'block';
    else if (Math.abs(this.vx) > 6) role = 'walk';
    else role = (this.guardTimer > 0 || this.mode === 'fight') && a.guard ? 'guard' : 'idle';
    this.guardTimer -= dt;
    this.play(role);
    const speed = this.mode === 'fight' ? this.fc.walkForward : this.cfg.maxSpeed;
    let rate = 1;
    if (role === 'walk') {
      rate = Math.max(0.5, Math.abs(this.vx) / speed);
      // recuando: passos um pouco mais lentos, para "pesar" o recuo
      if (this.mode === 'fight' && Math.sign(this.vx) !== this.facing) rate *= 0.85;
    }
    this.anim.update(dt * rate);
  }

  draw(ctx, renderer, alpha = 1) {
    const def = this.sheet.def;
    const p = this.lerpPos(alpha);
    const x = renderer.snap(p.x + this.w / 2 - def.anchor.x);
    const y = renderer.snap(p.y + this.h - def.anchor.y);
    // sombra no chão (só no modo luta, onde o chão é plano)
    if (this.mode === 'fight' && this.groundY !== undefined) {
      const lift = Math.max(0, this.groundY - (p.y + this.h));
      const half = Math.max(3, Math.round(8 - lift / 10));
      ctx.fillStyle = 'rgba(10, 16, 28, 0.35)';
      ctx.fillRect(Math.round(p.x + this.w / 2) - half, this.groundY - 1, half * 2, 2);
    }
    if (this.hidden) return; // no meio do teletransporte
    if (this.aura > 0 || this.inDomain) this.drawAura(ctx, x, y);
    const moon = this.char.moon && !this.ko ? this.moonPos(p) : null;
    if (moon && moon.back) this.drawMoon(ctx, moon);
    this.sheet.draw(ctx, this.anim.frame, x, y, this.facing < 0, this.flash > 0);
    if (moon && !moon.back) this.drawMoon(ctx, moon);
    if (this.eyeFlash > 0 && def.eye && !Game.REACT_STATES.has(this.state)) this.drawEyeFlare(ctx, p, def.eye);
    if (this.state === 'iced') this.drawIce(ctx, p);
    if (this.rooted > 0) {
      // pés soldados: cordões de solda incandescente no chão
      const fx = Math.round(p.x);
      const fy = Math.round(p.y + this.h);
      const hot = Math.floor(this.clock * 12) % 2;
      ctx.fillStyle = hot ? '#ffb347' : '#ff7a2f';
      ctx.fillRect(fx - 2, fy - 2, 5, 2);
      ctx.fillRect(fx + this.w - 3, fy - 2, 5, 2);
      ctx.fillStyle = '#fff1b8';
      ctx.fillRect(fx - 1, fy - 2, 2, 1);
      ctx.fillRect(fx + this.w - 2, fy - 2, 2, 1);
    }
    if (this.inverted > 0 && !this.ko) this.drawInverted(ctx, p);
    if (this.state === 'dizzy') {
      // estrelinhas girando sobre a cabeça
      const cx = Math.round(p.x + this.w / 2);
      const top = Math.round(p.y + this.h - def.anchor.y + (def.headY || 4));
      for (let i = 0; i < 3; i++) {
        const ang = this.clock * 5 + i * 2.09;
        const sx = Math.round(cx + Math.cos(ang) * 8);
        const sy = Math.round(top + Math.sin(ang) * 2);
        ctx.fillStyle = i === 0 ? '#ffffff' : '#fff3b0';
        ctx.fillRect(sx - 1, sy, 3, 1);
        ctx.fillRect(sx, sy - 1, 1, 3);
      }
    }
  }

  /** Controles trocados: duas setas em sentidos opostos piscando em cima da cabeça. */
  drawInverted(ctx, p) {
    const cx = Math.round(p.x + this.w / 2);
    const top = Math.round(p.y - 12 + Math.sin(this.clock * 6) * 1);
    const blink = Math.floor(this.clock * 6) % 2;
    const fade = this.inverted < 0.6 && Math.floor(this.clock * 14) % 2;
    if (fade) return;
    ctx.fillStyle = 'rgba(20, 6, 12, 0.75)';
    ctx.fillRect(cx - 6, top - 1, 13, 9);
    const arrow = (y, dir, color) => {
      ctx.fillStyle = color;
      ctx.fillRect(cx - 4, y, 9, 1);
      const tip = dir > 0 ? cx + 4 : cx - 4;
      ctx.fillRect(tip - dir, y - 1, 1, 3);
      ctx.fillRect(tip - dir * 2, y - 2, 1, 5);
    };
    arrow(top + 2, 1, blink ? '#ffffff' : '#ff8aa0');
    arrow(top + 5, -1, blink ? '#ff8aa0' : '#ffffff');
  }

  /** Órbita: uma luazinha girando em volta dele (passa na frente e atrás). */
  moonPos(p) {
    const a = this.clock * 2.6;
    return {
      x: Math.round(p.x + this.w / 2 + Math.cos(a) * 13),
      y: Math.round(p.y + this.h - 20 + Math.sin(a) * 4),
      back: Math.sin(a) < 0,
    };
  }

  drawMoon(ctx, m) {
    ctx.fillStyle = '#2a1f3a';
    ctx.fillRect(m.x - 2, m.y - 1, 5, 3);
    ctx.fillRect(m.x - 1, m.y - 2, 3, 5);
    ctx.fillStyle = m.back ? '#9c94b8' : '#e8e2f4';
    ctx.fillRect(m.x - 1, m.y - 1, 3, 3);
    ctx.fillStyle = m.back ? '#6e6890' : '#b8b0d0';
    ctx.fillRect(m.x, m.y, 1, 1);
    ctx.fillRect(m.x + 1, m.y - 1, 1, 1);
  }

  /** Corvo: o olho rubro brilha quando copia (rastro vermelho saindo do olho). */
  drawEyeFlare(ctx, p, eye) {
    const ex = Math.round(p.x + this.w / 2 + this.facing * eye.x);
    const ey = Math.round(p.y + this.h + eye.y);
    const len = Math.round(4 + this.eyeFlash * 10);
    ctx.fillStyle = '#ff3030';
    ctx.fillRect(this.facing > 0 ? ex - len : ex + 1, ey, len, 1);
    ctx.fillStyle = '#ffd0d0';
    ctx.fillRect(ex, ey, 1, 1);
    if (Math.floor(this.clock * 20) % 2) {
      ctx.fillStyle = '#ff8080';
      ctx.fillRect(ex - 1, ey - 1, 3, 1);
      ctx.fillRect(ex - 1, ey + 1, 3, 1);
    }
  }

  /** Contorno colorido piscando (sinal de mão do domínio e enquanto ele dura). */
  drawAura(ctx, x, y) {
    const color = this.shadow ? '#b47cff' : this.char.color;
    const strong = this.aura > 0;
    if (!strong && Math.floor(this.clock * 8) % 3 !== 0) return;
    const tint = this.sheet.tinted(color);
    const fw = this.sheet.def.frameWidth;
    const fh = this.sheet.def.frameHeight;
    const frame = this.anim.frame;
    const sx = (frame % this.sheet.columns) * fw;
    const sy = Math.floor(frame / this.sheet.columns) * fh;
    const flip = this.facing < 0;
    const offs = strong && Math.floor(this.clock * 20) % 2 ? [[2, 0], [-2, 0], [0, 2], [0, -2], [1, 1], [-1, -1], [1, -1], [-1, 1]]
      : [[1, 0], [-1, 0], [0, 1], [0, -1]];
    ctx.save();
    ctx.globalAlpha = strong ? 0.95 : 0.6;
    for (const [dx, dy] of offs) {
      if (flip) {
        ctx.save();
        ctx.translate(x + dx + fw, y + dy);
        ctx.scale(-1, 1);
        ctx.drawImage(tint, sx, sy, fw, fh, 0, 0, fw, fh);
        ctx.restore();
      } else {
        ctx.drawImage(tint, sx, sy, fw, fh, x + dx, y + dy, fw, fh);
      }
    }
    ctx.restore();
  }

  /** Bloco de gelo em volta do corpo; racha quando está para quebrar. */
  drawIce(ctx, p) {
    const left = Math.round(p.x) - 3;
    const top = Math.round(p.y) - 3;
    const w = this.w + 6;
    const h = this.h + 3;
    const ratio = this.iceTotal ? Math.max(0, this.stateTimer / this.iceTotal) : 1;
    ctx.save();
    ctx.globalAlpha = 0.42;
    ctx.fillStyle = '#9fdcff';
    ctx.fillRect(left, top, w, h);
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = '#e8f8ff';
    ctx.fillRect(left, top, w, 1);
    ctx.fillRect(left, top, 1, h);
    ctx.fillStyle = '#5aa8e0';
    ctx.fillRect(left, top + h - 1, w, 1);
    ctx.fillRect(left + w - 1, top, 1, h);
    // reflexos
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(left + 2, top + 2, 1, 5);
    ctx.fillRect(left + 3, top + 2, 2, 1);
    ctx.fillRect(left + w - 4, top + h - 8, 1, 4);
    // rachaduras conforme o gelo enfraquece
    if (ratio < 0.66) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(left + w - 6, top + 4, 1, 3);
      ctx.fillRect(left + w - 5, top + 7, 1, 2);
      ctx.fillRect(left + w - 7, top + 9, 1, 2);
    }
    if (ratio < 0.33) {
      ctx.fillRect(left + 4, top + h - 10, 1, 3);
      ctx.fillRect(left + 5, top + h - 7, 2, 1);
      ctx.fillRect(left + 7, top + h - 6, 1, 3);
    }
    ctx.restore();
  }
};

// Quanto tempo (s) cada botão fica guardado esperando o lutador poder agir (só na luta)
Game.Fighter.BUFFER = [['punch', 0.12], ['special', 0.15], ['jump', 0.1], ['super', 0.25], ['domain', 0.25], ['left', 0.12], ['right', 0.12]];
