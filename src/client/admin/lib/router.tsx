/** Yönetim paneli için küçük istemci tarafı yönlendirici (History API). */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type AnchorHTMLAttributes, type MouseEvent } from "react";

type Blocker = () => Promise<boolean> | boolean;

interface RouterValue {
  path: string;
  search: URLSearchParams;
  navigate: (to: string, opts?: { replace?: boolean }) => Promise<void>;
  setBlocker: (b: Blocker | null) => void;
}

const RouterCtx = createContext<RouterValue | null>(null);

export function RouterProvider({ children }: { children: React.ReactNode }) {
  const [loc, setLoc] = useState(() => ({ path: window.location.pathname, search: window.location.search }));
  const blocker = useRef<Blocker | null>(null);

  const navigate = useCallback(async (to: string, opts: { replace?: boolean } = {}) => {
    if (blocker.current && !(await blocker.current())) return;
    blocker.current = null;
    const url = new URL(to, window.location.origin);
    if (opts.replace) window.history.replaceState(null, "", url);
    else window.history.pushState(null, "", url);
    setLoc({ path: url.pathname, search: url.search });
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const onPop = () => setLoc({ path: window.location.pathname, search: window.location.search });
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const value = useMemo<RouterValue>(
    () => ({
      path: loc.path.replace(/\/+$/, "") || "/",
      search: new URLSearchParams(loc.search),
      navigate,
      setBlocker: (b) => {
        blocker.current = b;
      },
    }),
    [loc, navigate],
  );
  return <RouterCtx.Provider value={value}>{children}</RouterCtx.Provider>;
}

export function useRouter(): RouterValue {
  const ctx = useContext(RouterCtx);
  if (!ctx) throw new Error("RouterProvider eksik");
  return ctx;
}

/** Yol kalıbı eşleştirme: "/yonetim/urunler/:id" */
export function matchPath(pattern: string, path: string): Record<string, string> | null {
  const p = pattern.split("/").filter(Boolean);
  const a = path.split("/").filter(Boolean);
  if (p.length !== a.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < p.length; i++) {
    if (p[i].startsWith(":")) params[p[i].slice(1)] = decodeURIComponent(a[i]);
    else if (p[i] !== a[i]) return null;
  }
  return params;
}

export function Link({ to, onClick, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) {
  const { navigate } = useRouter();
  return (
    <a
      href={to}
      onClick={(e: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(e);
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        void navigate(to);
      }}
      {...rest}
    />
  );
}
