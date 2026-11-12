/*
 * TileMap: lê o mapa em texto da fase, decide qual imagem cada célula usa
 * (grama no topo, terra embaixo, com variações), guarda a vida dos blocos
 * quebráveis e responde perguntas de colisão.
 *
 * Desempenho: o terreno parado é pintado uma única vez numa imagem do tamanho
 * da fase ("cache"); a cada quadro só essa imagem é copiada, mais os blocos
 * quebráveis por cima (eles tremem e mudam ao levar golpes).
 */
window.Game = window.Game || {};

// Hash inteiro simples: mesma posição → mesmo número, sem padrão visível.
Game.hash2 = function (x, y) {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
};

Game.TileMap = class TileMap {
  /** look (opcional): { ground: cor } multiplica a cor do terreno (entardecer, noite). */
  constructor(level, look = null) {
    this.tileSize = Game.config.tileSize;
    this.groundTint = look && look.ground ? look.ground : null;
    const rows = level.map;
    this.height = rows.length;
    this.width = Math.max(...rows.map((r) => r.length));
    this.cells = new Array(this.width * this.height).fill(null);
    this.hp = new Array(this.width * this.height).fill(0);
    this.spawn = null;
    this.entitySpawns = []; // { className, col, row } para personagens marcados no mapa

    for (let r = 0; r < this.height; r++) {
      for (let c = 0; c < this.width; c++) {
        const ch = rows[r][c] || '.';
        if (ch === Game.spawnChar) this.spawn = { col: c, row: r };
        if (Game.entityLegend && Game.entityLegend[ch]) {
          this.entitySpawns.push({ className: Game.entityLegend[ch], col: c, row: r });
        }
        const typeName = Game.tileLegend[ch];
        if (typeName) {
          const type = Game.tileTypes[typeName];
          if (!type) throw new Error('Tipo de tile "' + typeName + '" não existe em tiles.js.');
          const i = r * this.width + c;
          this.cells[i] = type;
          if (type.breakable) this.hp[i] = type.hp;
        }
      }
    }
    if (!this.spawn && !level.fight) {
      throw new Error('A fase precisa de um "' + Game.spawnChar + '" marcando o início do jogador.');
    }

    this.pixelWidth = this.width * this.tileSize;
    this.pixelHeight = this.height * this.tileSize;
    this._mirrored = {};
    this._painted = new Map(); // imagem → versão escurecida/tingida
    this.shakes = new Map();   // célula → tempo restante do "tranco" ao levar um soco
    this.visuals = new Array(this.cells.length).fill(null);
    this.cache = null;
    for (let r = 0; r < this.height; r++) {
      for (let c = 0; c < this.width; c++) this.refreshCell(c, r);
    }
  }

  typeAt(col, row) {
    if (col < 0 || row < 0 || col >= this.width || row >= this.height) return null;
    return this.cells[row * this.width + col];
  }

  /** Linha do primeiro chão sólido de cima para baixo numa coluna (arena). */
  surfaceRow(col) {
    for (let r = 0; r < this.height; r++) if (this.isSolid(col, r)) return r;
    return this.height;
  }

  /** Bordas laterais e o fundo do mapa contam como sólidos; acima do mapa é céu aberto. */
  isSolid(col, row) {
    if (col < 0 || col >= this.width || row >= this.height) return true;
    if (row < 0) return false;
    const type = this.cells[row * this.width + col];
    return !!(type && type.solid);
  }

  anySolid(col0, row0, col1, row1) {
    for (let r = row0; r <= row1; r++) {
      for (let c = col0; c <= col1; c++) {
        if (this.isSolid(c, r)) return true;
      }
    }
    return false;
  }

  /**
   * Tira vida de um bloco quebrável. Retorna null se a célula não for quebrável,
   * ou { type, broken } dizendo se o bloco foi destruído.
   */
  damageCell(col, row, amount) {
    const type = this.typeAt(col, row);
    if (!type || !type.breakable) return null;
    const i = row * this.width + col;
    this.hp[i] -= amount;
    if (this.hp[i] <= 0) {
      this.cells[i] = null;
      this.hp[i] = 0;
      this.shakes.delete(i);
      this.refreshCell(col, row);
      this.refreshCell(col, row + 1); // o bloco de baixo pode voltar a mostrar grama
      return { type, broken: true };
    }
    this.shakes.set(i, 0.12);
    this.refreshCell(col, row);
    return { type, broken: false };
  }

  update(dt) {
    for (const [i, t] of this.shakes) {
      if (t - dt <= 0) this.shakes.delete(i);
      else this.shakes.set(i, t - dt);
    }
  }

  /** Recalcula a imagem de uma célula (chamado quando o mapa muda). */
  refreshCell(col, row) {
    if (col < 0 || row < 0 || col >= this.width || row >= this.height) return;
    const type = this.typeAt(col, row);
    const i = row * this.width + col;
    if (!type) {
      this.visuals[i] = null;
    } else if (type.images) {
      // Quebrável: a imagem acompanha o dano recebido. Decoração: sempre a primeira.
      const stage = type.breakable ? Math.min(type.images.length - 1, type.hp - this.hp[i]) : 0;
      this.visuals[i] = this.paint(Game.assets.get(type.images[Math.max(0, stage)]), type);
    } else {
      // Terreno: grama quando não há terreno igual em cima (uma caixa em cima não cobre a grama)
      const exposed = this.typeAt(col, row - 1) !== type;
      const list = exposed ? type.surface : type.fill;
      const h = Game.hash2(col, row);
      const key = list[h % list.length];
      const mirror = !exposed && type.mirrorFill && ((h >>> 9) & 1) === 1;
      this.visuals[i] = this.paint(mirror ? this._mirror(key) : Game.assets.get(key), type);
    }
    if (this.cache) this.bakeCell(col, row);
  }

  /** Versão escurecida (decoração de fundo) e/ou tingida (clima da arena) de uma imagem. */
  paint(img, type) {
    const shade = type.shade || 0;
    if (!shade && !this.groundTint) return img;
    if (!this._painted.has(img)) this._painted.set(img, new Map());
    const versions = this._painted.get(img);
    let out = versions.get(shade);
    if (out) return out;
    out = document.createElement('canvas');
    out.width = img.width;
    out.height = img.height;
    const ctx = out.getContext('2d');
    ctx.drawImage(img, 0, 0);
    if (this.groundTint) {
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = this.groundTint;
      ctx.fillRect(0, 0, out.width, out.height);
      ctx.globalCompositeOperation = 'destination-in'; // devolve a transparência original
      ctx.drawImage(img, 0, 0);
    }
    if (shade) {
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = 'rgba(14, 22, 44, ' + shade + ')';
      ctx.fillRect(0, 0, out.width, out.height);
    }
    versions.set(shade, out);
    return out;
  }

  _mirror(key) {
    if (!this._mirrored[key]) {
      const img = Game.assets.get(key);
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.translate(img.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(img, 0, 0);
      this._mirrored[key] = canvas;
    }
    return this._mirrored[key];
  }

  isDynamic(i) {
    const type = this.cells[i];
    return !!(type && type.breakable);
  }

  /** Pinta o terreno parado na imagem de cache (uma vez). */
  buildCache() {
    this.cache = document.createElement('canvas');
    this.cache.width = this.pixelWidth;
    this.cache.height = this.pixelHeight;
    this.cacheCtx = this.cache.getContext('2d');
    for (let r = 0; r < this.height; r++) {
      for (let c = 0; c < this.width; c++) this.bakeCell(c, r);
    }
  }

  bakeCell(col, row) {
    const ts = this.tileSize;
    const i = row * this.width + col;
    this.cacheCtx.clearRect(col * ts, row * ts, ts, ts);
    const img = this.visuals[i];
    if (img && !this.isDynamic(i)) this.cacheCtx.drawImage(img, col * ts, row * ts);
  }

  /** Desenha só a parte visível. rect = área visível em pixels do jogo. */
  draw(ctx, rect) {
    if (!this.cache) this.buildCache();
    const ts = this.tileSize;
    const x0 = Math.max(0, Math.floor(rect.x) - 1);
    const y0 = Math.max(0, Math.floor(rect.y) - 1);
    const x1 = Math.min(this.pixelWidth, Math.ceil(rect.x + rect.w) + 1);
    const y1 = Math.min(this.pixelHeight, Math.ceil(rect.y + rect.h) + 1);
    if (x1 > x0 && y1 > y0) ctx.drawImage(this.cache, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0);

    // blocos quebráveis por cima (podem tremer)
    const c0 = Math.max(0, Math.floor(rect.x / ts));
    const r0 = Math.max(0, Math.floor(rect.y / ts));
    const c1 = Math.min(this.width - 1, Math.floor((rect.x + rect.w) / ts));
    const r1 = Math.min(this.height - 1, Math.floor((rect.y + rect.h) / ts));
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const i = r * this.width + c;
        if (!this.isDynamic(i)) continue;
        const img = this.visuals[i];
        if (!img) continue;
        const t = this.shakes.get(i);
        const dx = t ? (Math.floor(t * 50) % 2 === 0 ? 1 : -1) : 0;
        ctx.drawImage(img, c * ts + dx, r * ts);
      }
    }
  }
};
