/*
 * HUD da luta (HTML por cima do canvas, escala com o palco pela unidade --u):
 *  - barras de vida no estilo arcade: a vida que sobra fica junto do relógio e o
 *    dano recente aparece em vermelho, sumindo logo depois;
 *  - retrato, nome e vitórias (pontinhos) de cada lado;
 *  - barra de tontura (enche com golpes; cheia = lutador tonto);
 *  - relógio do round; contador de combo do lado de quem bate;
 *  - barra de super com 2 níveis (SUPER e DOMÍNIO), faixa do domínio ativo com o
 *    tempo que falta e a barra do embate de domínios.
 * O DOM só é tocado quando algum valor muda.
 */
window.Game = window.Game || {};

Game.FightHud = class FightHud {
  constructor(root, stage) {
    this.root = root;
    this.cutinEl = stage.querySelector('#cutin');
    this.cutinFace = stage.querySelector('.cutin-face');
    this.cutinName = stage.querySelector('.cutin-name');
    this.cutinKicker = stage.querySelector('.cutin-kicker');
    this.domainEl = stage.querySelector('#domain-bar');
    this.domainName = this.domainEl.querySelector('.domain-name');
    this.domainFill = this.domainEl.querySelector('.domain-time i');
    this.clashEl = stage.querySelector('#clash');
    this.chaosEl = stage.querySelector('#chaos-bar');
    this.chaosName = this.chaosEl.querySelector('.chaos-name');
    this.chaosDesc = this.chaosEl.querySelector('.chaos-desc');
    this.chaosFill = this.chaosEl.querySelector('.chaos-time i');
    this.chaosKey = null;
    this.clashFill = this.clashEl.querySelector('.clash-bar i');
    this.domainShown = false;
    this.clashShown = false;
    this.time = root.querySelector('#hud-time');
    this.timerBox = root.querySelector('.hud-timer');
    this.sides = [1, 2].map((n) => {
      const el = root.querySelector('.hud-side[data-side="' + n + '"]');
      return {
        el,
        face: el.querySelector('.hud-face'),
        fill: el.querySelector('.hud-fill'),
        lag: el.querySelector('.hud-lag'),
        bar: el.querySelector('.hud-bar'),
        name: el.querySelector('.hud-name'),
        pips: el.querySelector('.hud-pips'),
        stun: el.querySelector('.hud-stun i'),
        stunBox: el.querySelector('.hud-stun'),
        superBox: el.querySelector('.hud-super'),
        superFill: el.querySelector('.hud-super i'),
        superText: el.querySelector('.hud-super span'),
        tag: el.querySelector('.hud-tag'),
        team: el.querySelector('.hud-team'),
        hits: stage.querySelector('.hits[data-side="' + n + '"]'),
        hp: 1, lagValue: 1, lagHold: 0, stunValue: -1, last: {},
        hitsTimer: 0,
      };
    });
  }

  show(on = true) {
    this.root.hidden = !on;
    if (!on) {
      for (const s of this.sides) s.hits.hidden = true;
      this.cutinEl.hidden = true;
      this.domain(null);
      this.chaos(null);
    }
  }

  /**
   * Equipes 3x3: rostinhos dos 3 de cada lado embaixo da barra de super
   * (apagado e riscado = derrotado; com borda = quem está lutando agora).
   * view: { left: [{ key, state: 'out' | 'now' | 'next' }], right: [...] } ou null.
   */
  setTeams(view) {
    [view && view.left, view && view.right].forEach((list, i) => {
      const box = this.sides[i].team;
      box.innerHTML = '';
      box.hidden = !list;
      if (!list) return;
      for (const m of list) {
        const ch = Game.characters[m.key];
        const c = document.createElement('canvas');
        c.className = 'hud-mate is-' + m.state;
        c.title = ch.name;
        Game.FightHud.drawFace(c, new Game.SpriteSheet(Game.sprites[ch.sprite]), ch.portrait, i === 1);
        box.appendChild(c);
      }
    });
  }

  /** Caos: nome da regra atual e o tempo até a próxima. */
  chaos(c) {
    const on = !!(c && c.rule);
    if (!on) {
      if (!this.chaosEl.hidden) this.chaosEl.hidden = true;
      this.chaosKey = null;
      return;
    }
    if (this.chaosKey !== c.rule.key) {
      this.chaosKey = c.rule.key;
      this.chaosEl.hidden = false;
      this.chaosName.textContent = 'CAOS: ' + c.rule.name;
      this.chaosDesc.textContent = c.rule.desc;
      this.chaosEl.classList.remove('is-new');
      void this.chaosEl.offsetWidth;
      this.chaosEl.classList.add('is-new');
    }
    this.chaosFill.style.transform = 'scaleX(' + Math.max(0, c.progress).toFixed(3) + ')';
  }

  /** Nomes, retratos e quantos pontinhos de vitória mostrar. */
  setup(p1, p2, roundsToWin) {
    [p1, p2].forEach((f, i) => {
      const s = this.sides[i];
      s.name.textContent = f.displayName;
      s.el.style.setProperty('--accent', f.shadow ? '#b47cff' : f.char.color);
      Game.FightHud.drawFace(s.face, f.sheet, f.char.portrait, i === 1);
      s.pips.innerHTML = '';
      for (let k = 0; k < roundsToWin; k++) s.pips.appendChild(document.createElement('i'));
      s.hp = 1;
      s.lagValue = 1;
      s.lagHold = 0;
      s.last = {};
      s.hits.hidden = true;
    });
    this.lastTime = null;
  }

  /** Recorta o rosto do quadro do sprite (sem ler pixels: funciona até em file://). */
  static drawFace(canvas, sheet, portrait, flip) {
    const p = portrait || { frame: 0, x: 0, y: 0, size: 18 };
    canvas.width = p.size;
    canvas.height = p.size;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, p.size, p.size);
    sheet.drawPart(ctx, p.frame, p.x, p.y, p.size, p.size, 0, 0, flip);
  }

  update(p1, p2, time, wins, force = false) {
    [p1, p2].forEach((f, i) => {
      const s = this.sides[i];
      const hp = Math.max(0, f.hp / f.maxHp);
      if (hp < s.hp) s.lagHold = 0.45; // segura o vermelho um instante antes de baixar
      if (hp > s.hp || force) s.lagValue = Math.max(hp, force ? hp : s.lagValue);
      s.hp = hp;
      if (force || s.last.hp !== hp) {
        s.fill.style.transform = 'scaleX(' + hp.toFixed(4) + ')';
        s.bar.classList.toggle('is-low', hp > 0 && hp <= 0.25);
        s.last.hp = hp;
      }
      const stun = Math.min(1, f.stun / Game.config.fight.stun.max);
      const dizzy = f.state === 'dizzy';
      const stunKey = dizzy ? 'dizzy' : stun.toFixed(2);
      if (force || s.last.stun !== stunKey) {
        s.stun.style.transform = 'scaleX(' + (dizzy ? 1 : stun).toFixed(3) + ')';
        s.stunBox.classList.toggle('is-dizzy', dizzy);
        s.last.stun = stunKey;
      }
      // 2 níveis: metade da barra = super; cheia = domínio
      const meter = Math.min(1, f.meter / f.maxMeter);
      const meterKey = meter.toFixed(3) + (f.inDomain ? 'd' : '');
      if (force || s.last.meter !== meterKey) {
        s.superFill.style.transform = 'scaleX(' + meter.toFixed(3) + ')';
        const level = f.domainReady ? 2 : f.superReady ? 1 : 0;
        s.superBox.classList.toggle('is-full', level >= 1);
        s.superBox.classList.toggle('is-domain', level === 2);
        s.superText.textContent = f.inDomain ? 'NO DOMÍNIO' : level === 2 ? 'DOMÍNIO!' : level === 1 ? 'SUPER!' : 'SUPER';
        s.last.meter = meterKey;
      }
      // Corvo: mostra o especial que o olho copiou (é o que sai no K)
      const tag = f.char.special === 'copy' ? 'CÓPIA: ' + (f.copied ? Game.COPY_NAMES[f.copied].toUpperCase() : 'KUNAI') : '';
      if (force || s.last.tag !== tag) {
        s.tag.hidden = !tag;
        s.tag.textContent = tag;
        s.last.tag = tag;
      }
      if (force || s.last.wins !== wins[i]) {
        [...s.pips.children].forEach((pip, k) => pip.classList.toggle('is-won', k < wins[i]));
        s.last.wins = wins[i];
      }
    });
    const t = this.infinite ? '∞' : Math.ceil(time);
    if (force || t !== this.lastTime) {
      this.time.textContent = this.infinite ? '∞' : String(t).padStart(2, '0');
      this.timerBox.classList.toggle('is-low', !this.infinite && t <= 10);
      this.lastTime = t;
    }
  }

  /** Animações em tempo real: barra vermelha de dano e contadores de combo. */
  frame(dt) {
    for (const s of this.sides) {
      if (s.lagValue > s.hp) {
        if (s.lagHold > 0) s.lagHold -= dt;
        else s.lagValue = Math.max(s.hp, s.lagValue - dt * 0.55);
        s.lag.style.transform = 'scaleX(' + s.lagValue.toFixed(4) + ')';
      } else if (s.last.lag !== s.hp) {
        s.lag.style.transform = 'scaleX(' + s.hp.toFixed(4) + ')';
      }
      s.last.lag = s.lagValue > s.hp ? null : s.hp;
      if (s.hitsTimer > 0) {
        s.hitsTimer -= dt;
        if (s.hitsTimer <= 0) s.hits.hidden = true;
      }
    }
  }

  /** Treino: relógio infinito. */
  setInfinite(on) {
    this.infinite = on;
    this.lastTime = null;
  }

  /**
   * Faixa do super: retrato grande e nome do golpe, entrando pelo lado de quem soltou.
   * kicker: linha pequena em cima (ex.: EXPANSÃO DE DOMÍNIO); ms: quanto tempo fica.
   */
  cutin(fighter, name, kicker = '', ms = 900) {
    const el = this.cutinEl;
    Game.FightHud.drawFace(this.cutinFace, fighter.sheet, fighter.char.portrait, fighter.team === 2);
    this.cutinName.textContent = name;
    this.cutinKicker.textContent = kicker;
    this.cutinKicker.hidden = !kicker;
    el.style.setProperty('--accent', fighter.shadow ? '#d6a8ff' : fighter.char.color);
    el.classList.toggle('is-right', fighter.team === 2);
    el.classList.toggle('is-domain', !!kicker);
    el.hidden = false;
    el.style.animation = 'none';
    void el.offsetWidth; // reinicia a animação CSS
    el.style.animation = '';
    clearTimeout(this.cutinTimer);
    this.cutinTimer = setTimeout(() => { el.hidden = true; }, ms);
  }

  /** Faixa do domínio ativo (nome e tempo) e barra do embate. dom = scene.domain ou null. */
  domain(dom) {
    const active = !!(dom && (dom.phase === 'reveal' || dom.phase === 'active') && !dom.clash);
    if (active !== this.domainShown) {
      this.domainEl.hidden = !active;
      this.domainShown = active;
      this.domainKey = null;
    }
    if (active) {
      const f = dom.owner;
      const key = f.team + ':' + dom.def.name;
      if (this.domainKey !== key) {
        this.domainKey = key;
        this.domainName.textContent = dom.def.name;
        this.domainEl.style.setProperty('--accent', f.shadow ? '#d6a8ff' : dom.def.color);
        this.domainEl.classList.toggle('is-right', f.team === 2);
        this.domainLeft = null;
      }
      const k = Math.max(0, Math.min(1, dom.remaining / dom.cfg.duration));
      if (this.domainLeft === null || Math.abs(this.domainLeft - k) > 0.003) {
        this.domainLeft = k;
        this.domainFill.style.transform = 'scaleX(' + k.toFixed(3) + ')';
        this.domainEl.classList.toggle('is-ending', k < 0.25);
      }
    }
    const clash = !!(dom && dom.clash);
    if (clash !== this.clashShown) {
      this.clashEl.hidden = !clash;
      this.clashShown = clash;
      if (clash) {
        const c = dom.clash;
        const [left, right] = c.a.cx <= c.b.cx ? [c.a, c.b] : [c.b, c.a];
        const color = (f) => (f.shadow ? '#b47cff' : Game.DOMAINS[f.charKey].color);
        this.clashEl.style.setProperty('--left', color(left));
        this.clashEl.style.setProperty('--right', color(right));
        this.clashShare = null;
      }
    }
    if (clash) {
      const share = dom.clashShare();
      if (this.clashShare === null || Math.abs(this.clashShare - share) > 0.003) {
        this.clashShare = share;
        this.clashFill.style.transform = 'scaleX(' + share.toFixed(3) + ')';
      }
    }
  }

  /** "3 golpes" do lado de quem está batendo. */
  combo(team, n) {
    const s = this.sides[team - 1];
    if (!s) return;
    s.hits.querySelector('b').textContent = n;
    s.hits.querySelector('span').textContent = 'golpes';
    this.pop(s);
  }

  /** Aviso curto do lado de um lutador (ex.: TONTO!). */
  flash(team, text) {
    const s = this.sides[team - 1];
    if (!s) return;
    s.hits.querySelector('b').textContent = '';
    s.hits.querySelector('span').textContent = text;
    this.pop(s);
  }

  pop(s) {
    s.hits.hidden = false;
    s.hitsTimer = 1.3;
    s.hits.classList.remove('pop-side');
    void s.hits.offsetWidth; // reinicia a animação CSS
    s.hits.classList.add('pop-side');
  }
};
