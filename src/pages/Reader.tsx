import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Nav } from '../App';
import WordPopup from '../components/WordPopup';
import AccentPicker from '../components/AccentPicker';
import { bumpStat, db } from '../lib/db';
import { setSettings, useSettings } from '../lib/settings';
import { buildDoc, cleanOcrText, titleFrom, tokenize, type Sentence } from '../lib/text';
import { translate } from '../lib/translate';
import { playQueue, stopSpeaking, useVoices, voiceAssigner } from '../lib/tts';

export default function Reader({ scanId, nav, onBack }: { scanId: number; nav: Nav; onBack: () => void }) {
  const scan = useLiveQuery(() => db.scans.get(scanId), [scanId]);
  const settings = useSettings();
  const voices = useVoices();
  const doc = useMemo(() => buildDoc(scan?.text ?? ''), [scan?.text]);
  const voiceFor = useMemo(() => voiceAssigner(voices, settings, doc.sentences), [voices, settings, doc]);

  const [cur, setCur] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [rep, setRep] = useState(0);
  const [word, setWord] = useState<{ w: string; ctx: string; s: Sentence } | null>(null);
  const [vi, setVi] = useState<Record<number, string>>({});
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [showOpts, setShowOpts] = useState(false);
  const sentRefs = useRef<Record<number, HTMLSpanElement | null>>({});
  const initDone = useRef(false);

  useEffect(() => {
    if (scan && !initDone.current) {
      initDone.current = true;
      setCur(Math.min(scan.lastSentence ?? 0, Math.max(0, doc.sentences.length - 1)));
    }
  }, [scan, doc]);

  useEffect(() => () => stopSpeaking(), []);

  // Vietnamese translations, fetched lazily with small concurrency
  useEffect(() => {
    if (!settings.showVi || !doc.sentences.length) return;
    let alive = true;
    const queue = doc.sentences.filter((s) => vi[s.id] === undefined);
    const worker = async () => {
      while (alive && queue.length) {
        const s = queue.shift()!;
        try {
          const t = await translate(s.text);
          if (alive) setVi((m) => ({ ...m, [s.id]: t }));
        } catch {
          if (alive) setVi((m) => ({ ...m, [s.id]: '(không dịch được – kiểm tra mạng)' }));
        }
      }
    };
    Promise.all([worker(), worker(), worker()]);
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.showVi, doc]);

  const scrollTo = (i: number) =>
    sentRefs.current[i]?.scrollIntoView({ block: 'center', behavior: 'smooth' });

  const play = async (start: number, single = false) => {
    if (!doc.sentences.length) return;
    setPlaying(true);
    const done = await playQueue(
      doc.sentences.map((s) => ({ text: s.speakText, voice: voiceFor(s) })),
      start,
      {
        rate: settings.rate,
        repeat: settings.repeat,
        gapMs: settings.gapSec * 1000,
        single,
        onIndex: (i) => {
          setCur(i);
          scrollTo(i);
          bumpStat('listened');
          db.scans.update(scanId, { lastSentence: i });
        },
        onRepeat: setRep,
      },
    );
    if (done) setPlaying(false);
  };

  const toggle = () => {
    if (playing) {
      stopSpeaking();
      setPlaying(false);
    } else play(cur);
  };

  const jump = (d: number) => {
    const i = Math.max(0, Math.min(doc.sentences.length - 1, cur + d));
    setCur(i);
    scrollTo(i);
    if (playing) play(i);
  };

  const tapSentence = (s: Sentence) => {
    setCur(s.id);
    play(s.id, true);
  };

  const tapWord = (w: string, s: Sentence) => {
    stopSpeaking();
    setPlaying(false);
    setCur(s.id);
    setWord({ w, ctx: s.text, s });
  };

  const saveEdit = async () => {
    const t = cleanOcrText(draft.replace(/\n(?!\n)/g, '\n\n')) || draft.trim();
    await db.scans.update(scanId, { text: t, title: titleFrom(t), lastSentence: 0 });
    setVi({});
    setCur(0);
    setEditing(false);
  };

  if (scan === undefined) return null;
  if (scan === null) {
    return (
      <main className="main empty">
        Không tìm thấy bài đọc. <button className="btn" onClick={onBack}>Quay lại</button>
      </main>
    );
  }

  const curSentence = doc.sentences[cur];

  return (
    <>
      <header className="topbar">
        <button className="icon-btn plain" onClick={onBack} aria-label="Quay lại">
          ‹
        </button>
        <h1>{scan.title}</h1>
        <button
          className="icon-btn plain"
          onClick={() => {
            stopSpeaking();
            setPlaying(false);
            setDraft(scan.text);
            setEditing(true);
          }}
          aria-label="Sửa chữ"
        >
          ✏️
        </button>
      </header>

      <main className="main stack reader-pad">
        {editing ? (
          <>
            <textarea className="input" style={{ minHeight: '55dvh' }} value={draft} onChange={(e) => setDraft(e.target.value)} lang="en" />
            <div className="row">
              <button className="btn grow" onClick={() => setEditing(false)}>Huỷ</button>
              <button className="btn primary grow" onClick={saveEdit}>Lưu</button>
            </div>
          </>
        ) : (
          <>
            <div className="row wrap">
              <div className="seg grow" style={{ minWidth: 200 }}>
                <button className={settings.tapMode === 'sentence' ? 'on' : ''} onClick={() => setSettings({ tapMode: 'sentence' })}>
                  👆 Chạm nghe câu
                </button>
                <button className={settings.tapMode === 'word' ? 'on' : ''} onClick={() => setSettings({ tapMode: 'word' })}>
                  📖 Tra từ
                </button>
              </div>
              <button className={`chip ${settings.showVi ? 'on' : ''}`} onClick={() => setSettings({ showVi: !settings.showVi })}>
                🇻🇳 Dịch
              </button>
            </div>

            <article className={`reader card no-select ${settings.tapMode === 'word' ? 'word-mode' : ''}`} lang="en">
              {doc.paragraphs.map((p) => (
                <p key={p.index}>
                  {p.speaker && settings.accent === 'mix' && (
                    <span className="speaker">
                      {p.speaker} · {voiceFor(p.sentences[0])?.name.replace(/\s*\(.*\)/, '') ?? ''}
                    </span>
                  )}
                  {p.sentences.map((s) => (
                    <span key={s.id}>
                      <span
                        ref={(el) => (sentRefs.current[s.id] = el)}
                        className={`sent ${s.id === cur ? 'cur' : ''}`}
                        onClick={settings.tapMode === 'sentence' ? () => tapSentence(s) : undefined}
                      >
                        {settings.tapMode === 'word'
                          ? tokenize(s.text).map((t, i) =>
                              t.word ? (
                                <span key={i} className="w" onClick={() => tapWord(t.text, s)}>
                                  {t.text}
                                </span>
                              ) : (
                                <span key={i}>{t.text}</span>
                              ),
                            )
                          : s.text}
                      </span>{' '}
                      {settings.showVi && <span className="vi">{vi[s.id] ?? '…'}</span>}
                    </span>
                  ))}
                </p>
              ))}
            </article>

            {curSentence && (
              <div className="card stack">
                <div className="small muted">Câu đang chọn ({cur + 1}/{doc.sentences.length})</div>
                <div className="row wrap">
                  <button className="btn grow" onClick={() => nav.practice([curSentence.speakText], 'shadow')}>🔁 Nhại theo</button>
                  <button className="btn grow" onClick={() => nav.practice([curSentence.speakText], 'speak')}>🎤 Luyện nói</button>
                  <button className="btn grow" onClick={() => nav.practice([curSentence.speakText], 'dictation')}>✍️ Chính tả</button>
                </div>
                <button className="btn ghost small" onClick={() => nav.practice(doc.sentences.map((s) => s.speakText), 'speak')}>
                  Luyện cả bài ({doc.sentences.length} câu) →
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {!editing && (
        <div className="player">
          <div className="card">
            {showOpts && (
              <div className="stack" style={{ gap: 10 }}>
                <AccentPicker />
                <div className="row small">
                  <span style={{ width: 92 }}>Lặp mỗi câu</span>
                  <div className="chips">
                    {[1, 2, 3, 5].map((n) => (
                      <button key={n} className={`chip ${settings.repeat === n ? 'on' : ''}`} onClick={() => setSettings({ repeat: n })}>
                        {n}×
                      </button>
                    ))}
                  </div>
                </div>
                {settings.repeat > 1 && (
                  <div className="row small">
                    <span style={{ width: 92 }}>Nghỉ {settings.gapSec}s</span>
                    <input type="range" min={0.5} max={6} step={0.5} value={settings.gapSec} onChange={(e) => setSettings({ gapSec: +e.target.value })} />
                  </div>
                )}
              </div>
            )}
            <div className="row small">
              <span style={{ width: 92 }}>Tốc độ {settings.rate.toFixed(2).replace(/0$/, '')}×</span>
              <input type="range" min={0.5} max={1.5} step={0.05} value={settings.rate} onChange={(e) => setSettings({ rate: +e.target.value })} />
            </div>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <button className="icon-btn plain" onClick={() => setShowOpts(!showOpts)} aria-label="Tuỳ chọn">
                {showOpts ? '▾' : '⚙️'}
              </button>
              <button className="icon-btn" onClick={() => jump(-1)} aria-label="Câu trước">⏮</button>
              <button className="icon-btn lg" onClick={toggle} aria-label={playing ? 'Dừng' : 'Phát'}>
                {playing ? '⏸' : '▶'}
              </button>
              <button className="icon-btn" onClick={() => jump(1)} aria-label="Câu sau">⏭</button>
              <span className="tiny muted" style={{ width: 44, textAlign: 'center' }}>
                {settings.repeat > 1 && playing ? `${rep + 1}/${settings.repeat}` : `${cur + 1}/${doc.sentences.length}`}
              </span>
            </div>
          </div>
        </div>
      )}

      {word && (
        <WordPopup
          word={word.w}
          context={word.ctx}
          voice={voiceFor(word.s)}
          onClose={() => setWord(null)}
          onSaved={() => nav.toast('Đã lưu “' + word.w + '” vào sổ từ ⭐')}
        />
      )}
    </>
  );
}
