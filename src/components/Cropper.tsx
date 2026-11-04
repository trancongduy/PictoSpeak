import { useEffect, useRef, useState } from 'react';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
type Handle = 'move' | 'nw' | 'ne' | 'sw' | 'se';

const MIN = 0.08;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Shows the image with a draggable crop rectangle. Rect values are fractions (0..1). */
export default function Cropper({ source, rect, onChange }: { source: HTMLCanvasElement; rect: Rect; onChange: (r: Rect) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ h: Handle; px: number; py: number; r: Rect } | null>(null);
  const [, force] = useState(0);

  useEffect(() => {
    const c = canvasRef.current!;
    const scale = Math.min(1, 1200 / Math.max(source.width, source.height));
    c.width = Math.round(source.width * scale);
    c.height = Math.round(source.height * scale);
    c.getContext('2d')!.drawImage(source, 0, 0, c.width, c.height);
    force((n) => n + 1);
  }, [source]);

  const start = (h: Handle) => (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    drag.current = { h, px: e.clientX, py: e.clientY, r: { ...rect } };
  };

  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || !wrapRef.current) return;
    const box = wrapRef.current.getBoundingClientRect();
    const dx = (e.clientX - d.px) / box.width;
    const dy = (e.clientY - d.py) / box.height;
    let { x, y, w, h } = d.r;
    if (d.h === 'move') {
      x = clamp(x + dx, 0, 1 - w);
      y = clamp(y + dy, 0, 1 - h);
    } else {
      if (d.h.includes('w')) {
        const nx = clamp(x + dx, 0, x + w - MIN);
        w += x - nx;
        x = nx;
      }
      if (d.h.includes('e')) w = clamp(w + dx, MIN, 1 - x);
      if (d.h.includes('n')) {
        const ny = clamp(y + dy, 0, y + h - MIN);
        h += y - ny;
        y = ny;
      }
      if (d.h.includes('s')) h = clamp(h + dy, MIN, 1 - y);
    }
    onChange({ x, y, w, h });
  };

  const end = () => (drag.current = null);

  return (
    <div className="crop-clip">
      <div ref={wrapRef} className="crop-wrap" onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
        <canvas ref={canvasRef} />
        <div
          className="crop-rect"
          style={{ left: `${rect.x * 100}%`, top: `${rect.y * 100}%`, width: `${rect.w * 100}%`, height: `${rect.h * 100}%` }}
          onPointerDown={start('move')}
        >
          {(['nw', 'ne', 'sw', 'se'] as const).map((h) => (
            <div key={h} className={`h ${h}`} onPointerDown={start(h)} />
          ))}
        </div>
      </div>
    </div>
  );
}
