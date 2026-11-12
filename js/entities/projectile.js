/*
 * Projectile: golpes que voam.
 *   energy / energyBig  bola de energia do Encapuzado (a grande derruba e quebra caixas)
 *   book                livro arremessado pelo Óculos (gira no ar)
 * Voa reto e explode no primeiro alvo (lutador, boneco ou bloco). Dois projéteis
 * de lados opostos que se encontram se anulam, como nos jogos de luta clássicos.
 * Para um projétil novo: acrescente um tipo em Game.Projectile.KINDS.
 */
window.Game = window.Game || {};

Game.Projectile = class Projectile extends Game.Entity {
  constructor(x, y, dir, owner, kindName) {
    const kind = Game.Projectile.KINDS[kindName]();
    super(x - kind.w / 2, y - kind.h / 2, kind.w, kind.h);
    this.kind = kind;
    this.kindName = kindName;
    this.owner = owner;
    this.team = owner ? owner.team : 0;
    this.facing = dir;
    this.vx = dir * kind.speed;
    this.life = kind.life;
    this.t = 0;
    this.layer = 3;
    this.trail = 0;
    this.hit = kind.hit;
    this.savePrev();
  }

  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }

  update(dt, input, scene) {
    this.t += dt;
    this.life -= dt;
    this.x += this.vx * dt;

    this.trail -= dt;
    if (this.trail <= 0 && this.kind.trail) {
      this.trail = this.kind.trailEvery;
      scene.effects.burst(this.cx - this.facing * this.w / 2, this.cy, this.kind.trail, 1, { speed: 25, lift: 18, gravity: -20 });
    }

    // Choque com um projétil do outro lado: os dois somem
    for (const e of scene.entities) {
      if (e === this || e.dead || !(e instanceof Game.Projectile) || e.team === this.team) continue;
      if (this.overlaps(e)) {
        e.explode(scene);
        this.explode(scene);
        Game.events.emit('clash');
        return;
      }
    }

    // Encostou em algo? Blocos sólidos ou alguém que possa levar golpe.
    const ts = scene.map.tileSize;
    const solid = scene.map.anySolid(
      Math.floor(this.x / ts), Math.floor(this.y / ts),
      Math.floor((this.x + this.w - Game.EPS) / ts), Math.floor((this.y + this.h - Game.EPS) / ts),
    );
    const someone = scene.entities.some((e) => e.onHit && e !== this && e !== this.owner && this.overlaps(e));
    if (solid || someone) {
      const landed = scene.punch({ x: this.x, y: this.y, w: this.w, h: this.h }, this.hit, this);
      if (landed || solid) return this.explode(scene);
    }
    if (this.life <= 0 || this.cx < -32 || this.cx > scene.map.pixelWidth + 32) this.explode(scene, true);
  }

  overlaps(e) {
    return this.x < e.x + e.w && this.x + this.w > e.x && this.y < e.y + e.h && this.y + this.h > e.y;
  }

  explode(scene, fizzle = false) {
    if (this.dead) return;
    this.dead = true;
    const k = this.kind;
    const n = fizzle ? 6 : k.burst;
    scene.effects.burst(this.cx, this.cy, k.debris, n, { speed: k.big ? 200 : 140, lift: 120, gravity: 300 });
    if (!fizzle) {
      scene.effects.ring(this.cx, this.cy, k.ring);
      if (k.big) scene.effects.shake(0.18, 2);
      Game.events.emit(k.sound, { big: !!k.big });
    }
  }

  draw(ctx, renderer, alpha = 1) {
    const p = this.lerpPos(alpha);
    this.kind.draw(ctx, Math.round(p.x + this.w / 2), Math.round(p.y + this.h / 2), this);
  }
};

/** Orbe em pixel art: anel escuro pulsando, roxo, lilás e miolo branco. */
Game.drawOrb = function (ctx, cx, cy, r, t) {
  const pulse = Math.floor(t * 24) % 2;
  const layers = [
    [r + 1 + pulse, '#4a1b8c'],
    [r, '#8b45f0'],
    [r - 1.5, '#d6a8ff'],
    [Math.max(0.6, r - 3), '#ffffff'],
  ];
  for (const [R, color] of layers) {
    if (R <= 0) continue;
    ctx.fillStyle = color;
    const ri = Math.round(R);
    for (let dy = -ri; dy <= ri; dy++) {
      const half = Math.floor(Math.sqrt(Math.max(0, R * R - dy * dy)) + 0.35);
      ctx.fillRect(cx - half, cy + dy, half * 2 + 1, 1);
    }
  }
};

