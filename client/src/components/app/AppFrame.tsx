"use client";
import { useState, type ReactNode } from "react";
import { Question } from "@phosphor-icons/react";
import clsx from "clsx";
import type { PAGE_HELP } from "@/lib/copy";
import { HelpDrawer } from "@/components/ui/HelpDrawer";
import { WeekendBar } from "@/components/ui/WeekendBar";
import { GettingStarted } from "@/components/onboarding/GettingStarted";
import { NetworkGate } from "./NetworkGate";

/**
 * Every app page has the same frame: a title that says what the page is for in one sentence,
 * an "Explain this page" button, the page content, and a right rail with the weekend timer and the guide.
 */
export function AppFrame({
  page,
  eyebrow,
  title,
  subtitle,
  children,
  accent = "floor",
  wide = false,
}: {
  page: keyof typeof PAGE_HELP;
  eyebrow: string;
  title: ReactNode;
  subtitle: ReactNode;
  children: ReactNode;
  accent?: "floor" | "keeper";
  wide?: boolean;
}) {
  const [help, setHelp] = useState(false);
  return (
    <div className="relative">
      <div className={clsx("pointer-events-none absolute inset-x-0 top-0 h-[420px] opacity-60", accent === "floor" ? "bg-[radial-gradient(60%_60%_at_30%_0%,rgba(255,138,61,0.14),transparent)]" : "bg-[radial-gradient(60%_60%_at_30%_0%,rgba(92,200,255,0.14),transparent)]")} aria-hidden />
      <div className="container relative pb-10 pt-8 sm:pt-12 lg:pb-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <div className={clsx("eyebrow", accent === "floor" ? "text-floor" : "text-keeper")}>{eyebrow}</div>
            <h1 className="mt-2 text-display-3 text-ink">{title}</h1>
            <p className="mt-2 text-base leading-relaxed text-ink-2">{subtitle}</p>
          </div>
          <button type="button" onClick={() => setHelp(true)} className="btn-soft !h-10 !rounded-xl">
            <Question weight="bold" className="h-4 w-4" /> Explain this page
          </button>
        </div>

        <div className={clsx("mt-8 grid grid-cols-1 gap-6", wide ? "lg:grid-cols-[minmax(0,1fr)_340px]" : "lg:grid-cols-[minmax(0,560px)_minmax(0,1fr)] xl:grid-cols-[minmax(0,600px)_minmax(0,1fr)]")}>
          <div className="min-w-0">
            <NetworkGate>{children}</NetworkGate>
          </div>
          <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <WeekendBar compact={false} />
            <GettingStarted />
          </aside>
        </div>
      </div>
      <HelpDrawer page={page} open={help} onClose={() => setHelp(false)} />
    </div>
  );
}
