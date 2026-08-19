function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

export function validateElevenLabsTiming(timing, cues, audioDuration) {
  invariant(
    Number.isFinite(audioDuration) && audioDuration > 0,
    "ElevenLabs narration must have a positive finite duration.",
  );
  const sourceText = cues.map((cue) => cue.text).join("\n\n");
  invariant(
    timing?.sourceText === sourceText,
    "ElevenLabs timing sourceText must exactly match the SRT cue text joined with blank lines.",
  );
  invariant(
    timing?.modelId === "eleven_multilingual_v2",
    "ElevenLabs timing must identify the eleven_multilingual_v2 model.",
  );
  invariant(
    typeof timing?.voiceId === "string" && timing.voiceId.length > 0,
    "ElevenLabs timing must identify a voiceId.",
  );
  const alignment = timing.alignment;
  invariant(
    Array.isArray(alignment?.characters) &&
      Array.isArray(alignment?.character_start_times_seconds) &&
      Array.isArray(alignment?.character_end_times_seconds),
    "ElevenLabs timing must include raw character alignment.",
  );
  invariant(
    alignment.characters.length === sourceText.length &&
      alignment.character_start_times_seconds.length === sourceText.length &&
      alignment.character_end_times_seconds.length === sourceText.length &&
      alignment.characters.join("") === sourceText,
    "ElevenLabs raw character alignment does not match the narration source text.",
  );

  const durationTolerance = 0.05;
  for (let index = 0; index < sourceText.length; index += 1) {
    const start = Number(alignment.character_start_times_seconds[index]);
    const end = Number(alignment.character_end_times_seconds[index]);
    invariant(
      Number.isFinite(start) &&
        Number.isFinite(end) &&
        start >= 0 &&
        end >= start &&
        end <= audioDuration + durationTolerance,
      `ElevenLabs raw character alignment is outside the audio duration at character ${index}.`,
    );
    if (index > 0) {
      invariant(
        start >= Number(alignment.character_start_times_seconds[index - 1]) &&
          end >= Number(alignment.character_end_times_seconds[index - 1]),
        "ElevenLabs raw character alignment is not chronological.",
      );
    }
  }

  let offset = 0;
  return cues.map((cue, cueIndex) => {
    const start = Number(alignment.character_start_times_seconds[offset]);
    const end = Number(
      alignment.character_end_times_seconds[offset + cue.text.length - 1],
    );
    invariant(
      start >= 0 && end > start && end <= audioDuration + durationTolerance,
      `ElevenLabs raw character alignment has an invalid audio span for cue ${cue.index}.`,
    );
    offset += cue.text.length;
    if (cueIndex < cues.length - 1) offset += 2;
    return { start, end };
  });
}
