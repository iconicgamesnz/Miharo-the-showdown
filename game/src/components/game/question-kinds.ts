import type { AnswerOption, ChallengeFormat, PublicQuestion } from "@/lib/game-engine/session-state";

/**
 * Challenge format registry.
 *
 * Every renderer (TV and phone) resolves through here, so new challenge
 * formats are added as data + a control, never as a new game page.
 */
export const OPTION_LABELS = ["A", "B", "C", "D", "E", "F"];

export function optionLabel(index: number) {
  return OPTION_LABELS[index] ?? String(index + 1);
}

/** Options for a question, normalised for any supported format. */
export function questionOptions(question: PublicQuestion): AnswerOption[] {
  if ((question.type === "yeah_nah" || question.format === "yeah_nah") && question.options.length === 0) {
    return [
      { key: "yeah", text: "Yeah" },
      { key: "nah", text: "Nah" },
    ];
  }
  return question.options;
}

/** Ordering challenges are submitted explicitly, not on first tap. */
export function isOrdering(question: PublicQuestion) {
  return question.format === "ordering";
}

/** Short banner shown above the challenge on both screens. */
export function formatLabel(format: ChallengeFormat): string {
  switch (format) {
    case "which_one_is_real":
      return "Which one is real?";
    case "which_came_first":
      return "Which came first?";
    case "doesnt_belong":
      return "Which doesn't belong?";
    case "ordering":
      return "Put these in order";
    case "yeah_nah":
      return "Yeah or nah?";
    default:
      return "Take your pick";
  }
}

/** Whether this build can render the given challenge. */
export function isSupported(question: PublicQuestion) {
  return (
    question.format === "single_choice" ||
    question.format === "which_one_is_real" ||
    question.format === "doesnt_belong" ||
    question.format === "which_came_first" ||
    question.format === "ordering" ||
    question.format === "yeah_nah"
  );
}

