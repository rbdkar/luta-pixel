/*
 * Poderes dos lutadores novos (coisas que ninguém mais no jogo faz):
 *
 *   Corvo      Kunai Rubra (projétil) · Revoada (super): bando de corvos que atravessa a tela
 *              O olho copia especiais (Fighter.learnCopy) e a Leitura contra-ataca (Fighter.counterHit)
 *   Ampulheta  Game.TimeOrb / Game.TimeBubble: bolha onde o tempo do adversário anda devagar
 *              Game.RewindTrail: rastro do Rebobinar · Parada do Tempo (super, scene.timeStop)
 *   Órbita     Game.BlackHole: puxa o adversário e engole projéteis
 *              Strike 'antigrav': o adversário flutua sem controle (Fighter.startFloat)
 *              Game.StarShot + Game.Supernova (super)
 *   Golpes de domínio (Game.Strike): crow/peck (Lua Rubra), clockHand/tick (Deserto do
 *   Tempo), meteor/pebble (Horizonte de Eventos)
 *
 * A câmera lenta funciona pela escala de tempo de cada entidade (Scene.timeScaleFor):
 * dentro da bolha, quem é do outro time recebe só uma fração do tempo de cada passo.
 */
window.Game = window.Game || {};

// Nomes dos especiais que o olho do Corvo sabe copiar
Game.COPY_NAMES = {
  energyBall: 'Bola de energia', dash: 'Investida', book: 'Livro voador', rise: 'Chama ascendente',
  iceSpike: 'Pico de gelo', torch: 'Maçarico', teleport: 'Passo relâmpago', bolt: 'Raio celeste',
  gate: 'Portão de ferro', kunai: 'Kunai rubra', bubble: 'Bolha do tempo', rewind: 'Rebobinar',
  blackhole: 'Buraco negro', antigrav: 'Antigravidade',
};

/** Penas pretas (e uma ou outra vermelha) voando. */
Game.featherBurst = function (scene, x, y, n = 10) {
  scene.effects.burst(x, y, ['#14121a', '#22202a', '#33303c', '#14121a', '#e0303a'], n, { speed: 110, lift: 90, gravity: 120 });
};

/** Retângulos se encostam? */
Game.rectsOverlap = function (a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
};

/** Desenha um quadro do sprite pintado de uma cor (fantasmas, rastros). */
Game.drawTintedFrame = function (ctx, sheet, color, frame, x, y, flip, alpha = 1) {
  const tint = sheet.tinted(color);
  const fw = sheet.def.frameWidth;
  const fh = sheet.def.frameHeight;
  const sx = (frame % sheet.columns) * fw;
  const sy = Math.floor(frame / sheet.columns) * fh;
  ctx.save();
  ctx.globalAlpha = alpha;
  if (flip) {
    ctx.translate(Math.round(x) + fw, Math.round(y));
    ctx.scale(-1, 1);
    ctx.drawImage(tint, sx, sy, fw, fh, 0, 0, fw, fh);
  } else {
    ctx.drawImage(tint, sx, sy, fw, fh, Math.round(x), Math.round(y), fw, fh);
  }
  ctx.restore();
};

// ============================================================================ CORVO
/** Kunai: lâmina cinza, cabo escuro e uma fita vermelha tremulando atrás. */
Game.drawKunai = function (ctx, cx, cy, dir, t) {
  const px = (dx, dy, c) => {
    ctx.fillStyle = c;
    ctx.fillRect(cx + dx * dir - (dir < 0 ? 1 : 0), cy + dy, 1, 1);
  };
  px(4, 0, '#ffffff');
  for (let i = 1; i <= 3; i++) px(i, 0, '#c9c6d2');
  px(1, -1, '#8e8a96');
  px(1, 1, '#8e8a96');
  px(0, 0, '#2a2731');
  px(-1, 0, '#2a2731');
  px(-2, 0, '#8e8a96');
  const wave = Math.floor(t * 20) % 2;
  px(-3, wave ? -1 : 0, '#e0303a');
  px(-4, wave ? 0 : 1, '#a3212b');
  px(-5, wave ? -1 : 0, '#e0303a');
};

Game.Projectile.KINDS.kunai = function () {
  const c = Game.config.kunai;
  return {
    w: 9, h: 3, speed: c.speed, life: c.life, big: false,
    hit: Object.assign({ breakPower: 1 }, c.hit),
    trail: ['#e0303a', '#a3212b'], trailEvery: 0.035,
    debris: ['#c9c6d2', '#e0303a', '#6a1820', '#ffffff'], ring: '#ff9a9a', burst: 8, sound: 'kunaiHit',
    draw: (ctx, x, y, p) => Game.drawKunai(ctx, x, y, p.facing, p.t),
  };
};

