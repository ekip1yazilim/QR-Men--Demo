/** Testler için QR çözücü: PNG → metin (jsQR, Apache-2.0 — tests/vendor altında) */
import { createRequire } from "node:module";
import sharp from "sharp";

const require = createRequire(import.meta.url);
const jsQR = require("./vendor/jsQR.cjs") as (
  data: Uint8ClampedArray,
  width: number,
  height: number,
) => { data: string } | null;

export async function decodeQrPng(png: Buffer | Uint8Array): Promise<string | null> {
  const { data, info } = await sharp(Buffer.from(png)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return jsQR(new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength), info.width, info.height)?.data ?? null;
}
