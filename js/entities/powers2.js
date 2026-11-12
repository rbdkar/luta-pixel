/*
 * Poderes da Marionete e do Pavio (mecânicas que ninguém mais no jogo tem):
 *
 *   Marionete  Game.Thread        o Fio voando (projétil fino que sai dos dedos)
 *              Game.PuppetString  o fio preso no adversário: K de novo PUXA ele até ela
 *                                 (Fighter.yank); ↓ + K pelo fio troca os controles dele
 *              Fighter.inverted   CONTROLES TROCADOS: esquerda vira direita (vale para o
 *                                 jogador e para a CPU; até a defesa fica do outro lado)
 *              Game.PuppetShow    ESPETÁCULO (super): uma cruz de marionete desce do alto,
 *                                 os fios pegam o adversário, ele dança e cai
 *   Pavio      Game.Bomb          bomba em arco que quica (← perto, → longe)
 *              Game.TimeBomb      BOMBA-RELÓGIO: gruda no adversário e conta 3, 2, 1; quem
 *                                 está com ela passa para o outro acertando um golpe
 *              Game.PowderBarrel  BARRIL DE PÓLVORA (super): rola pelo chão e explode
 *              Game.Blast         explosão (dano em área)
 *   Golpes de domínio (Game.Strike): puppetDrop/snap (Teatro das Marionetes) e mine/blast
 *   (Pedreira Explosiva)
 */
window.Game = window.Game || {};

// o olho do Corvo também copia estes
Object.assign(Game.COPY_NAMES, {
  thread: 'Fio', tangle: 'Fios trocados', bomb: 'Bomba', timebomb: 'Bomba-relógio',
});

/** Círculo cheio feito de faixas de 1 px (pixel art, sem borda borrada). */
Game.pixelDisc = function (ctx, cx, cy, r, color) {
  if (r <= 0) return;
  ctx.fillStyle = color;
  const R = Math.floor(r);
  const x0 = Math.round(cx);
  const y0 = Math.round(cy);
  for (let dy = -R; dy <= R; dy++) {
    const half = Math.floor(Math.sqrt(Math.max(0, r * r - dy * dy)));
    ctx.fillRect(x0 - half, y0 + dy, half * 2 + 1, 1);
  }
};

/** Linha de 1 px entre dois pontos. */
Game.pixelLine = function (ctx, x0, y0, x1, y1, color, every = 0, alt = null) {
  const n = Math.max(1, Math.round(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    ctx.fillStyle = every && alt && i % every === 0 ? alt : color;
    ctx.fillRect(Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t), 1, 1);
  }
};

// algarismos 3×5 (contagem da bomba-relógio)
Game.DIGITS = ['111101101101111', '010110010010111', '111001111100111', '111001111001111', '101101111001001',
  '111100111001111', '111100111101111', '111001001001001', '111101111101111', '111101111001111'];
Game.drawDigit = function (ctx, d, x, y, color, shadow = '#140a04', scale = 1) {
  const g = Game.DIGITS[d] || Game.DIGITS[0];
  for (const [ox, oy, c] of [[1, 1, shadow], [0, 0, color]]) {
    ctx.fillStyle = c;
    for (let i = 0; i < 15; i++) {
      if (g[i] === '1') ctx.fillRect(Math.round(x) + (i % 3) * scale + ox, Math.round(y) + Math.floor(i / 3) * scale + oy, scale, scale);
    }
  }
};

// ============================================================================ MARIONETE
/** Ponto da mão de quem lança (para o fio sair dos dedos). */
Game.handOf = function (f) {
  return { x: f.cx + f.facing * 10, y: f.feet - 21 };
};

/** O Fio: ponta de agulha voando, puxando a linha desde a mão da Marionete. */
Game.Thread = class Thread extends Game.Entity {
  constructor(owner, x, y) {
    super(x - 3, y - 3, 6, 6);
    this.owner = owner;
    this.team = owner.team;
    this.facing = owner.facing;
    this.startX = x;
    this.vx = owner.facing * Game.config.thread.speed;
    this.sourceX = owner.cx;
    this.t = 0;
    this.layer = 3;
    this.retract = 0;
    this.savePrev();
  }

  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }

  /** A Leitura do Corvo pegou o fio: ele volta. */
  onCountered() {
    this.retract = 0.1;
  }

  update(dt, input, scene) {
    const c = Game.config.thread;
    if (this.retract > 0) {
      this.retract -= dt;
      if (this.retract <= 0) this.dead = true;
      return;
    }
    this.t += dt;
    this.x += this.vx * dt;
    this.sourceX = this.owner.cx;
    const maxX = scene.map.pixelWidth;
    if (Math.abs(this.cx - this.startX) >= c.range || this.cx < 4 || this.cx > maxX - 4 || this.owner.ko) {
      this.retract = 0.12;
      return;
    }
    // projétil do outro lado corta o fio
    for (const e of scene.entities) {
      if (e instanceof Game.Projectile && !e.dead && e.team !== this.team && Game.rectsOverlap(this, e)) {
        this.retract = 0.1;
        scene.effects.burst(this.cx, this.cy, ['#ffffff', '#ffb3c4'], 4, { speed: 60, lift: 40, gravity: 200 });
        return;
      }
    }
    const touched = scene.entities.some((e) => e.onHit && e !== this.owner && e.team !== this.team && !(e.invulnerable && e.invulnerable())
      && Game.rectsOverlap(this, e));
    const ts = scene.map.tileSize;
    const solid = scene.map.anySolid(Math.floor(this.x / ts), Math.floor(this.y / ts),
      Math.floor((this.x + this.w - Game.EPS) / ts), Math.floor((this.y + this.h - Game.EPS) / ts));
    if (!touched && !solid) return;
    const res = scene.punch({ x: this.x, y: this.y, w: this.w, h: this.h }, Object.assign({}, c.hit), this);
    const foe = this.owner.opponent;
    if (res === 'hit' && foe && !foe.ko && this.owner.mode === 'fight' && Game.rectsOverlap(this, foe)) {
      Game.PuppetString.attach(this.owner, foe, scene, c.attachTime);
      this.dead = true;
      return;
    }
    this.retract = 0.12;
  }

  draw(ctx, renderer, alpha = 1) {
    const p = this.lerpPos(alpha);
    const hand = Game.handOf(this.owner);
    let tx = p.x + this.w / 2;
    const ty = p.y + this.h / 2;
    if (this.retract > 0) tx = hand.x + (tx - hand.x) * (this.retract / 0.12);
    Game.pixelLine(ctx, hand.x, hand.y, tx, ty, '#fff0f4', 4, '#ff8aa0');
    Game.pixelLine(ctx, hand.x, hand.y + 1, tx, ty + 1, 'rgba(222, 53, 80, 0.45)');
    if (this.retract > 0) return;
    // ponta: agulha prateada com um laço carmim
    const x = Math.round(tx);
    const y = Math.round(ty);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + (this.facing > 0 ? 1 : -3), y, 3, 1);
    ctx.fillStyle = '#c9c6d2';
    ctx.fillRect(x - 1, y, 2, 1);
    ctx.fillStyle = '#de3550';
    ctx.fillRect(x - 1, y - 1, 1, 1);
    ctx.fillRect(x - 1, y + 1, 1, 1);
  }
};

