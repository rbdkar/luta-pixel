/*
 * Npc: personagem que apanha. IA básica (máquina de estados):
 *   idle   → parado; depois de um tempo sai andando
 *   walk   → passeia; vira em paredes, caixas e beiradas
 *   alert  → percebeu o jogador por perto: para, olha e mostra o "!"
 *   flee   → foge do jogador por alguns segundos (se encurralado, para e encara)
 *   hurt   → reação ao soco: leve (jab) ou forte (direto, dobra de dor)
 *   airborne → nocauteado: voa para trás
 *   down   → cai e fica no chão; getup → levanta e foge
 * Ele não ataca. No chão e levantando não pode ser atingido.
 */
window.Game = window.Game || {};

Game.Npc = class Npc extends Game.Entity {
  constructor(x, y) {
    const cfg = Game.config.npc;
    super(x, y, cfg.hitbox.w, cfg.hitbox.h);
    this.cfg = cfg;
    this.spawn = { x, y };
    this.sheet = new Game.SpriteSheet(Game.sprites.npc);
    this.anim = new Game.Animator(Game.sprites.npc);
    this.facing = Math.random() < 0.5 ? -1 : 1;
    this.hp = cfg.maxHp;
    this.sinceHit = Infinity;
    this.flash = 0;
    this.alertCooldown = 0;
    this.airTime = 0;
    this.enter('idle', this.rand(cfg.idleTime));
  }

  rand([min, max]) {
    return min + Math.random() * (max - min);
  }

  enter(state, time = 0) {
    this.state = state;
    this.timer = time;
    const anim = { idle: 'idle', walk: 'walk', flee: 'walk', alert: 'alert', getup: 'getup' }[state];
    if (anim) this.anim.play(anim, state === 'getup');
  }

  dirTo(other) {
    return other.x + other.w / 2 < this.x + this.w / 2 ? -1 : 1;
  }

  /** Parede/caixa logo à frente ou beirada sem chão: hora de virar. */
  blockedAhead(map) {
    const ts = map.tileSize;
    const frontX = this.facing > 0 ? this.x + this.w + 2 : this.x - 2;
    const col = Math.floor(frontX / ts);
    const wall = map.anySolid(col, Math.floor(this.y / ts), col, Math.floor((this.y + this.h - 1) / ts));
    const ground = map.isSolid(col, Math.floor((this.y + this.h + 2) / ts));
    return wall || !ground;
  }

  /** Se o jogador chegar perto, leva um susto. */
  watchFor(player) {
    if (this.alertCooldown > 0 || !player) return;
    const dx = player.x + player.w / 2 - (this.x + this.w / 2);
    const dy = player.y + player.h - (this.y + this.h);
    if (Math.abs(dx) < this.cfg.noticeRange && Math.abs(dy) < 24) {
      this.facing = dx < 0 ? -1 : 1;
      this.vx = 0;
      this.enter('alert', this.cfg.alertTime);
      Game.events.emit('alert');
    }
  }

  startFlee(player) {
    if (player) this.facing = -this.dirTo(player);
    this.enter('flee', this.rand(this.cfg.fleeTime));
  }

  update(dt, input, scene) {
    const c = this.cfg;
    const map = scene.map;
    const player = scene.player;
    this.flash = Math.max(0, this.flash - dt);
    this.alertCooldown -= dt;
    this.sinceHit += dt;
    this.timer -= dt;
    const vulnerableState = this.state !== 'airborne' && this.state !== 'down' && this.state !== 'getup';
    if (vulnerableState && this.sinceHit > c.recoverDelay) this.hp = c.maxHp;

    let targetVx = null; // null = só atrito (empurrões dos socos)
    switch (this.state) {
      case 'idle':
        targetVx = 0;
        if (this.timer <= 0) {
          if (Math.random() < 0.35) this.facing *= -1;
          this.enter('walk', this.rand(c.walkTime));
        }
        this.watchFor(player);
        break;
      case 'walk':
        targetVx = this.facing * c.walkSpeed;
        if (this.blockedAhead(map)) {
          this.facing *= -1;
          this.enter('idle', this.rand(c.idleTime));
          targetVx = 0;
        } else if (this.timer <= 0) {
          this.enter('idle', this.rand(c.idleTime));
        }
        this.watchFor(player);
        break;
      case 'alert':
        targetVx = 0;
        if (this.timer <= 0) this.startFlee(player);
        break;
      case 'flee':
        targetVx = this.facing * c.fleeSpeed;
        if (this.blockedAhead(map) || this.timer <= 0) {
          // encurralado ou cansou de fugir: para e encara o jogador
          if (player && this.blockedAhead(map)) this.facing = this.dirTo(player);
          this.alertCooldown = c.alertCooldown;
          this.enter('idle', this.rand(c.idleTime));
          targetVx = 0;
        }
        break;
      case 'hurt':
        if (this.anim.finished) {
          this.alertCooldown = 0;
          this.startFlee(player);
        }
        break;
      case 'airborne':
        this.airTime += dt;
        if (this.anim.name === 'knock' && this.airTime > 0.08) this.anim.play('fly', true);
        break;
      case 'down':
        if (this.anim.finished) {
          if (this.anim.name === 'land') this.anim.play('lie', true);
          else this.enter('getup');
        }
        break;
      case 'getup':
        if (this.anim.finished) {
          this.hp = c.maxHp;
          this.alertCooldown = 0;
          this.startFlee(player);
        }
        break;
    }

    if (targetVx !== null) {
      const step = c.accel * dt;
      this.vx = Math.abs(targetVx - this.vx) <= step ? targetVx : this.vx + Math.sign(targetVx - this.vx) * step;
    } else if (this.onGround) {
      const step = c.groundFriction * dt;
      this.vx = Math.abs(this.vx) <= step ? 0 : this.vx - Math.sign(this.vx) * step;
    }

    const physics = Game.config.physics;
    this.vy = Math.min(this.vy + physics.gravity * dt, physics.maxFallSpeed);
    this.moveAndCollide(dt, map);

    // Pousou depois do nocaute
    if (this.state === 'airborne' && this.onGround && this.airTime > 0.12) {
      this.state = 'down';
      this.vx *= 0.35;
      this.anim.play('land', true);
      const fx = scene.effects;
      fx.burst(this.x + this.w / 2, this.y + this.h, ['#ece6d6', '#c8bfa9', '#a89f8a'], 10, { speed: 120, lift: 70 });
      fx.shake(0.1, 1);
      Game.events.emit('land');
    }

    // Animação: andar acompanha a velocidade
    const walking = this.state === 'walk' || this.state === 'flee';
    const rate = walking ? Math.max(0.6, Math.abs(this.vx) / c.walkSpeed) : 1;
    this.anim.update(dt * rate);

    // Caiu para fora do mapa: volta para onde nasceu
    if (this.y > map.pixelHeight + 64) {
      Object.assign(this, { x: this.spawn.x, y: this.spawn.y, vx: 0, vy: 0, hp: c.maxHp });
      this.savePrev();
      this.enter('idle', 1);
    }
  }

  /** Chamado por scene.punch. Retorna true se o golpe valeu. */
  onHit(hit, from, scene) {
    if (this.state === 'airborne' || this.state === 'down' || this.state === 'getup') return false;
    const c = this.cfg;
    this.facing = this.dirTo(from);          // vira para quem bateu
    this.hp -= 1;                             // o boneco conta golpes, não pontos de vida
    if (hit.launch) this.hp = 0;              // golpes de finalização derrubam na hora
    this.sinceHit = 0;
    this.flash = c.flashTime;
    if (this.hp <= 0) {
      this.state = 'airborne';
      this.airTime = 0;
      this.vx = -this.facing * c.launch.vx;  // voa para trás, longe de quem bateu
      this.vy = -c.launch.vy;
      this.onGround = false;
      this.anim.play('knock', true);
      scene.effects.freeze(0.1);
      scene.effects.shake(0.2, 2);
      Game.events.emit('knockdown', { target: this });
    } else {
      this.state = 'hurt';
      this.vx = -this.facing * (hit.knockback || 60);
      this.anim.play(hit.heavy ? 'hurtHeavy' : 'hurtLight', true);
    }
    return true;
  }

  draw(ctx, renderer, alpha = 1) {
    const def = this.sheet.def;
    const p = this.lerpPos(alpha);
    const x = renderer.snap(p.x + this.w / 2 - def.anchor.x);
    const y = renderer.snap(p.y + this.h - def.anchor.y);
    this.sheet.draw(ctx, this.anim.frame, x, y, this.facing < 0, this.flash > 0);
  }
};
