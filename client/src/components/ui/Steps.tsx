"use client";
import clsx from "clsx";
import { Check } from "@phosphor-icons/react";

/** Horizontal progress for a guided flow. Completed steps are clickable to go back. */
export function Steps({ steps, current, onJump }: { steps: string[]; current: number; onJump?: (i: number) => void }) {
  return (
    <ol className="flex items-center gap-2" aria-label="Progress">
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={s} className="flex min-w-0 flex-1 items-center gap-2">
            <button
              type="button"
              disabled={!done || !onJump}
              onClick={() => onJump?.(i)}
              aria-current={active ? "step" : undefined}
              className={clsx("group flex min-w-0 items-center gap-2", done && onJump ? "cursor-pointer" : "cursor-default")}
            >
              <span
                className={clsx(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition",
                  done && "border-floor bg-floor text-[#1A0E00]",
                  active && "border-floor bg-floor-soft text-floor",
                  !done && !active && "border-line-strong text-ink-3"
                )}
              >
                {done ? <Check weight="bold" className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <span className={clsx("hidden truncate text-xs font-medium sm:block", active ? "text-ink" : done ? "text-ink-2 group-hover:text-ink" : "text-ink-3")}>{s}</span>
            </button>
            {i < steps.length - 1 && <span className={clsx("h-px flex-1 rounded", done ? "bg-floor/60" : "bg-line-strong")} aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}

/** Vertical checklist of wallet actions, e.g. Get test tokens -> Allow USDT -> Confirm. */
export function ActionChecklist({ items }: { items: { label: string; detail?: string; state: "done" | "active" | "todo" }[] }) {
  return (
    <ol className="space-y-2">
      {items.map((it, i) => (
        <li key={it.label} className={clsx("flex items-start gap-3 rounded-2xl border px-4 py-3 transition", it.state === "active" ? "border-floor/40 bg-floor-soft" : "border-line bg-surface-2")}>
          <span
            className={clsx(
              "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
              it.state === "done" && "bg-held text-[#00140B]",
              it.state === "active" && "bg-floor text-[#1A0E00]",
              it.state === "todo" && "border border-line-strong text-ink-3"
            )}
            aria-hidden
          >
            {it.state === "done" ? <Check weight="bold" className="h-3.5 w-3.5" /> : i + 1}
          </span>
          <div className="min-w-0">
            <div className={clsx("text-sm font-medium", it.state === "todo" ? "text-ink-3" : "text-ink")}>
              {it.label}
              {it.state === "done" && <span className="ml-2 text-xs font-normal text-held">done</span>}
            </div>
            {it.detail && it.state !== "done" && <div className="mt-0.5 text-xs leading-relaxed text-ink-2">{it.detail}</div>}
          </div>
        </li>
      ))}
    </ol>
  );
}
