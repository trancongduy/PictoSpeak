// Text-to-speech built on the browser's speechSynthesis (free, offline on iOS).
import { useEffect, useState } from 'react';
import type { AccentChoice, Settings } from './settings';
import type { Sentence } from './text';

export const ACCENTS: { code: Exclude<AccentChoice, 'mix'>; flag: string; label: string; langs: string[] }[] = [
  { code: 'en-GB', flag: '🇬🇧', label: 'Anh-Anh', langs: ['en-GB'] },
  { code: 'en-AU', flag: '🇦🇺', label: 'Úc', langs: ['en-AU', 'en-NZ'] },
  { code: 'en-US', flag: '🇺🇸', label: 'Mỹ', langs: ['en-US', 'en-CA'] },
  { code: 'en-IE', flag: '🇮🇪', label: 'Ireland / Nam Phi', langs: ['en-IE', 'en-ZA', 'en-SCOTLAND'] },
];

// Preferred natural-sounding voices (iOS / macOS / Edge / Chrome names)
const PREFERRED = [
  'serena', 'daniel', 'kate', 'arthur', 'martha', 'oliver', 'stephanie', 'jamie',
  'karen', 'lee', 'catherine', 'gordon', 'matilda',
  'ava', 'zoe', 'evan', 'nathan', 'samantha', 'allison', 'tom', 'susan',
  'moira', 'tessa', 'fiona', 'sonia', 'ryan', 'libby', 'natasha', 'william', 'jenny', 'aria', 'guy',
];
// Novelty / robotic voices on Apple devices — never use for learning
const NOVELTY = new Set([
  'albert', 'bad news', 'bahh', 'bells', 'boing', 'bubbles', 'cellos', 'good news', 'jester', 'organ',
  'superstar', 'trinoids', 'whisper', 'wobble', 'zarvox', 'fred', 'junior', 'ralph', 'kathy',
  'eddy', 'flo', 'grandma', 'grandpa', 'reed', 'rocko', 'sandy', 'shelley', 'deranged', 'hysterical',
  'pipe organ', 'princess', 'agnes', 'bruce', 'vicki', 'victoria',
]);

export const langOf = (v: SpeechSynthesisVoice) => v.lang.replace('_', '-');
const baseName = (v: SpeechSynthesisVoice) => v.name.toLowerCase().replace(/\s*\(.*\)\s*/g, '').trim();

export function voiceQuality(v: SpeechSynthesisVoice): number {
  const id = (v.voiceURI + ' ' + v.name).toLowerCase();
  let q = 0;
  if (id.includes('premium')) q += 30;
  else if (id.includes('enhanced')) q += 20;
  if (/neural|natural|online/.test(id)) q += 25;
  const i = PREFERRED.indexOf(baseName(v).split(' ').pop() ?? '');
  if (i >= 0) q += 10;
  if (v.localService) q += 1;
  return q;
}

export function qualityLabel(v: SpeechSynthesisVoice): string | null {
  const id = (v.voiceURI + ' ' + v.name).toLowerCase();
  if (id.includes('premium')) return 'Premium';
  if (id.includes('enhanced')) return 'Nâng cao';
  if (/neural|natural|online/.test(id)) return 'Tự nhiên';
  return null;
}

export function isUsable(v: SpeechSynthesisVoice) {
  return langOf(v).toLowerCase().startsWith('en') && !NOVELTY.has(baseName(v));
}

export function voicesForAccent(voices: SpeechSynthesisVoice[], accent: Exclude<AccentChoice, 'mix'>) {
  const langs = ACCENTS.find((a) => a.code === accent)?.langs ?? [accent];
  return voices
    .filter((v) => isUsable(v) && langs.some((l) => langOf(v).toLowerCase().startsWith(l.toLowerCase())))
    .sort((a, b) => voiceQuality(b) - voiceQuality(a));
}

let cache: SpeechSynthesisVoice[] = [];

export function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  if (!('speechSynthesis' in window)) return Promise.resolve([]);
  return new Promise((resolve) => {
    let tries = 0;
    const tick = () => {
      const v = speechSynthesis.getVoices();
      if (v.length || tries++ > 20) {
        cache = v;
        resolve(v);
      } else setTimeout(tick, 150);
    };
    tick();
  });
}

export function useVoices(): SpeechSynthesisVoice[] {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(cache);
  useEffect(() => {
    if (!('speechSynthesis' in window)) return;
    const update = () => setVoices(speechSynthesis.getVoices());
    loadVoices().then(setVoices);
    speechSynthesis.addEventListener('voiceschanged', update);
    return () => speechSynthesis.removeEventListener('voiceschanged', update);
  }, []);
  return voices;
}