/**
 * O fio preso: liga a mão da Marionete ao peito do adversário. Some com o tempo, se
 * ficarem longe demais ou se a Marionete apanhar. No Teatro das Marionetes ele não solta.
 */
Game.PuppetString = class PuppetString extends Game.Entity {
  static attach(owner, target, scene, time, quiet = false) {
    for (const e of scene.entities) if (e instanceof Game.PuppetString && e.owner === owner) e.dead = true;
    const s = scene.add(new Game.PuppetString(owner, target, time));
    // o fio pegou: o Puxão já pode sair (a espera do lançamento não vale para ele)
    owner.specialCooldown = Math.min(owner.specialCooldown, 0.08);
    if (!quiet) {
      scene.effects.burst(target.cx, target.y + 8, ['#ffffff', '#ffb3c4', '#de3550'], 8, { speed: 70, lift: 50, gravity: 100 });
      Game.events.emit('stringAttach', { attacker: owner, target });
    }
    return s;
  }

  constructor(owner, target, time) {
    super(0, 0, 1, 1);
    this.owner = owner;
    this.team = owner.team;
    this.target = target;
    this.facing = owner.facing;
    this.life = time;
    this.total = time;
    this.t = 0;
    this.pulse = 0;
    this.layer = 2.7;
    this.sourceX = owner.cx;
  }

  snap(scene) {
    if (this.dead) return;
    this.dead = true;
    const o = this.owner;
    const f = this.target;
    scene.effects.burst((o.cx + f.cx) / 2, (o.feet + f.feet) / 2 - 18, ['#ffffff', '#ffb3c4'], 6, { speed: 70, lift: 40, gravity: 200 });
    Game.events.emit('stringSnap', { owner: o });
  }

  update(dt, input, scene) {
    const c = Game.config.thread;
    const o = this.owner;
    const f = this.target;
    this.t += dt;
    this.pulse = Math.max(0, this.pulse - dt);
    if (!o.inDomain) {
      if (this.life > c.attachTime) this.life = 1.5; // o domínio acabou: o fio vai soltar
      this.life -= dt;
    }
    this.sourceX = o.cx;
    this.facing = o.facing;
    const hurt = ['hurt', 'launched', 'down', 'dizzy', 'iced', 'puppet', 'grabbed'].includes(o.state);
    if (this.life <= 0 || o.ko || f.ko || hurt || Math.abs(o.cx - f.cx) > c.maxDist) this.snap(scene);
  }

  draw(ctx, renderer, alpha = 1) {
    const o = this.owner;
    const f = this.target;
    const po = o.lerpPos(alpha);
    const pf = f.lerpPos(alpha);
    const hand = { x: po.x + o.w / 2 + o.facing * 10, y: po.y + o.h - 21 };
    const chest = { x: pf.x + f.w / 2, y: pf.y + 8 };
    const dist = Math.hypot(chest.x - hand.x, chest.y - hand.y);
    const sag = 4 + dist * 0.06;
    const n = Math.max(6, Math.round(dist / 1.2));
    const blinkOut = this.life < 0.6 && !o.inDomain && Math.floor(this.t * 16) % 2;
    if (blinkOut) return; // perto de soltar: pisca
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = hand.x + (chest.x - hand.x) * t;
      const y = hand.y + (chest.y - hand.y) * t + Math.sin(t * Math.PI) * sag;
      const lit = this.pulse > 0 && Math.abs(t - (1 - this.pulse / 0.25)) < 0.12;
      ctx.fillStyle = lit ? '#ffffff' : i % 5 === 0 ? '#ff8aa0' : '#ffe8ee';
      ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
    // laço no peito do adversário
    ctx.fillStyle = '#de3550';
    ctx.fillRect(Math.round(chest.x) - 1, Math.round(chest.y) - 1, 3, 1);
    ctx.fillRect(Math.round(chest.x), Math.round(chest.y) - 2, 1, 3);
  }
};

