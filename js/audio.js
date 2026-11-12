/*
 * Som 8-bit gerado na hora (Web Audio), sem arquivos de áudio.
 * O navegador só libera áudio depois de uma tecla ou toque: unlock() é chamado nesse momento.
 *
 *  - Efeitos: acrescente uma receita em RECIPES usando tone() e noise().
 *  - Música: Game.Sound.startMusic('fight' | 'boss') toca um loop chiptune
 *    (sequenciador com agendamento adiantado, sem engasgos); stopMusic() para.
 *  - M liga/desliga tudo; a música também tem chave própria (menu de pausa).
 */
window.Game = window.Game || {};

Game.Sound = {
  ctx: null,
  out: null,
  musicOut: null,
  noiseBuffer: null,
  muted: false,
  musicOn: true,
  volume: 0.45,
  musicVolume: 0.55,
  theme: null,
  _timer: null,

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
      this.out = this.ctx.createGain();
      this.out.gain.value = this.muted ? 0 : this.volume;
      this.out.connect(this.ctx.destination);
      this.musicOut = this.ctx.createGain();
      this.musicOut.gain.value = this.musicOn ? this.musicVolume : 0;
      this.musicOut.connect(this.out);
      const len = Math.floor(this.ctx.sampleRate * 0.6);
      this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      if (this.theme) this._startScheduler(); // música pedida antes do primeiro toque
    } catch (err) {
      this.ctx = null; // sem áudio neste navegador: o jogo segue mudo
    }
  },

  setMuted(muted) {
    this.muted = muted;
    if (this.out) this.out.gain.value = muted ? 0 : this.volume;
  },

  setMusic(on) {
    this.musicOn = on;
    if (this.musicOut) this.musicOut.gain.value = on ? this.musicVolume : 0;
  },

  /** Nota com frequência deslizando de "from" para "to". at = tempo absoluto (opcional). */
  tone({ type = 'square', from = 440, to = from, dur = 0.1, vol = 0.08, delay = 0, at = null, dest = null }) {
    const t = at !== null ? at : this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    if (to !== from) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(dest || this.out);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  },

  /** Chiado filtrado (impactos, vento do soco, explosões, bateria). */
  noise({ filter = 'bandpass', from = 1000, to = from, q = 1, dur = 0.1, vol = 0.08, delay = 0, at = null, dest = null }) {
    const t = at !== null ? at : this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const biquad = this.ctx.createBiquadFilter();
    biquad.type = filter;
    biquad.Q.value = q;
    biquad.frequency.setValueAtTime(from, t);
    if (to !== from) biquad.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(biquad).connect(gain).connect(dest || this.out);
    src.start(t, Math.random() * 0.3);
    src.stop(t + dur + 0.02);
  },

  play(name) {
    if (!this.ctx || this.muted) return;
    const recipe = Game.Sound.RECIPES[name];
    if (!recipe) return;
    try {
      recipe(this);
    } catch (err) {
      // um som falhar nunca pode travar o jogo
    }
  },

  // ------------------------------------------------------------ música
  startMusic(name) {
    const theme = Game.Sound.THEMES[name];
    if (!theme || this.theme === theme) return;
    this.stopMusic();
    this.theme = theme;
    this.themeName = name;
    if (this.ctx) this._startScheduler();
  },

  stopMusic() {
    this.theme = null;
    this.themeName = null;
    clearInterval(this._timer);
    this._timer = null;
  },

  _startScheduler() {
    clearInterval(this._timer);
    this._step = 0;
    this._next = this.ctx.currentTime + 0.08;
    const tick = () => {
      if (!this.theme || !this.ctx) return;
      const stepDur = 60 / this.theme.bpm / 2; // colcheias
      // agenda tudo o que cai nos próximos 150 ms (o setInterval pode atrasar sem problema)
      while (this._next < this.ctx.currentTime + 0.15) {
        if (!this.muted && this.musicOn) {
          try {
            this.theme.step(this, this._step, this._next, stepDur);
          } catch (err) { /* nota perdida não trava nada */ }
        }
        this._step += 1;
        this._next += stepDur;
      }
    };
    tick();
    this._timer = setInterval(tick, 40);
  },
};

// Nota MIDI → frequência
Game.Sound.hz = (n) => 440 * Math.pow(2, (n - 69) / 12);

/**
 * Temas: cada passo é uma colcheia. Progressão de 4 compassos (32 passos),
 * baixo em onda quadrada, arpejo em triângulo e bateria de chiado.
 */
