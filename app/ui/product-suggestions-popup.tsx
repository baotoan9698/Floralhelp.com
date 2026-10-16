"use client";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export default function ProductSuggestionsPopup({ children, id, label }: { children: ReactNode; id: string; label: string }) {
  const anchor = useRef<HTMLSpanElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number; width: number; maxHeight: number } | null>(null);
  useLayoutEffect(() => {
    const input = anchor.current?.parentElement?.querySelector('input[role="combobox"]');
    if (!input) return;
    const measure = () => {
      const rect = input.getBoundingClientRect();
      setPosition({ left: Math.max(8, rect.left), top: rect.bottom + 4, width: Math.min(rect.width, window.innerWidth - 16), maxHeight: Math.max(100, Math.min(320, window.innerHeight - rect.bottom - 12)) });
    };
    measure();
    window.addEventListener("scroll", measure, true); window.addEventListener("resize", measure);
    const observer = new ResizeObserver(measure); observer.observe(input);
    return () => { window.removeEventListener("scroll", measure, true); window.removeEventListener("resize", measure); observer.disconnect(); };
  }, []);
  return <><span ref={anchor} />{position && createPortal(<div id={id} role="listbox" aria-label={label} className="product-suggestions product-suggestions-floating" style={position} onPointerDown={(event) => event.preventDefault()}>{children}</div>, document.body)}</>;
}
