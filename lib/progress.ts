// localStorage-backed progress. Client-side only — guard window access.

import { WORLDS, type Level } from "./levels";

export type Progress = {
  completed: string[];
  startedAt?: number;
};

const KEY = "tanmatsu:progress:v1";
const EMPTY: Progress = { completed: [] };

export function loadProgress(): Progress {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.completed)) return EMPTY;
    return parsed as Progress;
  } catch {
    return EMPTY;
  }
}

function save(p: Progress) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* quota / disabled — silently degrade */
  }
}

export function markCompleted(levelId: string): Progress {
  const p = loadProgress();
  if (p.completed.includes(levelId)) return p;
  const next: Progress = {
    completed: [...p.completed, levelId],
    startedAt: p.startedAt || Date.now(),
  };
  save(next);
  return next;
}

export function isCompleted(levelId: string): boolean {
  return loadProgress().completed.includes(levelId);
}

export function resetProgress() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}

/** First uncompleted level across all worlds (or the very last if everything's done). */
export function currentLevel(progress: Progress = loadProgress()): Level {
  for (const w of WORLDS) {
    for (const l of w.levels) {
      if (!progress.completed.includes(l.id)) return l;
    }
  }
  // all done — return the final level
  const lastWorld = WORLDS[WORLDS.length - 1];
  return lastWorld.levels[lastWorld.levels.length - 1];
}

/** Total sealed and total available. */
export function progressSummary(progress: Progress = loadProgress()) {
  const total = WORLDS.reduce((sum, w) => sum + w.levels.length, 0);
  return { sealed: progress.completed.length, total };
}
