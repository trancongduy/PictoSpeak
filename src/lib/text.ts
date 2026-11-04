// Text utilities: clean OCR output, split into paragraphs / sentences / words.

const SPEAKER_RE = /^((?:[A-Z][A-Za-z]{0,14})(?: [A-Z][a-z]{1,14})?|[A-Z])\s?:\s+/;

export function cleanOcrText(raw: string): string {
  let t = raw.replace(/\r/g, '');
  t = t.replace(/[‘’`]/g, "'").replace(/[“”]/g, '"').replace(/\|/g, 'I');
  // Re-join words hyphenated across line breaks: "exam-\nple" -> "example"
  t = t.replace(/([A-Za-z])-\n\s*([a-z])/g, '$1$2');
  // A line that starts with "Name:" begins a new paragraph (dialogues)
  t = t.replace(/\n(?=(?:[A-Z][A-Za-z]{0,14}|[A-Z])\s?:\s)/g, '\n\n');
  // A short line without final punctuation followed by a capitalised line is a heading -> own paragraph
  t = t.replace(/^([^\n.!?:;,]{1,40})\n(?=[A-Z])/gm, (m, line: string) =>
    line.trim().split(/\s+/).length <= 5 ? line + '\n\n' : m,
  );
  const paras = t
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, ' ').replace(/[ \t]+/g, ' ').trim())
    .filter((p) => (p.match(/[A-Za-z]/g) ?? []).length >= 2);
  return paras.join('\n\n');
}

export interface Sentence {
  id: number;
  para: number;
  text: string; // displayed text
  speakText: string; // text sent to TTS (speaker label removed)
  speaker?: string;
}

export interface Paragraph {
  index: number;
  speaker?: string;
  sentences: Sentence[];
}

export interface Doc {
  paragraphs: Paragraph[];
  sentences: Sentence[];
}

type SegmenterLike = { segment(s: string): Iterable<{ segment: string }> };
const segmenter: SegmenterLike | null = (() => {
  try {
    const S = (Intl as unknown as { Segmenter?: new (l: string, o: object) => SegmenterLike }).Segmenter;
    return S ? new S('en', { granularity: 'sentence' }) : null;
  } catch {
    return null;
  }
})();

export function splitSentences(paragraph: string): string[] {
  let parts: string[];
  if (segmenter) parts = Array.from(segmenter.segment(paragraph), (s) => s.segment);
  else parts = paragraph.match(/[^.!?]+(?:[.!?]+["')\]]*)\s*|[^.!?]+$/g) ?? [paragraph];
  // merge very short fragments (e.g. "Mr.", "1.") with the next one
  const out: string[] = [];
  for (const p of parts.map((s) => s.trim()).filter(Boolean)) {
    const prev = out[out.length - 1];
    if (prev && (prev.split(/\s+/).length <= 1 || /\b(Mr|Mrs|Ms|Dr|St|No|vs|etc)\.$/.test(prev))) {
      out[out.length - 1] = prev + ' ' + p;
    } else out.push(p);
  }
  return out;
}

export function buildDoc(text: string): Doc {
  const paragraphs: Paragraph[] = [];
  const sentences: Sentence[] = [];
  text
    .split(/\n\s*\n|\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .forEach((pText, pi) => {
      const m = pText.match(SPEAKER_RE);
      const speaker = m ? m[1] : undefined;
      const para: Paragraph = { index: pi, speaker, sentences: [] };
      splitSentences(pText).forEach((s, si) => {
        const speakText = si === 0 && m ? s.replace(SPEAKER_RE, '') : s;
        const sent: Sentence = { id: sentences.length, para: pi, text: s, speakText, speaker };
        para.sentences.push(sent);
        sentences.push(sent);
      });
      paragraphs.push(para);
    });
  return { paragraphs, sentences };
}

export interface Token {
  text: string;
  word: boolean;
}

const WORD_RE = /[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g;

export function tokenize(s: string): Token[] {
  const out: Token[] = [];
  let last = 0;
  for (const m of s.matchAll(WORD_RE)) {
    const i = m.index ?? 0;
    if (i > last) out.push({ text: s.slice(last, i), word: false });
    out.push({ text: m[0], word: true });
    last = i + m[0].length;
  }
  if (last < s.length) out.push({ text: s.slice(last), word: false });
  return out;
}

const NUM: Record<string, string> = {
  '0': 'zero', '1': 'one', '2': 'two', '3': 'three', '4': 'four', '5': 'five', '6': 'six',
  '7': 'seven', '8': 'eight', '9': 'nine', '10': 'ten', '11': 'eleven', '12': 'twelve',
  '20': 'twenty', '30': 'thirty', '100': 'hundred',
};

export function normWord(w: string): string {
  const x = w.toLowerCase().replace(/’/g, "'").replace(/[^a-z0-9]/g, '');
  return NUM[x] ?? x;
}

export function words(s: string): string[] {
  return (s.match(WORD_RE) ?? []).map(normWord).filter(Boolean);
}

/** Align reference words with spoken/typed words (LCS). Returns which reference words were matched. */
export function compareWords(reference: string, attempt: string): { tokens: Token[]; ok: boolean[]; score: number } {
  const tokens = tokenize(reference);
  const ref = tokens.filter((t) => t.word).map((t) => normWord(t.text));
  const hyp = words(attempt);
  const n = ref.length;
  const m = hyp.length;
  const dp = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i][j] = ref[i] === hyp[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const ok = new Array<boolean>(n).fill(false);
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (ref[i] === hyp[j]) {
      ok[i] = true;
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  const score = n ? Math.round((ok.filter(Boolean).length / n) * 100) : 0;
  return { tokens, ok, score };
}

export function titleFrom(text: string): string {
  const first = text.trim().split(/\s+/).slice(0, 8).join(' ');
  return first.length > 50 ? first.slice(0, 50) + '…' : first || 'Bài đọc';
}
