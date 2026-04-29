import { useEffect, useState } from "react";

const STORAGE_KEY = "vx_did";

async function buildFingerprint(): Promise<string> {
  const parts: string[] = [];

  // Canvas fingerprint
  try {
    const c = document.createElement("canvas");
    const ctx = c.getContext("2d");
    if (ctx) {
      ctx.textBaseline = "top";
      ctx.font = "14px Arial";
      ctx.fillStyle = "#f60";
      ctx.fillRect(125, 1, 62, 20);
      ctx.fillStyle = "#069";
      ctx.fillText("VX::fp", 2, 15);
      ctx.fillStyle = "rgba(102,204,0,0.7)";
      ctx.fillText("VX::fp", 4, 17);
      parts.push(c.toDataURL());
    }
  } catch { /* canvas blocked */ }

  // WebGL renderer
  try {
    const c = document.createElement("canvas");
    const gl = (c.getContext("webgl") || c.getContext("experimental-webgl")) as WebGLRenderingContext | null;
    if (gl) {
      const dbg = gl.getExtension("WEBGL_debug_renderer_info");
      if (dbg) {
        parts.push(gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL));
        parts.push(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL));
      } else {
        parts.push(gl.getParameter(gl.RENDERER));
      }
    }
  } catch { /* WebGL blocked */ }

  // Screen & display
  parts.push(`${screen.width}x${screen.height}x${screen.colorDepth}`);
  parts.push(`${screen.availWidth}x${screen.availHeight}`);
  parts.push(String(window.devicePixelRatio ?? ""));

  // Browser environment
  parts.push(Intl.DateTimeFormat().resolvedOptions().timeZone);
  parts.push(navigator.language ?? "");
  parts.push((navigator.languages ?? []).slice(0, 3).join(","));
  parts.push(navigator.platform ?? "");
  parts.push(String(navigator.hardwareConcurrency ?? ""));
  // @ts-ignore – deviceMemory is non-standard but widely supported
  parts.push(String(navigator.deviceMemory ?? ""));
  parts.push(String("ontouchstart" in window));
  parts.push(String(navigator.cookieEnabled));

  const raw = parts.join("|");

  if (crypto?.subtle) {
    const buf = new TextEncoder().encode(raw);
    const hash = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  // Fallback: djb2-style hash
  let h = 5381;
  for (let i = 0; i < raw.length; i++) {
    h = (Math.imul(h, 31) + raw.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(16).padStart(8, "0");
}

export function useDeviceId(): string | null {
  const [deviceId, setDeviceId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (deviceId) return;
    buildFingerprint().then((id) => {
      try {
        localStorage.setItem(STORAGE_KEY, id);
      } catch { /* storage blocked */ }
      setDeviceId(id);
    });
  }, [deviceId]);

  return deviceId;
}
