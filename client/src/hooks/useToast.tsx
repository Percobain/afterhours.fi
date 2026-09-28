"use client";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle, Info, WarningCircle, X } from "@phosphor-icons/react";

export type ToastKind = "info" | "success" | "error";
export interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  body?: string;
  href?: string;
}

interface Ctx {
  toast: (t: Omit<Toast, "id">) => void;
}
const ToastCtx = createContext<Ctx>({ toast: () => {} });

export function useToast() {
  return useContext(ToastCtx);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const dismiss = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), []);
  const toast = useCallback(
    (t: Omit<Toast, "id">) => {
      const id = Date.now() + Math.random();
      setItems((xs) => [...xs.slice(-3), { ...t, id }]);
      setTimeout(() => dismiss(id), t.kind === "error" ? 9000 : 6000);
    },
    [dismiss]
  );
  const value = useMemo(() => ({ toast }), [toast]);
  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4 sm:items-end sm:pr-6">
        <AnimatePresence>
          {items.map((t) => {
            const Icon = t.kind === "success" ? CheckCircle : t.kind === "error" ? WarningCircle : Info;
            const tone = t.kind === "success" ? "text-held" : t.kind === "error" ? "text-gap" : "text-keeper";
            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: -8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                transition={{ duration: 0.2 }}
                role="status"
                className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border border-line bg-surface-2/95 p-3 shadow-card backdrop-blur"
              >
                <Icon weight="duotone" className={`mt-0.5 h-4 w-4 shrink-0 ${tone}`} aria-hidden />
                <div className="min-w-0 flex-1 text-sm">
                  <div className="font-medium text-ink">{t.title}</div>
                  {t.body && <div className="mt-0.5 text-ink-2">{t.body}</div>}
                  {t.href && (
                    <a href={t.href} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-keeper underline-offset-2 hover:underline">
                      View on explorer
                    </a>
                  )}
                </div>
                <button onClick={() => dismiss(t.id)} className="rounded p-1 text-ink-3 hover:text-ink" aria-label="Dismiss">
                  <X weight="bold" className="h-3.5 w-3.5" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}
