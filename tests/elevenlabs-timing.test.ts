import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

const timingModuleUrl = pathToFileURL(
  path.join(process.cwd(), "scripts", "elevenlabs-timing.mjs"),
).href;

async function loadTimingModule() {
  return import(/* @vite-ignore */ timingModuleUrl);
}

function timingFixture() {
  const cues = [
    { index: 1, text: "Hello" },
    { index: 2, text: "World" },
  ];
  const sourceText = cues.map((cue) => cue.text).join("\n\n");
  const starts = [...sourceText].map((_, index) => 0.05 + index * 0.1);
  const ends = starts.map((start) => start + 0.08);
  return {
    cues,
    duration: ends.at(-1)! + 0.1,
    timing: {
      sourceText,
      modelId: "eleven_multilingual_v2",
      voiceId: "approved-built-in-voice",
      alignment: {
        characters: [...sourceText],
        character_start_times_seconds: starts,
        character_end_times_seconds: ends,
      },
    },
  };
}

describe("ElevenLabs narration timing", () => {
  it("derives cue spans only when every character stays inside the audio", async () => {
    const { validateElevenLabsTiming } = await loadTimingModule();
    const fixture = timingFixture();

    const spans = validateElevenLabsTiming(
      fixture.timing,
      fixture.cues,
      fixture.duration,
    );
    expect(spans).toHaveLength(2);
    expect(spans[0].start).toBeCloseTo(0.05);
    expect(spans[0].end).toBeCloseTo(0.53);
    expect(spans[1].start).toBeCloseTo(0.75);
    expect(spans[1].end).toBeCloseTo(1.23);
  });

  it("rejects negative provider timestamps", async () => {
    const { validateElevenLabsTiming } = await loadTimingModule();
    const fixture = timingFixture();
    fixture.timing.alignment.character_start_times_seconds[0] = -0.1;

    expect(() =>
      validateElevenLabsTiming(fixture.timing, fixture.cues, fixture.duration),
    ).toThrow(/outside the audio duration at character 0/i);
  });

  it("rejects provider timestamps beyond the MP3 duration", async () => {
    const { validateElevenLabsTiming } = await loadTimingModule();
    const fixture = timingFixture();
    fixture.timing.alignment.character_end_times_seconds[
      fixture.timing.alignment.character_end_times_seconds.length - 1
    ] = fixture.duration + 0.2;

    expect(() =>
      validateElevenLabsTiming(fixture.timing, fixture.cues, fixture.duration),
    ).toThrow(/outside the audio duration/i);
  });
});
