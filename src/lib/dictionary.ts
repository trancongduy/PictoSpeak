// Free English dictionary (dictionaryapi.dev): IPA, audio, definitions, examples.

export interface Meaning {
  partOfSpeech: string;
  definition: string;
  example?: string;
}

export interface Entry {
  word: string;
  ipa?: string;
  audioUK?: string;
  audioAny?: string;
  meanings: Meaning[];
}

interface ApiEntry {
  word: string;
  phonetic?: string;
  phonetics?: { text?: string; audio?: string }[];
  meanings?: { partOfSpeech: string; definitions: { definition: string; example?: string }[] }[];
}

const cache = new Map<string, Entry | null>();

async function fetchEntry(word: string): Promise<Entry | null> {
  const r = await fetch('https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(word));
  if (r.status === 404) return null;
  if (!r.ok) throw new Error('dict ' + r.status);
  const list = (await r.json()) as ApiEntry[];
  const phon = list.flatMap((e) => e.phonetics ?? []);
  const uk = phon.find((p) => p.audio && /-uk\.mp3$/.test(p.audio));
  const anyAudio = phon.find((p) => p.audio);
  const ipa = (uk?.text ?? list.find((e) => e.phonetic)?.phonetic ?? phon.find((p) => p.text)?.text) || undefined;
  const meanings: Meaning[] = [];
  for (const e of list)
    for (const m of e.meanings ?? []) {
      const d = m.definitions[0];
      if (d && !meanings.some((x) => x.partOfSpeech === m.partOfSpeech))
        meanings.push({ partOfSpeech: m.partOfSpeech, definition: d.definition, example: d.example });
    }
  return { word: list[0]?.word ?? word, ipa, audioUK: uk?.audio, audioAny: anyAudio?.audio, meanings: meanings.slice(0, 3) };
}

/** Try the word, then simple base forms (cats -> cat, studied -> study, running -> run). */
function candidates(w: string): string[] {
  const out = [w];
  const add = (x: string) => x.length > 1 && !out.includes(x) && out.push(x);
  if (w.endsWith('ies')) add(w.slice(0, -3) + 'y');
  if (w.endsWith('es')) add(w.slice(0, -2));
  if (w.endsWith('s')) add(w.slice(0, -1));
  if (w.endsWith('ied')) add(w.slice(0, -3) + 'y');
  if (w.endsWith('ed')) {
    add(w.slice(0, -2));
    add(w.slice(0, -1));
    if (/(.)\1ed$/.test(w)) add(w.slice(0, -3));
  }
  if (w.endsWith('ing')) {
    add(w.slice(0, -3));
    add(w.slice(0, -3) + 'e');
    if (/(.)\1ing$/.test(w)) add(w.slice(0, -4));
  }
  if (w.endsWith("'s")) add(w.slice(0, -2));
  return out;
}

export async function lookup(word: string): Promise<Entry | null> {
  const w = word.toLowerCase().replace(/’/g, "'");
  if (cache.has(w)) return cache.get(w)!;
  let result: Entry | null = null;
  for (const c of candidates(w)) {
    result = await fetchEntry(c);
    if (result) break;
  }
  cache.set(w, result);
  return result;
}
