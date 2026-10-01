import { useEffect, useState, type AnchorHTMLAttributes, type ReactNode } from "react";

// ---- tiny router (no dependency): history API + a navigate() that pages share ----
export const navigate = (to: string) => {
  window.history.pushState({}, "", to);
  window.dispatchEvent(new PopStateEvent("popstate"));
};
export const usePath = () => {
  const [p, setP] = useState(window.location.pathname + window.location.search);
  useEffect(() => {
    const f = () => setP(window.location.pathname + window.location.search);
    window.addEventListener("popstate", f);
    return () => window.removeEventListener("popstate", f);
  }, []);
  return p;
};
export function Link({ to, children, ...rest }: { to: string; children: ReactNode } & AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a
      href={to}
      {...rest}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        navigate(to);
      }}
    >
      {children}
    </a>
  );
}

