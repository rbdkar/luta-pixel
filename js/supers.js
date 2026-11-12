/*
 * Supers: golpes da barra de super. Cada um é um pequeno roteiro chamado a cada
 * passo enquanto o lutador está no estado 'super' (depois da pose com a tela
 * escurecida). Os golpes do super têm super: true: não enchem a barra, não dão
 * tontura e continuam acertando quem já está voando (malabarismo).
 *
 *   beam     Encapuzado  RAIO SOMBRIO     raio de energia que atravessa a tela
 *   rush     Garoto      RAJADA DE SOCOS  avança; se encostar, solta uma sequência de socos
 *   volley   Óculos      CHUVA DE LIVROS  5 livros seguidos, alternando alto e baixo
 *   inferno  Brasa       INFERNO          sobe girando em chamas, carregando o adversário
 *   blizzard Gélida      NEVASCA          onda de neve que prende, acerta várias vezes e congela
 *   thunder  Trovão      FÚRIA DO TROVÃO  seis raios seguidos em cima do adversário
 *   cage     Soldador    JAULA DE FERRO   uma jaula cai no adversário, é soldada e explode
 *   revoada  Corvo       REVOADA          bando de corvos atravessando a tela em cima do adversário
 *   timestop Ampulheta   PARADA DO TEMPO  só ela se mexe; o dano fica guardado e cai de uma vez
 *   supernova Órbita     SUPERNOVA        estrela arremessada vira buraco negro e explode
 *   domain   (todos)     sinal de mão da Expansão de Domínio (js/domains.js)
 *
 * Para criar um super: acrescente uma entrada aqui e aponte "super" do personagem
 * (characters.js) para ela.
 */
window.Game = window.Game || {};

Game.FIRE_COLORS = ['#fff1b8', '#ffd166', '#ff9a3c', '#ff5a1f', '#c8261b'];

Game.Supers = {
  beam: {
    update(f, dt, scene) {
      const d = f.superData;
      d.t += dt;
      f.vx = 0;
      if (d.phase === 'start') {
        d.phase = 'fire';
        f.play('beam', true);
        d.beam = scene.add(new Game.Beam(f));
        Game.events.emit('beam');
      } else if (d.phase === 'fire' && d.beam.dead) {
        d.phase = 'end';
        d.t = 0;
        f.play('guard', true);
      } else if (d.phase === 'end' && d.t > 0.2) {
        f.finishSuper(0.15);
      }
    },
  },

  rush: {
    update(f, dt, scene) {
      const d = f.superData;
      d.t += dt;
      if (d.phase === 'start') {
        d.phase = 'dash';
        d.t = 0;
        d.hitSet = new Set();
        f.anim.play('cross', true);
        f.anim.index = 1;
        Game.events.emit('dash', { fighter: f });
      }
      if (d.phase === 'dash') {
        f.vx = f.facing * 330;
        if (Math.floor(d.t * 40) % 2 === 0) scene.effects.burst(f.cx - f.facing * 6, f.feet - 4, ['#ece6d6', '#c8bfa9'], 1, { speed: 30, lift: 30 });
        const res = scene.punch(f.hitRect({ x: 0, y: -24, w: 20, h: 22 }), { damage: 3, knockback: 10, special: true, super: true }, f, d.hitSet);
        if (res) {
          d.phase = 'flurry';
          d.t = 0;
          d.count = 0;
          f.vx = 0;
          f.play('flurry', true);
        } else if (d.t > 0.38) {
          d.phase = 'end';
          d.t = 0;
          f.vx = 0;
          f.play('guard', true);
        }
      } else if (d.phase === 'flurry') {
        f.vx = f.facing * 18; // continua colado
        if (d.t >= 0.075) {
          d.t = 0;
          d.count += 1;
          const last = d.count >= 7;
          const hit = last
            ? { damage: 12, knockback: 230, heavy: true, launch: true, special: true, super: true }
            : { damage: 3, knockback: 14, special: true, super: true, stop: 'multi' };
          if (last) {
            f.anim.play('cross', true);
            f.anim.index = 1;
            f.vx = f.facing * 90;
          }
          scene.punch(f.hitRect({ x: -2, y: -24, w: 26, h: 22 }), hit, f);
          if (last) {
            d.phase = 'end';
            d.t = 0;
          }
        }
      } else if (d.phase === 'end') {
        f.vx *= 0.85;
        if (d.t > 0.32) f.finishSuper(0.12);
      }
    },
  },

  volley: {
    update(f, dt, scene) {
      const d = f.superData;
      d.t += dt;
      f.vx = 0;
      if (d.phase === 'start') {
        d.phase = 'throw';
        d.t = 0.12;
        d.count = 0;
      }
      if (d.phase === 'throw' && d.t >= 0.12) {
        d.t = 0;
        d.count += 1;
        f.play('toss', true);
        const heights = [-18, -9, -18, -9, -14];
        const y = heights[(d.count - 1) % heights.length];
        scene.add(new Game.Projectile(f.cx + f.facing * 18, f.feet + y, f.facing, f, 'superBook'));
        Game.events.emit('throw');
        if (d.count >= 5) {
          d.phase = 'end';
          d.t = 0;
        }
      } else if (d.phase === 'end' && d.t > 0.32) {
        f.finishSuper(0.12);
      }
    },
  },

  inferno: {
    update(f, dt, scene) {
      const d = f.superData;
      d.t += dt;
      if (d.phase === 'start') {
        d.phase = 'rise';
        d.t = 0;
        d.tick = 0;
        d.hits = 0;
        f.vy = -430;
        f.vx = f.facing * 45;
        f.onGround = false;
        f.invuln = 0.5;
        f.play('inferno', true);
        Game.events.emit('fireBig');
      }
      if (d.phase === 'rise') {
        scene.effects.burst(f.cx, f.feet - 6, Game.FIRE_COLORS, 3, { speed: 70, lift: 60, gravity: -120 });
        d.tick -= dt;
        if (d.tick <= 0 && d.hits < 7) {
          d.tick = 0.065;
          d.hits += 1;
          const last = d.hits === 7;
          const hit = last
            ? { damage: 12, knockback: 200, heavy: true, launch: true, special: true, super: true }
            : { damage: 4, knockback: 20, special: true, super: true, carry: true, stop: 'multi' };
          scene.punch(f.hitRect({ x: -6, y: -42, w: 28, h: 46 }), hit, f);
        }
        if (f.onGround && d.t > 0.12) {
          d.phase = 'end';
          d.t = 0;
          f.vx = 0;
          f.play('crouch', true);
          scene.effects.burst(f.cx, f.feet, Game.FIRE_COLORS, 16, { speed: 140, lift: 90 });
        }
      } else if (d.phase === 'end' && d.t > 0.3) {
        f.finishSuper(0);
      }
    },
  },
};

