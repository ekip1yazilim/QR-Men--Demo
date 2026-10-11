import type { CSSProperties } from "react";
import type { ImageRef } from "../../shared/types";

export function imageUrl(image: ImageRef, width: number): string {
  const best = image.widths.find((w) => w >= width) ?? image.widths[image.widths.length - 1] ?? width;
  return `/img/${image.id}/${best}.webp`;
}

export function imageSrcSet(image: ImageRef): string {
  return image.widths.map((w) => `/img/${image.id}/${w}.webp ${w}w`).join(", ");
}

interface ImgProps {
  image: ImageRef;
  alt: string;
  /** <img sizes> değeri, ör. "(min-width: 768px) 33vw, 90vw" */
  sizes: string;
  className?: string;
  /** Ekranın üst kısmındaki görseller için (LCP) */
  priority?: boolean;
  /** Bulanık önizlemeyi gösterme (ör. şeffaf logolar) */
  noPlaceholder?: boolean;
  style?: CSSProperties;
}

/**
 * Duyarlı görsel: srcset ile cihaz genişliğine uygun WebP varyantı seçilir;
 * görsel yüklenene kadar alttaki bulanık önizleme görünür (JS gerektirmez).
 */
export function Img({ image, alt, sizes, className, priority, noPlaceholder, style }: ImgProps) {
  const placeholderStyle: CSSProperties =
    image.placeholder && !noPlaceholder
      ? { backgroundImage: `url("${image.placeholder}")`, backgroundSize: "cover", backgroundPosition: "center" }
      : {};
  return (
    <img
      src={imageUrl(image, 800)}
      srcSet={imageSrcSet(image)}
      sizes={sizes}
      alt={alt}
      width={image.width}
      height={image.height}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      fetchPriority={priority ? "high" : undefined}
      className={className}
      style={{ ...placeholderStyle, ...style }}
    />
  );
}