/** Corvo em pixel art (10×7), batendo as asas. big: o último da Revoada, maior. */
Game.CROW_FRAMES = [
  ['..kk......', '...KK.....', '...KKK.Kk.', 'KKKKKKKKRg', '.KKKKKKK..', '..........', '..........'],
  ['..........', '..........', '.......Kk.', 'KKKKKKKKRg', '.KKKKKKK..', '...KKK....', '....KK....'],
];
Game.drawCrow = function (ctx, x, y, dir, t, big = false) {
  const frame = Game.CROW_FRAMES[Math.floor(t * 12) % 2];
  const colors = { K: '#14121a', k: '#3a3445', R: '#ff3030', g: '#8e8a96' };
  const s = typeof big === 'number' ? big : big ? 2 : 1;
  const ox = Math.round(x) - 5 * s;
  const oy = Math.round(y) - 3 * s;
  for (let r = 0; r < frame.length; r++) {
    const row = frame[r];
    for (let c = 0; c < row.length; c++) {
      const col = colors[row[c]];
      if (!col) continue;
      const cc = dir > 0 ? c : row.length - 1 - c;
      ctx.fillStyle = col;
      ctx.fillRect(ox + cc * s, oy + r * s, s, s);
    }
  }
};

/** Revoada (super do Corvo): corvos saem de trás dele e atravessam a tela em cima do adversário. */
Game.CrowFlock = class CrowFlock extends Game.Entity {
  constructor(owner) {
    super(0, 0, 1, 1);
    this.owner = owner;
    this.team = owner.team;
    this.facing = owner.facing;
    this.sourceX = owner.cx;
    this.t = 0;
    this.spawned = 0;
    this.total = 12;
    this.crows = [];
    this.layer = 3.5;
  }

  update(dt, input, scene) {
    this.t += dt;
    const o = this.owner;
    const foe = o.opponent;
    const heights = [-30, -18, -36, -24, -12, -33, -20, -27, -15, -35, -22, -24];
    while (this.spawned < this.total && this.t >= this.spawned * 0.055) {
      const i = this.spawned++;
      const y = o.feet + heights[i % heights.length];
      this.crows.push({ x: o.cx - this.facing * 8, y, vx: this.facing * (240 + Math.random() * 50), t: Math.random(), big: i === this.total - 1, dead: false });
      if (i % 3 === 0) Game.events.emit('crow');
    }
    const mapW = scene.map.pixelWidth;
    for (const c of this.crows) {
      if (c.dead) continue;
      c.t += dt;
      c.x += c.vx * dt;
      if (foe) {
        // voam na altura do corpo do adversário
        const ty = foe.y + foe.h * 0.45;
        c.y += (ty - c.y) * Math.min(1, dt * 2.4);
      }
      c.y += Math.sin(c.t * 16) * 0.35;
      const r = { x: c.x - 5, y: c.y - 4, w: 10, h: 8 };
      if (foe && !foe.ko && Game.rectsOverlap(r, foe)) {
        c.dead = true;
        this.sourceX = c.x - this.facing * 10;
        const hit = c.big
          ? { damage: 10, knockback: 210, heavy: true, launch: true, special: true, super: true }
          : { damage: 2, knockback: 10, special: true, super: true, stop: 'multi' };
        scene.punch(r, hit, this);
        Game.featherBurst(scene, c.x, c.y, c.big ? 16 : 5);
      }
      if (c.x < -30 || c.x > mapW + 30) c.dead = true;
    }
    if ((this.spawned >= this.total && this.crows.every((c) => c.dead)) || this.t > 3) this.dead = true;
  }

  get done() {
    return this.dead;
  }

  draw(ctx) {
    for (const c of this.crows) if (!c.dead) Game.drawCrow(ctx, c.x, c.y, this.facing, c.t, c.big);
  }
};

// ============================================================================ AMPULHETA
/** Mostrador de relógio em pixels: anel, marcas das horas e dois ponteiros. */
Game.drawClockFace = function (ctx, cx, cy, r, t, colors, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  const [ring, mark, hand] = colors;
  const steps = Math.max(24, Math.round(r * 6));
  ctx.fillStyle = ring;
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    ctx.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), 1, 1);
  }
  ctx.fillStyle = mark;
  for (let h = 0; h < 12; h++) {
    const a = (h / 12) * Math.PI * 2;
    const len = h % 3 === 0 ? 3 : 1;
    for (let k = 0; k < len; k++) ctx.fillRect(Math.round(cx + Math.cos(a) * (r - 2 - k)), Math.round(cy + Math.sin(a) * (r - 2 - k)), 1, 1);
  }
  ctx.fillStyle = hand;
  const line = (ang, len) => {
    for (let k = 0; k < len; k++) ctx.fillRect(Math.round(cx + Math.cos(ang) * k), Math.round(cy + Math.sin(ang) * k), 1, 1);
  };
  line(t * 1.2 - Math.PI / 2, r * 0.75);
  line(t * 0.1 - Math.PI / 2, r * 0.5);
  ctx.fillRect(Math.round(cx) - 1, Math.round(cy) - 1, 3, 3);
  ctx.restore();
};

