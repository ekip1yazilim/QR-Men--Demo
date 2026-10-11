/** Yönetim paneli temel bileşenleri */
import { cloneElement, isValidElement, useId, type ButtonHTMLAttributes, type ReactElement, type ReactNode } from "react";
import type { IconType } from "react-icons";
import { LuCircleAlert, LuLoaderCircle, LuRefreshCw } from "react-icons/lu";
import { Link } from "../lib/router";

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "ghost" | "danger" | "accent";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-coal text-white hover:bg-coal-3 shadow-[0_1px_0_rgb(255_255_255/0.08)_inset]",
  secondary: "bg-surface text-ink ring-1 ring-line hover:bg-raised",
  ghost: "text-ink-2 hover:bg-raised hover:text-ink",
  danger: "bg-bad text-white hover:brightness-110",
  accent: "bg-ember text-coal hover:brightness-105",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "sm" | "md";
  icon?: IconType;
  loading?: boolean;
}

export function Button({ variant = "secondary", size = "md", icon: Icon, loading, className, children, disabled, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={cx(
        "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl font-semibold transition-[background-color,filter,box-shadow] duration-150 disabled:opacity-55",
        size === "sm" ? "h-9 px-3 text-[0.85rem]" : "h-11 px-4 text-[0.92rem]",
        VARIANTS[variant],
        className,
      )}
      {...rest}
    >
      {loading ? <LuLoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : Icon ? <Icon className="size-4" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

export function ButtonLink({
  to,
  variant = "secondary",
  size = "md",
  icon: Icon,
  children,
  external,
  className,
}: {
  to: string;
  variant?: Variant;
  size?: "sm" | "md";
  icon?: IconType;
  children: ReactNode;
  external?: boolean;
  className?: string;
}) {
  const cls = cx(
    "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl font-semibold transition-colors",
    size === "sm" ? "h-9 px-3 text-[0.85rem]" : "h-11 px-4 text-[0.92rem]",
    VARIANTS[variant],
    className,
  );
  const inner = (
    <>
      {Icon && <Icon className="size-4" aria-hidden="true" />}
      {children}
    </>
  );
  return external ? (
    <a href={to} target="_blank" rel="noopener noreferrer" className={cls}>
      {inner}
    </a>
  ) : (
    <Link to={to} className={cls}>
      {inner}
    </Link>
  );
}

export function IconButton({
  icon: Icon,
  label,
  tone = "neutral",
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon: IconType; label: string; tone?: "neutral" | "danger" }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        "grid size-9 shrink-0 place-items-center rounded-lg transition-colors disabled:opacity-40",
        tone === "danger" ? "text-ink-3 hover:bg-bad/10 hover:text-bad" : "text-ink-3 hover:bg-raised hover:text-ink",
        className,
      )}
      {...rest}
    >
      <Icon className="size-[1.05rem]" aria-hidden="true" />
    </button>
  );
}

export function Spinner({ className = "size-5" }: { className?: string }) {
  return <LuLoaderCircle className={cx("animate-spin text-ink-3", className)} aria-label="Yükleniyor" />;
}

// ---------------------------------------------------------------------------
// Form alanları
// ---------------------------------------------------------------------------

interface FieldProps {
  label: string;
  error?: string;
  hint?: ReactNode;
  required?: boolean;
  optional?: boolean;
  counter?: { value: number; max: number };
  children: ReactElement<{ id?: string; "aria-invalid"?: boolean; "aria-describedby"?: string }>;
  className?: string;
}