export function resolveVoice(
  voices: SpeechSynthesisVoice[],
  accent: Exclude<AccentChoice, 'mix'>,
  settings: Settings,
): SpeechSynthesisVoice | undefined {
  const chosen = settings.voiceByAccent[accent];
  const list = voicesForAccent(voices, accent);
  return (
    list.find((v) => v.voiceURI === chosen) ??
    list[0] ??
    voices.filter(isUsable).sort((a, b) => voiceQuality(b) - voiceQuality(a))[0]
  );
}

/** Voice pool for "IELTS mix": alternate British / Australian / American / Irish voices. */
export function mixPool(voices: SpeechSynthesisVoice[], settings: Settings): SpeechSynthesisVoice[] {
  const lists = (['en-GB', 'en-AU', 'en-US', 'en-IE'] as const).map((a) => {
    const l = voicesForAccent(voices, a);
    const chosen = l.find((v) => v.voiceURI === settings.voiceByAccent[a]);
    return chosen ? [chosen, ...l.filter((v) => v !== chosen)] : l;
  });
  const order: [number, number][] = [[0, 0], [1, 0], [0, 1], [2, 0], [3, 0], [1, 1], [2, 1], [0, 2]];
  const pool: SpeechSynthesisVoice[] = [];
  for (const [a, i] of order) {
    const v = lists[a][i];
    if (v && !pool.includes(v)) pool.push(v);
  }
  return pool;
}

/** Returns a function mapping a sentence to the voice that should read it. */
export function voiceAssigner(voices: SpeechSynthesisVoice[], settings: Settings, sentences: Sentence[]) {
  if (settings.accent !== 'mix') {
    const v = resolveVoice(voices, settings.accent, settings);
    return () => v;
  }
  const pool = mixPool(voices, settings);
  if (!pool.length) return () => undefined;
  const speakers = new Map<string, number>();
  for (const s of sentences) if (s.speaker && !speakers.has(s.speaker)) speakers.set(s.speaker, speakers.size);
  return (s: Sentence) => {
    const idx = s.speaker && speakers.size >= 2 ? speakers.get(s.speaker)! : s.para;
    return pool[idx % pool.length];
  };
}

// ---------- playback ----------

const keep: SpeechSynthesisUtterance[] = []; // prevent GC bug in some browsers

export function stopSpeaking() {
  token++;
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}

let token = 0;

/** Speak one piece of text. Resolves with the spoken duration in ms. */
export function speakOnce(text: string, voice?: SpeechSynthesisVoice, rate = 1): Promise<number> {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window) || !text.trim()) return resolve(0);
    const u = new SpeechSynthesisUtterance(text);
    if (voice) {
      u.voice = voice;
      u.lang = langOf(voice);
    } else u.lang = 'en-GB';
    u.rate = rate;
    let started = Date.now();
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(watchdog);
      keep.splice(keep.indexOf(u), 1);
      resolve(Date.now() - started);
    };
    u.onstart = () => (started = Date.now());
    u.onend = finish;
    u.onerror = finish;
    const watchdog = setTimeout(finish, 6000 + (text.length * 120) / rate);
    keep.push(u);
    speechSynthesis.speak(u);
  });
}

/** iOS only lets speech start from a user gesture: speak a silent utterance on the first tap. */
export function unlockSpeechOnFirstTap() {
  if (!('speechSynthesis' in window)) return;
  const unlock = () => {
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    speechSynthesis.speak(u);
    window.removeEventListener('touchend', unlock);
    window.removeEventListener('click', unlock);
  };
  window.addEventListener('touchend', unlock);
  window.addEventListener('click', unlock);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface PlayItem {
  text: string;
  voice?: SpeechSynthesisVoice;
}

export interface PlayOptions {
  rate: number;
  repeat: number;
  gapMs: number;
  single?: boolean; // only play the start item
  onIndex?: (i: number) => void;
  onRepeat?: (n: number) => void;
}

/** Play a queue of sentences. Returns true when finished naturally, false if interrupted. */
export async function playQueue(items: PlayItem[], start: number, o: PlayOptions): Promise<boolean> {
  const wasBusy = 'speechSynthesis' in window && (speechSynthesis.speaking || speechSynthesis.pending);
  stopSpeaking();
  const my = ++token;
  if (wasBusy) await sleep(80); // Safari drops an utterance queued right after cancel()
  for (let i = start; i < items.length; i++) {
    if (my !== token) return false;
    o.onIndex?.(i);
    for (let r = 0; r < Math.max(1, o.repeat); r++) {
      if (my !== token) return false;
      o.onRepeat?.(r);
      await speakOnce(items[i].text, items[i].voice, o.rate);
      if (my !== token) return false;
      if (r < o.repeat - 1) await sleep(o.gapMs);
    }
    if (o.single) break;
    await sleep(o.repeat > 1 ? o.gapMs : 200);
  }
  return my === token;
}