(function () {
  const S = Game.Sound;
  const makeTheme = (bpm, root, chords, lead) => ({
    bpm,
    step(s, i, at, d) {
      const dest = s.musicOut;
      const bar = Math.floor(i / 8) % chords.length;
      const beat = i % 8;
      const chord = chords[bar].map((x) => x + root);
      // baixo: fundamental com oitava saltitante
      const bassNote = chord[0] - 24 + (beat % 4 === 2 ? 12 : 0);
      s.tone({ type: 'square', from: S.hz(bassNote), dur: d * 0.85, vol: 0.05, at, dest });
      // arpejo
      const arp = chord[[0, 1, 2, 1][beat % 4]] + (beat >= 4 ? 12 : 0);
      s.tone({ type: 'triangle', from: S.hz(arp), dur: d * 0.9, vol: 0.045, at, dest });
      // melodia por cima (a cada 2 compassos)
      const m = lead[i % lead.length];
      if (m !== null) s.tone({ type: 'square', from: S.hz(m + root), dur: d * 1.6, vol: 0.022, at, dest });
      // bateria: bumbo nos tempos 1 e 3, caixa nos 2 e 4, chimbal nos contratempos
      if (beat === 0 || beat === 4) s.tone({ type: 'sine', from: 150, to: 45, dur: 0.12, vol: 0.12, at, dest });
      if (beat === 2 || beat === 6) s.noise({ from: 1800, to: 900, q: 0.9, dur: 0.09, vol: 0.06, at, dest });
      if (beat % 2 === 1) s.noise({ filter: 'highpass', from: 7000, dur: 0.03, vol: 0.025, at, dest });
    },
  });
  const _ = null;
  S.THEMES = {
    // Lá menor: Am – G – F – E
    fight: makeTheme(148, 57, [[0, 3, 7], [-2, 2, 5], [-4, 0, 3], [-5, -1, 2]], [
      12, _, 15, _, 19, _, 17, 15, 14, _, 12, _, 10, _, _, _,
      12, _, 15, _, 19, _, 22, 24, 22, _, 19, _, 17, _, _, _,
      _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _,
      _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _,
    ]),
    // Ré menor, mais rápido e sombrio: Dm – Bb – C – A
    boss: makeTheme(162, 50, [[0, 3, 7], [-4, 0, 3], [-2, 2, 5], [-5, -1, 2]], [
      24, _, 22, _, 20, _, 19, _, 17, _, 19, _, 20, _, 22, _,
      24, _, 27, _, 26, _, 24, _, 22, _, 20, _, 19, _, _, _,
    ]),
    // Mi menor, clima de cidade à noite: Em – C – G – D
    city: makeTheme(140, 52, [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [-2, 2, 5]], [
      19, _, _, 22, _, _, 24, _, 22, _, 19, _, 17, _, 15, _,
      19, _, _, 22, _, _, 26, _, 24, _, 22, _, 19, _, _, _,
      _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _,
      12, _, 15, _, 17, _, 19, _, 17, _, 15, _, 14, _, _, _,
    ]),
    // Expansão de Domínio: Dó# menor frígio, rápido e tenso: C#m – D – C#m – B
    domain: makeTheme(176, 49, [[0, 3, 7], [1, 5, 8], [0, 3, 7], [-2, 2, 5]], [
      24, 25, 24, _, 19, _, 24, _, 27, 25, 24, _, 22, _, 19, _,
      24, 25, 24, _, 19, _, 24, _, 31, 30, 27, _, 25, _, 24, _,
    ]),
    // Mi frígio dominante (clima de deserto): E – F – E – Dm
    desert: makeTheme(132, 52, [[0, 4, 7], [1, 5, 8], [0, 4, 7], [-2, 1, 5]], [
      12, _, 13, _, 16, _, 17, _, 19, _, 17, 16, 13, _, 12, _,
      12, _, 13, _, 16, _, 19, 20, 19, _, 17, _, 16, _, _, _,
      24, _, 22, _, 20, _, 19, _, 17, _, 16, _, 13, _, 12, _,
      _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _,
    ]),
    // Ré lídio, espacial e flutuante: D – E – D – C#m
    space: makeTheme(112, 50, [[0, 4, 7], [2, 6, 9], [0, 4, 7], [-1, 2, 6]], [
      19, _, _, _, 21, _, 23, _, 26, _, _, _, 23, _, _, _,
      19, _, 18, _, 16, _, 14, _, 16, _, _, _, _, _, _, _,
      26, _, _, _, 28, _, 30, _, 31, _, 30, _, 28, _, _, _,
      _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _,
    ]),
    // Lá menor pentatônica, mais calma: Am – G – Am – Em
    dojo: makeTheme(118, 57, [[0, 3, 7], [-2, 2, 5], [0, 3, 7], [-5, -2, 3]], [
      24, _, 22, _, 19, _, 17, _, 19, _, _, _, 15, _, _, _,
      12, _, 15, _, 17, _, 19, _, 22, _, 19, _, 17, _, _, _,
      _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _,
      _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _,
    ]),
  };
})();

