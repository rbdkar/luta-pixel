/*
 * Golpes que "caem" num ponto da arena em vez de voar:
 *
 *   Game.Strike        um golpe num lugar só: brota do chão, cai do céu ou vem de lado.
 *                      Tem um aviso (warn) antes de acertar e pode seguir um alvo (track).
 *     spike   pico de gelo (Gélida)          bolt    raio do céu (Trovão)
 *     abyss   espinho roxo (Abismo Violeta)  fist    punho fantasma (Ringue Sem Fim)
 *     book    livro gigante (Biblioteca)     flame   pilar de fogo (Fornalha Eterna)
 *     icicle  estalactite (Inverno Absoluto)
 *   Game.Streak        rastro elétrico do teletransporte
 *   Game.BlizzardWave  a Nevasca (super da Gélida): onda de neve que prende e congela
 *
 * Os acertos passam por scene.punch, então valem as mesmas regras dos socos
 * (defesa, barra de super, faíscas). opts.sure = acerto garantido do domínio:
 * espera o alvo poder levar golpe e não dá para defender.
 */
window.Game = window.Game || {};

Game.STRIKE_KINDS = {
  //            de onde vem   largura altura  quanto tempo fica visível depois do acerto
  spike: { from: 'ground', w: 14, h: 30, linger: 0.38, sound: 'iceSpike', colors: ['#ffffff', '#cfefff', '#7cc8ff', '#3c7ac0'] },
  bolt: { from: 'sky', w: 12, h: 170, linger: 0.22, sound: 'thunder', colors: ['#ffffff', '#fff3b0', '#ffd23f', '#7fd8ff'] },
  abyss: { from: 'ground', w: 12, h: 30, linger: 0.32, sound: 'abyss', colors: ['#ffffff', '#e2c4ff', '#a46cff', '#4a1b8c'] },
  fist: { from: 'side', w: 18, h: 16, linger: 0.16, sound: 'heavy', colors: ['#ffffff', '#ffb3a8', '#d9473a', '#8e2a20'] },
  book: { from: 'sky', w: 18, h: 14, linger: 0.2, sound: 'bookHit', colors: ['#f3efe4', '#e8c15a', '#c0392b', '#7d1f16'] },
  flame: { from: 'ground', w: 16, h: 42, linger: 0.34, sound: 'fireBig', colors: Game.FIRE_COLORS || ['#fff1b8', '#ffd166', '#ff9a3c', '#ff5a1f'] },
  icicle: { from: 'sky', w: 9, h: 18, linger: 0.12, sound: 'iceSpike', colors: ['#ffffff', '#cfefff', '#7cc8ff', '#3c7ac0'] },
};

