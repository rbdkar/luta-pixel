/*
 * Fight: uma luta (melhor de 3 rounds) entre o jogador e a CPU.
 *
 *   intro    "ROUND 1" e "LUTE!" (ninguém se mexe)
 *   fight    relógio correndo
 *   ko       alguém zerou a vida: câmera lenta, "K.O."
 *   timeup   acabou o tempo: vence quem tiver mais vida
 *   roundEnd pose de vitória; depois próximo round ou fim da luta
 *
 * update(dt) roda junto com a física (tempo de jogo); frame(dt) roda uma vez por
 * quadro em tempo real (câmera lenta, HUD). Ao terminar chama opts.onEnd(resultado).
 */
window.Game = window.Game || {};

Game.Fight = class Fight {
  /**
   * opts: { p1, p2 (chaves de personagem), p2Shadow, level (cpu), hud, ui, onEnd,
   *         p1Controller / p2Controller (outro jogador ou boneco; padrão: teclado e CPU),
   *         rounds (vitórias para levar a luta), p1Hp / p2Hp (vida inicial: sobrevivência e equipes),
   *         training (sem relógio e sem nocaute; vida volta sozinha), chaos (modo Caos),
   *         teamView (ícones das equipes no HUD) }
   */
  constructor(scene, opts) {
    this.scene = scene;
    this.opts = opts;
    this.hud = opts.hud;
    this.ui = opts.ui;
    this.cfg = Game.config.fight;
    this.training = !!opts.training;
    this.roundsToWin = opts.rounds || this.cfg.roundsToWin;
    this.p1 = new Game.Fighter(0, 0, opts.p1, { mode: 'fight', team: 1, facing: 1, controller: opts.p1Controller || null });
    this.p2 = new Game.Fighter(0, 0, opts.p2, {
      mode: 'fight', team: 2, facing: -1, shadow: !!opts.p2Shadow,
      controller: opts.p2Controller || new Game.CpuController(opts.level),
    });
    if (this.training) {
      for (const f of [this.p1, this.p2]) {
        f.noKo = true;
        f.infiniteMeter = true;
      }
      this.trainRefill = 0;
      this.trainCombo = null;
    }
    scene.setFighters(this.p1, this.p2);
    this.wins = [0, 0];
    this.round = 0;
    this.timeScale = 1;
    this.speed = 1;               // Caos: turbo / câmera lenta
    this.slowmo = 0;
    this.over = false;
    this.chaos = opts.chaos ? new Game.Chaos(this) : null;
    this.stats = { maxCombo: 0, perfects: 0, rounds: [] };
    this.hud.setup(this.p1, this.p2, this.roundsToWin);
    this.hud.setInfinite(this.training);
    this.hud.setTeams(opts.teamView || null);
    this.unsubs = [
      Game.events.on('ko', (d) => this.onKo(d)),
      Game.events.on('hit', (d) => this.onHitEvent(d)),
      Game.events.on('dizzy', (d) => this.hud.flash(d.target.team, 'TONTO!')),
      Game.events.on('super', (d) => this.hud.cutin(d.fighter, d.name)),
      Game.events.on('tech', (d) => this.hud.flash(d.fighter.team, 'ESCAPOU!')),
      Game.events.on('toss', (d) => this.hud.flash(d.attacker.team, d.castle ? 'ROQUE!' : 'AGARRÃO!')),
      Game.events.on('freeze', (d) => this.hud.flash(d.target.team, 'CONGELADO!')),
      Game.events.on('rooted', (d) => this.hud.flash(d.target.team, 'PÉS SOLDADOS!')),
      Game.events.on('copied', (d) => this.hud.flash(d.fighter.team, 'COPIOU: ' + d.name.toUpperCase() + '!')),
      Game.events.on('counter', (d) => this.hud.flash(d.fighter.team, 'LEITURA!')),
      Game.events.on('counterHit', (d) => { if (d.attacker && d.attacker.team) this.hud.flash(d.attacker.team, 'CONTRA!'); }),
      Game.events.on('rewind', (d) => this.hud.flash(d.fighter.team, d.heal > 0 ? 'REBOBINOU! +' + Math.round(d.heal) : 'REBOBINOU!')),
      Game.events.on('floatUp', (d) => this.hud.flash(d.target.team, 'FLUTUANDO!')),
      Game.events.on('stringAttach', (d) => this.hud.flash(d.target.team, 'PRESO NO FIO!')),
      Game.events.on('yank', (d) => this.hud.flash(d.attacker.team, 'PUXÃO!')),
      Game.events.on('inverted', (d) => this.hud.flash(d.target.team, 'CONTROLES TROCADOS!')),
      Game.events.on('puppetCatch', (d) => this.hud.flash(d.attacker.team, 'MARIONETE!')),
      Game.events.on('timebombPlant', (d) => { if (d.target) this.hud.flash(d.target.team, 'BOMBA-RELÓGIO!'); }),
      Game.events.on('timebombPass', (d) => this.hud.flash(d.from.team, 'PASSOU A BOMBA!')),
      Game.events.on('timebombBoom', (d) => this.hud.flash(d.target.team, 'BUM!')),
      Game.events.on('armorUp', (d) => this.hud.flash(d.fighter.team, 'ARMADURA DE CARVALHO!')),
      Game.events.on('armorBreak', (d) => { if (!d.fighter.ko) this.hud.flash(d.fighter.team, 'A ARMADURA QUEBROU!'); }),
      Game.events.on('rootWhip', (d) => this.hud.flash(d.attacker.team, d.curve >= 3 ? 'TRÊS CURVAS!' : 'DUAS CURVAS!')),
      Game.events.on('forestGrow', (d) => { if (d.stage > 1) this.hud.flash(d.owner.team, 'A FLORESTA CRESCE!'); }),
      Game.events.on('pawnCapture', (d) => this.hud.flash(d.attacker.team, 'CAPTURA!')),
      Game.events.on('pawnPromote', (d) => this.hud.flash(d.owner.team, 'PROMOÇÃO!')),
      Game.events.on('check', (d) => this.hud.flash(d.attacker.team, 'XEQUE!')),
      Game.events.on('checkmate', () => this.ui.announce('XEQUE-MATE!', 0.9)),
      Game.events.on('zugzwang', (d) => this.hud.flash(d.target.team, 'ZUGZWANG!')),
      Game.events.on('timeStop', () => this.ui.announce('O TEMPO PAROU!', 0.9)),
      Game.events.on('timeResume', (d) => { if (d.debt > 0) this.hud.flash(d.owner.team, 'TEMPO VOLTOU! ' + d.debt); }),
      Game.events.on('domainCast', (d) => this.hud.cutin(d.fighter, d.name, 'EXPANSÃO DE DOMÍNIO', 1400)),
      Game.events.on('sureHit', (d) => this.hud.flash(d.attacker.team, 'GARANTIDO!')),
      Game.events.on('domainClash', (d) => {
        if (!d.winner) this.ui.announce('OS DOIS DOMÍNIOS QUEBRARAM!', 1.3);
        else this.ui.announce(d.winner.displayName + ' VENCE O EMBATE!', 1.3, d.winner === this.p1 ? 'win' : null);
      }),
    ];
    this.prepareRound(); // lutadores já posicionados (aparecem atrás da tela "VS")
  }

  /** Começa de fato a luta: anuncia o round 1. */
  begin() {
    if (this.state === 'ready') this.announceRound();
  }

  destroy() {
    for (const off of this.unsubs) off();
    this.unsubs = [];
    if (this.chaos) this.chaos.end();
  }

  get fighters() {
    return [this.p1, this.p2];
  }

  startRound() {
    this.prepareRound();
    this.announceRound();
  }

  prepareRound() {
    this.round += 1;
    this.scene.resetRound();
    for (const f of this.fighters) f.resetForRound();
    if (this.round === 1 && this.opts.p1Hp) this.p1.hp = Math.max(1, Math.round(this.opts.p1Hp));
    if (this.round === 1 && this.opts.p2Hp) this.p2.hp = Math.max(1, Math.round(this.opts.p2Hp));
    if (this.chaos) this.chaos.reset();
    for (const f of this.fighters) if (f.controller && f.controller.reset) f.controller.reset();
    this.time = this.cfg.roundTime;
    this.lastTick = Math.ceil(this.time);
    this.state = 'ready';
    this.stateTime = 0;
    this.saidFight = false;
    this.winner = null;
    this.timeScale = 1;
    this.slowmo = 0;
    this.hud.update(this.p1, this.p2, this.time, this.wins, true);
  }

  announceRound() {
    this.state = 'intro';
    this.stateTime = 0;
    const need = this.roundsToWin;
    const final = need > 1 && this.wins[0] === need - 1 && this.wins[1] === need - 1;
    const text = this.training ? 'TREINO' : need === 1 ? 'LUTA ' + (this.opts.fightNumber || 1) : final ? 'ROUND FINAL' : 'ROUND ' + this.round;
    this.ui.announce(text, 1.2);
    Game.events.emit('round');
  }

  onHitEvent(d) {
    if (!d.attacker || !d.target || !(d.target instanceof Game.Fighter) || !d.attacker.team) return;
    const team = d.attacker.team;
    if (d.combo >= 2) {
      this.hud.combo(team, d.combo);
      if (team === 1) this.stats.maxCombo = Math.max(this.stats.maxCombo, d.combo);
    }
    if (this.training) {
      // treino: soma o dano do combo atual e segura a recuperação da vida
      this.trainRefill = 1.6;
      if (d.target === this.p2) {
        const before = this.trainLastHp === undefined ? this.p2.maxHp : this.trainLastHp;
        if (!this.trainCombo || d.combo <= 1) this.trainCombo = { hits: 0, dmg: 0 };
        this.trainCombo.hits = Math.max(this.trainCombo.hits + 1, d.combo);
        this.trainCombo.dmg += Math.max(0, before - this.p2.hp);
        this.trainLastHp = this.p2.hp;
        if (!this.trials) this.ui.trainInfo(this.trainCombo); // nos Desafios o painel das missões ocupa o lugar
      }
    }
  }

  onKo(d) {
    if (this.state !== 'fight' || this.winner) return;
    const loser = d.loser;
    this.winner = loser === this.p1 ? this.p2 : this.p1;
    this.scene.locked = true;
    this.state = 'ko';
    this.stateTime = 0;
    this.timeScale = this.cfg.koSlowmo.scale;
    this.slowmo = this.cfg.koSlowmo.time;
    this.ui.announce('K.O.', 1.6, 'ko');
    Game.events.emit('koBig');
  }

  /** Um passo de jogo (já em câmera lenta quando for o caso). */
  update(dt) {
    this.stateTime += dt;
    switch (this.state) {
      case 'intro':
        if (this.stateTime >= 1.25 && !this.saidFight) {
          this.saidFight = true;
          this.ui.announce('LUTE!', 0.7, 'fight');
          Game.events.emit('fight');
        }
        if (this.stateTime >= 1.6) {
          this.scene.locked = false;
          for (const f of this.fighters) f.startFighting();
          this.state = 'fight';
          this.stateTime = 0;
        }
        break;
      case 'fight': {
        // o relógio (e a regra do Caos) para na pose do super, no embate de domínios e no tempo parado
        const frozen = this.scene.cinematic || (this.scene.domain && this.scene.domain.clash) || this.scene.timeStop;
        if (this.chaos && !frozen) this.chaos.update(dt);
        if (this.training) break; // treino: sem relógio
        if (!frozen) this.time = Math.max(0, this.time - dt);
        const whole = Math.ceil(this.time);
        if (whole !== this.lastTick) {
          this.lastTick = whole;
          if (whole <= 5 && whole > 0) Game.events.emit('tick');
        }
        if (this.time <= 0) {
          this.state = 'timeup';
          this.stateTime = 0;
          this.scene.locked = true;
          this.ui.announce('TEMPO!', 1.4);
          Game.events.emit('timeup');
        }
        break;
      }
      case 'ko':
        // espera o nocauteado cair e o vencedor ficar livre
        if (this.stateTime >= 0.9 && this.winner.onGround && this.isLoserDown()) this.endRound();
        break;
      case 'timeup':
        if (this.stateTime >= 1.2 && this.p1.onGround && this.p2.onGround) {
          const r1 = this.p1.hp / this.p1.maxHp;
          const r2 = this.p2.hp / this.p2.maxHp;
          this.winner = r1 > r2 ? this.p1 : r2 > r1 ? this.p2 : null;
          this.endRound();
        }
        break;
      case 'roundEnd':
        if (!this.posed) this.tryPose();
        if (this.stateTime >= 2.6) this.next();
        break;
      default:
        break;
    }
  }

  isLoserDown() {
    const loser = this.winner === this.p1 ? this.p2 : this.p1;
    return loser.state === 'ko' && loser.stateTime > 0.25;
  }

  endRound() {
    this.state = 'roundEnd';
    this.stateTime = 0;
    this.posed = false;
    const w = this.winner;
    if (w) this.wins[w === this.p1 ? 0 : 1] += 1;
    else {
      // empate: ponto para os dois
      this.wins[0] += 1;
      this.wins[1] += 1;
    }
    this.stats.rounds.push(w === this.p1 ? 'win' : w === this.p2 ? 'lose' : 'draw');
    const perfect = w && w.hp === w.maxHp;
    if (perfect && w === this.p1) this.stats.perfects += 1;
    let text;
    if (!w) text = 'EMPATE';
    else if (w === this.p1) text = perfect ? 'PERFEITO!' : 'VOCÊ VENCEU O ROUND';
    else text = (perfect ? 'PERFEITO: ' : '') + w.displayName + ' VENCE';
    this.ui.announce(text, 2, w === this.p1 ? 'win' : w ? 'lose' : null);
    if (perfect) Game.events.emit('perfect');
    this.hud.update(this.p1, this.p2, this.time, this.wins, true);
  }

  /** Vencedor faz a pose; quem perdeu no tempo fica abatido. */
  tryPose() {
    const w = this.winner;
    const fighters = this.fighters;
    if (w && !(w.onGround && !w.attack && ['idle', 'walk', 'crouch', 'jump', 'dash', 'block', 'hurt', 'intro'].includes(w.state))) return;
    this.posed = true;
    for (const f of fighters) {
      if (f.state === 'ko') continue;
      f.attack = null;
      f.charging = null;
      f.setHeight(f.standH);
      f.vx = 0;
      if (f === w) {
        f.state = 'win';
        f.play('win', true);
      } else if (f.state !== 'down' && f.state !== 'getup' && f.state !== 'launched') {
        f.state = 'frozen';
        f.play(w ? 'hurt' : 'guard', true);
      }
    }
  }

  next() {
    const need = this.roundsToWin;
    if (this.wins[0] >= need || this.wins[1] >= need) {
      this.state = 'over';
      this.over = true;
      const p1won = this.wins[0] >= need && this.wins[1] < need;
      const p2won = this.wins[1] >= need && this.wins[0] < need;
      const result = p1won ? 'win' : p2won ? 'lose' : 'draw';
      if (this.opts.onEnd) this.opts.onEnd({ result, wins: this.wins.slice(), stats: this.stats, fight: this });
      return;
    }
    this.startRound();
  }

  /** Uma vez por quadro, em tempo real. */
  frame(dt) {
    if (this.slowmo > 0) {
      this.slowmo -= dt;
      if (this.slowmo <= 0) this.timeScale = 1;
    }
    if (this.training && this.state === 'fight') {
      // um tempinho sem golpes: vida e tontura voltam ao normal
      this.trainRefill -= dt;
      if (this.trainRefill <= 0) {
        for (const f of this.fighters) {
          f.hp = f.maxHp;
          f.stun = 0;
        }
        this.trainLastHp = this.p2.hp;
        this.trainRefill = 999;
      }
    }
    this.hud.update(this.p1, this.p2, this.time, this.wins);
    this.hud.domain(this.scene.domain);
    this.hud.chaos(this.chaos && this.state !== 'over' ? this.chaos : null);
    this.hud.frame(dt);
  }
};