/**
 * ESPETÁCULO (super da Marionete): a cruz de controle desce do alto em cima do
 * adversário. Se ele ainda estiver embaixo quando os fios chegarem, vira marionete:
 * dança presa nos fios, leva vários golpes e cai quando ela corta os fios.
 */
Game.PuppetShow = class PuppetShow extends Game.Entity {
  constructor(owner, target) {
    super(0, 0, 1, 1);
    const c = Game.config.puppet;
    this.owner = owner;
    this.team = owner.team;
    this.target = target;
    this.facing = owner.facing;
    this.sourceX = owner.cx;
    this.phase = 'warn';
    this.t = 0;
    this.tick = 0;
    this.ticks = 0;
    this.cxPos = target ? target.cx : owner.cx + owner.facing * 60;
    this.layer = 4;
    this.done = false;
    this.caught = false;
    this.cfg = c;
  }

  update(dt, input, scene) {
    const c = this.cfg;
    const f = this.target;
    this.t += dt;
    this.sourceX = this.owner.cx;
    if (this.phase === 'warn') {
      if (f && this.t < c.track) this.cxPos = f.cx;
      if (this.t >= c.warn) {
        const inside = f && !f.ko && !f.invulnerable() && Math.abs(f.cx - this.cxPos) <= c.width / 2 + f.w / 2;
        if (inside) {
          this.phase = 'dance';
          this.t = 0;
          this.caught = true;
          f.attack = null;
          f.charging = null;
          f.floating = false;
          f.state = 'puppet';
          f.stateTime = 0;
          f.vx = 0;
          f.vy = 0;
          f.setHeight(f.standH);
          this.baseX = f.x;
          this.baseY = Math.min(f.y, (f.groundY !== undefined ? f.groundY : f.feet) - f.h);
          f.play('hurtHeavy', true);
          scene.effects.burst(f.cx, f.y - 2, ['#ffffff', '#ffb3c4', '#de3550'], 12, { speed: 90, lift: 70, gravity: 120 });
          Game.events.emit('puppetCatch', { attacker: this.owner, target: f });
        } else {
          this.phase = 'miss';
          this.t = 0;
          Game.events.emit('stringSnap', { owner: this.owner });
        }
      }
      return;
    }
    if (this.phase === 'dance') {
      if (!f || f.ko || f.state !== 'puppet') {
        this.phase = 'cut';
        this.t = 0;
        return;
      }
      // pendurado: sobe um pouco e é sacudido para os lados no ritmo dos fios
      const maxX = scene.map.pixelWidth;
      const lift = Math.min(10, this.t * 45);
      f.x = Math.max(2, Math.min(maxX - f.w - 2, this.baseX + Math.sin(this.t * 10) * 5));
      f.y = this.baseY - lift + Math.sin(this.t * 19) * 1.5;
      f.onGround = false;
      const poses = ['hurt', 'hurtHeavy', 'dizzy'];
      const pose = poses[Math.floor(this.t * 7) % 3];
      if (f.anim.name !== (f.char.anims[pose] || pose)) f.play(pose, true);
      this.tick -= dt;
      if (this.tick <= 0 && this.ticks < c.ticks) {
        this.tick = c.tickEvery;
        this.ticks += 1;
        scene.punch({ x: f.x, y: f.y, w: f.w, h: f.h },
          { damage: c.tickDamage, knockback: 0, super: true, unblockable: true, puppet: true, stop: 'multi' }, this);
      }
      if (this.t >= c.dance) {
        // corta os fios: cai e leva o último golpe
        this.phase = 'cut';
        this.t = 0;
        f.state = 'hurt';
        f.stateTimer = 0.2;
        scene.punch({ x: f.x - 2, y: f.y, w: f.w + 4, h: f.h },
          { damage: c.finalDamage, knockback: 170, heavy: true, super: true, unblockable: true, launch: true }, this);
        scene.effects.shake(0.25, 3);
        Game.events.emit('puppetCut', { attacker: this.owner, target: f });
      }
      return;
    }
    if (this.t > 0.4) {
      this.done = true;
      this.dead = true;
    }
  }

  draw(ctx) {
    const c = this.cfg;
    const f = this.target;
    const floor = this.owner.groundY !== undefined ? this.owner.groundY : this.owner.feet;
    let crossY;
    const cx = Math.round(this.phase === 'dance' && f ? f.cx : this.cxPos);
    if (this.phase === 'warn') {
      const k = Math.min(1, this.t / c.warn);
      crossY = Math.round(floor - 168 + k * 96);
      // sombra no chão onde os fios vão cair
      const half = Math.round(4 + 8 * k);
      ctx.fillStyle = 'rgba(222, 53, 80, 0.4)';
      ctx.fillRect(cx - half, floor - 1, half * 2 + 1, 2);
    } else if (this.phase === 'dance') {
      crossY = Math.round(f.y - 34 + Math.sin(this.t * 10) * 2);
    } else {
      crossY = Math.round(floor - 72 - this.t * 160);
    }
    const wob = this.phase === 'dance' ? Math.round(Math.sin(this.t * 10) * 2) : 0;
    // cruz de madeira
    ctx.fillStyle = '#3a1a0a';
    ctx.fillRect(cx - 11, crossY - 1, 23, 4);
    ctx.fillRect(cx - 2 + wob, crossY - 8, 5, 18);
    ctx.fillStyle = '#b07a3a';
    ctx.fillRect(cx - 10, crossY, 21, 2);
    ctx.fillRect(cx - 1 + wob, crossY - 7, 3, 16);
    ctx.fillStyle = '#e0a860';
    ctx.fillRect(cx - 10, crossY, 21, 1);
    ctx.fillStyle = '#de3550';
    ctx.fillRect(cx - 1 + wob, crossY, 3, 2);
    // fios até o alvo (ou caindo no chão)
    const endY = this.phase === 'dance' && f ? f.y + 6 : this.phase === 'warn' ? crossY + 10 + (floor - crossY - 10) * Math.min(1, this.t / c.warn) : crossY + 8;
    const ends = this.phase === 'dance' && f ? [[f.cx - 6, f.y + 12], [f.cx + 6, f.y + 12], [f.cx, f.y]] : [[cx - 8, endY], [cx + 8, endY], [cx, endY]];
    const starts = [[cx - 10, crossY + 2], [cx + 10, crossY + 2], [cx + wob, crossY + 9]];
    for (let i = 0; i < 3; i++) {
      Game.pixelLine(ctx, starts[i][0], starts[i][1], ends[i][0], ends[i][1], '#fff0f4', 5, '#ff8aa0');
    }
  }
};

