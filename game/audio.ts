const ENGINE_MASTER_LEVEL = 0.5;
const ENGINE_ASSET = `${import.meta.env.BASE_URL}assets/hayabusa-engine.mp3`;

export class RideAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private engineBus: GainNode | null = null;
  private lowSource: AudioBufferSourceNode | null = null;
  private highSource: AudioBufferSourceNode | null = null;
  private lowGain: GainNode | null = null;
  private highGain: GainNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private windGain: GainNode | null = null;
  private loadPromise: Promise<void> | null = null;
  private passDirection = 1;
  private muted = false;
  private paused = false;

  async start(): Promise<void> {
    if (!this.context) this.createGraph();
    if (this.context?.state === "suspended") await this.context.resume();
    this.loadPromise ??= this.loadEngineRecording();
    await this.loadPromise;
  }

  update(speedRatio: number, steering: number): void {
    if (
      !this.context ||
      !this.engineBus ||
      !this.lowGain ||
      !this.highGain ||
      !this.engineFilter ||
      !this.windGain
    ) return;

    const ratio = Math.max(0, Math.min(1, speedRatio));
    const now = this.context.currentTime;
    const leanLoad = Math.abs(steering) * 0.025;
    this.lowSource?.playbackRate.setTargetAtTime(
      0.78 + ratio * 0.28 + leanLoad,
      now,
      0.18,
    );
    this.highSource?.playbackRate.setTargetAtTime(
      0.82 + ratio * 0.48 + leanLoad,
      now,
      0.16,
    );
    this.engineFilter.frequency.setTargetAtTime(
      1150 + ratio * 3900,
      now,
      0.16,
    );
    this.lowGain.gain.setTargetAtTime(
      this.muted || this.paused ? 0 : 0.27 - ratio * 0.11,
      now,
      0.18,
    );
    this.highGain.gain.setTargetAtTime(
      this.muted || this.paused
        ? 0
        : 0.018 + Math.pow(ratio, 1.5) * 0.3,
      now,
      0.16,
    );
    this.engineBus.gain.setTargetAtTime(
      this.muted || this.paused ? 0 : 0.62 + ratio * 0.3,
      now,
      0.16,
    );
    this.windGain.gain.setTargetAtTime(
      this.muted || this.paused ? 0 : 0.002 + ratio * ratio * 0.055,
      now,
      0.2,
    );
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    if (!this.context || !this.engineBus || !this.windGain) return;
    const now = this.context.currentTime;
    this.engineBus.gain.setTargetAtTime(
      this.muted || paused ? 0 : 0.68,
      now,
      0.08,
    );
    this.windGain.gain.setTargetAtTime(0, now, 0.06);
  }

  nearMiss(thread = false): void {
    if (!this.context || !this.master || this.muted || this.paused) return;
    const now = this.context.currentTime;
    const duration = thread ? 0.52 : 0.38;
    const noise = this.context.createBufferSource();
    noise.buffer = createNoiseBuffer(this.context, duration);
    const filter = this.context.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.value = thread ? 0.75 : 1;
    filter.frequency.setValueAtTime(thread ? 360 : 520, now);
    filter.frequency.exponentialRampToValueAtTime(
      thread ? 1650 : 1250,
      now + duration * 0.52,
    );
    filter.frequency.exponentialRampToValueAtTime(280, now + duration);
    const gain = this.context.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(
      thread ? 0.2 : 0.12,
      now + duration * 0.28,
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    const panner = this.context.createStereoPanner();
    const direction = this.passDirection;
    this.passDirection *= -1;
    panner.pan.setValueAtTime(direction * -0.82, now);
    panner.pan.linearRampToValueAtTime(direction * 0.82, now + duration);
    noise.connect(filter).connect(gain).connect(panner).connect(this.master);
    noise.start(now);
  }

  crash(): void {
    if (!this.context || !this.master || this.muted) return;
    const now = this.context.currentTime;
    const noise = this.context.createBufferSource();
    noise.buffer = createNoiseBuffer(this.context, 0.82);
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(2600, now);
    filter.frequency.exponentialRampToValueAtTime(120, now + 0.78);
    gain.gain.setValueAtTime(0.42, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.82);
    noise.connect(filter).connect(gain).connect(this.master);
    noise.start(now);

    const thump = this.context.createOscillator();
    const thumpGain = this.context.createGain();
    thump.type = "sine";
    thump.frequency.setValueAtTime(82, now);
    thump.frequency.exponentialRampToValueAtTime(36, now + 0.28);
    thumpGain.gain.setValueAtTime(0.28, now);
    thumpGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
    thump.connect(thumpGain).connect(this.master);
    thump.start(now);
    thump.stop(now + 0.34);
    this.setPaused(true);
  }

  toggle(): boolean {
    this.muted = !this.muted;
    if (this.master && this.context) {
      this.master.gain.setTargetAtTime(
        this.muted ? 0 : ENGINE_MASTER_LEVEL,
        this.context.currentTime,
        0.06,
      );
    }
    return this.muted;
  }

  private createGraph(): void {
    const context = new AudioContext();
    const master = context.createGain();
    master.gain.value = ENGINE_MASTER_LEVEL;
    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -14;
    compressor.knee.value = 9;
    compressor.ratio.value = 3;
    compressor.attack.value = 0.006;
    compressor.release.value = 0.2;
    master.connect(compressor).connect(context.destination);

    const engineBus = context.createGain();
    const engineFilter = context.createBiquadFilter();
    engineFilter.type = "lowpass";
    engineFilter.frequency.value = 1400;
    engineFilter.Q.value = 0.55;
    engineBus.gain.value = 0;
    engineBus.connect(engineFilter).connect(master);

    const wind = context.createBufferSource();
    wind.buffer = createNoiseBuffer(context, 1.8);
    wind.loop = true;
    const windFilter = context.createBiquadFilter();
    windFilter.type = "highpass";
    windFilter.frequency.value = 1650;
    windFilter.Q.value = 0.45;
    const windGain = context.createGain();
    windGain.gain.value = 0;
    wind.connect(windFilter).connect(windGain).connect(master);
    wind.start();

    this.context = context;
    this.master = master;
    this.engineBus = engineBus;
    this.engineFilter = engineFilter;
    this.windGain = windGain;
  }

  private async loadEngineRecording(): Promise<void> {
    if (!this.context || !this.engineBus) return;
    try {
      const response = await fetch(ENGINE_ASSET);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const recording = await this.context.decodeAudioData(
        await response.arrayBuffer(),
      );
      if (!this.context || !this.engineBus) return;

      const lowSource = this.context.createBufferSource();
      const highSource = this.context.createBufferSource();
      lowSource.buffer = createCrossfadedLoop(
        this.context,
        recording,
        4.8,
        8.3,
        0.16,
      );
      highSource.buffer = createCrossfadedLoop(
        this.context,
        recording,
        10.6,
        14.5,
        0.14,
      );
      lowSource.loop = true;
      highSource.loop = true;

      const lowGain = this.context.createGain();
      const highGain = this.context.createGain();
      lowGain.gain.value = 0;
      highGain.gain.value = 0;
      lowSource.connect(lowGain).connect(this.engineBus);
      highSource.connect(highGain).connect(this.engineBus);
      lowSource.start();
      highSource.start(this.context.currentTime + 0.035);

      this.lowSource = lowSource;
      this.highSource = highSource;
      this.lowGain = lowGain;
      this.highGain = highGain;
    } catch (error) {
      console.warn(
        "Hayabusa engine recording unavailable; ride audio is reduced.",
        error,
      );
    }
  }
}

