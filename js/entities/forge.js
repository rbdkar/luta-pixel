/*
 * Golpes do Soldador (o Óculos serralheiro):
 *
 *   Game.TorchFlame  a chama do maçarico: sai do bico, acerta várias vezes de perto
 *                    e queima projéteis; no domínio vai mais longe e solda os pés
 *   Game.IronGate    portão de ferro que despenca, derruba quem estiver embaixo e
 *                    fica de pé como barreira (o adversário não atravessa, projéteis
 *                    batem nele; dá para passar pulando)
 *   Game.IronCage    Jaula de Ferro (super): cai em cima do adversário, é soldada
 *                    com ele dentro e explode
 *   Strike 'sparks'  eco do domínio: faíscas de solda em cima de quem apanhou
 *   Strike 'gateClose' acerto garantido do domínio: as duas folhas de um portão se
 *                    fecham sobre o adversário e a emenda é soldada
 */
window.Game = window.Game || {};

Game.IRON = { out: '#07080a', dark: '#22262c', mid: '#3a4048', light: '#66707c', shine: '#9aa4ae', rust: '#7a4a2a' };

/** Desenha uma folha de portão de ferro trabalhado (barras com lanças, arabescos). */
Game.drawGateLeaf = function (ctx, x, top, w, h, alpha = 1, glow = 0) {
  const I = Game.IRON;
  x = Math.round(x);
  top = Math.round(top);
  ctx.save();
  ctx.globalAlpha = alpha;
  // moldura
  ctx.fillStyle = I.out;
  ctx.fillRect(x - 1, top + 2, w + 2, h - 1);
  ctx.fillStyle = I.mid;
  ctx.fillRect(x, top + 3, 2, h - 3);                 // poste da esquerda
  ctx.fillRect(x + w - 2, top + 3, 2, h - 3);         // poste da direita
  ctx.fillRect(x, top + 4, w, 2);                     // travessa de cima
  ctx.fillRect(x, top + Math.round(h * 0.55), w, 2);  // travessa do meio
  ctx.fillRect(x, top + h - 3, w, 2);                 // travessa de baixo
  ctx.fillStyle = I.light;
  ctx.fillRect(x, top + 3, 1, h - 3);
  ctx.fillRect(x, top + 4, w, 1);
  // barras com ponta de lança
  for (let bx = x + 3; bx < x + w - 2; bx += 3) {
    ctx.fillStyle = I.dark;
    ctx.fillRect(bx, top + 3, 1, h - 4);
    ctx.fillStyle = I.shine;
    ctx.fillRect(bx, top + 1, 1, 2);
    ctx.fillStyle = I.light;
    ctx.fillRect(bx - 1, top + 2, 3, 1);
  }
  ctx.fillStyle = I.shine;
  ctx.fillRect(x, top, 1, 3);
  ctx.fillRect(x + w - 1, top, 1, 3);
  // arabesco no meio
  const sy = top + Math.round(h * 0.3);
  ctx.fillStyle = I.light;
  ctx.fillRect(x + 2, sy, 3, 1);
  ctx.fillRect(x + 2, sy + 3, 3, 1);
  ctx.fillRect(x + 1, sy + 1, 1, 2);
  ctx.fillRect(x + w - 5, sy + 1, 3, 1);
  ctx.fillRect(x + w - 2, sy + 2, 1, 2);
  // ferrugem
  ctx.fillStyle = I.rust;
  ctx.fillRect(x + 1, top + h - 5, 1, 2);
  ctx.fillRect(x + w - 3, top + Math.round(h * 0.55) + 2, 1, 1);
  // solda ainda quente nas emendas
  if (glow > 0) {
    ctx.globalAlpha = alpha * Math.min(1, glow);
    ctx.fillStyle = '#ffb347';
    ctx.fillRect(x, top + 4, 2, 2);
    ctx.fillRect(x + w - 2, top + Math.round(h * 0.55), 2, 2);
    ctx.fillStyle = '#fff1b8';
    ctx.fillRect(x + 1, top + 4, 1, 1);
  }
  ctx.restore();
};

