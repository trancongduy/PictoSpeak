import Dexie, { type Table } from 'dexie';

export interface Scan {
  id?: number;
  createdAt: number;
  title: string;
  text: string;
  thumb?: string;
  lastSentence?: number;
}

export interface Word {
  id?: number;
  word: string;
  ipa?: string;
  meaningVi?: string;
  definition?: string;
  example?: string;
  createdAt: number;
  due: number;
  interval: number;
  ease: number;
  reps: number;
}

export interface Translation {
  text: string;
  vi: string;
}

export interface DayStat {
  date: string; // YYYY-MM-DD
  listened: number;
  practiced: number;
  reviewed: number;
}

class PictoDB extends Dexie {
  scans!: Table<Scan, number>;
  words!: Table<Word, number>;
  translations!: Table<Translation, string>;
  stats!: Table<DayStat, string>;
  constructor() {
    super('pictospeak');
    this.version(1).stores({
      scans: '++id, createdAt',
      words: '++id, &word, due, createdAt',
      translations: '&text',
      stats: '&date',
    });
  }
}

export const db = new PictoDB();

export const today = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export async function bumpStat(field: 'listened' | 'practiced' | 'reviewed', n = 1) {
  const date = today();
  await db.transaction('rw', db.stats, async () => {
    const s = (await db.stats.get(date)) ?? { date, listened: 0, practiced: 0, reviewed: 0 };
    s[field] += n;
    await db.stats.put(s);
  });
}

export async function getStreak(): Promise<number> {
  const all = await db.stats.toArray();
  const active = new Set(all.filter((s) => s.listened + s.practiced + s.reviewed > 0).map((s) => s.date));
  const d = new Date();
  if (!active.has(today(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (active.has(today(d))) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}
