// Draws the Elfar Notes app icon (a mouse 🐭 on a blue tile) and saves it as PNG.
// Pure Node, no image libraries: shapes are drawn with anti-aliasing (4×4 supersampling).
// Usage: node tools/make-icon.js   → build/icon.png (512) and src/assets/icon.png (256)
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

// Shapes in a 64×64 design space (same drawing as the in-app mouseLogo()).
const C = (cx, cy, r, color) => ({ hit: (x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r, color: hex(color) });
const E = (cx, cy, rx, ry, color) => ({ hit: (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1, color: hex(color) });
const L = (ax, ay, bx, by, w, color) => ({
  hit: (x, y) => {
    const dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(x - (ax + t * dx), y - (ay + t * dy)) <= w / 2;
  }, color: hex(color)
});
const tile = { // rounded square background
  hit: (x, y) => {
    const r = 14, cx = Math.min(Math.max(x, r), 64 - r), cy = Math.min(Math.max(y, r), 64 - r);
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
  }, color: hex('#2f7fd0')
};

// Mouse, slightly scaled down and centered on the tile.
const s = 0.86, o = 32 * (1 - s) + 1.5;
const M = (f) => (...a) => f(...a);
const shapes = [
  tile,
  C(17, 21, 12, '#8f99a5'), C(47, 21, 12, '#8f99a5'),
  C(17, 21, 7, '#f3a6b8'), C(47, 21, 7, '#f3a6b8'),
  E(32, 39, 20, 18, '#d3dae2'),
  E(32, 45, 11, 8, '#eef1f5'),
  C(24.5, 35, 3.2, '#1f1e1c'), C(39.5, 35, 3.2, '#1f1e1c'),
  C(25.7, 33.8, 1.1, '#ffffff'), C(40.7, 33.8, 1.1, '#ffffff'),
  E(32, 42.5, 3.4, 2.7, '#e8798f'),
  L(27, 44, 14, 41, 1.3, '#6b7380'), L(27, 46.5, 14, 47.5, 1.3, '#6b7380'),
  L(37, 44, 50, 41, 1.3, '#6b7380'), L(37, 46.5, 50, 47.5, 1.3, '#6b7380')
].map((sh, i) => (i === 0 ? sh : { ...sh, hit: ((h) => (x, y) => h((x - o) / s, (y - o) / s))(sh.hit) }));

function render(size) {
  const ss = 4, px = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < ss; sy++) for (let sx = 0; sx < ss; sx++) {
        const u = ((x + (sx + 0.5) / ss) / size) * 64, v = ((y + (sy + 0.5) / ss) / size) * 64;
        let col = null;
        for (const sh of shapes) if (sh.hit(u, v)) col = sh.color; // last shape on top
        if (col) { r += col[0]; g += col[1]; b += col[2]; a += 1; }
      }
      const i = (y * size + x) * 4, n = ss * ss;
      if (a) { px[i] = Math.round(r / a); px[i + 1] = Math.round(g / a); px[i + 2] = Math.round(b / a); }
      px[i + 3] = Math.round((a / n) * 255);
    }
  }
  return png(size, px);
}

// Minimal PNG encoder (RGBA, 8-bit).
function png(size, rgba) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) { raw[y * (size * 4 + 1)] = 0; rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4); }
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, body) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(body.length);
    const tb = Buffer.concat([Buffer.from(type), body]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(tb));
    return Buffer.concat([len, tb, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

const root = path.join(__dirname, '..');
fs.mkdirSync(path.join(root, 'build'), { recursive: true });
fs.mkdirSync(path.join(root, 'src', 'assets'), { recursive: true });
fs.writeFileSync(path.join(root, 'build', 'icon.png'), render(512));
fs.writeFileSync(path.join(root, 'src', 'assets', 'icon.png'), render(256));
console.log('icons written');
