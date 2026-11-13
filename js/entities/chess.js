/*
 * Poderes da Dama (xadrez):
 *
 *   Game.Pawn        Peão em Marcha (K): o peão cresce do chão e anda casa a casa. Se o adversário
 *                    estiver na casa da frente, captura na diagonal (salta em cima dele), fica na
 *                    casa dele e segue marchando (na 2ª captura se desfaz). Um golpe quebra o peão. Se ele chegar ao fim do caminho (ou na parede), é PROMOVIDO: vira uma
 *                    dama que avança no adversário. No Tabuleiro Infinito anda duas casas por vez.
 *   Salto do Cavalo (↓ + K): fica em fighter.js (handleKnight): sobe duas casas, atravessa por cima
 *                    e desce pisando na casa marcada atrás do adversário (um L). Aqui só a marca.
 *   Roque (agarrão): troca de lugar com o adversário e a torre cai em cima dele (Game.RookSlam).
 *   XEQUE-MATE (super): a fileira de casas corre pelo chão; se pega ("xeque"), torre, bispo e
 *                    cavalo caem no adversário e a dama gigante fecha o mate (Game.MateShow).
 *   Golpes do Tabuleiro Infinito: 'chessDrop' (peça gigante que cai na casa marcada, o acerto
 *                    garantido) e 'pawnPop' (peãozinho que brota do chão, o eco).
 *
 * As peças são desenhadas pixel a pixel a partir dos mapas abaixo (sem imagem).
 */
window.Game = window.Game || {};

Object.assign(Game.COPY_NAMES, { pawn: 'Peão em marcha', knight: 'Salto do cavalo' });

// ------------------------------------------------------------------ peças
// '#' contorno · 'w' luz · 'p' sombra · 'd' faixa da base · 'g' ouro (coroa e cruz)
Game.CHESS_PIECES = {
  pawn: [
    '....###....',
    '...#www#...',
    '..#wwwpp#..',
    '..#wwwpp#..',
    '...#wpp#...',
    '..#######..',
    '...#wwp#...',
    '...#wwp#...',
    '...#wwp#...',
    '..#wwwpp#..',
    '.#wwwwppp#.',
    '.#########.',
    '#wwwwwwwpp#',
    '#ddddddddd#',
    '###########',
  ],
  rook: [
    '###.#####.###',
    '#w#.#www#.#p#',
    '#wwwwwwwwwpp#',
    '#############',
    '.#wwwwwwwpp#.',
    '..#wwwwwpp#..',
    '..#wwwwwpp#..',
    '..#wwwwwpp#..',
    '..#wwwwwpp#..',
    '..#wwwwwpp#..',
    '.#wwwwwwwpp#.',
    '.###########.',
    '#wwwwwwwwwpp#',
    '#ddddddddddd#',
    '#############',
  ],
  // o cavalo do mapa olha para a esquerda (faces: -1)
  knight: [
    '....##......',
    '...#ww#.....',
    '..#wwww##...',
    '.#wwkwwww#..',
    '#wwwwwwwwp#.',
    '#www##wwwpp#',
    '.##..#wwwpp#',
    '....#wwwwpp#',
    '...#wwwwwpp#',
    '..#wwwwwwpp#',
    '..#wwwwwwpp#',
    '.##########.',
    '#wwwwwwwwpp#',
    '#dddddddddd#',
    '############',
  ],
  bishop: [
    '.....#.....',
    '....#w#....',
    '...#wwp#...',
    '..#ww#pp#..',
    '..#w#wpp#..',
    '..#wwwpp#..',
    '...#wpp#...',
    '..#######..',
    '...#wwp#...',
    '...#wwp#...',
    '..#wwwpp#..',
    '.#wwwwppp#.',
    '.#########.',
    '#wwwwwwwpp#',
    '#ddddddddd#',
    '###########',
  ],
  queen: [
    '......#......',
    '.....#g#.....',
    '..g...#...g..',
    '.#g#.#g#.#g#.',
    '.#gg#ggg#gg#.',
    '..#ggggggg#..',
    '..#########..',
    '...#wwwpp#...',
    '...#wwwpp#...',
    '....#wwp#....',
    '....#wwp#....',
    '...#wwwpp#...',
    '..#wwwwwpp#..',
    '.#wwwwwwwpp#.',
    '.###########.',
    '#wwwwwwwwwpp#',
    '#ddddddddddd#',
    '#############',
  ],
  king: [
    '.....#.....',
    '....#g#....',
    '...#ggg#...',
    '....#g#....',
    '..#######..',
    '..#wwwpp#..',
    '..#######..',
    '...#wwp#...',
    '...#wwp#...',
    '...#wwp#...',
    '..#wwwpp#..',
    '.#wwwwppp#.',
    '.#########.',
    '#wwwwwwwpp#',
    '#ddddddddd#',
    '###########',
  ],
};
Game.CHESS_FACES = { knight: -1 };