/** Chuva de faíscas de solda (efeito). */
Game.sparkBurst = function (scene, x, y, n = 8, speed = 140) {
  scene.effects.burst(x, y, ['#ffffff', '#fff1b8', '#ffd166', '#ff9a3c'], n, { speed, lift: 90, gravity: 520 });
};

// ---------------------------------------------------------------------------- maçarico
Game.TorchFlame = class TorchFlame extends Game.Entity {
  constructor(owner, attack) {
    super(0, 0, 4, 10);
    this.owner = owner;
    this.team = owner.team;
    this.attackRef = attack;
    this.facing = owner.facing;
    this.t = 0;
    this.tick = 0.02;
    this.hits = 0;
    this.layer = 3;
    this.len = owner.inDomain ? Game.config.torch.domainRange : Game.config.torch.range;
    this.place();
    this.savePrev();
  }

  /** Bico do maçarico (quadro 50 da folha): 20 px à frente e 14 acima dos pés (ou "nozzle" da animação: Corvo). */
  place() {
    const o = this.owner;
    const nz = (this.attackRef && this.attackRef.def.nozzle) || { x: 21, y: -14 };
    this.facing = o.facing;
    this.nx = o.cx + o.facing * nz.x;
    this.ny = o.feet + nz.y;
    this.sourceX = o.cx;
  }

  rect() {
    const x0 = this.facing > 0 ? this.nx : this.nx - this.len;
    return { x: x0, y: this.ny - 6, w: this.len, h: 12 };
  }

  update(dt, input, scene) {
    const o = this.owner;
    // a chama apaga se ele for interrompido ou terminar o golpe
    if (o.attack !== this.attackRef || o.ko || o.state === 'hurt' || o.hidden) {
      this.dead = true;
      return;
    }
    this.t += dt;
    this.place();
    const r = this.rect();
    this.x = r.x;
    this.y = r.y;
    this.w = r.w;
    this.h = r.h;
    // queima projéteis do adversário
    for (const e of scene.entities) {
      if (e instanceof Game.Projectile && !e.dead && e.team !== this.team
          && e.x < r.x + r.w && e.x + e.w > r.x && e.y < r.y + r.h && e.y + e.h > r.y) e.explode(scene);
    }
    this.tick -= dt;
    if (this.tick <= 0 && this.hits < 4) {
      this.tick = 0.08;
      this.hits += 1;
      const last = this.hits === 4;
      const hit = last
        ? { damage: 4, knockback: 110, heavy: true, special: true }
        : { damage: 2, knockback: 18, special: true, stop: 'multi' };
      if (last && o.inDomain) hit.root = Game.config.torch.root;
      const res = scene.punch(r, hit, this);
      if (res) Game.sparkBurst(scene, this.facing > 0 ? r.x + r.w - 4 : r.x + 4, this.ny, 4, 110);
    }
    if (Math.random() < 0.8) {
      scene.effects.burst(this.nx + this.facing * Math.random() * this.len, this.ny + (Math.random() - 0.5) * 6,
        ['#fff1b8', '#ffd166', '#ff9a3c'], 1, { speed: 60, lift: 40, gravity: 300, dirX: this.facing });
    }
  }

  draw(ctx) {
    const f = this.facing;
    const flick = Math.floor(this.t * 40) % 2;
    const len = this.len * Math.min(1, this.t / 0.05);
    for (let i = 0; i < len; i++) {
      const k = i / this.len;
      const x = Math.round(this.nx + f * i);
      // cone: estreito no bico, abre no meio, afina na ponta
      const half = Math.max(0, Math.round((k < 0.25 ? 1 + k * 10 : 3.5 - (k - 0.25) * 3.2) + (flick && i % 3 === 0 ? 1 : 0)));
      const y = Math.round(this.ny);
      const outer = k < 0.2 ? '#8fd3ff' : k < 0.5 ? '#ffd166' : k < 0.8 ? '#ff9a3c' : '#ff5a1f';
      ctx.fillStyle = outer;
      ctx.fillRect(x, y - half, 1, half * 2 + 1);
      if (half > 1) {
        // núcleo azul-branco do oxiacetileno
        ctx.fillStyle = k < 0.3 ? '#ffffff' : k < 0.6 ? '#e8f6ff' : '#fff1b8';
        ctx.fillRect(x, y - Math.max(0, half - 2), 1, Math.max(1, (half - 2) * 2 + 1));
      }
    }
    // brilho no bico
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(Math.round(this.nx) - 1, Math.round(this.ny) - 1, 2, 2);
  }
};