/** A ampulheta de areia voando (vira a bolha ao encostar ou depois de um tempo). */
Game.TimeOrb = class TimeOrb extends Game.Entity {
  constructor(owner, x, y) {
    super(x - 3, y - 4, 7, 8);
    this.owner = owner;
    this.team = owner.team;
    this.facing = owner.facing;
    this.sourceX = owner.cx;
    this.vx = owner.facing * Game.config.bubble.speed;
    this.t = 0;
    this.layer = 3;
    this.savePrev();
  }

  get cx() { return this.x + this.w / 2; }

  pop(scene, open = false) {
    if (this.dead) return;
    this.dead = true;
    if (open) scene.add(new Game.TimeBubble(this.owner, this.cx));
  }

  update(dt, input, scene) {
    const c = Game.config.bubble;
    this.t += dt;
    this.x += this.vx * dt;
    this.sourceX = this.cx - this.facing * 8;
    let open = this.t >= c.travel || this.cx < 8 || this.cx > scene.map.pixelWidth - 8;
    // projétil do outro lado: a bolha abre ali mesmo (e prende o projétil em câmera lenta)
    for (const e of scene.entities) {
      if (e instanceof Game.Projectile && !e.dead && e.team !== this.team && Game.rectsOverlap(this, e)) open = true;
    }
    const foe = this.owner.opponent;
    if (foe && !foe.invulnerable() && Game.rectsOverlap(this, foe)) {
      scene.punch({ x: this.x, y: this.y, w: this.w, h: this.h }, Object.assign({}, c.hit), this);
      open = true;
    }
    if (Math.random() < 0.5) scene.effects.burst(this.cx, this.y + 4, ['#ffe9a8', '#f2c14e'], 1, { speed: 20, lift: 10, gravity: 60 });
    if (open) {
      this.pop(scene, true);
      Game.events.emit('timeBubble', { owner: this.owner });
    }
  }

  draw(ctx, renderer, alpha = 1) {
    const p = this.lerpPos(alpha);
    const x = Math.round(p.x);
    const y = Math.round(p.y);
    const spin = Math.floor(this.t * 12) % 4;
    // moldura dourada e vidro com areia; gira de lado (4 poses)
    ctx.fillStyle = '#3a2410';
    ctx.fillRect(x, y, 7, 1);
    ctx.fillRect(x, y + 7, 7, 1);
    ctx.fillStyle = '#f2c14e';
    ctx.fillRect(x, y, 7, 1);
    ctx.fillRect(x, y + 7, 7, 1);
    const w = spin === 1 || spin === 3 ? 3 : 5;
    const ox = x + Math.floor((7 - w) / 2);
    ctx.fillStyle = '#bff8ff';
    ctx.fillRect(ox, y + 1, w, 2);
    ctx.fillRect(ox + Math.floor(w / 2), y + 3, 1, 2);
    ctx.fillRect(ox, y + 5, w, 2);
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(ox + 1, y + 5, Math.max(1, w - 2), 2);
    ctx.fillRect(ox + Math.floor(w / 2), y + 3, 1, 1);
  }
};

/** Bolha do Tempo: domo turquesa com um relógio; quem é do outro time anda devagar lá dentro. */
Game.TimeBubble = class TimeBubble extends Game.Entity {
  constructor(owner, x) {
    const c = Game.config.bubble;
    const dom = owner.inDomain && owner.char.special === 'bubble';
    const r = dom ? c.domainRadius : c.radius;
    super(x - r, 0, r * 2, r * 2);
    this.owner = owner;
    this.team = owner.team;
    this.r = r;
    this.cxPos = x;
    this.life = dom ? c.domainLife : c.life;
    this.scale = c.scale;
    this.hitsLeft = dom ? c.domainHits : c.hits; // golpes da dona lá dentro até a bolha estourar
    this.t = 0;
    this.layer = 0.5;
    this.grains = [];
  }

  /** A dona acertou quem está lá dentro: o tempo começa a voltar ao normal. */
  struck(scene) {
    this.hitsLeft -= 1;
    if (this.hitsLeft <= 0) this.pop(scene);
  }

  get cy() {
    const floor = this.owner.groundY !== undefined ? this.owner.groundY : this.owner.feet;
    return floor - 18;
  }

  /** O centro do corpo de "e" está dentro da bolha? */
  contains(e) {
    const ex = e.x + e.w / 2;
    const ey = e.y + e.h / 2;
    const dx = ex - this.cxPos;
    const dy = (ey - this.cy) * 1.15;
    return dx * dx + dy * dy <= this.r * this.r;
  }

  pop(scene) {
    if (this.dead) return;
    this.dead = true;
    for (let i = 0; i < 18; i++) {
      const a = Math.random() * Math.PI * 2;
      scene.effects.burst(this.cxPos + Math.cos(a) * this.r, this.cy + Math.sin(a) * this.r * 0.85,
        ['#ffffff', '#9ffff0', '#3fe0c5', '#f2c14e'], 1, { speed: 40, lift: 20, gravity: 120 });
    }
  }

  update(dt, input, scene) {
    this.t += dt;
    this.y = this.cy - this.r;
    this.x = this.cxPos - this.r;
    // areia flutuando lá dentro, bem devagar
    if (Math.random() < dt * 14 && this.grains.length < 30) {
      const a = Math.random() * Math.PI * 2;
      const d = Math.random() * this.r * 0.85;
      this.grains.push({ x: this.cxPos + Math.cos(a) * d, y: this.cy + Math.sin(a) * d * 0.85, vx: (Math.random() - 0.5) * 6, vy: -2 - Math.random() * 4, t: 0 });
    }
    for (const g of this.grains) {
      g.t += dt;
      g.x += g.vx * dt;
      g.y += g.vy * dt;
    }
    this.grains = this.grains.filter((g) => g.t < 1.6);
    if (this.t >= this.life || this.owner.ko) this.pop(scene);
  }

  draw(ctx) {
    const grow = Math.min(1, this.t / 0.15);
    const fade = this.life - this.t < 0.3 ? Math.floor(this.t * 20) % 2 : 1;
    const r = Math.max(2, this.r * (0.3 + 0.7 * grow));
    const cx = Math.round(this.cxPos);
    const cy = Math.round(this.cy);
    ctx.save();
    // miolo translúcido em faixas horizontais (pixel art, sem serrilhado borrado)
    ctx.fillStyle = 'rgba(80, 240, 215, 0.13)';
    for (let dy = -Math.floor(r); dy <= r; dy += 1) {
      const half = Math.floor(Math.sqrt(Math.max(0, r * r - (dy * 1.15) * (dy * 1.15))));
      if (half > 0) ctx.fillRect(cx - half, cy + dy, half * 2 + 1, 1);
    }
    if (fade) {
      Game.drawClockFace(ctx, cx, cy, r * 0.62, this.t * 0.35, ['rgba(159, 255, 240, 0.35)', 'rgba(255, 241, 184, 0.7)', 'rgba(255, 255, 255, 0.55)']);
      // borda
      const steps = Math.round(r * 7);
      for (let i = 0; i < steps; i++) {
        const a = (i / steps) * Math.PI * 2;
        ctx.fillStyle = i % 5 === 0 ? '#ffffff' : '#7ff5e3';
        ctx.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r / 1.15), 1, 1);
      }
    }
    for (const g of this.grains) {
      ctx.fillStyle = g.t % 0.4 < 0.2 ? '#ffe9a8' : '#f2c14e';
      ctx.fillRect(Math.round(g.x), Math.round(g.y), 1, 1);
    }
    ctx.restore();
  }
};

