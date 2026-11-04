// On-device OCR with tesseract.js (English). The language model (~10MB) downloads once and is cached.
import { createWorker, type Worker } from 'tesseract.js';

let workerP: Promise<Worker> | null = null;
let onProgress: ((p: number, status: string) => void) | null = null;

const STATUS_VI: Record<string, string> = {
  'loading tesseract core': 'Đang tải bộ nhận dạng…',
  'initializing tesseract': 'Đang khởi động…',
  'loading language traineddata': 'Đang tải dữ liệu tiếng Anh (chỉ lần đầu)…',
  'initializing api': 'Đang chuẩn bị…',
  'recognizing text': 'Đang nhận dạng chữ…',
};

function getWorker() {
  if (!workerP) {
    workerP = createWorker('eng', 1, {
      logger: (m: { status: string; progress: number }) =>
        onProgress?.(m.progress ?? 0, STATUS_VI[m.status] ?? m.status),
    }).catch((e) => {
      workerP = null;
      throw e;
    });
  }
  return workerP;
}

/** Warm up the OCR engine in the background (e.g. when the scan screen opens). */
export function preloadOcr() {
  getWorker().catch(() => undefined);
}

export async function recognize(canvas: HTMLCanvasElement, progress: (p: number, status: string) => void) {
  onProgress = progress;
  const w = await getWorker();
  const { data } = await w.recognize(canvas);
  onProgress = null;
  return data.text;
}

export async function fileToCanvas(file: Blob): Promise<HTMLCanvasElement> {
  let source: CanvasImageSource;
  let w: number;
  let h: number;
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
    source = bmp;
    w = bmp.width;
    h = bmp.height;
  } catch {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.src = url;
    await img.decode();
    URL.revokeObjectURL(url);
    source = img;
    w = img.naturalWidth;
    h = img.naturalHeight;
  }
  // Cap size to keep memory low on phones
  const scale = Math.min(1, 3000 / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.round(w * scale);
  c.height = Math.round(h * scale);
  c.getContext('2d')!.drawImage(source, 0, 0, c.width, c.height);
  return c;
}

export function rotateCanvas(src: HTMLCanvasElement): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = src.height;
  c.height = src.width;
  const ctx = c.getContext('2d')!;
  ctx.translate(c.width, 0);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(src, 0, 0);
  return c;
}

export function cropCanvas(src: HTMLCanvasElement, r: { x: number; y: number; w: number; h: number }) {
  const sx = Math.round(r.x * src.width);
  const sy = Math.round(r.y * src.height);
  const sw = Math.max(1, Math.round(r.w * src.width));
  const sh = Math.max(1, Math.round(r.h * src.height));
  const c = document.createElement('canvas');
  c.width = sw;
  c.height = sh;
  c.getContext('2d')!.drawImage(src, sx, sy, sw, sh, 0, 0, sw, sh);
  return c;
}

/** Grayscale + contrast stretch + resize to a size tesseract likes. */
export function preprocess(src: HTMLCanvasElement): HTMLCanvasElement {
  const target = Math.min(2400, Math.max(1200, src.width));
  const scale = target / src.width;
  const c = document.createElement('canvas');
  c.width = Math.round(src.width * scale);
  c.height = Math.round(src.height * scale);
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, c.width, c.height);
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  const hist = new Uint32Array(256);
  for (let i = 0; i < d.length; i += 4) {
    const g = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000;
    d[i] = g;
    hist[g | 0]++;
  }
  // stretch between 2nd and 98th percentile
  const total = d.length / 4;
  let lo = 0;
  let hi = 255;
  for (let acc = 0; lo < 255 && (acc += hist[lo]) < total * 0.02; lo++);
  for (let acc = 0; hi > 0 && (acc += hist[hi]) < total * 0.02; hi--);
  const range = Math.max(1, hi - lo);
  for (let i = 0; i < d.length; i += 4) {
    const v = Math.max(0, Math.min(255, ((d[i] - lo) * 255) / range));
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

export function thumbnail(src: HTMLCanvasElement, width = 240): string {
  const scale = Math.min(1, width / src.width);
  const c = document.createElement('canvas');
  c.width = Math.round(src.width * scale);
  c.height = Math.round(src.height * scale);
  c.getContext('2d')!.drawImage(src, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.6);
}