// marfim rosado (as peças da Dama) e ébano (cópias do Corvo, a Sombra)
Game.CHESS_PALETTES = {
  ivory: { '#': '#3a1f2e', w: '#fff3f6', p: '#f2bccb', d: '#d28aa2', g: '#ffd36b', k: '#3a1f2e' },
  ebony: { '#': '#0e0a12', w: '#5a4a66', p: '#3a2e46', d: '#271d31', g: '#ff4a5e', k: '#ff4a5e' },
  glow: { '#': '#ff7fa8', w: '#ffffff', p: '#ffe0ea', d: '#ffc2d6', g: '#fff4b0', k: '#ff7fa8' },
};

/**
 * Desenha uma peça com a base em (cx, bottom). s: tamanho do pixel (escala inteira); dir: para onde
 * ela olha; pal: paleta; squash: achata (1 = normal) no impacto.
 */
Game.drawPiece = function (ctx, name, cx, bottom, s = 1, dir = 1, pal = 'ivory', squash = 1) {
  const rows = Game.CHESS_PIECES[name];
  const colors = Game.CHESS_PALETTES[pal] || Game.CHESS_PALETTES.ivory;
  const h = rows.length;
  const w = rows[0].length;
  const flip = dir * (Game.CHESS_FACES[name] || 1) < 0;
  const sy = Math.max(1, Math.round(s * squash));
  const x0 = Math.round(cx - (w * s) / 2);
  const y0 = Math.round(bottom - h * sy);
  for (let j = 0; j < h; j++) {
    const row = rows[j];
    for (let i = 0; i < w; i++) {
      const ch = row[i];
      if (ch === '.') continue;
      ctx.fillStyle = colors[ch];
      const col = flip ? w - 1 - i : i;
      ctx.fillRect(x0 + col * s, y0 + j * sy, s, sy);
    }
  }
};

Game.pieceSize = function (name, s = 1) {
  const rows = Game.CHESS_PIECES[name];
  return { w: rows[0].length * s, h: rows.length * s };
};

/** Paleta das peças de quem lançou: a Dama joga de marfim; cópias e a Sombra, de ébano. */
Game.chessPalette = function (owner) {
  return owner && owner.charKey === 'dama' && !owner.shadow ? 'ivory' : 'ebony';
};

/** Casa do tabuleiro no chão (vista de lado: um losango achatado), acesa conforme p (0–1). */
Game.drawSquare = function (ctx, x, floor, size, p, blink, colors = ['#ff7fa8', '#ffe0ea']) {
  const half = Math.round(size / 2);
  ctx.fillStyle = blink ? colors[1] : colors[0];
  ctx.fillRect(x - half, floor - 1, half * 2, 1);
  ctx.fillRect(x - half + 2, floor - 2, half * 2 - 4, 1);
  ctx.fillRect(x - half + 4, floor - 3, half * 2 - 8, 1);
  // coluna de luz subindo da casa (fica mais alta conforme o golpe chega)
  const tall = Math.round(4 + 22 * p);
  ctx.save();
  ctx.globalAlpha *= 0.22 + 0.18 * p;
  ctx.fillStyle = colors[1];
  for (let y = 0; y < tall; y += 2) ctx.fillRect(x - half + 3, floor - 4 - y, half * 2 - 6, 1);
  ctx.restore();
};

