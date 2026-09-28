"use client";
import { useEffect } from "react";
import Link from "next/link";
import { BookOpenText, X } from "@phosphor-icons/react";
import { GLOSSARY, PAGE_HELP } from "@/lib/copy";

/** Right-side drawer: "Explain this page" in plain words, plus the glossary. */
export function HelpDrawer({ page, open, onClose }: { page: keyof typeof PAGE_HELP; open: boolean; onClose: () => void }) {
  const help = PAGE_HELP[page];
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", esc);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", esc);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  return (
    <>
      {open && (
        <>
          <div className="fixed inset-0 z-[60] animate-fade-in bg-black/60 backdrop-blur-sm" onClick={onClose} />
          <aside
            role="dialog"
            aria-label={help.title}
            className="scroll-thin fixed inset-y-0 right-0 z-[61] flex w-full max-w-md animate-drawer-in flex-col overflow-y-auto border-l border-line bg-surface p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-pop"
          >
            <div className="flex items-center justify-between">
              <span className="eyebrow">
                <BookOpenText weight="bold" className="h-3.5 w-3.5" /> Guide
              </span>
              <button onClick={onClose} className="rounded-xl p-2 text-ink-3 hover:bg-surface-3 hover:text-ink" aria-label="Close guide">
                <X weight="bold" className="h-5 w-5" />
              </button>
            </div>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight">{help.title}</h2>
            <ol className="mt-6 space-y-5">
              {help.steps.map((s) => (
                <li key={s.h}>
                  <div className="font-medium text-ink">{s.h}</div>
                  <p className="mt-1 text-sm leading-relaxed text-ink-2">{s.p}</p>
                </li>
              ))}
            </ol>
            <div className="mt-8 border-t border-line pt-6">
              <div className="eyebrow">Words you’ll see</div>
              <dl className="mt-4 space-y-4">
                {Object.values(GLOSSARY).map((g) => (
                  <div key={g.term}>
                    <dt className="text-sm font-medium text-ink">{g.term}</dt>
                    <dd className="mt-0.5 text-sm leading-relaxed text-ink-2">{g.short}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <Link href="/docs" onClick={onClose} className="btn-ghost mt-8 w-full">
              Read the full explainer
            </Link>
          </aside>
        </>
      )}
    </>
  );
}
