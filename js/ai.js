/*
 * CpuController: o "controle" da CPU. Tem a mesma cara da entrada do jogador
 * (axisX, isHeld, consumePress), então o lutador da CPU segue exatamente as
 * mesmas regras que o seu — ela só decide quais botões apertar.
 *
 * A cada "pensamento" (config.cpu[nível].think segundos) escolhe um plano:
 *   approach  chegar perto        pressure  chegar e bater
 *   guard     defender (em pé ou agachado)
 *   retreat   recuar              wait      esperar
 *   air       pulo para cima do adversário com golpe aéreo
 * Fora isso reage na hora: projéteis vindo (defende, agacha ou pula),
 * adversário pulando (golpe antiaéreo), golpe que errou (punição), combos.
 *
 * Parâmetros por nível (0 a 1): block, aggro, antiAir, special, combo;
 * react = atraso de reação em segundos.
 *
 * Também sabe: guardar barra para a Expansão de Domínio (e expandir por cima do
 * domínio do adversário para o embate), apertar botões para sair do gelo e no
 * embate (mash), usar o pico de gelo e o mergulho da Gélida, e o teleporte e o
 * raio do Trovão. E os novos: o Corvo usa o golpe que copiou e a Leitura contra
 * golpes e projéteis; a Ampulheta joga a bolha e rebobina depois de apanhar; o
 * Órbita abre buracos negros, faz flutuar e pula atrás, e plana no ar.
 */
window.Game = window.Game || {};

