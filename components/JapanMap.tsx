"use client";

// Clean Japan map — labels on the map, each radiating in its own direction
// so they don't crowd. Routes between cities use curved bezier paths.

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CITIES, type City } from "@/lib/levels";
import {
  loadProgress,
  resetProgress,
  progressSummary,
  type Progress,
} from "@/lib/progress";
import {
  CITY_COORDS,
  JAPAN_H,
  JAPAN_PATH,
  JAPAN_W,
} from "@/lib/japan-data";
import { HankoSeal } from "./HankoSeal";

type CityState = "locked" | "current" | "complete" | "comingSoon";

function coordsOf(city: City): { x: number; y: number } {
  return CITY_COORDS[city.id] || city.mapPosition;
}

// --- Label placement — absolute positions to avoid the Kansai cluster jam
// Tokyo + Hokkaido sit close to their dots; Kanazawa/Kyoto/Osaka are stacked
// in the left margin with longer leader lines so they don't pile on each
// other (the three cities are within 100px of each other on Honshu).

type LabelPos = {
  x: number;
  y: number;
  anchor: "start" | "middle" | "end";
};

const LABEL_POS: Record<string, LabelPos> = {
  tokyo:    { x: 740, y: 449, anchor: "start" },
  hokkaido: { x: 780, y: 105, anchor: "start" },
  kanazawa: { x: 245, y: 310, anchor: "end" },
  kyoto:    { x: 245, y: 445, anchor: "end" },
  osaka:    { x: 245, y: 565, anchor: "end" },
};

// --- Curve math ------------------------------------------------------------

/**
 * Build a quadratic-bezier SVG path between two points, bulging perpendicular
 * to the AB line. Bulge is a fraction of the segment length. Sign of bulge
 * picks which side to arc to (positive = clockwise from A→B).
 */
function arcPath(
  a: { x: number; y: number },
  b: { x: number; y: number },
  bulge: number
): string {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return `M ${a.x} ${a.y}`;
  const nx = -dy / len;
  const ny = dx / len;
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const cx = mx + nx * len * bulge;
  const cy = my + ny * len * bulge;
  return `M ${a.x} ${a.y} Q ${cx} ${cy}, ${b.x} ${b.y}`;
}

// Per-route bulge — direction + amount. Empirically tuned.
// Shinkansen segments stay gentle; flights arc more dramatically.
const ROUTE_BULGE: number[] = [
  0.12,  // Tokyo → Kyoto (Tokaido — gentle southward bulge)
  -0.4,  // Kyoto → Osaka (short — small bulge)
  -0.35, // Osaka → Hokkaido (flight — big arc east over the Pacific)
  -0.35, // Hokkaido → Kanazawa (flight — big arc west over the Sea of Japan)
];

const ROUTE_IS_FLIGHT: boolean[] = [false, false, true, true];

// --- State helpers ---------------------------------------------------------

function cityStates(progress: Progress): Record<string, CityState> {
  const result: Record<string, CityState> = {};
  let foundCurrent = false;
  for (const c of CITIES) {
    if (c.levels.length === 0) {
      result[c.id] = "comingSoon";
      continue;
    }
    const allDone = c.levels.every((l) => progress.completed.includes(l.id));
    if (allDone) {
      result[c.id] = "complete";
    } else if (!foundCurrent) {
      result[c.id] = "current";
      foundCurrent = true;
    } else {
      result[c.id] = "locked";
    }
  }
  return result;
}

function nextLevelOf(city: City, progress: Progress) {
  return city.levels.find((l) => !progress.completed.includes(l.id)) || city.levels[0];
}

// --- Main component --------------------------------------------------------