Game.Strike = class Strike extends Game.Entity {
  /**
   * owner: quem lançou · kind: tipo (acima) · x: ponto no chão (centro)
   * opts: { warn (segundos de aviso), hit, track (lutador seguido até o acerto),
   *         sure (acerto garantido), small (versão menor, ecos do domínio) }
   */
  constructor(owner, kind, x, opts = {}) {
    const k = Game.STRIKE_KINDS[kind];
    super(x - k.w / 2, 0, k.w, k.h);
    this.owner = owner;
    this.team = owner.team;
    this.kind = kind;
    this.k = k;
    this.cxPos = x;
    this.warn = opts.warn !== undefined ? opts.warn : 0.25;
    this.hit = Object.assign({}, opts.hit || { damage: 4, knockback: 60, special: true });
    this.track = opts.track || null;
    this.sure = !!opts.sure;
    this.small = !!opts.small;
    this.big = !!opts.big;
    this.facing = owner.facing;
    this.sourceX = owner.cx;      // empurra para longe de quem lançou
    this.t = 0;
    this.phase = 'warn';
    this.layer = Game.STRIKE_KINDS[kind].from === 'ground' ? 2.5 : 4; // na frente dos lutadores
    this.seed = Math.floor(Math.random() * 1e6);
    this.waited = 0;
    if (this.sure) this.hit.unblockable = true;
    this.savePrev();
  }

  get floor() {
    return this.owner.groundY !== undefined ? this.owner.groundY : this.owner.feet;
  }

  update(dt, input, scene) {
    this.t += dt;
    const target = this.track;
    // segue o alvo até o golpe sair
    if (target && this.phase === 'warn') {
      this.cxPos = target.cx;
      this.sourceX = this.owner.cx;
    }
    if (this.phase === 'warn') {
      if (this.t >= this.warn) {
        // acerto garantido: espera o alvo estar de pé (caído ou voando não conta)
        if (this.sure && target && target.invulnerable(this.hit) && this.waited < 1.6 && !scene.locked) {
          this.waited += dt;
          return;
        }
        this.strike(scene);
      }
      return;
    }
    if (this.phase === 'strike' && this.t >= this.k.linger) {
      this.dead = true;
      if (this.k.from === 'ground') {
        scene.effects.burst(this.cxPos, this.floor - this.k.h / 2, this.k.colors, 12, { speed: 120, lift: 130, gravity: 600 });
      }
    }
  }

  /** Área do golpe no momento do acerto. */
  rect() {
    const k = this.k;
    const t = this.track;
    const scale = this.small ? 0.75 : 1;
    if (k.from === 'ground') {
      const h = Math.round(k.h * scale);
      return { x: this.cxPos - k.w / 2, y: this.floor - h, w: k.w, h };
    }
    if (k.from === 'side' || (t && this.kind !== 'bolt')) {
      // punho, livro e estalactite: em cima do alvo
      const top = t ? t.y - 4 : this.floor - 30;
      const bottom = t ? t.y + t.h : this.floor;
      return { x: this.cxPos - k.w / 2, y: top, w: k.w, h: bottom - top };
    }
    return { x: this.cxPos - k.w / 2, y: this.floor - k.h, w: k.w, h: k.h };
  }

  strike(scene) {
    this.phase = 'strike';
    this.t = 0;
    const r = this.rect();
    this.x = r.x;
    this.y = r.y;
    this.w = r.w;
    this.h = r.h;
    this.hitY = r.y;
    const res = scene.punch(r, this.hit, this);
    if (res === 'hit' && this.sure) Game.events.emit('sureHit', { attacker: this.owner, target: this.track, kind: this.kind });
    const cy = this.k.from === 'ground' ? this.floor - 4 : r.y + r.h / 2;
    scene.effects.burst(this.cxPos, cy, this.k.colors, this.small ? 6 : 12, { speed: 110, lift: 110, gravity: 300 });
    if (this.kind === 'bolt') {
      scene.effects.ring(this.cxPos, this.floor - 2, '#fff3b0', this.big ? 22 : 14);
      scene.effects.shake(this.small ? 0.06 : 0.14, this.small ? 1 : 2);
      scene.flashScreen = Math.max(scene.flashScreen || 0, this.small ? 0.05 : 0.1);
    }
    if (!this.small || this.kind === 'bolt') Game.events.emit('strike', { kind: this.kind, sound: this.k.sound });
  }

  // ------------------------------------------------------------------ desenho
  draw(ctx) {
    const x = Math.round(this.cxPos);
    const floor = Math.round(this.floor);
    if (this.phase === 'warn') {
      this.drawWarn(ctx, x, floor);
      return;
    }
    const k = this.k;
    const life = Math.min(1, this.t / k.linger);
    switch (this.kind) {
      case 'spike':
        Game.Strike.drawCrystal(ctx, x, floor, Math.round(k.h * (this.small ? 0.75 : 1) * Math.min(1, this.t / 0.06)), 7,
          ['#1d3a66', '#e8f8ff', '#9fdcff', '#5aa8e0']);
        break;
      case 'abyss':
        Game.Strike.drawCrystal(ctx, x, floor, Math.round(k.h * (this.small ? 0.7 : 1) * Math.min(1, this.t / 0.06)), 6,
          ['#1a0833', '#e2c4ff', '#8b45f0', '#4a1b8c']);
        break;
      case 'bolt':
        this.drawBolt(ctx, x, floor, life);
        break;
      case 'flame':
        this.drawFlame(ctx, x, floor, life);
        break;
      case 'fist':
        this.drawFist(ctx, life);
        break;
      case 'book':
        this.drawBigBook(ctx, x, Math.round(this.hitY), life);
        break;
      case 'icicle':
        Game.Strike.drawIcicle(ctx, x, Math.round(this.hitY) - 2 + Math.round(life * 4), 1 - life);
        break;
      default:
        // tipos registrados por outros arquivos (ex.: golpes do Soldador em forge.js)
        if (Game.STRIKE_DRAW && Game.STRIKE_DRAW[this.kind]) Game.STRIKE_DRAW[this.kind].call(this, ctx, x, floor, life);
        break;
    }
  }

  /** Aviso antes do golpe: geada/brasa no chão, nuvem no céu ou a mira do domínio. */
  drawWarn(ctx, x, floor) {
    const p = Math.min(1, this.t / Math.max(0.01, this.warn));
    const blink = Math.floor(this.t * 24) % 2;
    const color = this.k.colors[2];
    if (this.sure && this.track) {
      // mira do acerto garantido: cantos se fechando em volta do alvo
      const t = this.track;
      const half = Math.round(16 - 6 * p);
      const cy = Math.round(t.y + t.h / 2);
      const cx = Math.round(t.cx);
      ctx.fillStyle = blink ? '#ffffff' : color;
      for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const px = cx + sx * half;
        const py = cy + sy * (half + 2);
        ctx.fillRect(sx < 0 ? px : px - 3, py, 4, 1);
        ctx.fillRect(px, sy < 0 ? py : py - 3, 1, 4);
      }
      ctx.fillRect(cx, cy - 1, 1, 3);
      ctx.fillRect(cx - 1, cy, 3, 1);
    }
    if (Game.STRIKE_WARN && Game.STRIKE_WARN[this.kind]) {
      Game.STRIKE_WARN[this.kind].call(this, ctx, x, floor, p, blink);
      return;
    }
    if (this.k.from === 'ground') {
      // marca no chão crescendo
      const half = Math.round(2 + 6 * p);
      ctx.fillStyle = this.k.colors[3];
      ctx.fillRect(x - half, floor - 1, half * 2 + 1, 1);
      ctx.fillStyle = blink ? this.k.colors[0] : this.k.colors[1];
      ctx.fillRect(x - Math.round(half * 0.6), floor - 1, Math.round(half * 1.2) + 1, 1);
      if (p > 0.5) {
        ctx.fillStyle = this.k.colors[1];
        ctx.fillRect(x - 1, floor - 3, 1, 2);
        ctx.fillRect(x + 2, floor - 2, 1, 1);
        ctx.fillRect(x - 4, floor - 2, 1, 1);
      }
    } else if (this.kind === 'bolt' && this.warn >= 0.1) {
      // nuvem carregada e uma linha fraca até o chão
      const top = floor - 150;
      ctx.fillStyle = '#2a2f4a';
      ctx.fillRect(x - 8, top - 3, 17, 4);
      ctx.fillRect(x - 5, top - 5, 11, 2);
      if (blink) {
        ctx.fillStyle = '#fff3b0';
        ctx.fillRect(x - 3 + ((this.seed + Math.floor(this.t * 30)) % 7), top + 1, 1, 2);
        ctx.globalAlpha = 0.35 * p;
        ctx.fillRect(x, top + 2, 1, 148);
        ctx.globalAlpha = 1;
      }
    } else if (this.kind === 'book' || this.kind === 'icicle') {
      // sombra no chão
      const half = Math.round(2 + 5 * p);
      ctx.fillStyle = 'rgba(10, 16, 28, 0.45)';
      ctx.fillRect(x - half, floor - 1, half * 2 + 1, 2);
    }
  }

  /** Cristal pontudo saindo do chão (gelo ou abismo). c = [contorno, luz, corpo, sombra]. */
  static drawCrystal(ctx, x, floor, h, halfW, c) {
    if (h <= 0) return;
    for (let i = 0; i < h; i++) {
      const half = Math.max(0, Math.round(halfW * (1 - i / h)));
      const y = floor - 1 - i;
      ctx.fillStyle = c[0];
      ctx.fillRect(x - half - 1, y, half * 2 + 3, 1);
      if (half > 0) {
        ctx.fillStyle = c[2];
        ctx.fillRect(x - half, y, half * 2 + 1, 1);
        ctx.fillStyle = c[1];
        ctx.fillRect(x - half, y, Math.max(1, Math.round(half * 0.6)), 1);
        ctx.fillStyle = c[3];
        ctx.fillRect(x + Math.max(1, Math.round(half * 0.4)), y, Math.max(1, half - Math.round(half * 0.4)), 1);
      }
    }
    ctx.fillStyle = c[0];
    ctx.fillRect(x, floor - h - 1, 1, 1);
    // pontas menores dos lados
    const side = Math.round(h * 0.45);
    for (let i = 0; i < side; i++) {
      const half = Math.max(0, Math.round(3 * (1 - i / side)));
      ctx.fillStyle = c[0];
      ctx.fillRect(x - halfW - 3 - half, floor - 1 - i, half * 2 + 1, 1);
      ctx.fillRect(x + halfW + 3 - half, floor - 1 - i, half * 2 + 1, 1);
      ctx.fillStyle = c[2];
      if (half > 0) {
        ctx.fillRect(x - halfW - 3 - half + 1, floor - 1 - i, Math.max(1, half * 2 - 1), 1);
        ctx.fillRect(x + halfW + 3 - half + 1, floor - 1 - i, Math.max(1, half * 2 - 1), 1);
      }
    }
  }

  static drawIcicle(ctx, x, tipY, alpha = 1) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    const h = 16;
    for (let i = 0; i < h; i++) {
      const half = Math.round(4 * (i / h));
      const y = tipY - i;
      ctx.fillStyle = '#1d3a66';
      ctx.fillRect(x - half - 1, y, half * 2 + 3, 1);
      ctx.fillStyle = '#9fdcff';
      ctx.fillRect(x - half, y, half * 2 + 1, 1);
      ctx.fillStyle = '#e8f8ff';
      ctx.fillRect(x - half, y, Math.max(1, half), 1);
    }
    ctx.restore();
  }

  drawBolt(ctx, x, floor, life) {
    const top = floor - (this.small ? 120 : 160);
    const fade = life > 0.6 ? 1 - (life - 0.6) / 0.4 : 1;
    if (fade <= 0) return;
    // caminho em zigue-zague (sorteado de novo a cada poucos quadros: o raio "treme")
    let seed = this.seed + Math.floor(this.t * 40) * 7919;
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    const pts = [];
    let px = x + Math.round((rnd() - 0.5) * 10);
    for (let y = top; y < floor; y += 10) {
      pts.push([px, y]);
      px = x + Math.round((rnd() - 0.5) * (this.small ? 8 : 14));
    }
    pts.push([x, floor]);
    const thick = this.big ? 3 : this.small ? 1 : 2;
    ctx.save();
    ctx.globalAlpha = fade;
    const seg = (a, b, w, color) => {
      ctx.fillStyle = color;
      const steps = Math.max(1, Math.abs(b[1] - a[1]));
      for (let i = 0; i <= steps; i++) {
        const k = i / steps;
        const sx = Math.round(a[0] + (b[0] - a[0]) * k);
        const sy = Math.round(a[1] + (b[1] - a[1]) * k);
        ctx.fillRect(sx - w, sy, w * 2 + 1, 1);
      }
    };
    for (let i = 0; i < pts.length - 1; i++) seg(pts[i], pts[i + 1], thick + 2, 'rgba(255, 210, 63, 0.45)');
    for (let i = 0; i < pts.length - 1; i++) seg(pts[i], pts[i + 1], thick, '#ffd23f');
    for (let i = 0; i < pts.length - 1; i++) seg(pts[i], pts[i + 1], Math.max(0, thick - 1), '#ffffff');
    // brilho no chão
    ctx.fillStyle = '#fff3b0';
    ctx.fillRect(x - 6, floor - 2, 13, 2);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - 3, floor - 3, 7, 2);
    ctx.restore();
  }

  drawFlame(ctx, x, floor, life) {
    const h = Math.round(this.k.h * (this.small ? 0.7 : 1) * Math.min(1, this.t / 0.05) * (life > 0.7 ? 1 - (life - 0.7) / 0.3 : 1));
    const colors = ['#fff1b8', '#ffd166', '#ff9a3c', '#ff5a1f', '#c8261b'];
    for (let i = 0; i < h; i++) {
      const k = i / Math.max(1, h);
      const wave = Math.sin(this.t * 40 + i * 0.45) * 1.5;
      const half = Math.max(0, Math.round((this.k.w / 2) * (1 - k * 0.75) + wave * (1 - k)));
      const y = floor - 1 - i;
      for (let c = 4; c >= 0; c--) {
        const hw = Math.round(half * (0.35 + c * 0.17));
        if (hw <= 0 && c > 0) continue;
        ctx.fillStyle = colors[c];
        ctx.fillRect(x - hw + Math.round(wave), y, hw * 2 + 1, 1);
      }
    }
  }

  drawFist(ctx, life) {
    // punho fantasma: chega pelo lado de quem lançou e soca o alvo
    const dir = this.cxPos >= this.sourceX ? 1 : -1;
    const arrive = Math.min(1, this.t / 0.06);
    const cx = Math.round(this.cxPos - dir * (1 - arrive) * 30 - dir * 6);
    const cy = Math.round(this.hitY + 8);
    ctx.save();
    ctx.globalAlpha = life > 0.6 ? 1 - (life - 0.6) / 0.4 : 0.92;
    // linhas de velocidade
    ctx.fillStyle = '#ffd7d0';
    ctx.fillRect(cx - dir * 22, cy - 3, 10, 1);
    ctx.fillRect(cx - dir * 26, cy + 2, 12, 1);
    ctx.fillRect(cx - dir * 20, cy + 5, 8, 1);
    const s = this.small ? 0.8 : 1;
    const w = Math.round(14 * s);
    const h = Math.round(12 * s);
    const left = dir > 0 ? cx - w + 4 : cx - 4;
    const top = cy - Math.round(h / 2);
    ctx.fillStyle = '#3a0d08';
    ctx.fillRect(left - 1, top - 1, w + 2, h + 2);
    ctx.fillStyle = '#d9473a';
    ctx.fillRect(left, top, w, h);
    ctx.fillStyle = '#ff8a7a';
    ctx.fillRect(left + 1, top + 1, w - 3, 2);
    ctx.fillStyle = '#8e2a20';
    ctx.fillRect(left, top + h - 2, w, 2);
    // punho (dedos) e punho da luva
    ctx.fillStyle = '#b8352a';
    ctx.fillRect(dir > 0 ? left + w - 4 : left + 1, top + 3, 3, h - 5);
    ctx.fillStyle = '#f3efe4';
    ctx.fillRect(dir > 0 ? left - 3 : left + w, top + 2, 3, h - 4);
    ctx.restore();
  }

  drawBigBook(ctx, x, hitY, life) {
    // cai do alto e bate na cabeça
    const fall = Math.min(1, this.t / 0.05);
    const y = Math.round(hitY - 40 * (1 - fall));
    const s = this.small ? 0.7 : 1;
    const w = Math.round(20 * s);
    const h = Math.round(13 * s);
    const left = x - Math.round(w / 2);
    ctx.save();
    ctx.globalAlpha = life > 0.7 ? 1 - (life - 0.7) / 0.3 : 1;
    ctx.fillStyle = '#1b0f0b';
    ctx.fillRect(left - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = '#c0392b';
    ctx.fillRect(left, y, w, h);
    ctx.fillStyle = '#e05a48';
    ctx.fillRect(left, y, w, 2);
    ctx.fillStyle = '#7d1f16';
    ctx.fillRect(left, y + h - 2, w, 2);
    ctx.fillStyle = '#f3efe4';
    ctx.fillRect(left + w - 3, y + 2, 2, h - 4);   // páginas
    ctx.fillStyle = '#e8c15a';
    ctx.fillRect(left + Math.round(w / 2) - 3, y + Math.round(h / 2) - 2, 6, 4); // emblema
    ctx.fillStyle = '#fff3b0';
    ctx.fillRect(left + Math.round(w / 2) - 1, y + Math.round(h / 2) - 1, 2, 2);
    ctx.restore();
  }
};

