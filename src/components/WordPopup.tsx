import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { lookup, type Entry } from '../lib/dictionary';
import { newCard } from '../lib/srs';
import { translate } from '../lib/translate';
import { speakOnce, stopSpeaking } from '../lib/tts';

interface Props {
  word: string;
  context?: string;
  voice?: SpeechSynthesisVoice;
  onClose: () => void;
  onSaved?: () => void;
}

export default function WordPopup({ word, context, voice, onClose, onSaved }: Props) {
  const [entry, setEntry] = useState<Entry | null | undefined>(undefined);
  const [vi, setVi] = useState<string>('');
  const key = word.toLowerCase();
  const saved = useLiveQuery(() => db.words.where('word').equals(key).first(), [key]);

  useEffect(() => {
    let alive = true;
    setEntry(undefined);
    setVi('');
    lookup(word).then((e) => alive && setEntry(e)).catch(() => alive && setEntry(null));
    translate(word).then((t) => alive && setVi(t)).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [word]);

  const say = (rate = 0.8) => {
    stopSpeaking();
    speakOnce(word, voice, rate);
  };

  const playAudio = (url: string) => {
    stopSpeaking();
    new Audio(url).play().catch(() => say());
  };

  const save = async () => {
    if (saved) {
      await db.words.delete(saved.id!);
      return;
    }
    await db.words.add({
      word: key,
      ipa: entry?.ipa,
      meaningVi: vi,
      definition: entry?.meanings[0]?.definition,
      example: context,
      createdAt: Date.now(),
      ...newCard(),
    });
    onSaved?.();
  };

  const audio = entry?.audioUK ?? entry?.audioAny;

  return (
    <>
      <div className="sheet-bg" onClick={onClose} />
      <div className="sheet stack" role="dialog">
        <div className="grab" />
        <div className="row">
          <div className="grow">
            <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.2 }}>{entry?.word ?? word}</div>
            {entry?.ipa && <div className="ipa">{entry.ipa}</div>}
          </div>
          <button className="icon-btn" onClick={() => say(0.8)} aria-label="Nghe">
            🔊
          </button>
          <button className="icon-btn" onClick={() => say(0.5)} aria-label="Nghe chậm" title="Nghe chậm">
            🐢
          </button>
          {audio && (
            <button className="icon-btn" onClick={() => playAudio(audio)} aria-label="Giọng người thật" title="Giọng người thật">
              👤
            </button>
          )}
        </div>

        <div className="card" style={{ background: 'var(--primary-soft)', border: 0 }}>
          <div className="tiny muted">Nghĩa tiếng Việt</div>
          <div style={{ fontSize: 19, fontWeight: 600 }}>{vi || '…'}</div>
        </div>

        {entry === undefined && <div className="muted small">Đang tra từ điển…</div>}
        {entry === null && <div className="muted small">Không có trong từ điển Anh-Anh.</div>}
        {entry?.meanings.map((m, i) => (
          <div key={i}>
            <span className="pos">{m.partOfSpeech}</span>
            <div>{m.definition}</div>
            {m.example && <div className="small muted">“{m.example}”</div>}
          </div>
        ))}

        {context && (
          <div className="small">
            <span className="muted">Trong câu: </span>
            <i>{context}</i>
          </div>
        )}

        <button className={`btn block ${saved ? '' : 'primary'}`} onClick={save}>
          {saved ? '✓ Đã lưu vào sổ từ (bấm để bỏ)' : '⭐ Lưu vào sổ từ vựng'}
        </button>
      </div>
    </>
  );
}