// ---------------------------------------------------------------------------- portão
Game.IronGate = class IronGate extends Game.Entity {
  /** opts: { life, drop (altura da queda), delay } */
  constructor(owner, x, opts = {}) {
    const c = Game.config.gate;
    super(Math.round(x - c.width / 2), 0, c.width, c.height);
    this.owner = owner;
    this.team = owner.team;
    this.facing = owner.facing;
    this.sourceX = owner.cx;
    this.floor = owner.groundY !== undefined ? owner.groundY : owner.feet;
    this.y = this.floor - c.height;
    this.life = opts.life || c.life;
    this.delay = opts.delay || 0;
    this.t = -this.delay;
    this.fallTime = 0.12;
    this.solid = false;
    this.layer = 2.6;
    this.glow = 1;
    this.savePrev();
  }

  get cx() {
    return this.x + this.w / 2;
  }

  update(dt, input, scene) {
    this.t += dt;
    if (this.t < 0) return;
    if (!this.landed && this.t >= this.fallTime) {
      this.landed = true;
      this.solid = true;
      // despencou: derruba quem estiver embaixo
      const c = Game.config.gate;
      scene.punch({ x: this.x - 1, y: this.y, w: this.w + 2, h: this.h }, Object.assign({}, c.hit), this);
      scene.effects.shake(0.12, 2);
      Game.sparkBurst(scene, this.cx, this.floor - 2, 12, 150);
      scene.effects.burst(this.cx, this.floor - 1, ['#8a8f96', '#5d6268', '#c9c3b8'], 8, { speed: 90, lift: 30, gravity: 400 });
      Game.events.emit('gateSlam', { gate: this });
    }
    if (this.solid) {
      this.glow = Math.max(0, this.glow - dt * 0.8);
      // projéteis do adversário batem no portão
      for (const e of scene.entities) {
        if (e instanceof Game.Projectile && !e.dead && e.team !== this.team
            && e.x < this.x + this.w && e.x + e.w > this.x && e.y < this.y + this.h && e.y + e.h > this.y) {
          e.explode(scene);
          Game.sparkBurst(scene, this.cx, e.y + e.h / 2, 5, 100);
        }
      }
    }
    if (this.t >= this.fallTime + this.life) {
      this.solid = false;
      if (this.t >= this.fallTime + this.life + 0.25) {
        this.dead = true;
        Game.sparkBurst(scene, this.cx, this.floor - this.h / 2, 6, 80);
      }
    }
  }

  /** Empurra o adversário para fora (chamado pela cena depois do movimento). */
  block(f, maxX) {
    if (!this.solid || f.team === this.team) return false;
    const overlap = Math.min(f.x + f.w, this.x + this.w) - Math.max(f.x, this.x);
    if (overlap <= 0) return false;
    if (f.y + f.h <= this.y + 2) return false; // passando por cima no pulo
    const side = f.cx < this.cx ? -1 : 1;
    f.x = side < 0 ? this.x - f.w : this.x + this.w;
    f.x = Math.max(0, Math.min(maxX - f.w, f.x));
    if (f.vx * side < 0) f.vx = 0;
    return true;
  }

  draw(ctx) {
    if (this.t < 0) {
      // sombra no chão antes de cair
      ctx.fillStyle = 'rgba(10, 12, 18, 0.4)';
      ctx.fillRect(Math.round(this.x), Math.round(this.floor) - 1, this.w, 2);
      return;
    }
    const k = Math.min(1, this.t / this.fallTime);
    const top = this.y - (1 - k) * 70;
    const end = this.fallTime + this.life;
    const alpha = this.t > end ? Math.max(0, 1 - (this.t - end) / 0.25) : 1;
    Game.drawGateLeaf(ctx, this.x, top, this.w, this.h, alpha, this.glow);
  }
};