/** Poeirinha de mármore (peça quebrando, pousando ou caindo). */
Game.chessBurst = function (scene, x, y, n = 8, pal = 'ivory', big = false) {
  const c = Game.CHESS_PALETTES[pal] || Game.CHESS_PALETTES.ivory;
  scene.effects.burst(x, y, [c.w, c.p, c.d, c['#']], n, { speed: big ? 150 : 100, lift: big ? 150 : 100, gravity: 520 });
};

// ============================================================================ Peão em Marcha
Game.Pawn = class Pawn extends Game.Entity {
  constructor(owner, x, facing) {
    super(x - 5, 0, 10, 16);
    this.owner = owner;
    this.team = owner.team;
    this.facing = facing;
    this.px = x;
    this.sourceX = owner.cx;
    this.phase = 'rise';
    this.t = 0;
    this.steps = 0;
    this.lift = 0;
    this.layer = 2.5;
    this.pal = Game.chessPalette(owner);
    this.hitSet = new Set();
    this.place();
    this.savePrev();
  }

  get cx() {
    return this.px;
  }

  get floor() {
    return this.owner.groundY !== undefined ? this.owner.groundY : this.owner.feet;
  }

  /** No Tabuleiro Infinito (dela) o peão anda duas casas por vez. */
  get stride() {
    return this.owner.inDomain && this.owner.char.special === 'pawn' ? 2 : 1;
  }

  place() {
    this.x = this.px - this.w / 2;
    this.y = this.floor - this.h - this.lift;
  }

  update(dt, input, scene) {
    const c = Game.config.pawn;
    this.t += dt;
    if (scene.locked || this.owner.ko) {
      if (this.phase !== 'queen') this.shatter(scene, false);
      else this.dead = true;
      return;
    }
    const o = this.owner.opponent;
    const map = scene.map ? scene.map.pixelWidth : 9999;
    switch (this.phase) {
      case 'rise':
        // assim que termina de brotar já olha a casa da frente (colado, captura na hora)
        if (this.t >= c.rise) {
          this.wait();
          this.t = c.stepTime - c.firstLook;
        }
        break;
      case 'wait':
        if (this.t >= c.stepTime) this.decide(scene, o, map);
        break;
      case 'hop': {
        const k = Math.min(1, this.t / c.hopTime);
        this.px = this.from + (this.to - this.from) * k;
        this.lift = Math.sin(k * Math.PI) * 5;
        if (k >= 1) {
          this.lift = 0;
          this.steps += this.hopN;
          scene.effects.burst(this.px, this.floor - 1, ['#e8dcd6', '#c9b9b2'], 3, { speed: 40, lift: 30, gravity: 300 });
          Game.events.emit('pawnStep', { owner: this.owner });
          const edge = this.px < 18 || this.px > map - 18;
          if (this.steps >= c.promoteAt || edge) this.promote(scene);
          else this.wait();
        }
        break;
      }
      case 'capture': {
        // salto na diagonal em cima do adversário (a captura do peão)
        const k = Math.min(1, this.t / 0.16);
        this.px = this.from + (this.to - this.from) * k;
        this.lift = Math.sin(k * Math.PI) * 14;
        if (!this.struck && k >= 0.5) {
          this.struck = true;
          const r = { x: this.px - 9, y: this.floor - 30, w: 18, h: 30 };
          const res = scene.punch(r, Object.assign({}, c.capture), this);
          if (res === 'hit') {
            this.captured = true;
            Game.events.emit('pawnCapture', { attacker: this.owner, target: o });
            Game.chessBurst(scene, this.px, this.floor - 18, 6, this.pal);
          } else if (res === 'blocked') {
            this.shatter(scene, true);
            return;
          }
        }
        if (k >= 1) {
          this.lift = 0;
          // capturou: fica na casa de quem foi capturado e segue marchando (na 2ª captura se desfaz)
          if (this.captured) this.captures = (this.captures || 0) + 1;
          if (this.captures >= 2) this.shatter(scene, false);
          else this.wait();
        }
        break;
      }
      case 'promote':
        // vira a dama: cresce brilhando e escolhe a direção do adversário
        if (this.t >= c.queenWarn) {
          this.phase = 'queen';
          this.t = 0;
          this.dir = o && !o.ko ? Math.sign(o.cx - this.px) || this.facing : this.facing;
          this.x0 = this.px;
          this.w = 18;
          this.h = 30;
          Game.events.emit('queenRush', { owner: this.owner });
        }
        break;
      case 'queen': {
        this.px += this.dir * c.queenSpeed * dt;
        if (Math.random() < 0.7) scene.effects.burst(this.px - this.dir * 6, this.floor - 1, ['#e8dcd6', '#c9b9b2'], 1, { speed: 40, lift: 40, gravity: 300 });
        const r = { x: this.px - 9, y: this.floor - 30, w: 18, h: 30 };
        this.sourceX = this.px - this.dir * 20;
        this.facing = this.dir;
        const res = scene.punch(r, Object.assign({}, c.queen), this, this.hitSet);
        if (res) {
          Game.chessBurst(scene, this.px, this.floor - 16, 14, this.pal, true);
          this.dead = true;
          return;
        }
        if (Math.abs(this.px - this.x0) > c.queenRange || this.px < 4 || this.px > map - 4) {
          Game.chessBurst(scene, this.px, this.floor - 12, 10, this.pal);
          this.dead = true;
          return;
        }
        break;
      }
      default:
        break;
    }
    this.place();
  }

  wait() {
    this.phase = 'wait';
    this.t = 0;
  }

  decide(scene, o, map) {
    const c = Game.config.pawn;
    const sq = c.square;
    const f = this.facing;
    if (o && !o.ko && !o.hidden) {
      const d = (o.cx - this.px) * f;
      const low = o.feet > this.floor - 26; // no chão ou pulando baixinho
      // na casa da frente (ou em cima da do peão): captura
      if (d >= -5 && d <= sq + 9 && low && !o.invulnerable()) {
        this.phase = 'capture';
        this.t = 0;
        this.struck = false;
        this.captured = false;
        this.from = this.px;
        this.to = Math.max(10, Math.min(map - 10, o.cx));
        Game.events.emit('pawnLeap', { owner: this.owner });
        return;
      }
    }
    this.phase = 'hop';
    this.t = 0;
    this.hopN = this.stride;
    this.from = this.px;
    this.to = Math.max(10, Math.min(map - 10, this.px + f * sq * this.hopN));
    // não passa por cima do adversário: para na casa de antes dele
    if (o && !o.ko && !o.hidden) {
      const d = (o.cx - this.px) * f;
      if (d > 5 && (this.to - this.px) * f > d - 4) this.to = this.px + f * Math.max(0, d - sq);
    }
  }

  promote(scene) {
    this.phase = 'promote';
    this.t = 0;
    Game.chessBurst(scene, this.px, this.floor - 10, 8, this.pal);
    scene.effects.ring(this.px, this.floor - 14, '#ffd36b', 14);
    Game.events.emit('pawnPromote', { owner: this.owner });
  }

  shatter(scene, loud) {
    if (this.dead) return;
    this.dead = true;
    Game.chessBurst(scene, this.px, this.floor - 8, loud ? 12 : 8, this.pal);
    Game.events.emit('pawnBreak', { owner: this.owner });
  }

  /** Um golpe do adversário quebra o peão (a dama, correndo, não). */
  onHit(hit, from, scene) {
    const who = from.owner || from;
    if (who === this.owner || (who.team && who.team === this.team)) return false;
    if (this.phase === 'queen' || this.phase === 'promote' || hit.echo) return false;
    this.shatter(scene, true);
    return 'hit';
  }

  draw(ctx, renderer, alpha = 1) {
    const x = Math.round(this.px);
    const floor = Math.round(this.floor);
    const c = Game.config.pawn;
    // a casa onde ele está, acesa de leve
    if (this.phase !== 'queen') {
      ctx.save();
      ctx.globalAlpha *= 0.55;
      Game.drawSquare(ctx, x, floor, 14, 0, false, ['#d98aa6', '#ffe0ea']);
      ctx.restore();
    }
    if (this.phase === 'rise') {
      // brota do chão: desenhado cortado
      const k = Math.min(1, this.t / c.rise);
      const h = Game.pieceSize('pawn').h;
      ctx.save();
      ctx.beginPath();
      ctx.rect(x - 8, floor - Math.ceil(h * k), 16, Math.ceil(h * k));
      ctx.clip();
      Game.drawPiece(ctx, 'pawn', x, floor + Math.round(h * (1 - k)), 1, this.facing, this.pal);
      ctx.restore();
      return;
    }
    if (this.phase === 'promote') {
      // pisca entre peão e dama, a dama crescendo
      const k = Math.min(1, this.t / c.queenWarn);
      const blink = Math.floor(this.t * 18) % 2;
      if (k < 0.5 && blink) Game.drawPiece(ctx, 'pawn', x, floor, 1, this.facing, 'glow');
      else Game.drawPiece(ctx, 'queen', x, floor, k > 0.6 ? 2 : 1, this.facing, blink ? 'glow' : this.pal);
      return;
    }
    if (this.phase === 'queen') {
      Game.drawPiece(ctx, 'queen', x, floor, 2, this.dir, this.pal);
      return;
    }
    const squash = this.lift === 0 && this.phase === 'wait' && this.t < 0.06 ? 0.85 : 1;
    Game.drawPiece(ctx, 'pawn', x, floor - Math.round(this.lift), 1, this.facing, this.pal, squash);
  }
};