/** Livro girando: 4 poses (capa, lombada, aberto, lombada). */
Game.drawBook = function (ctx, cx, cy, t, dir) {
  const pose = Math.floor(t * 14) % 4;
  const cover = '#c0392b';
  const dark = '#7d1f16';
  const pages = '#f3efe4';
  ctx.fillStyle = '#1b0f0b';
  if (pose === 0) {
    ctx.fillRect(cx - 4, cy - 3, 8, 6);
    ctx.fillStyle = cover;
    ctx.fillRect(cx - 3, cy - 2, 6, 4);
    ctx.fillStyle = '#e8c15a';
    ctx.fillRect(cx - 1, cy - 1, 2, 1);
  } else if (pose === 2) {
    ctx.fillRect(cx - 5, cy - 2, 10, 4);
    ctx.fillStyle = pages;
    ctx.fillRect(cx - 4, cy - 1, 3, 2);
    ctx.fillRect(cx + 1, cy - 1, 3, 2);
    ctx.fillStyle = dark;
    ctx.fillRect(cx - 1, cy - 1, 2, 2);
  } else {
    const s = pose === 1 ? dir : -dir;
    ctx.fillRect(cx - 2, cy - 4, 4, 8);
    ctx.fillStyle = s > 0 ? cover : pages;
    ctx.fillRect(cx - 1, cy - 3, 1, 6);
    ctx.fillStyle = s > 0 ? pages : cover;
    ctx.fillRect(cx, cy - 3, 1, 6);
  }
};

Game.Projectile.KINDS = {
  energy() {
    const c = Game.config.energyBall;
    const k = c.small;
    return {
      w: k.radius * 2, h: k.radius * 2, speed: c.speed, life: c.life, big: false,
      hit: { damage: k.damage, knockback: k.knockback, heavy: k.heavy, launch: !!k.launch, special: true, breakPower: 1 },
      trail: ['#e2c4ff', '#a46cff', '#6a2fc0'], trailEvery: 0.025,
      debris: ['#ffffff', '#e2c4ff', '#a46cff', '#6a2fc0'], ring: '#e2c4ff', burst: 14, sound: 'explode',
      draw: (ctx, x, y, p) => Game.drawOrb(ctx, x, y, k.radius, p.t),
    };
  },
  energyBig() {
    const c = Game.config.energyBall;
    const k = c.big;
    return {
      w: k.radius * 2, h: k.radius * 2, speed: c.speed, life: c.life, big: true,
      hit: { damage: k.damage, knockback: k.knockback, heavy: k.heavy, launch: !!k.launch, special: true, breakPower: k.breakPower || 1 },
      trail: ['#e2c4ff', '#a46cff', '#6a2fc0'], trailEvery: 0.015,
      debris: ['#ffffff', '#e2c4ff', '#a46cff', '#6a2fc0'], ring: '#e2c4ff', burst: 26, sound: 'explode',
      draw: (ctx, x, y, p) => Game.drawOrb(ctx, x, y, k.radius, p.t),
    };
  },
  book() {
    const c = Game.config.book;
    return {
      w: c.size.w, h: c.size.h, speed: c.speed, life: c.life, big: false,
      hit: Object.assign({ breakPower: 1 }, c.hit),
      trail: null, trailEvery: 1,
      debris: ['#f3efe4', '#c0392b', '#e8c15a', '#7d1f16'], ring: '#f3efe4', burst: 12, sound: 'bookHit',
      draw: (ctx, x, y, p) => Game.drawBook(ctx, x, y, p.t, p.facing),
    };
  },
  // Livros do super do Óculos: mais rápidos, com rastro dourado
  superBook() {
    const c = Game.config.book;
    return {
      w: c.size.w, h: c.size.h, speed: 250, life: 1.6, big: false,
      hit: { damage: 6, knockback: 110, heavy: true, special: true, super: true, stop: 'multi', breakPower: 1 },
      trail: ['#fff3b0', '#ffd166', '#e8c15a'], trailEvery: 0.02,
      debris: ['#f3efe4', '#c0392b', '#ffd166', '#7d1f16'], ring: '#ffd166', burst: 10, sound: 'bookHit',
      draw: (ctx, x, y, p) => Game.drawBook(ctx, x, y, p.t, p.facing),
    };
  },
};