// ---------------------------------------------------------------------------- jaula (super)
Game.IronCage = class IronCage extends Game.Entity {
  constructor(owner, target) {
    super(0, 0, 30, 40);
    this.owner = owner;
    this.team = owner.team;
    this.target = target;
    this.facing = owner.facing;
    this.sourceX = owner.cx;
    this.floor = owner.groundY !== undefined ? owner.groundY : owner.feet;
    this.phase = 'drop';
    this.t = 0;
    this.ticks = 0;
    this.layer = 3;
    this.cx0 = target ? target.cx : owner.cx + owner.facing * 60;
    this.place();
    this.savePrev();
  }

  place() {
    this.x = Math.round(this.cx0 - this.w / 2);
    this.y = this.floor - this.h;
  }

  update(dt, input, scene) {
    this.t += dt;
    const tg = this.target;
    if (this.phase === 'drop') {
      if (tg && tg.onGround) this.cx0 = tg.cx; // segue até cair
      this.place();
      if (this.t >= 0.16) {
        this.phase = 'check';
        scene.effects.shake(0.18, 3);
        Game.sparkBurst(scene, this.cx0, this.floor - 2, 14, 160);
        Game.events.emit('gateSlam', { gate: this });
        const res = scene.punch({ x: this.x + 4, y: this.y, w: this.w - 8, h: this.h }, { damage: 4, knockback: 0, special: true, super: true, stop: 'multi' }, this);
        if (res === 'hit') {
          this.phase = 'weld';
          this.t = 0;
        } else {
          this.phase = 'break';
          this.t = 0;
        }
      }
      return;
    }
    if (this.phase === 'weld') {
      if (tg) {
        tg.vx = 0;
        tg.x = Math.max(this.x + 3, Math.min(this.x + this.w - 3 - tg.w, tg.x)); // preso dentro
      }
      if (this.t >= 0.1) {
        this.t = 0;
        this.ticks += 1;
        // soldando as grades: faíscas nas emendas
        const sx = this.ticks % 2 ? this.x + 2 : this.x + this.w - 2;
        const sy = this.y + 6 + (this.ticks * 7) % 28;
        Game.sparkBurst(scene, sx, sy, 7, 150);
        scene.flashScreen = Math.max(scene.flashScreen || 0, 0.04);
        Game.events.emit('weld');
        scene.punch({ x: this.x + 4, y: this.y, w: this.w - 8, h: this.h }, { damage: 3, knockback: 0, special: true, super: true, stop: 'multi' }, this);
        if (this.ticks >= 5) {
          this.phase = 'boom';
          this.t = 0;
        }
      }
      return;
    }
    if (this.phase === 'boom' && this.t >= 0.12 && !this.boomed) {
      this.boomed = true;
      scene.effects.shake(0.3, 4);
      scene.flashScreen = Math.max(scene.flashScreen || 0, 0.12);
      Game.sparkBurst(scene, this.cx0, this.y + this.h / 2, 24, 220);
      scene.effects.burst(this.cx0, this.y + this.h / 2, ['#3a4048', '#66707c', '#9aa4ae'], 14, { speed: 200, lift: 160, gravity: 600 });
      Game.events.emit('cageBoom');
      scene.punch({ x: this.x, y: this.y - 4, w: this.w, h: this.h + 4 }, { damage: 12, knockback: 200, heavy: true, launch: true, special: true, super: true }, this);
      this.phase = 'gone';
      this.t = 0;
      return;
    }
    if ((this.phase === 'break' && this.t >= 0.35) || (this.phase === 'gone' && this.t >= 0.05)) this.dead = true;
  }

  get done() {
    return this.dead || this.phase === 'gone' || this.phase === 'break';
  }

  draw(ctx) {
    const drop = this.phase === 'drop' ? Math.min(1, this.t / 0.16) : 1;
    const top = this.y - (1 - drop) * 90;
    const alpha = this.phase === 'break' ? Math.max(0, 1 - this.t / 0.35) : 1;
    const glow = this.phase === 'weld' || this.phase === 'boom' ? 1 : 0;
    Game.drawGateLeaf(ctx, this.x, top, 7, this.h, alpha, glow);
    Game.drawGateLeaf(ctx, this.x + this.w - 7, top, 7, this.h, alpha, glow);
    // grades da frente e o teto (dá para ver quem está preso)
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = Game.IRON.out;
    ctx.fillRect(Math.round(this.x), Math.round(top) + 2, this.w, 3);
    ctx.fillStyle = Game.IRON.light;
    ctx.fillRect(Math.round(this.x), Math.round(top) + 3, this.w, 1);
    ctx.globalAlpha = alpha * 0.85;
    for (let bx = this.x + 9; bx < this.x + this.w - 8; bx += 4) {
      ctx.fillStyle = Game.IRON.dark;
      ctx.fillRect(Math.round(bx), Math.round(top) + 5, 1, this.h - 6);
    }
    if (glow && Math.floor(this.t * 30) % 2) {
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#e8f6ff';
      ctx.fillRect(Math.round(this.ticks % 2 ? this.x + 1 : this.x + this.w - 3), Math.round(top) + 6 + (this.ticks * 7) % 28, 2, 2);
    }
    ctx.restore();
  }
};

