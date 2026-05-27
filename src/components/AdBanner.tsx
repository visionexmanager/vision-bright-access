import { useEffect, useRef } from "react";

const AD_CLIENT = "ca-pub-6897088904832302";

// Inject adsbygoogle.js once, the first time any banner mounts
let adsenseScriptInjected = false;
function ensureAdsense() {
  if (adsenseScriptInjected || typeof document === "undefined") return;
  adsenseScriptInjected = true;
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${AD_CLIENT}`;
  s.crossOrigin = "anonymous";
  document.head.appendChild(s);
}

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
    ensureAdsense();
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
