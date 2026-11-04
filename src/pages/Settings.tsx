import type { Nav } from '../App';
import AccentPicker from '../components/AccentPicker';
import { setSettings, useSettings } from '../lib/settings';
import { ACCENTS, qualityLabel, speakOnce, stopSpeaking, useVoices, voicesForAccent } from '../lib/tts';

const SAMPLE = 'Good morning, and welcome to the listening test. You will hear a conversation between two students.';

export default function SettingsPage({ nav }: { nav: Nav }) {
  const s = useSettings();
  const voices = useVoices();
  const hasPremium = voices.some((v) => qualityLabel(v));

  const test = (v: SpeechSynthesisVoice) => {
    stopSpeaking();
    speakOnce(SAMPLE, v, s.rate);
  };

  return (
    <>
      <header className="topbar">
        <h1>Giọng đọc</h1>
      </header>
      <main className="main stack">
        <div className="card stack">
          <h2>Giọng mặc định</h2>
          <AccentPicker />
          <div className="small muted">
            Bài nghe IELTS chủ yếu dùng <b>giọng Anh-Anh</b>, xen kẽ <b>Úc, Mỹ, Canada, New Zealand</b>.{' '}
            <b>🎧 IELTS mix</b> sẽ đổi giọng theo từng đoạn — và theo từng người nói nếu văn bản có dạng hội thoại
            (“Anna: …”, “Tom: …”).
          </div>
          <div className="row small">
            <span style={{ width: 100 }}>Tốc độ {s.rate.toFixed(2).replace(/0$/, '')}×</span>
            <input type="range" style={{ flex: 1 }} min={0.5} max={1.5} step={0.05} value={s.rate} onChange={(e) => setSettings({ rate: +e.target.value })} />
          </div>
          <div className="tiny muted">IELTS thật đọc ở khoảng 1.0×. Mới học nên để 0.8–0.9×, quen rồi tăng dần.</div>
        </div>

        {!hasPremium && (
          <div className="card stack" style={{ borderColor: 'var(--accent)' }}>
            <h2>⭐ Tải giọng đọc tự nhiên (miễn phí)</h2>
            <div className="small">iPhone có sẵn giọng chất lượng cao giống người thật nhưng phải tải về:</div>
            <ol className="howto small">
              <li>Mở <b>Cài đặt</b> → <b>Trợ năng</b> → <b>Nội dung được đọc</b> → <b>Giọng nói</b> → <b>Tiếng Anh</b></li>
              <li>Chọn <b>Tiếng Anh (Vương quốc Anh)</b> → tải <b>Serena (Cao cấp)</b> hoặc <b>Daniel (Nâng cao)</b>, <b>Arthur</b>, <b>Martha</b></li>
              <li>Thêm <b>Tiếng Anh (Úc)</b> → <b>Karen (Cao cấp)</b> hoặc <b>Lee</b></li>
              <li>Thêm <b>Tiếng Anh (Mỹ)</b> → <b>Ava (Cao cấp)</b>, <b>Zoe</b> hoặc <b>Evan</b></li>
              <li>Tắt hẳn app PictoSpeak rồi mở lại.</li>
            </ol>
          </div>
        )}

        {ACCENTS.map((a) => {
          const list = voicesForAccent(voices, a.code);
          const chosen = list.find((v) => v.voiceURI === s.voiceByAccent[a.code]) ?? list[0];
          return (
            <div key={a.code} className="card stack" style={{ gap: 8 }}>
              <h3>
                {a.flag} {a.label} <span className="muted small">({list.length} giọng)</span>
              </h3>
              {!list.length && <div className="small muted">Máy chưa có giọng này — xem hướng dẫn tải ở trên.</div>}
              {list.map((v) => (
                <div key={v.voiceURI} className="row">
                  <label className="row grow" style={{ minWidth: 0 }}>
                    <input
                      type="radio"
                      name={a.code}
                      checked={v === chosen}
                      onChange={() => setSettings({ voiceByAccent: { ...s.voiceByAccent, [a.code]: v.voiceURI } })}
                    />
                    <span className="grow" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {v.name} <span className="tiny muted">{v.lang}</span>
                    </span>
                    {qualityLabel(v) && <span className="badge">{qualityLabel(v)}</span>}
                  </label>
                  <button className="icon-btn" onClick={() => test(v)} aria-label={`Nghe thử ${v.name}`}>▶</button>
                </div>
              ))}
            </div>
          );
        })}

        <details className="card">
          <summary>Hướng dẫn cài app lên màn hình chính</summary>
          <ol className="howto small">
            <li>Mở trang này bằng <b>Safari</b></li>
            <li>Bấm nút <b>Chia sẻ</b> (ô vuông có mũi tên lên)</li>
            <li>Chọn <b>Thêm vào MH chính</b> → <b>Thêm</b></li>
          </ol>
          <div className="small muted">Sau lần nhận dạng ảnh đầu tiên (cần mạng), app chụp ảnh và đọc to được cả khi không có mạng. Dịch và từ điển cần mạng.</div>
        </details>

        <button className="btn ghost" onClick={() => { stopSpeaking(); nav.toast('Đã dừng đọc'); }}>
          ■ Dừng mọi âm thanh
        </button>
        <div className="center tiny muted">PictoSpeak · miễn phí, không giới hạn · dữ liệu chỉ lưu trên máy này</div>
      </main>
    </>
  );
}