Game.Sound.RECIPES = {
  jump: (s) => s.tone({ from: 280, to: 620, dur: 0.11, vol: 0.05 }),
  swing: (s) => s.noise({ from: 1900, to: 650, q: 1.3, dur: 0.09, vol: 0.09 }),
  hit: (s) => {
    s.tone({ from: 190, to: 60, dur: 0.09, vol: 0.09 });
    s.noise({ filter: 'lowpass', from: 2600, to: 700, dur: 0.06, vol: 0.12 });
  },
  heavy: (s) => {
    s.tone({ from: 150, to: 40, dur: 0.15, vol: 0.11 });
    s.noise({ filter: 'lowpass', from: 2000, to: 350, dur: 0.13, vol: 0.16 });
  },
  block: (s) => {
    s.tone({ type: 'triangle', from: 620, to: 380, dur: 0.06, vol: 0.06 });
    s.noise({ filter: 'highpass', from: 2400, dur: 0.04, vol: 0.07 });
  },
  crack: (s) => {
    s.noise({ filter: 'highpass', from: 3200, to: 1600, dur: 0.05, vol: 0.09 });
    s.tone({ type: 'triangle', from: 320, to: 180, dur: 0.05, vol: 0.05 });
  },
  break: (s) => {
    s.noise({ from: 1500, to: 280, q: 0.8, dur: 0.24, vol: 0.16 });
    s.tone({ type: 'triangle', from: 130, to: 55, dur: 0.16, vol: 0.09 });
  },
  thud: (s) => s.tone({ type: 'sine', from: 130, to: 80, dur: 0.06, vol: 0.07 }),
  alert: (s) => {
    s.tone({ from: 880, dur: 0.05, vol: 0.035 });
    s.tone({ from: 1320, dur: 0.07, vol: 0.035, delay: 0.06 });
  },
  knockdown: (s) => s.tone({ from: 420, to: 90, dur: 0.28, vol: 0.06 }),
  land: (s) => {
    s.noise({ filter: 'lowpass', from: 700, to: 180, dur: 0.22, vol: 0.16 });
    s.tone({ type: 'sine', from: 95, to: 40, dur: 0.2, vol: 0.13 });
  },
  charge: (s) => s.tone({ type: 'sawtooth', from: 180, to: 540, dur: 0.45, vol: 0.03 }),
  charged: (s) => {
    s.tone({ type: 'triangle', from: 1046, dur: 0.07, vol: 0.05 });
    s.tone({ type: 'triangle', from: 1568, dur: 0.1, vol: 0.05, delay: 0.07 });
  },
  fire: (s) => {
    s.tone({ type: 'sawtooth', from: 1150, to: 170, dur: 0.26, vol: 0.055 });
    s.noise({ from: 3200, to: 900, q: 1.5, dur: 0.18, vol: 0.06 });
  },
  fireBig: (s) => {
    s.tone({ type: 'sawtooth', from: 760, to: 70, dur: 0.42, vol: 0.075 });
    s.noise({ filter: 'lowpass', from: 2400, to: 300, dur: 0.36, vol: 0.11 });
  },
  explode: (s) => {
    s.noise({ filter: 'lowpass', from: 1700, to: 140, dur: 0.32, vol: 0.15 });
    s.tone({ type: 'sine', from: 110, to: 40, dur: 0.26, vol: 0.1 });
  },
  throw: (s) => s.noise({ from: 900, to: 2400, q: 2, dur: 0.14, vol: 0.07 }),
  bookHit: (s) => {
    s.noise({ filter: 'bandpass', from: 1200, to: 500, q: 1.2, dur: 0.1, vol: 0.13 });
    s.tone({ type: 'triangle', from: 240, to: 120, dur: 0.08, vol: 0.07 });
  },
  clash: (s) => {
    s.tone({ type: 'square', from: 1400, to: 300, dur: 0.18, vol: 0.05 });
    s.noise({ filter: 'lowpass', from: 2600, to: 400, dur: 0.24, vol: 0.12 });
  },
  dash: (s) => s.noise({ from: 800, to: 2600, q: 1.1, dur: 0.16, vol: 0.09 }),
  switch: (s) => {
    [523, 659, 784, 1047].forEach((f, i) => s.tone({ from: f, dur: 0.07, vol: 0.04, delay: i * 0.055 }));
  },
  dizzy: (s) => {
    [880, 740, 880, 740, 880].forEach((f, i) => s.tone({ type: 'triangle', from: f, dur: 0.08, vol: 0.04, delay: i * 0.08 }));
  },
  ko: (s) => {
    s.noise({ filter: 'lowpass', from: 2200, to: 120, dur: 0.7, vol: 0.2 });
    s.tone({ type: 'sawtooth', from: 330, to: 50, dur: 0.8, vol: 0.08 });
    s.tone({ type: 'sine', from: 90, to: 30, dur: 0.6, vol: 0.14 });
  },
  round: (s) => {
    s.tone({ type: 'square', from: 392, dur: 0.12, vol: 0.05 });
    s.tone({ type: 'square', from: 523, dur: 0.24, vol: 0.05, delay: 0.12 });
  },
  fight: (s) => {
    s.tone({ type: 'sawtooth', from: 523, dur: 0.09, vol: 0.05 });
    s.tone({ type: 'sawtooth', from: 784, dur: 0.3, vol: 0.06, delay: 0.09 });
    s.noise({ filter: 'highpass', from: 3000, dur: 0.2, vol: 0.05, delay: 0.09 });
  },
  tick: (s) => s.tone({ type: 'square', from: 1760, dur: 0.03, vol: 0.025 }),
  select: (s) => s.tone({ type: 'square', from: 660, dur: 0.04, vol: 0.035 }),
  confirm: (s) => {
    s.tone({ type: 'square', from: 523, dur: 0.06, vol: 0.045 });
    s.tone({ type: 'square', from: 1047, dur: 0.12, vol: 0.045, delay: 0.06 });
  },
  win: (s) => {
    [523, 659, 784, 1047, 784, 1047].forEach((f, i) => s.tone({ type: 'square', from: f, dur: i === 5 ? 0.4 : 0.1, vol: 0.05, delay: i * 0.1 }));
  },
  lose: (s) => {
    [392, 370, 349, 262].forEach((f, i) => s.tone({ type: 'triangle', from: f, dur: i === 3 ? 0.5 : 0.18, vol: 0.06, delay: i * 0.2 }));
  },
  super: (s) => {
    s.noise({ filter: 'highpass', from: 1800, to: 6000, dur: 0.35, vol: 0.06 });
    [262, 330, 392, 523, 659].forEach((f, i) => s.tone({ type: 'square', from: f, dur: 0.16, vol: 0.04, delay: i * 0.05 }));
    s.tone({ type: 'sawtooth', from: 110, to: 220, dur: 0.5, vol: 0.05 });
  },
  beam: (s) => {
    s.tone({ type: 'sawtooth', from: 180, to: 140, dur: 0.8, vol: 0.06 });
    s.tone({ type: 'square', from: 360, to: 300, dur: 0.8, vol: 0.03 });
    s.noise({ from: 2400, to: 1200, q: 0.7, dur: 0.8, vol: 0.07 });
  },
  grab: (s) => {
    s.noise({ filter: 'lowpass', from: 900, to: 400, dur: 0.08, vol: 0.12 });
    s.tone({ type: 'triangle', from: 200, to: 150, dur: 0.08, vol: 0.06 });
  },
  toss: (s) => {
    s.noise({ from: 700, to: 2000, q: 1.2, dur: 0.18, vol: 0.09 });
  },
  tech: (s) => {
    s.tone({ type: 'triangle', from: 880, to: 1320, dur: 0.09, vol: 0.05 });
    s.noise({ filter: 'highpass', from: 3000, dur: 0.05, vol: 0.06 });
  },
  rise: (s) => {
    s.noise({ from: 600, to: 3200, q: 1.4, dur: 0.25, vol: 0.1 });
    s.tone({ type: 'sawtooth', from: 220, to: 660, dur: 0.22, vol: 0.04 });
  },
  // ---- Gélida, Trovão e Expansão de Domínio
  iceCast: (s) => {
    s.tone({ type: 'triangle', from: 1400, to: 2600, dur: 0.12, vol: 0.04 });
    s.noise({ filter: 'highpass', from: 5000, dur: 0.1, vol: 0.04 });
  },
  iceSpike: (s) => {
    s.noise({ filter: 'highpass', from: 2600, to: 1200, dur: 0.16, vol: 0.12 });
    s.tone({ type: 'triangle', from: 1760, to: 880, dur: 0.12, vol: 0.05 });
    s.tone({ type: 'square', from: 220, to: 110, dur: 0.1, vol: 0.05 });
  },
  freeze: (s) => {
    [1568, 2093, 2637].forEach((f, i) => s.tone({ type: 'triangle', from: f, dur: 0.09, vol: 0.04, delay: i * 0.04 }));
    s.noise({ filter: 'highpass', from: 6000, dur: 0.18, vol: 0.05 });
  },
  shatter: (s) => {
    s.noise({ filter: 'highpass', from: 4200, to: 1800, dur: 0.22, vol: 0.13 });
    [2637, 1976, 2349].forEach((f, i) => s.tone({ type: 'triangle', from: f, dur: 0.05, vol: 0.035, delay: i * 0.03 }));
  },
  teleport: (s) => {
    s.tone({ type: 'square', from: 1800, to: 300, dur: 0.1, vol: 0.04 });
    s.noise({ filter: 'bandpass', from: 4000, to: 1200, q: 2, dur: 0.12, vol: 0.07 });
  },
  boltCast: (s) => {
    s.noise({ filter: 'highpass', from: 3000, to: 7000, dur: 0.18, vol: 0.05 });
    s.tone({ type: 'sawtooth', from: 220, to: 880, dur: 0.16, vol: 0.03 });
  },
  thunder: (s) => {
    s.noise({ filter: 'lowpass', from: 6000, to: 200, dur: 0.45, vol: 0.2 });
    s.tone({ type: 'square', from: 1200, to: 80, dur: 0.12, vol: 0.05 });
    s.tone({ type: 'sine', from: 90, to: 35, dur: 0.4, vol: 0.12 });
  },
  thunderFar: (s) => {
    s.noise({ filter: 'lowpass', from: 900, to: 120, dur: 0.9, vol: 0.12 });
  },
  blizzard: (s) => {
    s.noise({ filter: 'bandpass', from: 600, to: 3000, q: 0.8, dur: 0.9, vol: 0.1 });
    s.tone({ type: 'triangle', from: 1046, to: 1568, dur: 0.5, vol: 0.03 });
  },
  abyss: (s) => {
    s.tone({ type: 'sawtooth', from: 300, to: 90, dur: 0.18, vol: 0.06 });
    s.noise({ filter: 'lowpass', from: 1600, to: 300, dur: 0.16, vol: 0.09 });
  },
  sureWarn: (s) => {
    s.tone({ type: 'square', from: 1318, dur: 0.05, vol: 0.03 });
    s.tone({ type: 'square', from: 1318, dur: 0.05, vol: 0.03, delay: 0.12 });
  },
  domainCast: (s) => {
    // gongo grave e um brilho subindo
    s.tone({ type: 'sine', from: 65, to: 55, dur: 1.4, vol: 0.2 });
    s.tone({ type: 'triangle', from: 130, to: 110, dur: 1.2, vol: 0.08 });
    s.noise({ filter: 'highpass', from: 1200, to: 7000, dur: 1.1, vol: 0.05 });
    [262, 311, 392, 466, 523, 622, 784].forEach((f, i) => s.tone({ type: 'square', from: f, dur: 0.18, vol: 0.025, delay: 0.2 + i * 0.11 }));
  },
  domainOpen: (s) => {
    s.noise({ filter: 'lowpass', from: 3000, to: 100, dur: 0.8, vol: 0.2 });
    s.tone({ type: 'sawtooth', from: 55, to: 110, dur: 0.6, vol: 0.08 });
    s.tone({ type: 'sine', from: 50, to: 30, dur: 0.7, vol: 0.18 });
  },
  domainBreak: (s) => {
    s.noise({ filter: 'highpass', from: 5000, to: 900, dur: 0.6, vol: 0.16 });
    [3136, 2637, 2349, 1976, 1568].forEach((f, i) => s.tone({ type: 'triangle', from: f, dur: 0.06, vol: 0.035, delay: i * 0.05 }));
  },
  domainClash: (s) => {
    s.noise({ filter: 'lowpass', from: 2000, to: 300, dur: 1.2, vol: 0.14 });
    s.tone({ type: 'sawtooth', from: 110, to: 98, dur: 1.2, vol: 0.06 });
    s.tone({ type: 'sawtooth', from: 116, to: 104, dur: 1.2, vol: 0.06 });
  },
  // ---- Soldador
  torch: (s) => {
    s.noise({ filter: 'highpass', from: 2400, to: 4200, dur: 0.42, vol: 0.09 });
    s.tone({ type: 'square', from: 1800, to: 1400, dur: 0.06, vol: 0.03 });
  },
  gateSlam: (s) => {
    // pancada metálica: notas inarmônicas e um baque
    s.tone({ type: 'square', from: 196, to: 150, dur: 0.22, vol: 0.09 });
    s.tone({ type: 'triangle', from: 622, dur: 0.35, vol: 0.06 });
    s.tone({ type: 'triangle', from: 1397, dur: 0.25, vol: 0.04 });
    s.noise({ filter: 'lowpass', from: 2400, to: 300, dur: 0.2, vol: 0.14 });
  },
  weld: (s) => {
    for (let i = 0; i < 4; i++) s.noise({ filter: 'bandpass', from: 2600 + i * 500, q: 3, dur: 0.035, vol: 0.07, delay: i * 0.03 });
  },
  cageBoom: (s) => {
    s.noise({ filter: 'lowpass', from: 3000, to: 120, dur: 0.6, vol: 0.22 });
    s.tone({ type: 'sine', from: 110, to: 40, dur: 0.5, vol: 0.16 });
    s.tone({ type: 'triangle', from: 880, to: 440, dur: 0.3, vol: 0.05 });
  },
  rooted: (s) => {
    s.noise({ filter: 'highpass', from: 5000, to: 2500, dur: 0.3, vol: 0.07 });
    s.tone({ type: 'square', from: 1200, to: 800, dur: 0.12, vol: 0.03 });
  },
  perfect: (s) => {
    [784, 988, 1175, 1568].forEach((f, i) => s.tone({ type: 'triangle', from: f, dur: 0.12, vol: 0.05, delay: i * 0.07 }));
  },
};

