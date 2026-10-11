/** Bildirimler (toast), onay pencereleri ve modal pencere */
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { LuCircleAlert, LuCircleCheck, LuInfo, LuTriangleAlert, LuX } from "react-icons/lu";
import { Button, cx } from "./primitives";

// ---------------------------------------------------------------------------
// Modal (yerel <dialog>: odak hapsi, Esc ile kapanma, arka plan kilidi)
// ---------------------------------------------------------------------------
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={cx("sheet", size === "sm" && "sheet-sm", size === "lg" && "sheet-lg")}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      {open && (
        <div className="sheet-panel rounded-t-3xl bg-surface text-ink shadow-float ring-1 ring-line md:rounded-3xl">
          <div className="flex items-start justify-between gap-4 px-6 pt-6">
            <div>
              <h2 id={titleId} className="text-lg font-bold">
                {title}
              </h2>
              {description && <p className="mt-1 text-sm leading-relaxed text-ink-2">{description}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Kapat"
              className="-mr-2 -mt-1 grid size-9 shrink-0 place-items-center rounded-lg text-ink-3 hover:bg-raised hover:text-ink"
            >
              <LuX className="size-5" aria-hidden="true" />
            </button>
          </div>
          {children && <div className="px-6 pt-5">{children}</div>}
          {footer && (
            <div className="mt-6 flex flex-col-reverse gap-2 border-t border-line px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end">
              {footer}
            </div>
          )}
          {!footer && <div className="h-6" />}
        </div>
      )}
    </dialog>
  );
}

// ---------------------------------------------------------------------------
// Bildirimler
// ---------------------------------------------------------------------------
type ToastTone = "success" | "error" | "info";
interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
}

interface ConfirmOptions {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "default";
}

interface FeedbackValue {
  toast: (message: string, tone?: ToastTone) => void;
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
}

const FeedbackCtx = createContext<FeedbackValue | null>(null);

export function useFeedback(): FeedbackValue {
  const ctx = useContext(FeedbackCtx);
  if (!ctx) throw new Error("FeedbackProvider eksik");
  return ctx;
}

const TOAST_ICON = { success: LuCircleCheck, error: LuCircleAlert, info: LuInfo };

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [pending, setPending] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);
  const seq = useRef(0);

  const toast = useCallback((message: string, tone: ToastTone = "success") => {
    const id = ++seq.current;
    setToasts((t) => [...t.slice(-3), { id, tone, message }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === "error" ? 7000 : 4000);
  }, []);

  const confirm = useCallback(
    (opts: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setPending({ ...opts, resolve });
      }),
    [],
  );

  const close = (v: boolean) => {
    pending?.resolve(v);
    setPending(null);
  };

  return (
    <FeedbackCtx.Provider value={{ toast, confirm }}>
      {children}

      <Modal
        open={!!pending}
        onClose={() => close(false)}
        title={pending?.title ?? ""}
        size="sm"
        footer={
          <>
            <Button onClick={() => close(false)}>{pending?.cancelLabel ?? "Vazgeç"}</Button>
            <Button variant={pending?.tone === "danger" ? "danger" : "primary"} onClick={() => close(true)} autoFocus>
              {pending?.confirmLabel ?? "Onayla"}
            </Button>
          </>
        }
      >
        {pending?.message && (
          <div className="flex gap-3 text-sm leading-relaxed text-ink-2">
            {pending.tone === "danger" && <LuTriangleAlert className="mt-0.5 size-5 shrink-0 text-bad" aria-hidden="true" />}
            <div>{pending.message}</div>
          </div>
        )}
      </Modal>

      <div className="pointer-events-none fixed inset-x-4 bottom-4 z-[60] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-6 sm:items-end" aria-live="polite">
        {toasts.map((t) => {
          const Icon = TOAST_ICON[t.tone];
          return (
            <div
              key={t.id}
              role={t.tone === "error" ? "alert" : "status"}
              className={cx(
                "toast-enter pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl px-4 py-3 text-sm shadow-float",
                t.tone === "error" ? "bg-bad text-white" : "bg-coal text-white",
              )}
            >
              <Icon className={cx("mt-0.5 size-4 shrink-0", t.tone === "success" ? "text-[#6ee7a0]" : "")} aria-hidden="true" />
              <p className="flex-1 leading-relaxed">{t.message}</p>
              <button
                type="button"
                onClick={() => setToasts((all) => all.filter((x) => x.id !== t.id))}
                aria-label="Bildirimi kapat"
                className="-m-1 rounded-md p-1 opacity-70 hover:opacity-100"
              >
                <LuX className="size-4" aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </FeedbackCtx.Provider>
  );
}
