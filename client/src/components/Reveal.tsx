"use client";
import { createElement, useEffect, useRef, useState, type ReactNode } from "react";
import clsx from "clsx";

/**
 * Scroll-reveal: an IntersectionObserver adds a class, a CSS transition does the rest.
 * No per-frame JavaScript, so content can never get stuck invisible; reduced motion shows it instantly.
 */
export function Reveal({ children, className, delay = 0, as = "div" }: { children: ReactNode; className?: string; delay?: number; as?: "div" | "section" | "li" }) {
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -60px 0px" }
    );
    io.observe(el);
    const fallback = setTimeout(() => setShown(true), 4000); // never leave content hidden
    return () => {
      io.disconnect();
      clearTimeout(fallback);
    };
  }, []);

  return createElement(
    as,
    {
      ref,
      className: clsx("transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none", shown ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0", className),
      style: { transitionDelay: shown ? `${delay}s` : "0s" },
    },
    children
  );
}
