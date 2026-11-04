// Generates PNG app icons without external deps (gradient + speech bubble + sound bars).
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};

function shade(u, v) {
  // u,v in [0,1]; full-bleed background (iOS rounds corners itself)
  const t = (u + v) / 2;
  let r = 37 + (124 - 37) * t, g = 99 + (58 - 99) * t, b = 235 + (237 - 235) * t;
  const inRR = (x, y, x0, y0, x1, y1, rad) => {
    const cx = Math.min(Math.max(x, x0 + rad), x1 - rad), cy = Math.min(Math.max(y, y0 + rad), y1 - rad);
    return (x - cx) ** 2 + (y - cy) ** 2 <= rad * rad;
  };
  // bubble body
  let white = inRR(u, v, 0.18, 0.24, 0.82, 0.66, 0.08);
  // tail triangle
  if (!white && v >= 0.64 && v <= 0.8) {
    const k = (v - 0.64) / 0.16; // 0..1
    if (u >= 0.3 && u <= 0.44 - 0.14 * k) white = true;
  }
  if (white) {
    r = g = b = 255;
    const bars = [[0.33, 0.39, 0.37, 0.51], [0.47, 0.32, 0.53, 0.58], [0.61, 0.39, 0.67, 0.51]];
    for (const [x0, y0, x1, y1] of bars) if (inRR(u, v, x0, y0, x1, y1, 0.03)) { r = 37; g = 99; b = 235; }
  }
  return [r, g, b];
}

function png(size) {
  const ss = 3;
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      let R = 0, G = 0, B = 0;
      for (let sy = 0; sy < ss; sy++) for (let sx = 0; sx < ss; sx++) {
        const [r, g, b] = shade((x + (sx + 0.5) / ss) / size, (y + (sy + 0.5) / ss) / size);
        R += r; G += g; B += b;
      }
      const o = y * (size * 3 + 1) + 1 + x * 3, n = ss * ss;
      raw[o] = Math.round(R / n); raw[o + 1] = Math.round(G / n); raw[o + 2] = Math.round(B / n);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync('public/icons', { recursive: true });
for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) {
  writeFileSync(`public/icons/${name}`, png(size));
  console.log('wrote', name);
}
