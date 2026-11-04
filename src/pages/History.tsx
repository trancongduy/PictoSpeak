import { useLiveQuery } from 'dexie-react-hooks';
import type { Nav } from '../App';
import { db } from '../lib/db';

export default function History({ nav }: { nav: Nav }) {
  const scans = useLiveQuery(() => db.scans.orderBy('createdAt').reverse().toArray(), []);

  const remove = async (id: number, title: string) => {
    if (confirm(`Xoá bài “${title}”?`)) await db.scans.delete(id);
  };

  return (
    <>
      <header className="topbar">
        <h1>Bài đọc đã lưu</h1>
      </header>
      <main className="main">
        {scans && !scans.length && (
          <div className="empty">
            <div className="ico">📚</div>
            <p>Chưa có bài nào. Chụp một trang sách để bắt đầu nhé!</p>
            <button className="btn primary" onClick={() => nav.go('home')}>📸 Chụp ảnh</button>
          </div>
        )}
        <div className="list">
          {scans?.map((s) => (
            <div key={s.id} className="card item">
              <button className="item grow" style={{ background: 'none', border: 0, padding: 0, textAlign: 'left' }} onClick={() => nav.openReader(s.id!)}>
                {s.thumb ? <img src={s.thumb} alt="" /> : <img alt="" />}
                <div className="grow">
                  <div className="t">{s.title}</div>
                  <div className="tiny muted">
                    {new Date(s.createdAt).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })} ·{' '}
                    {s.text.split(/\s+/).length} từ
                  </div>
                </div>
              </button>
              <button className="icon-btn plain" onClick={() => remove(s.id!, s.title)} aria-label="Xoá">
                🗑️
              </button>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
