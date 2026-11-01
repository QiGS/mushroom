export class ForestAudio {
  constructor() {
    this.enabled = true;
    this.ctx = null;
    this.timer = 0;
  }
  async start() {
    if (!this.ctx) {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return;
      this.ctx = new Audio();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.22;
      this.master.connect(this.ctx.destination);
      this.tracks = [
        ["jingmai-bgm.mp3", 0.28],
        ["forest-stream.mp3", 0.11],
      ].map(([file, volume]) => {
        const audio = document.createElement("audio");
        audio.src = `${import.meta.env.BASE_URL}assets/audio/${file}`;
        audio.loop = true;
        audio.preload = "auto";
        audio.volume = volume;
        audio.hidden = true;
        document.body.append(audio);
        return audio;
      });
    }
    this.running = true;
    this.setEnabled(this.enabled);
    await this.ctx.resume();
  }
  setEnabled(on) {
    this.enabled = on;
    for (const track of this.tracks || []) {
      if (on && this.running) track.play().catch(() => {});
      else track.pause();
    }
    if (this.master)
      this.master.gain.setTargetAtTime(
        on ? 0.22 : 0,
        this.ctx.currentTime,
        0.2,
      );
  }
  note(freq = 660, duration = 0.5, volume = 0.3, delay = 0, type = "sine") {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime + delay,
      o = this.ctx.createOscillator(),
      g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(volume, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + duration + 0.03);
    o.onended = () => { o.disconnect(); g.disconnect(); };
  }
  whoosh(duration, startHz, endHz, volume, type = 'bandpass') {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx, t = ctx.currentTime;
    if (!this.noise) {
      this.noise = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * .35), ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    const source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
    source.buffer = this.noise;
    filter.type = type;
    filter.Q.value = .7;
    filter.frequency.setValueAtTime(startHz, t);
    filter.frequency.exponentialRampToValueAtTime(endHz, t + duration);
    gain.gain.setValueAtTime(.0001, t);
    gain.gain.exponentialRampToValueAtTime(volume, t + .025);
    gain.gain.exponentialRampToValueAtTime(.0001, t + duration);
    source.connect(filter).connect(gain).connect(this.master);
    source.start(t); source.stop(t + duration);
    source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
  }
  play(kind) {
    if(kind==='shot') {
      this.note(72,.17,.7,0,'sawtooth');this.note(170,.08,.25,0,'square');this.note(48,.25,.3,.04,'triangle');
    } else if (kind === "collect") {
      this.note(660, 0.35, 0.35);
      this.note(880, 0.6, 0.25, 0.07);
    } else if (kind === "discover") {
      [523, 659, 784, 1047].forEach((f, i) => this.note(f, 1.8, 0.3, i * 0.15));
    } else if (kind === "hit") {
      this.whoosh(.11, 2400, 450, .75);
      this.note(135, .12, .65, 0, 'triangle');
      this.note(68, .18, .3, .025, 'sine');
    } else if (kind === 'hurt') {
      this.whoosh(.2, 900, 150, .55, 'lowpass');
      this.note(74, .25, .65, 0, 'triangle');
    } else if (kind === "swing") {
      this.whoosh(.18, 1800, 250, .7);
      this.note(180, .12, .13, .015, 'triangle');
    } else if (kind === "hiss") {
      this.note(740, 0.35, 0.09, 0, "sawtooth");
    } else if (kind === "step") {
      this.note(130, 0.06, 0.04, 0, "triangle");
    } else if (kind === "bell") {
      [783, 1047, 1568].forEach((f, i) => this.note(f, 2, 0.2, i * 0.15));
    } else if (kind === "stone") {
      [330, 440, 330].forEach((f, i) =>
        this.note(f, 0.15, 0.3, i * 0.17, "triangle"),
      );
    } else if (kind === "win") {
      [392, 494, 587, 784, 988].forEach((f, i) =>
        this.note(f, 2, 0.3, i * 0.18),
      );
    }
  }
  update() {}
  pause() {
    this.running = false;
    for (const track of this.tracks || []) track.pause();
    this.ctx?.suspend();
  }
}
