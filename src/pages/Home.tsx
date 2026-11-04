import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Nav } from '../App';
import Cropper, { type Rect } from '../components/Cropper';
import { db, getStreak, today } from '../lib/db';
import { cleanOcrText, titleFrom } from '../lib/text';
import { cropCanvas, fileToCanvas, preloadOcr, preprocess, recognize, rotateCanvas, thumbnail } from '../lib/ocr';

type Step = 'idle' | 'crop' | 'ocr' | 'review';
const FULL: Rect = { x: 0.03, y: 0.03, w: 0.94, h: 0.94 };

export default function Home({ nav }: { nav: Nav }) {
  const [step, setStep] = useState<Step>('idle');
  const [img, setImg] = useState<HTMLCanvasElement | null>(null);
  const [rect, setRect] = useState<Rect>(FULL);
  const [progress, setProgress] = useState({ p: 0, s: '' });
  const [text, setText] = useState('');
  const [thumb, setThumb] = useState<string | undefined>();
  const camRef = useRef<HTMLInputElement>(null);
  const libRef = useRef<HTMLInputElement>(null);

  const stat = useLiveQuery(() => db.stats.get(today()), []);
  const streak = useLiveQuery(() => getStreak(), [stat]);
  const due = useLiveQuery(() => db.words.where('due').belowOrEqual(Date.now()).count(), []);
  const recent = useLiveQuery(() => db.scans.orderBy('createdAt').reverse().limit(3).toArray(), []);

  useEffect(() => {
    // warm up OCR so the first scan is faster
    const t = setTimeout(preloadOcr, 800);
    return () => clearTimeout(t);
  }, []);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      const c = await fileToCanvas(f);
      setImg(c);
      setRect(FULL);
      setStep('crop');
    } catch {
      nav.toast('Không mở được ảnh này');
    }
  };

  const runOcr = async () => {
    if (!img) return;
    setStep('ocr');
    setProgress({ p: 0, s: 'Đang chuẩn bị…' });
    try {
      const cropped = cropCanvas(img, rect);
      setThumb(thumbnail(cropped));
      const raw = await recognize(preprocess(cropped), (p, s) => setProgress({ p, s }));
      const cleaned = cleanOcrText(raw);
      if (!cleaned) {
        nav.toast('Không tìm thấy chữ. Thử chụp rõ và thẳng hơn nhé.');
        setStep('crop');
        return;
      }
      setText(cleaned);
      setStep('review');
    } catch (err) {
      console.error(err);
      nav.toast('Lỗi nhận dạng. Lần đầu cần có mạng để tải dữ liệu.');
      setStep('crop');
    }
  };

  const save = async () => {
    const t = text.trim();
    if (!t) return;
    const id = await db.scans.add({ createdAt: Date.now(), title: titleFrom(t), text: t, thumb, lastSentence: 0 });
    setStep('idle');
    setImg(null);
    setText('');
    setThumb(undefined);
    nav.openReader(id);
  };

  const reset = () => {
    setStep('idle');
    setImg(null);
    setText('');
    setThumb(undefined);
  };

  return (
    <>
      <header className="topbar">
        {step !== 'idle' && (
          <button className="icon-btn plain" onClick={reset} aria-label="Huỷ">
            ✕
          </button>
        )}
        <h1>{step === 'idle' ? 'PictoSpeak' : step === 'crop' ? 'Chọn vùng cần đọc' : step === 'ocr' ? 'Đang đọc ảnh…' : 'Kiểm tra lại chữ'}</h1>
      </header>
      <main className="main stack">
        <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={onFile} />
        <input ref={libRef} type="file" accept="image/*" hidden onChange={onFile} />

        {step === 'idle' && (
          <>
            <div className="card stats">
              <div className="stat">
                <b>🔥 {streak ?? 0}</b>
                <span>ngày liên tiếp</span>
              </div>
              <div className="stat">
                <b>{(stat?.listened ?? 0) + (stat?.practiced ?? 0)}</b>
                <span>câu hôm nay</span>
              </div>
              <div className="stat">
                <b>{stat?.reviewed ?? 0}</b>
                <span>từ đã ôn</span>
              </div>
            </div>

            <div className="hero">
              <button className="btn primary" onClick={() => camRef.current?.click()}>
                <span className="ico">📸</span>Chụp ảnh
              </button>
              <button className="btn" onClick={() => libRef.current?.click()}>
                <span className="ico">🖼️</span>Chọn ảnh có sẵn
              </button>
              <button
                className="btn wide"
                onClick={() => {
                  setThumb(undefined);
                  setText('');
                  setStep('review');
                }}
              >
                ⌨️ Dán / gõ văn bản
              </button>
            </div>

            {!!due && (
              <button className="card row" style={{ textAlign: 'left' }} onClick={() => nav.go('vocab')}>
                <span style={{ fontSize: 28 }}>🗂️</span>
                <span className="grow">
                  <b>{due} từ cần ôn hôm nay</b>
                  <br />
                  <span className="small muted">Ôn ngay để nhớ lâu hơn</span>
                </span>
                <span>›</span>
              </button>
            )}

            {!!recent?.length && (
              <div className="stack">
                <h2>Đọc tiếp</h2>
                {recent.map((s) => (
                  <button key={s.id} className="card item" style={{ textAlign: 'left' }} onClick={() => nav.openReader(s.id!)}>
                    {s.thumb ? <img src={s.thumb} alt="" /> : <img alt="" />}
                    <div className="grow">
                      <div className="t">{s.title}</div>
                      <div className="tiny muted">{new Date(s.createdAt).toLocaleDateString('vi-VN')}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            <div className="card small muted">
              💡 Mẹo: chụp thẳng, đủ sáng, chữ rõ nét. Sau khi chụp có thể kéo khung để chỉ đọc phần cần học.
            </div>
          </>
        )}

        {step === 'crop' && img && (
          <>
            <Cropper source={img} rect={rect} onChange={setRect} />
            <div className="row">
              <button className="btn" onClick={() => { setImg(rotateCanvas(img)); setRect(FULL); }}>
                ⟳ Xoay
              </button>
              <button className="btn" onClick={() => setRect({ x: 0, y: 0, w: 1, h: 1 })}>
                ⤢ Cả ảnh
              </button>
              <button className="btn primary grow" onClick={runOcr}>
                🔎 Nhận dạng chữ
              </button>
            </div>
          </>
        )}

        {step === 'ocr' && (
          <div className="card stack center">
            <div style={{ fontSize: 48 }} className="pulse">🔎</div>
            <div>{progress.s}</div>
            <div className="progress">
              <div style={{ width: `${Math.round(progress.p * 100)}%` }} />
            </div>
          </div>
        )}

        {step === 'review' && (
          <>
            <p className="small muted" style={{ margin: 0 }}>
              {thumb ? 'Sửa lại nếu máy nhận sai chữ. Để trống một dòng giữa các đoạn.' : 'Dán hoặc gõ đoạn tiếng Anh cần nghe.'}
            </p>
            <textarea
              className="input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste English text here…"
              autoFocus={!thumb}
              spellCheck
              lang="en"
            />
            <button className="btn primary big block" disabled={!text.trim()} onClick={save}>
              ▶ Lưu & nghe đọc
            </button>
          </>
        )}
      </main>
    </>
  );
}
