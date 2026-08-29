export class RideAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private engine: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private muted = false;

  async start(): Promise<void> {
    if (!this.context) {
      const context = new AudioContext();
      const master = context.createGain();
      master.gain.value = 0.18;
      master.connect(context.destination);

      const engine = context.createOscillator();
      const engineGain = context.createGain();
      engine.type = "sawtooth";
      engine.frequency.value = 72;
      engineGain.gain.value = 0.07;
      engine.connect(engineGain).connect(master);
      engine.start();

      this.context = context;
      this.master = master;
      this.engine = engine;
      this.engineGain = engineGain;
    }
    if (this.context.state === "suspended") await this.context.resume();
  }

  update(speedRatio: number, steering: number): void {
    if (!this.context || !this.engine || !this.engineGain) return;
    const now = this.context.currentTime;
    this.engine.frequency.setTargetAtTime(
      62 + speedRatio * 64 + Math.abs(steering) * 10,
      now,
      0.08,
    );
    this.engineGain.gain.setTargetAtTime(
      this.muted ? 0 : 0.045 + speedRatio * 0.04,
      now,
      0.1,
    );
  }

  nearMiss(thread = false): void {
    if (!this.context || !this.master || this.muted) return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const now = this.context.currentTime;
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(thread ? 920 : 620, now);
    oscillator.frequency.exponentialRampToValueAtTime(thread ? 1500 : 980, now + 0.16);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(thread ? 0.22 : 0.13, now + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
    oscillator.connect(gain).connect(this.master);
    oscillator.start(now);
    oscillator.stop(now + 0.3);
  }

  crash(): void {
    if (!this.context || !this.master || this.muted) return;
    const now = this.context.currentTime;
    const buffer = this.context.createBuffer(
      1,
      Math.floor(this.context.sampleRate * 0.55),
      this.context.sampleRate,
    );
    const channel = buffer.getChannelData(0);
    for (let index = 0; index < channel.length; index += 1) {
      channel[index] = (Math.random() * 2 - 1) * (1 - index / channel.length);
    }
    const noise = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    noise.buffer = buffer;
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1600, now);
    filter.frequency.exponentialRampToValueAtTime(120, now + 0.5);
    gain.gain.setValueAtTime(0.42, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
    noise.connect(filter).connect(gain).connect(this.master);
    noise.start(now);
  }

  toggle(): boolean {
    this.muted = !this.muted;
    if (this.master && this.context) {
      this.master.gain.setTargetAtTime(
        this.muted ? 0 : 0.18,
        this.context.currentTime,
        0.04,
      );
    }
    return this.muted;
  }
}
