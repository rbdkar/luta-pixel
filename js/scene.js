/*
 * Scene: junta uma fase (mapa + fundo), as entidades, a câmera e os efeitos.
 *
 *   mode 'training'  fase de plataforma com bonecos e caixas (o jogador é um Fighter)
 *   mode 'fight'     arena: dois lutadores (adicionados pelo Game.Fight), que se
 *                    empurram, não se afastam além da tela e dividem a câmera
 *
 * Para novas mecânicas, crie entidades e adicione com scene.add(entidade).
 * Entidades com dead = true saem da cena no fim do passo.
 */
window.Game = window.Game || {};

Game.Scene = class Scene {
  constructor(level, opts = {}) {
    this.level = level;
    this.mode = opts.mode || (level.fight ? 'fight' : 'training');
    this.look = opts.look || null;
    this.map = new Game.TileMap(level, this.look);
    this.background = level.background ? Game.assets.get(level.background) : null;
    this.backColor = (opts.stage && opts.stage.color) || '#0b1322';
    this.camera = new Game.Camera();
    this.cameraReady = false;
    this.effects = new Game.Effects();
    this.entities = [];
    this.fighters = [];
    this.locked = false; // true = ninguém controla nem acerta golpes (fim de round)
    this.player = null;
    this.cinematic = null; // pose do super: tudo para, a tela escurece
    this.darkFade = 0;
    this.domain = null;    // Expansão de Domínio ativa (js/domains.js)
    this.flashScreen = 0;  // clarão de raio
    this.timeStop = null;  // Parada do Tempo (super da Ampulheta): só a dona do tempo se mexe
    this.showHitboxes = false;
    this.layers = (opts.stage && opts.stage.layers) || [];

    if (this.mode === 'fight') {
      // chão da arena: primeira linha sólida no meio do mapa
      const ts = this.map.tileSize;
      this.floorY = this.map.surfaceRow(Math.floor(this.map.width / 2)) * ts;
      return;
    }

    // Treino: jogador no "P" e personagens marcados no mapa (ex.: "N" = Npc)
    const ts = this.map.tileSize;
    const hb = Game.config.player.hitbox;
    this.spawnPoint = {
      x: this.map.spawn.col * ts + ts / 2 - hb.w / 2,
      y: (this.map.spawn.row + 1) * ts - hb.h, // pés no chão da célula do "P"
    };
    const saved = opts.saved || {};
    const savedChar = saved.player && Game.characters[saved.player.char] ? saved.player.char : null;
    this.player = new Game.Fighter(this.spawnPoint.x, this.spawnPoint.y, savedChar || opts.character, { mode: 'training', team: 1 });
    for (const s of this.map.entitySpawns) {
      const Cls = Game[s.className];
      if (!Cls) throw new Error('Classe Game.' + s.className + ' não foi carregada (confira os <script> no index.html).');
      const e = new Cls(0, 0);
      e.x = s.col * ts + ts / 2 - e.w / 2;
      e.y = (s.row + 1) * ts - e.h;
      e.spawn = { x: e.x, y: e.y };
      this.entities.push(e);
    }
    this.entities.push(this.player);
    if (saved.player) this.restorePlayer(saved.player);
  }

  add(entity) {
    this.entities.push(entity);
    if (entity.savePrev) entity.savePrev();
    return entity;
  }

  /** Coloca os dois lutadores na arena (modo luta). */
  setFighters(a, b) {
    this.entities = this.entities.filter((e) => !(e instanceof Game.Fighter));
    a.opponent = b;
    b.opponent = a;
    a.groundY = this.floorY;
    b.groundY = this.floorY;
    this.fighters = [a, b];
    this.entities.push(a, b);
  }

  /** Começo de round: lutadores no meio da arena, sem projéteis nem efeitos. */
  resetRound() {
    const [a, b] = this.fighters;
    const mid = this.map.pixelWidth / 2;
    const gap = Game.config.fight.startGap / 2;
    a.placeAt(mid - gap, this.floorY);
    b.placeAt(mid + gap, this.floorY);
    a.facing = 1;
    b.facing = -1;
    this.entities = this.entities.filter((e) => e instanceof Game.Fighter);
    this.effects.clear();
    this.locked = true;
    this.cinematic = null;
    this.darkFade = 0;
    this.domain = null;
    this.flashScreen = 0;
    this.timeStop = null;
    this.cameraReady = false;
  }

  /** Parada do Tempo: por "time" segundos só "owner" se mexe. */
  stopTime(owner, time) {
    this.timeStop = { owner, t: 0, dur: time, debt: 0, hits: 0 };
    this.effects.ring(owner.cx, owner.feet - 16, '#ffffff', 30);
    Game.events.emit('timeStop', { owner });
  }

  /** O tempo volta: o dano guardado cai de uma vez em quem estava parado. */
  resumeTime() {
    const ts = this.timeStop;
    if (!ts) return;
    this.timeStop = null;
    for (const f of this.fighters) {
      if (f === ts.owner) continue;
      // botões apertados com o tempo parado não valem
      const inp = f.controller || f.lastInput;
      if (inp && inp.clearPresses) inp.clearPresses();
      else if (inp && inp.presses) inp.presses = {};
      if (f.inputBuf) f.inputBuf.t = {};
    }
    const foe = ts.owner.opponent;
    Game.events.emit('timeResume', { owner: ts.owner, debt: ts.debt });
    if (foe && ts.debt > 0 && !foe.ko && !this.locked) {
      const hit = { damage: ts.debt, knockback: 230, heavy: true, launch: true, special: true, super: true, unblockable: true, timeDebt: true };
      this.punch({ x: foe.x - 1, y: foe.y - 1, w: foe.w + 2, h: foe.h + 2 }, hit, ts.owner);
      this.flashScreen = Math.max(this.flashScreen, 0.2);
      this.effects.ring(foe.cx, foe.feet - 14, '#fff1b8', 26);
      this.effects.shake(0.3, 3);
    }
  }

  /**
   * Quanto do tempo de cada passo uma entidade recebe: dentro da Bolha do Tempo (do
   * outro time) e no Deserto do Tempo o adversário fica em câmera lenta.
   */
  timeScaleFor(e) {
    const team = e.team || (e.owner && e.owner.team) || 0;
    if (!team) return 1;
    let k = 1;
    for (const b of this.entities) {
      if (b instanceof Game.TimeBubble && !b.dead && b.team !== team && b.contains(e)) {
        k *= b.scale;
        break;
      }
    }
    const dom = this.domain;
    if (dom && dom.def.slowFoe && dom.owner.inDomain && team !== dom.owner.team) k *= dom.def.slowFoe;
    return k;
  }

  /**
   * Começa a pose do super: a tela escurece e só quem soltou o super se mexe (anima).
   * opts.domain: sinal de mão da Expansão de Domínio (mais longo e mais escuro).
   */
  startCinematic(user, opts = {}) {
    const t = opts.time || Game.config.fight.superFreeze;
    const color = opts.color || (user.shadow ? '#b47cff' : user.char.color);
    this.cinematic = { t, total: t, user, domain: !!opts.domain, color };
    this.effects.ring(user.cx, user.feet - 16, '#ffffff', 22);
    this.effects.burst(user.cx, user.feet - 16, ['#ffffff', '#fff3b0', color], 22, { speed: 160, lift: 120, gravity: 0 });
  }

  update(dt, input, view) {
    for (const e of this.entities) if (e.savePrev) e.savePrev();
    this.camera.savePrev();
    this.effects.update(dt);
    this.map.update(dt);
    if (this.darkFade > 0) this.darkFade = Math.max(0, this.darkFade - dt);
    this.flashScreen = Math.max(0, this.flashScreen - dt);
    if (this.cinematic) {
      const c = this.cinematic;
      c.t -= dt;
      c.user.anim.update(dt);
      c.user.aura = Math.max(c.user.aura, 0.05);
      if (c.domain) {
        // energia do domínio sendo puxada para o lutador
        for (let i = 0; i < 2; i++) {
          const a = Math.random() * Math.PI * 2;
          const d = 30 + Math.random() * 40;
          this.effects.burst(c.user.cx + Math.cos(a) * d, c.user.feet - 16 + Math.sin(a) * d * 0.7, ['#ffffff', c.color], 1,
            { speed: 10, lift: 0, gravity: 0 });
        }
        if (c.t < 0.25 && !c.pulsed) {
          c.pulsed = true;
          this.effects.ring(c.user.cx, c.user.feet - 16, c.color, 30);
        }
      } else if (Math.random() < 0.5) {
        const a = Math.random() * Math.PI * 2;
        this.effects.burst(c.user.cx + Math.cos(a) * 18, c.user.feet - 16 + Math.sin(a) * 14, ['#ffffff', '#fff3b0'], 1, { speed: 20, lift: 10, gravity: 0 });
      }
      if (c.t <= 0) {
        this.cinematic = null;
        this.darkFade = c.domain ? 0.15 : 0.3;
      }
      return;
    }
    // embate de domínios: tudo parado, só contam os botões
    if (this.domain && this.domain.clash) {
      this.domain.updateClash(dt, input, this);
      return;
    }
    if (this.hitFlashes) this.hitFlashes = this.hitFlashes.filter((f) => (f.t -= dt) > 0);
    // Hit-stop: no instante do acerto tudo para por alguns centésimos de segundo
    if (this.effects.freezeLeft > 0) {
      this.effects.freezeLeft -= dt;
      return;
    }
    const ts = this.timeStop;
    if (ts) {
      ts.t += dt;
      if (ts.t >= ts.dur || ts.owner.ko || this.locked) this.resumeTime();
    }
    for (const e of this.entities.slice()) {
      if (e.dead) continue;
      // tempo parado: só a dona do tempo se mexe (o resto fica congelado no ar)
      if (this.timeStop && e !== this.timeStop.owner) continue;
      const k = this.fighters.length === 2 ? this.timeScaleFor(e) : 1;
      e.update(dt * k, input, this);
    }
    this.entities = this.entities.filter((e) => !e.dead);
    if (this.domain) this.domain.update(dt, this);
    if (this.fighters.length === 2) {
      this.pushApart(this.fighters[0], this.fighters[1]);
      this.applyGates();
      this.keepOnScreen(this.fighters[0], this.fighters[1], view);
    } else if (this.player && this.player.y > this.map.pixelHeight + 64) {
      this.respawn(); // segurança: se algo tirar o jogador do mapa, ele volta ao início
    }
    this.followCamera(view, dt);
  }

  /** Os corpos não se atravessam: quem anda empurra o outro (as paredes seguram). */
  pushApart(a, b) {
    const vertical = a.y < b.y + b.h - 3 && b.y < a.y + a.h - 3;
    if (!vertical) return; // um passando por cima do outro no pulo
    const overlap = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
    if (overlap <= 0) return;
    let side = Math.sign(a.cx - b.cx); // para onde "a" vai
    if (side === 0) side = a.facing > 0 ? -1 : 1;
    const maxX = this.map.pixelWidth;
    let da = overlap / 2;
    let db = overlap / 2;
    // contra a parede: o outro leva o empurrão inteiro
    const roomA = side < 0 ? a.x : maxX - (a.x + a.w);
    const roomB = side < 0 ? maxX - (b.x + b.w) : b.x;
    if (roomA < da) {
      db += da - roomA;
      da = roomA;
    } else if (roomB < db) {
      da += db - roomB;
      db = roomB;
    }
    a.x += side * da;
    b.x -= side * db;
  }

  /**
   * Portões de ferro do Soldador: o adversário não atravessa (pulando dá para passar
   * por cima). Se o portão segurar o adversário colado no Soldador, quem cede é o Soldador.
   */
  applyGates() {
    const gates = this.entities.filter((e) => e instanceof Game.IronGate && e.solid);
    if (!gates.length) return;
    const maxX = this.map.pixelWidth;
    for (const g of gates) {
      for (const f of this.fighters) g.block(f, maxX);
    }
    const [a, b] = this.fighters;
    const overlap = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
    const vertical = a.y < b.y + b.h - 3 && b.y < a.y + a.h - 3;
    if (overlap > 0 && vertical) {
      const owner = gates[0].owner;
      const other = owner === a ? b : a;
      const side = Math.sign(owner.cx - other.cx) || -owner.facing;
      owner.x = Math.max(0, Math.min(maxX - owner.w, owner.x + side * overlap));
    }
  }

  /** Os dois sempre cabem na tela: quem tenta se afastar além disso fica preso na borda. */
  keepOnScreen(a, b, view) {
    const cfg = Game.config.fight;
    const maxSep = view.w - cfg.screenMargin * 2 - a.w;
    const d = b.cx - a.cx;
    const excess = Math.abs(d) - maxSep;
    if (excess <= 0) return;
    const s = Math.sign(d) || 1; // b está à direita de a quando s > 0
    let wa = a.vx * -s > 0 ? 1 : 0; // a está se afastando?
    let wb = b.vx * s > 0 ? 1 : 0;
    if (!wa && !wb) wa = wb = 1;
    const ta = excess * wa / (wa + wb);
    const tb = excess * wb / (wa + wb);
    a.x += s * ta;
    b.x -= s * tb;
    if (wa && a.vx * -s > 0) a.vx = 0;
    if (wb && b.vx * s > 0) b.vx = 0;
  }

  /**
   * Aplica um golpe na área rect (pixels do mundo). Acerta entidades que tenham
   * onHit(hit, from, scene) e blocos quebráveis. already (opcional) guarda quem já
   * levou este golpe, para golpes que varrem a área por vários quadros (investida).
   * Retorna 'hit', 'blocked' (defendido) ou false (não acertou nada).
   */
  punch(rect, hit, attacker, already = null) {
    if (this.locked) return false;
    if (this.showHitboxes) this.flashRect(rect);
    const fx = this.effects;
    const stop = Game.config.fight.hitStop;
    const meter = Game.config.fight.meter;
    const owner = attacker.owner || attacker; // projétil/raio: a barra vai para quem lançou
    if (this.domain) hit = this.domain.modifyHit(hit, owner); // dentro do domínio os golpes mudam
    // Armadura de Carvalho Sagrado: na forma de armadura os golpes saem mais fortes
    if (owner.armor && hit.damage > 0 && !hit.echo && !hit.sure && !hit.timeDebt) {
      hit = Object.assign({}, hit, { damage: Math.max(1, Math.round(hit.damage * Game.config.armor.power)) });
    }
    const ts = this.map.tileSize;
    const dir = attacker.facing;
    const midY = rect.y + rect.h / 2;
    let result = false;
    let sparkX = dir > 0 ? rect.x + rect.w : rect.x;

    for (const e of this.entities) {
      if (e === attacker || !e.onHit || (already && already.has(e))) continue;
      const overlaps = rect.x < e.x + e.w && rect.x + rect.w > e.x && rect.y < e.y + e.h && rect.y + rect.h > e.y;
      if (!overlaps) continue;
      const res = e.onHit(hit, attacker, this);
      if (!res) continue;
      if (already) already.add(e);
      // faísca no lado do corpo virado para quem bateu
      sparkX = dir > 0 ? Math.max(rect.x, e.x) : Math.min(rect.x + rect.w, e.x + e.w);
      if (attacker.sourceX !== undefined) sparkX = e.x + e.w / 2 - dir * (e.w / 2);
      if (res === 'blocked') {
        if (!result) result = 'blocked';
        if (!hit.super && owner.addMeter) owner.addMeter(meter.blocked);
        if (e.addMeter) e.addMeter(meter.blocking);
        Game.events.emit('block', { target: e, attacker });
      } else {
        result = 'hit';
        if (!hit.super && !hit.echo && owner.addMeter) owner.addMeter(hit.damage * meter.dealt);
        if (e.addMeter) e.addMeter(hit.damage * meter.taken);
        Game.events.emit('hit', {
          heavy: !!hit.heavy, target: e, attacker, owner, combo: e.comboTaken || 0, src: Game.hitSource(attacker),
          special: !!hit.special, super: !!hit.super, timeDebt: !!hit.timeDebt,
        });
        if (this.domain && e instanceof Game.Fighter) this.domain.onOwnerHit(e, hit, attacker, owner, this);
        // Bolha do Tempo: cada golpe da dona em quem está lá dentro gasta a bolha
        for (const b of this.entities) {
          if (b instanceof Game.TimeBubble && !b.dead && b.owner === owner && e instanceof Game.Fighter && b.contains(e)) b.struck(this);
          // Bomba-relógio: quem está com ela acertou o outro, a bomba passa para ele
          if (b instanceof Game.TimeBomb && !b.dead && b.carrier === owner && e instanceof Game.Fighter && e !== owner && !hit.timebomb) b.pass(e, this);
        }
      }
    }

    const c0 = Math.floor(rect.x / ts);
    const c1 = Math.floor((rect.x + rect.w - Game.EPS) / ts);
    const r0 = Math.floor(rect.y / ts);
    const r1 = Math.floor((rect.y + rect.h - Game.EPS) / ts);
    let wallX = null;
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const key = 'tile:' + c + ',' + r;
        if (already && already.has(key)) continue;
        const face = dir > 0 ? c * ts : (c + 1) * ts; // lado do bloco virado para quem bateu
        const cell = this.map.damageCell(c, r, hit.breakPower || 1);
        if (cell) {
          result = 'hit';
          if (already) already.add(key);
          sparkX = face;
          const cx = c * ts + ts / 2;
          const cy = r * ts + ts / 2;
          if (cell.broken) fx.burst(cx, cy, cell.type.debris, 14, { dirX: dir, speed: 110, lift: 170 });
          else fx.burst(face, midY, cell.type.debris, 4, { dirX: -dir, speed: 70, lift: 110 });
          Game.events.emit(cell.broken ? 'break' : 'crack');
        } else if (this.map.isSolid(c, r) && wallX === null && r < this.map.height && c >= 0 && c < this.map.width) {
          wallX = face;
        }
      }
    }

    if (result === 'hit') {
      fx.spark(sparkX, midY, hit.heavy ? 'heavy' : 'hit');
      fx.freeze(hit.stop ? stop[hit.stop] : hit.heavy ? stop.heavy : stop.light);
      fx.shake(Game.config.effects.shakeTime, hit.heavy ? 2 : 1);
    } else if (result === 'blocked') {
      fx.spark(sparkX, midY, 'block');
      fx.freeze(hit.stop ? stop[hit.stop] : stop.block);
    } else if (wallX !== null && !(already && already.has('wall'))) {
      if (already) already.add('wall');
      fx.burst(wallX, midY, ['#ece6d6', '#c8bfa9'], 3, { dirX: -dir, speed: 50, lift: 60 });
      Game.events.emit('thud');
    }
    return result;
  }

  followCamera(view, dt, instant = !this.cameraReady) {
    if (this.fighters.length === 2) {
      this.camera.frameFight(this.fighters[0], this.fighters[1], view, { w: this.map.pixelWidth, h: this.map.pixelHeight }, this.floorY, instant);
    } else if (this.player) {
      this.camera.follow(this.player, view, { w: this.map.pixelWidth, h: this.map.pixelHeight }, dt, instant);
    } else {
      // arena vazia (fundo do menu): centralizada
      this.camera.x = (this.map.pixelWidth - view.w) / 2;
      this.camera.y = (this.floorY || this.map.pixelHeight) - view.h * Game.config.fight.floorLine;
      this.camera.snapPrev();
    }
    this.cameraReady = true;
  }

  draw(renderer, alpha = 1) {
    const ctx = renderer.ctx;
    renderer.setBackground(this.background, this.look, this.backColor);
    renderer.clear();
    renderer.beginWorld(this.camera, this.effects.offset, alpha);
    const view = renderer.visibleRect();
    const dom = this.domain;
    // domínio cobrindo a tela toda: a arena nem precisa ser desenhada
    if (!(dom && dom.covers())) {
      // camadas do cenário com paralaxe (mais longe = anda menos com a câmera)
      if (this.layers.length) this.drawLayers(renderer);
      this.map.draw(ctx, view);
    }
    if (dom) dom.drawBack(ctx, view, this);
    // super: escurece o cenário (os lutadores ficam claros por cima); o domínio escurece mais
    const c = this.cinematic;
    const full = c && c.domain ? 0.86 : 0.62;
    const dark = c ? (c.domain ? full * Math.min(1, (c.total - c.t) / 0.2) : full) : this.darkFade > 0 ? 0.62 * (this.darkFade / 0.3) : 0;
    if (dark > 0) {
      ctx.fillStyle = 'rgba(4, 6, 14, ' + dark.toFixed(3) + ')';
      ctx.fillRect(view.x - 4, view.y - 4, view.w + 8, view.h + 8);
    }
    // camadas: bonecos (0), lutadores (1; quem ataca fica por cima: 2), projéteis (3), raios (4)
    const ordered = this.entities.slice().sort((a, b) => (a.layer || 0) - (b.layer || 0));
    for (const e of ordered) e.draw(ctx, renderer, alpha);
    if (dom) dom.drawFront(ctx, view);
    this.effects.draw(ctx);
    if (this.timeStop) Game.TimeFx.draw(ctx, view, this, renderer, alpha);
    if (this.flashScreen > 0) {
      ctx.fillStyle = 'rgba(255, 252, 230, ' + Math.min(0.5, this.flashScreen * 3).toFixed(3) + ')';
      ctx.fillRect(view.x - 4, view.y - 4, view.w + 8, view.h + 8);
    }
    if (this.showHitboxes) this.drawHitboxes(ctx, alpha);
    renderer.endWorld();
  }

  /** Imagens do cenário entre o céu e o chão; factor 0 = parada, 1 = anda com o mundo. */
  drawLayers(renderer) {
    const ctx = renderer.ctx;
    const r = renderer.visibleRect();
    for (const layer of this.layers) {
      const img = Game.assets.get(layer.image);
      // posição: centralizada na arena quando a câmera está no meio
      const mid = (this.map.pixelWidth - r.w) / 2;
      const shift = (r.x - mid) * (1 - layer.factor);
      const x = Math.round((this.map.pixelWidth - img.width) / 2 + shift);
      const y = Math.round((this.floorY || this.map.pixelHeight) - layer.bottom - img.height);
      ctx.drawImage(img, x, y);
      if (layer.fill) {
        // cor sólida embaixo da imagem até o chão (evita buraco se a camada for baixa)
        ctx.fillStyle = layer.fill;
        ctx.fillRect(x, y + img.height, img.width, layer.bottom + 2);
      }
    }
  }

  /** Treino: mostra as zonas de golpe (vermelho) e os corpos (verde). */
  flashRect(rect) {
    this.hitFlashes = this.hitFlashes || [];
    this.hitFlashes.push({ x: rect.x, y: rect.y, w: rect.w, h: rect.h, t: 0.12 });
  }

  drawHitboxes(ctx, alpha) {
    ctx.save();
    for (const e of this.entities) {
      if (!e.onHit && !(e instanceof Game.Projectile)) continue;
      const p = e.lerpPos ? e.lerpPos(alpha) : e;
      ctx.fillStyle = e instanceof Game.Projectile ? 'rgba(255, 90, 60, 0.35)' : 'rgba(90, 230, 120, 0.28)';
      ctx.fillRect(p.x, p.y, e.w, e.h);
      ctx.fillStyle = e instanceof Game.Projectile ? '#ff5a3c' : '#5ae678';
      ctx.fillRect(p.x, p.y, e.w, 1);
      ctx.fillRect(p.x, p.y + e.h - 1, e.w, 1);
      ctx.fillRect(p.x, p.y, 1, e.h);
      ctx.fillRect(p.x + e.w - 1, p.y, 1, e.h);
      // golpe em andamento: área que vai acertar
      if (e instanceof Game.Fighter && e.attack && e.attack.def.hit && !e.attack.hitDone) {
        const r = e.hitRect(e.attack.def.hit);
        ctx.fillStyle = 'rgba(255, 70, 70, 0.22)';
        ctx.fillRect(r.x, r.y, r.w, r.h);
      }
    }
    for (const f of this.hitFlashes || []) {
      ctx.fillStyle = 'rgba(255, 60, 60, 0.5)';
      ctx.fillRect(f.x, f.y, f.w, f.h);
      ctx.fillStyle = '#ff3b3b';
      ctx.fillRect(f.x, f.y, f.w, 1);
      ctx.fillRect(f.x, f.y + f.h - 1, f.w, 1);
      ctx.fillRect(f.x, f.y, 1, f.h);
      ctx.fillRect(f.x + f.w - 1, f.y, 1, f.h);
    }
    ctx.restore();
  }

  respawn() {
    Object.assign(this.player, { x: this.spawnPoint.x, y: this.spawnPoint.y, vx: 0, vy: 0 });
    this.player.savePrev();
  }

  /** Estado mínimo para continuar de onde parou (treino; usado ao republicar a página). */
  snapshot() {
    const p = this.player;
    if (!p) return null;
    return { player: { x: p.x, y: p.y, facing: p.facing, char: p.charKey } };
  }

  restorePlayer(data) {
    const p = this.player;
    if (typeof data.x !== 'number' || typeof data.y !== 'number') return;
    const prev = { x: p.x, y: p.y };
    p.x = data.x;
    p.y = data.y;
    const outside = p.x < 0 || p.x + p.w > this.map.pixelWidth || p.y > this.map.pixelHeight;
    if (outside || p.overlapsSolid(this.map)) {
      p.x = prev.x;
      p.y = prev.y;
      return;
    }
    p.facing = data.facing === -1 ? -1 : 1;
  }
};

/** Nome do golpe que acertou: o ataque do lutador (jab, kick, sweep...) ou o tipo do projétil/efeito. */
Game.hitSource = function (attacker) {
  if (!attacker) return null;
  if (attacker instanceof Game.Fighter) return attacker.attack ? attacker.attack.kind : attacker.state;
  if (attacker.kindName) return attacker.kindName;
  if (typeof attacker.kind === 'string') return attacker.kind;
  return attacker.constructor ? attacker.constructor.name : null;
};
