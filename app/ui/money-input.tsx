"use client";

import { useLayoutEffect, useRef } from "react";

const format = (value: string) => value.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

export default function MoneyInput({
  name,
  value,
  onChange,
  ariaLabel,
  max,
}: {
  name: string;
  value: string;
  onChange: (value: string) => void;
  ariaLabel?: string;
  max?: number;
}) {
  const input = useRef<HTMLInputElement>(null);
  const caret = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (caret.current !== null) {
      input.current?.setSelectionRange(caret.current, caret.current);
      caret.current = null;
    }
  });

  function update(text: string, position: number) {
    const before = text.slice(0, position).replace(/\D/g, "").length;
    const digits = text.replace(/\D/g, "");
    const normalized = digits.replace(/^0+(?=\d)/, "");
    const raw = max !== undefined && Number(normalized) > max ? String(Math.max(0, max)) : normalized;
    const count = Math.max(0, before - (digits.length - raw.length));
    const formatted = format(raw);
    let next = 0;
    let seen = 0;
    while (next < formatted.length && seen < count) {
      if (/\d/.test(formatted[next])) seen++;
      next++;
    }
    caret.current = next;
    // Also restore immediately when the raw value is unchanged (e.g. typing a dot).
    if (input.current) {
      input.current.value = formatted;
      input.current.setSelectionRange(next, next);
    }
    onChange(raw);
  }

  return (
    <>
      <input
        ref={input}
        aria-label={ariaLabel}
        type="text"
        inputMode="numeric"
        required
        autoComplete="off"
        value={format(value)}
        onChange={(event) =>
          update(
            event.target.value,
            event.target.selectionStart ?? event.target.value.length,
          )
        }
        onKeyDown={(event) => {
          const element = event.currentTarget;
          const start = element.selectionStart ?? 0;
          if (start !== element.selectionEnd) return;
          if (event.key === "Backspace" && element.value[start - 1] === ".") {
            event.preventDefault();
            update(
              element.value.slice(0, start - 2) + element.value.slice(start),
              start - 2,
            );
          } else if (event.key === "Delete" && element.value[start] === ".") {
            event.preventDefault();
            update(
              element.value.slice(0, start) + element.value.slice(start + 2),
              start,
            );
          }
        }}
      />
      <input type="hidden" name={name} value={value} />
    </>
  );
}
