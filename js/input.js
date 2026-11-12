/*
 * Entrada do jogador: teclado e, em telas de toque, controles virtuais.
 * O resto do jogo só pergunta por ações ("left", "punch"...), nunca por teclas.
 * Uma tecla pode servir a mais de uma ação (W é "up" e "jump").
 */
window.Game = window.Game || {};

// Para navegadores/teclados que não informam event.code
Game.keyFallback = {
  a: 'KeyA', A: 'KeyA', d: 'KeyD', D: 'KeyD', w: 'KeyW', W: 'KeyW', s: 'KeyS', S: 'KeyS',
  j: 'KeyJ', J: 'KeyJ', x: 'KeyX', X: 'KeyX', k: 'KeyK', K: 'KeyK', c: 'KeyC', C: 'KeyC',
  q: 'KeyQ', Q: 'KeyQ', m: 'KeyM', M: 'KeyM', h: 'KeyH', H: 'KeyH', p: 'KeyP', P: 'KeyP',
  l: 'KeyL', L: 'KeyL', v: 'KeyV', V: 'KeyV', i: 'KeyI', I: 'KeyI', b: 'KeyB', B: 'KeyB', n: 'KeyN', N: 'KeyN',
  ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight', ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown',
  ' ': 'Space', Spacebar: 'Space', Escape: 'Escape', Esc: 'Escape', Enter: 'Enter',
};

Game.Input = class Input {
  constructor(keymap) {
    this.keymap = keymap;
    this.codeToActions = {};
    for (const [action, codes] of Object.entries(keymap)) {
      for (const code of codes) (this.codeToActions[code] = this.codeToActions[code] || []).push(action);
    }
    this.down = new Set();   // teclas físicas pressionadas agora
    this.virtual = {};       // controles de toque pressionados agora
    this.held = {};          // ação → está segurando?
    this.presses = {};       // ação → foi apertada desde a última leitura?
    this.onActivity = null;  // callback opcional (usado pela UI)
    this.enabled = true;

    window.addEventListener('keydown', (e) => this._onKey(e, true));
    window.addEventListener('keyup', (e) => this._onKey(e, false));
    // Ao perder o foco o navegador não envia keyup: solta tudo
    window.addEventListener('blur', () => this.reset());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.reset();
    });
    this._refresh();
  }

  _onKey(e, isDown) {
    const code = e.code || Game.keyFallback[e.key];
    const actions = this.codeToActions[code];
    if (!actions) return;
    if (e.target && e.target.closest && e.target.closest('button') && (code === 'Enter' || code === 'Space')) return;
    e.preventDefault(); // evita rolar a página com espaço/setas
    if (isDown) {
      if (!this.down.has(code)) {
        this.down.add(code);
        // repetição automática do teclado não conta como novo aperto
        if (!e.repeat) for (const a of actions) this._press(a);
      }
    } else {
      this.down.delete(code);
    }
    this._refresh();
  }

  _press(action) {
    this.presses[action] = true;
    if (this.onActivity) this.onActivity(action);
  }

  _refresh() {
    for (const [action, codes] of Object.entries(this.keymap)) {
      this.held[action] = codes.some((c) => this.down.has(c)) || !!this.virtual[action];
    }
  }

  /** Usado pelos controles de toque. */
  setVirtual(action, isDown) {
    if (isDown && !this.virtual[action]) this._press(action);
    this.virtual[action] = isDown;
    this._refresh();
  }

  isHeld(action) {
    return !!this.held[action];
  }

  /** true uma única vez por toque na tecla. */
  consumePress(action) {
    const pressed = !!this.presses[action];
    this.presses[action] = false;
    return pressed;
  }

  /** -1 esquerda, 0 parado, 1 direita */
  axisX() {
    return (this.held.right ? 1 : 0) - (this.held.left ? 1 : 0);
  }

  /** Descarta apertos acumulados (ao trocar de tela). */
  clearPresses() {
    this.presses = {};
  }

  reset() {
    this.down.clear();
    this.virtual = {};
    this.presses = {};
    this._refresh();
  }
};