// ============================================================================ Salto do Cavalo: a casa marcada
Game.KnightMark = class KnightMark extends Game.Entity {
  constructor(owner, plan) {
    super(plan.tx - 8, 0, 16, 4);
    this.owner = owner;
    this.plan = plan;
    this.t = 0;
    this.layer = 0.5;
    this.x0 = owner.cx;
  }

  get floor() {
    return this.owner.groundY !== undefined ? this.owner.groundY : this.owner.feet;
  }

  update(dt) {
    this.t += dt;
    const a = this.owner.attack;
    if (!a || a.knight !== this.plan || this.plan.phase === 'land' || this.t > 1.6) this.dead = true;
  }

  draw(ctx) {
    const x = Math.round(this.plan.tx);
    const floor = Math.round(this.plan.floor !== undefined ? this.plan.floor : this.floor);
    const blink = Math.floor(this.t * 16) % 2;
    Game.drawSquare(ctx, x, floor, 16, Math.min(1, this.t / 0.4), blink);
    // o L tracejado: sobe duas casas, atravessa e desce na casa
    const top = floor - Game.config.knight.height - 14;
    ctx.fillStyle = 'rgba(255, 180, 205, 0.55)';
    const x0 = Math.round(this.x0);
    for (let y = floor - 6; y > top; y -= 3) ctx.fillRect(x0, y, 1, 1);
    const s = Math.sign(x - x0) || 1;
    for (let xx = x0; xx * s < x * s; xx += 3 * s) ctx.fillRect(xx, top, 1, 1);
    for (let y = top; y < floor - 6; y += 3) ctx.fillRect(x, y, 1, 1);
  }
};

