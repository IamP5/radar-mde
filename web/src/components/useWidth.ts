"use client";

import { useEffect, useState, type RefObject } from "react";

/**
 * Container width in CSS px, clamped, for SVG viewBoxes: drawing at the real width keeps 11px labels at 11px
 * on phones instead of scaling a desktop-sized chart down to unreadable text. Falls back to `initial` on the server.
 */
export function useWidth(ref: RefObject<Element | null>, initial: number, min = 340, max = initial) {
  const [w, setW] = useState(initial);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const next = Math.round(Math.max(min, Math.min(max, e.contentRect.width)));
      setW((prev) => (Math.abs(prev - next) > 4 ? next : prev));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, min, max]);
  return w;
}
