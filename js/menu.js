/*
 * Telas em HTML por cima do jogo:
 *   Game.Menu         escolha de lutador (ou de 3, no modo Equipes), modo e dificuldade
 *   Game.VsScreen     apresentação "A VS B" antes de cada luta do arcade
 *   Game.PanelScreen  painéis com botões (fim de luta, pausa)
 * Tudo funciona com mouse, toque e teclado (setas + Enter/J). Os botões usam as
 * ações de Game.Input, então valem as mesmas teclas do jogo.
 */
window.Game = window.Game || {};

/** Navegação por teclado numa lista de botões (setas mudam o foco; Enter/J aperta). */
Game.navButtons = function (input, buttons, state) {
  if (!buttons.length) return;
  let i = buttons.indexOf(document.activeElement);
  if (i < 0) i = state.index || 0;
  const prev = input.consumePress('up') | input.consumePress('left');
  const next = input.consumePress('down') | input.consumePress('right');
  if (prev || next) {
    i = (i + (next ? 1 : -1) + buttons.length) % buttons.length;
    buttons[i].focus();
    Game.Sound.play('select');
  }
  state.index = i;
  if (input.consumePress('confirm')) buttons[i].click();
};

Game.Menu = class Menu {
  constructor(root, input, opts = {}) {
    this.root = root;
    this.input = input;
    this.opts = opts;
    this.sel = { char: Game.characterOrder[0], mode: 'arcade', level: 'normal', p2: Game.characterOrder[1], stage: 'campo' };
    Object.assign(this.sel, opts.selection || {});
    if (!Game.characters[this.sel.char]) this.sel.char = Game.characterOrder[0];
    if (!Game.characters[this.sel.p2]) this.sel.p2 = Game.characterOrder[1];
    if (!Game.stages[this.sel.stage]) this.sel.stage = 'campo';
    if (!Game.Menu.MODES.includes(this.sel.mode)) this.sel.mode = 'arcade';
    this.sel.team = (Array.isArray(this.sel.team) ? this.sel.team : []).filter((k, i, a) => Game.characters[k] && a.indexOf(k) === i).slice(0, 3);
    this.row = 0;
    this.roster = root.querySelector('#roster');
    this.info = root.querySelector('#card-info');
    this.rowMode = root.querySelector('#row-mode');
    this.rowLevel = root.querySelector('#row-level');
    this.startBtn = root.querySelector('#start-btn');
    this.keysHint = root.querySelector('#menu-keys');
    this.rowP2 = root.querySelector('#row-p2');
    this.rowStage = root.querySelector('#row-stage');
    this.p2Label = root.querySelector('#p2-label');
    this.note = root.querySelector('#menu-note');
    this.teamStrip = root.querySelector('#team-strip');
    this.cards = Game.characterOrder.map((key) => this.makeCard(key));
    const chip = (row, value, label, onPick) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip chip-mini';
      b.setAttribute('role', 'radio');
      b.dataset.value = value;
      b.textContent = label;
      b.addEventListener('click', (e) => {
        onPick(value);
        Game.Sound.play('select');
        this.render();
        if (e.detail > 0) b.blur();
      });
      row.appendChild(b);
    };
    for (const key of Game.characterOrder) {
      chip(this.rowP2, key, Game.characters[key].name, (v) => { this.sel.p2 = v; this.row = 3; });
    }
    for (const key of Game.stageOrder) {
      chip(this.rowStage, key, Game.stages[key].name, (v) => { this.sel.stage = v; this.row = 4; });
    }

    // Depois de um clique/toque o foco sai do botão: assim Enter sempre começa a luta
    const dropFocus = (e, el) => {
      if (e.detail > 0) el.blur();
    };
    for (const chip of this.rowMode.querySelectorAll('.chip')) {
      chip.addEventListener('click', (e) => {
        this.sel.mode = chip.dataset.value;
        this.row = 1;
        Game.Sound.play('select');
        this.render();
        dropFocus(e, chip);
      });
    }
    for (const chip of this.rowLevel.querySelectorAll('.chip')) {
      chip.addEventListener('click', (e) => {
        this.sel.level = chip.dataset.value;
        this.row = 2;
        Game.Sound.play('select');
        this.render();
        dropFocus(e, chip);
      });
    }
    this.dropFocus = dropFocus;
    this.startBtn.addEventListener('click', () => this.start());
    window.addEventListener('resize', () => this.sizeCards());
    this.sizeCards();
    this.render();
  }

  makeCard(key) {
    const ch = Game.characters[key];
    const def = Game.sprites[ch.sprite];
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'card';
    btn.setAttribute('role', 'radio');
    btn.style.setProperty('--accent', ch.color);
    const canvas = document.createElement('canvas');
    canvas.className = 'card-sprite';
    canvas.width = 44;
    canvas.height = 46;
    const name = document.createElement('span');
    name.className = 'card-name';
    name.textContent = ch.name;
    const move = document.createElement('span');
    move.className = 'card-move';
    move.textContent = ch.specialName;
    const badge = document.createElement('span');
    badge.className = 'card-badge';
    badge.hidden = true;
    btn.append(canvas, name, move, badge);
    btn.addEventListener('click', (e) => {
      if (this.sel.mode === 'team') {
        // Equipes: tocar num lutador põe (ou tira) da equipe
        this.sel.char = key;
        this.toggleTeam(key);
        if (e.detail > 0) btn.blur();
        return;
      }
      if (this.sel.char === key && this.row === 0) {
        this.start(); // tocar de novo no escolhido começa
        return;
      }
      this.sel.char = key;
      this.row = 0;
      Game.Sound.play('select');
      this.render();
      if (e.detail > 0) btn.blur();
    });
    this.roster.appendChild(btn);
    return {
      key, btn, canvas, badge, ctx: canvas.getContext('2d'),
      sheet: new Game.SpriteSheet(def), anim: new Game.Animator(def), def,
    };
  }

  /** Equipes 3x3: põe ou tira um lutador da equipe; com 3, o foco vai para o botão de começar. */
  toggleTeam(key) {
    const t = this.sel.team;
    const i = t.indexOf(key);
    if (i >= 0) t.splice(i, 1);
    else if (t.length < 3) t.push(key);
    else t[2] = key; // equipe cheia: troca o último
    Game.Sound.play('select');
    this.row = t.length >= 3 ? 5 : 0;
    this.render();
  }

  /** Prévia dos sprites em escala inteira de pixels físicos (nítida), cabendo na coluna. */
  sizeCards() {
    const dpr = window.devicePixelRatio || 1;
    const cols = 7; // 13 lutadores: duas fileiras de 7
    const boxW = Math.min(window.innerWidth * 0.96, 1060) - 40;
    const colW = boxW / cols - 16;
    const portrait = window.innerWidth < window.innerHeight;
    const targetCss = Math.min(colW, window.innerHeight * (portrait ? 0.1 : 0.125));
    const k = Math.max(1, Math.floor((targetCss * dpr) / 44));
    for (const c of this.cards) {
      c.canvas.style.width = (44 * k) / dpr + 'px';
      c.canvas.style.height = (46 * k) / dpr + 'px';
    }
  }

  open() {
    this.root.hidden = false;
    this.row = 0;
    this.input.clearPresses();
    this.render();
  }

  close() {
    this.root.hidden = true;
    if (this.root.contains(document.activeElement)) document.activeElement.blur();
  }

  get isOpen() {
    return !this.root.hidden;
  }

  /** Linhas do menu em cada modo: 0 lutador, 1 modo, 2 CPU, 3 segundo lutador, 4 mapa, 5 começar. */
  rows() {
    return {
      arcade: [0, 1, 2, 5], versus: [0, 1, 3, 4, 5], survival: [0, 1, 5], training: [0, 1, 3, 4, 5], free: [0, 1, 5],
      team: [0, 1, 2, 5], chaos: [0, 1, 2, 3, 4, 5], trials: [0, 1, 5],
    }[this.sel.mode];
  }

  start() {
    Game.Sound.unlock();
    Game.Sound.play('confirm');
    // Equipes com menos de 3: completa com lutadores sorteados
    if (this.sel.mode === 'team' && this.sel.team.length < 3) {
      this.sel.team = Game.Team.fill(this.sel.team);
      this.render();
    }
    if (this.opts.onStart) this.opts.onStart(Object.assign({}, this.sel));
  }

  render() {
    const ch = Game.characters[this.sel.char];
    const team = this.sel.mode === 'team';
    for (const c of this.cards) {
      const on = c.key === this.sel.char;
      const slot = team ? this.sel.team.indexOf(c.key) : -1;
      c.btn.classList.toggle('is-selected', team ? slot >= 0 : on);
      c.btn.setAttribute('aria-checked', (team ? slot >= 0 : on) ? 'true' : 'false');
      c.btn.classList.toggle('is-current', on && this.row === 0);
      c.badge.hidden = slot < 0;
      c.badge.textContent = slot >= 0 ? String(slot + 1) : '';
    }
    this.info.textContent = ch.blurb;
    this.root.classList.toggle('is-team', team); // a faixa da equipe toma o lugar da descrição
    this.renderTeam(team);
    const mark = (row, value, current) => {
      for (const chip of row.querySelectorAll('.chip')) {
        const on = chip.dataset.value === value;
        chip.classList.toggle('is-selected', on);
        chip.setAttribute('aria-checked', on ? 'true' : 'false');
        chip.classList.toggle('is-current', on && current);
      }
    };
    mark(this.rowMode, this.sel.mode, this.row === 1);
    mark(this.rowLevel, this.sel.level, this.row === 2);
    mark(this.rowP2, this.sel.p2, this.row === 3);
    mark(this.rowStage, this.sel.stage, this.row === 4);
    const rows = this.rows();
    this.rowLevel.hidden = !rows.includes(2);
    this.rowP2.hidden = !rows.includes(3);
    this.rowStage.hidden = !rows.includes(4);
    this.p2Label.textContent = this.sel.mode === 'training' ? 'Boneco' : this.sel.mode === 'chaos' ? 'Adversário' : 'Jogador 2';
    const m = this.sel.mode;
    const best = Game.records ? Game.records.get('survivalBest', 0) : 0;
    const trialsDone = Game.Trials ? Game.Trials.progress(this.sel.char) : 0;
    const trialsTotal = Game.Trials ? Game.Trials.missions(this.sel.char, Game.Trials.KEYS).length : 0;
    const trialsAll = Game.Trials ? Game.Trials.completedFighters() : 0;
    this.note.textContent = {
      arcade: '4 lutas: três adversários sorteados e, no final, a sua Sombra (no telhado, à noite).',
      versus: 'Jogador 1: W A S D, F soco, G especial, H super, T domínio · Jogador 2: setas, K soco, L especial, Ç super, O domínio. Controles de videogame também funcionam.',
      survival: 'Lutas seguidas de 1 round contra adversários cada vez mais fortes; a vida só volta um pouco entre elas. Recorde: ' + best + (best === 1 ? ' vitória.' : ' vitórias.'),
      training: 'Vida infinita e barra sempre cheia (teste o domínio com I). N (ou a pausa) mostra as zonas de ataque; o boneco muda na pausa.',
      free: 'A fase de plataforma: caixas para quebrar, bonecos que fogem e Q para trocar de lutador.',
      team: 'Monte sua equipe de 3 (J ou toque põe e tira). Lutas de 1 round: quem vence fica com a vida que sobrou.',
      chaos: 'Luta contra a CPU em que a regra muda a cada 12 segundos: lua, turbo, dano em dobro, vampiro, meteoros, gelo, tudo ao contrário...',
      trials: 'Missões com ' + ch.name + ' contra um boneco: ' + trialsDone + ' de ' + trialsTotal + ' feitas. Lutadores com tudo completo: ' + trialsAll + ' de ' + Game.characterOrder.length + '.',
    }[m];
    this.startBtn.textContent = {
      arcade: 'LUTAR!', versus: 'LUTAR!', survival: 'COMEÇAR!', training: 'TREINAR!', free: 'JOGAR!', team: 'LUTAR!', chaos: 'CAOS!', trials: 'DESAFIAR!',
    }[m];
    this.startBtn.classList.toggle('is-current', this.row === 5);
  }

  /** Faixa com os 3 escolhidos (só no modo Equipes). */
  renderTeam(on) {
    const strip = this.teamStrip;
    strip.hidden = !on;
    if (!on) return;
    const key = this.sel.team.join(',');
    if (strip.dataset.team === key) return;
    strip.dataset.team = key;
    strip.innerHTML = '';
    const label = document.createElement('span');
    label.className = 'row-label';
    label.textContent = 'Equipe';
    strip.appendChild(label);
    for (let i = 0; i < 3; i++) {
      const k = this.sel.team[i];
      const slot = document.createElement('span');
      slot.className = 'team-slot' + (k ? '' : ' is-empty');
      const n = document.createElement('b');
      n.textContent = i + 1 + 'º';
      slot.appendChild(n);
      if (k) {
        const ch = Game.characters[k];
        const c = document.createElement('canvas');
        Game.FightHud.drawFace(c, new Game.SpriteSheet(Game.sprites[ch.sprite]), ch.portrait, false);
        const name = document.createElement('span');
        name.textContent = ch.name;
        name.style.color = ch.color;
        slot.append(c, name);
      } else {
        const name = document.createElement('span');
        name.textContent = i === this.sel.team.length ? 'escolha' : '—';
        slot.appendChild(name);
      }
      strip.appendChild(slot);
    }
  }

  frame(dt) {
    if (!this.isOpen) return;
    const inp = this.input;
    const rows = this.rows();
    if (!rows.includes(this.row)) this.row = 0;
    let changed = false;
    const ri = rows.indexOf(this.row);
    if (inp.consumePress('up')) {
      this.row = rows[Math.max(0, ri - 1)];
      changed = true;
    }
    if (inp.consumePress('down')) {
      this.row = rows[Math.min(rows.length - 1, ri + 1)];
      changed = true;
    }
    const dx = (inp.consumePress('right') ? 1 : 0) - (inp.consumePress('left') ? 1 : 0);
    if (dx) {
      const cycle = (list, value) => list[(list.indexOf(value) + dx + list.length) % list.length];
      if (this.row === 0) this.sel.char = cycle(Game.characterOrder, this.sel.char);
      if (this.row === 1) this.sel.mode = cycle(Game.Menu.MODES, this.sel.mode);
      if (this.row === 2) this.sel.level = cycle(['easy', 'normal', 'hard'], this.sel.level);
      if (this.row === 3) this.sel.p2 = cycle(Game.characterOrder, this.sel.p2);
      if (this.row === 4) this.sel.stage = cycle(Game.stageOrder, this.sel.stage);
      changed = changed || this.row !== 5;
    }
    if (changed) {
      Game.Sound.play('select');
      this.render();
    }
    inp.consumePress('jump'); // Espaço confirma (pela ação confirm); o pulo é descartado
    if (inp.consumePress('confirm')) {
      if (this.sel.mode === 'team' && this.row === 0) this.toggleTeam(this.sel.char); // Equipes: J/Enter põe ou tira
      else this.start();
    }

    // sprites animados: o escolhido fica em guarda, os outros respirando
    for (const c of this.cards) {
      const ch = Game.characters[c.key];
      const role = c.key === this.sel.char ? (ch.anims.guard || 'idle') : 'idle';
      c.anim.play(role);
      c.anim.update(dt);
      const ctx = c.ctx;
      ctx.clearRect(0, 0, c.canvas.width, c.canvas.height);
      const x = Math.round(c.canvas.width / 2 - c.def.anchor.x);
      const y = c.canvas.height - c.def.anchor.y;
      c.sheet.draw(ctx, c.anim.frame, x, y, false);
    }
  }
};

