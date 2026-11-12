/*
 * SpriteSheet: recorta e desenha um quadro (opcionalmente espelhado).
 * Animator: avança os quadros de uma animação definida em sprites.js.
 */
window.Game = window.Game || {};

Game.SpriteSheet = class SpriteSheet {
  /** image (opcional) troca a imagem da folha, por exemplo pela versão sombria. */
  constructor(def, image = null) {
    this.def = def;
    this.image = image || Game.assets.get(def.image);
    this.columns = Math.max(1, Math.floor(this.image.width / def.frameWidth));
  }

  /** Desenha só um pedaço do quadro (retratos do HUD). */
  drawPart(ctx, frame, sx, sy, sw, sh, dx, dy, flipX) {
    const fw = this.def.frameWidth;
    const fh = this.def.frameHeight;
    const ox = (frame % this.columns) * fw;
    const oy = Math.floor(frame / this.columns) * fh;
    ctx.save();
    if (flipX) {
      ctx.translate(dx + sw, dy);
      ctx.scale(-1, 1);
      ctx.drawImage(this.image, ox + sx, oy + sy, sw, sh, 0, 0, sw, sh);
    } else {
      ctx.drawImage(this.image, ox + sx, oy + sy, sw, sh, dx, dy, sw, sh);
    }
    ctx.restore();
  }

  /** flash = true desenha a silhueta branca do quadro (piscada ao levar um golpe). */
  draw(ctx, frame, x, y, flipX, flash = false) {
    const fw = this.def.frameWidth;
    const fh = this.def.frameHeight;
    const sx = (frame % this.columns) * fw;
    const sy = Math.floor(frame / this.columns) * fh;
    const img = flash ? this.flashImage : this.image;
    if (flipX) {
      ctx.save();
      ctx.translate(x + fw, y);
      ctx.scale(-1, 1);
      ctx.drawImage(img, sx, sy, fw, fh, 0, 0, fw, fh);
      ctx.restore();
    } else {
      ctx.drawImage(img, sx, sy, fw, fh, x, y, fw, fh);
    }
  }

  /** Silhueta da folha numa cor (contorno da aura). Uma por cor, criada quando usada. */
  tinted(color) {
    this._tints = this._tints || {};
    if (!this._tints[color]) {
      const canvas = document.createElement('canvas');
      canvas.width = this.image.width;
      canvas.height = this.image.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(this.image, 0, 0);
      ctx.globalCompositeOperation = 'source-in';
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      this._tints[color] = canvas;
    }
    return this._tints[color];
  }

  /** Versão toda branca da folha, criada só na primeira vez que for usada. */
  get flashImage() {
    if (!this._flash) {
      const canvas = document.createElement('canvas');
      canvas.width = this.image.width;
      canvas.height = this.image.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(this.image, 0, 0);
      ctx.globalCompositeOperation = 'source-in';
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      this._flash = canvas;
    }
    return this._flash;
  }
};

/**
 * Versão "Sombra" de uma folha (o chefe do arcade): corpo escurecido com contorno
 * roxo brilhante. Feita uma vez, só com operações de composição do canvas
 * (funciona até abrindo o index.html direto do disco).
 */
Game.shadowImage = function (spriteKey) {
  Game._shadowCache = Game._shadowCache || {};
  if (Game._shadowCache[spriteKey]) return Game._shadowCache[spriteKey];
  const def = Game.sprites[spriteKey];
  const img = Game.assets.get(def.image);
  const make = () => {
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    return c;
  };
  const tinted = (color, alpha) => {
    const c = make();
    const x = c.getContext('2d');
    x.drawImage(img, 0, 0);
    x.globalCompositeOperation = 'source-atop';
    x.globalAlpha = alpha;
    x.fillStyle = color;
    x.fillRect(0, 0, c.width, c.height);
    return c;
  };
  const body = tinted('#140a2a', 0.8);
  const glow = tinted('#b47cff', 1);
  const out = make();
  const ctx = out.getContext('2d');
  const fw = def.frameWidth;
  const fh = def.frameHeight;
  // contorno: silhueta roxa deslocada 1 px para cada lado, presa à célula de cada quadro
  for (let sx = 0; sx < img.width; sx += fw) {
    for (let sy = 0; sy < img.height; sy += fh) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(sx, sy, fw, fh);
      ctx.clip();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) ctx.drawImage(glow, dx, dy);
      ctx.restore();
    }
  }
  ctx.drawImage(body, 0, 0);
  Game._shadowCache[spriteKey] = out;
  return out;
};

Game.Animator = class Animator {
  constructor(def) {
    this.def = def;
    this.name = null;
    this.index = 0;
    this.time = 0;
    this.finished = false; // true quando uma animação sem loop chega ao fim
  }

  /** Troca de animação. Não reinicia se já estiver tocando a mesma, a menos que restart = true. */
  play(name, restart = false) {
    if (name === this.name && !restart) return;
    if (!this.def.animations[name]) throw new Error('Animação "' + name + '" não existe em sprites.js.');
    this.name = name;
    this.index = 0;
    this.time = 0;
    this.finished = false;
  }

  update(dt) {
    const anim = this.def.animations[this.name];
    this.time += dt;
    let duration = this._duration(anim, this.index);
    while (this.time >= duration) {
      if (anim.loop === false && this.index === anim.frames.length - 1) {
        this.finished = true;
        this.time = duration;
        break;
      }
      this.time -= duration;
      this.index = (this.index + 1) % anim.frames.length;
      duration = this._duration(anim, this.index);
    }
  }

  _duration(anim, i) {
    return anim.durations ? anim.durations[i] : 1 / anim.fps;
  }

  get current() {
    return this.def.animations[this.name];
  }

  get frame() {
    return this.current.frames[this.index];
  }
};
