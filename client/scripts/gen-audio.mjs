/**
 * Procedurally synthesize placeholder game audio (SFX, music pads, ambient
 * beds) as real, audible clips and encode them to MP3 (universally supported,
 * incl. Safari — unlike the previous near-silent Ogg/Opus blips).
 *
 * Usage: node client/scripts/gen-audio.mjs
 * Requires ffmpeg (libmp3lame) on PATH.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir as osTmp } from 'node:os';

const SR = 44100;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'audio');
const TMP = join(osTmp(), 'nj-audio-gen');

const TAU = Math.PI * 2;

/** Render a mono Float32 buffer from a sample function s(t) in [-1, 1]. */
function render(durationSec, fn) {
  const n = Math.floor(durationSec * SR);
  const buf = new Float32Array(n);
  for (let i = 0; i < n; i++) buf[i] = fn(i / SR, i, n);
  return buf;
}

/** Soft-clip / normalize to avoid harsh clipping. */
function normalize(buf, peak = 0.9) {
  let max = 0;
  for (const v of buf) max = Math.max(max, Math.abs(v));
  if (max < 1e-6) return buf;
  const g = peak / max;
  for (let i = 0; i < buf.length; i++) buf[i] *= g;
  return buf;
}

/** Apply short linear fade in/out (seconds) to kill clicks / loop seams. */
function fade(buf, inSec, outSec) {
  const inN = Math.floor(inSec * SR);
  const outN = Math.floor(outSec * SR);
  for (let i = 0; i < inN; i++) buf[i] *= i / inN;
  for (let i = 0; i < outN; i++) buf[buf.length - 1 - i] *= i / outN;
  return buf;
}

function sine(t, f) {
  return Math.sin(TAU * f * t);
}

function writeWav(path, buf) {
  const n = buf.length;
  const bytes = Buffer.alloc(44 + n * 2);
  bytes.write('RIFF', 0);
  bytes.writeUInt32LE(36 + n * 2, 4);
  bytes.write('WAVE', 8);
  bytes.write('fmt ', 12);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20); // PCM
  bytes.writeUInt16LE(1, 22); // mono
  bytes.writeUInt32LE(SR, 24);
  bytes.writeUInt32LE(SR * 2, 28);
  bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36);
  bytes.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, buf[i]));
    bytes.writeInt16LE(Math.round(s * 32767), 44 + i * 2);
  }
  writeFileSync(path, bytes);
}

/** A short decaying chord/tone SFX. freqs: Hz[], decay: 1/sec. */
function tone(duration, freqs, decay, { vibrato = 0 } = {}) {
  return render(duration, (t) => {
    const env = Math.exp(-decay * t);
    let s = 0;
    for (const f of freqs) {
      const fm = vibrato ? f * (1 + 0.01 * Math.sin(TAU * vibrato * t)) : f;
      s += sine(t, fm);
    }
    return (s / freqs.length) * env;
  });
}

/** Filtered-noise burst (whoosh / impact). lp: simple one-pole lowpass coeff. */
function noiseBurst(duration, decay, lp = 0.2) {
  let prev = 0;
  return render(duration, (t) => {
    const white = Math.random() * 2 - 1;
    prev = prev + lp * (white - prev);
    return prev * Math.exp(-decay * t);
  });
}

/** Sustained chord pad for looping music. */
function pad(duration, freqs, { tremolo = 0.12, tremDepth = 0.18 } = {}) {
  const buf = render(duration, (t) => {
    let s = 0;
    for (const f of freqs) {
      // light detune + a quiet fifth-ish overtone for warmth
      s += sine(t, f) + 0.4 * sine(t, f * 1.005) + 0.2 * sine(t, f * 2);
    }
    const trem = 1 - tremDepth + tremDepth * Math.sin(TAU * tremolo * t);
    return (s / (freqs.length * 1.6)) * trem * 0.5;
  });
  return buf;
}

/** Ambient noise bed with slow amplitude swells. */
function ambientBed(duration, { color = 0.12, swell = 0.08, lp = 0.05 } = {}) {
  let prev = 0;
  const buf = render(duration, (t) => {
    const white = Math.random() * 2 - 1;
    prev = prev + lp * (white - prev); // lowpass -> wind/waves character
    const env = 0.55 + 0.45 * Math.sin(TAU * swell * t);
    return prev * color * env;
  });
  return buf;
}

