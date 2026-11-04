// Speech recognition (Safari: webkitSpeechRecognition, uses Siri dictation).

interface RecResult {
  transcript: string;
}
interface RecEvent {
  results: ArrayLike<ArrayLike<RecResult> & { isFinal: boolean }>;
}
interface Rec {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((e: RecEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecCtor = new () => Rec;

const Ctor: RecCtor | undefined =
  (window as unknown as { SpeechRecognition?: RecCtor }).SpeechRecognition ??
  (window as unknown as { webkitSpeechRecognition?: RecCtor }).webkitSpeechRecognition;

export const sttSupported = !!Ctor;

export interface Listening {
  result: Promise<string>;
  stop: () => void;
}

const ERR_VI: Record<string, string> = {
  'not-allowed': 'Chưa cho phép dùng micro. Vào Cài đặt → Safari → Micro, và bật Siri & Đọc chính tả.',
  'service-not-allowed': 'Cần bật "Đọc chính tả" (Cài đặt → Cài đặt chung → Bàn phím → Bật Đọc chính tả).',
  'no-speech': 'Không nghe thấy gì, thử nói to hơn nhé.',
  network: 'Nhận dạng giọng nói cần có mạng.',
  'audio-capture': 'Không mở được micro.',
};

export function listen(lang: string, onInterim?: (t: string) => void): Listening {
  if (!Ctor) {
    return { result: Promise.reject(new Error('Trình duyệt không hỗ trợ nhận dạng giọng nói.')), stop: () => {} };
  }
  const rec = new Ctor();
  rec.lang = lang;
  rec.interimResults = true;
  rec.continuous = false;
  rec.maxAlternatives = 1;
  let text = '';
  const result = new Promise<string>((resolve, reject) => {
    rec.onresult = (e) => {
      text = Array.from(e.results, (r) => r[0].transcript).join(' ');
      onInterim?.(text);
    };
    rec.onerror = (e) => {
      if (e.error === 'aborted') return;
      reject(new Error(ERR_VI[e.error] ?? 'Lỗi nhận dạng: ' + e.error));
    };
    rec.onend = () => resolve(text);
  });
  rec.start();
  return { result, stop: () => rec.stop() };
}
