/** Yönetim API istemcisi: CSRF belirteci, oturum süresi ve hata mesajları burada ele alınır. */
import type { ApiErrorBody, ImageKind, ImageRef } from "../../../shared/types";

let csrfToken = "";
export function setCsrf(token: string) {
  csrfToken = token;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public fieldErrors: Record<string, string> = {},
  ) {
    super(message);
  }
}

function goToLogin() {
  const next = window.location.pathname + window.location.search;
  window.location.assign(`/yonetim/giris?sonra=${encodeURIComponent(next)}`);
}

export async function api<T>(method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE", url: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/yonetim/api${url}`, {
      method,
      credentials: "same-origin",
      headers: {
        accept: "application/json",
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
        ...(method !== "GET" ? { "x-csrf-token": csrfToken } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError("Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.", 0);
  }
  if (res.status === 401) {
    goToLogin();
    throw new ApiError("Oturumunuz sona erdi.", 401);
  }
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* gövdesiz yanıt */
  }
  if (!res.ok) {
    const err = (data ?? {}) as Partial<ApiErrorBody>;
    throw new ApiError(err.error ?? "İşlem tamamlanamadı. Lütfen tekrar deneyin.", res.status, err.fieldErrors ?? {});
  }
  return data as T;
}

export const MAX_UPLOAD_MB = 10;

/** Görsel yükleme (ilerleme yüzdesiyle) */
export function uploadImage(file: File, kind: ImageKind, onProgress?: (pct: number) => void): Promise<ImageRef> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new ApiError("Yalnızca görsel dosyaları yükleyebilirsiniz (JPG, PNG, WebP).", 415));
      return;
    }
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
      reject(new ApiError(`Dosya en fazla ${MAX_UPLOAD_MB} MB olabilir. Daha küçük bir görsel seçin.`, 413));
      return;
    }
    const form = new FormData();
    form.append("dosya", file);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/yonetim/api/gorseller?tur=${kind}`);
    xhr.setRequestHeader("x-csrf-token", csrfToken);
    xhr.responseType = "json";
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onerror = () => reject(new ApiError("Yükleme sırasında bağlantı koptu. Tekrar deneyin.", 0));
    xhr.onload = () => {
      if (xhr.status === 401) {
        goToLogin();
        return reject(new ApiError("Oturumunuz sona erdi.", 401));
      }
      const body = xhr.response as { image?: ImageRef; error?: string } | null;
      if (xhr.status >= 200 && xhr.status < 300 && body?.image) resolve(body.image);
      else reject(new ApiError(body?.error ?? "Görsel yüklenemedi.", xhr.status));
    };
    xhr.send(form);
  });
}