/** Rebobinar: fantasmas turquesa refazendo o caminho de volta. */
Game.RewindTrail = class RewindTrail extends Game.Entity {
  constructor(f, path) {
    super(0, 0, 1, 1);
    this.f = f;
    this.path = path;
    this.t = 0;
    this.life = 0.5;
    this.layer = 0.9;
  }

  update(dt) {
    this.t += dt;
    if (this.t >= this.life) this.dead = true;
  }

  draw(ctx) {
    const f = this.f;
    const def = f.sheet.def;
    const n = this.path.length;
    const k = this.t / this.life;
    for (let i = n - 1; i >= 0; i -= 4) {
      const e = this.path[i];
      const age = (n - 1 - i) / Math.max(1, n - 1); // 0 = onde estava agora, 1 = para onde voltou
      if (age > k * 1.4) continue;
      const alpha = 0.45 * (1 - k) * (0.4 + 0.6 * age);
      Game.drawTintedFrame(ctx, f.sheet, '#7ff5e3', e.frame, e.cx - def.anchor.x, e.feet - def.anchor.y, e.facing < 0, alpha);
    }
  }
};

/** Parada do Tempo: o mundo fica cinza (menos a dona do tempo) e um relógio gigante aparece. */
Game.TimeFx = {
  draw(ctx, view, scene, renderer, alpha) {
    const ts = scene.timeStop;
    if (!ts) return;
    const k = Math.min(1, ts.t / 0.12);
    ctx.save();
    ctx.globalCompositeOperation = 'saturation';
    ctx.fillStyle = 'rgba(128, 128, 128, ' + (0.92 * k).toFixed(3) + ')';
    ctx.fillRect(view.x - 4, view.y - 4, view.w + 8, view.h + 8);
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = 'rgba(214, 196, 160, ' + (0.6 * k).toFixed(3) + ')';
    ctx.fillRect(view.x - 4, view.y - 4, view.w + 8, view.h + 8);
    ctx.restore();
    const cx = view.x + view.w / 2;
    const cy = view.y + view.h * 0.42;
    Game.drawClockFace(ctx, cx, cy, view.h * 0.36, ts.t * 2.6, ['#fff1b8', '#ffffff', '#3fe0c5'], 0.28 * k);
    // a dona do tempo continua colorida, por cima do cinza
    const o = ts.owner;
    if (!o.hidden) {
      const def = o.sheet.def;
      const p = o.lerpPos(alpha);
      const x = renderer.snap(p.x + o.w / 2 - def.anchor.x);
      const y = renderer.snap(p.y + o.h - def.anchor.y);
      o.sheet.draw(ctx, o.anim.frame, x, y, o.facing < 0, o.flash > 0);
    }
    // golpes guardados: números subindo em cima do adversário
    const foe = o.opponent;
    if (foe && ts.debt > 0) {
      const blink = Math.floor(ts.t * 10) % 2;
      Game.drawPixelNumber(ctx, Math.round(foe.cx), Math.round(foe.y - 10), ts.debt, blink ? '#ffffff' : '#ffd166');
    }
  },
};

/** Números em pixel (3×5) para o dano guardado da Parada do Tempo. */
Game.DIGITS = ['111101101101111', '010110010010111', '111001111100111', '111001111001111', '101101111001001',
  '111100111001111', '111100111101111', '111001001001001', '111101111101111', '111101111001111'];
