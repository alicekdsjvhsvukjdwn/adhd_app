// Dessine l'icône de l'appli web (anneau arc-en-ciel sur fond noir) en PNG.
// Lancer : node scripts/generer-icones.mjs
import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const FOND = [5, 8, 10];

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const bloc = (type, data) => {
  const t = Buffer.from(type);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const sum = Buffer.alloc(4);
  sum.writeUInt32BE(crc(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, sum]);
};

const hsl = (h, s, l) => {
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [f(0), f(8), f(4)].map((x) => x * 255);
};

function png(taille) {
  const c = taille / 2;
  const exterieur = taille * 0.38;
  const interieur = taille * 0.27;
  const brut = Buffer.alloc((taille * 3 + 1) * taille);
  const SS = 3; // sur-échantillonnage pour des bords lisses
  for (let y = 0; y < taille; y++) {
    brut[y * (taille * 3 + 1)] = 0;
    for (let x = 0; x < taille; x++) {
      const acc = [0, 0, 0];
      for (let i = 0; i < SS; i++) {
        for (let j = 0; j < SS; j++) {
          const dx = x + (i + 0.5) / SS - c;
          const dy = y + (j + 0.5) / SS - c;
          const r = Math.hypot(dx, dy);
          let px = FOND;
          if (r >= interieur && r <= exterieur) {
            // Teinte selon l'angle, départ en haut, sens horaire.
            const angle = (Math.atan2(dx, -dy) + 2 * Math.PI) % (2 * Math.PI);
            px = hsl((angle / (2 * Math.PI)) * 330, 0.8, 0.62);
          }
          for (let k = 0; k < 3; k++) acc[k] += px[k];
        }
      }
      for (let k = 0; k < 3; k++) {
        brut[y * (taille * 3 + 1) + 1 + x * 3 + k] = Math.round(acc[k] / (SS * SS));
      }
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(taille, 0);
  ihdr.writeUInt32BE(taille, 4);
  ihdr[8] = 8; // 8 bits
  ihdr[9] = 2; // RVB
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    bloc("IHDR", ihdr),
    bloc("IDAT", deflateSync(brut)),
    bloc("IEND", Buffer.alloc(0)),
  ]);
}

for (const [nom, taille] of [
  ["apple-touch-icon.png", 180],
  ["icon-192.png", 192],
  ["icon-512.png", 512],
]) {
  writeFileSync(new URL(`../public/${nom}`, import.meta.url), png(taille));
}