export function createCrossfadedLoop(
  context: BaseAudioContext,
  recording: AudioBuffer,
  preferredStart: number,
  preferredEnd: number,
  crossfadeSeconds: number,
): AudioBuffer {
  const sampleRate = recording.sampleRate;
  const start = Math.max(
    0,
    Math.min(preferredStart, recording.duration - 0.8),
  );
  const end = Math.max(
    start + 0.5,
    Math.min(preferredEnd, recording.duration),
  );
  const startSample = Math.floor(start * sampleRate);
  const endSample = Math.min(
    recording.length,
    Math.floor(end * sampleRate),
  );
  const segmentLength = Math.max(2, endSample - startSample);
  const fadeLength = Math.max(
    1,
    Math.min(
      Math.floor(crossfadeSeconds * sampleRate),
      Math.floor(segmentLength / 4),
    ),
  );
  const outputLength = segmentLength - fadeLength;
  const bodyLength = outputLength - fadeLength;
  const loop = context.createBuffer(
    recording.numberOfChannels,
    outputLength,
    sampleRate,
  );

  for (let channel = 0; channel < recording.numberOfChannels; channel += 1) {
    const input = recording.getChannelData(channel);
    const output = loop.getChannelData(channel);
    for (let index = 0; index < bodyLength; index += 1) {
      output[index] = input[startSample + fadeLength + index] ?? 0;
    }
    for (let index = 0; index < fadeLength; index += 1) {
      const mix = (index + 1) / fadeLength;
      const outgoing = input[endSample - fadeLength + index] ?? 0;
      const incoming = input[startSample + index] ?? 0;
      output[bodyLength + index] =
        outgoing * Math.cos(mix * Math.PI * 0.5) +
        incoming * Math.sin(mix * Math.PI * 0.5);
    }
  }
  return loop;
}

function createNoiseBuffer(context: BaseAudioContext, duration: number): AudioBuffer {
  const buffer = context.createBuffer(
    1,
    Math.ceil(context.sampleRate * duration),
    context.sampleRate,
  );
  const channel = buffer.getChannelData(0);
  let previous = 0;
  for (let index = 0; index < channel.length; index += 1) {
    const white = Math.random() * 2 - 1;
    previous = previous * 0.72 + white * 0.28;
    channel[index] = previous;
  }
  return buffer;
}