Game.drawPixelNumber = function (ctx, cx, y, n, color) {
  const s = String(n);
  const w = s.length * 4 - 1;
  let x = cx - Math.floor(w / 2);
  for (const ch of s) {
    const g = Game.DIGITS[+ch];
    for (let i = 0; i < 15; i++) {
      if (g[i] !== '1') continue;
      const gx = x + (i % 3);
      const gy = y + Math.floor(i / 3);
      ctx.fillStyle = '#1a1206';
      ctx.fillRect(gx + 1, gy + 1, 1, 1);
      ctx.fillStyle = color;
      ctx.fillRect(gx, gy, 1, 1);
    }
    x += 4;
  }
};

// ============================================================================ ÓRBITA
/** Buraco Negro: puxa o adversário para o miolo e engole projéteis. Some implodindo. */
Game.BlackHole = class BlackHole extends Game.Entity {
  constructor(owner, x) {
    const c = Game.config.blackhole;
    const dom = owner.inDomain && owner.char.special === 'blackhole';
    const core = dom ? 9 : 6;
    super(x - core, 0, core * 2, core * 2);
    this.owner = owner;
    this.team = owner.team;
    this.cxPos = x;
    this.core = core;
    this.radius = dom ? c.domainRadius : c.radius;
    this.life = dom ? c.domainLife : c.life;
    this.facing = owner.facing;
    this.sourceX = x;
    this.t = 0;
    this.tick = 0.15;
    this.layer = 0.8; // atrás dos lutadores: dá para ver quem está sendo puxado
    this.motes = [];
  }

  get cy() {
    const floor = this.owner.groundY !== undefined ? this.owner.groundY : this.owner.feet;
    return floor - 16;
  }

  coreRect(extra = 0) {
    const r = this.core + extra;
    return { x: this.cxPos - r, y: this.cy - r - 6, w: r * 2, h: r * 2 + 12 };
  }

  collapse(scene, final = true) {
    if (this.dead) return;
    this.dead = true;
    if (final) {
      this.sourceX = this.cxPos;
      scene.punch(this.coreRect(8), Object.assign({}, Game.config.blackhole.finalHit), this);
    }
    scene.effects.ring(this.cxPos, this.cy, '#ffb3ee', 16);
    scene.effects.burst(this.cxPos, this.cy, ['#ffffff', '#ffb3ee', '#ff5fd2', '#6a1a8e'], final ? 18 : 8, { speed: 140, lift: 60, gravity: 0 });
    if (final) Game.events.emit('holeCollapse', { owner: this.owner });
  }

  update(dt, input, scene) {
    const c = Game.config.blackhole;
    this.t += dt;
    this.x = this.cxPos - this.core;
    this.y = this.cy - this.core;
    const grow = Math.min(1, this.t / 0.2);
    const maxX = scene.map.pixelWidth;
    // puxa quem é do outro time
    for (const f of scene.fighters) {
      if (f.team === this.team || f.ko || f.state === 'down' || f.state === 'getup' || f.state === 'grabbed') continue;
      const dx = this.cxPos - f.cx;
      const dist = Math.abs(dx);
      if (dist > this.radius || dist < 0.5) continue;
      const pull = (c.pull + c.pullCore * (1 - dist / this.radius)) * grow;
      f.x = Math.max(0, Math.min(maxX - f.w, f.x + Math.sign(dx) * Math.min(dist, pull * dt)));
    }
    // projéteis do outro lado são sugados e somem no miolo
    for (const e of scene.entities) {
      if (!(e instanceof Game.Projectile) || e.dead || e.team === this.team) continue;
      const dx = this.cxPos - e.cx;
      const dy = this.cy - e.cy;
      const dist = Math.hypot(dx, dy);
      if (dist > this.radius * 0.8) continue;
      e.x += (dx / Math.max(1, dist)) * 120 * dt;
      e.y += (dy / Math.max(1, dist)) * 120 * dt;
      if (dist < this.core + 4) {
        e.dead = true;
        scene.effects.burst(this.cxPos, this.cy, ['#ffffff', '#ffb3ee'], 6, { speed: 60, lift: 0, gravity: 0 });
      }
    }
    // no miolo: dano em pulsos (prende quem caiu lá dentro)
    this.tick -= dt;
    if (this.tick <= 0) {
      this.tick = c.tickEvery;
      const foe = this.owner.opponent;
      if (foe && Game.rectsOverlap(this.coreRect(3), foe)) scene.punch(this.coreRect(3), Object.assign({}, c.tickHit), this);
    }
    // poeira em espiral entrando
    if (Math.random() < 0.6) {
      const a = Math.random() * Math.PI * 2;
      this.motes.push({ a, d: this.core + 10 + Math.random() * 16, t: 0 });
    }
    for (const m of this.motes) {
      m.t += dt;
      m.a += dt * 6;
      m.d -= dt * 26;
    }
    this.motes = this.motes.filter((m) => m.d > this.core);
    if (this.t >= this.life || this.owner.ko) this.collapse(scene, !this.owner.ko);
  }

  draw(ctx) {
    const cx = Math.round(this.cxPos);
    const cy = Math.round(this.cy);
    const grow = Math.min(1, this.t / 0.2);
    const r = Math.max(1, Math.round(this.core * grow));
    const spin = this.t * 5;
    // disco de acreção (elipse rosa girando) atrás
    for (let i = 0; i < 26; i++) {
      const a = spin + (i / 26) * Math.PI * 2;
      const back = Math.sin(a) < 0;
      if (!back) continue;
      ctx.fillStyle = i % 3 === 0 ? '#ffffff' : '#ff5fd2';
      ctx.fillRect(Math.round(cx + Math.cos(a) * (r + 6)), Math.round(cy + Math.sin(a) * 2.2), 2, 1);
    }
    // miolo preto com anel de luz
    for (let dy = -r - 1; dy <= r + 1; dy++) {
      const half = Math.floor(Math.sqrt(Math.max(0, (r + 1) * (r + 1) - dy * dy)));
      ctx.fillStyle = '#ffb3ee';
      ctx.fillRect(cx - half, cy + dy, half * 2 + 1, 1);
    }
    for (let dy = -r; dy <= r; dy++) {
      const half = Math.floor(Math.sqrt(Math.max(0, r * r - dy * dy)));
      ctx.fillStyle = '#05020a';
      ctx.fillRect(cx - half, cy + dy, half * 2 + 1, 1);
    }
    for (let i = 0; i < 26; i++) {
      const a = spin + (i / 26) * Math.PI * 2;
      if (Math.sin(a) < 0) continue;
      ctx.fillStyle = i % 3 === 0 ? '#ffffff' : '#ff9ae6';
      ctx.fillRect(Math.round(cx + Math.cos(a) * (r + 6)), Math.round(cy + Math.sin(a) * 2.2), 2, 1);
    }
    for (const m of this.motes) {
      ctx.fillStyle = m.d < this.core + 6 ? '#ffffff' : '#ff9ae6';
      ctx.fillRect(Math.round(cx + Math.cos(m.a) * m.d), Math.round(cy + Math.sin(m.a) * m.d * 0.55), 1, 1);
    }
    // alcance da puxada: pontinhos no chão
    if (this.t < this.life - 0.2) {
      const floor = cy + 16;
      ctx.fillStyle = 'rgba(255, 95, 210, 0.45)';
      const step = 6;
      const off = Math.floor(this.t * 30) % step;
      for (let d = this.radius - off; d > this.core + 4; d -= step) {
        ctx.fillRect(cx - Math.round(d), floor - 1, 1, 1);
        ctx.fillRect(cx + Math.round(d), floor - 1, 1, 1);
      }
    }
  }
};

