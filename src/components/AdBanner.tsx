import { useEffect, useRef } from "react";

const AD_CLIENT = "ca-pub-6897088904832302";

interface Props {
  slot: string;
  format?: "auto" | "horizontal" | "rectangle" | "vertical";
  className?: string;
}

declare global {
  interface Window { adsbygoogle: unknown[]; }
}

/**
 * Reusable AdSense display banner.
 * Usage: <AdBanner slot="XXXXXXXXXX" format="horizontal" />
 */
export function AdBanner({ slot, format = "auto", className = "" }: Props) {
  const pushedSlot = useRef<string | null>(null);

  useEffect(() => {
    if (pushedSlot.current === slot) return;
    pushedSlot.current = slot;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch { /* already initialised */ }
  }, [slot]);

  return (
    <div
      className={`overflow-hidden rounded-lg ${className}`}
      aria-hidden="true"          // decorative — screen readers skip it
      role="presentation"
    >
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={AD_CLIENT}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </div>
  );
}
