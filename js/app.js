/*
 * App: as telas do jogo, os modos e o laço principal.
 *
 * Telas: menu → (vs) → fight → result, mais a pausa; e "free" (fase de plataforma).
 * Modos:
 *   arcade    4 lutas: três adversários sorteados e, no fim, a SOMBRA (cópia sombria
 *             do seu lutador, no telhado, à noite, com a CPU um nível mais difícil)
 *   versus    2 jogadores no mesmo teclado (ou com controles)
 *   survival  lutas seguidas de 1 round; a vida só volta um pouco; recorde salvo
 *   training  arena com boneco configurável, vida infinita e zonas de ataque visíveis
 *   free      a fase de plataforma com caixas e bonecos
 *   team      EQUIPES 3x3: quem vence fica com a vida que sobrou e enfrenta o próximo
 *   chaos     CAOS: luta contra a CPU com regras malucas que mudam a cada 12 segundos
 *   trials    DESAFIOS: missões de cada lutador contra um boneco (progresso salvo)
 * (regras dos três últimos em js/modes.js)
 *
 * A física roda em passos fixos (config.physics.fixedStep) e a tela é desenhada
 * interpolando entre o passo anterior e o atual: o movimento fica liso em
 * qualquer monitor e o pulo tem sempre a mesma altura.
 */
window.Game = window.Game || {};

/** Recordes guardados no navegador (se o navegador não deixar, o jogo segue sem). */
Game.records = {
  get(key, fallback) {
    try {
      const v = window.localStorage.getItem('lutaPixel.' + key);
      return v === null ? fallback : JSON.parse(v);
    } catch (err) {
      return fallback;
    }
  },
  set(key, value) {
    try {
      window.localStorage.setItem('lutaPixel.' + key, JSON.stringify(value));
    } catch (err) {
      // sem armazenamento: o recorde vale só até fechar a página
    }
  },
};

