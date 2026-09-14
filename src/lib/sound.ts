/**
 * FarAction SFX — tiny WebAudio synth so the arena has punch without shipping
 * audio files. All cues are procedural and respect a persisted mute flag.
 */

const MUTE_KEY = "faraction:muted";

let ctx: AudioContext | null = null;
let muted = false;
const listeners = new Set<(m: boolean) => void>();

function ensureCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function isMuted(): boolean {
  return muted;
}

export function hydrateMute(): boolean {
  if (typeof window === "undefined") return false;
  try {
    muted = window.localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    muted = false;
  }
  listeners.forEach((l) => l(muted));
  return muted;
}

export function setMuted(next: boolean) {
  muted = next;
  try {
    window.localStorage.setItem(MUTE_KEY, next ? "1" : "0");
  } catch {
    /* ignore */
  }
  if (next) {
    stopMusic();
  } else {
    startMusic();
  }
  listeners.forEach((l) => l(next));
}

let musicTimer: number | null = null;
let musicGain: GainNode | null = null;
let musicStarted = false;

function playDrone({ ac, freq, gain, type = "triangle", startAt, dur = 0.6 }: {
  ac: AudioContext;
  freq: number;
  gain: number;
  type?: OscillatorType;
  startAt: number;
  dur?: number;
}) {
  const osc = ac.createOscillator();
  const amp = ac.createGain();
  const filter = ac.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 1200;
  osc.type = type;
  osc.frequency.setValueAtTime(freq, startAt);
  amp.gain.setValueAtTime(0.0001, startAt);
  amp.gain.exponentialRampToValueAtTime(gain, startAt + 0.08);
  amp.gain.exponentialRampToValueAtTime(0.0001, startAt + dur);
  osc.connect(filter).connect(amp).connect(ac.destination);
  osc.start(startAt);
  osc.stop(startAt + dur + 0.06);
}

function pulseKick({ ac, startAt }: { ac: AudioContext; startAt: number }) {
  const osc = ac.createOscillator();
  const amp = ac.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(48, startAt);
  osc.frequency.exponentialRampToValueAtTime(12, startAt + 0.18);
  amp.gain.setValueAtTime(0.0001, startAt);
  amp.gain.exponentialRampToValueAtTime(0.16, startAt + 0.02);
  amp.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.2);
  osc.connect(amp).connect(ac.destination);
  osc.start(startAt);
  osc.stop(startAt + 0.25);
}

function startMusic() {
  const ac = ensureCtx();
  if (!ac || muted || musicStarted) return;

  musicStarted = true;
  musicGain = ac.createGain();
  musicGain.gain.value = 0.0001;
  musicGain.connect(ac.destination);
  musicGain.gain.exponentialRampToValueAtTime(0.07, ac.currentTime + 0.5);

  const progression = [110, 146.83, 123.47, 164.81, 138.59, 196, 146.83, 174.61];
  const lead = [392, 440, 523.25, 587.33, 659.25, 587.33, 523.25, 440];
  let step = 0;

  const tick = () => {
    if (muted) {
      stopMusic();
      return;
    }
    const t = ac.currentTime + 0.05;
    const bass = progression[step % progression.length];
    const top = lead[step % lead.length];
    pulseKick({ ac, startAt: t });
    playDrone({ ac, freq: bass, gain: 0.05, type: "triangle", startAt: t, dur: 0.32 });
    playDrone({ ac, freq: top, gain: 0.025, type: "sawtooth", startAt: t + 0.08, dur: 0.28 });
    if (step % 2 === 0) {
      playDrone({ ac, freq: bass * 2, gain: 0.014, type: "square", startAt: t + 0.12, dur: 0.2 });
    }
    step += 1;
  };

  tick();
  musicTimer = window.setInterval(tick, 420);
}

export function stopMusic() {
  if (musicTimer !== null) {
    window.clearInterval(musicTimer);
    musicTimer = null;
  }
  if (musicGain) {
    const ac = ensureCtx();
    if (ac) {
      musicGain.gain.cancelScheduledValues(ac.currentTime);
      musicGain.gain.setValueAtTime(musicGain.gain.value, ac.currentTime);
      musicGain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.15);
    }
    musicGain.disconnect();
    musicGain = null;
  }
  musicStarted = false;
}

export const music = {
  start: startMusic,
  stop: stopMusic,
};

export function subscribeMute(fn: (m: boolean) => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

interface ToneOptions {
  freq: number;
  to?: number;
  dur?: number;
  type?: OscillatorType;
  gain?: number;
  delay?: number;
}

function tone({ freq, to, dur = 0.16, type = "sine", gain = 0.16, delay = 0 }: ToneOptions) {
  const ac = ensureCtx();
  if (!ac || muted) return;
  const t0 = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const amp = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(to, 1), t0 + dur);
  amp.gain.setValueAtTime(0.0001, t0);
  amp.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(amp).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

function noise(dur = 0.25, gain = 0.22, delay = 0) {
  const ac = ensureCtx();
  if (!ac || muted) return;
  const frames = Math.floor(ac.sampleRate * dur);
  const buffer = ac.createBuffer(1, frames, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i += 1) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / frames) ** 2;
  }
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 1400;
  const amp = ac.createGain();
  amp.gain.value = gain;
  src.connect(filter).connect(amp).connect(ac.destination);
  src.start(ac.currentTime + delay);
}

export const sfx = {
  tap: () => tone({ freq: 520, to: 700, dur: 0.07, type: "square", gain: 0.07 }),
  select: () => tone({ freq: 320, to: 640, dur: 0.12, type: "triangle", gain: 0.1 }),
  flip: () => {
    tone({ freq: 900, to: 380, dur: 0.1, type: "sawtooth", gain: 0.07 });
    noise(0.09, 0.06);
  },
  hit: () => {
    noise(0.2, 0.22);
    tone({ freq: 180, to: 60, dur: 0.22, type: "square", gain: 0.18 });
  },
  block: () => {
    noise(0.14, 0.12);
    tone({ freq: 240, to: 200, dur: 0.16, type: "triangle", gain: 0.12 });
  },
  clash: () => {
    tone({ freq: 660, to: 300, dur: 0.2, type: "sawtooth", gain: 0.12 });
    tone({ freq: 990, to: 420, dur: 0.2, type: "sawtooth", gain: 0.08, delay: 0.03 });
  },
  win: () => {
    [523, 659, 784, 1046].forEach((f, i) =>
      tone({ freq: f, dur: 0.24, type: "triangle", gain: 0.13, delay: i * 0.1 }),
    );
  },
  lose: () => {
    [392, 330, 262, 196].forEach((f, i) =>
      tone({ freq: f, dur: 0.28, type: "sine", gain: 0.13, delay: i * 0.12 }),
    );
  },
  coin: () => {
    tone({ freq: 988, dur: 0.09, type: "square", gain: 0.1 });
    tone({ freq: 1319, dur: 0.16, type: "square", gain: 0.09, delay: 0.08 });
  },
  bell: () => {
    tone({ freq: 740, to: 520, dur: 0.5, type: "sine", gain: 0.16 });
    noise(0.3, 0.08);
  },
};
