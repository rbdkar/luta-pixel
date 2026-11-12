/*
 * Ponto de entrada: carrega as imagens, cria o renderer, a entrada e o App
 * (telas + laço principal) e chama app.frame() a cada quadro do navegador.
 */
window.Game = window.Game || {};

(function () {
  const $ = (id) => document.getElementById(id);
  const els = {
    stage: $('stage'),
    canvas: $('screen'),
    backdrop: $('backdrop'),
    hud: $('hud'),
    hint: $('hint'),
    focusHint: $('focus-hint'),
    error: $('error'),
    touch: $('touch'),
    badge: $('badge'),
    badgeName: $('badge-name'),
    badgeDot: $('badge-dot'),
    combo: $('combo'),
    comboCount: $('combo-count'),
    trainInfo: $('train-info'),
    announce: $('announce'),
    toast: $('toast'),
    pauseBtn: $('pause-btn'),
    menu: $('menu'),
    vs: $('vs'),
    result: $('result'),
    pause: $('pause'),
  };

  function showError(err) {
    console.error(err);
    els.error.textContent = err && err.message ? err.message : String(err);
    els.error.hidden = false;
  }

  function start(saved) {
    try {
      const renderer = new Game.Renderer(els.canvas, els.stage, els.backdrop);
      const input = new Game.Input(Game.config.keys);
      const app = new Game.App(els, renderer, input, saved || {});
      Game.current = { renderer, input, app }; // útil para inspecionar no console

      // Mantém a seleção (e a posição no treino) quando a página é atualizada pelo visualizador do Claude
      const hot = window.claude && window.claude.hot;
      if (hot && hot.snapshot) hot.snapshot(() => app.snapshot());

      let last = performance.now();
      const frame = (now) => {
        const dt = Math.min(Math.max(0, now - last) / 1000, 0.1); // evita "saltos" ao voltar de outra aba
        last = now;
        try {
          app.frame(dt);
        } catch (err) {
          showError(err);
          return;
        }
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    } catch (err) {
      showError(err);
    }
  }

  Game.assets.load()
    .then(() => {
      const hot = window.claude && window.claude.hot;
      if (hot && hot.ready) hot.ready(start);
      else start((hot && hot.data) || {});
    })
    .catch(showError);
})();
