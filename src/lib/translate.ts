// English -> Vietnamese translation using free, key-less endpoints, cached in IndexedDB.
import { db } from './db';

async function viaGoogle(text: string): Promise<string> {
  const url =
    'https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t&q=' + encodeURIComponent(text);
  const r = await fetch(url);
  if (!r.ok) throw new Error('google ' + r.status);
  const j = (await r.json()) as [Array<[string]>];
  return j[0].map((x) => x[0]).join('');
}

async function viaMyMemory(text: string): Promise<string> {
  const url = 'https://api.mymemory.translated.net/get?langpair=en|vi&q=' + encodeURIComponent(text.slice(0, 480));
  const r = await fetch(url);
  if (!r.ok) throw new Error('mymemory ' + r.status);
  const j = (await r.json()) as { responseData?: { translatedText?: string } };
  const t = j.responseData?.translatedText;
  if (!t) throw new Error('mymemory empty');
  return t;
}

const inflight = new Map<string, Promise<string>>();

export function translate(text: string): Promise<string> {
  const key = text.trim();
  if (!key) return Promise.resolve('');
  const existing = inflight.get(key);
  if (existing) return existing;
  const p = (async () => {
    const cached = await db.translations.get(key);
    if (cached) return cached.vi;
    let vi: string;
    try {
      vi = await viaGoogle(key);
    } catch {
      vi = await viaMyMemory(key);
    }
    await db.translations.put({ text: key, vi });
    return vi;
  })().finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

export async function cachedTranslation(text: string): Promise<string | undefined> {
  return (await db.translations.get(text.trim()))?.vi;
}
