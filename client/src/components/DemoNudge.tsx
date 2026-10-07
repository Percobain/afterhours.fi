"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Play, X } from "@phosphor-icons/react";

const VIDEO_ID = "xkc_5tCGtk8";
const DISMISSED_KEY = "ahfi.demo.dismissed";
const DELAY_MS = 5000;

function dismissed(): boolean {
  try {
    return sessionStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

function markDismissed() {
  try {
    sessionStorage.setItem(DISMISSED_KEY, "1");
  } catch {
    /* storage blocked: the nudge just comes back on the next landing visit */
  }
}

/**
 * Landing-page nudge to watch the demo: a small card (a slim bar on phones) that slides in after a few seconds or the
 * first scroll. It stays after the video is watched; the close button hides it for the rest of the browser session
 * (sessionStorage). The YouTube player is only loaded once someone clicks play.
 */
export function DemoNudge() {
  const path = usePathname() ?? "/";
  const [show, setShow] = useState(false);
  const [playing, setPlaying] = useState(false);

  const onLanding = path === "/";

  useEffect(() => {
    if (!onLanding || dismissed()) return;
    const reveal = () => setShow(true);
    const t = setTimeout(reveal, DELAY_MS);
    window.addEventListener("scroll", reveal, { once: true, passive: true });
    return () => {
      clearTimeout(t);
      window.removeEventListener("scroll", reveal);
    };
  }, [onLanding]);

  useEffect(() => {
    if (!playing) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPlaying(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [playing]);

  const dismiss = () => {
    markDismissed();
    setShow(false);
  };
  const play = () => setPlaying(true);

  return (
    <>
      {show && onLanding && !playing && (
        <div
          role="dialog"
          aria-label="Watch the demo"
          className={`glass fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 flex animate-step-in items-center gap-3 rounded-2xl !bg-surface/95 p-2 pr-2 shadow-pop sm:inset-x-auto sm:right-6 sm:w-[360px] sm:p-3`}
        >
          <button
            onClick={play}
            className="group relative hidden h-[68px] w-[120px] shrink-0 overflow-hidden rounded-xl sm:block"
            aria-label="Play the demo video"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`https://i.ytimg.com/vi/${VIDEO_ID}/mqdefault.jpg`} alt="" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
            <span className="absolute inset-0 grid place-items-center bg-black/30">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-white/90 text-black">
                <Play weight="fill" className="h-4 w-4 translate-x-[1px]" />
              </span>
            </span>
          </button>
          <button onClick={play} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-floor-soft text-floor sm:hidden">
              <Play weight="fill" className="h-4 w-4 translate-x-[1px]" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-ink">Watch the demo</span>
              <span className="block text-xs text-ink-3">New here? It takes 6 min</span>
            </span>
          </button>
          <button onClick={dismiss} className="grid h-8 w-8 shrink-0 place-items-center self-start rounded-lg text-ink-3 hover:bg-surface-3 hover:text-ink" aria-label="Dismiss">
            <X weight="bold" className="h-4 w-4" />
          </button>
        </div>
      )}

      {playing && (
        <div
          className="fixed inset-0 z-[60] grid animate-fade-in place-items-center bg-black/80 p-3 backdrop-blur-sm sm:p-8"
          onClick={() => setPlaying(false)}
          role="dialog"
          aria-modal="true"
          aria-label="afterhours.fi demo video"
        >
          <div className="relative w-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setPlaying(false)}
              className="absolute -top-11 right-0 grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
              aria-label="Close video"
            >
              <X weight="bold" className="h-5 w-5" />
            </button>
            <div className="aspect-video w-full overflow-hidden rounded-2xl bg-black shadow-pop">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${VIDEO_ID}?autoplay=1&rel=0`}
                title="afterhours.fi demo"
                className="h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
