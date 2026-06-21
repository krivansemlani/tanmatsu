"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { SandboxTerminal, type TerminalCommandMeta } from "./SandboxTerminal";
import { HankoSeal } from "./HankoSeal";
import {
  getLevel,
  getCityByLevelId,
  isLevelReachable,
  prereqProgress,
} from "@/lib/levels";
import { loadProgress, markCompleted } from "@/lib/progress";
import { HOME } from "@/lib/sandbox/fs";
import type { ExecResult } from "@/lib/sandbox/executor";
import type { Shell } from "@/lib/sandbox/commands";

type Props = {
  levelId: string;
  nextLevelId?: string;
};

type HistEntry = { command: string; result: ExecResult };

function buildPrompt(promptName: string) {
  return (cwd: string) => {
    const display = cwd.startsWith(HOME)
      ? "~" + cwd.slice(HOME.length)
      : cwd;
    return `\x1b[97m${promptName}\x1b[0m \x1b[90m${display}\x1b[0m \x1b[97m$\x1b[0m `;
  };
}

export function LevelView({ levelId, nextLevelId }: Props) {
  const router = useRouter();
  const [completed, setCompleted] = useState(false);
  const [hintIdx, setHintIdx] = useState(0);
  const [history, setHistory] = useState<HistEntry[]>([]);
  const completionRef = useRef<HTMLDivElement>(null);

  // Gate check — read progress, decide if this level is reachable
  const [mounted, setMounted] = useState(false);
  const [gateOk, setGateOk] = useState(true);
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  useEffect(() => {
    const p = loadProgress();
    setCompletedIds(p.completed);
    setGateOk(isLevelReachable(levelId, p.completed));
    setMounted(true);
  }, [levelId]);

  // Auto-scroll the completion banner into view when the level passes
  useEffect(() => {
    if (!completed) return;
    const t = setTimeout(() => {
      completionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 350); // wait for the spring-in animation to start
    return () => clearTimeout(t);
  }, [completed]);

  const maybeLevel = getLevel(levelId);
  if (!maybeLevel) return null;
  const level = maybeLevel;

  // Render the locked view if the gate isn't satisfied.
  if (mounted && !gateOk) {
    return <LockedLevel levelId={levelId} completedIds={completedIds} />;
  }
  const city = getCityByLevelId(level.id);
  const cityName = city?.name || level.cityId;

  // Is the next level in a different city? That's a "leg complete" moment.
  const nextLevel = nextLevelId ? getLevel(nextLevelId) : undefined;
  const isLegEnd = nextLevel && nextLevel.cityId !== level.cityId;
  const isFinale = !nextLevelId;

  function handleCommand(
    command: string,
    result: ExecResult,
    shell: Shell,
    meta: TerminalCommandMeta
  ) {
    const next: HistEntry[] = [...history, { command, result }];
    setHistory(next);
    if (completed) return;
    const passed = level.check({
      command,
      result,
      shell,
      history: next,
      shortcuts: meta.shortcuts,
    });
    if (passed) {
      setCompleted(true);
      markCompleted(level.id);
    }
  }

  function nextHint() {
    setHintIdx((i) => Math.min(i + 1, level.hints.length));
  }

  function continueClicked() {
    if (isLegEnd || isFinale) {
      if (typeof window !== "undefined") {
        // map reads + clears this on mount to play the unlock animation
        window.sessionStorage.setItem("tanmatsu:justCompleted", level.cityId);
      }
      router.push("/map");
    } else if (nextLevelId) {
      router.push(`/play/${nextLevelId}`);
    }
  }

  return (
    <div className="space-y-8">
      <div className="border-l-2 border-seal pl-[22px] pt-1 pb-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-50 mb-2.5">
          {cityName} {city?.nameJa ? `· ${city.nameJa}` : ""} · Level {level.index} of {city?.levels.length || 8}
        </p>
        <h2 className="font-mincho font-normal text-[28px] leading-[1.25] mb-3 text-ink">
          {level.title}
        </h2>
        <p className="text-[16px] leading-[1.6] text-ink-70 whitespace-pre-line">
          {level.scenario}
        </p>

        {hintIdx > 0 && (
          <ul className="mt-5 space-y-2.5 text-[14px] text-ink-70 italic">
            {level.hints.slice(0, hintIdx).map((h, i) => (
              <li key={i}>
                <span className="text-seal mr-2 not-italic">·</span>
                {h}
              </li>
            ))}
          </ul>
        )}

        {hintIdx < level.hints.length && !completed && (
          <button
            type="button"
            onClick={nextHint}
            className="mt-5 font-mono text-[11px] uppercase tracking-[0.15em] text-ink-50 hover:text-seal transition-colors"
          >
            {hintIdx === 0 ? "ask for a hint" : "ask for another hint"} →
          </button>
        )}
      </div>

      <SandboxTerminal
        key={level.id}
        initialFs={level.initialFs()}
        initialCwd={level.initialCwd}
        initialProcesses={level.initialProcesses?.()}
        onCommand={handleCommand}
        promptFor={buildPrompt(city?.promptName || "tanmatsu")}
        greeting={`${cityName.toLowerCase()} · level ${level.index} of ${city?.levels.length || 8} · ${level.title}`}
      />

      <AnimatePresence>
        {completed && (
          <motion.div
            ref={completionRef}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="pt-7 border-t border-ink-10 flex items-center gap-5 flex-wrap scroll-mt-20"
          >
            <motion.div
              initial={{ scale: 0.4, rotate: -22, opacity: 0 }}
              animate={{ scale: 1, rotate: -4, opacity: 1 }}
              transition={{
                type: "spring",
                stiffness: 320,
                damping: 16,
                delay: 0.15,
              }}
            >
              <HankoSeal kanji="端" size={56} />
            </motion.div>
            <div className="flex-1 min-w-[200px]">
              <p className="font-mincho text-[18px] leading-[1.35] text-ink mb-1">
                {level.completedMessage}
              </p>
              <p className="font-mono text-[10px] text-ink-50 uppercase tracking-[0.18em]">
                Level {level.index} · sealed
              </p>
            </div>
            {isFinale ? (
              <Link
                href="/map"
                className="font-mono text-[12px] uppercase tracking-[0.15em] bg-ink text-paper px-5 py-3 hover:bg-seal transition-colors"
              >
                journey complete →
              </Link>
            ) : isLegEnd ? (
              <button
                onClick={continueClicked}
                className="font-mono text-[12px] uppercase tracking-[0.15em] bg-ink text-paper px-5 py-3 hover:bg-seal transition-colors"
              >
                {cityName} complete · see the map →
              </button>
            ) : (
              <button
                onClick={continueClicked}
                className="font-mono text-[12px] uppercase tracking-[0.15em] bg-ink text-paper px-5 py-3 hover:bg-seal transition-colors"
              >
                next level →
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Locked-level fallback ─────────────────────────────────────────────────

function LockedLevel({
  levelId,
  completedIds,
}: {
  levelId: string;
  completedIds: string[];
}) {
  const level = getLevel(levelId);
  if (!level) return null;
  const city = getCityByLevelId(levelId);
  const { done, needed, nextRequired } = prereqProgress(levelId, completedIds);
  const remaining = needed - done;
  const isFreshVisitor = completedIds.length === 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-8"
    >
      <div className="border-l-2 border-ink-30 pl-[22px] pt-1 pb-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-50 mb-3 flex items-center gap-2">
          <span>locked</span>
          <span aria-hidden className="inline-block w-1 h-1 rounded-full bg-ink-30" />
          <span>
            {city?.name} {city?.nameJa ? `· ${city.nameJa}` : ""} · Level{" "}
            {level.index}
          </span>
        </p>
        <h2 className="font-mincho font-normal text-[34px] leading-[1.15] text-ink mb-4">
          This stop isn&apos;t open yet.
        </h2>
        <p className="text-[15px] leading-[1.6] text-ink-70 max-w-[460px]">
          {isFreshVisitor ? (
            <>
              You&apos;ve landed at <strong>{level.title}</strong> — but the
              Tanmatsu starts in Tokyo. Begin from the first stop and the route
              opens up as you go.
            </>
          ) : (
            <>
              You&apos;re trying to start <strong>{level.title}</strong>, but
              there {remaining === 1 ? "is" : "are"}{" "}
              <strong>
                {remaining} level{remaining === 1 ? "" : "s"}
              </strong>{" "}
              between here and where you left off. Finish those first — they
              teach what this level builds on.
            </>
          )}
        </p>
      </div>

      <div className="flex items-center gap-4 flex-wrap pt-2">
        {nextRequired ? (
          <Link
            href={`/play/${nextRequired.id}`}
            className="font-mono text-[12px] uppercase tracking-[0.15em] bg-ink text-paper px-5 py-3 hover:bg-seal transition-colors"
          >
            {isFreshVisitor
              ? `→ begin at Tokyo · level ${nextRequired.index}`
              : `→ continue at level ${nextRequired.index}`}
          </Link>
        ) : (
          <Link
            href="/"
            className="font-mono text-[12px] uppercase tracking-[0.15em] bg-ink text-paper px-5 py-3 hover:bg-seal transition-colors"
          >
            → back to start
          </Link>
        )}
        <Link
          href="/map"
          className="font-mono text-[12px] uppercase tracking-[0.15em] text-ink-50 hover:text-seal transition-colors"
        >
          see the map
        </Link>
      </div>

      {!isFreshVisitor && (
        <p className="font-mono text-[11px] text-ink-30 uppercase tracking-[0.18em] pt-4">
          {done} of {needed} prerequisites sealed
        </p>
      )}
    </motion.div>
  );
}
