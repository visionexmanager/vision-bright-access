import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useLanguage } from "@/contexts/LanguageContext";
import type { ReaderPanelKey } from "@/components/library/reader/ReaderPanelTypes";

interface ReaderShellFullscreenHelpers {
  isFullscreen: boolean;
  toggleFullscreen: () => void;
}

interface ReaderShellProps {
  /** Render-prop rather than a plain ReactNode so the fullscreen button
   *  inside the toolbar can call back into the state ReaderShell owns —
   *  the fullscreen element IS this component's own root container, so
   *  fullscreen must be toggled from here, not from a sibling. */
  topToolbar: (helpers: ReaderShellFullscreenHelpers) => ReactNode;
  bottomToolbar: ReactNode;
  activePanel: ReaderPanelKey | null;
  onClosePanel: () => void;
  panelTitle: string;
  panelContent: ReactNode;
  shortcuts: {
    onNext?: () => void;
    onPrev?: () => void;
    onSearch?: () => void;
    onBookmark?: () => void;
    onNote?: () => void;
    onFontIncrease?: () => void;
    onFontDecrease?: () => void;
  };
  children: ReactNode;
}

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || el.isContentEditable;
}

/**
 * Top-level reader layout: toolbar + main pane + optional side panel. Owns
 * fullscreen state, the keyboard-shortcut map, and closes the active panel
 * on Escape. Landmarks (header/main/aside/footer) match the existing
 * role="toolbar" convention already used by the Phase 1 ReaderToolbar.
 */
export function ReaderShell({
  topToolbar, bottomToolbar, activePanel, onClosePanel, panelTitle, panelContent, shortcuts, children,
}: ReaderShellProps) {
  const { t, dir } = useLanguage();
  const containerRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handler = () => setIsFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void containerRef.current?.requestFullscreen();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;

      if (e.key === "Escape" && activePanel) {
        onClosePanel();
        return;
      }
      switch (e.key) {
        case "ArrowRight":
          shortcuts.onNext?.();
          break;
        case "ArrowLeft":
          shortcuts.onPrev?.();
          break;
        case "/":
          e.preventDefault();
          shortcuts.onSearch?.();
          break;
        case "b":
          shortcuts.onBookmark?.();
          break;
        case "n":
          shortcuts.onNote?.();
          break;
        case "f":
          toggleFullscreen();
          break;
        case "+":
        case "=":
          shortcuts.onFontIncrease?.();
          break;
        case "-":
          shortcuts.onFontDecrease?.();
          break;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activePanel, onClosePanel, shortcuts, toggleFullscreen]);

  return (
    <div ref={containerRef} className="flex h-[calc(100vh-4rem)] flex-col bg-background">
      <a href="#reader-main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground">
        {t("library.reader.skipToContent")}
      </a>

      {topToolbar({ isFullscreen, toggleFullscreen })}

      <main id="reader-main-content" ref={mainRef} className="min-h-0 flex-1" aria-label={t("library.nav.reader")} tabIndex={-1}>
        {children}
      </main>

      {bottomToolbar}

      <Sheet open={activePanel !== null} onOpenChange={(open) => !open && onClosePanel()}>
        <SheetContent side={dir === "rtl" ? "left" : "right"} className="w-full overflow-y-auto sm:max-w-sm" aria-label={panelTitle}>
          <SheetHeader>
            <SheetTitle>{panelTitle}</SheetTitle>
          </SheetHeader>
          <div className="mt-4">{panelContent}</div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