// ============================================================================ PAVIO
/** Explosão: acerta tudo do outro time num raio e solta fogo, fumaça e pedrinhas. */
Game.Blast = class Blast extends Game.Entity {
  /** opts: { team (quem NÃO leva), owner (para quem vai a barra), small, big, event } */
  constructor(owner, x, y, radius, hit, opts = {}) {
    super(x - radius, y - radius, radius * 2, radius * 2);
    this.owner = opts.owner !== undefined ? opts.owner : owner;
    this.team = opts.team !== undefined ? opts.team : owner.team;
    this.facing = owner && owner.facing ? owner.facing : 1;
    this.cxPos = x;
    this.cyPos = y;
    this.r = radius;
    this.hit = hit;
    this.small = !!opts.small;
    this.big = !!opts.big;
    this.event = opts.event || (this.small ? 'boomSmall' : this.big ? 'boomBig' : 'boom');
    this.sourceX = x;
    this.t = 0;
    this.life = this.small ? 0.32 : 0.55;
    this.layer = 3.5;
    this.started = false;
    this.seed = Math.floor(Math.random() * 1e6);
  }

  update(dt, input, scene) {
    if (!this.started) {
      this.started = true;
      if (this.hit) {
        const r = this.r;
        this.result = scene.punch({ x: this.cxPos - r, y: this.cyPos - r, w: r * 2, h: r * 2 }, this.hit, this);
      }
      const n = this.small ? 8 : this.big ? 36 : 22;
      scene.effects.burst(this.cxPos, this.cyPos, ['#ffffff', '#fff1b8', '#ffd166', '#ff9a3c', '#ff5a1f', '#5a4e4e'], n,
        { speed: this.small ? 110 : 190, lift: this.small ? 100 : 180, gravity: 420 });
      scene.effects.burst(this.cxPos, this.cyPos + 4, ['#6a5a4c', '#8a7a6a', '#3a2e26'], this.small ? 3 : 10, { speed: 140, lift: 200, gravity: 600 });
      scene.effects.shake(this.small ? 0.08 : this.big ? 0.4 : 0.22, this.small ? 1 : this.big ? 4 : 3);
      if (!this.small) scene.flashScreen = Math.max(scene.flashScreen || 0, this.big ? 0.14 : 0.07);
      Game.events.emit(this.event, { x: this.cxPos, owner: this.owner });
    }
    this.t += dt;
    if (this.t >= this.life) this.dead = true;
  }

  draw(ctx) {
    const k = this.t / this.life;
    const r = this.r;
    const x = this.cxPos;
    const y = this.cyPos;
    if (k < 0.12) {
      Game.pixelDisc(ctx, x, y, r * (0.5 + k * 4), '#fff1b8');
      Game.pixelDisc(ctx, x, y, r * (0.3 + k * 3), '#ffffff');
      return;
    }
    // bola de fogo encolhendo e virando fumaça que sobe
    const fire = Math.max(0, 1 - (k - 0.12) / 0.5);
    const smokeR = r * (0.35 + k * 0.45);
    let seed = this.seed;
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    for (let i = 0; i < 6; i++) {
      const a = rnd() * Math.PI * 2;
      const d = r * (0.25 + rnd() * 0.5);
      Game.pixelDisc(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d * 0.7 - k * r * 0.8, smokeR * (0.5 + rnd() * 0.5),
        k > 0.6 ? 'rgba(90, 78, 78, ' + (1.4 - k).toFixed(2) + ')' : '#5a4e4e');
    }
    if (fire > 0) {
      Game.pixelDisc(ctx, x, y - k * 4, r * 0.95 * fire, '#ff5a1f');
      Game.pixelDisc(ctx, x, y - k * 5, r * 0.75 * fire, '#ff9a3c');
      Game.pixelDisc(ctx, x, y - k * 6, r * 0.5 * fire, '#ffd166');
      Game.pixelDisc(ctx, x, y - k * 6, r * 0.25 * fire, '#fff1b8');
    }
  }
};

