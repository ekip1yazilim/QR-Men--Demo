/**
 * Görsel işleme (sharp):
 * - Biçim/boyut doğrulaması, EXIF yönüne göre döndürme
 * - EXIF/GPS gibi meta verilerin silinmesi (gizlilik)
 * - Ekran boyutlarına göre WebP varyantları + bulanık önizleme (LQIP)
 */
import sharp from "sharp";
import { randomBytes } from "node:crypto";
import type { ImageKind } from "../../shared/types";
import type { NewImage } from "../repo/images";

export class ImageError extends Error {}

const SETTINGS: Record<ImageKind, { widths: number[]; minWidth: number; quality: number }> = {
  product: { widths: [400, 800, 1200], minWidth: 300, quality: 78 },
  cover: { widths: [800, 1400, 2000], minWidth: 600, quality: 76 },
  logo: { widths: [128, 256, 512], minWidth: 64, quality: 90 },
};

const ACCEPTED = new Set(["jpeg", "png", "webp", "avif", "gif", "heif", "tiff"]);

sharp.cache({ memory: 64, files: 0, items: 50 });

export async function processImage(input: Buffer, kind: ImageKind, originalName = ""): Promise<NewImage> {
  if (!input.length) throw new ImageError("Dosya boş görünüyor.");
  const opts = SETTINGS[kind];

  let meta: Awaited<ReturnType<ReturnType<typeof sharp>["metadata"]>>;
  try {
    meta = await sharp(input, { limitInputPixels: 80_000_000 }).metadata();
  } catch {
    throw new ImageError("Dosya bir görsel olarak okunamadı. JPG, PNG, WebP veya AVIF yükleyin.");
  }
  if (!meta.format || !ACCEPTED.has(meta.format)) {
    throw new ImageError("Bu dosya biçimi desteklenmiyor. JPG, PNG, WebP veya AVIF yükleyin.");
  }
  if (!meta.width || !meta.height) throw new ImageError("Görselin boyutları okunamadı.");

  const rotated = (meta.orientation ?? 1) >= 5;
  const width = rotated ? meta.height : meta.width;
  const height = rotated ? meta.width : meta.height;
  if (width < opts.minWidth) {
    throw new ImageError(`Görsel çok küçük (${width} px). En az ${opts.minWidth} piksel genişliğinde bir görsel yükleyin.`);
  }

  const base = () => sharp(input, { limitInputPixels: 80_000_000, animated: false }).rotate();

  const targets = [...new Set(opts.widths.map((w) => Math.min(w, width)))];
  const variants: NewImage["variants"] = [];
  try {
    for (const target of targets) {
      const { data, info } = await base()
        .resize({ width: target, withoutEnlargement: true })
        .webp({ quality: opts.quality, effort: 4, smartSubsample: true, alphaQuality: 100 })
        .toBuffer({ resolveWithObject: true });
      variants.push({ width: info.width, height: info.height, data });
    }
  } catch (err) {
    if (meta.format === "heif") {
      throw new ImageError("HEIC biçimindeki fotoğraflar desteklenmiyor. Lütfen JPG olarak dışa aktarıp tekrar yükleyin.");
    }
    throw new ImageError("Görsel işlenemedi. Dosya bozuk olabilir; farklı bir görsel deneyin.");
  }

  const tiny = await base()
    .resize({ width: 24 })
    .blur(1.2)
    .webp({ quality: 40 })
    .toBuffer();
  const placeholder = `data:image/webp;base64,${tiny.toString("base64")}`;

  return {
    id: randomBytes(12).toString("hex"),
    kind,
    width: variants[variants.length - 1].width,
    height: variants[variants.length - 1].height,
    placeholder: placeholder.length < 2500 ? placeholder : null,
    originalName,
    variants,
    credit: null,
  };
}
