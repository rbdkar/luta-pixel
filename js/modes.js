/*
 * Modos novos:
 *
 *   team    EQUIPES 3x3: você monta uma equipe de 3 e enfrenta 3 da CPU. Cada luta é de um
 *           round; quem vence fica na arena com a vida que sobrou (recupera um pouco) e o
 *           próximo da equipe que perdeu entra. Ganha quem derrubar os 3 do outro lado.
 *   chaos   CAOS: luta contra a CPU em que uma regra maluca muda a cada 12 segundos
 *           (Game.CHAOS_RULES): lua, turbo, câmera lenta, super à vontade, dano em dobro,
 *           vampiro, chuva de meteoros, chão de gelo e tudo ao contrário.
 *   trials  DESAFIOS: missões com cada lutador contra um boneco (combo, rasteira, especiais,
 *           cancelamento, super, domínio e um golpe característico de alguns). O progresso
 *           fica salvo no navegador.
 *
 * As telas e o fluxo das lutas ficam em App (js/app.js); aqui ficam as regras de cada modo.
 */
window.Game = window.Game || {};

// ============================================================================ CAOS
Game.CHAOS_RULES = [
  { key: 'lua', name: 'LUA', desc: 'gravidade baixa: pulos altos e lentos', apply: (c) => { c.gravity = 0.5; } },
  { key: 'turbo', name: 'TURBO', desc: 'tudo 30% mais rápido', apply: (c) => { c.speed = 1.3; } },
  { key: 'lenta', name: 'CÂMERA LENTA', desc: 'tudo mais devagar', apply: (c) => { c.speed = 0.72; } },
  { key: 'super', name: 'SUPER À VONTADE', desc: 'a barra de super enche sozinha', apply: (c) => { c.meterRate = 42; } },
  { key: 'dobro', name: 'DANO EM DOBRO', desc: 'cada golpe tira o dobro', apply: (c) => { c.damage = 2; } },
  { key: 'vampiro', name: 'VAMPIRO', desc: 'quem acerta recupera metade do dano', apply: (c) => { c.vampire = 0.5; } },
  { key: 'meteoros', name: 'CHUVA DE METEOROS', desc: 'saia de baixo das sombras no chão', apply: (c) => { c.meteors = 1.05; } },
  { key: 'gelo', name: 'CHÃO DE GELO', desc: 'todo mundo escorrega', apply: (c) => { c.ice = true; } },
  { key: 'espelho', name: 'TUDO AO CONTRÁRIO', desc: 'esquerda vira direita para os dois', apply: (c) => { c.invert = true; }, weight: 0.55 },
];

Game.Chaos = class Chaos {
  constructor(fight) {
    this.fight = fight;
    this.every = 12;
    this.t = 0;
    this.rule = null;
    this.state = null;
    this.meteorT = 1;
  }

  get scene() {
    return this.fight.scene;
  }

  /** Começo de cada round: uma regra nova. */
  reset() {
    this.t = 0;
    this.pick(false);
  }

  pick(announce = true) {
    const pool = Game.CHAOS_RULES.filter((r) => !this.rule || r.key !== this.rule.key);
    const total = pool.reduce((s, r) => s + (r.weight || 1), 0);
    let x = Math.random() * total;
    let rule = pool[0];
    for (const r of pool) {
      x -= r.weight || 1;
      if (x <= 0) {
        rule = r;
        break;
      }
    }
    this.rule = rule;
    this.fight.chaosRules = (this.fight.chaosRules || 0) + 1;
    this.state = { key: rule.key, gravity: 1, speed: 1, damage: 1, vampire: 0, meteors: 0, ice: false, invert: false, meterRate: 0 };
    rule.apply(this.state);
    this.scene.chaos = this.state;
    this.fight.speed = this.state.speed;
    this.meteorT = 0.8;
    if (!this.state.invert) for (const f of this.fight.fighters) if (f.inverted > 0 && f.chaosInvert) f.inverted = 0;
    if (announce) {
      this.fight.ui.announce(rule.name + '!', 1.1);
      Game.events.emit('chaosRule', { rule });
    }
  }

  /** Um passo de luta (só com o relógio correndo). */
  update(dt) {
    const s = this.state;
    if (!s) return;
    this.t += dt;
    if (this.t >= this.every) {
      this.t = 0;
      this.pick(true);
      return;
    }
    for (const f of this.fight.fighters) {
      if (s.meterRate && !f.inDomain) f.meter = Math.min(f.maxMeter, f.meter + s.meterRate * dt);
      if (s.invert && !f.ko) {
        f.inverted = Math.max(f.inverted, 0.25);
        f.chaosInvert = true;
      }
    }
    if (s.meteors) {
      this.meteorT -= dt;
      if (this.meteorT <= 0) {
        this.meteorT = s.meteors * (0.6 + Math.random() * 0.7);
        this.dropMeteor();
      }
    }
  }

  dropMeteor() {
    const scene = this.scene;
    const fs = this.fight.fighters.filter((f) => !f.ko);
    if (!fs.length) return;
    const target = fs[Math.floor(Math.random() * fs.length)];
    const maxX = scene.map.pixelWidth;
    const x = Math.max(12, Math.min(maxX - 12, target.cx + (Math.random() - 0.5) * 60));
    // dono neutro: o meteoro acerta qualquer um e não dá barra para ninguém
    const sky = { team: 0, facing: Math.random() < 0.5 ? 1 : -1, cx: x, groundY: scene.floorY, feet: scene.floorY };
    scene.add(new Game.Strike(sky, 'meteor', x, { warn: 0.6, hit: { damage: 7, knockback: 90, heavy: true, special: true } }));
  }

  /** Fração do tempo até a próxima regra (HUD). */
  get progress() {
    return 1 - this.t / this.every;
  }

  end() {
    if (this.scene) this.scene.chaos = null;
    this.fight.speed = 1;
    for (const f of this.fight.fighters) if (f.chaosInvert) f.inverted = 0;
  }
};

