/*
 * Interface comum por cima do canvas:
 *  - avisos grandes (ROUND 1, LUTE!, K.O.) e mensagens rápidas;
 *  - dica de controles do modo atual (some sozinha; H mostra de novo);
 *  - no treino: selo do personagem (clicar/tocar troca, igual ao Q) e contador de combo;
 *  - aviso "Clique na tela para jogar" quando a página não recebe o teclado;
 *  - modo toque: liga os controles de toque em telas sensíveis ao toque.
 */
window.Game = window.Game || {};

Game.HINTS = {
  fight: [
    [['A', 'D'], ['←', '→'], 'andar · para trás defende'],
    [['S'], ['↓'], 'agachar'],
    [['W', 'Espaço'], null, 'pular'],
    [['J'], ['X'], 'soco (combo)'],
    [['K'], ['C'], 'especial'],
    [['L'], ['V'], 'super (meia barra)'],
    [['I'], ['B'], 'domínio (barra cheia)'],
    [['→', '+J'], null, 'colado: agarrão'],
    [['Esc'], null, 'pausa'],
  ],
  arena: [
    [['A', 'D'], ['←', '→'], 'andar · para trás defende'],
    [['J'], null, 'soco'],
    [['K'], null, 'especial'],
    [['L'], null, 'super'],
    [['I'], null, 'domínio'],
    [['N'], null, 'zonas de ataque'],
    [['Esc'], null, 'pausa e boneco'],
  ],
  versus: [
    [['J1:', 'W', 'A', 'S', 'D'], null, ''],
    [['F', 'G', 'H', 'T'], null, 'soco · esp. · super · domínio'],
    [['J2:', '←', '↑', '↓', '→'], null, ''],
    [['K', 'L', 'Ç', 'O'], null, 'soco · esp. · super · domínio'],
    [['Esc'], null, 'pausa'],
  ],
  training: [
    [['A', 'D'], ['←', '→'], 'andar'],
    [['Espaço'], null, 'pular'],
    [['J'], ['X'], 'socar (combo)'],
    [['K'], ['C'], 'especial'],
    [['Q'], null, 'trocar'],
    [['Esc'], null, 'pausa'],
  ],
};