// ---------------------------------------------------------------------------- golpes do domínio
Object.assign(Game.STRIKE_KINDS, {
  sparks: { from: 'side', w: 16, h: 16, linger: 0.18, sound: 'weld', colors: ['#ffffff', '#fff1b8', '#ffb347', '#ff6a1f'] },
  gateClose: { from: 'side', w: 30, h: 40, linger: 0.5, sound: 'gateSlam', colors: ['#ffffff', '#e8f6ff', '#ffb347', '#66707c'] },
});

Game.STRIKE_DRAW = Game.STRIKE_DRAW || {};

Game.STRIKE_DRAW.sparks = function (ctx, x, floor, life) {
  const cy = Math.round(this.hitY + 10);
  let seed = this.seed;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const reach = 3 + life * 10;
  for (let i = 0; i < 10; i++) {
    const a = rnd() * Math.PI * 2;
    const r = reach * (0.5 + rnd() * 0.5);
    ctx.fillStyle = i % 3 === 0 ? '#ffffff' : i % 3 === 1 ? '#ffd166' : '#ff9a3c';
    ctx.fillRect(Math.round(x + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), 1, 1);
  }
  if (life < 0.4) {
    ctx.fillStyle = '#e8f6ff';
    ctx.fillRect(x - 1, cy - 1, 3, 3);
  }
};

Game.STRIKE_DRAW.gateClose = function (ctx, x, floor, life) {
  // as duas folhas chegam pelos lados e batem no meio; a emenda é soldada
  const close = Math.min(1, this.t / 0.08);
  const gap = Math.round((1 - close) * 26);
  const h = 38;
  const top = floor - h;
  const alpha = life > 0.75 ? 1 - (life - 0.75) / 0.25 : 1;
  Game.drawGateLeaf(ctx, x - 14 - gap, top, 14, h, alpha, 1);
  Game.drawGateLeaf(ctx, x + gap, top, 14, h, alpha, 1);
  if (close >= 1 && life < 0.7) {
    ctx.save();
    ctx.globalAlpha = alpha;
    const sy = top + 4 + Math.floor(this.t * 120) % (h - 6);
    ctx.fillStyle = '#ffb347';
    ctx.fillRect(x - 1, top + 4, 2, Math.max(0, sy - top - 4));
    ctx.fillStyle = '#e8f6ff';
    ctx.fillRect(x - 2, sy - 1, 4, 3);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - 1, sy, 2, 1);
    ctx.restore();
  }
};