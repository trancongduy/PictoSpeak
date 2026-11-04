import { useCallback, useEffect, useState } from 'react';
import Home from './pages/Home';
import Reader from './pages/Reader';
import History from './pages/History';
import Vocab from './pages/Vocab';
import Practice, { type PracticeMode } from './pages/Practice';
import SettingsPage from './pages/Settings';
import { stopSpeaking } from './lib/tts';
import { Toast } from './components/Toast';

export type Tab = 'home' | 'history' | 'vocab' | 'practice' | 'settings';

export interface Nav {
  go: (tab: Tab) => void;
  openReader: (scanId: number) => void;
  practice: (sentences: string[], mode: PracticeMode) => void;
  toast: (msg: string) => void;
}

const TABS: { id: Tab; ico: string; label: string }[] = [
  { id: 'home', ico: '📷', label: 'Quét' },
  { id: 'history', ico: '📚', label: 'Bài đọc' },
  { id: 'vocab', ico: '🗂️', label: 'Từ vựng' },
  { id: 'practice', ico: '🎯', label: 'Luyện tập' },
  { id: 'settings', ico: '🔊', label: 'Giọng đọc' },
];

export default function App() {
  const [tab, setTab] = useState<Tab>('home');
  const [readerId, setReaderId] = useState<number | null>(null);
  const [practiceInit, setPracticeInit] = useState<{ sentences: string[]; mode: PracticeMode; key: number } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const go = useCallback((t: Tab) => {
    stopSpeaking();
    setReaderId(null);
    setTab(t);
    window.scrollTo(0, 0);
  }, []);

  const nav: Nav = {
    go,
    openReader: (id) => {
      stopSpeaking();
      setReaderId(id);
      window.scrollTo(0, 0);
    },
    practice: (sentences, mode) => {
      stopSpeaking();
      setPracticeInit({ sentences, mode, key: Date.now() });
      setReaderId(null);
      setTab('practice');
      window.scrollTo(0, 0);
    },
    toast: (msg) => setToast(msg),
  };

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <div className="app">
      {readerId !== null ? (
        <Reader scanId={readerId} nav={nav} onBack={() => go(tab === 'home' ? 'history' : tab)} />
      ) : tab === 'home' ? (
        <Home nav={nav} />
      ) : tab === 'history' ? (
        <History nav={nav} />
      ) : tab === 'vocab' ? (
        <Vocab nav={nav} />
      ) : tab === 'practice' ? (
        <Practice key={practiceInit?.key ?? 0} nav={nav} init={practiceInit} />
      ) : (
        <SettingsPage nav={nav} />
      )}
      <nav className="tabbar">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id && readerId === null ? 'on' : ''} onClick={() => go(t.id)}>
            <span className="ico">{t.ico}</span>
            {t.label}
          </button>
        ))}
      </nav>
      {toast && <Toast msg={toast} />}
    </div>
  );
}