export function JapanMap() {
  const [progress, setProgress] = useState<Progress>({ completed: [] });
  const [mounted, setMounted] = useState(false);
  const [recentlyCompleted, setRecentlyCompleted] = useState<string | null>(null);
  const [selectedCityId, setSelectedCityId] = useState<string | null>(null);

  useEffect(() => {
    setProgress(loadProgress());
    setMounted(true);
    if (typeof window !== "undefined") {
      const just = window.sessionStorage.getItem("tanmatsu:justCompleted");
      if (just) {
        setRecentlyCompleted(just);
        window.sessionStorage.removeItem("tanmatsu:justCompleted");
      }
    }
  }, []);

  const states = useMemo(() => cityStates(progress), [progress]);
  const { sealed, total } = progressSummary(progress);

  const activeCity = useMemo(() => {
    if (selectedCityId) {
      const c = CITIES.find((c) => c.id === selectedCityId);
      if (c && states[c.id] !== "locked" && states[c.id] !== "comingSoon") return c;
    }
    return (
      CITIES.find(
        (c) => states[c.id] !== "complete" && states[c.id] !== "comingSoon"
      ) ||
      CITIES.find((c) => c.levels.length > 0) ||
      CITIES[0]
    );
  }, [selectedCityId, states]);

  function handleReset() {
    if (typeof window === "undefined") return;
    if (window.confirm("Reset all progress? This can't be undone.")) {
      resetProgress();
      setProgress({ completed: [] });
      setSelectedCityId(null);
    }
  }

  return (
    <div className="space-y-10">
      {/* Mobile: vertical city list (the SVG map's labels become unreadable
          when the viewBox scales down to phone widths) */}
      <div className="md:hidden">
        <MobileCityList
          states={states}
          progress={progress}
          mounted={mounted}
          selectedCityId={selectedCityId || activeCity.id}
          onSelect={setSelectedCityId}
          onReset={handleReset}
          sealed={sealed}
          total={total}
        />
      </div>

      {/* Desktop / tablet: full SVG map */}
      <div
        className="hidden md:block relative w-full rounded-[3px] overflow-hidden border border-ink-10"
        style={{ background: "var(--color-paper-deep)" }}
      >
        <svg
          viewBox={`0 0 ${JAPAN_W} ${JAPAN_H}`}
          className="w-full h-auto block"
          aria-label="Map of Japan with the Tanmatsu route"
        >
          <defs>
            <pattern
              id="map-waves"
              x={0}
              y={0}
              width={70}
              height={26}
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 0 16 Q 10 10, 20 16 T 40 16 T 60 16 T 84 16"
                fill="none"
                stroke="var(--color-indigo)"
                strokeWidth={0.9}
                strokeOpacity={0.5}
                strokeLinecap="round"
              />
              <path
                d="M 6 22 Q 14 20, 22 22 T 38 22 T 54 22 T 68 22"
                fill="none"
                stroke="var(--color-indigo)"
                strokeWidth={0.6}
                strokeOpacity={0.28}
                strokeLinecap="round"
              />
            </pattern>

            <filter id="land-shadow" x="-3%" y="-3%" width="106%" height="106%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="2" />
              <feOffset dy="1.5" />
              <feComponentTransfer>
                <feFuncA type="linear" slope="0.22" />
              </feComponentTransfer>
              <feMerge>
                <feMergeNode />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Ocean wave texture */}
          <rect width={JAPAN_W} height={JAPAN_H} fill="url(#map-waves)" opacity={0.22} />

          {/* Land mass */}
          <g filter="url(#land-shadow)">
            <path d={JAPAN_PATH} fill="var(--color-paper-warm)" />
          </g>
          <path
            d={JAPAN_PATH}
            fill="none"
            stroke="var(--color-brush)"
            strokeWidth={1.2}
            strokeOpacity={0.6}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* ROUTE LINES — curved beziers between successive cities */}
          {CITIES.map((from, i) => {
            const to = CITIES[i + 1];
            if (!to) return null;
            const a = coordsOf(from);
            const b = coordsOf(to);
            const fromComplete = states[from.id] === "complete";
            const isFlight = ROUTE_IS_FLIGHT[i];
            const bulge = ROUTE_BULGE[i];
            const d = arcPath(a, b, bulge);

            return (
              <g key={`route-${from.id}`}>
                {/* halo */}
                <path
                  d={d}
                  fill="none"
                  stroke={fromComplete ? "var(--color-seal)" : "var(--color-brush)"}
                  strokeOpacity={fromComplete ? 0.18 : 0.06}
                  strokeWidth={isFlight ? 4 : 6}
                  strokeLinecap="round"
                />
                {/* main brushstroke */}
                <motion.path
                  d={d}
                  fill="none"
                  stroke={fromComplete ? "var(--color-seal)" : "var(--color-brush)"}
                  strokeWidth={isFlight ? 1.4 : 1.8}
                  strokeDasharray={isFlight ? "5 7" : undefined}
                  strokeLinecap="round"
                  strokeOpacity={fromComplete ? 0.92 : 0.4}
                  initial={
                    recentlyCompleted === from.id
                      ? { pathLength: 0, opacity: 0 }
                      : false
                  }
                  animate={
                    recentlyCompleted === from.id
                      ? { pathLength: 1, opacity: fromComplete ? 0.92 : 0.4 }
                      : {}
                  }
                  transition={{ duration: 1.5, ease: "easeInOut", delay: 0.3 }}
                />
              </g>
            );
          })}

          {/* LABELS — each in its own direction with a short curved tick */}
          {CITIES.map((city, i) => {
            const state = mounted ? states[city.id] : "locked";
            const sealedHere = city.levels.filter((l) =>
              progress.completed.includes(l.id)
            ).length;
            const isNewlyUnlocked =
              !!recentlyCompleted &&
              CITIES[CITIES.findIndex((c) => c.id === recentlyCompleted) + 1]?.id ===
                city.id;
            return (
              <CityMarker
                key={city.id}
                city={city}
                index={i + 1}
                pos={coordsOf(city)}
                state={state}
                sealedHere={sealedHere}
                selected={selectedCityId === city.id}
                isNewlyUnlocked={isNewlyUnlocked}
                onSelect={() => {
                  if (state !== "locked" && state !== "comingSoon")
                    setSelectedCityId(city.id);
                }}
              />
            );
          })}
        </svg>

        <div className="absolute left-4 bottom-3 flex items-center gap-3 text-[11px] text-ink-50 font-mono uppercase tracking-[0.18em]">
          <span suppressHydrationWarning>
            {mounted ? `${sealed} / ${total} sealed` : `${total} levels`}
          </span>
        </div>
        {mounted && sealed > 0 && (
          <button
            type="button"
            onClick={handleReset}
            className="absolute right-4 bottom-3 text-[11px] text-ink-30 hover:text-seal font-mono uppercase tracking-[0.18em] transition-colors"
          >
            reset journey
          </button>
        )}
      </div>

      <CityPanel
        city={activeCity}
        progress={progress}
        mounted={mounted}
        state={mounted ? states[activeCity.id] : "locked"}
      />
    </div>
  );
}