/** Etiket + alan + yardım metni + hata mesajı; erişilebilirlik bağlantıları otomatik kurulur. */
export function Field({ label, error, hint, required, optional, counter, children, className }: FieldProps) {
  const id = useId();
  const hintId = `${id}-ipucu`;
  const errorId = `${id}-hata`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;
  const control = isValidElement(children)
    ? cloneElement(children, { id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy })
    : children;
  return (
    <div className={className}>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-semibold text-ink">
          {label}
          {required && <span className="text-ember-deep"> *</span>}
          {optional && <span className="font-normal text-ink-3"> (isteğe bağlı)</span>}
        </label>
        {counter && (
          <span className={cx("text-xs tabular", counter.value > counter.max ? "font-semibold text-bad" : "text-ink-3")}>
            {counter.value}/{counter.max}
          </span>
        )}
      </div>
      {control}
      {hint && !error && (
        <p id={hintId} className="mt-1.5 text-[0.8rem] leading-relaxed text-ink-3">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="mt-1.5 flex items-start gap-1.5 text-[0.8rem] font-medium text-bad">
          <LuCircleAlert className="mt-px size-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}

interface SwitchProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: ReactNode;
  disabled?: boolean;
  /** Etiketi görsel olarak gizle (tablo içi anahtarlar) */
  hideLabel?: boolean;
  size?: "sm" | "md";
}

export function Switch({ checked, onChange, label, description, disabled, hideLabel, size = "md" }: SwitchProps) {
  const id = useId();
  const track = size === "sm" ? "h-6 w-10" : "h-7 w-12";
  const knob = size === "sm" ? "size-5" : "size-6";
  const shift = size === "sm" ? "translate-x-4" : "translate-x-5";
  const button = (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-label={hideLabel ? label : undefined}
      aria-describedby={description ? `${id}-a` : undefined}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        "relative inline-flex shrink-0 items-center rounded-full p-0.5 transition-colors duration-200 disabled:opacity-50",
        track,
        checked ? "bg-coal" : "bg-[#d9d8d4]",
      )}
    >
      <span className={cx("rounded-full bg-white shadow-sm transition-transform duration-200 ease-[var(--ease-soft)]", knob, checked ? shift : "translate-x-0")} />
    </button>
  );
  if (hideLabel) return button;
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <label htmlFor={id} className="text-sm font-semibold text-ink">
          {label}
        </label>
        {description && (
          <p id={`${id}-a`} className="mt-0.5 text-[0.8rem] leading-relaxed text-ink-3">
            {description}
          </p>
        )}
      </div>
      {button}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Yerleşim
// ---------------------------------------------------------------------------

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-[1.65rem] font-bold tracking-tight text-ink">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-[0.95rem] text-ink-2">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Panel({
  title,
  description,
  actions,
  children,
  className,
  padded = true,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section className={cx("rounded-2xl bg-surface ring-1 ring-line", className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
          <div className="min-w-0">
            {title && <h2 className="text-[1.02rem] font-bold text-ink">{title}</h2>}
            {description && <p className="mt-0.5 text-sm text-ink-3">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      <div className={padded ? "p-5 sm:p-6" : ""}>{children}</div>
    </section>
  );
}

const PILL_TONES = {
  green: "bg-ok/10 text-ok",
  gray: "bg-raised text-ink-3 ring-1 ring-line",
  orange: "bg-ember/12 text-ember-deep",
  red: "bg-bad/10 text-bad",
};

export function Pill({ tone, children, icon: Icon }: { tone: keyof typeof PILL_TONES; children: ReactNode; icon?: IconType }) {
  return (
    <span className={cx("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold", PILL_TONES[tone])}>
      {Icon && <Icon className="size-3.5" aria-hidden="true" />}
      {children}
    </span>
  );
}

export function EmptyState({ icon: Icon, title, text, action }: { icon: IconType; title: string; text?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-raised ring-1 ring-line">
        <Icon className="size-6 text-ember-deep" aria-hidden="true" />
      </span>
      <h3 className="mt-4 text-lg font-bold text-ink">{title}</h3>
      {text && <p className="mt-1 max-w-sm text-sm leading-relaxed text-ink-2">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center rounded-2xl bg-surface px-6 py-12 text-center ring-1 ring-line">
      <span className="grid size-12 place-items-center rounded-full bg-bad/10">
        <LuCircleAlert className="size-6 text-bad" aria-hidden="true" />
      </span>
      <p className="mt-4 max-w-md font-semibold text-ink">{message}</p>
      {onRetry && (
        <Button className="mt-5" icon={LuRefreshCw} onClick={onRetry}>
          Tekrar dene
        </Button>
      )}
    </div>
  );
}

export function SkeletonRows({ rows = 5, className = "h-14" }: { rows?: number; className?: string }) {
  return (
    <div className="space-y-2.5" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className={cx("skeleton", className)} style={{ opacity: 1 - i * 0.12 }} />
      ))}
    </div>
  );
}

/** Formun altında yapışkan kaydet çubuğu */
export function SaveBar({
  dirty,
  saving,
  onSave,
  onReset,
  saveLabel = "Değişiklikleri kaydet",
}: {
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  onReset?: () => void;
  saveLabel?: string;
}) {
  return (
    <div
      className={cx(
        "sticky bottom-0 z-20 -mx-4 mt-8 border-t border-line bg-bg/90 px-4 py-3 backdrop-blur-md transition-opacity sm:-mx-8 sm:px-8",
        "pb-[max(0.75rem,env(safe-area-inset-bottom))]",
      )}
    >
      <div className="flex items-center justify-end gap-3">
        <p className={cx("mr-auto text-sm", dirty ? "font-semibold text-ember-deep" : "text-ink-3")} aria-live="polite">
          {dirty ? "Kaydedilmemiş değişiklikler var" : "Tüm değişiklikler kayıtlı"}
        </p>
        {onReset && dirty && (
          <Button variant="ghost" onClick={onReset} disabled={saving}>
            Vazgeç
          </Button>
        )}
        <Button variant="primary" onClick={onSave} loading={saving} disabled={!dirty}>
          {saveLabel}
        </Button>
      </div>
    </div>
  );
}