// ============================================================================ Roque (agarrão)
Game.RookSlam = class RookSlam extends Game.Entity {
  constructor(owner, x) {
    super(x - 13, 0, 26, 30);
    this.owner = owner;
    this.cx0 = x;
    this.t = 0;
    this.layer = 3.5;
    this.pal = Game.chessPalette(owner);
    this.landed = false;
  }

  get floor() {
    return this.owner.groundY !== undefined ? this.owner.groundY : this.owner.feet;
  }

  update(dt, input, scene) {
    this.t += dt;
    if (!this.landed && this.t >= 0.08) {
      this.landed = true;
      scene.effects.shake(0.14, 2);
      Game.chessBurst(scene, this.cx0, this.floor - 2, 12, this.pal, true);
    }
    if (this.t > 0.5) this.dead = true;
  }

  draw(ctx) {
    const x = Math.round(this.cx0);
    const floor = Math.round(this.floor);
    const k = Math.min(1, this.t / 0.08);
    const drop = Math.round((1 - k) * 70);
    const fade = this.t > 0.32 ? Math.max(0, 1 - (this.t - 0.32) / 0.18) : 1;
    ctx.save();
    ctx.globalAlpha *= fade;
    Game.drawPiece(ctx, 'rook', x, floor - drop, 2, 1, this.pal, this.landed && this.t < 0.14 ? 0.8 : 1);
    ctx.restore();
  }
};