// --- City marker (dot + tick + label) -------------------------------------

function CityMarker({
  city,
  index,
  pos,
  state,
  sealedHere,
  selected,
  isNewlyUnlocked,
  onSelect,
}: {
  city: City;
  index: number;
  pos: { x: number; y: number };
  state: CityState;
  sealedHere: number;
  selected: boolean;
  isNewlyUnlocked: boolean;
  onSelect: () => void;
}) {
  const isComplete = state === "complete";
  const isCurrent = state === "current";
  const isLocked = state === "locked" || state === "comingSoon";
  const isClickable = !isLocked;

  const lp = LABEL_POS[city.id];
  if (!lp) return null;

  // Where the leader line should terminate (a few px before the text edge)
  const tickEndX =
    lp.anchor === "end" ? lp.x + 8 : lp.anchor === "start" ? lp.x - 8 : lp.x;
  const tickEndY = lp.y - 4;

  const radius = 10;

  // Colors
  const dotFill = isComplete ? "var(--color-seal)" : "var(--color-paper)";
  const dotStroke = isComplete
    ? "var(--color-seal-deep)"
    : isCurrent
      ? "var(--color-seal)"
      : "var(--color-ink-30)";
  const numColor = isComplete
    ? "var(--color-paper)"
    : isCurrent
      ? "var(--color-seal)"
      : "var(--color-ink-50)";
  const nameColor = isLocked ? "var(--color-ink-30)" : "var(--color-ink)";
  const tickColor = isComplete
    ? "var(--color-seal)"
    : isCurrent
      ? "var(--color-seal)"
      : "var(--color-brush)";

  const statusText =
    state === "comingSoon"
      ? "coming soon"
      : state === "locked"
        ? "locked"
        : isComplete
          ? `${sealedHere}/${city.levels.length} · sealed`
          : isCurrent
            ? `${sealedHere}/${city.levels.length} · current`
            : `${sealedHere}/${city.levels.length}`;

  // Leader line: curved path from dot edge to label anchor.
  // The longer the line, the gentler the curl.
  const tickD = (() => {
    const dx = tickEndX - pos.x;
    const dy = tickEndY - pos.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const startX = pos.x + (dx / len) * (radius + 1);
    const startY = pos.y + (dy / len) * (radius + 1);
    const mx = (startX + tickEndX) / 2;
    const my = (startY + tickEndY) / 2;
    const nx = -dy / len;
    const ny = dx / len;
    // Curl amount scales with distance, but capped so long lines stay subtle
    const curl = Math.min(len * 0.05, 8);
    const cx = mx + nx * curl;
    const cy = my + ny * curl;
    return `M ${startX} ${startY} Q ${cx} ${cy}, ${tickEndX} ${tickEndY}`;
  })();

  // Halo text style — white outline for legibility on the textured map
  const haloStyle = {
    paintOrder: "stroke" as const,
    stroke: "var(--color-paper-warm)",
    strokeWidth: 3,
    strokeLinejoin: "round" as const,
  };

  return (
    <motion.g
      style={{ cursor: isClickable ? "pointer" : "default" }}
      onClick={isClickable ? onSelect : undefined}
      role="button"
      aria-label={`${city.name} ${city.nameJa}`}
      initial={isNewlyUnlocked ? { opacity: 0 } : false}
      animate={isNewlyUnlocked ? { opacity: 1 } : {}}
      transition={isNewlyUnlocked ? { delay: 1.5, duration: 0.5 } : {}}
    >
      {/* pulse for current */}
      {isCurrent && (
        <motion.circle
          cx={pos.x}
          cy={pos.y}
          r={radius}
          fill="none"
          stroke="var(--color-seal)"
          strokeWidth={1.4}
          initial={{ scale: 1, opacity: 0.55 }}
          animate={{ scale: 2.6, opacity: 0 }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeOut" }}
          style={{ transformOrigin: `${pos.x}px ${pos.y}px` }}
        />
      )}

      {/* tick line */}
      <path
        d={tickD}
        fill="none"
        stroke={tickColor}
        strokeWidth={0.9}
        strokeOpacity={isLocked ? 0.3 : 0.55}
        strokeLinecap="round"
      />

      {/* dot */}
      <motion.circle
        cx={pos.x}
        cy={pos.y}
        r={radius}
        fill={dotFill}
        stroke={dotStroke}
        strokeWidth={1.6}
        initial={isNewlyUnlocked ? { scale: 0.3, opacity: 0 } : false}
        animate={isNewlyUnlocked ? { scale: 1, opacity: 1 } : {}}
        transition={
          isNewlyUnlocked
            ? { delay: 1.7, type: "spring", stiffness: 280, damping: 14 }
            : {}
        }
        style={{ transformOrigin: `${pos.x}px ${pos.y}px` }}
      />

      {/* number inside dot */}
      <text
        x={pos.x}
        y={pos.y + 4}
        textAnchor="middle"
        className="font-mincho"
        style={{
          fontSize: "12px",
          fontWeight: 600,
          fill: numColor,
          pointerEvents: "none",
        }}
      >
        {index}
      </text>

      {/* selection ring */}
      {selected && !isLocked && (
        <circle
          cx={pos.x}
          cy={pos.y}
          r={radius + 5}
          fill="none"
          stroke="var(--color-ink)"
          strokeWidth={0.8}
          opacity={0.5}
        />
      )}

      {/* LABEL TEXT — three stacked lines with paper halo */}
      <g style={{ pointerEvents: "none" }}>
        {/* tiny tick at the label end where the leader line meets the text */}
        <circle
          cx={tickEndX}
          cy={tickEndY + 4}
          r={1.5}
          fill={tickColor}
          opacity={isLocked ? 0.3 : 0.55}
        />
        <text
          x={lp.x}
          y={lp.y}
          textAnchor={lp.anchor}
          className="font-mincho"
          style={{
            ...haloStyle,
            fontSize: "15px",
            fill: nameColor,
            fontWeight: isCurrent || isComplete ? 500 : 400,
          }}
        >
          {city.name}
        </text>
        <text
          x={lp.x}
          y={lp.y + 14}
          textAnchor={lp.anchor}
          className="font-mincho"
          style={{
            ...haloStyle,
            fontSize: "11px",
            fill: isLocked ? "var(--color-ink-30)" : "var(--color-ink-50)",
          }}
        >
          {city.nameJa}
        </text>
        <text
          x={lp.x}
          y={lp.y + 28}
          textAnchor={lp.anchor}
          className="font-mono"
          style={{
            ...haloStyle,
            fontSize: "8.5px",
            fill: isCurrent
              ? "var(--color-seal)"
              : isComplete
                ? "var(--color-ink-50)"
                : "var(--color-ink-30)",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}
        >
          {statusText}
        </text>
      </g>
    </motion.g>
  );
}

// --- The level list panel (unchanged from before) -------------------------

function CityPanel({
  city,
  progress,
  mounted,
  state,
}: {
  city: City;
  progress: Progress;
  mounted: boolean;
  state: CityState;
}) {
  const isLocked = state === "locked";
  const isComingSoon = state === "comingSoon";
  const nextLevel = city.levels.length > 0 ? nextLevelOf(city, progress) : null;

  return (
    <section className="border-t border-ink-10 pt-10">
      <div className="flex items-baseline justify-between mb-2 flex-wrap gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-50 mb-1">
            {city.belt} belt · {city.tagline}
          </p>
          <h2 className="font-mincho text-[34px] leading-[1.15] text-ink">
            {city.name}{" "}
            <span className="text-ink-50 text-[24px] ml-1">{city.nameJa}</span>
          </h2>
          <p className="text-[14px] text-ink-70 mt-1">{city.subtitle}</p>
        </div>
        {!isLocked && !isComingSoon && nextLevel && mounted && (
          <Link
            href={`/play/${nextLevel.id}`}
            className="font-mono text-[11px] uppercase tracking-[0.15em] bg-ink text-paper px-4 py-2.5 hover:bg-seal transition-colors"
          >
            {state === "complete"
              ? "revisit →"
              : progress.completed.length === 0
                ? "begin →"
                : "continue →"}
          </Link>
        )}
      </div>

      {isComingSoon ? (
        <p className="text-[14px] text-ink-50 italic mt-5">
          This station is being built. You&apos;ll arrive here in a future
          update — bring everything you learn between here and there.
        </p>
      ) : isLocked ? (
        <p className="text-[14px] text-ink-50 italic mt-5">
          You need to finish the previous city before the Tanmatsu stops here.
        </p>
      ) : (
        <ol className="border-b border-ink-10 mt-6">
          {city.levels.map((level) => {
            const done = mounted && progress.completed.includes(level.id);
            return (
              <li key={level.id}>
                <Link
                  href={`/play/${level.id}`}
                  className="group flex items-center gap-6 py-4 border-t border-ink-10 transition-colors hover:border-l-2 hover:border-l-seal hover:pl-3"
                >
                  <span className="font-mono text-[12px] text-ink-30 w-7 shrink-0 tabular-nums">
                    {String(level.index).padStart(2, "0")}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p
                      className={`font-mincho text-[17px] leading-[1.3] transition-colors ${
                        done
                          ? "text-ink-50 group-hover:text-ink"
                          : "text-ink group-hover:text-seal"
                      }`}
                    >
                      {level.title}
                    </p>
                    <p className="font-mono text-[10px] text-ink-50 lowercase mt-0.5">
                      teaches {level.teaches.join(", ")}
                    </p>
                  </div>
                  <AnimatePresence>
                    <span className="shrink-0 flex items-center justify-center w-[36px]">
                      {done ? (
                        <motion.span
                          initial={{ scale: 0, rotate: -20 }}
                          animate={{ scale: 1, rotate: 0 }}
                          transition={{ type: "spring", stiffness: 300, damping: 14 }}
                        >
                          <HankoSeal kanji="端" size={26} />
                        </motion.span>
                      ) : (
                        <span className="text-ink-30 font-mono text-[14px]">·</span>
                      )}
                    </span>
                  </AnimatePresence>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

// --- Mobile-only vertical city list ----------------------------------------

function MobileCityList({
  states,
  progress,
  mounted,
  selectedCityId,
  onSelect,
  onReset,
  sealed,
  total,
}: {
  states: Record<string, CityState>;
  progress: Progress;
  mounted: boolean;
  selectedCityId: string;
  onSelect: (id: string) => void;
  onReset: () => void;
  sealed: number;
  total: number;
}) {
  return (
    <div
      className="relative w-full rounded-[3px] overflow-hidden border border-ink-10"
      style={{ background: "var(--color-paper-warm)" }}
    >
      {/* header bar */}
      <div className="px-4 py-3 border-b border-ink-10 flex items-baseline justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-50">
          旅 · the route
        </p>
        <p
          className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-50"
          suppressHydrationWarning
        >
          {mounted ? `${sealed} / ${total} sealed` : `${total} levels`}
        </p>
      </div>

      <ol>
        {CITIES.map((city, i) => {
          const state = mounted ? states[city.id] : "locked";
          const sealedHere = city.levels.filter((l) =>
            progress.completed.includes(l.id)
          ).length;
          const selected = selectedCityId === city.id;
          const isComplete = state === "complete";
          const isCurrent = state === "current";
          const isLocked = state === "locked" || state === "comingSoon";
          const isClickable = !isLocked;
          const next = i < CITIES.length - 1;

          const statusText =
            state === "comingSoon"
              ? "coming soon"
              : state === "locked"
                ? "locked"
                : isComplete
                  ? `${sealedHere}/${city.levels.length} sealed`
                  : isCurrent
                    ? `${sealedHere}/${city.levels.length} · here now`
                    : `${sealedHere}/${city.levels.length}`;

          return (
            <li key={city.id}>
              <button
                type="button"
                onClick={isClickable ? () => onSelect(city.id) : undefined}
                disabled={!isClickable}
                className={`w-full flex items-center gap-4 px-4 py-4 text-left transition-colors ${next ? "border-b border-ink-10" : ""} ${
                  selected ? "bg-paper" : "hover:bg-paper"
                } ${isLocked ? "opacity-50 cursor-default" : ""}`}
              >
                {/* number marker */}
                <span
                  className="relative flex items-center justify-center w-8 h-8 rounded-full border shrink-0"
                  style={{
                    background: isComplete
                      ? "var(--color-seal)"
                      : "var(--color-paper)",
                    borderColor: isComplete
                      ? "var(--color-seal-deep)"
                      : isCurrent
                        ? "var(--color-seal)"
                        : "var(--color-ink-30)",
                    color: isComplete
                      ? "var(--color-paper)"
                      : isCurrent
                        ? "var(--color-seal)"
                        : isLocked
                          ? "var(--color-ink-30)"
                          : "var(--color-ink-50)",
                  }}
                >
                  <span className="font-mincho text-[13px] font-medium">
                    {i + 1}
                  </span>
                  {isCurrent && (
                    <span
                      aria-hidden
                      className="absolute -right-0.5 -top-0.5 w-2 h-2 rounded-full bg-seal animate-pulse"
                    />
                  )}
                </span>

                <div className="flex-1 min-w-0">
                  <p
                    className={`font-mincho text-[16px] leading-tight ${
                      isLocked ? "text-ink-50" : "text-ink"
                    }`}
                  >
                    {city.name}{" "}
                    <span className="text-ink-50 text-[12px] ml-1">
                      {city.nameJa}
                    </span>
                  </p>
                  <p
                    className="font-mono text-[9.5px] uppercase tracking-[0.15em] mt-1"
                    style={{
                      color: isCurrent
                        ? "var(--color-seal)"
                        : "var(--color-ink-50)",
                    }}
                  >
                    {city.belt} belt · {statusText}
                  </p>
                </div>

                {isComplete && <HankoSeal kanji="端" size={22} />}
                {isCurrent && (
                  <span className="font-mono text-[12px] text-seal">→</span>
                )}
              </button>
            </li>
          );
        })}
      </ol>

      {/* footer with reset */}
      {mounted && sealed > 0 && (
        <div className="px-4 py-3 border-t border-ink-10 flex justify-end">
          <button
            type="button"
            onClick={onReset}
            className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-50 hover:text-seal transition-colors"
          >
            reset journey
          </button>
        </div>
      )}
    </div>
  );
}
