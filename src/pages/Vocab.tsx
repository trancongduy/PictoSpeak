import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Nav } from '../App';
import { bumpStat, db, type Word } from '../lib/db';
import { useSettings } from '../lib/settings';
import { nextLabel, review, type Grade } from '../lib/srs';
import { resolveVoice, speakOnce, stopSpeaking, useVoices } from '../lib/tts';

function useVoice() {
  const settings = useSettings();
  const voices = useVoices();
  return useMemo(() => resolveVoice(voices, settings.accent === 'mix' ? 'en-GB' : settings.accent, settings), [voices, settings]);
}

const say = (t: string, v?: SpeechSynthesisVoice, rate = 0.85) => {
  stopSpeaking();
  speakOnce(t, v, rate);
};

export default function Vocab({ nav }: { nav: Nav }) {
  const words = useLiveQuery(() => db.words.orderBy('createdAt').reverse().toArray(), []);
  const [reviewing, setReviewing] = useState(false);
  const [q, setQ] = useState('');
  const voice = useVoice();
  const due = words?.filter((w) => w.due <= Date.now()) ?? [];

  if (reviewing) return <Flashcards onExit={() => setReviewing(false)} voice={voice} nav={nav} />;

  const shown = words?.filter((w) => !q || w.word.includes(q.toLowerCase()) || w.meaningVi?.toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <header className="topbar">
        <h1>Sổ từ vựng</h1>
        <span className="muted small">{words?.length ?? 0} từ</span>
      </header>
      <main className="main stack">
        <button className="btn primary big block" disabled={!due.length} onClick={() => setReviewing(true)}>
          🧠 Ôn tập flashcard {due.length ? `(${due.length})` : '– hết từ cần ôn 🎉'}
        </button>

        {words && !words.length && (
          <div className="empty">
            <div className="ico">🗂️</div>
            <p>
              Chưa có từ nào. Khi đọc bài, chọn chế độ <b>📖 Tra từ</b>, chạm vào từ mới rồi bấm <b>⭐ Lưu</b>.
            </p>
          </div>
        )}

        {!!words?.length && <input className="input" placeholder="🔍 Tìm từ…" value={q} onChange={(e) => setQ(e.target.value)} />}

        <div className="list">
          {shown?.map((w) => (
            <div key={w.id} className="card row">
              <button className="icon-btn" onClick={() => say(w.word, voice)} aria-label="Nghe">🔊</button>
              <div className="grow">
                <div>
                  <b>{w.word}</b> {w.ipa && <span className="ipa small">{w.ipa}</span>}
                </div>
                <div className="small">{w.meaningVi}</div>
                <div className="tiny muted">
                  {w.due <= Date.now() ? 'Cần ôn' : `Ôn lại: ${new Date(w.due).toLocaleDateString('vi-VN')}`}
                </div>
              </div>
              <button
                className="icon-btn plain"
                aria-label="Xoá"
                onClick={() => confirm(`Xoá từ “${w.word}”?`) && db.words.delete(w.id!)}
              >
                🗑️
              </button>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}

function Flashcards({ onExit, voice, nav }: { onExit: () => void; voice?: SpeechSynthesisVoice; nav: Nav }) {
  // snapshot of due cards for this session; "Quên" puts the card back at the end
  const [queue, setQueue] = useState<Word[] | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState(0);

  useEffect(() => {
    db.words
      .where('due')
      .belowOrEqual(Date.now())
      .toArray()
      .then((list) => setQueue(list.sort(() => Math.random() - 0.5)));
  }, []);

  const card = queue?.[0];

  const grade = async (g: Grade) => {
    if (!card) return;
    const upd = review(card, g);
    await db.words.update(card.id!, upd);
    bumpStat('reviewed');
    setDone((d) => d + 1);
    setFlipped(false);
    setQueue((q) => {
      const rest = q!.slice(1);
      return g === 0 ? [...rest, { ...card, ...upd }] : rest;
    });
  };

  const blanked = (ex: string, w: string) => ex.replace(new RegExp(`\\b${w.replace(/[^a-z']/gi, '')}\\w*`, 'gi'), '_____');

  return (
    <>
      <header className="topbar">
        <button className="icon-btn plain" onClick={onExit} aria-label="Thoát">✕</button>
        <h1>Ôn tập</h1>
        <span className="muted small">{queue ? `${done} / ${done + queue.length}` : ''}</span>
      </header>
      <main className="main stack">
        {queue && !card && (
          <div className="empty">
            <div className="ico">🎉</div>
            <p>Xong! Em đã ôn {done} thẻ hôm nay.</p>
            <button className="btn primary" onClick={() => { onExit(); nav.go('home'); }}>Về trang chủ</button>
          </div>
        )}
        {card && (
          <>
            <div className="progress">
              <div style={{ width: `${(done / (done + queue!.length)) * 100}%` }} />
            </div>
            <div className="card flash" onClick={() => setFlipped(true)}>
              <div className="word">{card.word}</div>
              <button className="icon-btn" onClick={(e) => { e.stopPropagation(); say(card.word, voice); }}>🔊</button>
              {card.example && !flipped && <div className="small muted">“{blanked(card.example, card.word)}”</div>}
              {flipped ? (
                <>
                  {card.ipa && <div className="ipa">{card.ipa}</div>}
                  <div style={{ fontSize: 22, fontWeight: 700 }}>{card.meaningVi}</div>
                  {card.definition && <div className="small muted">{card.definition}</div>}
                  {card.example && (
                    <button className="btn ghost small" onClick={(e) => { e.stopPropagation(); say(card.example!, voice); }}>
                      🔊 “{card.example}”
                    </button>
                  )}
                </>
              ) : (
                <div className="muted small">Nhớ nghĩa không? Chạm để lật thẻ</div>
              )}
            </div>
            {flipped ? (
              <div className="grades">
                <button className="btn danger" onClick={() => grade(0)}>Quên<small>{nextLabel(card, 0)}</small></button>
                <button className="btn" onClick={() => grade(1)}>Khó<small>{nextLabel(card, 1)}</small></button>
                <button className="btn" style={{ background: 'var(--good-soft)', color: 'var(--good)' }} onClick={() => grade(2)}>Nhớ<small>{nextLabel(card, 2)}</small></button>
                <button className="btn primary" onClick={() => grade(3)}>Dễ<small>{nextLabel(card, 3)}</small></button>
              </div>
            ) : (
              <button className="btn primary big block" onClick={() => setFlipped(true)}>Lật thẻ</button>
            )}
          </>
        )}
      </main>
    </>
  );
}
