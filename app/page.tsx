import { ReasonWeaveApp } from "@/components/wonderlab-app";
import { isLiveGenerationAvailable } from "@/lib/live-generation";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const allowSeededFallback =
    process.env.WONDERLAB_ALLOW_SEEDED_FALLBACK?.toLowerCase() !== "false";
  const liveGenerationAvailable = isLiveGenerationAvailable();

  return (
    <ReasonWeaveApp
      allowSeededFallback={allowSeededFallback}
      liveGenerationAvailable={liveGenerationAvailable}
    />
  );
}
