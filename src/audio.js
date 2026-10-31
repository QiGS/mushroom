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
  }
  play(kind) {
    if (kind === "collect") {
      this.note(660, 0.35, 0.35);
      this.note(880, 0.6, 0.25, 0.07);
    } else if (kind === "discover") {
      [523, 659, 784, 1047].forEach((f, i) => this.note(f, 1.8, 0.3, i * 0.15));
    } else if (kind === "hit") {
      this.note(110, 0.2, 0.4, 0, "triangle");
      this.note(82, 0.3, 0.2, 0.06, "triangle");
    } else if (kind === "swing") {
      this.note(210, 0.12, 0.12, 0, "triangle");
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