// freqs
const C4 = 261.63,
  E4 = 329.63,
  G4 = 392.0,
  A3 = 220.0,
  D4 = 293.66,
  Fs4 = 369.99,
  A4 = 440.0,
  C5 = 523.25,
  E5 = 659.25,
  G5 = 783.99,
  C6 = 1046.5;

/** clipId -> { dir, buf }. */
const CLIPS = {
  // --- SFX ---
  sfx_ui_click: { dir: 'sfx', buf: fade(tone(0.1, [1400], 40), 0.002, 0.02) },
  sfx_ui_open: { dir: 'sfx', buf: fade(tone(0.22, [880, 1320], 9), 0.002, 0.04) },
  sfx_ui_close: { dir: 'sfx', buf: fade(tone(0.22, [620, 440], 9), 0.002, 0.04) },
  sfx_melee_swing: { dir: 'sfx', buf: fade(noiseBurst(0.22, 16, 0.35), 0.005, 0.05) },
  sfx_melee_hit: { dir: 'sfx', buf: fade(noiseBurst(0.18, 26, 0.12), 0.001, 0.03) },
  sfx_skill_cast: { dir: 'sfx', buf: fade(tone(0.45, [880, 1320, 1760], 5, { vibrato: 6 }), 0.01, 0.08) },
  sfx_level_up: {
    dir: 'sfx',
    buf: (() => {
      // ascending arpeggio C5 E5 G5 C6
      const steps = [C5, E5, G5, C6];
      const stepDur = 0.16;
      const total = stepDur * steps.length + 0.2;
      return fade(
        render(total, (t) => {
          const idx = Math.min(steps.length - 1, Math.floor(t / stepDur));
          const local = t - idx * stepDur;
          return sine(t, steps[idx]) * Math.exp(-6 * local) * 0.9;
        }),
        0.002,
        0.1
      );
    })(),
  },
  sfx_combat_stinger: { dir: 'sfx', buf: fade(tone(0.6, [330, 392, 494], 3.5), 0.005, 0.12) },
  sfx_soulshot: { dir: 'sfx', buf: fade(tone(0.2, [2000, 3000], 24), 0.001, 0.03) },
  sfx_footstep: { dir: 'sfx', buf: fade(tone(0.1, [120, 90], 35), 0.001, 0.02) },

  // --- Music pads (loopable ~22s) ---
  music_town: { dir: 'music', buf: fade(pad(22, [C4, E4, G4], { tremolo: 0.08 }), 0.5, 0.5) },
  music_field: { dir: 'music', buf: fade(pad(22, [A3, C4, E4], { tremolo: 0.06 }), 0.5, 0.5) },
  music_harbor: { dir: 'music', buf: fade(pad(22, [D4, Fs4, A4], { tremolo: 0.05 }), 0.5, 0.5) },

  // --- Ambient beds (~16s) ---
  ambient_village: { dir: 'ambient', buf: fade(ambientBed(16, { color: 0.1, swell: 0.12, lp: 0.12 }), 0.4, 0.4) },
  ambient_wind: { dir: 'ambient', buf: fade(ambientBed(16, { color: 0.16, swell: 0.07, lp: 0.04 }), 0.4, 0.4) },
  ambient_waves: { dir: 'ambient', buf: fade(ambientBed(16, { color: 0.18, swell: 0.1, lp: 0.06 }), 0.4, 0.4) },
};

rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });
for (const dir of ['sfx', 'music', 'ambient']) mkdirSync(join(OUT, dir), { recursive: true });

for (const [id, { dir, buf }] of Object.entries(CLIPS)) {
  normalize(buf, dir === 'sfx' ? 0.85 : 0.6);
  const wav = join(TMP, `${id}.wav`);
  writeWav(wav, buf);
  const mp3 = join(OUT, dir, `${id}.mp3`);
  const bitrate = dir === 'sfx' ? '96k' : '128k';
  execFileSync('ffmpeg', ['-y', '-i', wav, '-codec:a', 'libmp3lame', '-b:a', bitrate, mp3], {
    stdio: 'ignore',
  });
  console.log(`wrote ${mp3} (${(buf.length / SR).toFixed(2)}s)`);
}

rmSync(TMP, { recursive: true, force: true });
console.log('done');