Object.assign(Game.Supers, {
  blizzard: {
    update(f, dt, scene) {
      const d = f.superData;
      d.t += dt;
      f.vx = 0;
      if (d.phase === 'start') {
        d.phase = 'cast';
        d.t = 0;
        f.play('blizzard', true);
      }
      if (d.phase === 'cast' && f.anim.index >= 1 && !d.wave) {
        d.wave = scene.add(new Game.BlizzardWave(f));
        Game.events.emit('blizzard');
      }
      // livre quando a neve terminou de prender (dá para emendar no congelado) ou passou
      const wave = d.wave;
      if (wave && d.t > 0.5 && (!wave.caught || wave.done || wave.dead)) f.finishSuper(0.08);
      else if (d.t > 2.2) f.finishSuper(0.1);
    },
  },

  thunder: {
    update(f, dt, scene) {
      const d = f.superData;
      d.t += dt;
      f.vx = 0;
      if (d.phase === 'start') {
        d.phase = 'call';
        d.t = 0;
        d.count = 0;
        f.play('boltCast', true);
        Game.events.emit('thunderCall');
      }
      if (d.phase === 'call' && d.t >= 0.16) {
        d.phase = 'strike';
        d.t = 0.12;
        f.anim.play('boltCast', true);
        f.anim.index = 1;
      }
      if (d.phase === 'strike' && d.t >= 0.12) {
        d.t = 0;
        d.count += 1;
        const o = f.opponent;
        const last = d.count >= 6;
        const hit = last
          ? { damage: 12, knockback: 180, heavy: true, launch: true, special: true, super: true }
          : { damage: 4, knockback: 15, special: true, super: true, stop: 'multi' };
        const x = o ? o.cx : f.cx + f.facing * 60;
        scene.add(new Game.Strike(f, 'bolt', x, { warn: 0, track: o, hit, big: last }));
        if (last) {
          d.phase = 'end';
          d.t = 0;
        }
      } else if (d.phase === 'end' && d.t > 0.4) {
        f.finishSuper(0.12);
      }
    },
  },

  cage: {
    update(f, dt, scene) {
      const d = f.superData;
      d.t += dt;
      f.vx = 0;
      if (d.phase === 'start') {
        d.phase = 'call';
        d.t = 0;
        f.play('superPose', true);
        d.cage = scene.add(new Game.IronCage(f, f.opponent));
      }
      // solda de longe com o maçarico apontado para a jaula
      if (d.cage && d.cage.phase === 'weld') f.play('weldPose');
      if (d.cage && d.cage.done && d.t > 0.3) f.finishSuper(0.12);
      else if (d.t > 2.4) f.finishSuper(0.12);
    },
  },

  revoada: {
    update(f, dt, scene) {
      const d = f.superData;
      d.t += dt;
      f.vx = 0;
      if (d.phase === 'start') {
        d.phase = 'flock';
        d.t = 0;
        f.play('revoada', true);
        d.flock = scene.add(new Game.CrowFlock(f));
        Game.featherBurst(scene, f.cx - f.facing * 6, f.feet - 24, 20);
        Game.events.emit('revoada');
      }
      if (d.flock && (d.flock.done || d.t > 2.2)) f.finishSuper(0.12);
    },
  },

  timestop: {
    update(f, dt, scene) {
      const d = f.superData;
      d.t += dt;
      f.vx = 0;
      if (d.phase === 'start') {
        d.phase = 'snap';
        d.t = 0;
        f.play('snap', true);
      }
      if (d.phase === 'snap' && d.t >= 0.12) {
        // estalo: o tempo para para todo mundo, menos para ela
        scene.stopTime(f, Game.config.timestop.duration);
        f.finishSuper(0);
      }
    },
  },

  supernova: {
    update(f, dt, scene) {
      const d = f.superData;
      d.t += dt;
      f.vx = 0;
      if (d.phase === 'start') {
        d.phase = 'grow';
        d.t = 0;
        f.play('superPose', true);
        Game.events.emit('starGrow');
      }
      if (d.phase === 'grow' && d.t >= 0.28) {
        d.phase = 'throw';
        d.t = 0;
        f.play('hurl', true);
        d.star = scene.add(new Game.StarShot(f));
        Game.events.emit('starThrow');
      }
      if (d.phase === 'throw') {
        const nova = d.star && d.star.nova;
        if ((d.star && d.star.dead && (!nova || nova.done)) || d.t > 2.6) f.finishSuper(0.12);
      }
    },
  },

  // Sinal de mão: a pose fica durante a cena; depois o lutador volta a lutar
  domain: {
    update(f, dt, scene) {
      const d = f.superData;
      d.t += dt;
      f.vx = 0;
      if (d.t > 0.12) f.finishSuper(0);
    },
  },
});

