/**
 * AnimatedSection — lightweight scroll-reveal powered by CSS + IntersectionObserver.
 *
 * Previously used framer-motion (151 kB). Now zero extra JS weight:
 * the animations are pure CSS @keyframes driven by a single data-attribute
 * toggled by one shared IntersectionObserver per page.
 */
import { useEffect, useRef, ReactNode } from "react";

// Keep the same Variants type so existing callers don't need edits
export type Variants = Record<string, unknown>;

// Named preset variants — values are CSS class suffixes
export const fadeUp:    Variants = { _variant: "fade-up" };
export const scaleFade: Variants = { _variant: "scale-fade" };
export const slideLeft: Variants = { _variant: "slide-left" };
export const slideRight:Variants = { _variant: "slide-right" };

// Stagger container / item presets kept for API compatibility
export const staggerContainer: Variants = { _variant: "stagger" };

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
}: {
  children: ReactNode;
  variants?: Variants;
  className?: string;
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
    <div ref={ref} data-anim={variant} className={className}>
      {children}
    </div>
  );
}

// ─── StaggerGrid ─────────────────────────────────────────────────────────────
export function StaggerGrid({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <AnimatedSection variants={fadeUp} className={className}>
      {children}
    </AnimatedSection>
  );
}

// ─── StaggerItem ─────────────────────────────────────────────────────────────
export function StaggerItem({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  // Items inside a StaggerGrid don't need individual observers — the parent handles it
  return <div className={className}>{children}</div>;
}
