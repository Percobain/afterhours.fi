import clsx from "clsx";
import type { ReactNode } from "react";

export type Tone = "floor" | "keeper" | "held" | "gap" | "muted";

const TONES: Record<Tone, string> = {
  floor: "border-floor/30 bg-floor-soft text-floor",
  keeper: "border-keeper/30 bg-keeper-soft text-keeper",
  held: "border-held/30 bg-held-soft text-held",
  gap: "border-gap/30 bg-gap-soft text-gap",
  muted: "border-line bg-surface-3 text-ink-2",
};

export function Badge({ tone = "muted", children, className, dot }: { tone?: Tone; children: ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={clsx("chip", TONES[tone], className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  );
}

export function LiveDot({ tone = "held", className }: { tone?: Tone; className?: string }) {
  const c = tone === "held" ? "bg-held" : tone === "floor" ? "bg-floor" : tone === "keeper" ? "bg-keeper" : tone === "gap" ? "bg-gap" : "bg-ink-3";
  return (
    <span className={clsx("relative inline-flex h-2 w-2", className)} aria-hidden>
      <span className={clsx("absolute inset-0 animate-pulse-ring rounded-full", c)} />
      <span className={clsx("relative h-2 w-2 rounded-full", c)} />
    </span>
  );
}
