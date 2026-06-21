// Level + City system — types, checker, registry.
// A "city" is a themed set of 8 levels (formerly "world").

import type { DirNode } from "./sandbox/fs";
import type { ExecResult } from "./sandbox/executor";
import type { Process, Shell } from "./sandbox/commands";

export type CheckerContext = {
  command: string;
  result: ExecResult;
  shell: Shell;
  history: Array<{ command: string; result: ExecResult }>;
  /** Readline shortcuts the user pressed while editing this command line. */
  shortcuts: Set<string>;
};

export type Checker = (ctx: CheckerContext) => boolean;

export type Level = {
  id: string;
  cityId: string;
  index: number;
  title: string;
  scenario: string;
  hints: string[];
  teaches: string[];
  initialFs: () => DirNode;
  initialCwd: string;
  /** Optional per-level process table — defaults to the shell's defaults. */
  initialProcesses?: () => Process[];
  check: Checker;
  completedMessage: string;
};

export type Belt = "white" | "yellow" | "green" | "brown" | "black";

export type City = {
  id: string;
  name: string;        // English: "Tokyo"
  nameJa: string;      // Japanese: "東京"
  subtitle: string;    // one-line setting description
  tagline: string;     // what you'll learn here
  belt: Belt;
  promptName: string;  // shell prompt prefix: "tokyo"
  photoUrl: string;    // hero photo for the city
  mapPosition: { x: number; y: number }; // SVG coords on the Japan map (0-1000 viewbox)
  levels: Level[];
};

// --- Registry ---

import { TOKYO } from "@/content/tokyo";
import { KYOTO } from "@/content/kyoto";
import { OSAKA } from "@/content/osaka";
import { HOKKAIDO } from "@/content/hokkaido";
import { KANAZAWA } from "@/content/kanazawa";

export const CITIES: City[] = [TOKYO, KYOTO, OSAKA, HOKKAIDO, KANAZAWA];

// Back-compat aliases — call sites still use WORLDS
export const WORLDS = CITIES;

export function getCity(id: string): City | undefined {
  return CITIES.find((c) => c.id === id);
}

export function getLevel(levelId: string): Level | undefined {
  for (const c of CITIES) {
    const l = c.levels.find((lv) => lv.id === levelId);
    if (l) return l;
  }
  return undefined;
}

export function getNextLevel(levelId: string): Level | undefined {
  for (let ci = 0; ci < CITIES.length; ci++) {
    const c = CITIES[ci];
    const idx = c.levels.findIndex((lv) => lv.id === levelId);
    if (idx >= 0) {
      if (idx + 1 < c.levels.length) return c.levels[idx + 1];
      // last level of this city — return first of next city if any
      const nextCity = CITIES[ci + 1];
      return nextCity?.levels[0];
    }
  }
  return undefined;
}

export function getFirstLevel(): Level {
  return CITIES[0].levels[0];
}

export function getCityByLevelId(levelId: string): City | undefined {
  for (const c of CITIES) {
    if (c.levels.find((lv) => lv.id === levelId)) return c;
  }
  return undefined;
}

/** All levels in city, then index order — a flat journey. */
export function allLevelsInOrder(): Level[] {
  return CITIES.flatMap((c) => c.levels);
}

/**
 * A level is reachable if every earlier level (in journey order) has been
 * completed, OR the level itself has already been completed (replay).
 */
export function isLevelReachable(
  levelId: string,
  completedIds: string[]
): boolean {
  const order = allLevelsInOrder();
  const completed = new Set(completedIds);
  // already done → always replayable
  if (completed.has(levelId)) return true;
  // walk forward; the first un-completed level we hit must be THIS level
  for (const lvl of order) {
    if (lvl.id === levelId) return true; // gate passed — no earlier missing
    if (!completed.has(lvl.id)) return false; // gap before this level
  }
  return false;
}

/** Count of completed levels that come before this one in journey order. */
export function prereqProgress(
  levelId: string,
  completedIds: string[]
): { done: number; needed: number; nextRequired?: Level } {
  const order = allLevelsInOrder();
  const completed = new Set(completedIds);
  const idx = order.findIndex((l) => l.id === levelId);
  if (idx <= 0) return { done: 0, needed: 0 };
  const prereqs = order.slice(0, idx);
  const done = prereqs.filter((l) => completed.has(l.id)).length;
  const nextRequired = prereqs.find((l) => !completed.has(l.id));
  return { done, needed: prereqs.length, nextRequired };
}

// Back-compat: callers using `getWorld` keep working
export const getWorld = getCity;