/** Estrela arremessada no super do Órbita: ao encostar vira a Supernova. */
Game.StarShot = class StarShot extends Game.Entity {
  constructor(owner) {
    super(owner.cx + owner.facing * 12 - 5, owner.feet - 26, 10, 10);
    this.owner = owner;
    this.team = owner.team;
    this.facing = owner.facing;
    this.sourceX = owner.cx;
    this.vx = owner.facing * 175;
    this.t = 0;
    this.layer = 3.6;
    this.nova = null;
    this.savePrev();
  }

  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }

  update(dt, input, scene) {
    this.t += dt;
    this.x += this.vx * dt;
    const foe = this.owner.opponent;
    const touch = foe && !foe.ko && Game.rectsOverlap(this, foe);
    const edge = this.cx < 6 || this.cx > scene.map.pixelWidth - 6 || this.t > 1.7;
    if (Math.random() < 0.8) scene.effects.burst(this.cx - this.facing * 4, this.cy, ['#ffffff', '#fff3b0', '#ff9ae6'], 1, { speed: 30, lift: 10, gravity: 0 });
    if (touch || edge) {
      this.dead = true;
      this.nova = scene.add(new Game.Supernova(this.owner, this.cx, this.cy, touch ? foe : null));
    }
  }

  draw(ctx, renderer, alpha = 1) {
    const p = this.lerpPos(alpha);
    const cx = Math.round(p.x + this.w / 2);
    const cy = Math.round(p.y + this.h / 2);
    const pulse = Math.floor(this.t * 20) % 2;
    ctx.fillStyle = 'rgba(255, 95, 210, 0.35)';
    ctx.fillRect(cx - 6, cy - 2, 13, 5);
    ctx.fillRect(cx - 2, cy - 6, 5, 13);
    ctx.fillStyle = '#ff9ae6';
    ctx.fillRect(cx - 5 - pulse, cy, 11 + pulse * 2, 1);
    ctx.fillRect(cx, cy - 5 - pulse, 1, 11 + pulse * 2);
    ctx.fillStyle = '#fff3b0';
    ctx.fillRect(cx - 2, cy - 2, 5, 5);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cx - 1, cy - 1, 3, 3);
  }
};

