"use client";

// Floating shoji-style collapsible nav. Closed: a small 三 button in the
// top-right corner. Open: a panel slides in from the right with bilingual
// links. Stays out of the way until you reach for it.

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  currentLevel,
  loadProgress,
  progressSummary,
  resetProgress,
} from "@/lib/progress";

type Snap = {
  hasProgress: boolean;
  resumeHref: string;
  sealed: number;
  total: number;
  isComplete: boolean;
};

const EMPTY: Snap = {
  hasProgress: false,
  resumeHref: "/play",
  sealed: 0,
  total: 0,
  isComplete: false,
};

function readSnap(): Snap {
  const p = loadProgress();
  const { sealed, total } = progressSummary(p);
  if (sealed === 0) return { ...EMPTY, total };
  const lvl = currentLevel(p);
  return {
    hasProgress: true,
    resumeHref: `/play/${lvl.id}`,
    sealed,
    total,
    isComplete: sealed >= total,
  };
}

export function TanmatsuNav() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [snap, setSnap] = useState<Snap>(EMPTY);

  useEffect(() => {
    setSnap(readSnap());
    setMounted(true);
  }, []);

  // refresh on every open so progress is current
  useEffect(() => {
    if (open && mounted) setSnap(readSnap());
  }, [open, mounted]);

  // Esc to close
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function handleReset() {
    if (typeof window === "undefined") return;
    if (window.confirm("Reset all progress? This can't be undone.")) {
      resetProgress();
      setSnap(EMPTY);
      setOpen(false);
    }
  }

  return (
    <>
      {/* Trigger button — fixed top-right */}
      <motion.button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="fixed top-5 right-5 z-50 w-[42px] h-[42px] flex items-center justify-center rounded-full bg-paper border border-ink-10 hover:border-seal transition-colors"
        style={{
          boxShadow: open
            ? "0 6px 20px rgba(22,22,22,0.12)"
            : "0 2px 10px rgba(22,22,22,0.08)",
        }}
        whileTap={{ scale: 0.92 }}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
      >
        <AnimatePresence mode="wait" initial={false}>
          {open ? (
            <motion.span
              key="close"
              initial={{ rotate: -45, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 45, opacity: 0 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="font-mincho text-[16px] text-ink leading-none"
            >
              ✕
            </motion.span>
          ) : (
            <motion.span
              key="open"
              initial={{ rotate: 45, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -45, opacity: 0 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="font-mincho text-[20px] font-medium text-ink leading-none"
            >
              三
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Soft backdrop — dismisses on click */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40"
            style={{ background: "rgba(22,22,22,0.06)" }}
            onClick={() => setOpen(false)}
            aria-hidden
          />
        )}
      </AnimatePresence>

      {/* Panel — shoji slide from right */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, x: 32, scaleX: 0.94 }}
            animate={{ opacity: 1, x: 0, scaleX: 1 }}
            exit={{ opacity: 0, x: 24, scaleX: 0.96 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            style={{
              transformOrigin: "right center",
              boxShadow: "0 24px 60px -20px rgba(22,22,22,0.28)",
            }}
            className="fixed top-[72px] right-5 z-50 w-[268px] bg-paper border border-ink-10 rounded-[2px] overflow-hidden"
            role="dialog"
            aria-label="Tanmatsu navigation"
          >
            {/* Header — brand mark + status */}
            <div className="px-5 pt-5 pb-3 flex items-center gap-3">
              <motion.div
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: 0.05, ease: "easeOut" }}
                className="shrink-0"
              >
                <Image
                  src="/logo.png"
                  alt="Tanmatsu logo — peregrine falcon in dive"
                  width={56}
                  height={56}
                  className="block"
                  priority
                />
              </motion.div>
              <div className="min-w-0">
                <p className="font-mincho font-medium text-[17px] text-ink leading-tight">
                  Tanmatsu
                  <span className="text-ink-30 text-[12px] ml-2 font-normal">
                    端末
                  </span>
                </p>
                {mounted && (
                  <p className="font-mono text-[10px] text-ink-50 uppercase tracking-[0.18em] mt-1">
                    {snap.sealed} of {snap.total} sealed
                  </p>
                )}
              </div>
            </div>

            {/* Brushstroke divider (animated paint-in) */}
            <svg
              viewBox="0 0 260 6"
              className="block w-full h-[6px]"
              preserveAspectRatio="none"
              aria-hidden
            >
              <motion.path
                d="M 6 3 Q 60 2, 120 3 T 240 3"
                fill="none"
                stroke="var(--color-brush)"
                strokeWidth={1.4}
                strokeLinecap="round"
                strokeOpacity={0.5}
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
              />
            </svg>

            {/* Nav items */}
            <motion.ul
              initial="hidden"
              animate="show"
              variants={{
                hidden: {},
                show: {
                  transition: {
                    staggerChildren: 0.06,
                    delayChildren: 0.18,
                  },
                },
              }}
              className="py-2"
            >
              <NavItem
                href="/"
                en="Home"
                ja="家"
                onClose={() => setOpen(false)}
              />
              <NavItem
                href="/map"
                en="The Map"
                ja="地図"
                onClose={() => setOpen(false)}
              />
              {mounted && snap.hasProgress && (
                <NavItem
                  href={snap.resumeHref}
                  en={snap.isComplete ? "Revisit" : "Continue"}
                  ja={snap.isComplete ? "再訪" : "続ける"}
                  onClose={() => setOpen(false)}
                  accent
                />
              )}
            </motion.ul>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-ink-10 flex justify-between items-center">
              <span className="font-mono text-[10px] text-ink-30 uppercase tracking-[0.18em]">
                旅 · journey
              </span>
              {mounted && snap.hasProgress && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="font-mono text-[10px] text-ink-50 hover:text-seal uppercase tracking-[0.15em] transition-colors"
                >
                  reset
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function NavItem({
  href,
  en,
  ja,
  accent,
  onClose,
}: {
  href: string;
  en: string;
  ja: string;
  accent?: boolean;
  onClose: () => void;
}) {
  return (
    <motion.li
      variants={{
        hidden: { opacity: 0, x: 12 },
        show: { opacity: 1, x: 0 },
      }}
      transition={{ duration: 0.32, ease: "easeOut" }}
    >
      <Link
        href={href}
        onClick={onClose}
        className="group flex items-baseline justify-between px-5 py-2.5 transition-colors hover:bg-paper-warm"
      >
        <span
          className={`font-mincho text-[16px] transition-colors ${
            accent ? "text-seal" : "text-ink"
          } group-hover:text-seal`}
        >
          {en}
        </span>
        <span className="font-mincho text-[12px] text-ink-50 group-hover:text-seal transition-colors">
          {ja}
        </span>
      </Link>
    </motion.li>
  );
}