// ============================================================================ XEQUE-MATE
/** A fileira de casas que corre pelo chão (a linha da torre). result: 'hit', 'blocked' ou null. */
Game.CheckLine = class CheckLine extends Game.Entity {
  constructor(owner) {
    super(owner.cx, 0, 16, 30);
    this.owner = owner;
    this.team = owner.team;
    this.facing = owner.facing;
    this.sourceX = owner.cx;
    this.x0 = owner.cx + owner.facing * 10;
    this.head = this.x0;
    this.t = 0;
    this.layer = 2.5;
    this.result = null;
    this.hitSet = new Set();
  }

  get floor() {
    return this.owner.groundY !== undefined ? this.owner.groundY : this.owner.feet;
  }

  update(dt, input, scene) {
    const c = Game.config.checkmate;
    this.t += dt;
    if (this.result) {
      if (this.t > 0.6) this.dead = true;
      return;
    }
    this.head += this.facing * c.lineSpeed * dt;
    const map = scene.map ? scene.map.pixelWidth : 9999;
    const r = { x: this.head - 8, y: this.floor - 30, w: 16, h: 30 };
    this.x = r.x;
    this.y = r.y;
    const res = scene.punch(r, Object.assign({}, c.check), this, this.hitSet);
    if (res) {
      this.result = res;
      this.t = 0;
      if (res === 'hit') Game.events.emit('check', { attacker: this.owner, target: this.owner.opponent });
      return;
    }
    if (Math.abs(this.head - this.x0) > c.lineRange || this.head < 6 || this.head > map - 6) {
      this.result = 'miss';
      this.t = 0.3;
    }
  }

  draw(ctx) {
    const floor = Math.round(this.floor);
    const sq = 16;
    const f = this.facing;
    const a = Math.min(this.x0, this.head);
    const b = Math.max(this.x0, this.head);
    const fade = this.result ? Math.max(0, 1 - this.t / 0.6) : 1;
    ctx.save();
    ctx.globalAlpha *= fade;
    // casas alternadas (claras e escuras) pelo caminho
    let i = 0;
    for (let x = this.x0; (x - this.head) * f <= 0; x += f * sq, i++) {
      const cx = Math.round(x + (f * sq) / 2);
      if (cx < a - sq || cx > b + sq) break;
      ctx.fillStyle = i % 2 ? '#3a1f2e' : '#ffe0ea';
      ctx.fillRect(cx - sq / 2, floor - 2, sq, 2);
      ctx.fillStyle = i % 2 ? '#7a3a58' : '#ff9ec0';
      ctx.fillRect(cx - sq / 2 + 2, floor - 3, sq - 4, 1);
    }
    // a ponta: uma torre pequena deslizando
    if (!this.result) Game.drawPiece(ctx, 'rook', Math.round(this.head), floor, 1, f, Game.chessPalette(this.owner));
    ctx.restore();
  }
};

/**
 * O mate: o adversário fica preso na casa e as peças caem uma a uma em cima dele (torre de cima,
 * bispo na diagonal, cavalo em L) e a dama gigante fecha. done = acabou.
 */
