/*
 * Poderes do Ademoir (cajado e raízes):
 *
 *   Game.CutRoot     Raiz de Corte (K): corre por baixo da terra até o adversário e faz duas
 *                    curvas — a 1ª sobe por baixo (só se defende agachado) e a 2ª desce de cima
 *                    (só se defende em pé), mais forte. Na Nova Floresta faz uma 3ª curva.
 *   Armadura de Carvalho Sagrado (↓ + K): o cajado se junta ao corpo e vira uma armadura no corpo
 *                    todo (forma maior, sem o cajado, socos com as manoplas): toma menos dano e
 *                    bate mais forte até a casca quebrar ou o tempo acabar. Fica em fighter.js
 *                    (putArmor/armorStrain/breakArmor); aqui só as lascas de casca e as folhas.
 *   Fúria do Carvalho (super): investida; acertando, três golpes e um carvalho brota embaixo
 *                    do adversário (Game.Supers.oak).
 *   Golpes da Nova Floresta: 'oakRoot' (raiz gigante do acerto garantido, mais forte conforme a
 *                    floresta cresce) e 'thorn' (espinho que brota a cada golpe, o eco).
 */
window.Game = window.Game || {};

Object.assign(Game.COPY_NAMES, { root: 'Raiz de corte', armor: 'Armadura de carvalho' });

Game.ROOT_COLORS = ['#1c0f08', '#4a2a14', '#7a4a26', '#b07a46', '#ecd3a0'];
Game.DIRT_COLORS = ['#5a3a22', '#7a5434', '#3e2716', '#2f6a34'];

/** Lascas de casca e folhas voando (a armadura nascendo, levando golpe ou quebrando). */
Game.barkBurst = function (scene, x, y, n = 8, big = false) {
  scene.effects.burst(x, y, ['#7d532f', '#a8743f', '#5a3a21', '#c99a62'], n, { speed: big ? 130 : 90, lift: big ? 120 : 80, gravity: 420 });
  scene.effects.burst(x, y - 4, ['#57a33e', '#8fd05a', '#2f6a2a'], Math.ceil(n / 2), { speed: 60, lift: 70, gravity: 90 });
};

/** Folhas caindo/girando. */
Game.leafBurst = function (scene, x, y, n = 8) {
  scene.effects.burst(x, y, ['#57a33e', '#8fd05a', '#2f6a2a', '#c8d850'], n, { speed: 80, lift: 90, gravity: 80 });
};

/**
 * Raiz grossa desenhada por pontos ao longo de uma curva.
 * pts: [[x, y], ...] da base até a ponta; base: espessura no pé (px).
 */
Game.drawRootCurve = function (ctx, pts, base, colors = Game.ROOT_COLORS) {
  const n = pts.length;
  if (n < 2) return;
  // contorno, corpo e luz (de cima/esquerda) em três passadas
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < n; i++) {
      const k = i / (n - 1);
      const r = Math.max(0.6, base * (1 - k * 0.85));
      const [x, y] = pts[i];
      if (pass === 0) Game.pixelDisc(ctx, x, y, r + 1, colors[0]);
      else if (pass === 1) Game.pixelDisc(ctx, x, y, r, i % 5 === 2 ? colors[1] : colors[2]);
      else if (r >= 1.5) {
        ctx.fillStyle = colors[3];
        ctx.fillRect(Math.round(x - r * 0.5), Math.round(y - r * 0.6), 1, 1);
      }
    }
  }
  // ponta afiada clara
  const [tx, ty] = pts[n - 1];
  ctx.fillStyle = colors[4];
  ctx.fillRect(Math.round(tx), Math.round(ty), 1, 1);
};

/** Pontos de uma raiz que sai do chão em (x, floor), com comprimento len, curvando pela "dobra". */
Game.rootPoints = function (x, floor, len, facing, bend, wobble = 0) {
  // bend: 0 = em pé (inclinada para a frente) · 1 = ponta virada para baixo, por cima do alvo
  //       -1 = chicoteia baixo para trás (3ª curva)
  const pts = [];
  let px = x;
  let py = floor;
  const steps = Math.max(2, Math.round(len));
  for (let i = 0; i < steps; i++) {
    const s = i / steps;
    const ang = -Math.PI / 2 + facing * (0.18 + bend * 2.9 * s * s * s) + Math.sin(s * 6 + wobble) * 0.06;
    px += Math.cos(ang);
    py += Math.sin(ang);
    pts.push([px, py]);
  }
  return pts;
};