// ============================================================================ DESAFIOS
// golpe característico de alguns lutadores (vira uma missão a mais)
Game.TRIAL_SIGNATURE = {
  marionete: { text: 'Puxão: prenda o boneco com o fio e puxe', keys: (k) => k.s + ' e ' + k.s + ' de novo', on: 'yank' },
  pavio: { text: 'Batata quente: a bomba-relógio explode no boneco', keys: (k) => '↓ + ' + k.s + ' colado', on: 'timebombBoom', target: true },
  gelida: { text: 'Congele o boneco com o pico de gelo', keys: (k) => k.s, on: 'freeze', target: true },
  orbita: { text: 'Faça o boneco flutuar', keys: (k) => '↓ + ' + k.s, on: 'floatUp', target: true },
  ampulheta: { text: 'Prenda o boneco na Bolha do Tempo', keys: (k) => k.s, on: 'timeBubble' },
  hood: { text: 'Bola de energia carregada', keys: (k) => 'segure ' + k.s, on: 'fireBig' },
  welder: { text: 'Feche o portão de ferro', keys: (k) => '↓ + ' + k.s, on: 'gateSlam' },
};

// supers que pedem algo a mais do jogador (o texto da missão explica)
Game.TRIAL_SUPER = {
  ampulheta: { text: 'Super: pare o tempo e bata no boneco parado', keys: (k) => k.x + ', depois ' + k.p + ' ' + k.p + ' ' + k.p },
};