Game.Menu.MODES = ['arcade', 'versus', 'survival', 'team', 'chaos', 'trials', 'training', 'free'];

Game.VsScreen = class VsScreen {
  constructor(root, input) {
    this.root = root;
    this.input = input;
    this.faces = [...root.querySelectorAll('.vs-face')];
    this.names = [...root.querySelectorAll('.vs-name')];
    this.stage = root.querySelector('#vs-stage');
    this.timer = 0;
    this.onDone = null;
    root.addEventListener('pointerdown', () => this.finish());
  }

  /** a, b: lutadores (Game.Fighter); info: texto de cima. */
  show(a, b, info, onDone) {
    [a, b].forEach((f, i) => {
      Game.FightHud.drawFace(this.faces[i], f.sheet, f.char.portrait, i === 1);
      this.names[i].textContent = f.displayName;
      this.names[i].style.color = f.shadow ? '#d6a8ff' : f.char.color;
    });
    this.stage.textContent = info;
    this.root.hidden = false;
    this.root.classList.remove('vs-in');
    void this.root.offsetWidth;
    this.root.classList.add('vs-in');
    this.timer = 1.9;
    this.onDone = onDone;
    this.input.clearPresses();
  }

  finish() {
    if (this.root.hidden) return;
    this.root.hidden = true;
    const done = this.onDone;
    this.onDone = null;
    if (done) done();
  }

  frame(dt) {
    if (this.root.hidden) return;
    this.timer -= dt;
    if (this.input.consumePress('confirm') || this.timer <= 0) this.finish();
  }
};

/** Painel com título, texto e botões (fim de luta, pausa). */
Game.PanelScreen = class PanelScreen {
  constructor(root, input) {
    this.root = root;
    this.input = input;
    this.nav = { index: 0 };
  }

  get isOpen() {
    return !this.root.hidden;
  }

  buttons() {
    return [...this.root.querySelectorAll('button:not([disabled])')];
  }

  open() {
    this.root.hidden = false;
    this.nav.index = 0;
    this.input.clearPresses();
    const first = this.buttons()[0];
    if (first) first.focus({ preventScroll: true });
  }

  close() {
    this.root.hidden = true;
    if (this.root.contains(document.activeElement)) document.activeElement.blur();
  }

  frame() {
    if (!this.isOpen) return;
    this.input.consumePress('jump');
    Game.navButtons(this.input, this.buttons(), this.nav);
  }
};
