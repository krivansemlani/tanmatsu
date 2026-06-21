// Above-the-fold illustrated scene — Fuji + sun upper-right, headline mid-left,
// mountain ridges full-width backdrop, Shinkansen on a track at the bottom.
// Each element gets its own band so nothing collides with the headline.
// Responsive: on small screens the composition tightens (smaller decorations,
// reduced min-height, simpler ridge stack) so everything fits one viewport.

import Image from "next/image";
import { MtFuji } from "./MtFuji";
import { Shinkansen } from "./Shinkansen";
import { SakuraPetals } from "./SakuraPetals";

export function TanmatsuHero() {
  return (
    <section
      className="relative w-full overflow-hidden min-h-[560px] sm:min-h-[680px] lg:min-h-[760px]"
      style={{ height: "min(100vh, 1040px)" }}
    >
      {/* ── SKY ── ambient wash, lightest at top */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, var(--color-paper-warm) 0%, var(--color-paper) 50%, var(--color-paper-deep) 100%)",
        }}
      />

      {/* ── SUN (upper right) ── faded vermillion disk */}
      <div
        aria-hidden
        className="absolute rounded-full"
        style={{
          top: "10%",
          right: "8%",
          width: "clamp(64px, 14vw, 150px)",
          height: "clamp(64px, 14vw, 150px)",
          background: "var(--color-seal)",
          opacity: 0.15,
          filter: "blur(1px)",
        }}
      />

      {/* ── FUJI (upper right, in front of the sun) ── */}
      <div
        aria-hidden
        className="absolute"
        style={{
          top: "14%",
          right: "6%",
          width: "clamp(120px, 22vw, 260px)",
        }}
      >
        <MtFuji variant="wash" width={260} />
      </div>

      {/* ── FAR MOUNTAIN RIDGE — across the bottom-third backdrop ── */}
      <svg
        viewBox="0 0 1200 200"
        preserveAspectRatio="none"
        className="absolute left-0 w-full"
        style={{ bottom: "22%", height: "clamp(80px, 18vw, 160px)" }}
        aria-hidden
      >
        <path
          d="M 0 200 L 60 150 L 150 160 L 250 110 L 340 130 L 450 95 L 560 120 L 680 105 L 800 130 L 920 110 L 1050 135 L 1200 115 L 1200 200 Z"
          fill="var(--color-indigo)"
          opacity={0.22}
        />
      </svg>

      {/* ── MID RIDGE ── */}
      <svg
        viewBox="0 0 1200 200"
        preserveAspectRatio="none"
        className="absolute left-0 w-full"
        style={{ bottom: "18%", height: "clamp(70px, 16vw, 140px)" }}
        aria-hidden
      >
        <path
          d="M 0 200 L 100 160 L 200 135 L 320 165 L 440 125 L 560 145 L 680 115 L 800 140 L 920 130 L 1040 155 L 1200 140 L 1200 200 Z"
          fill="var(--color-indigo)"
          opacity={0.45}
        />
      </svg>

      {/* ── NEAR RIDGE — darkest, frames the track ── */}
      <svg
        viewBox="0 0 1200 200"
        preserveAspectRatio="none"
        className="absolute left-0 w-full"
        style={{ bottom: "13%", height: "clamp(55px, 12vw, 110px)" }}
        aria-hidden
      >
        <path
          d="M 0 200 L 120 170 L 280 155 L 400 175 L 520 150 L 660 170 L 820 160 L 960 175 L 1200 160 L 1200 200 Z"
          fill="var(--color-indigo-deep)"
          opacity={0.78}
        />
      </svg>

      {/* ── HORIZON / TRACK LINES ── */}
      <div
        aria-hidden
        className="absolute left-0 right-0"
        style={{
          bottom: "13%",
          height: "1px",
          background:
            "linear-gradient(to right, transparent 0%, var(--color-brush) 20%, var(--color-brush) 80%, transparent 100%)",
          opacity: 0.35,
        }}
      />
      <div
        aria-hidden
        className="absolute left-0 right-0"
        style={{ bottom: "6%", height: "1px", background: "var(--color-brush)", opacity: 0.35 }}
      />
      <div
        aria-hidden
        className="absolute left-0 right-0"
        style={{ bottom: "4%", height: "1px", background: "var(--color-brush)", opacity: 0.18 }}
      />

      {/* ── SHINKANSEN — slowly traverses, hugging the bottom ── */}
      <div
        aria-hidden
        className="absolute left-0"
        style={{
          bottom: "6%",
          width: "clamp(140px, 32vw, 260px)",
          animation: "train-traverse 60s linear infinite",
          willChange: "transform",
        }}
      >
        <Shinkansen width={260} />
      </div>

      {/* ── SAKURA PETALS ── */}
      <SakuraPetals count={9} className="absolute inset-0 z-[3]" />

      {/* ── BRAND MARK ── falcon logo + wordmark, floating nav handles navigation */}
      <div className="relative z-20 max-w-[1280px] mx-auto px-5 sm:px-10 pt-5 sm:pt-6 flex items-center gap-2.5 sm:gap-3">
        <Image
          src="/logo.png"
          alt="Tanmatsu falcon mark"
          width={56}
          height={56}
          priority
          className="block w-[44px] h-[44px] sm:w-14 sm:h-14"
        />
        <div className="leading-tight">
          <span className="font-mincho font-medium text-[18px] sm:text-[22px] tracking-tight text-ink block">
            Tanmatsu
          </span>
          <span className="font-mincho text-[11px] sm:text-[13px] text-ink-50 block -mt-0.5">
            端末
          </span>
        </div>
      </div>

      {/* ── HEADLINE — middle-left, in clear airspace above the ridges ── */}
      <div
        className="absolute z-20 px-5 sm:px-10 max-w-[1280px] left-1/2 -translate-x-1/2 w-full"
        style={{ top: "30%" }}
      >
        <div className="max-w-[640px]">
          <p className="font-mono text-[10px] sm:text-[11px] uppercase tracking-[0.2em] sm:tracking-[0.22em] text-ink-50 mb-3 sm:mb-4 flex items-center gap-2 sm:gap-3">
            <span className="inline-block w-4 sm:w-6 h-px bg-ink-30" />
            <span className="hidden xs:inline">旅 · </span>
            <span>a journey through japan</span>
          </p>
          <h1 className="font-mincho font-normal leading-[1.05] tracking-[-0.015em] max-w-[15ch] mb-4 sm:mb-6 text-[clamp(34px,8vw,86px)] text-ink">
            Your trip starts<br />in&nbsp;Tokyo.
          </h1>
          <p className="text-[14px] sm:text-[17px] leading-[1.55] text-ink-70 max-w-[440px] mb-6 sm:mb-10">
            Four cities. One real shell. You learn the terminal by using it —
            actual commands, actual scenarios, no videos.
          </p>
          <a
            href="#board"
            className="inline-flex items-center gap-2 sm:gap-3 font-mono text-[10px] sm:text-[11px] uppercase tracking-[0.18em] sm:tracking-[0.22em] text-ink-50 hover:text-seal transition-colors"
          >
            <span className="inline-block animate-bounce">↓</span>
            board the tanmatsu
          </a>
        </div>
      </div>
    </section>
  );
}
