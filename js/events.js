/*
 * Mensageiro simples: partes do jogo avisam o que aconteceu ("hit", "jump"...)
 * e quem quiser (som, HUD) escuta, sem um precisar conhecer o outro.
 * on() devolve uma função que cancela a inscrição (usada ao sair de uma luta).
 */
window.Game = window.Game || {};

Game.events = {
  _handlers: {},

  on(name, fn) {
    if (!this._handlers[name]) this._handlers[name] = [];
    this._handlers[name].push(fn);
    return () => this.off(name, fn);
  },

  off(name, fn) {
    const list = this._handlers[name];
    if (list) this._handlers[name] = list.filter((f) => f !== fn);
  },

  emit(name, data) {
    for (const fn of (this._handlers[name] || []).slice()) {
      try {
        fn(data || {});
      } catch (err) {
        console.error(err);
      }
    }
  },
};
