/*
 * Renderer: ajusta o canvas ao maior retângulo 16:9 que cabe na janela,
 * escolhe a escala dos pixels e oferece ajudantes de desenho.
 *
 * O canvas trabalha na resolução real da tela (inclusive em telas retina).
 * O mundo é desenhado com escala inteira e posições alinhadas aos pixels da tela,
 * por isso cada pixel de arte vira um quadrado nítido do mesmo tamanho.
 *
 * O fundo fica num segundo canvas, atrás do principal, e só é redesenhado quando
 * a janela muda de tamanho ou o clima muda: a cada quadro o navegador só precisa
 * desenhar o terreno e os personagens.
 */
window.Game = window.Game || {};

Game.Renderer = class Renderer {
  constructor(canvas, stage, backdrop) {
    this.canvas = canvas;
    this.stage = stage;
    this.backdrop = backdrop;
    this.ctx = canvas.getContext('2d');
    this.bctx = backdrop.getContext('2d', { alpha: false });
    this.scale = 1;
    this.targetHeight = Game.config.view.height;
    this.view = { w: 0, h: 0 };   // área visível em pixels do jogo
    this.camX = 0;                // deslocamento da câmera em pixels da tela
    this.camY = 0;
    this.background = null;
    this.look = null;
    this.onResize = null;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  /** Altura desejada da área visível (a luta usa uma câmera mais próxima). */
  setViewHeight(h) {
    if (h === this.targetHeight) return;
    this.targetHeight = h;
    this.resize();
  }

  resize() {
    const cfg = Game.config.view;
    const dpr = window.devicePixelRatio || 1;
    const availW = Math.max(1, Math.floor(window.innerWidth * dpr));
    const availH = Math.max(1, Math.floor(window.innerHeight * dpr));

    // Maior 16:9 que cabe (em pixels físicos da tela)
    let h = Math.min(availH, Math.floor(availW / cfg.aspect));
    let w = Math.round(h * cfg.aspect);
    if (w > availW) {
      w = availW;
      h = Math.round(w / cfg.aspect);
    }
    for (const c of [this.canvas, this.backdrop]) {
      c.width = w;
      c.height = h;
    }
    const cssW = w / dpr;
    const cssH = h / dpr;
    this.stage.style.width = cssW + 'px';
    this.stage.style.height = cssH + 'px';
    // unidade do HUD: 1% da altura do palco (tudo na interface escala junto)
    this.stage.style.setProperty('--u', (cssH / 100).toFixed(3) + 'px');

    const target = this.targetHeight;
    if (cfg.pixelPerfect) {
      // Escala inteira cuja altura visível fique mais perto da desejada
      const raw = h / target;
      const lo = Math.max(1, Math.floor(raw));
      const hi = Math.max(1, Math.ceil(raw));
      const err = (s) => Math.abs(Math.log(h / s / target));
      this.scale = err(lo) <= err(hi) ? lo : hi;
    } else {
      this.scale = h / target;
    }
    this.view = { w: w / this.scale, h: h / this.scale };

    // Mudar o tamanho do canvas reinicia o contexto: desliga a suavização de novo
    this.ctx.imageSmoothingEnabled = false;
    this.bctx.imageSmoothingEnabled = false;
    this.paintBackdrop();
    if (this.onResize) this.onResize(this.view);
  }

  /**
   * Fundo fixo; look (opcional) muda a luz: { sky: cor, stars: quantidade }.
   * Sem imagem (mapas com camadas de paralaxe), o fundo é só a cor color.
   */
  setBackground(img, look = null, color = '#0b1322') {
    if (img === this.background && look === this.look && color === this.backColor) return;
    this.background = img;
    this.look = look;
    this.backColor = color;
    this.paintBackdrop();
  }

  /** Cobre a tela inteira com o fundo, recortado sem distorcer a imagem. */
  paintBackdrop() {
    const ctx = this.bctx;
    const { width: cw, height: ch } = this.backdrop;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = this.backColor || '#0b1322';
    ctx.fillRect(0, 0, cw, ch);
    const img = this.background;
    if (!img) return;
    const s = Math.max(cw / img.width, ch / img.height);
    const sw = cw / s;
    const sh = ch / s;
    const sx = (img.width - sw) / 2;
    const sy = (img.height - sh) / 2;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cw, ch);
    const look = this.look;
    if (look && look.sky) {
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = look.sky;
      ctx.fillRect(0, 0, cw, ch);
      ctx.globalCompositeOperation = 'source-over';
    }
    if (look && look.stars) {
      // estrelas em posições fixas, no tamanho dos pixels do próprio céu
      const px = Math.max(1, Math.round(s));
      for (let i = 0; i < look.stars; i++) {
        const h = Game.hash2(i, 77);
        const x = (h % 1000) / 1000 * img.width;
        const y = ((h >>> 10) % 1000) / 1000 * img.height * 0.55;
        const big = (h >>> 20) % 5 === 0;
        ctx.fillStyle = big ? '#fff6d8' : '#c9d2ff';
        const X = Math.round((x - sx) * s);
        const Y = Math.round((y - sy) * s);
        ctx.fillRect(X, Y, px, px);
        if (big) {
          ctx.fillRect(X - px, Y, px * 3, px);
          ctx.fillRect(X, Y - px, px, px * 3);
        }
      }
    }
  }

  clear() {
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /** Arredonda uma posição do mundo para o pixel da tela mais próximo. */
  snap(v) {
    return Math.round(v * this.scale) / this.scale;
  }

  /**
   * Passa a desenhar em coordenadas do mundo, já descontando a câmera
   * (interpolada entre os dois últimos passos) e a tremida, se houver.
   */
  beginWorld(camera, offset = { x: 0, y: 0 }, alpha = 1) {
    const cx = camera.prevX === undefined ? camera.x : camera.prevX + (camera.x - camera.prevX) * alpha;
    const cy = camera.prevY === undefined ? camera.y : camera.prevY + (camera.y - camera.prevY) * alpha;
    this.camX = Math.round((cx + offset.x) * this.scale);
    this.camY = Math.round((cy + offset.y) * this.scale);
    this.ctx.setTransform(this.scale, 0, 0, this.scale, -this.camX, -this.camY);
  }

  endWorld() {
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  /** Área visível do mundo (para desenhar só o que aparece). */
  visibleRect() {
    return { x: this.camX / this.scale, y: this.camY / this.scale, w: this.view.w, h: this.view.h };
  }
};
