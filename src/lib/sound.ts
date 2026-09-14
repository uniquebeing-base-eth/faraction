/**
 * FarAction SFX — tiny WebAudio synth so the arena has punch without shipping
 * audio files. All cues are procedural and respect a persisted mute flag.
 */

import { cdnAsset } from "@/lib/assets";
import themePointer from "@/assets/audio-rise-of-junkies.mp3.asset.json";

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

let themeAudio: HTMLAudioElement | null = null;
let musicStarted = false;

/**
 * Season theme song. Served from the public CDN so it plays on any host
 * (Lovable preview, published app or the Cloudflare deployment).
 */
const THEME_SRC = cdnAsset(themePointer);

export function musicIsPlaying(): boolean {
  return musicStarted;
}

function startMusic() {
  if (typeof window === "undefined" || muted) return;
  if (musicStarted && themeAudio && !themeAudio.paused) return;
  if (!themeAudio) {
    themeAudio = new Audio(THEME_SRC);
    themeAudio.loop = true;
    themeAudio.preload = "auto";
    themeAudio.crossOrigin = "anonymous";
    themeAudio.volume = 0.45;
  }
  musicStarted = true;
  void themeAudio.play().catch(() => {
    // Autoplay blocked until the first user gesture; the root listener retries.
    musicStarted = false;
  });
}

export function stopMusic() {
  if (themeAudio) {
    themeAudio.pause();
    themeAudio.currentTime = 0;
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
