/**
 * QR kod üretimi (Project Nayuki, MIT lisansı — src/server/vendor/qrcodegen.ts).
 * - SVG: baskı için vektörel, sınırsız ölçeklenir
 * - PNG: piksel hizalı (bulanıklık olmadan) üretilir
 * Hata düzeltme seviyesi otomatik yükseltilir (masada yıpranmaya karşı dayanıklılık).
 */
import sharp from "sharp";
import { qrcodegen } from "../vendor/qrcodegen";

export interface QrOptions {
  dark?: string;
  light?: string;
  /** Sessiz bölge (modül cinsinden). Standart en az 4'tür. */
  margin?: number;
}

export function qrMatrix(text: string): boolean[][] {
  const qr = qrcodegen.QrCode.encodeText(text, qrcodegen.QrCode.Ecc.MEDIUM);
  const rows: boolean[][] = [];
  for (let y = 0; y < qr.size; y++) {
    const row: boolean[] = [];
    for (let x = 0; x < qr.size; x++) row.push(qr.getModule(x, y));
    rows.push(row);
  }
  return rows;
}

export function qrSvg(text: string, opts: QrOptions = {}): string {
  const { dark = "#1e1f23", light = "#ffffff", margin = 4 } = opts;
  const m = qrMatrix(text);
  const size = m.length + margin * 2;
  let path = "";
  m.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      if (!row[x]) {
        x++;
        continue;
      }
      let run = 1;
      while (x + run < row.length && row[x + run]) run++;
      path += `M${x + margin},${y + margin}h${run}v1h-${run}z`;
      x += run;
    }
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges" role="img" aria-label="QR kod: ${escapeXml(text)}"><rect width="${size}" height="${size}" fill="${light}"/><path d="${path}" fill="${dark}"/></svg>`;
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export async function qrPng(text: string, sizePx: number, opts: QrOptions = {}): Promise<Buffer> {
  const { dark = "#1e1f23", light = "#ffffff", margin = 4 } = opts;
  const m = qrMatrix(text);
  const modules = m.length + margin * 2;
  const scale = Math.max(1, Math.floor(sizePx / modules));
  const inner = modules * scale;
  const pad = Math.max(0, Math.floor((sizePx - inner) / 2));
  const size = Math.max(inner, sizePx);
  const [dr, dg, db] = hexToRgb(dark);
  const [lr, lg, lb] = hexToRgb(light);
  const buf = Buffer.alloc(size * size * 3);
  for (let i = 0; i < size * size; i++) {
    buf[i * 3] = lr;
    buf[i * 3 + 1] = lg;
    buf[i * 3 + 2] = lb;
  }
  for (let y = 0; y < m.length; y++) {
    for (let x = 0; x < m.length; x++) {
      if (!m[y][x]) continue;
      const px0 = pad + (x + margin) * scale;
      const py0 = pad + (y + margin) * scale;
      for (let py = py0; py < py0 + scale; py++) {
        for (let px = px0; px < px0 + scale; px++) {
          const o = (py * size + px) * 3;
          buf[o] = dr;
          buf[o + 1] = dg;
          buf[o + 2] = db;
        }
      }
    }
  }
  return sharp(buf, { raw: { width: size, height: size, channels: 3 } })
    .png({ compressionLevel: 9, palette: true, colors: 2 })
    .withMetadata({ density: 300 })
    .toBuffer();
}

function escapeXml(s: string) {
  return s.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]!);
}