Game.UI = class UI {
  constructor(els, input, hooks = {}) {
    this.els = els;
    this.input = input;
    this.hooks = hooks;
    this.touchMode = false;
    this.combo = 0;
    this.comboTimer = 0;
    this.timers = {};
    this.hintMode = null;

    // Dica de controles: some alguns segundos depois que o jogador começa
    input.onActivity = () => {
      if (this.hintMode && this.hintTimer === null) {
        this.hintTimer = setTimeout(() => els.hint.classList.add('is-hidden'), 6000);
      }
    };
    this.hintTimer = null;

    // Foco do teclado (necessário quando o jogo está dentro de outra página)
    const updateFocus = () => {
      els.focusHint.hidden = this.touchMode || !this.wantsKeys || document.hasFocus();
    };
    window.addEventListener('focus', updateFocus);
    window.addEventListener('blur', updateFocus);
    els.stage.addEventListener('pointerdown', () => {
      window.focus();
      updateFocus();
    });
    this.updateFocus = updateFocus;
    this.wantsKeys = false;

    // Selo do personagem (treino): clicar troca
    els.badge.addEventListener('click', (e) => {
      e.preventDefault();
      if (this.hooks.onSwitch) this.hooks.onSwitch();
      els.badge.blur();
    });

    Game.events.on('switch', (d) => {
      this.setCharacter(d.character);
      this.toast(d.character.name + ': ' + d.character.tip, 3.4);
    });

    // Toque
    const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    if (coarse) this.enableTouch();
    window.addEventListener('touchstart', () => this.enableTouch(), { once: true, passive: true });
  }

  /** Em jogo o teclado importa: mostra o aviso de foco se a página não o tiver. */
  setPlaying(on) {
    this.wantsKeys = on;
    this.updateFocus();
  }

  setCharacter(ch) {
    this.els.badgeName.textContent = ch.name;
    this.els.badgeDot.style.background = ch.color;
  }

  /** Mostra a dica de controles do modo ('fight' ou 'training'); null esconde. */
  setHint(mode, show = true) {
    const el = this.els.hint;
    this.hintMode = mode;
    clearTimeout(this.hintTimer);
    clearTimeout(this.hintFallback);
    this.hintTimer = null;
    if (!mode || this.touchMode) {
      el.classList.add('is-hidden');
      return;
    }
    el.innerHTML = '';
    for (const [keys, alt, label] of Game.HINTS[mode]) {
      const row = document.createElement('span');
      row.className = 'hint-row';
      const addKeys = (list) => list.forEach((k) => {
        const kbd = document.createElement('kbd');
        kbd.textContent = k;
        if (k.length > 2) kbd.className = 'kbd-wide';
        row.appendChild(kbd);
      });
      addKeys(keys);
      if (alt) {
        const or = document.createElement('span');
        or.className = 'hint-or';
        or.textContent = 'ou';
        row.appendChild(or);
        addKeys(alt);
      }
      const text = document.createElement('span');
      text.textContent = label;
      row.appendChild(text);
      el.appendChild(row);
    }
    el.classList.toggle('is-hidden', !show);
    // mesmo sem ninguém mexer, a dica não fica para sempre na frente da luta
    clearTimeout(this.hintFallback);
    if (show) this.hintFallback = setTimeout(() => el.classList.add('is-hidden'), 14000);
  }

  toggleHint() {
    if (!this.hintMode || this.touchMode) return;
    clearTimeout(this.hintTimer);
    clearTimeout(this.hintFallback);
    this.hintTimer = -1; // não some sozinha depois de pedida
    this.els.hint.classList.toggle('is-hidden');
  }

  /** Treino na arena: golpes e dano do último combo. null esconde. */
  trainInfo(combo) {
    const el = this.els.trainInfo;
    if (!combo) {
      el.hidden = true;
      return;
    }
    el.hidden = false;
    el.innerHTML = '';
    const b1 = document.createElement('b');
    b1.textContent = combo.hits;
    const b2 = document.createElement('b');
    b2.textContent = combo.dmg;
    el.append('Último combo: ', b1, combo.hits === 1 ? ' golpe · ' : ' golpes · ', b2, ' de dano');
  }

  /** Contador de golpes da fase livre (no centro). */
  addHit() {
    this.combo += 1;
    this.comboTimer = 1.4;
    if (this.combo >= 2) {
      this.els.comboCount.textContent = this.combo;
      this.els.combo.hidden = false;
      this.restartAnimation(this.els.combo);
    }
  }

  /** Aviso grande no meio da tela. variant: 'ko', 'fight', 'win', 'lose' mudam a cor. */
  announce(text, seconds = 1.1, variant = null) {
    const el = this.els.announce;
    el.textContent = text;
    el.className = 'announce' + (variant ? ' announce-' + variant : '');
    el.hidden = false;
    this.restartAnimation(el);
    clearTimeout(this.timers.announce);
    this.timers.announce = setTimeout(() => { el.hidden = true; }, seconds * 1000);
  }

  clearAnnounce() {
    clearTimeout(this.timers.announce);
    this.els.announce.hidden = true;
  }

  toast(text, seconds = 2) {
    const el = this.els.toast;
    el.textContent = text;
    el.hidden = false;
    clearTimeout(this.timers.toast);
    this.timers.toast = setTimeout(() => { el.hidden = true; }, seconds * 1000);
  }

  restartAnimation(el) {
    el.classList.remove('pop');
    void el.offsetWidth; // reinicia a animação CSS
    el.classList.add('pop');
  }

  /** Chamado uma vez por quadro. */
  update(dt) {
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.combo = 0;
        this.els.combo.hidden = true;
      }
    }
  }

  enableTouch() {
    if (this.touchMode) return;
    this.touchMode = true;
    document.body.classList.add('touch-mode');
    this.els.hint.classList.add('is-hidden'); // a dica fala de teclas; no toque os botões bastam
    this.updateFocus();
    if (this.hooks.onTouch) this.hooks.onTouch();
  }
};
