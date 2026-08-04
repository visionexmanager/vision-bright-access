/// <reference types="vite/client" />

declare global {
  interface Window {
    /**
     * AdSense's command queue. Optional because the tag only appears once the
     * loader script has run — and it never runs without ad consent, so the
     * property is genuinely absent for most visitors.
     *
     * Declared here, once. AdBanner.tsx and features/ads/AdSenseSlot.tsx each
     * used to declare it, one optional and one not, which is an error: every
     * declaration of a property has to carry the same modifiers.
     */
    adsbygoogle?: unknown[];
  }
}

export {};
