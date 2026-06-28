/**
 * VirtualChannelList
 *
 * A lightweight virtual list for rendering large channel sets efficiently.
 * Only the visible items (+ overscan) are in the DOM — avoids the
 * performance cliff when rendering hundreds of ChannelCard elements.
 *
 * Requirements:
 *  - All items must have uniform height (ITEM_HEIGHT_PX)
 *  - The container must have a fixed or max height and `overflow-y: auto`
 *
 * Typical usage:
 *   <VirtualChannelList
 *     items={channels}
 *     renderItem={(ch, i) => <ChannelCard key={ch.id} channel={ch} ... />}
 *     className="h-full"
 *   />
 */

import React, { useRef, useState, useCallback, useEffect, type ReactNode } from "react";

// Matches the natural height of ChannelCard (p-3 = 12px × 2, h-12 logo = 48px → 72px)
// plus 6px gap (space-y-1.5 equivalent).
const ITEM_HEIGHT_PX = 78;
const OVERSCAN       = 4;  // extra items rendered above/below viewport

interface Props<T> {
  items:        T[];
  renderItem:   (item: T, index: number) => ReactNode;
  /** Stable key extractor — prevents DOM remount on scroll. Defaults to absolute index. */
  getItemKey?:  (item: T, index: number) => React.Key;
  className?:   string;
  emptyNode?:   ReactNode;
}

export function VirtualChannelList<T>({
  items,
  renderItem,
  getItemKey,
  className = "overflow-y-auto",
  emptyNode,
}: Props<T>) {
  const containerRef    = useRef<HTMLDivElement>(null);
  const [scrollTop,     setScrollTop]     = useState(0);
  const [containerH,    setContainerH]    = useState(600);

  // Track container height via ResizeObserver
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setContainerH(el.clientHeight);
    const ro = new ResizeObserver(([entry]) =>
      setContainerH(entry.contentRect.height)
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const onScroll = useCallback(() => {
    if (containerRef.current) setScrollTop(containerRef.current.scrollTop);
  }, []);

  if (items.length === 0 && emptyNode) return <>{emptyNode}</>;

  const totalH  = items.length * ITEM_HEIGHT_PX;
  const start   = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT_PX) - OVERSCAN);
  const end     = Math.min(
    items.length,
    Math.ceil((scrollTop + containerH) / ITEM_HEIGHT_PX) + OVERSCAN
  );

  return (
    <div
      ref={containerRef}
      onScroll={onScroll}
      className={className}
      style={{ scrollbarWidth: "thin" }}
    >
      {/* Full-height sentinel to maintain correct scrollbar */}
      <div style={{ height: totalH, position: "relative" }}>
        {items.slice(start, end).map((item, offset) => {
          const idx = start + offset;
          const key = getItemKey ? getItemKey(item, idx) : idx;
          return (
            <div
              key={key}
              style={{
                position: "absolute",
                top:    idx * ITEM_HEIGHT_PX,
                left:   0,
                right:  0,
                height: ITEM_HEIGHT_PX,
                paddingBottom: 6,
              }}
            >
              {renderItem(item, idx)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
