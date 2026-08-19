import { ClientApiError } from "@/lib/client-api";

import type { RetryStage, UiError } from "./types";

export function apiError(error: unknown, retryStage: RetryStage): UiError {
  if (error instanceof ClientApiError) {
    return {
      title:
        error.code === "OPENAI_NOT_CONFIGURED" ||
        error.code === "LIVE_GENERATION_DISABLED"
          ? "Live generation is not connected yet"
          : "That step did not finish",
      message: error.message,
      retryStage,
      retryable: error.retryable,
    };
  }

  return {
    title: "ReasonWeave hit an unexpected snag",
    message:
      "Your work is still saved locally. Try again or open the complete demo quest.",
    retryStage,
    retryable: true,
  };
}