Game.App = class App {
  constructor(els, renderer, input, saved = {}) {
    this.els = els;
    this.renderer = renderer;
    this.input = input;
    this.vsInputs = { p1: new Game.Input(Game.config.keysVersus.p1), p2: new Game.Input(Game.config.keysVersus.p2) };
    this.step = Game.config.physics.fixedStep;
    this.acc = 0;
    this.screen = null;
    this.paused = false;
    this.scene = null;
    this.fight = null;
    this.selection = null;
    this.firstFight = true;
    this.dummyMode = 'stand';

    this.ui = new Game.UI(els, input, {
      onSwitch: () => this.switchTraining(),
      onTouch: () => this.updateChrome(),
    });
    this.touch = new Game.TouchControls(els.touch, input);
    this.superBtn = els.touch.querySelector('.tbtn-super');
    this.domainBtn = els.touch.querySelector('.tbtn-domain');
    this.hud = new Game.FightHud(els.hud, els.stage);
    this.menu = new Game.Menu(els.menu, input, { selection: saved.select, onStart: (sel) => this.begin(sel) });
    this.vs = new Game.VsScreen(els.vs, input);
    this.result = new Game.PanelScreen(els.result, input);
    this.pauseScreen = new Game.PanelScreen(els.pause, input);
    this.wirePause();
    this.wireSounds();
    this.wireTraining();
    renderer.onResize = () => {
      if (this.scene) this.scene.followCamera(renderer.view, 0, true);
    };

    els.pauseBtn.addEventListener('click', (e) => {
      e.preventDefault();
      els.pauseBtn.blur();
      this.setPaused(true);
    });
    // Saiu da aba ou da janela no meio do jogo: pausa sozinho
    const autoPause = () => {
      if (this.isPlaying && !this.paused) this.setPaused(true);
    };
    window.addEventListener('blur', autoPause);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) autoPause();
    });

    if (saved.free && saved.select && saved.select.mode === 'free') {
      this.selection = saved.select;
      this.startFree(saved.select.char, saved.free);
    } else {
      this.showMenu();
    }
  }

  get isPlaying() {
    return this.screen === 'fight' || this.screen === 'free';
  }

  get mode() {
    return this.selection ? this.selection.mode : 'arcade';
  }

  // ------------------------------------------------------------------ ligações
  wireSounds() {
    const map = {
      jump: 'jump', swing: 'swing', block: 'block', crack: 'crack', break: 'break', thud: 'thud', alert: 'alert',
      knockdown: 'knockdown', land: 'land', charge: 'charge', charged: 'charged', fire: 'fire',
      fireBig: 'fireBig', explode: 'explode', dash: 'dash', switch: 'switch', throw: 'throw', bookHit: 'bookHit',
      clash: 'clash', dizzy: 'dizzy', koBig: 'ko', round: 'round', fight: 'fight', tick: 'tick',
      timeup: 'round', perfect: 'perfect', super: 'super', beam: 'beam', grab: 'grab', toss: 'toss',
      tech: 'tech', rise: 'rise', freeze: 'freeze', shatter: 'shatter', teleport: 'teleport', iceCast: 'iceCast',
      boltCast: 'boltCast', blizzard: 'blizzard', thunderCall: 'boltCast', domainCast: 'domainCast',
      domainOpen: 'domainOpen', domainBreak: 'domainBreak', sureWarn: 'sureWarn', domainClashStart: 'domainClash',
      domainClash: 'domainBreak', domainThunder: 'thunderFar', torchOn: 'torch', gateSlam: 'gateSlam', weld: 'weld',
      cageBoom: 'cageBoom', rooted: 'rooted',
      kunai: 'kunai', kunaiHit: 'kunaiHit', copied: 'copy', counterStance: 'counterStance', counter: 'counter', crow: 'crow',
      revoada: 'revoada', bubbleThrow: 'bubbleThrow', timeBubble: 'timeBubble', rewindCast: 'rewindCast', rewind: 'rewind',
      timeStop: 'timeStop', timeResume: 'timeResume', blackHole: 'blackHole', holeCollapse: 'holeCollapse',
      antigravCast: 'antigravCast', floatUp: 'floatUp', gravSlam: 'gravSlam', starGrow: 'starGrow', starThrow: 'starThrow',
      novaHold: 'novaHold', supernova: 'supernova', counterHit: 'counterHit', bounce: 'bounce',
      threadShot: 'threadShot', stringAttach: 'stringAttach', stringSnap: 'stringSnap', yank: 'yank', tangle: 'tangle',
      inverted: 'inverted', curtain: 'curtain', puppetCatch: 'puppetCatch', puppetCut: 'puppetCut',
      bombThrow: 'bombThrow', bombBounce: 'bombBounce', boom: 'boom', boomSmall: 'boomSmall', boomBig: 'boomBig',
      fuseTick: 'fuseTick', timebombPlant: 'timebombPlant', timebombPass: 'timebombPass', fuseLight: 'fuseLight',
      barrelRoll: 'barrelRoll', boomFar: 'boomFar', chaosRule: 'chaosRule', trialDone: 'trialDone', trialsAll: 'perfect',
      rootCast: 'rootCast', rootBurst: 'rootBurst', rootCurve: 'rootWhip', armorUp: 'armorUp', armorHit: 'armorHit',
      armorBreak: 'armorBreak', armorFade: 'armorFade', oakPlant: 'oakPlant', forestGrow: 'forestGrow',
      pawnPlace: 'pawnPlace', pawnStep: 'pawnStep', pawnLeap: 'pawnLeap', pawnBreak: 'pawnBreak', pawnPromote: 'pawnPromote',
      queenRush: 'queenRush', knightJump: 'knightJump', knightLand: 'knightLand', checkLine: 'checkLine', check: 'check',
      matePiece: 'matePiece', checkmate: 'checkmate', zugzwang: 'zugzwang',
    };
    Game.events.on('toss', (d) => { if (d.castle) Game.Sound.play('castle'); });
    for (const [event, sound] of Object.entries(map)) Game.events.on(event, () => Game.Sound.play(sound));
    Game.events.on('hit', (d) => Game.Sound.play(d.heavy ? 'heavy' : 'hit'));
    Game.events.on('strike', (d) => Game.Sound.play(d.sound));
    // o navegador só libera áudio depois de um gesto do jogador
    const unlock = () => Game.Sound.unlock();
    window.addEventListener('keydown', unlock);
    window.addEventListener('pointerdown', unlock);
  }

  wireTraining() {
    Game.events.on('hit', () => {
      if (this.screen === 'free') this.ui.addHit();
    });
    Game.events.on('knockdown', (d) => {
      if (this.screen === 'free' && d.target instanceof Game.Npc) this.ui.announce('NOCAUTE!');
    });
  }

  wirePause() {
    const root = this.els.pause;
    const soundBtn = root.querySelector('[data-act="sound"]');
    const musicBtn = root.querySelector('[data-act="music"]');
    const boxBtn = root.querySelector('[data-act="hitboxes"]');
    this.refreshToggles = () => {
      soundBtn.textContent = 'Som: ' + (Game.Sound.muted ? 'desligado' : 'ligado');
      soundBtn.setAttribute('aria-pressed', Game.Sound.muted ? 'false' : 'true');
      musicBtn.textContent = 'Música: ' + (Game.Sound.musicOn ? 'ligada' : 'desligada');
      musicBtn.setAttribute('aria-pressed', Game.Sound.musicOn ? 'true' : 'false');
      const boxes = !!(this.scene && this.scene.showHitboxes);
      boxBtn.textContent = 'Zonas de ataque: ' + (boxes ? 'visíveis' : 'ocultas');
      boxBtn.setAttribute('aria-pressed', boxes ? 'true' : 'false');
      for (const b of root.querySelectorAll('[data-dummy]')) b.setAttribute('aria-pressed', b.dataset.dummy === this.dummyMode ? 'true' : 'false');
    };
    root.addEventListener('click', (e) => {
      const dummy = e.target.closest('[data-dummy]');
      if (dummy) {
        this.setDummy(dummy.dataset.dummy);
        this.refreshToggles();
        return;
      }
      const btn = e.target.closest('[data-act]');
      if (!btn) return;
      const act = btn.dataset.act;
      if (act === 'resume') this.setPaused(false);
      if (act === 'restart') this.restart();
      if (act === 'menu') this.showMenu();
      if (act === 'sound') {
        Game.Sound.unlock();
        Game.Sound.setMuted(!Game.Sound.muted);
      }
      if (act === 'music') {
        Game.Sound.unlock();
        Game.Sound.setMusic(!Game.Sound.musicOn);
      }
      if (act === 'hitboxes') this.toggleHitboxes(false);
      this.refreshToggles();
    });
    this.refreshToggles();
  }

  setDummy(mode) {
    this.dummyMode = mode;
    if (this.fight && this.fight.training && this.fight.p2.controller.setMode) this.fight.p2.controller.setMode(mode);
  }

  toggleHitboxes(announce = true) {
    if (!this.scene || this.mode !== 'training') return;
    this.scene.showHitboxes = !this.scene.showHitboxes;
    if (announce) this.ui.toast(this.scene.showHitboxes ? 'Zonas de ataque visíveis (N esconde)' : 'Zonas de ataque ocultas');
  }

  // ------------------------------------------------------------------ telas
  /** Mostra/esconde HUD, botão de pausa, selo e controles de toque conforme a tela. */
  updateChrome() {
    if (!this.touch || !this.screen) return; // ainda montando a interface
    const playing = this.isPlaying;
    this.els.pauseBtn.hidden = !playing || this.paused;
    this.els.badge.hidden = this.screen !== 'free' || this.paused;
    this.els.touch.hidden = !(this.ui.touchMode && playing && !this.paused);
    this.els.stage.classList.toggle('is-fight', this.screen === 'fight' || this.screen === 'result');
    this.els.pause.classList.toggle('is-training', this.mode === 'training' && this.screen === 'fight');
    this.ui.setPlaying(playing && !this.paused);
    if (!playing) this.touch.releaseAll();
  }

  endScene() {
    if (this.trials) this.trials.destroy();
    this.trials = null;
    if (this.fight) this.fight.destroy();
    this.fight = null;
    this.scene = null;
    this.hud.show(false);
    this.ui.clearAnnounce();
    this.ui.setHint(null);
    this.ui.trainInfo(null);
    this.touch.releaseAll();
    for (const inp of [this.input, this.vsInputs.p1, this.vsInputs.p2]) inp.reset();
    Game.Pads.releaseAll();
    this.paused = false;
    this.pauseScreen.close();
    this.result.close();
    this.vs.root.hidden = true;
    this.els.combo.hidden = true;
    this.acc = 0;
  }

  showMenu() {
    this.endScene();
    Game.Sound.stopMusic();
    this.screen = 'menu';
    this.renderer.setViewHeight(Game.config.view.fightHeight);
    const st = Game.stageScene('campo');
    this.scene = new Game.Scene(st.level, st.opts);
    this.scene.followCamera(this.renderer.view, 0, true);
    this.updateChrome();
    this.menu.open();
  }

  begin(sel) {
    this.selection = sel;
    this.menu.close();
    if (sel.mode === 'free') return this.startFree(sel.char);
    if (sel.mode === 'arcade') {
      this.ladder = this.buildLadder(sel);
      this.stageIndex = 0;
      return this.startStage();
    }
    if (sel.mode === 'survival') {
      this.survival = { wins: 0, hp: Game.config.fight.maxHp, last: null, best: Game.records.get('survivalBest', 0) };
      return this.startSurvival();
    }
    if (sel.mode === 'versus') return this.startVersus();
    if (sel.mode === 'training') return this.startArenaTraining();
    if (sel.mode === 'team') {
      const mine = Game.Team.fill(sel.team);
      this.team = {
        mine, theirs: Game.Team.fill([]), hpMine: [100, 100, 100], hpTheirs: [100, 100, 100], i: 0, j: 0, bout: 0, kos: 0, current: null,
      };
      return this.startTeamBout();
    }
    if (sel.mode === 'chaos') return this.startChaos();
    if (sel.mode === 'trials') return this.startTrials();
    return undefined;
  }

  /** Equipes 3x3: a próxima luta (1 round) entre quem está de pé em cada equipe. */
  startTeamBout(skipIntro = false) {
    const t = this.team;
    if (!skipIntro || !t.current) {
      t.bout += 1;
      t.current = { stage: Game.stageOrder[Math.floor(Math.random() * Game.stageOrder.length)] };
    }
    const view = (list, k, hp) => list.map((key, n) => ({ key, state: n < k ? 'out' : n === k ? 'now' : 'next', hp: hp[n] }));
    const me = Game.characters[t.mine[t.i]];
    const them = Game.characters[t.theirs[t.j]];
    const info = 'Equipes · Luta ' + t.bout + ' · ' + me.name + ' (' + Math.round(t.hpMine[t.i]) + '%) contra ' + them.name
      + ' (' + Math.round(t.hpTheirs[t.j]) + '%)';
    this.launchFight(t.current.stage, {
      p1: t.mine[t.i], p2: t.theirs[t.j], level: this.selection.level, rounds: 1, fightNumber: t.bout,
      p1Hp: t.hpMine[t.i], p2Hp: t.hpTheirs[t.j],
      teamView: { left: view(t.mine, t.i, t.hpMine), right: view(t.theirs, t.j, t.hpTheirs) },
    }, skipIntro ? null : info);
  }

  /** Caos: uma luta contra a CPU com regras que mudam. */
  startChaos(skipIntro = false) {
    const sel = this.selection;
    this.launchFight(sel.stage, { p1: sel.char, p2: sel.p2, level: sel.level, chaos: true },
      skipIntro ? null : 'Caos · ' + Game.stages[sel.stage].name + ' · a regra muda a cada 12 segundos');
  }

  /** Desafios: arena com um boneco parado, vida e barra infinitas e as missões no alto da tela. */
  startTrials() {
    const sel = this.selection;
    this.dummyMode = 'stand';
    this.launchFight('dojo', { p1: sel.char, p2: 'glasses', training: true, p2Controller: new Game.DummyController('stand') }, null);
    const touch = this.ui.touchMode;
    const keys = touch ? { p: 'SOCO', s: 'ESP', x: 'SUPER', d: 'DOMÍNIO', fw: '→', bk: '←' } : Game.Trials.KEYS;
    this.trials = new Game.Trials(this.fight, this.els.stage.querySelector('#trials'), keys);
    this.fight.trials = this.trials;
  }

  /** Arcade: 3 adversários sorteados entre os outros lutadores e, no fim, a Sombra. */
  buildLadder(sel) {
    const others = Game.characterOrder.filter((k) => k !== sel.char);
    for (let i = others.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [others[i], others[j]] = [others[j], others[i]];
    }
    const levels = ['easy', 'normal', 'hard'];
    const boss = levels[Math.min(levels.length - 1, levels.indexOf(sel.level) + 1)];
    const stages = ['dojo', 'campo', 'campoTarde', 'bambuzal', 'deserto', 'observatorio'];
    for (let i = stages.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [stages[i], stages[j]] = [stages[j], stages[i]];
    }
    // quem tem uma "casa" (os lutadores novos) luta nela; os outros num mapa sorteado
    const ladder = others.slice(0, 3).map((key, i) => ({
      p2: key, level: sel.level, stage: Game.characters[key].stage || stages[i % stages.length],
    }));
    ladder.push({ p2: sel.char, shadow: true, level: boss, stage: 'cidade', theme: 'boss' });
    return ladder;
  }

  /** Monta uma luta (cena + Fight) e mostra a tela VS antes, se info for dada. */
  launchFight(stageKey, fightOpts, info, theme) {
    this.endScene();
    this.screen = 'vs';
    this.renderer.setViewHeight(Game.config.view.fightHeight);
    const st = Game.stageScene(stageKey);
    this.scene = new Game.Scene(st.level, st.opts);
    this.fight = new Game.Fight(this.scene, Object.assign({
      hud: this.hud, ui: this.ui, onEnd: (r) => { this.pendingResult = r; },
    }, fightOpts));
    this.scene.followCamera(this.renderer.view, 0, true);
    this.updateChrome();
    const go = () => {
      this.screen = 'fight';
      this.hud.show(true);
      for (const inp of [this.input, this.vsInputs.p1, this.vsInputs.p2]) inp.reset();
      this.fight.begin();
      this.musicTheme = theme || st.stage.theme || 'fight';
      Game.Sound.startMusic(this.musicTheme);
      const hintMode = this.mode === 'versus' ? 'versus' : this.mode === 'training' ? 'arena' : 'fight';
      if (this.mode !== 'trials') this.ui.setHint(hintMode, this.firstFight || this.mode === 'versus' || this.mode === 'training');
      this.firstFight = false;
      this.updateChrome();
    };
    if (!info) {
      go();
      return;
    }
    this.vs.show(this.fight.p1, this.fight.p2, info, go);
  }

  startStage(skipIntro = false) {
    const st = this.ladder[this.stageIndex];
    const stage = Game.stages[st.stage];
    const info = 'Luta ' + (this.stageIndex + 1) + ' de ' + this.ladder.length + ' · ' + stage.name
      + (st.shadow ? ' · Desafio final' : '');
    this.launchFight(st.stage, { p1: this.selection.char, p2: st.p2, p2Shadow: st.shadow, level: st.level },
      skipIntro ? null : info, st.theme);
  }

  startSurvival(skipIntro = false) {
    const sv = this.survival;
    const n = sv.wins + 1;
    if (!skipIntro || !sv.current) {
      const pool = Game.characterOrder.filter((k) => k !== sv.last);
      const shadow = n % 5 === 0; // a cada 5 lutas, a própria sombra
      const p2 = shadow ? this.selection.char : pool[Math.floor(Math.random() * pool.length)];
      const stage = Game.stageOrder[Math.floor(Math.random() * Game.stageOrder.length)];
      const level = sv.wins < 3 ? 'easy' : sv.wins < 7 ? 'normal' : 'hard';
      sv.current = { p2, shadow, stage, level, hp: sv.hp };
      sv.last = p2;
    }
    const c = sv.current;
    const info = 'Sobrevivência · Luta ' + n + ' · Recorde ' + sv.best;
    this.launchFight(c.stage, {
      p1: this.selection.char, p2: c.p2, p2Shadow: c.shadow, level: c.level, rounds: 1, p1Hp: c.hp, fightNumber: n,
    }, skipIntro ? null : info, c.shadow ? 'boss' : null);
  }

  startVersus(skipIntro = false) {
    const sel = this.selection;
    this.launchFight(sel.stage, {
      p1: sel.char, p2: sel.p2, p1Controller: this.vsInputs.p1, p2Controller: this.vsInputs.p2,
    }, skipIntro ? null : 'Versus · ' + Game.stages[sel.stage].name + ' · Jogador 1 contra Jogador 2');
  }

  startArenaTraining() {
    const sel = this.selection;
    this.launchFight(sel.stage, {
      p1: sel.char, p2: sel.p2, training: true, p2Controller: new Game.DummyController(this.dummyMode),
    }, null);
  }

  showResult(r) {
    this.screen = 'result';
    this.ui.clearAnnounce();
    this.ui.setHint(null);
    this.updateChrome();
    Game.Sound.stopMusic();
    const mode = this.mode;
    const p1 = this.fight.p1;
    const p2 = this.fight.p2;
    const root = this.els.result;
    const title = root.querySelector('#result-title');
    const sub = root.querySelector('#result-sub');
    const stats = root.querySelector('#result-stats');
    const actions = root.querySelector('#result-actions');
    const score = r.wins[0] + ' a ' + r.wins[1];
    const quoteOf = (f) => {
      const list = f.shadow ? Game.shadowQuotes : f.char.quotes || [];
      return list.length ? f.displayName + ': “' + list[Math.floor(Math.random() * list.length)] + '”' : '';
    };
    const lines = [];
    let buttons;
    root.dataset.result = r.result;
    if (mode === 'team') {
      ({ buttons } = this.teamResult(r, p1, p2, title, sub, lines, quoteOf));
    } else if (mode === 'chaos') {
      title.textContent = r.result === 'win' ? 'VOCÊ VENCEU O CAOS!' : r.result === 'lose' ? 'O CAOS VENCEU' : 'EMPATE';
      root.dataset.result = r.result === 'draw' ? 'draw' : r.result;
      sub.textContent = r.result === 'draw' ? 'Ninguém aguentou o caos (' + score + ').' : quoteOf(r.result === 'win' ? p1 : p2);
      lines.push(['Placar:', score], ['Regras sorteadas:', String(r.fight.chaosRules || 0)]);
      buttons = [['Revanche', 'retry'], ['Menu principal', 'menu']];
      Game.Sound.play(r.result === 'win' ? 'win' : 'lose');
    } else if (mode === 'versus') {
      title.textContent = r.result === 'win' ? 'JOGADOR 1 VENCEU!' : r.result === 'lose' ? 'JOGADOR 2 VENCEU!' : 'EMPATE';
      root.dataset.result = r.result === 'draw' ? 'draw' : 'win';
      sub.textContent = r.result === 'draw' ? 'Placar ' + score + '.' : quoteOf(r.result === 'win' ? p1 : p2);
      lines.push(['Placar:', score], ['Mapa:', Game.stages[this.selection.stage].name]);
      buttons = [['Revanche', 'retry'], ['Trocar lutadores', 'menu']];
      Game.Sound.play('win');
    } else if (mode === 'survival') {
      const sv = this.survival;
      if (r.result === 'win') {
        sv.wins += 1;
        sv.hp = Math.min(p1.maxHp, p1.hp + 30);
        sv.current = null;
        if (sv.wins > sv.best) {
          sv.best = sv.wins;
          Game.records.set('survivalBest', sv.best);
        }
        title.textContent = sv.wins + (sv.wins === 1 ? ' VITÓRIA!' : ' VITÓRIAS!');
        sub.textContent = quoteOf(p1) + ' A vida volta um pouco: ' + Math.round(sv.hp) + '%.';
        buttons = [['Próxima luta', 'nextSurvival'], ['Parar aqui', 'menu']];
        Game.Sound.play('win');
      } else {
        root.dataset.result = 'lose';
        title.textContent = 'FIM DA LINHA';
        sub.textContent = quoteOf(p2);
        buttons = [['Começar de novo', 'againSurvival'], ['Menu principal', 'menu']];
        Game.Sound.play('lose');
      }
      lines.push(['Vitórias seguidas:', String(sv.wins)], ['Recorde:', String(sv.best)]);
    } else {
      const last = this.stageIndex === this.ladder.length - 1;
      if (r.result === 'win' && last) {
        title.textContent = 'CAMPEÃO!';
        sub.textContent = 'Você derrotou a própria Sombra e terminou o arcade no ' + this.levelName(this.selection.level) + '. ' + quoteOf(p1);
        buttons = [['Jogar de novo', 'again'], ['Menu principal', 'menu']];
        Game.Sound.play('win');
      } else if (r.result === 'win') {
        const next = this.ladder[this.stageIndex + 1];
        const nextName = next.shadow ? 'SOMBRA' : Game.characters[next.p2].short;
        title.textContent = 'VOCÊ VENCEU!';
        sub.textContent = quoteOf(p1) + ' Próximo desafiante: ' + nextName + '.';
        buttons = [['Próxima luta', 'next'], ['Menu principal', 'menu']];
        Game.Sound.play('win');
      } else if (r.result === 'lose') {
        title.textContent = 'VOCÊ PERDEU';
        sub.textContent = quoteOf(p2) + ' Dica: segure para trás para defender.';
        buttons = [['Revanche', 'retry'], ['Trocar lutador', 'menu']];
        Game.Sound.play('lose');
      } else {
        title.textContent = 'EMPATE';
        sub.textContent = 'Ninguém levou a melhor (' + score + ').';
        buttons = [['Revanche', 'retry'], ['Menu principal', 'menu']];
        Game.Sound.play('lose');
      }
      const st = this.ladder[this.stageIndex];
      lines.push(['Placar:', score]);
      lines.push(['Luta:', (this.stageIndex + 1) + ' de ' + this.ladder.length + ' (' + this.levelName(st.level) + ')']);
    }
    const s = r.stats;
    lines.push(['Maior combo:', s.maxCombo >= 2 ? s.maxCombo + ' golpes' : '—']);
    if (s.perfects) lines.push(['Perfeitos:', String(s.perfects)]);
    stats.innerHTML = '';
    for (const [label, value] of lines) {
      const li = document.createElement('li');
      const b = document.createElement('b');
      b.textContent = value;
      li.append(label + ' ', b);
      stats.appendChild(li);
    }
    actions.innerHTML = '';
    for (const [label, act] of buttons) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'big-btn' + (act === 'menu' ? ' big-btn-alt' : '');
      b.textContent = label;
      b.addEventListener('click', () => this.resultAction(act));
      actions.appendChild(b);
    }
    this.result.open();
  }

  /** Equipes 3x3: quem caiu sai, quem venceu fica (com a vida que sobrou e um pouco mais). */
  teamResult(r, p1, p2, title, sub, lines, quoteOf) {
    const t = this.team;
    const rec = Game.Team.recover;
    const meName = Game.characters[t.mine[t.i]].name;
    const themName = Game.characters[t.theirs[t.j]].name;
    let text;
    if (r.result === 'win') {
      t.hpMine[t.i] = Math.min(100, p1.hp + rec);
      t.hpTheirs[t.j] = 0;
      t.j += 1;
      t.kos += 1;
      text = meName + ' derrubou ' + themName + '.';
    } else if (r.result === 'lose') {
      t.hpTheirs[t.j] = Math.min(100, p2.hp + rec);
      t.hpMine[t.i] = 0;
      t.i += 1;
      text = themName + ' derrubou ' + meName + '.';
    } else {
      t.hpMine[t.i] = 0;
      t.hpTheirs[t.j] = 0;
      t.i += 1;
      t.j += 1;
      t.kos += 1;
      text = 'Os dois caíram juntos.';
    }
    t.current = null;
    const root = this.els.result;
    let buttons;
    const left = (list, k) => list.slice(k).map((key) => Game.characters[key].name).join(', ') || 'ninguém';
    if (t.j >= 3) {
      title.textContent = 'SUA EQUIPE VENCEU!';
      root.dataset.result = 'win';
      sub.textContent = text + ' ' + quoteOf(p1);
      buttons = [['Jogar de novo', 'againTeam'], ['Menu principal', 'menu']];
      Game.Sound.play('win');
    } else if (t.i >= 3) {
      title.textContent = 'SUA EQUIPE CAIU';
      root.dataset.result = 'lose';
      sub.textContent = text + ' ' + quoteOf(p2);
      buttons = [['Tentar de novo', 'againTeam'], ['Menu principal', 'menu']];
      Game.Sound.play('lose');
    } else {
      title.textContent = r.result === 'win' ? meName.toUpperCase() + ' VENCEU!' : r.result === 'lose' ? meName.toUpperCase() + ' CAIU' : 'EMPATE';
      root.dataset.result = r.result === 'draw' ? 'draw' : r.result;
      const next = Game.characters[t.mine[t.i]].name + ' (' + Math.round(t.hpMine[t.i]) + '%) contra '
        + Game.characters[t.theirs[t.j]].name + ' (' + Math.round(t.hpTheirs[t.j]) + '%)';
      sub.textContent = text + ' Próxima luta: ' + next + '.';
      buttons = [['Próxima luta', 'nextTeam'], ['Desistir', 'menu']];
      Game.Sound.play(r.result === 'win' ? 'win' : 'lose');
    }
    lines.push(['Sua equipe de pé:', left(t.mine, t.i)], ['Equipe da CPU de pé:', left(t.theirs, t.j)], ['Derrubados:', t.kos + ' de 3']);
    return { buttons };
  }

  levelName(level) {
    return { easy: 'Fácil', normal: 'Normal', hard: 'Difícil' }[level] || level;
  }

  resultAction(act) {
    Game.Sound.play('confirm');
    if (act === 'next') {
      this.stageIndex += 1;
      this.startStage();
    } else if (act === 'retry') {
      if (this.mode === 'versus') this.startVersus();
      else if (this.mode === 'chaos') this.startChaos();
      else this.startStage();
    } else if (act === 'nextTeam') {
      this.startTeamBout();
    } else if (act === 'againTeam') {
      this.begin(this.selection);
    } else if (act === 'again') {
      this.stageIndex = 0;
      this.startStage();
    } else if (act === 'nextSurvival') {
      this.startSurvival();
    } else if (act === 'againSurvival') {
      this.begin(this.selection);
    } else {
      this.showMenu();
    }
  }

  startFree(charKey, saved = null) {
    this.endScene();
    Game.Sound.stopMusic();
    this.screen = 'free';
    this.renderer.setViewHeight(Game.config.view.height);
    this.scene = new Game.Scene(Game.levels.level1, { mode: 'training', character: charKey, saved });
    const p = this.scene.player;
    this.ui.setCharacter(p.char);
    if (p.char.intro) p.startAttack(p.char.intro); // entrada com aura
    this.scene.followCamera(this.renderer.view, 0, true);
    this.ui.setHint('training');
    this.updateChrome();
  }

  switchTraining() {
    if (this.screen === 'free' && !this.paused && this.scene) this.scene.player.switchCharacter(this.scene);
  }

  restart() {
    const mode = this.mode;
    if (this.screen === 'free') return this.startFree(this.selection ? this.selection.char : Game.characterOrder[0]);
    if (mode === 'versus') return this.startVersus(true);
    if (mode === 'survival') return this.startSurvival(true);
    if (mode === 'training') return this.startArenaTraining();
    if (mode === 'team') return this.startTeamBout(true);
    if (mode === 'chaos') return this.startChaos(true);
    if (mode === 'trials') return this.startTrials();
    return this.startStage(true);
  }

  setPaused(on) {
    if (!this.isPlaying || on === this.paused) return;
    this.paused = on;
    this.touch.releaseAll();
    for (const inp of [this.input, this.vsInputs.p1, this.vsInputs.p2]) inp.reset();
    if (on) {
      Game.Sound.stopMusic();
      this.renderMoves();
      this.renderHowto();
      this.refreshToggles();
      this.els.pause.classList.toggle('is-training', this.mode === 'training' && this.screen === 'fight');
      this.pauseScreen.open();
    } else {
      this.pauseScreen.close();
      if (this.screen === 'fight' && this.musicTheme) Game.Sound.startMusic(this.musicTheme);
      this.acc = 0;
    }
    this.updateChrome();
  }

  /** Lista de golpes do lutador do jogador 1 (e do 2 no versus). */
  renderMoves() {
    const el = this.els.pause.querySelector('#movelist');
    el.innerHTML = '';
    const fighters = this.fight ? (this.mode === 'versus' ? [this.fight.p1, this.fight.p2] : [this.fight.p1])
      : this.scene && this.scene.player ? [this.scene.player] : [];
    const touch = this.ui.touchMode;
    for (const f of fighters) {
      const ch = f.char;
      const k = this.mode === 'versus'
        ? (f === this.fight.p1 ? { p: 'F', s: 'G', x: 'H', d: 'T', fw: 'D', bk: 'A', up: 'W' } : { p: 'K', s: 'L', x: 'Ç', d: 'O', fw: '←', bk: '→', up: '↑' })
        : touch ? { p: 'SOCO', s: 'ESP', x: 'SUPER', d: 'DOMÍNIO', fw: '→', bk: '←' } : { p: 'J', s: 'K', x: 'L', d: 'I', fw: '→', bk: '←', up: '↑ ou Espaço' };
      const head = document.createElement('h3');
      head.textContent = ch.name;
      head.style.color = ch.color;
      el.appendChild(head);
      const free = this.screen === 'free';
      const dom = Game.DOMAINS[f.charKey];
      const moves = [
        [ch.comboName || 'Combo: soco, soco, chute', k.p + ' ' + k.p + ' ' + k.p],
        [ch.airAttackName || (ch.airAttack === 'airKick' ? 'Chute aéreo' : 'Soco aéreo'), k.p + ' no ar'],
        [ch.specialName + (ch.special === 'energyBall' ? ' (segure para carregar)' : ch.special === 'teleport' ? ' (com ' + k.bk + ': para trás)'
          : ch.special === 'thread' ? ' (preso: ' + k.s + ' de novo puxa)' : ch.special === 'bomb' ? ' (mira sozinha · ' + k.bk + ' perto · ' + k.fw + ' longe)'
          : ch.special === 'root' ? ' (1ª curva por baixo, 2ª por cima)'
          : ch.special === 'pawn' ? ' (captura na diagonal; no fim vira dama · um golpe quebra)' : ''),
          free ? k.s : k.s + '  ou  ↓ ↘ → + ' + k.p],
      ];
      if (!free) moves.push(['Rasteira (só se defende agachado)', '↓ + ' + k.p]);
      if (ch.special2 && !free) {
        const note = ch.special2 === 'tangle' ? ' (de perto, ou pelo fio)' : ch.special2 === 'timebomb' ? ' (acerte o outro para passar)'
          : ch.special2 === 'armor' ? ' (o cajado vira armadura: maior, bate mais e toma menos dano)'
          : ch.special2 === 'knight' ? ' (pousa atrás do adversário e pisa: defende em pé · com ' + k.bk + ': foge)' : '';
        moves.push([ch.special2Name + note, '↓ + ' + k.s + '  ou  ↓ ↙ ← + ' + k.p]);
      }
      if (ch.float && !free) moves.push(['Planar (cai devagar no ar)', 'segure ' + (touch ? 'PULO' : k.up || '↑') + ' no ar']);
      if (!free) {
        moves.push(
          ['Super: ' + ch.superName.toLowerCase() + ' (meia barra)', k.x],
          ['Domínio: ' + dom.name.toLowerCase() + ' (barra cheia)', k.d],
          ['No domínio', dom.perk],
          ch.castle ? ['Roque (agarrão: troca de lugar e a torre cai)', k.fw + ' ou ' + k.bk + ' + ' + k.p + ' colado']
            : ['Agarrão (frente / trás)', k.fw + ' + ' + k.p + '  /  ' + k.bk + ' + ' + k.p + ' colado'],
          ['Escapar do agarrão · embate', k.p + ' na hora · ' + k.p + ' sem parar'],
        );
      }
      for (const [name, keys] of moves) {
        const p = document.createElement('p');
        const span = document.createElement('span');
        span.textContent = name;
        const b = document.createElement('b');
        b.textContent = keys;
        if (name === 'No domínio') {
          // explicação: quebra a linha em vez de ficar ao lado
          p.className = 'move-note';
          span.textContent = name + ': ';
        }
        p.append(span, b);
        el.appendChild(p);
      }
    }
  }

  renderHowto() {
    const el = this.els.pause.querySelector('#howto');
    const touch = this.ui.touchMode;
    const fight = this.screen === 'fight';
    let rows;
    if (this.mode === 'versus' && fight) {
      rows = [
        ['Jogador 1', 'W A S D andar/pular/agachar · F soco · G especial · H super · T domínio'],
        ['Jogador 2', 'setas · K soco · L especial · Ç super · O domínio (ou 1 2 3 0 do teclado numérico)'],
        ['Controles', 'direcional, A soco, B especial, Y pula, RB/RT super, LB/LT domínio, Start pausa'],
      ];
    } else if (touch) {
      rows = [
        ['Direcional', 'andar · para trás defende · cima pula · baixo agacha'],
        ['SOCO', fight ? 'soco, soco, chute apertando de novo · baixo + SOCO: rasteira' : 'combo apertando de novo'],
        ['ESP / SUPER', fight ? 'especial (↓ + ESP: segundo especial) · super com meia barra' : 'especial'],
        ['DOMÍNIO', fight ? 'Expansão de Domínio com a barra toda cheia (10 s)' : '—'],
        ['2 toques ← ou →', 'dash'],
      ];
    } else {
      rows = [
        ['A D / ← →', fight ? 'andar · para trás defende' : 'andar'],
        ['S / ↓', fight ? 'agachar (defende a rasteira)' : '—'],
        ['W / ↑ / Espaço', 'pular'],
        ['J · K · L', fight ? 'soco · especial · super (meia barra)' : 'soco · especial'],
        ['I', fight ? 'Expansão de Domínio (barra toda cheia, 10 s)' : '—'],
        ['↓ + K', fight && this.fight && this.fight.p1.char.special2 ? this.fight.p1.char.special2Name.toLowerCase() : '—'],
        ['← ← / → →', fight ? 'dash (soco no meio sai com embalo)' : '—'],
        ['CONTRA!', fight ? 'bater no começo do golpe dele: +dano' : '—'],
        ['M · H' + (this.mode === 'training' ? ' · N' : ''), 'som · dicas' + (this.mode === 'training' ? ' · zonas de ataque' : '')],
      ];
    }
    el.innerHTML = '';
    const dl = document.createElement('dl');
    for (const [k, v] of rows.filter((r) => r[1] !== '—')) {
      const dt = document.createElement('dt');
      dt.textContent = k;
      const dd = document.createElement('dd');
      dd.textContent = v;
      dl.append(dt, dd);
    }
    el.appendChild(dl);
  }

  // ------------------------------------------------------------------ laço
  frame(dt) {
    const inp = this.input;
    // controles de videogame: no versus cada controle é um jogador
    const versusFight = this.mode === 'versus' && this.screen === 'fight';
    Game.Pads.poll(versusFight ? [this.vsInputs.p1, this.vsInputs.p2] : [inp, null], inp);

    if (inp.consumePress('mute')) {
      Game.Sound.unlock();
      Game.Sound.setMuted(!Game.Sound.muted);
      this.ui.toast(Game.Sound.muted ? 'Som desligado (M liga de novo)' : 'Som ligado');
      this.refreshToggles();
    }
    if (inp.consumePress('help') && !versusFight) this.ui.toggleHint();
    if (inp.consumePress('hitboxes') && this.screen === 'fight' && !this.paused) this.toggleHitboxes();
    if (inp.consumePress('pause') && this.isPlaying) this.setPaused(!this.paused);

    if (this.paused) {
      this.pauseScreen.frame();
    } else if (this.isPlaying || this.screen === 'result') {
      this.simulate(dt);
    }
    if (this.pendingResult) {
      const r = this.pendingResult;
      this.pendingResult = null;
      this.showResult(r);
    }
    if (this.trials && !this.paused) this.trials.frame(dt);
    this.menu.frame(dt);
    this.vs.frame(dt);
    this.result.frame();
    this.ui.update(dt);
    if (this.superBtn) {
      const ready = !!(this.fight && this.screen === 'fight' && this.fight.p1.superReady);
      if (ready !== this.superReady) {
        this.superReady = ready;
        this.superBtn.classList.toggle('is-ready', ready);
      }
      const dom = !!(this.fight && this.screen === 'fight' && this.fight.p1.domainReady);
      if (dom !== this.domainReadyShown) {
        this.domainReadyShown = dom;
        this.domainBtn.classList.toggle('is-ready', dom);
      }
    }
    this.updateMusic();
    if (this.scene) {
      const live = !this.paused && (this.isPlaying || this.screen === 'result');
      this.scene.draw(this.renderer, live ? this.acc / this.step : 1);
    }
  }

  /** No domínio a música muda; quando ele acaba (ou o round recomeça) volta a do mapa. */
  updateMusic() {
    if (this.screen !== 'fight' || this.paused || !this.musicTheme || !this.fight || this.fight.over) return;
    const d = this.scene && this.scene.domain;
    const want = d && (d.phase === 'reveal' || d.phase === 'active' || d.clash) ? 'domain' : this.musicTheme;
    if (Game.Sound.themeName !== want) Game.Sound.startMusic(want);
  }

  simulate(dt) {
    const fight = this.fight;
    const running = fight && !fight.over;
    this.acc += dt * (running ? fight.timeScale * (fight.speed || 1) : 1);
    let n = 0;
    while (this.acc >= this.step) {
      this.scene.update(this.step, this.input, this.renderer.view);
      if (running) fight.update(this.step);
      this.acc -= this.step;
      if (++n >= 15) {
        this.acc = 0; // aba travou: não tenta recuperar o atraso todo de uma vez
        break;
      }
      if (running && fight.over) break;
    }
    if (running) fight.frame(dt);
  }

  /** Estado para continuar de onde parou quando a página é atualizada pelo visualizador. */
  snapshot() {
    const data = { select: this.menu.sel };
    if (this.screen === 'free' && this.scene) data.free = this.scene.snapshot();
    return data;
  }
};