Game.CpuController = class CpuController {
  constructor(level = 'normal') {
    this.level = Game.config.cpu[level] ? level : 'normal';
    this.p = Game.config.cpu[this.level];
    this.held = {};
    this.presses = {};
    this.queue = [];
    this.plan = { type: 'wait', t: 0.3 };
    this.thinkTimer = 0.2;
    this.seenAttack = null;
    this.comboFor = null;
    this.punishFor = null;
    this.reacted = new WeakSet();
    this.oppWasGrounded = true;
    this.antiAir = null;
    this.shotTimer = 0;    // pausa entre especiais, para a CPU não viver só de projétil
    this.downOnce = false; // segura ↓ só neste passo (↓ + especial)
    this.clashFor = null;  // domínio do adversário que já decidiu (ou não) desafiar
    this.saveForDomain = Math.random() < 0.6;
  }

  /** Embate de domínios / sair do gelo: aperta botões num ritmo que depende do nível. */
  mash(dt) {
    const rate = { easy: 5, normal: 7.5, hard: 9.5 }[this.level] || 7;
    return Math.random() < rate * dt * (0.8 + Math.random() * 0.4);
  }

  // ---------------------------------------------------- interface de entrada
  axisX() {
    return (this.held.right ? 1 : 0) - (this.held.left ? 1 : 0);
  }

  isHeld(action) {
    return !!this.held[action];
  }

  consumePress(action) {
    const v = !!this.presses[action];
    this.presses[action] = false;
    return v;
  }

  // ---------------------------------------------------- ajudantes
  press(action) {
    this.presses[action] = true;
  }

  setDir(d) {
    // Fios Trocados: depois de um tempinho a CPU percebe e passa a apertar o lado contrário
    if (this.me && this.me.inverted > 0 && this.invT >= ({ easy: 99, normal: 1.1, hard: 0.5 }[this.level] || 1.1)) d = -d;
    this.held.left = d < 0;
    this.held.right = d > 0;
  }

  later(t, fn) {
    this.queue.push({ t, fn });
  }

  reset() {
    this.held = {};
    this.presses = {};
    this.queue = [];
    this.plan = { type: 'wait', t: 0.3 };
    this.thinkTimer = 0.25 + Math.random() * 0.25;
    this.shotTimer = 0.6 + Math.random() * 0.8;
    // em boa parte dos rounds a CPU guarda a barra para a Expansão de Domínio
    this.saveForDomain = Math.random() < 0.6;
  }

  /** Está juntando barra para o domínio (então evita gastar no super)? */
  saving(me, opp) {
    return this.saveForDomain && !this.noDomain && !me.inDomain && me.meter < me.fc.meter.domainCost && opp.hp > 25;
  }

  chance(x) {
    return Math.random() < x;
  }

  /** Alcance do primeiro golpe do combo (centro a centro), com folga. */
  reachOf(me) {
    const first = me.sheet.def.animations[me.char.combo[0]];
    const h = first && first.hit;
    return h ? h.x + h.w + me.w / 2 - 1 : 22;
  }

  hasSweep(me) {
    return !!me.sheet.def.animations.sweep;
  }

  /** Alcance da rasteira (centro a centro). */
  sweepReach(me) {
    const h = me.sheet.def.animations.sweep.hit;
    return h.x + h.w + me.w / 2 - 2;
  }

  ownProjectile(me, scene) {
    return scene.entities.some((e) => e instanceof Game.Projectile && e.owner === me && !e.dead);
  }

  canShoot(me, scene) {
    const s = me.char.special;
    if (s === 'iceSpike') {
      return this.shotTimer <= 0 && me.specialCooldown <= 0
        && !scene.entities.some((e) => e instanceof Game.Strike && e.kind === 'spike' && e.owner === me && !e.dead);
    }
    return (s === 'energyBall' || s === 'book') && this.shotTimer <= 0 && me.specialCooldown <= 0
      && (me.inDomain || !this.ownProjectile(me, scene));
  }

  /** ↓ + especial (segundo especial). */
  special2() {
    this.downOnce = true;
    this.press('special');
  }

  restAfterSpecial() {
    this.shotTimer = 1.6 - this.p.special * 2 + Math.random() * 0.8;
  }

  shoot(me, dist) {
    this.restAfterSpecial();
    if (me.char.special === 'energyBall' && dist > 140 && this.chance(0.45)) {
      // bola grande: segura o especial até carregar
      this.held.special = true;
      this.press('special');
      this.later(0.5 + Math.random() * 0.15, () => { this.held.special = false; });
    } else {
      this.held.special = false;
      this.press('special');
    }
  }

  dash(dir) {
    const side = dir < 0 ? 'left' : 'right';
    this.press(side);
    this.later(0.07, () => this.press(side));
  }

  cornered(me, scene) {
    return me.x <= 6 || me.x + me.w >= scene.map.pixelWidth - 6;
  }

  // ---------------------------------------------------- a cada passo
  update(dt, me, opp, scene) {
    this.me = me;
    this.invT = me.inverted > 0 ? (this.invT || 0) + dt : 0;
    // fila de ações agendadas (toques duplos, soltar o especial...)
    if (this.queue.length) {
      for (const q of this.queue) q.t -= dt;
      const due = this.queue.filter((q) => q.t <= 0);
      this.queue = this.queue.filter((q) => q.t > 0);
      for (const q of due) q.fn();
    }
    if (me.state === 'grabbed') {
      // agarrado: às vezes escapa apertando soco na hora
      if (!this.techTried) {
        this.techTried = true;
        if (this.chance(this.p.block * 0.6)) this.later(0.04 + Math.random() * 0.14, () => this.press('punch'));
      }
      return;
    }
    this.techTried = false;
    if (me.state === 'iced') {
      // congelado: aperta botões para quebrar o gelo
      if (this.mash(dt)) this.press('punch');
      return;
    }
    if (!opp || scene.locked || !me.canAct() && me.state !== 'block') {
      // sem controle (apanhando, caído, fim de round): solta tudo, menos a defesa
      if (me.state !== 'block') {
        this.setDir(0);
        this.held.down = false;
      }
      if (!me.charging) this.held.special = false;
      return;
    }
    const dist = Math.abs(opp.cx - me.cx);
    const toward = me.dirTo(opp);
    const p = this.p;
    this.shotTimer -= dt;

    if (me.state === 'block') {
      this.setDir(-toward); // continua defendendo a sequência
      const oa = opp.attack;
      if (oa && oa !== this.lowRead && oa.def.hit) {
        this.lowRead = oa;
        if (oa.def.hit.low) { if (this.chance(0.3 + p.block * 0.6)) this.held.down = true; }
        else if (oa.air) this.held.down = false;
      }
      return;
    }

    // Domínio do adversário aberto: desafia com o próprio (embate), se tiver barra
    const dom = scene.domain;
    if (dom && dom.owner === opp && dom.phase !== 'break' && this.clashFor !== dom && me.domainReady) {
      this.clashFor = dom;
      const want = { easy: 0.25, normal: 0.6, hard: 0.9 }[this.level] || 0.5;
      if (this.chance(want)) this.later(0.15 + Math.random() * 0.5, () => this.press('domain'));
    }

    // Projétil vindo na minha direção
    for (const e of scene.entities) {
      if (!(e instanceof Game.Projectile) || e.dead || e.team === me.team || this.reacted.has(e)) continue;
      const coming = Math.sign(me.cx - e.cx) === Math.sign(e.vx);
      const gap = Math.abs(me.cx - e.cx);
      if (!coming || gap > 150) continue;
      this.reacted.add(e);
      // Trovão: some e reaparece atrás de quem atirou
      if (me.char.special === 'teleport' && me.specialCooldown <= 0 && gap > 40 && this.chance(p.special * 1.6)) {
        this.later(p.react, () => this.press('special'));
        continue;
      }
      // Corvo: Leitura na hora em que o projétil chega (some e aparece atrás de quem atirou)
      if (me.char.special2 === 'counter' && me.specialCooldown <= 0 && gap > 24 && gap < 140 && this.chance(p.special * 1.6)) {
        const speed = Math.max(80, Math.abs(e.vx || 150));
        this.later(Math.max(0.02, gap / speed - 0.28), () => this.special2());
        continue;
      }
      // Órbita: o buraco negro engole o projétil no caminho
      if (me.char.special === 'blackhole' && me.specialCooldown <= 0 && gap > 70 && this.chance(p.special * 1.2)) {
        this.later(p.react * 0.6, () => this.press('special'));
        continue;
      }
      // Soldador: fecha um portão de ferro na frente (o projétil bate nele)
      if (me.char.special2 === 'gate' && me.specialCooldown <= 0 && gap > 55 && this.chance(p.special * 1.8)) {
        this.later(p.react * 0.8, () => this.special2());
        continue;
      }
      if (this.chance(p.block + 0.1)) this.later(p.react * (0.6 + Math.random() * 0.8), () => this.dodge(e, me, opp));
    }

    // Espetáculo da Marionete: a cruz desce em cima de mim — sai de baixo antes dos fios chegarem
    for (const e of scene.entities) {
      if (!(e instanceof Game.PuppetShow) || e.target !== me || e.phase !== 'warn' || this.reacted.has(e)) continue;
      this.reacted.add(e);
      if (!this.chance(p.block + 0.1)) continue;
      this.later(p.react, () => {
        if (e.phase !== 'warn' || !me.canAct() || !me.onGround) return;
        this.held.down = false;
        this.dash(this.cornered(me, scene) ? me.dirTo(opp) : -me.dirTo(opp));
        this.plan = { type: 'wait', t: 0.35 };
      });
    }

    // Adversário saiu do chão: antiaéreo?
    const oppAir = !opp.onGround && opp.state !== 'launched' && !opp.ko;
    if (oppAir && this.oppWasGrounded) {
      const r = Math.random();
      this.antiAir = r < p.antiAir ? 'hit' : r < p.antiAir + p.block * 0.5 ? 'guard' : null;
    }
    this.oppWasGrounded = opp.onGround;
    if (oppAir && this.antiAir) {
      if (this.antiAir === 'guard') {
        this.plan = { type: 'guard', t: 0.2, crouch: false };
      } else if (this.antiAir === 'hit' && opp.vy > 0 && dist < this.reachOf(me) + 8 && !me.attack) {
        // o Brasa usa o gancho ascendente (invencível no começo); o Corvo também, se copiou
        const rise = me.char.special === 'rise' || (me.char.special === 'copy' && me.copied === 'rise');
        if (rise && me.specialCooldown <= 0) this.press('special');
        else if (me.char.super === 'inferno' && me.superReady && this.chance(0.5)) this.press('super');
        else this.press('punch');
        this.antiAir = null;
      }
    }

    // Golpe do adversário começando perto de mim: às vezes já estou defendendo
    if (opp.attack && opp.attack !== this.seenAttack) {
      this.seenAttack = opp.attack;
      const reach = this.reachOf(opp) + (opp.attack.def.lunge ? 14 : 4) + (opp.attack.def.dash ? 50 : 0);
      if (me.char.special2 === 'counter' && me.specialCooldown <= 0 && me.onGround && !me.attack && opp.attack.def.hit
          && dist < reach + 8 && this.chance(p.special * 0.9)) {
        this.special2(); // Leitura: espera o golpe chegar na postura
      } else if (dist < reach && !me.attack && this.chance(p.block * 0.55)) {
        const low = opp.attack.def.hit && opp.attack.def.hit.low;
        this.plan = { type: 'guard', t: 0.35, crouch: low ? this.chance(0.4 + p.block * 0.55) : !opp.attack.air && this.chance(0.3) };
      }
    }

    // Golpe do adversário errou e está recolhendo: punição
    const recovering = opp.attack && opp.attack.hitDone && !opp.attack.landed && opp.onGround;
    if (recovering && opp.attack !== this.punishFor && dist < this.reachOf(me) + 6 && !me.attack) {
      this.punishFor = opp.attack;
      if (this.chance(p.aggro)) this.later(p.react * 0.5, () => this.press('punch'));
    }

    // Conta quantas vezes o adversário defendeu (para decidir agarrar)
    if (opp.state === 'block' && this.lastOppState !== 'block') this.oppBlocked = (this.oppBlocked || 0) + 1;
    this.lastOppState = opp.state;

    // Meu golpe acertou: continua o combo ou cancela no especial
    if (me.attack && me.attack.landed && this.comboFor !== me.attack) {
      this.comboFor = me.attack;
      const combo = me.char.combo;
      const last = me.attack.kind === combo[combo.length - 1];
      if (combo.includes(me.attack.kind) && !last && this.chance(p.combo)) {
        const saving = this.saving(me, opp); // guardando barra para o domínio
        const superCancel = me.superReady && me.char.super !== 'beam' && !saving && this.chance(0.55);
        // teleporte no meio do combo só às vezes (vira uma mistura de lados)
        const tele = me.char.special === 'teleport';
        const cancel = !superCancel && this.chance(p.special * (tele ? 0.4 : 0.8)) && me.specialCooldown <= 0;
        const delay = 0.03 + Math.random() * 0.05;
        // soco, soco, ↓ + soco: às vezes fecha o combo com a rasteira
        const sweepEnd = !superCancel && !cancel && me.attack.kind === combo[combo.length - 2] && this.hasSweep(me) && this.chance(0.3);
        this.later(delay, () => {
          if (sweepEnd) this.downOnce = true;
          this.press(superCancel ? 'super' : cancel ? 'special' : 'punch');
        });
      }
    }

    this.thinkTimer -= dt;
    this.plan.t -= dt;
    if (this.thinkTimer <= 0 || this.plan.t <= 0) {
      this.think(me, opp, scene, dist, toward);
      this.thinkTimer = p.think * (0.7 + Math.random() * 0.6);
    }
    this.follow(me, opp, dist, toward);
  }

  /** Reação a um projétil: agachar, pular por cima ou defender. */
  dodge(proj, me, opp) {
    if (proj.dead || !me.canAct() || !me.onGround) return;
    const toward = me.dirTo(opp);
    const duckable = proj.y + proj.h <= me.feet - Game.config.fight.crouchHeight - 0.5;
    const gap = Math.abs(proj.cx - me.cx);
    const r = Math.random();
    if (duckable && r < 0.4) {
      this.plan = { type: 'guard', t: 0.55, crouch: true };
    } else if (r < 0.7 && gap > 34 && gap < 130) {
      this.held.down = false;
      this.setDir(toward);
      this.press('jump');
      this.plan = { type: 'air', t: 0.7 };
    } else {
      this.plan = { type: 'guard', t: 0.5, crouch: duckable };
    }
  }

  think(me, opp, scene, dist, toward) {
    const p = this.p;
    const range = this.reachOf(me);
    const r = Math.random();
    const oppDown = ['down', 'getup', 'launched'].includes(opp.state);
    const oppOpen = opp.state === 'hurt' || opp.state === 'dizzy' || opp.state === 'iced';

    // Parada do Tempo dela: corre e bate em quem está parado
    if (scene.timeStop && scene.timeStop.owner === me) {
      this.plan = { type: 'pressure', t: 0.5 };
      return;
    }
    // Bomba-relógio: quem está com ela corre para passar com um golpe; o outro foge e defende
    const tb = scene.entities.find((e) => e instanceof Game.TimeBomb && !e.dead && e.carrier);
    if (tb && tb.carrier === me && this.chance(0.55 + p.aggro * 0.4)) {
      this.plan = { type: 'pressure', t: 0.45 };
      return;
    }
    if (tb && tb.carrier === opp && this.chance(0.4 + p.block * 0.5)) {
      // de longe, o Pavio segura o outro com bombas; senão recua (no canto, defende)
      const zone = me.char.special === 'bomb' && dist > 60 && this.chance(0.5);
      if (!zone) {
        this.plan = { type: this.cornered(me, scene) || dist < 26 ? 'guard' : 'retreat', t: 0.4, crouch: this.chance(0.4) };
        return;
      }
    }
    const dom = scene.domain;
    const myDomain = dom && dom.owner === me;
    const theirDomain = dom && dom.owner === opp && dom.phase !== 'break';
    // Expansão de Domínio: com a barra cheia e nenhum domínio aberto
    if (me.domainReady && !dom && !this.noDomain && opp.state !== 'launched' && opp.state !== 'down'
        && this.chance(opp.state === 'dizzy' || opp.state === 'hurt' ? 0.7 : 0.18 + p.special)) {
      this.held.down = false;
      this.setDir(0);
      this.press('domain');
      this.plan = { type: 'wait', t: 0.4 };
      return;
    }
    if (opp.state === 'dizzy') {
      if (me.superReady && !this.saving(me, opp) && this.useSuper(me, opp, dist, true)) return;
      this.plan = { type: 'pressure', t: 0.8 };
      return;
    }
    // congelado: corre e estilhaça o gelo com o combo
    if (opp.state === 'iced' && dist < 130) {
      this.plan = { type: 'pressure', t: 0.5 };
      return;
    }
    // dentro do próprio domínio: pressão total
    if (myDomain && dist > this.reachOf(me) + 4 && this.chance(0.7)) {
      if (me.char.special === 'teleport' && me.specialCooldown <= 0 && this.chance(0.5)) this.press('special');
      this.plan = { type: 'pressure', t: 0.6 };
      return;
    }
    // no domínio do adversário: defende mais e foge da mira
    if (theirDomain && this.chance(p.block * 0.5)) {
      this.plan = { type: this.chance(0.5) ? 'guard' : 'retreat', t: 0.35, crouch: this.chance(0.3) };
      return;
    }
    const saving = this.saving(me, opp); // juntando para o domínio: quase não gasta no super
    if (me.superReady && this.chance((0.25 + p.special) * (saving ? 0.02 : 1)) && this.useSuper(me, opp, dist, false)) return;
    // colado em quem só defende: agarrão (para frente ou para trás)
    const turtle = this.oppBlocked > 1; // adversário defendendo muito: hora de agarrar
    if (dist < this.reachOf(me) + 10 && opp.onGround && this.chance(p.aggro * (turtle ? 0.6 : 0.25))) {
      this.oppBlocked = 0;
      // chega bem perto e agarra (70% para frente, 30% jogando para trás)
      this.plan = { type: 'grab', dir: this.chance(0.7) ? 1 : -1, t: 0.6 };
      return;
    }
    if (oppDown) {
      // espera o adversário levantar a uma distância segura
      if (dist > 56) this.plan = { type: 'approach', until: 44, t: 0.5 };
      else if (dist < 30) this.plan = { type: 'retreat', t: 0.25 };
      else this.plan = { type: this.chance(p.block) ? 'guard' : 'wait', t: 0.35 };
      return;
    }
    if (this.newKit(me, opp, scene, dist, r)) return;
    const spikeRange = Game.config.iceSpike.range;
    if (me.char.special === 'torch' && me.specialCooldown <= 0 && opp.onGround
        && dist < Game.config.torch.range + (me.inDomain ? 22 : 4) && r < p.special * 2.4) {
      // Soldador: maçarico de perto
      this.press('special');
      this.plan = { type: 'wait', t: 0.45 };
      return;
    }
    if (me.char.special2 === 'gate' && me.specialCooldown <= 0 && this.shotTimer <= 0
        && ((dist > 30 && dist < 62) || me.inDomain) && r < p.special * 1.3) {
      // Soldador: o portão despenca em cima de quem está a meia distância
      this.restAfterSpecial();
      this.special2();
      this.plan = { type: 'wait', t: 0.35 };
      return;
    }
    if (me.char.special2 === 'bolt' && me.specialCooldown <= 0 && this.shotTimer <= 0 && opp.onGround
        && dist > Game.config.bolt.near + 4 && dist < Game.config.bolt.far - 6 && r < p.special * 1.8) {
      // Trovão: o adversário está na distância do raio
      this.restAfterSpecial();
      this.special2();
      this.plan = { type: 'wait', t: 0.4 };
      return;
    }
    if (dist > 110) {
      if (this.canShoot(me, scene) && r < p.special * 1.8 && (me.char.special !== 'iceSpike' || dist <= spikeRange)) {
        this.shoot(me, dist);
        this.plan = { type: 'wait', t: 0.35 };
        return;
      }
      if (me.char.special === 'teleport' && me.specialCooldown <= 0 && this.shotTimer <= 0 && r < p.special * 1.5) {
        this.restAfterSpecial();
        this.press('special'); // chega perto num piscar
        this.plan = { type: 'wait', t: 0.3 };
        return;
      }
      if (this.chance(0.1 + p.aggro * 0.25)) this.dash(toward);
      this.plan = { type: 'approach', until: range, t: 0.7 };
      return;
    }
    if (dist > range + 10) {
      if (this.canShoot(me, scene) && r < p.special) {
        this.shoot(me, dist);
        this.plan = { type: 'wait', t: 0.3 };
        return;
      }
      if (me.char.special === 'dash' && dist < 72 && this.shotTimer <= 0 && me.specialCooldown <= 0 && r < p.special * 1.2) {
        this.restAfterSpecial();
        this.press('special');
        this.plan = { type: 'wait', t: 0.35 };
        return;
      }
      if (dist < 90 && r < p.aggro * 0.22) {
        this.held.down = false;
        this.setDir(toward);
        this.press('jump');
        this.plan = { type: 'air', t: 0.75 };
        return;
      }
      if (r < p.aggro) {
        this.plan = { type: this.chance(0.5) ? 'pressure' : 'approach', until: range - 2, t: 0.6 };
        return;
      }
      if (r < p.aggro + p.block * 0.45) {
        this.plan = { type: 'guard', t: 0.35 + Math.random() * 0.3, crouch: this.chance(0.4) };
        return;
      }
      this.plan = { type: this.chance(0.5) ? 'retreat' : 'wait', t: 0.25 + Math.random() * 0.3 };
      return;
    }
    // perto: rasteira em quem fica em pé (principalmente em quem defende em pé)
    const oppStanding = opp.onGround && !opp.attack && opp.h > Game.config.fight.crouchHeight + 2;
    if (oppStanding && this.hasSweep(me) && dist < this.sweepReach(me) && !me.attack
        && this.chance((opp.state === 'block' || this.oppBlocked > 0 ? 0.4 : 0.14) * (0.5 + p.aggro))) {
      this.oppBlocked = 0;
      this.downOnce = true;
      this.press('punch');
      this.plan = { type: 'wait', t: 0.3 };
      return;
    }
    if (oppOpen || r < p.aggro * 0.85) {
      if (!me.attack) this.press('punch');
      this.plan = { type: 'wait', t: 0.18 };
      return;
    }
    if (r < p.aggro + p.block) {
      this.plan = { type: 'guard', t: 0.3 + Math.random() * 0.4, crouch: this.chance(0.45) };
      return;
    }
    if (me.char.special === 'rise' && me.specialCooldown <= 0 && this.chance(p.special)) {
      this.press('special'); // gancho para sair da pressão
      this.plan = { type: 'wait', t: 0.4 };
      return;
    }
    if (this.cornered(me, scene) && this.chance(0.5)) {
      this.held.down = false;
      this.setDir(toward);
      this.press('jump'); // sai do canto pulando por cima
      this.plan = { type: 'air', t: 0.7 };
      return;
    }
    this.plan = { type: 'retreat', t: 0.2 + Math.random() * 0.25 };
  }

  /** Especiais dos lutadores novos. true = já decidiu o que fazer. */
  newKit(me, opp, scene, dist, r) {
    const p = this.p;
    const ch = me.char;
    const ready = me.specialCooldown <= 0 && this.shotTimer <= 0;
    const go = (second, wait = 0.35) => {
      this.restAfterSpecial();
      this.held.special = false;
      if (second) this.special2();
      else this.press('special');
      this.plan = { type: 'wait', t: wait };
      return true;
    };
    const mine = (cls) => scene.entities.some((e) => e instanceof cls && e.owner === me && !e.dead);
    if (ch.special === 'copy') {
      // Corvo: o que fazer depende do golpe que o olho copiou
      if (!ready) return false;
      const k = me.copied || 'kunai';
      let ok = false;
      if (k === 'kunai' || k === 'book' || k === 'energyBall') ok = dist > 70 && (me.inDomain || !this.ownProjectile(me, scene)) && r < p.special * 1.8;
      else if (k === 'iceSpike') ok = dist > 40 && dist <= Game.config.iceSpike.range && r < p.special * 1.6;
      else if (k === 'bolt') ok = dist > Game.config.bolt.near + 4 && dist < Game.config.bolt.far - 6 && opp.onGround && r < p.special * 1.6;
      else if (k === 'torch') ok = dist < Game.config.torch.range + 6 && opp.onGround && r < p.special * 2.2;
      else if (k === 'gate') ok = dist > 30 && dist < 62 && r < p.special * 1.3;
      else if (k === 'dash') ok = dist > 30 && dist < 80 && r < p.special * 1.2;
      else if (k === 'teleport') ok = dist > 110 && r < p.special * 1.4;
      else if (k === 'bubble') ok = dist > 30 && dist < 110 && r < p.special * 1.6;
      else if (k === 'blackhole') ok = dist > 45 && dist < 120 && r < p.special * 1.4;
      else if (k === 'antigrav') ok = dist > 30 && dist < Game.config.antigrav.range && opp.onGround && r < p.special * 1.4;
      else if (k === 'rewind') ok = this.hurtRecently(me) && r < 0.6;
      else if (k === 'thread') ok = (dist > 50 && dist < Game.config.thread.range || mine(Game.PuppetString)) && r < p.special * 1.6;
      else if (k === 'tangle') ok = dist < Game.config.tangle.range + 4 && opp.inverted <= 0 && r < p.special * 1.2;
      else if (k === 'bomb') ok = dist > 70 && dist < 200 && !mine(Game.Bomb) && r < p.special * 1.6;
      else if (k === 'timebomb') ok = dist < Game.config.timebomb.reach + 10 && !mine(Game.TimeBomb) && r < p.special * 1.4;
      if (ok && k === 'thread' && mine(Game.PuppetString)) this.later(0.22, () => this.press('punch'));
      return ok ? go(false) : false;
    }
    if (ch.special === 'thread') {
      // Marionete: com o fio preso, puxa (ou troca os controles pelo fio) e emenda o combo;
      // lança o fio de meia distância; de perto troca os controles
      const held = scene.entities.find((e) => e instanceof Game.PuppetString && e.owner === me && !e.dead);
      if (held && me.specialCooldown <= 0 && !opp.invulnerable() && opp.state !== 'block' && r < p.special * 3) {
        if (ch.special2 === 'tangle' && opp.inverted <= 0 && !me.inDomain && this.chance(0.3)) return go(true, 0.3);
        this.restAfterSpecial();
        this.held.special = false;
        this.press('special');
        this.later(0.2 + Math.random() * 0.06, () => this.press('punch'));
        this.plan = { type: 'pressure', t: 0.7 };
        return true;
      }
      if (ready && !held && dist > 46 && dist < Game.config.thread.range + 8 && !mine(Game.Thread) && r < p.special * 1.9) return go(false, 0.3);
      if (me.specialCooldown <= 0 && ch.special2 === 'tangle' && dist < Game.config.tangle.range + 4 && opp.inverted <= 0
          && opp.onGround && r < p.special * 1.3) return go(true, 0.35);
      return false;
    }
    if (ch.special === 'bomb') {
      // Pavio: gruda a bomba-relógio de perto; joga bomba de meia/longa distância escolhendo perto ou longe
      if (me.specialCooldown <= 0 && ch.special2 === 'timebomb' && dist < Game.config.timebomb.reach + 12 && opp.onGround
          && !mine(Game.TimeBomb) && r < p.special * 1.7) return go(true, 0.35);
      // a bomba sem direção mira onde o adversário está; se ele vem correndo, ← faz cair mais perto
      const closing = -opp.vx * me.dirTo(opp);
      if (ready && dist > 40 && dist < 220 && (me.inDomain || !mine(Game.Bomb)) && r < p.special * 1.9) {
        this.restAfterSpecial();
        this.held.special = false;
        this.held.down = false;
        this.press('special');
        this.plan = { type: 'hold', dir: closing > 50 && dist > 110 && dist < 170 ? -me.dirTo(opp) : 0, t: 0.3 };
        return true;
      }
      return false;
    }
    if (ch.special === 'bubble') {
      // Ampulheta: rebobina depois de apanhar; joga a bolha a meia distância; bate em quem ficou preso nela
      if (ch.special2 === 'rewind' && me.specialCooldown <= 0 && this.hurtRecently(me) && r < 0.75) return go(true, 0.45);
      if (ready && dist > 34 && dist < 115 && !mine(Game.TimeBubble) && !mine(Game.TimeOrb) && r < p.special * 1.7) return go(false);
      const slowed = scene.entities.some((e) => e instanceof Game.TimeBubble && e.owner === me && !e.dead && e.contains(opp));
      if (slowed) {
        this.plan = { type: 'pressure', t: 0.6 };
        return true;
      }
      return false;
    }
    if (ch.special === 'blackhole') {
      // Órbita: adversário flutuando = pula atrás para bater no ar
      if (opp.state === 'floating' && dist < 80 && me.onGround) {
        this.held.down = false;
        this.setDir(me.dirTo(opp));
        this.press('jump');
        this.plan = { type: 'air', t: 0.9 };
        return true;
      }
      if (ready && ch.special2 === 'antigrav' && opp.onGround && dist > 30 && dist < Game.config.antigrav.range && r < p.special * 1.3) return go(true, 0.5);
      if (ready && dist > 45 && dist < 130 && !mine(Game.BlackHole) && r < p.special * 1.5) return go(false, 0.4);
      return false;
    }
    return false;
  }

  /** Perdeu bastante vida no último segundo (hora de rebobinar)? */
  hurtRecently(me) {
    const h = me.history;
    if (!h || h.length < 3) return false;
    const target = me.clock - Game.config.rewind.back;
    let snap = h[0];
    for (const e of h) {
      if (e.t <= target) snap = e;
      else break;
    }
    return snap.hp - me.hp >= 10;
  }

  /** Decide se este é um bom momento para o super de cada lutador. */
  useSuper(me, opp, dist, open) {
    const kind = me.char.super;
    const oppGround = opp.onGround && !['down', 'getup', 'launched'].includes(opp.state);
    let good = false;
    if (kind === 'beam') good = oppGround && dist > 30;               // de longe, antes que pule
    else if (kind === 'rush') good = oppGround && dist < 90;          // a investida precisa encostar
    else if (kind === 'volley') good = oppGround && dist > 50;
    else if (kind === 'inferno') good = dist < 34 && (open || !opp.onGround || this.chance(0.4));
    else if (kind === 'blizzard') good = oppGround && dist < 170;     // a neve precisa alcançar
    else if (kind === 'thunder') good = oppGround;                    // os raios seguem o adversário
    else if (kind === 'cage') good = oppGround;                       // a jaula cai onde ele estiver
    else if (kind === 'revoada') good = dist < 230;                   // os corvos atravessam a tela
    else if (kind === 'timestop') good = dist < 70 && opp.onGround;   // precisa estar perto para aproveitar
    else if (kind === 'supernova') good = oppGround && dist > 24;
    else if (kind === 'show') good = oppGround && dist < 220;             // a cruz cai em cima de onde ele estiver
    else if (kind === 'barrel') good = oppGround && dist > 36 && dist < 240; // o barril rola pelo chão
    if (!good) return false;
    this.held.down = false;
    this.setDir(0);
    this.press('super');
    this.plan = { type: 'wait', t: 0.5 };
    return true;
  }

  /** Executa o plano atual (direções seguradas a cada passo). */
  follow(me, opp, dist, toward) {
    const plan = this.plan;
    const range = this.reachOf(me);
    switch (plan.type) {
      case 'approach':
        this.held.down = false;
        if (dist > (plan.until || range)) this.setDir(toward);
        else {
          this.setDir(0);
          plan.t = Math.min(plan.t, 0.05);
        }
        break;
      case 'pressure':
        this.held.down = false;
        if (dist > range - 2) this.setDir(toward);
        else {
          this.setDir(0);
          if (!me.attack && !this.presses.punch) this.press('punch');
          plan.t = Math.min(plan.t, 0.12);
        }
        break;
      case 'guard': {
        this.setDir(-toward);
        this.held.down = !!plan.crouch && opp.onGround;
        break;
      }
      case 'retreat':
        this.held.down = false;
        this.setDir(-toward);
        break;
      case 'hold': // segura uma direção sem andar (o golpe já começou)
        this.held.down = false;
        this.setDir(me.attack ? plan.dir : 0);
        break;
      case 'grab': // anda até colar e aperta soco segurando a direção do arremesso
        this.held.down = false;
        if (plan.done) {
          this.setDir(plan.dir * toward);
        } else if (dist > Game.config.fight.grab.range - 5 || !opp.canBeGrabbed()) {
          this.setDir(toward);
        } else {
          this.setDir(plan.dir * toward);
          this.press('punch');
          plan.done = true;
          plan.t = Math.min(plan.t, 0.1);
        }
        break;
      case 'air':
        this.held.down = false;
        // Órbita: segura o pulo para planar até cair perto do adversário
        this.held.jump = !!me.char.float && !me.onGround && me.vy > -40 && dist > 26;
        if (me.char.airAttack === 'dive') {
          // mergulho glacial: sai já descendo, um pouco antes de chegar
          if (!me.onGround && me.vy > -140 && dist < 52 && dist > 10 && !me.attack) this.press('punch');
        } else if (!me.onGround && me.vy > -60 && dist < range + 12 && !me.attack) {
          this.press('punch');
        }
        if (me.onGround && plan.t < 0.55) plan.t = 0;
        break;
      default:
        this.held.down = false;
        this.setDir(0);
    }
    if (plan.type !== 'air') this.held.jump = false;
    if (this.downOnce) {
      // ↓ + especial: o ↓ vale só neste passo
      this.held.down = true;
      this.downOnce = false;
    }
  }
};

