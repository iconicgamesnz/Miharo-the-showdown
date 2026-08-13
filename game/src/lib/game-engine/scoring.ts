/**
 * Pure scoring functions for the Kiwi As engine.
 *
 * These are deliberately pure and side-effect free so they can be unit tested
 * and executed server-side only. The client never computes final scores.
 */
import { SCORING, type ManaRiskKey, MANA_RISKS } from "@/config/rounds";

/** Speed bonus decays smoothly from max to 0 across the question timer. */
export function speedBonus(
  responseMs: number,
  timerSeconds: number,
  max: number = SCORING.maxSpeedBonus,
): number {
  if (responseMs <= 0) return max;
  const ratio = Math.min(1, responseMs / (timerSeconds * 1000));
  return Math.round(max * (1 - ratio));
}

export function streakBonus(consecutiveCorrect: number): number {
  if (consecutiveCorrect < 2) return 0;
  const capped = Math.min(consecutiveCorrect, 5);
  return SCORING.streak[capped] ?? SCORING.maxStreakBonus;
}

export function standardPoints(opts: {
  correct: boolean;
  responseMs: number;
  timerSeconds: number;
  useSpeedBonus?: boolean;
  streakAfter: number;
  doubleBase?: boolean;
}): number {
  if (!opts.correct) return 0;
  const base = SCORING.baseCorrect * (opts.doubleBase ? 2 : 1);
  const speed = opts.useSpeedBonus === false ? 0 : speedBonus(opts.responseMs, opts.timerSeconds);
  return base + speed + streakBonus(opts.streakAfter);
}


export function manaPoints(risk: ManaRiskKey, correct: boolean): number {
  const def = MANA_RISKS.find((r) => r.key === risk);
  if (!def) return 0;
  return correct ? def.correct : def.wrong;
}

/** Scores can never fall below zero. */
export function applyPoints(currentScore: number, delta: number): number {
  return Math.max(0, currentScore + delta);
}

export function nextStreak(current: number, correct: boolean, protectedByCard = false): number {
  if (correct) return current + 1;
  return protectedByCard ? current : 0;
}
