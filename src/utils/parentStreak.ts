import { subWeeks } from 'date-fns';
import { getISOWeek, getISOWeekYear } from 'date-fns';

/** ISO week label, e.g. 2026-W01 — sorts lexicographically within a year; year is ISO week year. */
export function getISOWeekKey(date: Date): string {
  const y = getISOWeekYear(date);
  const w = getISOWeek(date);
  return `${y}-W${String(w).padStart(2, '0')}`;
}

export type ParentStreakDoc = {
  currentStreakWeeks: number;
  lastActiveWeekKey: string;
  bestStreakWeeks: number;
  updatedAt: string;
};

/**
 * When parent marks a task completed this week for the first time, advance streak.
 * Returns null if this calendar week was already counted (no write needed).
 */
export function computeNextStreakOnCompletion(
  existing: Partial<ParentStreakDoc> | undefined,
  now: Date
): ParentStreakDoc | null {
  const currentKey = getISOWeekKey(now);
  const last = existing?.lastActiveWeekKey ?? '';

  if (last === currentKey) {
    return null;
  }

  const prevKey = getISOWeekKey(subWeeks(now, 1));
  const best = existing?.bestStreakWeeks ?? 0;
  let current = existing?.currentStreakWeeks ?? 0;

  if (!last) {
    current = 1;
  } else if (last === prevKey) {
    current += 1;
  } else {
    current = 1;
  }

  const newBest = Math.max(best, current);
  return {
    currentStreakWeeks: current,
    lastActiveWeekKey: currentKey,
    bestStreakWeeks: newBest,
    updatedAt: now.toISOString(),
  };
}