/**
 * Raio do Encapuzado: sai da mão e vai até a borda da arena, acertando várias
 * vezes. Desmancha projéteis do adversário que encostarem nele.
 */
Game.Beam = class Beam extends Game.Entity {
  constructor(owner) {
    super(0, 0, 1, 12);
    this.owner = owner;
    this.team = owner.team;
    this.facing = owner.facing;
    this.t = 0;
    this.life = 0.78;
    this.tick = 0;
    this.layer = 3;
  }

  place(scene) {
    const o = this.owner;
    const hand = o.cx + this.facing * 15;
    const limit = this.facing > 0 ? scene.map.pixelWidth + 40 : -40;
    const len = Math.max(1, Math.abs(limit - hand));
    this.x = this.facing > 0 ? hand : hand - len;
    this.w = len;
    this.sourceX = hand;
    this.y = o.feet - 23;
    this.h = 12;
  }

  update(dt, input, scene) {
    this.t += dt;
    this.place(scene);
    for (const e of scene.entities) {
      if (e instanceof Game.Projectile && !e.dead && e.team !== this.team && e.overlaps(this)) e.explode(scene);
    }
    this.tick -= dt;
    if (this.tick <= 0 && this.t < this.life) {
      this.tick = 0.09;
      const last = this.t + 0.09 >= this.life;
      const hit = last
        ? { damage: 8, knockback: 220, heavy: true, launch: true, special: true, super: true }
        : { damage: 3, knockback: 30, special: true, super: true, stop: 'multi' };
      scene.punch({ x: this.x, y: this.y, w: this.w, h: this.h }, hit, this);
    }
    if (Math.random() < 0.6) {
      const px = this.facing > 0 ? this.x + Math.random() * Math.min(this.w, 260) : this.x + this.w - Math.random() * Math.min(this.w, 260);
      scene.effects.burst(px, this.y + 6, ['#ffffff', '#e2c4ff', '#a46cff'], 1, { speed: 40, lift: 30, gravity: -30 });
    }
    if (this.t >= this.life) this.dead = true;
  }

  draw(ctx) {
    // faixas: borda escura, roxo, lilás e miolo branco; tremulando de leve
    const fade = this.t > this.life - 0.12 ? (this.life - this.t) / 0.12 : Math.min(1, this.t / 0.06);
    const flick = Math.floor(this.t * 30) % 2;
    const cy = Math.round(this.y + 6);
    const x = Math.round(this.x);
    const w = Math.round(this.w);
    const bands = [
      [6 + flick, '#4a1b8c'],
      [5, '#8b45f0'],
      [3 + flick, '#d6a8ff'],
      [1, '#ffffff'],
    ];
    for (const [half, color] of bands) {
      const hh = Math.max(0, Math.round(half * fade));
      if (!hh) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x, cy - hh, w, hh * 2);
    }
    // ondulação na ponta da mão
    const hx = this.facing > 0 ? x : x + w;
    Game.drawOrb(ctx, hx, cy, 5 + flick, this.t);
  }
};
