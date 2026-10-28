// 効果音・BGM を WebAudio で合成する(音声ファイル不要)。
// 初期音量は控えめ。ブラウザの制約上、最初のクリック後に鳴り始める。
export class Sound {
  constructor() {
    this.ctx = null;
    this.sfxVolume = 0.35;
    this.bgmVolume = 0.12;
    this.bgmNodes = null;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = this.sfxVolume;
    this.sfxGain.connect(this.ctx.destination);
    this.bgmGain = this.ctx.createGain();
    this.bgmGain.gain.value = this.bgmVolume;
    this.bgmGain.connect(this.ctx.destination);
    this.startBgm();
  }

  setSfxVolume(v) {
    this.sfxVolume = v;
    if (this.sfxGain) this.sfxGain.gain.value = v;
  }

  setBgmVolume(v) {
    this.bgmVolume = v;
    if (this.bgmGain) this.bgmGain.gain.value = v;
  }

  tone(freq, { type = 'sine', duration = 0.2, attack = 0.005, gain = 0.5, delay = 0, slideTo = null } = {}) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + duration);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(g).connect(this.sfxGain);
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
  }

  noise({ duration = 0.15, freq = 1200, q = 1, gain = 0.5, delay = 0 } = {}) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const len = Math.floor(this.ctx.sampleRate * duration);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    src.connect(f).connect(g).connect(this.sfxGain);
    src.start(t0);
  }

  // 駒を置く「パチッ」
  move() {
    this.noise({ duration: 0.08, freq: 2200, q: 2, gain: 0.7 });
    this.tone(180, { duration: 0.08, gain: 0.3 });
  }

  capture() {
    this.noise({ duration: 0.3, freq: 600, q: 0.7, gain: 0.6 });
    this.tone(220, { type: 'sawtooth', duration: 0.25, gain: 0.2, slideTo: 60 });
  }

  summon() {
    [523, 659, 784, 1046].forEach((f, i) => this.tone(f, { type: 'triangle', duration: 0.5, gain: 0.18, delay: i * 0.06 }));
  }

  promote() {
    [392, 494, 587, 784, 988].forEach((f, i) => this.tone(f, { type: 'triangle', duration: 0.6, gain: 0.2, delay: i * 0.08 }));
  }

  check() {
    this.tone(98, { type: 'sine', duration: 1.2, gain: 0.5 });
    this.tone(147, { type: 'sine', duration: 1.0, gain: 0.25 });
  }

  end() {
    [262, 330, 392, 523].forEach((f, i) => this.tone(f, { type: 'sine', duration: 1.4, gain: 0.2, delay: i * 0.15 }));
  }

  // 静かなパッド音を繰り返す BGM
  startBgm() {
    if (!this.ctx || this.bgmNodes) return;
    const chords = [[110, 165, 220], [98, 147, 196], [87, 131, 175], [98, 147, 196]];
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 700;
    filter.connect(this.bgmGain);
    const oscs = [0, 1, 2].map(() => {
      const o = this.ctx.createOscillator();
      o.type = 'triangle';
      const g = this.ctx.createGain();
      g.gain.value = 0.25;
      o.connect(g).connect(filter);
      o.start();
      return o;
    });
    let i = 0;
    const next = () => {
      const t = this.ctx.currentTime;
      chords[i % chords.length].forEach((f, j) => oscs[j].frequency.linearRampToValueAtTime(f, t + 2));
      i += 1;
    };
    next();
    this.bgmNodes = { oscs, timer: setInterval(next, 6000) };
  }
}
