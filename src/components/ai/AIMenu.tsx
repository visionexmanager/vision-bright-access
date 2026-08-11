import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { findMenuNode, menuEntries, type MenuControl } from "@/lib/ai/navigationMenu";

interface Props {
  menuId: string;
  onSelectChild: (childId: string) => void;
  onControl: (control: MenuControl) => void;
  /** Set after the level changed, so focus moves only then and not on every render. */
  autoFocus?: boolean;
}

/**
 * The numbered menu.
 *
 * Built for someone who cannot see it:
 *  - A real <nav> containing an ordered list, so a screen reader announces
 *    "list, 6 items" and the user can jump item to item.
 *  - The number is part of each button's text, not a visual decoration, so it
 *    is spoken: "1. Products". Typing that number does the same thing.
 *  - The heading is focusable and receives focus when the level changes, so
 *    the new context is read out from its title rather than the user having to
 *    hunt for what moved.
 *  - Nothing here relies on colour or position to convey meaning.
 */
export function AIMenu({ menuId, onSelectChild, onControl, autoFocus }: Props) {
  const { t } = useLanguage();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const node = findMenuNode(menuId);

  useEffect(() => {
    if (autoFocus) headingRef.current?.focus();
  }, [autoFocus, menuId]);

  if (!node) return null;

  const entries = menuEntries(menuId);
  const title = t(node.labelKey as Parameters<typeof t>[0]);
  const headingId = `ai-menu-heading-${menuId.replace(/\./g, "-")}`;

  return (
    <nav aria-labelledby={headingId} className="rounded-lg border bg-muted/30 p-3">
      <h3
        id={headingId}
        ref={headingRef}
        tabIndex={-1}
        className="mb-2 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        {title}
      </h3>

      {/* An ordered list gives the count and position for free. */}
      <ol className="flex flex-col gap-1.5">
        {entries.map((entry) => {
          const label = t(entry.labelKey as Parameters<typeof t>[0]);
          return (
            <li key={`${entry.kind}-${entry.childId ?? entry.control}`}>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full justify-start text-start text-sm"
                onClick={() =>
                  entry.kind === "child"
                    ? onSelectChild(entry.childId!)
                    : onControl(entry.control!)
                }
              >
                {/* One node, visible and exposed. An earlier version hid this
                    with aria-hidden and repeated it in an sr-only span; that
                    left the visible text and the accessible name computed from
                    different nodes, and whether a screen reader picked up the
                    number then depended on how it treats clipped text. Keeping
                    it as ordinary text makes all three — what is seen, what is
                    read, and what may be typed — the same string. */}
                {/* The space is a real character, not a margin: the gap has to
                    exist in the accessible name too, or "1." and the label are
                    read as one token. */}
                <span className="me-2 font-semibold tabular-nums">{entry.number}.</span>{" "}
                {label}
              </Button>
            </li>
          );
        })}
      </ol>

      <p className="mt-2 text-xs text-muted-foreground">{t("aiMenu.hint")}</p>
    </nav>
  );
}
