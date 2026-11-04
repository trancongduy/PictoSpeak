import { setSettings, useSettings, type AccentChoice } from '../lib/settings';

const OPTIONS: { v: AccentChoice; label: string }[] = [
  { v: 'en-GB', label: '🇬🇧 Anh' },
  { v: 'en-AU', label: '🇦🇺 Úc' },
  { v: 'en-US', label: '🇺🇸 Mỹ' },
  { v: 'en-IE', label: '🇮🇪 Ireland' },
  { v: 'mix', label: '🎧 IELTS mix' },
];

export default function AccentPicker() {
  const s = useSettings();
  return (
    <div className="chips" role="radiogroup" aria-label="Giọng đọc">
      {OPTIONS.map((o) => (
        <button key={o.v} className={`chip ${s.accent === o.v ? 'on' : ''}`} onClick={() => setSettings({ accent: o.v })}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
