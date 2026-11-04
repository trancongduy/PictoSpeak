import { useSyncExternalStore } from 'react';

export type AccentChoice = 'en-GB' | 'en-AU' | 'en-US' | 'en-IE' | 'mix';

export interface Settings {
  accent: AccentChoice;
  voiceByAccent: Record<string, string>; // accent -> voiceURI
  rate: number;
  repeat: number; // times each sentence is read (loop)
  gapSec: number; // pause between repeats
  tapMode: 'sentence' | 'word';
  showVi: boolean;
}

const KEY = 'pictospeak.settings';
const DEFAULTS: Settings = {
  accent: 'en-GB',
  voiceByAccent: {},
  rate: 0.9,
  repeat: 1,
  gapSec: 1.5,
  tapMode: 'sentence',
  showVi: false,
};

let current: Settings = (() => {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return DEFAULTS;
  }
})();
const listeners = new Set<() => void>();

export function getSettings() {
  return current;
}

export function setSettings(patch: Partial<Settings>) {
  current = { ...current, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    /* private mode */
  }
  listeners.forEach((l) => l());
}

export function useSettings(): Settings {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
}