Game.MateShow = class MateShow extends Game.Entity {
  constructor(owner, target) {
    super(0, 0, 24, 40);
    this.owner = owner;
    this.team = owner.team;
    this.target = target;
    this.facing = owner.facing;
    this.sourceX = owner.cx;
    this.t = 0;
    this.layer = 3.5;
    this.tx = target ? target.cx : owner.cx + owner.facing * 60;
    this.pal = Game.chessPalette(owner);
    this.step = 0;
    this.done = false;
    // [quando cai, peça, como chega, escala]
    this.seq = [[0.12, 'rook', 'top', 2], [0.42, 'bishop', 'diag', 2], [0.72, 'knight', 'L', 2], [1.15, 'queen', 'queen', 3]];
    this.x = this.tx - 12;
  }

  get floor() {
    return this.owner.groundY !== undefined ? this.owner.groundY : this.owner.feet;
  }

  update(dt, input, scene) {
    this.t += dt;
    const tg = this.target;
    const c = Game.config.checkmate;
    if (tg && this.step < this.seq.length && !tg.ko) {
      tg.vx = 0;
      tg.x = this.tx - tg.w / 2; // preso na casa
    }
    while (this.step < this.seq.length && this.t >= this.seq[this.step][0] + 0.12) {
      const [, name, , s] = this.seq[this.step];
      const last = this.step === this.seq.length - 1;
      const r = { x: this.tx - 11, y: this.floor - 36, w: 22, h: 36 };
      this.sourceX = this.owner.cx;
      const hit = Object.assign({}, last ? c.mate : c.pieces);
      scene.punch(r, hit, this);
      Game.chessBurst(scene, this.tx, this.floor - 4, last ? 22 : 10, this.pal, last);
      scene.effects.shake(last ? 0.35 : 0.1, last ? 4 : 2);
      if (last) {
        scene.flashScreen = Math.max(scene.flashScreen || 0, 0.14);
        scene.effects.ring(this.tx, this.floor - 20, '#ffd36b', 30);
        Game.events.emit('checkmate', { attacker: this.owner, target: tg });
      } else {
        Game.events.emit('matePiece', { attacker: this.owner, piece: name, scale: s });
      }
      this.step += 1;
    }
    // depois do impacto cada peça se desfaz em lascas (a dama fica mais)
    for (const piece of this.seq) {
      const [at, , , s] = piece;
      const end = at + 0.12 + (piece[1] === 'queen' ? 0.8 : 0.24);
      if (!piece.gone && this.t >= end) {
        piece.gone = true;
        Game.chessBurst(scene, this.tx, this.floor - 8 * s, 6 + s * 3, this.pal);
      }
    }
    if (this.t > 1.95) {
      this.done = true;
      this.dead = true;
    }
  }

  draw(ctx) {
    const floor = Math.round(this.floor);
    const x = Math.round(this.tx);
    // a casa do mate acesa embaixo do adversário
    Game.drawSquare(ctx, x, floor, 22, Math.min(1, this.t / 0.3), Math.floor(this.t * 14) % 2);
    for (const [at, name, how, s] of this.seq) {
      const t = this.t - at;
      if (t < 0) continue;
      const fall = 0.12;
      const k = Math.min(1, t / fall);
      const gone = name === 'queen' ? 0.8 : 0.24; // depois do impacto se desfaz em lascas
      if (t > fall + gone) continue;
      const fade = name === 'queen' && t > fall + gone - 0.12 ? Math.max(0, (fall + gone - t) / 0.12) : 1;
      let px = x;
      let py = floor;
      const back = -this.facing;
      if (how === 'top') py = floor - Math.round((1 - k) * 90);
      else if (how === 'diag') {
        px = x + Math.round(back * (1 - k) * 70);
        py = floor - Math.round((1 - k) * 70);
      } else if (how === 'L') {
        // cavalo: sobe e vem de lado (o L), depois desce
        const kk = k < 0.5 ? k * 2 : 1;
        const kd = k < 0.5 ? 0 : (k - 0.5) * 2;
        px = x + Math.round(back * (1 - kk) * 40);
        py = floor - Math.round(40 * (1 - kd));
      } else if (how === 'queen') {
        // a dama desce devagar do alto, brilhando
        const kq = Math.min(1, t / 0.12);
        py = floor - Math.round((1 - kq * kq) * 110);
      }
      // brilho em volta (a dama piscando antes do impacto)
      const pre = name === 'queen' && t < fall;
      ctx.save();
      ctx.globalAlpha *= fade;
      // as peças da dupla cena (sobre o adversário) ficam um pouco atrás da dama
      const squash = k >= 1 && t < fall + 0.05 ? 0.85 : 1;
      if (pre) Game.drawPiece(ctx, name, px, py, s, this.facing, 'glow');
      else Game.drawPiece(ctx, name, px, py, s, how === 'L' ? -back : this.facing, this.pal, squash);
      ctx.restore();
    }
  }
};