/** Bomba redonda com pavio aceso. */
Game.drawBomb = function (ctx, x, y, t, r = 3, blink = false) {
  x = Math.round(x);
  y = Math.round(y);
  Game.pixelDisc(ctx, x, y, r + 1, '#0c0a0e');
  Game.pixelDisc(ctx, x, y, r, blink ? '#8a2a2a' : '#2a2630');
  ctx.fillStyle = blink ? '#ff6a6a' : '#6a6474';
  ctx.fillRect(x - 1, y - r + 1, 2, 1);
  ctx.fillRect(x - r + 1, y - 1, 1, 2);
  ctx.fillStyle = '#8a8290';
  ctx.fillRect(x, y - r - 1, 2, 1);
  ctx.fillStyle = '#c8a070';
  ctx.fillRect(x + 1, y - r - 2, 1, 1);
  const s = Math.floor(t * 20) % 3;
  ctx.fillStyle = s === 0 ? '#ffffff' : s === 1 ? '#ffd166' : '#ff9a3c';
  ctx.fillRect(x + 2, y - r - 3, 1, 1);
  if (s !== 1) ctx.fillRect(x + 1 + s, y - r - 4, 1, 1);
};

/** Bomba arremessada em arco: quica no chão e explode quando o pavio acaba ou ao encostar no adversário. */
Game.Bomb = class Bomb extends Game.Entity {
  constructor(owner, x, y, vx, vy, opts = {}) {
    super(x - 3, y - 3, 6, 6);
    const c = Game.config.bomb;
    this.owner = owner;
    this.team = owner.team;
    this.facing = owner.facing;
    this.vx = vx;
    this.vy = vy;
    this.mini = !!opts.mini;
    this.fuse = opts.fuse || c.fuse;
    this.t = 0;
    this.bounces = 0;
    this.layer = 3;
    this.sourceX = x;
    this.spark = 0;
    this.savePrev();
  }

  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }

  update(dt, input, scene) {
    const c = Game.config.bomb;
    this.t += dt;
    this.vy = Math.min(this.vy + c.gravity * dt, 500);
    const vy0 = this.vy;
    const vx0 = this.vx;
    this.moveAndCollide(dt, scene.map);
    if (this.onGround && vy0 > 50) {
      this.vy = -vy0 * c.bounce;
      this.vx *= 0.62;
      this.onGround = false;
      this.bounces += 1;
      if (!this.mini) Game.events.emit('bombBounce');
    } else if (this.onGround) {
      this.vx *= Math.max(0, 1 - dt * 6); // rolando até parar
    }
    if (vx0 !== 0 && this.vx === 0 && !this.onGround) this.vx = -vx0 * 0.5; // bateu na parede
    const maxX = scene.map.pixelWidth;
    if (this.x < 1 || this.x + this.w > maxX - 1) {
      this.x = Math.max(1, Math.min(maxX - this.w - 1, this.x));
      this.vx = -this.vx * 0.5;
    }
    this.sourceX = this.cx;
    this.spark -= dt;
    if (this.spark <= 0) {
      this.spark = 0.05;
      scene.effects.burst(this.cx + 2, this.y - 2, ['#fff1b8', '#ffd166', '#ff9a3c'], 1, { speed: 30, lift: 30, gravity: 60 });
    }
    // encostou no adversário (ou num boneco): explode na hora
    for (const e of scene.entities) {
      if (!e.onHit || e === this.owner || e.team === this.team || e instanceof Game.Bomb) continue;
      if (e.invulnerable && e.invulnerable()) continue;
      if (Game.rectsOverlap(this, e)) {
        this.explode(scene);
        return;
      }
    }
    if (this.t >= this.fuse) this.explode(scene);
  }

  explode(scene) {
    if (this.dead) return;
    this.dead = true;
    const c = Game.config.bomb;
    const hit = Object.assign({}, this.mini ? c.miniHit : c.hit);
    scene.add(new Game.Blast(this.owner, this.cx, this.cy - 2, this.mini ? c.miniRadius : c.radius, hit, { small: this.mini }));
    // Pedreira Explosiva: a bomba solta duas bombinhas
    if (!this.mini && this.owner.inDomain && this.owner.charKey === 'pavio') {
      for (const dir of [-1, 1]) scene.add(new Game.Bomb(this.owner, this.cx, this.cy - 4, dir * 85, -210, { mini: true, fuse: 0.42 }));
    }
  }

  draw(ctx, renderer, alpha = 1) {
    const p = this.lerpPos(alpha);
    const left = this.fuse - this.t;
    const blink = left < 0.35 && Math.floor(this.t * 24) % 2 === 0;
    Game.drawBomb(ctx, p.x + this.w / 2, p.y + this.h / 2, this.t, this.mini ? 2 : 3, blink);
  }
};

/**
 * BOMBA-RELÓGIO: gruda em quem está carregando (ou no chão, se o Pavio não alcançou
 * ninguém). Conta 3, 2, 1 em cima da cabeça e explode só em quem está com ela. Quem
 * está com a bomba acerta um golpe no outro: a bomba passa para ele (batata quente).
 */