Game.CutRoot = class CutRoot extends Game.Entity {
  constructor(owner, x, facing) {
    super(x - 3, 0, 6, 6);
    this.owner = owner;
    this.team = owner.team;
    this.facing = facing;
    this.x0 = x;
    this.tip = x;
    this.rx = x;
    this.phase = 'travel';
    this.t = 0;
    this.sourceX = owner.cx;
    this.layer = 2.5;
    this.curves = owner.inDomain && owner.char.special === 'root' ? 3 : 2;
    this.fired = 0;
    this.seed = Math.random() * 10;
    this.savePrev();
  }

  get floor() {
    return this.owner.groundY !== undefined ? this.owner.groundY : this.owner.feet;
  }

  update(dt, input, scene) {
    this.t += dt;
    const c = Game.config.root;
    if (this.phase === 'travel') {
      this.tip += c.speed * dt * this.facing;
      const map = scene.map ? scene.map.pixelWidth : 9999;
      if (Math.random() < 0.6) scene.effects.burst(this.tip, this.floor - 1, Game.DIRT_COLORS, 1, { speed: 30, lift: 50, gravity: 300 });
      const o = this.owner.opponent;
      // brota quando chega embaixo do adversário (ou no fim do alcance / na parede)
      const reached = o && !o.ko && !o.hidden && (o.cx - this.tip) * this.facing <= 2 && Math.abs(o.cx - this.tip) < 16;
      if (reached || Math.abs(this.tip - this.x0) >= c.range || this.tip < 6 || this.tip > map - 6) this.erupt(scene);
      this.x = this.tip - 3;
      this.y = this.floor - 6;
      return;
    }
    // curvas: 1ª sobe, 2ª desce de cima, 3ª (domínio) chicoteia de volta rente ao chão
    const times = [0.05, 0.05 + c.curveGap, 0.05 + c.curveGap * 2];
    while (this.fired < this.curves && this.t >= times[this.fired]) this.curveHit(scene, this.fired++);
    if (this.t > times[this.curves - 1] + 0.42) {
      this.dead = true;
      scene.effects.burst(this.rx, this.floor - 6, ['#7a4a26', '#b07a46', '#4a2a14'], 8, { speed: 70, lift: 60, gravity: 400 });
    }
  }

  erupt(scene) {
    this.phase = 'curves';
    this.t = 0;
    this.rx = this.tip;
    this.x = this.rx - 8;
    this.y = this.floor - 40;
    this.w = 16;
    this.h = 40;
    scene.effects.burst(this.rx, this.floor - 2, Game.DIRT_COLORS, 10, { speed: 90, lift: 120, gravity: 500 });
    scene.effects.shake(0.06, 1);
    Game.events.emit('rootBurst', { attacker: this.owner });
  }

  curveHit(scene, i) {
    const c = Game.config.root;
    const f = this.facing;
    let rect;
    let hit;
    if (i === 0) {
      rect = { x: this.rx - 7, y: this.floor - 32, w: 14, h: 32 };
      hit = c.hit1;
    } else if (i === 1) {
      // o gancho da raiz desce por cima de quem está do lado dela
      rect = { x: f > 0 ? this.rx - 4 : this.rx - 14, y: this.floor - 42, w: 18, h: 38 };
      hit = c.hit2;
    } else {
      rect = { x: this.rx - 12, y: this.floor - 22, w: 24, h: 22 };
      hit = c.hit3;
    }
    const res = scene.punch(rect, Object.assign({}, hit), this);
    Game.events.emit('rootCurve', { attacker: this.owner, curve: i + 1, result: res });
    if (res === 'hit' && i >= 1) Game.events.emit('rootWhip', { attacker: this.owner, target: this.owner.opponent, curve: i + 1 });
    scene.effects.burst(this.rx + f * (i === 1 ? 6 : 0), this.floor - (i === 1 ? 30 : 10), Game.ROOT_COLORS.slice(1, 4), 5,
      { speed: 80, lift: 60, gravity: 300 });
  }

  draw(ctx) {
    const floor = Math.round(this.floor);
    const f = this.facing;
    if (this.phase === 'travel') {
      // rachadura no chão do cajado até a ponta, e a pontinha da raiz rasgando a terra
      const a = Math.round(Math.min(this.x0, this.tip));
      const b = Math.round(Math.max(this.x0, this.tip));
      ctx.fillStyle = '#2a170c';
      for (let x = a; x <= b; x++) ctx.fillRect(x, floor - 1 + ((x * 7) % 5 === 0 ? -1 : 0), 1, 1);
      const tx = Math.round(this.tip);
      Game.drawRootCurve(ctx, Game.rootPoints(tx - f * 2, floor + 1, 6, f, 0.3, this.seed), 1.6);
      return;
    }
    const c = Game.config.root;
    const t = this.t;
    const x = Math.round(this.rx);
    // comprimento: cresce rápido, segura e recolhe no fim
    const end = 0.05 + c.curveGap * (this.curves - 1) + 0.42;
    let len = 38 * Math.min(1, t / 0.07);
    if (t > end - 0.2) len *= Math.max(0, (end - t) / 0.2);
    // dobra: 0 em pé → 1 por cima (2ª curva) → -0.8 rente ao chão (3ª curva)
    let bend = 0;
    const t2 = 0.05 + c.curveGap;
    if (t > t2 - 0.06) bend = Math.min(1, (t - (t2 - 0.06)) / 0.07);
    if (this.curves > 2) {
      const t3 = t2 + c.curveGap;
      if (t > t3 - 0.06) bend = 1 - Math.min(1.8, (t - (t3 - 0.06)) / 0.05);
    }
    if (len < 1) return;
    // duas raízes finas enroladas na principal
    for (const side of [-1, 1]) {
      const pts = Game.rootPoints(x + side * 3, floor + 1, len * 0.7, f, bend * 0.8, this.seed + side);
      Game.drawRootCurve(ctx, pts, 1.4);
    }
    Game.drawRootCurve(ctx, Game.rootPoints(x, floor + 1, len, f, bend, this.seed), 3.4);
    // terra revirada no pé
    ctx.fillStyle = '#3e2716';
    ctx.fillRect(x - 6, floor - 1, 13, 1);
    ctx.fillStyle = '#7a5434';
    ctx.fillRect(x - 4, floor - 2, 3, 1);
    ctx.fillRect(x + 2, floor - 2, 2, 1);
  }
};

