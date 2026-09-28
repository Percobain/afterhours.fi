"use client";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Question } from "@phosphor-icons/react";
import clsx from "clsx";
import { GLOSSARY, type GlossaryKey } from "@/lib/copy";

const W = 288; // tooltip width in px
const MARGIN = 12; // min distance from the viewport edge

/**
 * A word with a dotted underline. Hover (desktop) or tap (phone) shows a plain-English definition.
 * The tooltip is portalled to <body> and positioned from the word's screen rect, clamped to the viewport,
 * so a card with overflow-hidden (or a word near the screen edge) can never clip it.
 */
export function Term({ k, children, className, icon = false }: { k: GlossaryKey; children?: ReactNode; className?: string; icon?: boolean }) {
  const g = GLOSSARY[k];
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number; above: boolean; arrow: number } | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const tip = useRef<HTMLSpanElement>(null);
  const id = useId();

  const place = useCallback(() => {
    const t = trigger.current;
    if (!t) return;
    const r = t.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.min(W, vw - MARGIN * 2);
    const center = r.left + r.width / 2;
    const left = Math.min(Math.max(center - width / 2, MARGIN), vw - width - MARGIN);
    const h = tip.current?.offsetHeight ?? 160;
    const above = r.bottom + 8 + h > vh - MARGIN && r.top - 8 - h > MARGIN;
    const top = above ? r.top - 8 - h : r.bottom + 8;
    setPos({ left, top, above, arrow: Math.min(Math.max(center - left, 16), width - 16) });
  }, []);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | TouchEvent) => {
      const n = e.target as Node;
      if (!trigger.current?.contains(n) && !tip.current?.contains(n)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const reflow = () => place();
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close);
    document.addEventListener("keydown", esc);
    window.addEventListener("scroll", reflow, true);
    window.addEventListener("resize", reflow);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("touchstart", close);
      document.removeEventListener("keydown", esc);
      window.removeEventListener("scroll", reflow, true);
      window.removeEventListener("resize", reflow);
    };
  }, [open, place]);

  return (
    <span className={clsx("inline-block", className)} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        ref={trigger}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        className="inline-flex items-center gap-1 underline decoration-dotted decoration-ink-3 underline-offset-[5px] hover:decoration-ink-2"
      >
        {children ?? g.term}
        {icon && <Question weight="bold" className="h-3.5 w-3.5 text-ink-3" aria-hidden />}
      </button>
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <span
            ref={tip}
            id={id}
            role="tooltip"
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
            style={{ position: "fixed", left: pos?.left ?? -9999, top: pos?.top ?? -9999, width: `min(${W}px, calc(100vw - ${MARGIN * 2}px))`, visibility: pos ? "visible" : "hidden" }}
            className="animate-fade-in z-[80] block rounded-2xl border border-line-strong bg-surface-3 p-4 text-left text-sm font-normal normal-case tracking-normal text-ink-2 shadow-pop"
          >
            <span
              aria-hidden
              className={clsx("absolute h-3 w-3 rotate-45 border-line-strong bg-surface-3", pos?.above ? "-bottom-1.5 border-b border-r" : "-top-1.5 border-l border-t")}
              style={{ left: (pos?.arrow ?? 16) - 6 }}
            />
            <span className="block font-semibold text-ink">{g.term}</span>
            <span className="mt-1 block text-ink">{g.short}</span>
            <span className="mt-2 block leading-relaxed">{g.long}</span>
          </span>,
          document.body
        )}
    </span>
  );
}
