/*
 * Câmera.
 *  - follow():     segue o jogador suavemente (modo treino). Na vertical só se
 *                  reposiciona quando o jogador pisa em algo, para o pulo não sacudir a imagem.
 *  - frameFight(): fica no ponto médio entre os dois lutadores, com o chão numa
 *                  altura fixa da tela (como nos jogos de luta).
 * Nunca mostra fora dos limites da fase na horizontal.
 */
window.Game = window.Game || {};

Game.Camera = class Camera {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.targetY = null;
  }

  savePrev() {
    this.prevX = this.x;
    this.prevY = this.y;
  }

  /** Teleporta sem deixar rastro na interpolação (início de fase/round). */
  snapPrev() {
    this.prevX = this.x;
    this.prevY = this.y;
  }

  /**
   * target: entidade seguida; view: {w, h} da área visível; world: {w, h} da fase.
   * instant = true posiciona sem suavização (início da fase).
   */
  follow(target, view, world, dt, instant) {
    const cfg = Game.config.camera;
    const feet = target.y + target.h;

    const tx = target.x + target.w / 2 - view.w / 2;

    let ty = this.targetY;
    if (ty === null || instant || target.onGround) ty = feet - view.h * cfg.groundLine;
    if (target.y - cfg.margin < ty) ty = target.y - cfg.margin;
    if (feet + cfg.margin > ty + view.h) ty = feet + cfg.margin - view.h;
    this.targetY = ty;

    const k = instant ? 1 : 1 - Math.exp(-cfg.followSpeed * dt);
    this.x += (tx - this.x) * k;
    this.y += (ty - this.y) * k;

    // Fase menor que a tela: centraliza na horizontal e alinha pelo chão na vertical
    this.x = world.w > view.w ? Math.min(Math.max(this.x, 0), world.w - view.w) : (world.w - view.w) / 2;
    this.y = world.h > view.h ? Math.min(Math.max(this.y, 0), world.h - view.h) : world.h - view.h;
    if (instant) this.snapPrev();
  }

  /** Luta: centro entre os lutadores, chão em floorLine da altura da tela. */
  frameFight(a, b, view, world, floorY, instant) {
    const mid = (a.x + a.w / 2 + b.x + b.w / 2) / 2;
    const tx = mid - view.w / 2;
    this.x = world.w > view.w ? Math.min(Math.max(tx, 0), world.w - view.w) : (world.w - view.w) / 2;
    this.y = floorY - view.h * Game.config.fight.floorLine;
    if (instant) this.snapPrev();
  }
};