Game.TimeBomb = class TimeBomb extends Game.Entity {
  constructor(owner, carrier, x, fuse) {
    super(0, 0, 6, 6);
    this.owner = owner;
    this.team = owner.team;
    this.facing = owner.facing;
    this.carrier = carrier;
    this.floorX = x;
    this.left = fuse;
    this.total = fuse;
    this.t = 0;
    this.passes = 0;
    this.lastSec = Math.ceil(fuse);
    this.layer = 2.8;
    this.sourceX = x;
    this.hop = 0;
    this.lock = carrier ? Game.config.timebomb.plantLock : 0; // presa com fita: ainda não passa
  }

  pass(to, scene) {
    if (this.dead || to === this.carrier || this.lock > 0) return;
    const from = this.carrier;
    this.carrier = to;
    this.lock = Game.config.timebomb.passLock;
    this.left = Math.max(this.left, Game.config.timebomb.minPass);
    this.passes += 1;
    this.hop = 0.18;
    scene.effects.burst(to.cx, to.y + 4, ['#fff1b8', '#ffd166', '#ff9a3c'], 6, { speed: 70, lift: 60, gravity: 200 });
    Game.events.emit('timebombPass', { from, to, attacker: from });
  }

  update(dt, input, scene) {
    this.t += dt;
    this.left -= dt;
    this.lock = Math.max(0, this.lock - dt);
    this.hop = Math.max(0, this.hop - dt);
    const sec = Math.ceil(Math.max(0, this.left));
    if (sec !== this.lastSec) {
      this.lastSec = sec;
      if (sec > 0) Game.events.emit('fuseTick');
    }
    const c = this.carrier;
    if (c) {
      this.sourceX = c.cx;
      if (c.ko) {
        // quem carregava caiu nocauteado: a bomba explode sozinha (sem dano)
        this.dead = true;
        scene.add(new Game.Blast(c, c.cx, c.y + 8, 14, null, { small: true, team: c.team }));
        return;
      }
    }
    if (this.left <= 0) {
      // caído ou voando não leva golpe: a bomba espera ele levantar (pisca no zero)
      if (c && c.invulnerable() && !c.ko && (this.waited || 0) < 1.6 && !scene.locked) {
        this.waited = (this.waited || 0) + dt;
        return;
      }
      this.explode(scene);
    }
  }

  explode(scene) {
    if (this.dead) return;
    this.dead = true;
    const cfg = Game.config.timebomb;
    const c = this.carrier;
    if (c) {
      // explode só em quem está com ela; a barra vai para o outro
      const other = c.opponent || null;
      const hit = Object.assign({ timebomb: true }, cfg.hit);
      if (c === this.owner) {
        // de capacete, o próprio Pavio aguenta melhor a bomba dele
        hit.damage = Math.round(hit.damage * cfg.selfScale);
        hit.knockback = Math.round(hit.knockback * 0.8);
      }
      scene.add(new Game.Blast(this.owner, c.cx, c.y + c.h / 2 - 2, cfg.radius, hit,
        { team: 3 - c.team, owner: other || { team: 3 - c.team }, big: true, event: 'boomBig' }));
      Game.events.emit('timebombBoom', { target: c, owner: this.owner });
    } else {
      const floor = this.owner.groundY !== undefined ? this.owner.groundY : this.owner.feet;
      scene.add(new Game.Blast(this.owner, this.floorX, floor - 10, cfg.radius, Object.assign({}, cfg.floorHit), { big: true, event: 'boomBig' }));
    }
  }

  draw(ctx, renderer, alpha = 1) {
    const c = this.carrier;
    const left = Math.max(0, this.left);
    let bx;
    let by;
    if (c) {
      const p = c.lerpPos(alpha);
      bx = p.x + c.w / 2 - c.facing * 3;
      by = p.y + 7 - (this.hop > 0 ? Math.sin((this.hop / 0.18) * Math.PI) * 6 : 0);
    } else {
      const floor = this.owner.groundY !== undefined ? this.owner.groundY : this.owner.feet;
      bx = this.floorX;
      by = floor - 4;
    }
    const fast = left < 1.2;
    const blink = Math.floor(this.t * (fast ? 14 : 5)) % 2 === 0;
    Game.drawBomb(ctx, bx, by, this.t, 3, blink);
    if (this.lock > 0 && c) {
      // fita adesiva em X: grudada, ainda não passa para o outro
      const ox = Math.round(bx);
      const oy = Math.round(by);
      for (let i = -3; i <= 3; i++) {
        ctx.fillStyle = Math.abs(i) === 3 ? '#8f8a7a' : '#d9d2bc';
        ctx.fillRect(ox + i, oy + i, 1, 1);
        ctx.fillRect(ox + i, oy - i, 1, 1);
      }
    }
    // relógio: número grande em cima
    const n = Math.max(1, Math.ceil(left));
    const top = c ? Math.round(c.lerpPos(alpha).y - 17) : Math.round(by - 18);
    const color = n <= 1 ? (blink ? '#ffffff' : '#ff3b3b') : n === 2 ? '#ffd166' : '#ffffff';
    // visor do relógio: caixinha escura com borda vermelha
    const dx = Math.round(bx) - 3;
    ctx.fillStyle = '#140a04';
    ctx.fillRect(dx - 3, top - 2, 13, 15);
    ctx.fillStyle = n <= 1 && blink ? '#ff3b3b' : '#8a1a16';
    ctx.fillRect(dx - 3, top - 2, 13, 1);
    ctx.fillRect(dx - 3, top + 12, 13, 1);
    ctx.fillRect(dx - 3, top - 2, 1, 15);
    ctx.fillRect(dx + 9, top - 2, 1, 15);
    Game.drawDigit(ctx, Math.min(9, n), dx, top, color, '#3a1a0a', 2);
  }
};