/** Supernova: prende o adversário num buraco negro que gira, acerta várias vezes e explode. */
Game.Supernova = class Supernova extends Game.Entity {
  constructor(owner, x, y, target) {
    super(x - 14, y - 14, 28, 28);
    this.owner = owner;
    this.team = owner.team;
    this.facing = owner.facing;
    this.sourceX = owner.cx;
    this.cxPos = x;
    this.cyPos = y;
    this.target = target;
    this.t = 0;
    this.ticks = 0;
    this.phase = target ? 'hold' : 'boom';
    this.boomT = 0;
    this.layer = 3.6;
    Game.events.emit(target ? 'novaHold' : 'supernova', { owner });
  }

  get done() {
    return this.dead;
  }

  update(dt, input, scene) {
    this.t += dt;
    const tg = this.target;
    if (this.phase === 'hold') {
      if (tg && !tg.ko) {
        // puxa o alvo para o centro
        tg.x += (this.cxPos - tg.cx) * Math.min(1, dt * 10);
        tg.vx = 0;
      }
      if (this.t >= (this.ticks + 1) * 0.1) {
        this.ticks += 1;
        this.sourceX = this.owner.cx;
        scene.punch({ x: this.cxPos - 14, y: this.cyPos - 18, w: 28, h: 36 }, { damage: 3, knockback: 0, special: true, super: true, stop: 'multi' }, this);
      }
      if (this.ticks >= 6) {
        this.phase = 'boom';
        this.boomT = 0;
        Game.events.emit('supernova', { owner: this.owner });
      }
      return;
    }
    if (this.phase === 'boom') {
      if (this.boomT === 0) {
        this.sourceX = this.cxPos - this.facing * 20;
        scene.punch({ x: this.cxPos - 22, y: this.cyPos - 24, w: 44, h: 46 }, { damage: 14, knockback: 240, heavy: true, launch: true, special: true, super: true }, this);
        scene.flashScreen = Math.max(scene.flashScreen || 0, 0.25);
        scene.effects.shake(0.3, 3);
        scene.effects.ring(this.cxPos, this.cyPos, '#ffffff', 34);
        scene.effects.ring(this.cxPos, this.cyPos, '#ff5fd2', 26);
        scene.effects.burst(this.cxPos, this.cyPos, ['#ffffff', '#fff3b0', '#ffb3ee', '#ff5fd2', '#7a3cff'], 40, { speed: 220, lift: 80, gravity: 60 });
      }
      this.boomT += dt;
      if (this.boomT > 0.45) this.dead = true;
    }
  }

  draw(ctx) {
    const cx = Math.round(this.cxPos);
    const cy = Math.round(this.cyPos);
    if (this.phase === 'hold') {
      const r = 6 + Math.min(1, this.t / 0.1) * 4;
      const spin = this.t * 9;
      for (let i = 0; i < 40; i++) {
        const a = spin + (i / 40) * Math.PI * 2;
        const rr = r + 4 + (i % 4);
        ctx.fillStyle = i % 4 === 0 ? '#ffffff' : i % 4 === 1 ? '#ffb3ee' : '#ff5fd2';
        ctx.fillRect(Math.round(cx + Math.cos(a) * rr), Math.round(cy + Math.sin(a) * rr * 0.7), 1, 1);
      }
      for (let dy = -Math.round(r); dy <= r; dy++) {
        const half = Math.floor(Math.sqrt(Math.max(0, r * r - dy * dy)));
        ctx.fillStyle = 'rgba(8, 2, 16, 0.75)';
        ctx.fillRect(cx - half, cy + dy, half * 2 + 1, 1);
      }
      return;
    }
    // onda de choque crescendo
    const k = Math.min(1, this.boomT / 0.45);
    const r = 6 + k * 40;
    ctx.save();
    ctx.globalAlpha = 1 - k;
    for (let dy = -Math.round(r); dy <= r; dy++) {
      const half = Math.floor(Math.sqrt(Math.max(0, r * r - dy * dy)));
      ctx.fillStyle = k < 0.3 ? '#ffffff' : '#ffb3ee';
      ctx.fillRect(cx - half, cy + dy, half * 2 + 1, 1);
    }
    ctx.restore();
  }
};

// ============================================================================ golpes de domínio e Antigravidade
Object.assign(Game.STRIKE_KINDS, {
  // Lua Rubra (Corvo): um corvo gigante mergulha do céu · eco: bicada
  crow: { from: 'sky', w: 16, h: 18, linger: 0.2, sound: 'crowDive', colors: ['#ffffff', '#ff9a9a', '#e0303a', '#14121a'] },
  peck: { from: 'side', w: 12, h: 10, linger: 0.14, sound: 'crow', colors: ['#ffffff', '#ff9a9a', '#e0303a', '#14121a'] },
  // Deserto do Tempo (Ampulheta): o ponteiro gigante desce · eco: tique
  clockHand: { from: 'sky', w: 10, h: 40, linger: 0.3, sound: 'clockHit', colors: ['#ffffff', '#fff1b8', '#f2c14e', '#3fe0c5'] },
  tick: { from: 'side', w: 12, h: 12, linger: 0.14, sound: 'tick', colors: ['#ffffff', '#9ffff0', '#3fe0c5', '#1c7f72'] },
  // Antigravidade (Órbita): coluna rosa que levanta o adversário do chão
  antigrav: { from: 'ground', w: 18, h: 44, linger: 0.32, sound: 'antigrav', colors: ['#ffffff', '#ffb3ee', '#ff5fd2', '#6a1a8e'] },
  // Horizonte de Eventos (Órbita): meteoro caindo · eco: pedrinha de asteroide
  meteor: { from: 'sky', w: 14, h: 16, linger: 0.26, sound: 'meteor', colors: ['#ffffff', '#ffd166', '#ff7a2f', '#5a3a2a'] },
  pebble: { from: 'side', w: 10, h: 10, linger: 0.12, sound: 'pebble', colors: ['#ffffff', '#c9b8a8', '#8a7060', '#4a3a30'] },
});