// Sons dos lutadores novos
Object.assign(Game.Sound.RECIPES, {
  kunai: (s) => s.noise({ filter: 'highpass', from: 3000, to: 5200, dur: 0.08, vol: 0.06 }),
  kunaiHit: (s) => {
    s.tone({ type: 'triangle', from: 1400, to: 600, dur: 0.06, vol: 0.05 });
    s.noise({ filter: 'highpass', from: 3600, dur: 0.05, vol: 0.06 });
  },
  copy: (s) => {
    s.tone({ type: 'square', from: 880, to: 1320, dur: 0.07, vol: 0.04 });
    s.tone({ type: 'square', from: 1320, to: 1760, dur: 0.09, vol: 0.04, delay: 0.07 });
    s.tone({ type: 'sawtooth', from: 220, to: 110, dur: 0.2, vol: 0.03, delay: 0.02 });
  },
  counterStance: (s) => s.tone({ type: 'triangle', from: 1200, to: 1800, dur: 0.08, vol: 0.035 }),
  counter: (s) => {
    s.noise({ filter: 'highpass', from: 2000, to: 6000, dur: 0.12, vol: 0.08 });
    s.tone({ type: 'square', from: 300, to: 1200, dur: 0.08, vol: 0.05 });
    s.tone({ type: 'sawtooth', from: 900, to: 120, dur: 0.18, vol: 0.05, delay: 0.08 });
  },
  crow: (s) => {
    s.tone({ type: 'sawtooth', from: 760, to: 520, dur: 0.07, vol: 0.035 });
    s.tone({ type: 'sawtooth', from: 700, to: 480, dur: 0.08, vol: 0.03, delay: 0.09 });
  },
  crowDive: (s) => {
    s.tone({ type: 'sawtooth', from: 900, to: 300, dur: 0.18, vol: 0.05 });
    s.noise({ from: 1800, to: 500, q: 1, dur: 0.16, vol: 0.09 });
  },
  revoada: (s) => {
    for (let i = 0; i < 5; i++) s.tone({ type: 'sawtooth', from: 820 - i * 40, to: 520, dur: 0.06, vol: 0.03, delay: i * 0.07 });
    s.noise({ from: 600, to: 2400, q: 0.7, dur: 0.5, vol: 0.06 });
  },
  bubbleThrow: (s) => s.tone({ type: 'triangle', from: 520, to: 1040, dur: 0.12, vol: 0.04 }),
  timeBubble: (s) => {
    s.tone({ type: 'sine', from: 330, to: 220, dur: 0.35, vol: 0.06 });
    s.tone({ type: 'triangle', from: 1320, dur: 0.05, vol: 0.03, delay: 0.05 });
    s.tone({ type: 'triangle', from: 1320, dur: 0.05, vol: 0.03, delay: 0.25 });
  },
  rewindCast: (s) => s.tone({ type: 'triangle', from: 1600, to: 400, dur: 0.18, vol: 0.04 }),
  rewind: (s) => {
    for (let i = 0; i < 4; i++) s.tone({ type: 'square', from: 1500 - i * 220, dur: 0.035, vol: 0.03, delay: i * 0.045 });
    s.noise({ filter: 'bandpass', from: 4000, to: 800, q: 2, dur: 0.22, vol: 0.05 });
  },
  timeStop: (s) => {
    s.tone({ type: 'sine', from: 140, to: 60, dur: 0.5, vol: 0.12 });
    s.noise({ filter: 'lowpass', from: 3000, to: 200, dur: 0.45, vol: 0.08 });
    s.tone({ type: 'triangle', from: 1760, dur: 0.05, vol: 0.04, delay: 0.25 });
  },
  timeResume: (s) => {
    s.tone({ type: 'triangle', from: 1760, dur: 0.05, vol: 0.05 });
    s.tone({ type: 'sine', from: 60, to: 180, dur: 0.3, vol: 0.1, delay: 0.04 });
    s.noise({ filter: 'lowpass', from: 300, to: 3000, dur: 0.3, vol: 0.08 });
  },
  clockHit: (s) => {
    s.tone({ type: 'triangle', from: 1320, dur: 0.06, vol: 0.05 });
    s.tone({ type: 'sine', from: 160, to: 50, dur: 0.22, vol: 0.1, delay: 0.03 });
  },
  blackHole: (s) => {
    s.tone({ type: 'sine', from: 260, to: 70, dur: 0.5, vol: 0.08 });
    s.noise({ filter: 'lowpass', from: 1200, to: 200, dur: 0.5, vol: 0.06 });
  },
  holeCollapse: (s) => {
    s.tone({ type: 'sine', from: 60, to: 240, dur: 0.18, vol: 0.09 });
    s.noise({ filter: 'lowpass', from: 2000, to: 300, dur: 0.2, vol: 0.09 });
  },
  antigravCast: (s) => s.tone({ type: 'sine', from: 300, to: 900, dur: 0.25, vol: 0.05 }),
  antigrav: (s) => s.tone({ type: 'triangle', from: 400, to: 1200, dur: 0.3, vol: 0.05 }),
  floatUp: (s) => s.tone({ type: 'sine', from: 600, to: 1400, dur: 0.4, vol: 0.04 }),
  gravSlam: (s) => {
    s.tone({ type: 'sine', from: 120, to: 35, dur: 0.3, vol: 0.13 });
    s.noise({ filter: 'lowpass', from: 900, to: 120, dur: 0.28, vol: 0.16 });
  },
  starGrow: (s) => s.tone({ type: 'triangle', from: 400, to: 1600, dur: 0.3, vol: 0.04 }),
  starThrow: (s) => s.noise({ from: 800, to: 3000, q: 1.5, dur: 0.2, vol: 0.07 }),
  novaHold: (s) => s.tone({ type: 'sawtooth', from: 110, to: 220, dur: 0.6, vol: 0.05 }),
  supernova: (s) => {
    s.noise({ filter: 'lowpass', from: 3000, to: 100, dur: 0.7, vol: 0.2 });
    s.tone({ type: 'sine', from: 90, to: 30, dur: 0.6, vol: 0.14 });
    s.tone({ type: 'triangle', from: 2000, to: 500, dur: 0.3, vol: 0.04 });
  },
  meteor: (s) => {
    s.noise({ from: 2400, to: 300, q: 0.8, dur: 0.3, vol: 0.12 });
    s.tone({ type: 'sine', from: 110, to: 40, dur: 0.25, vol: 0.1, delay: 0.05 });
  },
  pebble: (s) => s.tone({ type: 'triangle', from: 500, to: 200, dur: 0.05, vol: 0.04 }),
});