/** BARRIL DE PÓLVORA (super do Pavio): visto pela tampa, rolando pelo chão com o pavio aceso. */
Game.PowderBarrel = class PowderBarrel extends Game.Entity {
  constructor(owner) {
    const c = Game.config.barrel;
    super(owner.cx + owner.facing * 14 - 8, owner.feet - 16, 16, 16);
    this.owner = owner;
    this.team = owner.team;
    this.facing = owner.facing;
    this.vx = owner.facing * c.speed;
    this.t = 0;
    this.angle = 0;
    this.layer = 3;
    this.sourceX = this.x + 8;
    this.done = false;
    this.spark = 0;
    this.savePrev();
  }

  get cx() { return this.x + this.w / 2; }

  update(dt, input, scene) {
    const c = Game.config.barrel;
    this.t += dt;
    const accel = Math.min(1, this.t / 0.25); // pega velocidade logo depois do chute
    this.x += this.vx * accel * dt;
    this.angle += (this.vx * accel * dt) / 8;
    const floor = this.owner.groundY !== undefined ? this.owner.groundY : this.owner.feet;
    this.y = floor - this.h - Math.abs(Math.sin(this.t * 9)) * 1.5;
    this.sourceX = this.cx - this.facing * 10;
    this.spark -= dt;
    if (this.spark <= 0) {
      this.spark = 0.04;
      const a = this.angle - Math.PI / 2;
      scene.effects.burst(this.cx + Math.cos(a) * 9, this.y + 8 + Math.sin(a) * 9, ['#ffffff', '#ffd166', '#ff9a3c'], 1, { speed: 40, lift: 40, gravity: 80 });
      if (Math.random() < 0.3) scene.effects.burst(this.cx, floor - 1, ['#c8bfa9', '#a89f8a'], 1, { speed: 30, lift: 20, gravity: 200 });
    }
    const maxX = scene.map.pixelWidth;
    let boom = this.t >= c.life || this.x < 2 || this.x + this.w > maxX - 2;
    for (const e of scene.entities) {
      if (!e.onHit || e === this.owner || e.team === this.team || e instanceof Game.Bomb) continue;
      if (e.invulnerable && e.invulnerable()) continue;
      if (Game.rectsOverlap(this, e)) boom = true;
    }
    if (boom) this.explode(scene);
  }

  explode(scene) {
    if (this.dead) return;
    this.dead = true;
    this.done = true;
    const c = Game.config.barrel;
    scene.add(new Game.Blast(this.owner, this.cx, this.y + 6, c.radius, Object.assign({}, c.hit), { big: true, event: 'boomBig' }));
  }

  draw(ctx, renderer, alpha = 1) {
    const p = this.lerpPos(alpha);
    const cx = p.x + this.w / 2;
    const cy = p.y + this.h / 2;
    Game.pixelDisc(ctx, cx, cy, 8.4, '#1e120a');
    Game.pixelDisc(ctx, cx, cy, 7.4, '#8a5a2a');
    Game.pixelDisc(ctx, cx, cy, 5.2, '#a8743a');
    // tábuas da tampa girando
    for (let i = 0; i < 3; i++) {
      const a = this.angle + i * (Math.PI / 3);
      Game.pixelLine(ctx, cx - Math.cos(a) * 6, cy - Math.sin(a) * 6, cx + Math.cos(a) * 6, cy + Math.sin(a) * 6, '#6a4220');
    }
    // aro de ferro e pavio saindo da borda
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      ctx.fillStyle = i % 6 === 0 ? '#c8ccd6' : '#5a5a62';
      ctx.fillRect(Math.round(cx + Math.cos(a) * 7.6), Math.round(cy + Math.sin(a) * 7.6), 1, 1);
    }
    Game.pixelDisc(ctx, cx, cy, 1.6, '#c8302a');
    const a = this.angle - Math.PI / 2;
    const fx = cx + Math.cos(a) * 9;
    const fy = cy + Math.sin(a) * 9;
    ctx.fillStyle = '#c8a070';
    ctx.fillRect(Math.round(fx), Math.round(fy), 1, 1);
    ctx.fillStyle = Math.floor(this.t * 20) % 2 ? '#ffffff' : '#ffd166';
    ctx.fillRect(Math.round(fx + Math.cos(a)), Math.round(fy + Math.sin(a)), 1, 1);
  }
};

// ============================================================================ supers
Object.assign(Game.Supers, {
  // Espetáculo: conduz os fios enquanto o adversário dança
  show: {
    update(f, dt, scene) {
      const d = f.superData;
      d.t += dt;
      f.vx = 0;
      if (d.phase === 'start') {
        d.phase = 'call';
        d.t = 0;
        f.play('superPose', true);
        d.show = scene.add(new Game.PuppetShow(f, f.opponent));
        Game.events.emit('curtain');
      }
      const s = d.show;
      if (s && s.phase === 'dance' && f.anim.name !== 'conduct') f.play('conduct', true);
      if ((s && s.done) || d.t > 3.6) f.finishSuper(s && s.caught ? 0.08 : 0.35);
    },
  },

  // Barril de Pólvora: acende o pavio e chuta o barril
  barrel: {
    update(f, dt, scene) {
      const d = f.superData;
      d.t += dt;
      f.vx = 0;
      if (d.phase === 'start') {
        d.phase = 'light';
        d.t = 0;
        f.play('superPose', true);
        Game.events.emit('fuseLight');
      }
      if (d.phase === 'light' && d.t >= 0.3) {
        d.phase = 'kick';
        d.t = 0;
        f.play('barrelKick', true);
        d.barrel = scene.add(new Game.PowderBarrel(f));
        scene.effects.burst(f.cx + f.facing * 14, f.feet - 2, ['#c8bfa9', '#a89f8a'], 8, { speed: 80, lift: 40 });
        Game.events.emit('barrelRoll');
      }
      if (d.phase === 'kick' && d.t >= 0.32) f.finishSuper(0.1);
    },
  },
});