// ============================================================================ Fúria do Carvalho
Object.assign(Game.Supers, {
  oak: {
    update(f, dt, scene) {
      const d = f.superData;
      const cfg = Game.config.oak;
      d.t += dt;
      if (d.phase === 'start') {
        d.phase = 'dash';
        d.t = 0;
        d.hitSet = new Set();
        f.play('oakDash', true);
        Game.events.emit('dash', { fighter: f });
      }
      if (d.phase === 'dash') {
        f.vx = f.facing * cfg.dashSpeed;
        if (Math.floor(d.t * 40) % 2 === 0) Game.leafBurst(scene, f.cx - f.facing * 8, f.feet - 10, 1);
        const res = scene.punch(f.hitRect({ x: 0, y: -26, w: 30, h: 22 }), Object.assign({ special: true }, cfg.hits[0]), f, d.hitSet);
        if (res === 'hit') {
          d.phase = 'flurry';
          d.t = 0;
          d.step = 1;
          f.vx = 0;
          f.play('oakHit1', true);
        } else if (res === 'blocked' || d.t > cfg.dashTime) {
          d.phase = 'end';
          d.t = 0;
          f.vx = 0;
          f.play('guard', true);
        }
      } else if (d.phase === 'flurry') {
        f.vx = f.facing * 14; // continua colado
        if (d.t >= 0.13) {
          d.t = 0;
          if (d.step < cfg.hits.length) {
            f.play(['oakHit1', 'oakHit2', 'oakHit3'][d.step], true);
            scene.punch(f.hitRect({ x: -2, y: -34, w: 32, h: 34 }), Object.assign({ special: true }, cfg.hits[d.step]), f);
            Game.leafBurst(scene, f.cx + f.facing * 20, f.feet - 22, 4);
            d.step += 1;
          } else {
            // crava o cajado: o carvalho brota embaixo do adversário
            d.phase = 'plant';
            f.vx = 0;
            f.play('oakPlant', true);
            const o = f.opponent;
            const x = o ? o.cx : f.cx + f.facing * 30;
            scene.add(new Game.Strike(f, 'oakRoot', x, { warn: 0.08, hit: Object.assign({}, cfg.root), big: true }));
            scene.effects.shake(0.12, 2);
            Game.events.emit('oakPlant', { fighter: f });
          }
        }
      } else if (d.phase === 'plant') {
        if (d.t > 0.42) f.finishSuper(0.12);
      } else if (d.phase === 'end') {
        f.vx *= 0.85;
        if (d.t > 0.3) f.finishSuper(0.14);
      }
    },
  },
});