/** Rastro do teletransporte: um raio curto ligando a saída à chegada. */
Game.Streak = class Streak extends Game.Entity {
  constructor(x0, y0, x1, y1) {
    super(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0) + 1, Math.abs(y1 - y0) + 1);
    this.a = [x0, y0];
    this.b = [x1, y1];
    this.t = 0;
    this.life = 0.18;
    this.layer = 3;
    this.seed = Math.floor(Math.random() * 1e6);
  }

  update(dt) {
    this.t += dt;
    if (this.t >= this.life) this.dead = true;
  }

  draw(ctx) {
    const fade = 1 - this.t / this.life;
    let seed = this.seed + Math.floor(this.t * 50);
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    const [x0, y0] = this.a;
    const [x1, y1] = this.b;
    const n = Math.max(2, Math.round(Math.abs(x1 - x0) / 8));
    ctx.save();
    ctx.globalAlpha = fade;
    let px = x0;
    let py = y0;
    for (let i = 1; i <= n; i++) {
      const k = i / n;
      const nx = Math.round(x0 + (x1 - x0) * k);
      const ny = Math.round(y0 + (y1 - y0) * k + (i < n ? (rnd() - 0.5) * 10 : 0));
      const steps = Math.max(Math.abs(nx - px), Math.abs(ny - py), 1);
      for (let s = 0; s <= steps; s++) {
        const sx = Math.round(px + (nx - px) * (s / steps));
        const sy = Math.round(py + (ny - py) * (s / steps));
        ctx.fillStyle = '#ffd23f';
        ctx.fillRect(sx, sy - 1, 1, 3);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(sx, sy, 1, 1);
      }
      px = nx;
      py = ny;
    }
    ctx.restore();
  }
};