// ============================================================================ golpes de domínio
Object.assign(Game.STRIKE_KINDS, {
  // Teatro das Marionetes: a cruz gigante desce, os fios levantam e soltam o adversário · eco: fio estalando
  puppetDrop: { from: 'sky', w: 16, h: 30, linger: 0.32, sound: 'puppetCatch', colors: ['#ffffff', '#ffb3c4', '#de3550', '#5a0c1a'] },
  snap: { from: 'side', w: 12, h: 12, linger: 0.14, sound: 'stringSnap', colors: ['#ffffff', '#ffb3c4', '#de3550', '#5a0c1a'] },
  // Pedreira Explosiva: mina brota do chão e explode · eco: estouro pequeno
  mine: { from: 'ground', w: 20, h: 30, linger: 0.34, sound: 'boom', colors: ['#ffffff', '#ffd166', '#ff7a2f', '#3a3a2a'] },
  blast: { from: 'side', w: 12, h: 12, linger: 0.16, sound: 'boomSmall', colors: ['#ffffff', '#ffd166', '#ff7a2f', '#5a4e4e'] },
});

Game.STRIKE_DRAW = Game.STRIKE_DRAW || {};
Game.STRIKE_WARN = Game.STRIKE_WARN || {};

Game.STRIKE_DRAW.puppetDrop = function (ctx, x, floor, life) {
  // a cruz de controle dá um puxão para cima e solta
  const top = Math.round(this.hitY - 26 - Math.sin(Math.min(1, life * 2) * Math.PI) * 6);
  ctx.save();
  ctx.globalAlpha = life > 0.7 ? 1 - (life - 0.7) / 0.3 : 1;
  ctx.fillStyle = '#3a1a0a';
  ctx.fillRect(x - 10, top - 1, 21, 4);
  ctx.fillRect(x - 2, top - 7, 5, 16);
  ctx.fillStyle = '#b07a3a';
  ctx.fillRect(x - 9, top, 19, 2);
  ctx.fillRect(x - 1, top - 6, 3, 14);
  for (const dx of [-8, 0, 8]) Game.pixelLine(ctx, x + dx, top + 3, x + dx * 0.5, this.hitY + 10, '#fff0f4', 4, '#ff8aa0');
  ctx.restore();
};

Game.STRIKE_WARN.puppetDrop = function (ctx, x, floor, p) {
  // a cruz descendo do alto
  const top = Math.round(floor - 170 + p * 90);
  ctx.fillStyle = '#3a1a0a';
  ctx.fillRect(x - 8, top, 17, 3);
  ctx.fillRect(x - 1, top - 5, 3, 12);
  ctx.fillStyle = '#b07a3a';
  ctx.fillRect(x - 7, top + 1, 15, 1);
};

Game.STRIKE_DRAW.snap = function (ctx, x, floor, life) {
  // fio estalando em X por cima do alvo
  const y = Math.round(this.hitY + 10);
  const s = Math.round(4 + life * 4);
  ctx.save();
  ctx.globalAlpha = 1 - life;
  Game.pixelLine(ctx, x - s, y - s, x + s, y + s, '#ffffff');
  Game.pixelLine(ctx, x - s, y + s, x + s, y - s, '#ff8aa0');
  ctx.restore();
};

Game.STRIKE_DRAW.mine = function (ctx, x, floor, life) {
  // coluna de fogo e fumaça saindo do chão
  const h = Math.round(34 * Math.min(1, this.t / 0.05));
  ctx.save();
  ctx.globalAlpha = life > 0.6 ? 1 - (life - 0.6) / 0.4 : 1;
  for (let i = 0; i < h; i += 2) {
    const k = i / 34;
    const half = Math.round(9 - k * 5 + Math.sin(i * 0.7 + this.t * 30) * 1.5);
    ctx.fillStyle = k < 0.25 ? '#fff1b8' : k < 0.5 ? '#ffd166' : k < 0.75 ? '#ff7a2f' : '#5a4e4e';
    ctx.fillRect(x - half, floor - 1 - i, half * 2 + 1, 2);
  }
  ctx.restore();
};

Game.STRIKE_WARN.mine = function (ctx, x, floor, p, blink) {
  // a mina brota do chão piscando
  const up = Math.round(Math.min(1, p * 2) * 3);
  ctx.fillStyle = '#1e1e16';
  ctx.fillRect(x - 6, floor - up - 1, 13, up + 1);
  ctx.fillStyle = '#5a5e3a';
  ctx.fillRect(x - 5, floor - up, 11, up);
  ctx.fillStyle = blink ? '#ff3b3b' : '#7a1a1a';
  ctx.fillRect(x - 1, floor - up - 2, 3, 2);
};

Game.STRIKE_DRAW.blast = function (ctx, x, floor, life) {
  const y = Math.round(this.hitY + 10);
  const r = 2 + life * 6;
  Game.pixelDisc(ctx, x, y, r, life < 0.5 ? '#ffd166' : '#ff7a2f');
  Game.pixelDisc(ctx, x, y, r * 0.5, life < 0.5 ? '#ffffff' : '#ffd166');
};