Object.assign(Game.Supers, {
  checkmate: {
    update(f, dt, scene) {
      const d = f.superData;
      d.t += dt;
      if (d.phase === 'start') {
        d.phase = 'line';
        d.t = 0;
        d.line = scene.add(new Game.CheckLine(f));
        Game.events.emit('checkLine', { fighter: f });
      }
      if (d.phase === 'line') {
        f.vx = 0;
        const L = d.line;
        if (L.result === 'hit') {
          d.phase = 'mate';
          d.t = 0;
          d.show = scene.add(new Game.MateShow(f, f.opponent));
          f.play('mateCall', true);
        } else if (L.result) {
          d.phase = 'end';
          d.t = 0;
          f.play('guard', true);
        }
      } else if (d.phase === 'mate') {
        f.vx = 0;
        if (d.show.done || d.t > 2.4) f.finishSuper(0.1);
      } else if (d.phase === 'end') {
        if (d.t > 0.28) f.finishSuper(0.16);
      }
    },
  },
});

// ============================================================================ golpes do Tabuleiro Infinito
Object.assign(Game.STRIKE_KINDS, {
  // peça gigante caindo na casa marcada (acerto garantido) · eco: peãozinho brotando do chão
  chessDrop: { from: 'sky', w: 22, h: 40, linger: 0.34, sound: 'chessDrop', colors: ['#ffffff', '#ffe0ea', '#ff7fa8', '#3a1f2e'] },
  pawnPop: { from: 'ground', w: 10, h: 16, linger: 0.24, sound: 'pawnPop', colors: ['#fff3f6', '#f2bccb', '#d28aa2', '#3a1f2e'] },
});

Game.CHESS_DROP_PIECES = ['rook', 'bishop', 'knight', 'queen', 'king'];

Game.STRIKE_DRAW.chessDrop = function (ctx, x, floor, life) {
  const name = Game.CHESS_DROP_PIECES[this.seed % Game.CHESS_DROP_PIECES.length];
  const k = Math.min(1, this.t / 0.05);
  const drop = Math.round((1 - k) * 60);
  const fade = life > 0.6 ? 1 - (life - 0.6) / 0.4 : 1;
  ctx.save();
  ctx.globalAlpha *= Math.max(0, fade);
  Game.drawPiece(ctx, name, x, floor - drop, this.small ? 1 : 2, this.facing || 1, Game.chessPalette(this.owner), k >= 1 && this.t < 0.09 ? 0.85 : 1);
  ctx.restore();
};

Game.STRIKE_WARN.chessDrop = function (ctx, x, floor, p, blink) {
  // a casa embaixo do alvo acende e a sombra da peça cresce
  Game.drawSquare(ctx, x, floor, 20, p, blink);
  const half = Math.round(3 + 7 * p);
  ctx.fillStyle = 'rgba(20, 8, 16, 0.35)';
  ctx.fillRect(x - half, floor - 1, half * 2 + 1, 1);
};

Game.STRIKE_DRAW.pawnPop = function (ctx, x, floor, life) {
  const h = Game.pieceSize('pawn').h;
  const k = Math.min(1, this.t / 0.05);
  const fade = life > 0.6 ? Math.max(0, 1 - (life - 0.6) / 0.4) : 1;
  ctx.save();
  ctx.globalAlpha *= fade;
  ctx.beginPath();
  ctx.rect(x - 8, floor - h - 4, 16, h + 4);
  ctx.clip();
  Game.drawPiece(ctx, 'pawn', x, floor + Math.round(h * (1 - k)), 1, this.facing || 1, Game.chessPalette(this.owner));
  ctx.restore();
};

Game.STRIKE_WARN.pawnPop = function (ctx, x, floor, p, blink) {
  Game.drawSquare(ctx, x, floor, 12, p * 0.5, blink);
};
