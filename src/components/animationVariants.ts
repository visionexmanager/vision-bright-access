/**
 * Scroll-reveal presets shared by AnimatedSection and its callers.
 *
 * They live apart from the components so both files stay hot-reloadable:
 * a module that exports components and plain values cannot be fast-refreshed.
 */

// Keep the same Variants type so existing callers don't need edits
export type Variants = Record<string, unknown>;

// Named preset variants — values are CSS class suffixes
export const fadeUp:    Variants = { _variant: "fade-up" };
export const scaleFade: Variants = { _variant: "scale-fade" };
export const slideLeft: Variants = { _variant: "slide-left" };
export const slideRight:Variants = { _variant: "slide-right" };

// Stagger container / item presets kept for API compatibility
export const staggerContainer: Variants = { _variant: "stagger" };
