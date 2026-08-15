/**
 * AnimatedSection — lightweight scroll-reveal powered by CSS + IntersectionObserver.
 *
 * Previously used framer-motion (151 kB). Now zero extra JS weight:
 * the animations are pure CSS @keyframes driven by a single data-attribute
 * toggled by one shared IntersectionObserver per page.
 */
import { useEffect, useRef, ReactNode } from "react";
import { fadeUp, type Variants } from "./animationVariants";

// Animation CSS is now in index.css (no runtime injection needed)

// One shared observer for the whole app
let observer: IntersectionObserver | null = null;
function getObserver() {
  if (observer) return observer;
  if (typeof IntersectionObserver === "undefined") return null;
  observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("anim-visible");
          observer!.unobserve(e.target);
        }
      });
    },
    { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
  );
  return observer;
}

// ─── AnimatedSection ─────────────────────────────────────────────────────────
export function AnimatedSection({
  children,
  variants = fadeUp,
  className = "",
  role,
}: {
  children: ReactNode;
  variants?: Variants;
  className?: string;
  role?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const variant = (variants._variant as string) ?? "fade-up";

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = getObserver();
    if (!obs) {
      // Fallback: just show the element immediately
      el.classList.add("anim-visible");
      return;
    }
    obs.observe(el);
    return () => obs.unobserve(el);
  }, []);

  return (
    <div ref={ref} data-anim={variant} className={className} role={role}>
      {children}
    </div>
  );
}

// ─── StaggerGrid ─────────────────────────────────────────────────────────────
export function StaggerGrid({
  children,
  className = "",
  role,
}: {
  children: ReactNode;
  className?: string;
  role?: string;
}) {
  return (
    <AnimatedSection variants={fadeUp} className={className} role={role}>
      {children}
    </AnimatedSection>
  );
}

// ─── StaggerItem ─────────────────────────────────────────────────────────────
export function StaggerItem({
  children,
  className = "",
  role,
}: {
  children: ReactNode;
  className?: string;
  role?: string;
}) {
  // Items inside a StaggerGrid don't need individual observers — the parent handles it
  return <div className={className} role={role}>{children}</div>;
}
