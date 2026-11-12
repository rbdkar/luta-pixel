/*
 * Entity: corpo retangular com velocidade e colisão contra os tiles.
 * Use como base para novos personagens, inimigos ou itens:
 *   class Slime extends Game.Entity {
 *     update(dt, input, scene) { ...; this.moveAndCollide(dt, scene.map); }
 *     draw(ctx, renderer) { ... }
 *     onHit(hit, from, scene) { ...; return true; } // opcional: torna a entidade atingível por socos
 *   }
 */
window.Game = window.Game || {};

// Margem mínima para a hitbox não "tocar" a célula vizinha quando está encostada nela
Game.EPS = 1e-6;

Game.Entity = class Entity {
  constructor(x, y, w, h) {
    this.x = x;   // canto superior esquerdo da hitbox
    this.y = y;
    this.w = w;
    this.h = h;
    this.vx = 0;
    this.vy = 0;
    this.onGround = false;
  }

  /**
   * Move um eixo de cada vez e encosta na parede/chão/teto mais próximo.
   * Com o passo fixo de 1/120 s nenhuma velocidade do jogo atravessa um tile.
   */
  moveAndCollide(dt, map) {
    const ts = map.tileSize;

    // Horizontal
    this.x += this.vx * dt;
    if (this.vx !== 0) {
      const top = Math.floor(this.y / ts);
      const bottom = Math.floor((this.y + this.h - Game.EPS) / ts);
      if (this.vx > 0) {
        const col = Math.floor((this.x + this.w - Game.EPS) / ts);
        if (map.anySolid(col, top, col, bottom)) {
          this.x = col * ts - this.w;
          this.vx = 0;
        }
      } else {
        const col = Math.floor(this.x / ts);
        if (map.anySolid(col, top, col, bottom)) {
          this.x = (col + 1) * ts;
          this.vx = 0;
        }
      }
    }

    // Vertical
    this.y += this.vy * dt;
    this.onGround = false;
    const left = Math.floor(this.x / ts);
    const right = Math.floor((this.x + this.w - Game.EPS) / ts);
    if (this.vy > 0) {
      const row = Math.floor((this.y + this.h - Game.EPS) / ts);
      if (map.anySolid(left, row, right, row)) {
        this.y = row * ts - this.h;
        this.vy = 0;
        this.onGround = true;
      }
    } else if (this.vy < 0) {
      const row = Math.floor(this.y / ts);
      if (map.anySolid(left, row, right, row)) {
        this.y = (row + 1) * ts;
        this.vy = 0;
      }
    }
  }

  /**
   * Guarda a posição antes de cada passo da física. Na hora de desenhar, a tela
   * mistura a posição anterior e a atual (interpolação), então o movimento fica
   * liso em monitores de qualquer taxa de atualização (60, 75, 144 Hz...).
   * Interpola os pés e o centro, para agachar/levantar não dar "pulinhos".
   */
  savePrev() {
    this.prevX = this.x + this.w / 2;
    this.prevFeet = this.y + this.h;
  }

  /** Canto superior esquerdo interpolado (alpha 0 = passo anterior, 1 = atual). */
  lerpPos(alpha) {
    if (this.prevX === undefined) return { x: this.x, y: this.y };
    const cx = this.prevX + (this.x + this.w / 2 - this.prevX) * alpha;
    const feet = this.prevFeet + (this.y + this.h - this.prevFeet) * alpha;
    return { x: cx - this.w / 2, y: feet - this.h };
  }

  /** true se a hitbox estiver sobrepondo algum tile sólido. */
  overlapsSolid(map) {
    const ts = map.tileSize;
    return map.anySolid(
      Math.floor(this.x / ts), Math.floor(this.y / ts),
      Math.floor((this.x + this.w - Game.EPS) / ts), Math.floor((this.y + this.h - Game.EPS) / ts),
    );
  }

  update() {}
  draw() {}
};
