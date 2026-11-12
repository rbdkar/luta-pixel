/*
 * Controles de toque:
 *  - direcional analógico à esquerda: encoste em qualquer ponto da metade esquerda
 *    e arraste. Cima pula, baixo agacha; dá para fazer ↓ ↘ → girando o dedo.
 *    Dois toques rápidos para um lado = dash.
 *  - botões de arcade à direita: SOCO, ESPECIAL (segure para carregar) e PULO.
 * Cada botão vira uma "ação" em Game.Input, igual ao teclado. Vibração curta ao
 * apertar, onde o aparelho permitir.
 */
window.Game = window.Game || {};

Game.TouchControls = class TouchControls {
  constructor(root, input) {
    this.root = root;
    this.input = input;
    this.stick = root.querySelector('#stick');
    this.base = root.querySelector('.stick-base');
    this.knob = root.querySelector('.stick-knob');
    this.pointer = null;
    this.origin = null;
    this.dirs = { left: false, right: false, up: false, down: false };
    this.bindStick();
    for (const btn of root.querySelectorAll('[data-action]')) this.bindButton(btn);
  }

  buzz(ms = 8) {
    if (navigator.vibrate) {
      try { navigator.vibrate(ms); } catch (err) { /* sem vibração */ }
    }
  }

  bindStick() {
    const el = this.stick;
    const down = (e) => {
      if (this.pointer !== null) return;
      e.preventDefault();
      this.pointer = e.pointerId;
      this.capture(el, e.pointerId);
      const box = el.getBoundingClientRect();
      // a base aparece onde o dedo encostou (sem sair da área)
      const r = this.radius();
      const x = Math.min(Math.max(e.clientX - box.left, r), box.width - r);
      const y = Math.min(Math.max(e.clientY - box.top, r), box.height - r);
      this.origin = { x: box.left + x, y: box.top + y };
      this.base.style.left = x + 'px';
      this.base.style.top = y + 'px';
      el.classList.add('is-active');
      Game.Sound.unlock();
      this.move(e);
    };
    const move = (e) => {
      if (e.pointerId !== this.pointer) return;
      e.preventDefault();
      this.move(e);
    };
    const up = (e) => {
      if (e.pointerId !== this.pointer) return;
      this.pointer = null;
      el.classList.remove('is-active');
      this.knob.style.transform = '';
      this.base.style.left = '';
      this.base.style.top = '';
      this.setDirs(0, 0);
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('lostpointercapture', up);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /** Continua recebendo o dedo mesmo se ele sair do botão (se o navegador deixar). */
  capture(el, id) {
    try {
      if (el.setPointerCapture) el.setPointerCapture(id);
    } catch (err) {
      // sem captura o controle ainda funciona enquanto o dedo estiver em cima
    }
  }

  radius() {
    return this.base.offsetWidth / 2 || 48;
  }

  move(e) {
    if (!this.origin) return;
    const r = this.radius();
    let dx = e.clientX - this.origin.x;
    let dy = e.clientY - this.origin.y;
    const len = Math.hypot(dx, dy);
    const max = r * 0.62;
    const k = len > max ? max / len : 1;
    this.knob.style.transform = 'translate(' + (dx * k).toFixed(1) + 'px,' + (dy * k).toFixed(1) + 'px)';
    if (len < r * 0.28) {
      this.setDirs(0, 0); // zona morta no centro
      return;
    }
    // 8 direções: cada eixo liga quando o ângulo passa de ~22,5° em direção a ele
    dx /= len;
    dy /= len;
    const t = 0.38;
    this.setDirs(dx > t ? 1 : dx < -t ? -1 : 0, dy > t ? 1 : dy < -t ? -1 : 0);
  }

  setDirs(x, y) {
    const next = { left: x < 0, right: x > 0, up: y < 0, down: y > 0 };
    for (const k of Object.keys(next)) {
      if (next[k] === this.dirs[k]) continue;
      this.dirs[k] = next[k];
      this.input.setVirtual(k, next[k]);
      if (k === 'up') this.input.setVirtual('jump', next[k]); // cima também pula
      if (next[k] && (k === 'up' || k === 'down')) this.buzz(5);
    }
  }

  bindButton(btn) {
    const action = btn.dataset.action;
    const press = (e) => {
      e.preventDefault();
      this.capture(btn, e.pointerId);
      btn.classList.add('is-down');
      this.input.setVirtual(action, true);
      this.buzz(10);
      Game.Sound.unlock();
    };
    const release = () => {
      if (!btn.classList.contains('is-down')) return;
      btn.classList.remove('is-down');
      this.input.setVirtual(action, false);
    };
    btn.addEventListener('pointerdown', press);
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointercancel', release);
    btn.addEventListener('lostpointercapture', release);
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /** Solta tudo (ao pausar ou trocar de tela). */
  releaseAll() {
    this.setDirs(0, 0);
    for (const btn of this.root.querySelectorAll('.is-down')) {
      btn.classList.remove('is-down');
      this.input.setVirtual(btn.dataset.action, false);
    }
  }
};
