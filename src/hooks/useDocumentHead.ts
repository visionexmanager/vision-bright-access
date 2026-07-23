import { useEffect, useMemo } from "react";

interface DocumentHeadOptions {
  title: string;
  description?: string;
  image?: string;
  /** Path only, e.g. "/library" — origin is read from window.location. */
  canonicalPath?: string;
  /** A plain object — JSON.stringify'd internally so passing a fresh
   *  object literal each render doesn't re-trigger the effect. */
  structuredData?: Record<string, unknown>;
}

function upsertMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

/**
 * Sets document.title, Open Graph/description meta tags, a canonical link,
 * and an optional JSON-LD structured-data script for the current route.
 * No dependency is added for this (no react-helmet-async or similar exists
 * in this codebase, and there's no way to verify a new package builds in
 * this environment) — plain useEffect DOM manipulation, self-contained.
 */
export function useDocumentHead({ title, description, image, canonicalPath, structuredData }: DocumentHeadOptions) {
  const structuredDataJson = useMemo(() => (structuredData ? JSON.stringify(structuredData) : null), [structuredData]);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = title;

    if (description) upsertMeta("name", "description", description);
    upsertMeta("property", "og:title", title);
    if (description) upsertMeta("property", "og:description", description);
    upsertMeta("property", "og:type", "website");
    if (image) upsertMeta("property", "og:image", image);

    upsertMeta("name", "twitter:card", image ? "summary_large_image" : "summary");
    upsertMeta("name", "twitter:title", title);
    if (description) upsertMeta("name", "twitter:description", description);
    if (image) upsertMeta("name", "twitter:image", image);

    if (canonicalPath) {
      let canonicalEl = document.querySelector('link[rel="canonical"]');
      if (!canonicalEl) {
        canonicalEl = document.createElement("link");
        canonicalEl.setAttribute("rel", "canonical");
        document.head.appendChild(canonicalEl);
      }
      canonicalEl.setAttribute("href", `${window.location.origin}${canonicalPath}`);
    }

    let scriptEl: HTMLScriptElement | null = null;
    if (structuredDataJson) {
      scriptEl = document.createElement("script");
      scriptEl.type = "application/ld+json";
      scriptEl.textContent = structuredDataJson;
      document.head.appendChild(scriptEl);
    }

    return () => {
      document.title = previousTitle;
      if (scriptEl) document.head.removeChild(scriptEl);
    };
  }, [title, description, image, canonicalPath, structuredDataJson]);
}
