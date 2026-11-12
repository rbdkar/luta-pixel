/*
 * Efeitos de impacto: lascas, faísca do soco, tremida da câmera e hit-stop
 * (uma pausa curtinha no instante do acerto, que dá peso ao golpe).
 * Tudo é desenhado em pixels inteiros, no mesmo grid da pixel art.
 */
window.Game = window.Game || {};

Game.Effects = class Effects {
  constructor() {
    this.particles = [];
    this.sparks = [];
    this.rings = [];
    this.shakeLeft = 0;
    this.shakePower = 0;
    this.freezeLeft = 0;
    this.offset = { x: 0, y: 0 };
  }

  /**
   * Espalha lascas/poeira/faíscas a partir de (x, y). dirX empurra para um lado (-1, 0 ou 1);
   * gravity negativa faz as partículas subirem (energia, fumaça).
   */
  burst(x, y, colors, count, { dirX = 0, speed = 90, lift = 140, gravity = 700 } = {}) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x, y,
        vx: (Math.random() - 0.5) * speed + dirX * speed * 0.6,
        vy: -(lift * (0.4 + Math.random() * 0.6)),
        g: gravity,
        life: 0.35 + Math.random() * 0.35,
        t: 0,
        size: Math.random() < 0.4 ? 2 : 1,
        color: colors[(Math.random() * colors.length) | 0],
      });
    }
  }

  /** Anel de pixels que se expande (troca de personagem, explosão de energia). */
  ring(x, y, color, maxRadius = 14) {
    this.rings.push({ x: Math.round(x), y: Math.round(y), color, t: 0, life: 0.25, max: maxRadius });
  }

  /** Estrela de impacto. kind: 'hit' (normal), 'heavy' (maior) ou 'block' (azulada, de defesa). */
  spark(x, y, kind = 'hit') {
    this.sparks.push({ x: Math.round(x), y: Math.round(y), t: 0, life: kind === 'heavy' ? 0.14 : 0.1, kind });
  }

  /** Limpa tudo (troca de round). */
  clear() {
    this.particles = [];
    this.sparks = [];
    this.rings = [];
    this.shakeLeft = 0;
    this.freezeLeft = 0;
    this.offset.x = 0;
    this.offset.y = 0;
  }

  shake(time, power) {
    this.shakeLeft = Math.max(this.shakeLeft, time);
    this.shakePower = power;
  }

  freeze(time) {
    this.freezeLeft = Math.max(this.freezeLeft, time);
  }

  update(dt) {
    for (const p of this.particles) {
      p.t += dt;
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.particles = this.particles.filter((p) => p.t < p.life);
    for (const s of this.sparks) s.t += dt;
    this.sparks = this.sparks.filter((s) => s.t < s.life);
    for (const r of this.rings) r.t += dt;
    this.rings = this.rings.filter((r) => r.t < r.life);

    if (this.shakeLeft > 0) {
      this.shakeLeft -= dt;
      const p = this.shakePower;
      this.offset.x = Math.round((Math.random() * 2 - 1) * p);
      this.offset.y = Math.round((Math.random() * 2 - 1) * p);
    } else {
      this.offset.x = 0;
      this.offset.y = 0;
    }
  }

  draw(ctx) {
    for (const r of this.rings) {
      const radius = 2 + (r.max - 2) * (r.t / r.life);
      ctx.fillStyle = r.color;
      const steps = Math.max(12, Math.round(radius * 6));
      for (let i = 0; i < steps; i++) {
        const a = (i / steps) * Math.PI * 2;
        ctx.fillRect(Math.round(r.x + Math.cos(a) * radius), Math.round(r.y + Math.sin(a) * radius), 1, 1);
      }
    }
    for (const p of this.particles) {
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }
    for (const s of this.sparks) {
      // Estrela de impacto em pixel art: cruz pequena e depois maior
      const big = s.t > s.life * 0.4;
      const heavy = s.kind === 'heavy';
      const arm = (big ? 3 : 2) + (heavy ? 2 : 0);
      const diag = heavy ? 3 : 2;
      ctx.fillStyle = s.kind === 'block' ? '#8fd3ff' : heavy ? '#ffd166' : '#fff3b0';
      ctx.fillRect(s.x - arm, s.y, arm * 2 + 1, 1);
      ctx.fillRect(s.x, s.y - arm, 1, arm * 2 + 1);
      if (big) {
        ctx.fillRect(s.x - diag, s.y - diag, 1, 1);
        ctx.fillRect(s.x + diag, s.y - diag, 1, 1);
        ctx.fillRect(s.x - diag, s.y + diag, 1, 1);
        ctx.fillRect(s.x + diag, s.y + diag, 1, 1);
      }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(s.x - 1, s.y - 1, 3, 3);
    }
  }
};