// ============================================================================ golpes da Nova Floresta
Object.assign(Game.STRIKE_KINDS, {
  // raiz gigante (acerto garantido da floresta e final do super) · eco: espinho
  oakRoot: { from: 'ground', w: 20, h: 44, linger: 0.46, sound: 'oakRoot', colors: ['#ecd3a0', '#b07a46', '#7a4a26', '#2f6a34'] },
  thorn: { from: 'ground', w: 8, h: 14, linger: 0.2, sound: 'thorn', colors: ['#ecd3a0', '#b07a46', '#7a4a26', '#4a2a14'] },
});

Game.STRIKE_DRAW.oakRoot = function (ctx, x, floor, life) {
  // tronco de raiz rasgando o chão, com galhos e folhas, que recolhe no fim
  const grow = Math.min(1, this.t / 0.06);
  const fade = life > 0.65 ? 1 - (life - 0.65) / 0.35 : 1;
  const len = (this.big ? 52 : 44) * grow * fade;
  if (len < 2) return;
  const f = this.facing || 1;
  const main = Game.rootPoints(x, floor + 1, len, f, 0.15, this.seed % 7);
  for (const side of [-1, 1]) Game.drawRootCurve(ctx, Game.rootPoints(x + side * 5, floor + 1, len * 0.55, -side, 0.6, side), 2);
  Game.drawRootCurve(ctx, main, this.big ? 6 : 5);
  // folhinhas na ponta
  const [tx, ty] = main[main.length - 1];
  for (let i = 0; i < 4; i++) {
    const a = this.seed + i * 1.7;
    ctx.fillStyle = i % 2 ? '#8fd05a' : '#57a33e';
    ctx.fillRect(Math.round(tx + Math.cos(a) * 4), Math.round(ty + Math.sin(a) * 3), 2, 1);
  }
  ctx.fillStyle = '#3e2716';
  ctx.fillRect(x - 9, floor - 1, 19, 1);
};

Game.STRIKE_WARN.oakRoot = function (ctx, x, floor, p, blink) {
  // o chão racha e sobem folhas antes da raiz sair
  const half = Math.round(3 + 8 * p);
  ctx.fillStyle = '#2a170c';
  for (let i = -half; i <= half; i++) ctx.fillRect(x + i, floor - 1 - (Math.abs(i) % 3 === 0 ? 1 : 0), 1, 1);
  ctx.fillStyle = blink ? '#8fd05a' : '#57a33e';
  ctx.fillRect(x - 2, floor - 3 - Math.round(p * 3), 1, 2);
  ctx.fillRect(x + 3, floor - 2 - Math.round(p * 2), 1, 1);
};

Game.STRIKE_DRAW.thorn = function (ctx, x, floor, life) {
  const len = 14 * Math.min(1, this.t / 0.04) * (life > 0.6 ? 1 - (life - 0.6) / 0.4 : 1);
  if (len < 1) return;
  Game.drawRootCurve(ctx, Game.rootPoints(x, floor + 1, len, this.facing || 1, 0.1, this.seed % 5), 2);
};
