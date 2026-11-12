/*
 * Controles de videogame (Gamepad API). A cada quadro lê os controles conectados e
 * transforma os botões em ações de Game.Input, como se fossem teclas:
 *   direcional ou analógico esquerdo  andar / pular (cima) / agachar (baixo)
 *   A ou X                            soco (A também confirma nos menus)
 *   B                                 especial
 *   Y                                 pular
 *   RB ou RT                          super
 *   LB ou LT                          Expansão de Domínio
 *   Start                             pausa
 * Funciona no Chrome, Edge, Firefox e Safari recentes; o navegador só mostra os
 * controles depois que algum botão é apertado.
 */
window.Game = window.Game || {};

Game.Pads = {
  states: new Map(), // "índice:destino" → últimas ações ligadas

  /** targets[i] = Input que recebe o controle i (null ignora). extra: Input que recebe só a pausa/menus. */
  poll(targets, menuInput) {
    const list = navigator.getGamepads ? navigator.getGamepads() : [];
    for (let i = 0; i < list.length; i++) {
      const pad = list[i];
      if (!pad || !pad.connected) continue;
      const a = this.read(pad);
      if (targets[i]) this.apply(i + ':game', targets[i], a);
      // qualquer controle também navega nos menus e pausa
      if (menuInput && menuInput !== targets[i]) {
        this.apply(i + ':menu', menuInput, {
          left: a.left, right: a.right, up: a.up, down: a.down, confirm: a.confirm, pause: a.pause,
        });
      }
    }
  },

  read(pad) {
    const b = (n) => !!(pad.buttons[n] && pad.buttons[n].pressed);
    const ax = pad.axes || [];
    const x = ax[0] || 0;
    const y = ax[1] || 0;
    const left = b(14) || x < -0.5;
    const right = b(15) || x > 0.5;
    const up = b(12) || y < -0.6;
    const down = b(13) || y > 0.6;
    return {
      left, right, up, down,
      jump: up || b(3),
      punch: b(0) || b(2),
      special: b(1),
      super: b(5) || b(7),
      domain: b(4) || b(6),
      pause: b(9),
      confirm: b(0) || b(9),
    };
  },

  apply(key, input, actions) {
    const last = this.states.get(key) || {};
    for (const [action, on] of Object.entries(actions)) {
      if (!!last[action] !== on) input.setVirtual(action, on);
    }
    this.states.set(key, actions);
  },

  /** Solta tudo o que os controles estavam segurando (troca de tela). */
  releaseAll() {
    this.states.clear();
  },
};
