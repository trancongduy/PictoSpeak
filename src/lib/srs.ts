import type { Word } from './db';

export type Grade = 0 | 1 | 2 | 3; // Quên, Khó, Nhớ, Dễ
const DAY = 86_400_000;

export function newCard(): Pick<Word, 'due' | 'interval' | 'ease' | 'reps'> {
  return { due: Date.now(), interval: 0, ease: 2.5, reps: 0 };
}

export function review(w: Word, g: Grade): Partial<Word> {
  let { interval, ease } = w;
  const { reps } = w;
  const now = Date.now();
  if (g === 0) {
    return { interval: 0, reps: 0, ease: Math.max(1.3, ease - 0.2), due: now + 5 * 60_000 };
  }
  if (g === 1) {
    interval = Math.max(1, Math.round(interval * 1.2));
    ease = Math.max(1.3, ease - 0.15);
  } else if (g === 2) {
    interval = reps === 0 ? 1 : reps === 1 ? 3 : Math.round(interval * ease);
  } else {
    interval = reps === 0 ? 3 : Math.round(Math.max(interval, 1) * ease * 1.3);
    ease += 0.15;
  }
  return { interval, ease, reps: reps + 1, due: now + interval * DAY };
}

export function nextLabel(w: Word, g: Grade): string {
  if (g === 0) return '5 phút';
  const d = review(w, g).interval ?? 1;
  return d < 30 ? `${d} ngày` : `${Math.round(d / 30)} tháng`;
}
