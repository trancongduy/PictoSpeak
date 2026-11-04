import { useEffect, useMemo, useRef, useState } from 'react';
import type { Nav } from '../App';
import { bumpStat, db } from '../lib/db';
import { useSettings } from '../lib/settings';
import { listen, sttSupported, type Listening } from '../lib/stt';
import { buildDoc, compareWords } from '../lib/text';
import { langOf, mixPool, resolveVoice, speakOnce, stopSpeaking, useVoices } from '../lib/tts';

export type PracticeMode = 'shadow' | 'speak' | 'dictation';

const MODES: { v: PracticeMode; label: string; desc: string }[] = [
  { v: 'shadow', label: '🔁 Nhại theo', desc: 'Nghe một câu, rồi nói lặp lại ngay sau (shadowing) — luyện ngữ điệu và phản xạ.' },
  { v: 'speak', label: '🎤 Phát âm', desc: 'Đọc to câu, máy chấm từng từ đúng (xanh) / sai (đỏ).' },
  { v: 'dictation', label: '✍️ Chính tả', desc: 'Nghe và gõ lại câu — luyện nghe chi tiết như bài IELTS Listening.' },
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function randomSentences(n = 10): Promise<string[]> {
  const scans = await db.scans.toArray();
  const all = scans
    .flatMap((s) => buildDoc(s.text).sentences.map((x) => x.speakText))
    .filter((s) => {
      const c = s.split(/\s+/).length;
      return c >= 4 && c <= 30;
    });
  return all.sort(() => Math.random() - 0.5).slice(0, n);
}

export default function Practice({ nav, init }: { nav: Nav; init: { sentences: string[]; mode: PracticeMode } | null }) {
  const [mode, setMode] = useState<PracticeMode>(init?.mode ?? 'shadow');
  const [sentences, setSentences] = useState<string[]>(init?.sentences ?? []);
  const [idx, setIdx] = useState(0);
  const settings = useSettings();
  const voices = useVoices();

  const voice = useMemo(() => {
    if (settings.accent === 'mix') {
      const pool = mixPool(voices, settings);
      return pool.length ? pool[idx % pool.length] : undefined;
    }
    return resolveVoice(voices, settings.accent, settings);
  }, [voices, settings, idx]);

  useEffect(() => {
    if (!init?.sentences.length) randomSentences().then(setSentences);
    return () => stopSpeaking();
  }, [init]);

  const sentence = sentences[idx];
  const move = (d: number) => {
    stopSpeaking();
    setIdx((i) => Math.max(0, Math.min(sentences.length - 1, i + d)));
  };

  return (
    <>
      <header className="topbar">
        <h1>Luyện tập</h1>
        {sentences.length > 0 && <span className="muted small">{idx + 1} / {sentences.length}</span>}
      </header>
      <main className="main stack">
        <div className="seg">
          {MODES.map((m) => (
            <button key={m.v} className={mode === m.v ? 'on' : ''} onClick={() => { stopSpeaking(); setMode(m.v); }}>
              {m.label}
            </button>
          ))}
        </div>
        <div className="small muted">{MODES.find((m) => m.v === mode)!.desc}</div>

        {!sentence ? (
          <div className="empty">
            <div className="ico">🎯</div>
            <p>Chưa có câu để luyện. Hãy chụp và lưu một bài đọc trước nhé.</p>
            <button className="btn primary" onClick={() => nav.go('home')}>📸 Chụp ảnh</button>
          </div>
        ) : (
          <>
            {mode === 'shadow' && <Shadow key={sentence + idx} sentence={sentence} voice={voice} />}
            {mode === 'speak' && <Speak key={sentence + idx} sentence={sentence} voice={voice} />}
            {mode === 'dictation' && <Dictation key={sentence + idx} sentence={sentence} voice={voice} />}

            <div className="row">
              <button className="btn grow" disabled={idx === 0} onClick={() => move(-1)}>‹ Câu trước</button>
              <button className="btn primary grow" disabled={idx >= sentences.length - 1} onClick={() => move(1)}>Câu sau ›</button>
            </div>
            <button
              className="btn ghost"
              onClick={() => {
                stopSpeaking();
                randomSentences().then((s) => { setSentences(s); setIdx(0); });
              }}
            >
              🎲 Lấy 10 câu ngẫu nhiên từ các bài đã đọc
            </button>
          </>
        )}
      </main>
    </>
  );
}

function ListenButtons({ sentence, voice }: { sentence: string; voice?: SpeechSynthesisVoice }) {
  const s = useSettings();
  const say = (rate: number) => {
    stopSpeaking();
    speakOnce(sentence, voice, rate);
  };
  return (
    <div className="row">
      <button className="btn grow" onClick={() => say(s.rate)}>🔊 Nghe mẫu</button>
      <button className="btn grow" onClick={() => say(Math.min(0.65, s.rate))}>🐢 Nghe chậm</button>
    </div>
  );
}

function Shadow({ sentence, voice }: { sentence: string; voice?: SpeechSynthesisVoice }) {
  const s = useSettings();
  const [times, setTimes] = useState(3);
  const [phase, setPhase] = useState<'idle' | 'listen' | 'you'>('idle');
  const [round, setRound] = useState(0);
  const [hide, setHide] = useState(false);
  const [left, setLeft] = useState(0);
  const run = useRef(0);

  useEffect(() => () => { run.current++; }, []);

  const start = async () => {
    const my = ++run.current;
    stopSpeaking();
    for (let r = 0; r < times; r++) {
      if (my !== run.current) return;
      setRound(r);
      setPhase('listen');
      const d = await speakOnce(sentence, voice, s.rate);
      if (my !== run.current) return;
      setPhase('you');
      const wait = Math.max(1500, d * 1.2 + 800);
      const end = Date.now() + wait;
      while (Date.now() < end) {
        if (my !== run.current) return;
        setLeft(Math.ceil((end - Date.now()) / 1000));
        await sleep(200);
      }
    }
    bumpStat('practiced');
    setPhase('idle');
  };

  const stop = () => {
    run.current++;
    stopSpeaking();
    setPhase('idle');
  };

  return (
    <div className="card stack">
      <div className="big-sentence" lang="en" style={{ filter: hide && phase !== 'idle' ? 'blur(7px)' : undefined }}>{sentence}</div>
      <div className="row wrap small">
        <span>Số lần:</span>
        <div className="chips">
          {[2, 3, 5, 8].map((n) => (
            <button key={n} className={`chip ${times === n ? 'on' : ''}`} onClick={() => setTimes(n)}>{n}</button>
          ))}
        </div>
        <label className="row" style={{ marginLeft: 'auto' }}>
          <input type="checkbox" checked={hide} onChange={(e) => setHide(e.target.checked)} /> Che chữ
        </label>
      </div>
      {phase === 'idle' ? (
        <button className="btn primary big block" onClick={start}>▶ Bắt đầu nhại theo</button>
      ) : (
        <div className="stack center">
          <div style={{ fontSize: 40 }} className="pulse">{phase === 'listen' ? '👂' : '🗣️'}</div>
          <b>{phase === 'listen' ? 'Nghe kỹ…' : `Đến lượt em nói! (${left}s)`}</b>
          <div className="small muted">Lần {round + 1} / {times}</div>
          <button className="btn" onClick={stop}>■ Dừng</button>
        </div>
      )}
    </div>
  );
}

function Speak({ sentence, voice }: { sentence: string; voice?: SpeechSynthesisVoice }) {
  const [state, setState] = useState<'idle' | 'rec'>('idle');
  const [heard, setHeard] = useState('');
  const [result, setResult] = useState<ReturnType<typeof compareWords> | null>(null);
  const [err, setErr] = useState('');
  const recRef = useRef<Listening | null>(null);

  useEffect(() => () => recRef.current?.stop(), []);

  const toggle = async () => {
    if (state === 'rec') {
      recRef.current?.stop();
      return;
    }
    stopSpeaking();
    setErr('');
    setHeard('');
    setResult(null);
    setState('rec');
    try {
      const l = listen(voice ? langOf(voice) : 'en-GB', setHeard);
      recRef.current = l;
      const text = await l.result;
      setHeard(text);
      if (text.trim()) {
        setResult(compareWords(sentence, text));
        bumpStat('practiced');
      } else setErr('Không nghe thấy gì, thử lại nhé.');
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setState('idle');
      recRef.current = null;
    }
  };

  const feedback = (sc: number) =>
    sc >= 90 ? 'Xuất sắc! 🎉' : sc >= 70 ? 'Tốt lắm! 👍' : sc >= 40 ? 'Cố lên, thử lại nhé 💪' : 'Nghe mẫu rồi thử lại 🙂';

  let wi = 0;
  return (
    <div className="card stack">
      <div className="big-sentence attempt" lang="en">
        {result
          ? result.tokens.map((t, i) =>
              t.word ? (
                <span key={i} className={`w ${result.ok[wi++] ? 'ok' : 'miss'}`}>{t.text}</span>
              ) : (
                <span key={i}>{t.text}</span>
              ),
            )
          : sentence}
      </div>
      <ListenButtons sentence={sentence} voice={voice} />
      {!sttSupported ? (
        <div className="small muted">
          Trình duyệt này chưa hỗ trợ nhận dạng giọng nói. Trên iPhone hãy mở bằng <b>Safari</b> và bật <i>Cài đặt → Cài đặt chung → Bàn phím → Đọc chính tả</i>.
        </div>
      ) : (
        <button className={`btn big block ${state === 'rec' ? 'danger pulse' : 'primary'}`} onClick={toggle}>
          {state === 'rec' ? '■ Đang nghe… bấm khi nói xong' : '🎤 Bấm và đọc to câu trên'}
        </button>
      )}
      {heard && <div className="small"><span className="muted">Máy nghe được: </span>“{heard}”</div>}
      {result && (
        <div className="row">
          <div className="score" style={{ color: result.score >= 70 ? 'var(--good)' : 'var(--bad)' }}>{result.score}%</div>
          <div className="grow">{feedback(result.score)}<div className="tiny muted">Từ đỏ là từ máy chưa nghe rõ — nghe mẫu và đọc lại.</div></div>
        </div>
      )}
      {err && <div className="small" style={{ color: 'var(--bad)' }}>{err}</div>}
    </div>
  );
}

function Dictation({ sentence, voice }: { sentence: string; voice?: SpeechSynthesisVoice }) {
  const [typed, setTyped] = useState('');
  const [result, setResult] = useState<ReturnType<typeof compareWords> | null>(null);
  const [hint, setHint] = useState(false);

  const check = () => {
    setResult(compareWords(sentence, typed));
    bumpStat('practiced');
  };

  const hintText = sentence.replace(/[A-Za-z]+/g, (w) => w[0] + '_'.repeat(Math.max(0, w.length - 1)));

  let wi = 0;
  return (
    <div className="card stack">
      <ListenButtons sentence={sentence} voice={voice} />
      {hint && !result && <div className="small muted" lang="en" style={{ letterSpacing: 1 }}>{hintText}</div>}
      <textarea
        className="input"
        style={{ minHeight: 110 }}
        placeholder="Gõ lại những gì em nghe được…"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        autoCapitalize="sentences"
        autoCorrect="off"
        spellCheck={false}
        lang="en"
      />
      <div className="row">
        {!result && <button className="btn grow" onClick={() => setHint(!hint)}>💡 Gợi ý</button>}
        <button className="btn primary grow" disabled={!typed.trim()} onClick={check}>✔ Kiểm tra</button>
      </div>
      {result && (
        <>
          <div className="row">
            <div className="score" style={{ color: result.score >= 70 ? 'var(--good)' : 'var(--bad)' }}>{result.score}%</div>
            <div className="grow small muted">Từ màu đỏ là từ em bỏ sót hoặc viết sai.</div>
          </div>
          <div className="big-sentence attempt" lang="en">
            {result.tokens.map((t, i) =>
              t.word ? <span key={i} className={`w ${result.ok[wi++] ? 'ok' : 'miss'}`}>{t.text}</span> : <span key={i}>{t.text}</span>,
            )}
          </div>
          <button className="btn" onClick={() => { setResult(null); setTyped(''); }}>↺ Làm lại</button>
        </>
      )}
    </div>
  );
}