/**
 * Nevasca (super da Gélida): uma parede de neve que avança. Ao encostar no
 * adversário, prende e acerta várias vezes; o último golpe congela.
 */
Game.BlizzardWave = class BlizzardWave extends Game.Entity {
  constructor(owner) {
    super(0, 0, 30, 34);
    this.owner = owner;
    this.team = owner.team;
    this.facing = owner.facing;
    this.x = owner.cx + owner.facing * 10 - (owner.facing > 0 ? 0 : this.w);
    this.y = owner.feet - this.h;
    this.vx = owner.facing * 210;
    this.t = 0;
    this.life = 1.7;
    this.tick = 0;
    this.hits = 0;
    this.caught = null;
    this.blocked = false;
    this.layer = 3;
    this.hitSet = new Set();
    this.savePrev();
  }

  update(dt, input, scene) {
    this.t += dt;
    this.x += this.vx * dt;
    this.sourceX = this.facing > 0 ? this.x : this.x + this.w;
    // desmancha projéteis do adversário
    for (const e of scene.entities) {
      if (e instanceof Game.Projectile && !e.dead && e.team !== this.team && this.overlaps(e)) e.explode(scene);
    }
    const foe = this.owner.opponent;
    if (!this.caught && !this.done && foe && this.overlaps(foe) && !foe.invulnerable({ super: true })) {
      this.caught = foe;
      this.vx = this.facing * 45; // segura o adversário dentro da neve
      this.tick = 0;
    }
    if (this.caught && !this.done) {
      this.tick -= dt;
      if (this.tick <= 0) {
        this.tick = 0.085;
        this.hits += 1;
        const last = this.hits >= 6;
        const hit = last
          ? { damage: 7, knockback: 40, heavy: true, special: true, super: true, freeze: 1.0 }
          : { damage: 3, knockback: 10, special: true, super: true, stop: 'multi' };
        const res = scene.punch({ x: this.x - 4, y: this.y, w: this.w + 8, h: this.h }, hit, this);
        if (res === 'blocked') this.blocked = true;
        if (this.caught.state !== 'iced') this.caught.vx = this.vx;
        if (last || (!res && this.hits > 1)) {
          this.done = true;
          this.vx = this.facing * 210;
        }
      }
    }
    if (Math.random() < 0.7) {
      scene.effects.burst(this.x + Math.random() * this.w, this.y + Math.random() * this.h, ['#ffffff', '#e8f8ff', '#9fdcff'], 1,
        { speed: 40, lift: 20, gravity: 40, dirX: this.facing });
    }
    if (this.t >= this.life || this.x + this.w < -20 || this.x > scene.map.pixelWidth + 20) this.dead = true;
  }

  overlaps(e) {
    return this.x < e.x + e.w && this.x + this.w > e.x && this.y < e.y + e.h && this.y + this.h > e.y;
  }

  draw(ctx, renderer, alpha = 1) {
    const p = this.lerpPos(alpha);
    const x = Math.round(p.x);
    const y = Math.round(p.y);
    const fade = this.t > this.life - 0.25 ? (this.life - this.t) / 0.25 : Math.min(1, this.t / 0.08);
    ctx.save();
    ctx.globalAlpha = Math.max(0, fade) * 0.55;
    ctx.fillStyle = '#cfefff';
    ctx.fillRect(x, y + 4, this.w, this.h - 4);
    ctx.globalAlpha = Math.max(0, fade) * 0.35;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + 4, y, this.w - 8, this.h);
    ctx.globalAlpha = Math.max(0, fade);
    // flocos e cristais rodando
    let seed = Math.floor(this.t * 24) * 131 + 7;
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    for (let i = 0; i < 26; i++) {
      const fx = x + Math.floor(rnd() * this.w);
      const fy = y + Math.floor(rnd() * this.h);
      ctx.fillStyle = rnd() < 0.5 ? '#ffffff' : '#7cc8ff';
      ctx.fillRect(fx, fy, rnd() < 0.3 ? 2 : 1, 1);
    }
    // frente da onda (borda mais forte)
    const front = this.facing > 0 ? x + this.w - 2 : x;
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < this.h; i += 3) ctx.fillRect(front + ((i + Math.floor(this.t * 30)) % 2), y + i, 2, 2);
    ctx.restore();
  }
};