/**
 * Boneco do treino na arena: parado, agachado, defendendo tudo, pulando sem
 * parar ou lutando de verdade (CPU normal). O modo muda pelo menu de pausa.
 */
Game.DummyController = class DummyController {
  constructor(mode = 'stand') {
    this.cpu = new Game.CpuController('normal');
    this.cpu.noDomain = true; // no treino o boneco só expande para responder ao seu domínio (embate)
    this.held = {};
    this.presses = {};
    this.t = 0;
    this.setMode(mode);
  }

  setMode(mode) {
    this.mode = mode;
    this.held = {};
    this.presses = {};
    this.cpu.reset();
  }

  axisX() {
    if (this.mode === 'cpu') return this.cpu.axisX();
    return (this.held.right ? 1 : 0) - (this.held.left ? 1 : 0);
  }

  isHeld(action) {
    return this.mode === 'cpu' ? this.cpu.isHeld(action) : !!this.held[action];
  }

  consumePress(action) {
    if (this.mode === 'cpu') return this.cpu.consumePress(action);
    const v = !!this.presses[action];
    this.presses[action] = false;
    return v;
  }

  /** O boneco só aperta botões no embate se estiver lutando de verdade. */
  mash(dt) {
    return this.mode === 'cpu' ? this.cpu.mash(dt) : false;
  }

  reset() {
    this.setMode(this.mode);
  }

  update(dt, me, opp, scene) {
    if (this.mode === 'cpu') {
      this.cpu.update(dt, me, opp, scene);
      return;
    }
    this.held = {};
    if (!opp) return;
    const back = -me.dirTo(opp);
    if (this.mode === 'crouch') this.held.down = true;
    if (this.mode === 'block') {
      // defende tudo, mas só segura para trás quando há perigo (assim não recua até o canto)
      const danger = opp.attack || opp.state === 'super' || opp.state === 'throwing' || scene.entities.some(
        (e) => (e instanceof Game.Projectile || e instanceof Game.Beam) && e.team !== me.team && Math.abs(e.x + e.w / 2 - me.cx) < 400);
      if (danger) this.held[back < 0 ? 'left' : 'right'] = true;
    }
    if (this.mode === 'jump') {
      this.t += dt;
      if (me.onGround && me.canAct() && this.t > 0.7) {
        this.presses.jump = true;
        this.t = 0;
      }
    }
  }
};
