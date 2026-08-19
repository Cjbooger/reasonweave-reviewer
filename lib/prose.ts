const TERMINAL_PUNCTUATION = /[.!?…]$/;

/** Wrap learner-authored text in curly quotes without changing its wording. */
export function quoteInline(value: string): string {
  return `“${value.trim()}”`;
}

/**
 * Wrap learner-authored text as a complete quoted sentence while avoiding
 * doubled punctuation when the learner already supplied a terminal mark.
 */
export function quoteSentence(value: string): string {
  const trimmed = value.trim();
  const sentence = TERMINAL_PUNCTUATION.test(trimmed) ? trimmed : `${trimmed}.`;
  return `“${sentence}”`;
}