// Contra-golpe (acertou no começo do golpe do outro) e quique no chão
Object.assign(Game.Sound.RECIPES, {
  counterHit: (s) => {
    s.tone({ type: 'square', from: 1500, to: 900, dur: 0.05, vol: 0.05 });
    s.tone({ type: 'square', from: 2000, to: 1200, dur: 0.06, vol: 0.04, delay: 0.05 });
  },
  bounce: (s) => {
    s.noise({ filter: 'lowpass', from: 600, to: 150, dur: 0.12, vol: 0.12 });
    s.tone({ type: 'sine', from: 110, to: 50, dur: 0.1, vol: 0.09 });
  },
});

// Marionete (fios) e Pavio (bombas)
Object.assign(Game.Sound.RECIPES, {
  threadShot: (s) => {
    s.tone({ type: 'triangle', from: 1800, to: 2600, dur: 0.07, vol: 0.035 });
    s.noise({ filter: 'highpass', from: 4000, to: 6000, dur: 0.06, vol: 0.03 });
  },
  stringAttach: (s) => {
    // corda de violino beliscada
    s.tone({ type: 'sawtooth', from: 660, to: 640, dur: 0.18, vol: 0.04 });
    s.tone({ type: 'triangle', from: 1320, to: 1300, dur: 0.12, vol: 0.03 });
  },
  stringSnap: (s) => s.tone({ type: 'square', from: 1400, to: 300, dur: 0.07, vol: 0.03 }),
  yank: (s) => {
    s.noise({ filter: 'bandpass', from: 600, to: 2400, q: 2, dur: 0.12, vol: 0.09 });
    s.tone({ type: 'sawtooth', from: 220, to: 660, dur: 0.12, vol: 0.05 });
  },
  tangle: (s) => {
    // arpejo de harpa descendo
    [1568, 1318, 1046, 784].forEach((f, i) => s.tone({ type: 'triangle', from: f, dur: 0.08, vol: 0.035, delay: i * 0.035 }));
  },
  inverted: (s) => {
    s.tone({ type: 'square', from: 880, to: 440, dur: 0.12, vol: 0.035 });
    s.tone({ type: 'square', from: 440, to: 880, dur: 0.12, vol: 0.035, delay: 0.12 });
  },
  curtain: (s) => {
    // fanfarra de teatro
    s.tone({ type: 'square', from: 523, dur: 0.1, vol: 0.04 });
    s.tone({ type: 'square', from: 659, dur: 0.1, vol: 0.04, delay: 0.1 });
    s.tone({ type: 'square', from: 784, dur: 0.2, vol: 0.045, delay: 0.2 });
  },
  puppetCatch: (s) => {
    s.tone({ type: 'sawtooth', from: 330, to: 990, dur: 0.2, vol: 0.05 });
    s.noise({ filter: 'highpass', from: 3000, to: 5000, dur: 0.15, vol: 0.04 });
  },
  puppetCut: (s) => {
    s.noise({ filter: 'highpass', from: 6000, to: 2000, dur: 0.1, vol: 0.07 });
    s.tone({ type: 'sine', from: 180, to: 60, dur: 0.25, vol: 0.1, delay: 0.05 });
  },
  bombThrow: (s) => {
    s.noise({ from: 700, to: 1800, q: 2, dur: 0.12, vol: 0.06 });
    s.noise({ filter: 'highpass', from: 5000, dur: 0.18, vol: 0.025, delay: 0.04 });
  },
  bombBounce: (s) => s.tone({ type: 'triangle', from: 300, to: 160, dur: 0.06, vol: 0.06 }),
  boom: (s) => {
    s.noise({ filter: 'lowpass', from: 2200, to: 120, dur: 0.38, vol: 0.18 });
    s.tone({ type: 'sine', from: 120, to: 40, dur: 0.3, vol: 0.12 });
  },
  boomSmall: (s) => {
    s.noise({ filter: 'lowpass', from: 2600, to: 400, dur: 0.14, vol: 0.09 });
  },
  boomBig: (s) => {
    s.noise({ filter: 'lowpass', from: 3200, to: 90, dur: 0.7, vol: 0.24 });
    s.tone({ type: 'sine', from: 100, to: 32, dur: 0.6, vol: 0.18 });
    s.tone({ type: 'square', from: 220, to: 60, dur: 0.2, vol: 0.04 });
  },
  boomFar: (s) => {
    s.noise({ filter: 'lowpass', from: 600, to: 80, dur: 0.6, vol: 0.06 });
    s.tone({ type: 'sine', from: 70, to: 35, dur: 0.5, vol: 0.05 });
  },
  fuseTick: (s) => {
    s.tone({ type: 'square', from: 1975, dur: 0.05, vol: 0.04 });
    s.tone({ type: 'square', from: 1975, dur: 0.04, vol: 0.03, delay: 0.09 });
  },
  timebombPlant: (s) => {
    s.tone({ type: 'square', from: 220, to: 180, dur: 0.06, vol: 0.06 });
    s.tone({ type: 'square', from: 1568, dur: 0.05, vol: 0.035, delay: 0.07 });
  },
  timebombPass: (s) => {
    s.tone({ type: 'square', from: 784, to: 1568, dur: 0.08, vol: 0.04 });
    s.tone({ type: 'square', from: 1568, dur: 0.05, vol: 0.035, delay: 0.09 });
  },
  fuseLight: (s) => {
    s.noise({ filter: 'highpass', from: 3000, to: 6000, dur: 0.3, vol: 0.05 });
    s.tone({ type: 'square', from: 1200, to: 1600, dur: 0.05, vol: 0.02 });
  },
  barrelRoll: (s) => {
    s.noise({ filter: 'lowpass', from: 400, to: 200, dur: 0.5, vol: 0.08 });
    s.tone({ type: 'triangle', from: 90, to: 70, dur: 0.5, vol: 0.06 });
  },
});

// Modos: regra nova do Caos e missão cumprida nos Desafios
Object.assign(Game.Sound.RECIPES, {
  chaosRule: (s) => {
    [392, 523, 659, 523, 784].forEach((f, i) => s.tone({ type: 'square', from: f, dur: 0.06, vol: 0.04, delay: i * 0.05 }));
    s.noise({ filter: 'highpass', from: 3000, to: 6000, dur: 0.2, vol: 0.03, delay: 0.1 });
  },
  trialDone: (s) => {
    s.tone({ type: 'square', from: 784, dur: 0.07, vol: 0.045 });
    s.tone({ type: 'square', from: 1047, dur: 0.07, vol: 0.045, delay: 0.07 });
    s.tone({ type: 'square', from: 1568, dur: 0.14, vol: 0.045, delay: 0.14 });
  },
});