Game.STRIKE_DRAW = Game.STRIKE_DRAW || {};

Game.STRIKE_DRAW.crow = function (ctx, x, floor, life) {
  // corvo enorme mergulhando na diagonal, asas abertas e olhos vermelhos
  const k = Math.min(1, this.t / 0.07);
  const y = Math.round(this.hitY + 8 - (1 - k) * 40);
  const cx = Math.round(x - (1 - k) * 30 * this.facing);
  ctx.save();
  ctx.globalAlpha = life > 0.7 ? 1 - (life - 0.7) / 0.3 : 1;
  Game.drawCrow(ctx, cx, y, this.facing, 0, 3);
  ctx.restore();
};

Game.STRIKE_DRAW.peck = function (ctx, x, floor, life) {
  const y = Math.round(this.hitY + 10);
  const dx = Math.round((1 - life) * 10) * -this.facing;
  Game.drawCrow(ctx, x + dx, y, this.facing, this.t, false);
};

Game.STRIKE_DRAW.clockHand = function (ctx, x, floor, life) {
  // ponteiro dourado gigante descendo em pé, com a ponta em losango
  const drop = Math.min(1, this.t / 0.07);
  const bottom = Math.round(floor - 2);
  const top = Math.round(bottom - 46 * drop);
  ctx.save();
  ctx.globalAlpha = life > 0.7 ? 1 - (life - 0.7) / 0.3 : 1;
  ctx.fillStyle = '#3a2410';
  ctx.fillRect(x - 2, top, 5, bottom - top);
  ctx.fillStyle = '#f2c14e';
  ctx.fillRect(x - 1, top, 3, bottom - top);
  ctx.fillStyle = '#fff1b8';
  ctx.fillRect(x - 1, top, 1, bottom - top);
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = '#f2c14e';
    ctx.fillRect(x - i, bottom - 6 + i, i * 2 + 1, 1);
  }
  ctx.fillStyle = '#3fe0c5';
  ctx.fillRect(x - 3, top + 6, 7, 3);
  ctx.restore();
  if (life < 0.4) Game.drawClockFace(ctx, x, bottom - 18, 10, this.t * 6, ['#9ffff0', '#ffffff', '#f2c14e'], 1 - life * 2);
};

Game.STRIKE_DRAW.tick = function (ctx, x, floor, life) {
  const cy = Math.round(this.hitY + 10);
  Game.drawClockFace(ctx, x, cy, 5 + life * 3, this.t * 8, ['#9ffff0', '#ffffff', '#f2c14e'], 1 - life);
};

Game.STRIKE_DRAW.antigrav = function (ctx, x, floor, life) {
  // coluna rosa subindo, com anéis
  const h = Math.round(this.k.h * Math.min(1, this.t / 0.08));
  ctx.save();
  ctx.globalAlpha = life > 0.6 ? 1 - (life - 0.6) / 0.4 : 1;
  ctx.fillStyle = 'rgba(255, 95, 210, 0.35)';
  ctx.fillRect(x - 8, floor - h, 17, h);
  ctx.fillStyle = 'rgba(255, 179, 238, 0.55)';
  ctx.fillRect(x - 5, floor - h, 11, h);
  for (let i = 0; i < 4; i++) {
    const y = floor - ((this.t * 90 + i * 11) % Math.max(1, h));
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - 7, Math.round(y), 15, 1);
  }
  ctx.restore();
};

Game.STRIKE_DRAW.meteor = function (ctx, x, floor, life) {
  // pedra em brasa caindo na diagonal com rastro
  const k = Math.min(1, this.t / 0.06);
  const ty = Math.round(this.hitY + 8);
  const mx = Math.round(x - (1 - k) * 30 * -this.facing);
  const my = Math.round(ty - (1 - k) * 60);
  ctx.save();
  ctx.globalAlpha = life > 0.6 ? 1 - (life - 0.6) / 0.4 : 1;
  for (let i = 1; i < 8; i++) {
    ctx.fillStyle = i < 3 ? '#fff1b8' : i < 5 ? '#ffd166' : '#ff7a2f';
    ctx.fillRect(mx + Math.round(i * 1.2 * this.facing * -1) - 1, my - i * 2, 3, 2);
  }
  ctx.fillStyle = '#3a2a20';
  ctx.fillRect(mx - 4, my - 3, 8, 7);
  ctx.fillStyle = '#8a7060';
  ctx.fillRect(mx - 3, my - 2, 6, 5);
  ctx.fillStyle = '#ffd166';
  ctx.fillRect(mx - 3, my + 2, 6, 1);
  ctx.restore();
};

Game.STRIKE_DRAW.pebble = function (ctx, x, floor, life) {
  const y = Math.round(this.hitY + 10);
  const dx = Math.round((1 - life) * 8) * -this.facing;
  ctx.fillStyle = '#3a2a20';
  ctx.fillRect(x + dx - 2, y - 2, 5, 4);
  ctx.fillStyle = '#c9b8a8';
  ctx.fillRect(x + dx - 1, y - 1, 3, 2);
};