Game.Trials = class Trials {
  /** Lista de missões de um lutador. k: nomes das teclas (J, K, L, I ou os botões de toque). */
  static missions(key, k) {
    const ch = Game.characters[key];
    const m = [
      { text: 'Combo: soco, soco, chute', keys: k.p + ' ' + k.p + ' ' + k.p, test: (e) => e.type === 'hit' && e.src === 'kick' && e.combo >= 3 },
      { text: 'Rasteira no boneco', keys: '↓ + ' + k.p, test: (e) => e.type === 'hit' && e.src === 'sweep' },
      { text: 'Especial: ' + ch.specialName, keys: k.s, test: (e) => e.type === 'specialUsed' && !e.second },
    ];
    if (ch.special2) m.push({ text: 'Segundo especial: ' + ch.special2Name, keys: '↓ + ' + k.s, test: (e) => e.type === 'specialUsed' && e.second });
    else m.push({ text: 'Agarrão', keys: k.fw + ' + ' + k.p + ' colado', test: (e) => e.type === 'toss' });
    m.push({ text: 'Cancele o combo no especial', keys: k.p + ' ' + k.p + ' ' + k.s, test: (e) => e.type === 'specialUsed' && e.cancel });
    const sig = Game.TRIAL_SIGNATURE[key];
    if (sig) m.push({ text: sig.text, keys: sig.keys(k), test: (e) => e.type === sig.on && (!sig.target || e.onDummy) });
    const sup = Game.TRIAL_SUPER[key];
    m.push({ text: sup ? sup.text : 'Super: ' + ch.superName.toLowerCase(), keys: sup ? sup.keys(k) : k.x, test: (e) => e.type === 'superHit' });
    m.push({ text: 'Domínio: acerte o golpe garantido', keys: k.d, test: (e) => e.type === 'sureHit' });
    return m;
  }

  static progress(key) {
    const all = Game.records.get('trials', {});
    return all[key] || 0;
  }

  static completedFighters() {
    const all = Game.records.get('trials', {});
    return Game.characterOrder.filter((key) => (all[key] || 0) >= Game.Trials.missions(key, Game.Trials.KEYS).length).length;
  }

  constructor(fight, el, keys) {
    this.fight = fight;
    this.el = el;
    this.key = fight.p1.charKey;
    this.list = Game.Trials.missions(this.key, keys);
    this.index = 0;
    this.doneT = 0;
    this.finished = false;
    this.recentSpecial = 0;
    this.hideT = -1; // > 0: painel escondido (aparece depois do LUTE! e some no anúncio final)
    const p1 = fight.p1;
    const p2 = fight.p2;
    const push = (e) => this.feed(e);
    const mine = (f) => f === p1 || (f && f.owner === p1);
    this.unsubs = [
      Game.events.on('hit', (d) => {
        if (d.target !== p2 || !mine(d.owner)) return;
        push({ type: 'hit', src: d.src, combo: d.combo, special: d.special, super: d.super });
        if (d.super || d.timeDebt) push({ type: 'superHit' });
      }),
      Game.events.on('specialUsed', (d) => { if (d.fighter === p1) push({ type: 'specialUsed', kind: d.kind, second: d.second, cancel: d.cancel }); }),
      Game.events.on('toss', (d) => { if (d.attacker === p1) push({ type: 'toss' }); }),
      Game.events.on('sureHit', (d) => { if (d.attacker === p1) push({ type: 'sureHit' }); }),
      Game.events.on('puppetCatch', (d) => { if (d.attacker === p1) push({ type: 'superHit' }); }),
      Game.events.on('timeResume', (d) => { if (d.owner === p1 && d.debt > 0) push({ type: 'superHit' }); }),
    ];
    for (const ev of new Set(Object.values(Game.TRIAL_SIGNATURE).map((s) => s.on))) {
      this.unsubs.push(Game.events.on(ev, (d = {}) => {
        const target = d.target || null;
        if ((d.attacker || d.fighter || d.owner || p1) !== p1 && !target) return;
        push({ type: ev, onDummy: target === p2 });
      }));
    }
    this.render();
  }

  destroy() {
    for (const off of this.unsubs) off();
    this.unsubs = [];
    this.el.hidden = true;
  }

  feed(e) {
    if (this.finished || this.doneT > 0) return;
    const m = this.list[this.index];
    if (m && m.test(e)) this.complete();
  }

  complete() {
    this.doneT = 0.9;
    this.el.classList.add('is-done');
    Game.events.emit('trialDone');
    const best = Game.Trials.progress(this.key);
    if (this.index + 1 > best) {
      const all = Game.records.get('trials', {});
      all[this.key] = this.index + 1;
      Game.records.set('trials', all);
    }
    this.render(true);
  }

  /** Uma vez por quadro. */
  frame(dt) {
    // o painel só aparece depois do "LUTE!" (assim não fica por cima do anúncio)
    if (this.hideT < 0 && this.fight.state === 'fight' && this.fight.stateTime >= 0.4) this.show();
    if (this.hideT > 0) {
      this.hideT -= dt;
      if (this.hideT <= 0) this.show();
    }
    if (this.doneT <= 0) return;
    this.doneT -= dt;
    if (this.doneT <= 0) {
      this.el.classList.remove('is-done');
      this.index += 1;
      if (this.index >= this.list.length) {
        this.finished = true;
        this.fight.ui.announce('DESAFIOS COMPLETOS!', 2, 'win');
        Game.events.emit('trialsAll');
        this.hideT = 2; // volta com a mensagem final quando o anúncio sai
      }
      this.render();
    }
  }

  show() {
    this.hideT = 0;
    this.el.hidden = false;
    this.el.classList.remove('is-in');
    void this.el.offsetWidth; // reinicia a animação de entrada
    this.el.classList.add('is-in');
  }

  render(done = false) {
    const el = this.el;
    el.hidden = this.hideT !== 0;
    el.innerHTML = '';
    const head = document.createElement('div');
    head.className = 'trials-head';
    const title = document.createElement('b');
    const dots = document.createElement('span');
    dots.className = 'trials-dots';
    this.list.forEach((_, i) => {
      const d = document.createElement('i');
      if (i < this.index || (done && i === this.index)) d.className = 'is-ok';
      else if (i === this.index) d.className = 'is-now';
      dots.appendChild(d);
    });
    const text = document.createElement('p');
    text.className = 'trials-text';
    if (this.finished) {
      title.textContent = 'DESAFIOS COMPLETOS!';
      text.textContent = 'Todos com ' + this.fight.p1.char.name + '. Escolha outro lutador no menu (pausa).';
    } else {
      const m = this.list[this.index];
      title.textContent = (done ? 'BOA! ' : 'DESAFIO ') + (this.index + 1) + ' DE ' + this.list.length;
      text.append(m.text + ' ');
      const kbd = document.createElement('kbd');
      kbd.textContent = m.keys;
      text.appendChild(kbd);
    }
    head.append(title, dots);
    el.append(head, text);
  }
};

// nomes das teclas do teclado (para contar missões fora da luta)
Game.Trials.KEYS = { p: 'J', s: 'K', x: 'L', d: 'I', fw: '→', bk: '←' };

// ============================================================================ EQUIPES 3x3
Game.Team = {
  size: 3,
  recover: 20, // quem vence recupera um pouco de vida antes da próxima luta

  /** Sorteia uma equipe de 3 sem repetir (e completa uma equipe incompleta). */
  fill(list = [], avoid = []) {
    const out = list.slice(0, 3);
    const pool = Game.characterOrder.filter((k) => !out.includes(k) && !avoid.includes(k));
    while (out.length < 3 && pool.length) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    return out;
  },
};
