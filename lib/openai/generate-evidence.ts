import { zodTextFormat } from "openai/helpers/zod";
import type {
  ParsedResponse,
  ResponseOutputText,
} from "openai/resources/responses/responses";
import { z } from "zod";

import { ApiError } from "@/lib/api-errors";
import { evidenceBundleSchema } from "@/lib/schemas";
import {
  assertBrowserSafeActivity,
  assertSafetyIdentifier,
} from "@/lib/safety";
import type {
  EvidenceBundle,
  EvidenceKind,
  EvidenceRequest,
  SourceReference,
} from "@/types/curiosity";

import {
  assertModelProseComplete,
  getOpenAIClient,
  getOpenAIModel,
  parseModelResult,
  requireParsedOutput,
  responseDefaults,
  responseTextDefaults,
  withModelOutputRetry,
} from "./client";
import { buildEvidencePrompt, REASONWEAVE_SYSTEM_PROMPT } from "./prompts";

export const MAX_EVIDENCE_VISIBLE_WORDS = 450;

const modelEvidenceItemSchema = z.object({
  kind: z.enum(["evidence", "inference", "open_question"]),
  statement: z.string().min(15).max(420),
  citationUrls: z.array(z.string().min(8).max(2_048)).max(3),
});

const modelEvidenceSchema = z.object({
  items: z.array(modelEvidenceItemSchema).min(2).max(4),
  uncertaintyNote: z.string().min(8).max(320).nullable(),
});

interface CitationRecord {
  citation: ResponseOutputText.URLCitation;
  sourceId: string;
}

interface SerializedItemRange {
  start: number;
  end: number;
}

export interface NormalizedEvidenceItem {
  id: string;
  kind: EvidenceKind;
  statement: string;
  sourceIds: string[];
}

export interface NormalizedEvidenceResult {
  items: NormalizedEvidenceItem[];
  sources: SourceReference[];
}

function normalizedUrlKey(value: string): string | undefined {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;
    url.hash = "";
    const normalized = url.href.replace(/\/$/, "");
    return normalized;
  } catch {
    return undefined;
  }
}

function sourceFromUrl(
  value: string,
  id: string,
  title: string,
): SourceReference | undefined {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;
    const domain = url.hostname.replace(/^www\./, "");
    if (domain.length > 120) return undefined;
    return {
      id,
      title: (title.trim() || domain).slice(0, 180),
      url: value,
      domain,
    };
  } catch {
    return undefined;
  }
}

function collectCitationAnnotations<T>(
  response: ParsedResponse<T>,
): ResponseOutputText.URLCitation[] {
  const messages = response.output.filter(
    (
      output,
    ): output is Extract<
      (typeof response.output)[number],
      { type: "message" }
    > => output.type === "message",
  );
  if (messages.length !== 1) return [];

  const outputTextBlocks = messages[0].content.filter(
    (
      content,
    ): content is Extract<
      (typeof messages)[number]["content"][number],
      { type: "output_text" }
    > => content.type === "output_text",
  );
  if (
    outputTextBlocks.length !== 1 ||
    outputTextBlocks[0].text !== response.output_text
  ) {
    return [];
  }

  return outputTextBlocks[0].annotations.filter(
    (annotation): annotation is ResponseOutputText.URLCitation =>
      annotation.type === "url_citation",
  );
}

function hasUnambiguousOutputText<T>(response: ParsedResponse<T>): boolean {
  const messages = response.output.filter(
    (
      output,
    ): output is Extract<
      (typeof response.output)[number],
      { type: "message" }
    > => output.type === "message",
  );
  if (messages.length !== 1) return false;

  const outputTextBlocks = messages[0].content.filter(
    (
      content,
    ): content is Extract<
      (typeof messages)[number]["content"][number],
      { type: "output_text" }
    > => content.type === "output_text",
  );
  return (
    outputTextBlocks.length === 1 &&
    outputTextBlocks[0].text === response.output_text
  );
}

function hasAnyUrlCitationAnnotations<T>(response: ParsedResponse<T>): boolean {
  return response.output.some(
    (output) =>
      output.type === "message" &&
      output.content.some(
        (content) =>
          content.type === "output_text" &&
          content.annotations.some(
            (annotation) => annotation.type === "url_citation",
          ),
      ),
  );
}

function completedWebSearchSourceUrls<T>(
  response: ParsedResponse<T>,
): string[] {
  if (
    !hasUnambiguousOutputText(response) ||
    hasAnyUrlCitationAnnotations(response)
  ) {
    return [];
  }

  return response.output.flatMap((output) => {
    if (
      output.type !== "web_search_call" ||
      output.status !== "completed" ||
      output.action.type !== "search"
    ) {
      return [];
    }
    return (output.action.sources ?? []).map((source) => source.url);
  });
}

function collectCitations(
  citations: readonly ResponseOutputText.URLCitation[],
): {
  records: CitationRecord[];
  sources: SourceReference[];
} {
  const records: CitationRecord[] = [];
  const sources: SourceReference[] = [];
  const sourceIdsByUrl = new Map<string, string>();

  for (const citation of citations) {
    const key = normalizedUrlKey(citation.url);
    if (!key) continue;

    let sourceId = sourceIdsByUrl.get(key);
    if (!sourceId) {
      sourceId = `source-${sources.length + 1}`;
      const source = sourceFromUrl(citation.url, sourceId, citation.title);
      if (!source) continue;
      sourceIdsByUrl.set(key, sourceId);
      sources.push(source);
    }

    records.push({ citation, sourceId });
  }

  return { records, sources };
}

function collectProviderSources(providerUrls: readonly string[]): {
  sourceIdsByUrl: Map<string, string>;
  sources: SourceReference[];
} {
  const sourceIdsByUrl = new Map<string, string>();
  const sources: SourceReference[] = [];

  for (const providerUrl of providerUrls) {
    const key = normalizedUrlKey(providerUrl);
    if (!key || sourceIdsByUrl.has(key)) continue;
    const sourceId = `source-${sources.length + 1}`;
    const source = sourceFromUrl(providerUrl, sourceId, "");
    if (!source) continue;
    sourceIdsByUrl.set(key, sourceId);
    sources.push(source);
  }

  return { sourceIdsByUrl, sources };
}

function skipWhitespace(text: string, index: number): number {
  while (index < text.length && /\s/.test(text[index])) index += 1;
  return index;
}

function consumeJsonString(text: string, start: number): number | undefined {
  if (text[start] !== '"') return undefined;

  for (let index = start + 1; index < text.length; index += 1) {
    if (text[index] === "\\") {
      index += 1;
      continue;
    }
    if (text[index] === '"') return index + 1;
  }

  return undefined;
}

function consumeJsonValue(text: string, start: number): number | undefined {
  const first = text[start];
  if (!first) return undefined;
  if (first === '"') return consumeJsonString(text, start);

  if (first !== "{" && first !== "[") {
    let end = start;
    while (end < text.length && !/[\s,}\]]/.test(text[end])) end += 1;
    return end > start ? end : undefined;
  }

  const expectedCloser = first === "{" ? "}" : "]";
  const stack = [expectedCloser];
  for (let index = start + 1; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      const stringEnd = consumeJsonString(text, index);
      if (stringEnd === undefined) return undefined;
      index = stringEnd - 1;
      continue;
    }
    if (character === "{") stack.push("}");
    if (character === "[") stack.push("]");
    if (character === "}" || character === "]") {
      if (stack.pop() !== character) return undefined;
      if (stack.length === 0) return index + 1;
    }
  }

  return undefined;
}

function serializedStatementRange(
  text: string,
  start: number,
  end: number,
): SerializedItemRange | undefined {
  if (text[start] !== "{" || text[end - 1] !== "}") return undefined;

  const keys = new Set<string>();
  let statementRange: SerializedItemRange | undefined;
  let index = start + 1;
  while (true) {
    index = skipWhitespace(text, index);
    if (text[index] === "}") {
      return index + 1 === end &&
        keys.size === 3 &&
        keys.has("kind") &&
        keys.has("statement") &&
        keys.has("citationUrls")
        ? statementRange
        : undefined;
    }

    const keyStart = index;
    const keyEnd = consumeJsonString(text, keyStart);
    if (keyEnd === undefined) return undefined;
    let key: unknown;
    try {
      key = JSON.parse(text.slice(keyStart, keyEnd));
    } catch {
      return undefined;
    }
    if (
      typeof key !== "string" ||
      keys.has(key) ||
      !["kind", "statement", "citationUrls"].includes(key)
    ) {
      return undefined;
    }
    keys.add(key);

    index = skipWhitespace(text, keyEnd);
    if (text[index] !== ":") return undefined;
    index = skipWhitespace(text, index + 1);
    const valueStart = index;
    const valueEnd = consumeJsonValue(text, index);
    if (valueEnd === undefined) return undefined;
    if (key === "statement") {
      if (text[valueStart] !== '"') return undefined;
      statementRange = { start: valueStart + 1, end: valueEnd - 2 };
    }
    index = skipWhitespace(text, valueEnd);
    if (text[index] === "}") continue;
    if (text[index] !== ",") return undefined;
    index += 1;
  }
}

function sameStructuredItem(
  value: unknown,
  item: z.infer<typeof modelEvidenceItemSchema>,
): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.kind === item.kind &&
    candidate.statement === item.statement &&
    Array.isArray(candidate.citationUrls) &&
    candidate.citationUrls.length === item.citationUrls.length &&
    candidate.citationUrls.every(
      (url, index) => url === item.citationUrls[index],
    )
  );
}

/**
 * Resolves the exact character spans of the model's serialized items. Citation
 * offsets are meaningful only against this original SDK text, so malformed or
 * ambiguous output deliberately produces no associations.
 */
function serializedItemRanges(
  items: readonly z.infer<typeof modelEvidenceItemSchema>[],
  outputText: string,
): SerializedItemRange[] | undefined {
  let parsedOutput: unknown;
  try {
    parsedOutput = JSON.parse(outputText);
  } catch {
    return undefined;
  }
  if (
    !parsedOutput ||
    typeof parsedOutput !== "object" ||
    Array.isArray(parsedOutput)
  ) {
    return undefined;
  }

  let index = skipWhitespace(outputText, 0);
  if (outputText[index] !== "{") return undefined;
  index += 1;

  let itemsArrayStart: number | undefined;
  let itemsArrayEnd: number | undefined;
  while (true) {
    index = skipWhitespace(outputText, index);
    if (outputText[index] === "}") break;

    const keyStart = index;
    const keyEnd = consumeJsonString(outputText, keyStart);
    if (keyEnd === undefined) return undefined;
    let key: unknown;
    try {
      key = JSON.parse(outputText.slice(keyStart, keyEnd));
    } catch {
      return undefined;
    }
    index = skipWhitespace(outputText, keyEnd);
    if (outputText[index] !== ":") return undefined;
    index = skipWhitespace(outputText, index + 1);
    const valueStart = index;
    const valueEnd = consumeJsonValue(outputText, valueStart);
    if (valueEnd === undefined) return undefined;
    if (key === "items") {
      if (itemsArrayStart !== undefined || outputText[valueStart] !== "[") {
        return undefined;
      }
      itemsArrayStart = valueStart;
      itemsArrayEnd = valueEnd;
    }
    index = skipWhitespace(outputText, valueEnd);
    if (outputText[index] === "}") break;
    if (outputText[index] !== ",") return undefined;
    index += 1;
  }

  if (itemsArrayStart === undefined || itemsArrayEnd === undefined)
    return undefined;
  const ranges: SerializedItemRange[] = [];
  index = itemsArrayStart + 1;
  while (true) {
    index = skipWhitespace(outputText, index);
    if (outputText[index] === "]") break;
    const start = index;
    const end = consumeJsonValue(outputText, start);
    if (end === undefined || outputText[start] !== "{") return undefined;
    const itemIndex = ranges.length;
    const statementRange = serializedStatementRange(outputText, start, end);
    if (itemIndex >= items.length || !statementRange) {
      return undefined;
    }
    let parsedItem: unknown;
    try {
      parsedItem = JSON.parse(outputText.slice(start, end));
    } catch {
      return undefined;
    }
    ranges.push(statementRange);
    if (!sameStructuredItem(parsedItem, items[itemIndex])) return undefined;
    index = skipWhitespace(outputText, end);
    if (outputText[index] === "]") break;
    if (outputText[index] !== ",") return undefined;
    index += 1;
  }

  return ranges.length === items.length ? ranges : undefined;
}

function isCitationWithinRange(
  citation: ResponseOutputText.URLCitation,
  range: SerializedItemRange,
): boolean {
  // The installed Responses SDK defines end_index as the index of the last
  // cited character, so ranges are inclusive at both ends.
  return (
    Number.isSafeInteger(citation.start_index) &&
    Number.isSafeInteger(citation.end_index) &&
    citation.start_index >= range.start &&
    citation.start_index <= citation.end_index &&
    citation.end_index <= range.end
  );
}

function webSearchCompleted(
  output: ParsedResponse<unknown>["output"],
): boolean {
  const searches = output.filter((entry) => entry.type === "web_search_call");
  return (
    searches.length > 0 &&
    searches.every((search) => search.status === "completed")
  );
}

type CitationDiagnosticSearchStatus =
  "completed" | "failed" | "in_progress" | "searching" | "unknown";

function citationDiagnosticSearchStatus(
  value: unknown,
): CitationDiagnosticSearchStatus {
  return value === "completed" ||
    value === "failed" ||
    value === "in_progress" ||
    value === "searching"
    ? value
    : "unknown";
}

/**
 * Evaluation-only metadata for resolving citation admission failures. This
 * deliberately excludes all learner/model text and returned source details.
 */
function logCitationDiagnostics(
  response: ParsedResponse<unknown>,
  parsedItems: readonly z.infer<typeof modelEvidenceItemSchema>[],
  normalized: NormalizedEvidenceResult,
  providerSourceUrls: readonly string[],
): void {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.WONDERLAB_EVAL_DIAGNOSTICS !== "1"
  ) {
    return;
  }

  const searches = response.output.filter(
    (entry) => entry.type === "web_search_call",
  );
  const messages = response.output.filter((entry) => entry.type === "message");
  const outputTextBlocks = messages.flatMap((message) =>
    message.content.filter((content) => content.type === "output_text"),
  );
  const totalAnnotationCount = outputTextBlocks.reduce(
    (count, block) => count + block.annotations.length,
    0,
  );
  const validUrlCitationCount = outputTextBlocks.reduce(
    (count, block) =>
      count +
      block.annotations.filter(
        (annotation) =>
          annotation.type === "url_citation" &&
          Boolean(normalizedUrlKey(annotation.url)),
      ).length,
    0,
  );
  const declaredEvidenceUrlCount = parsedItems
    .filter((item) => item.kind === "evidence")
    .reduce((count, item) => count + item.citationUrls.length, 0);
  const normalizedDeclaredUrls = new Set(
    parsedItems
      .filter((item) => item.kind === "evidence")
      .flatMap((item) => item.citationUrls.map(normalizedUrlKey))
      .filter((url): url is string => Boolean(url)),
  );
  const providerSourceUrlKeys = new Set(
    providerSourceUrls
      .map(normalizedUrlKey)
      .filter((url): url is string => Boolean(url)),
  );

  console.warn("reasonweave_citation_diagnostic", {
    webSearchCallCount: searches.length,
    webSearchStatuses: searches.map((search) =>
      citationDiagnosticSearchStatus(search.status),
    ),
    messageCount: messages.length,
    outputTextBlockCount: outputTextBlocks.length,
    outputTextMatches:
      outputTextBlocks.length === 1 &&
      outputTextBlocks[0].text === response.output_text,
    totalAnnotationCount,
    validUrlCitationCount,
    includedWebSearchSourceCount: searches.reduce((count, search) => {
      const action = search.action;
      return (
        count + (action?.type === "search" ? (action.sources?.length ?? 0) : 0)
      );
    }, 0),
    structuredItemRangesResolved: Boolean(
      serializedItemRanges(parsedItems, response.output_text),
    ),
    normalizedSourceCount: normalized.sources.length,
    evidenceItemCount: normalized.items.filter(
      (item) => item.kind === "evidence",
    ).length,
    unboundEvidenceItemCount: normalized.items.filter(
      (item) => item.kind === "evidence" && item.sourceIds.length === 0,
    ).length,
    declaredEvidenceUrlCount,
    normalizedDeclaredUrlCount: normalizedDeclaredUrls.size,
    matchedProviderSourceUrlCount: [...normalizedDeclaredUrls].filter((url) =>
      providerSourceUrlKeys.has(url),
    ).length,
    evidenceItemsMatchedByProviderSource: parsedItems.filter(
      (item) =>
        item.kind === "evidence" &&
        item.citationUrls.some((url) => {
          const key = normalizedUrlKey(url);
          return key ? providerSourceUrlKeys.has(key) : false;
        }),
    ).length,
  });
}

function sourceIdsForItem(
  item: z.infer<typeof modelEvidenceItemSchema>,
  range: SerializedItemRange | undefined,
  records: CitationRecord[],
): string[] {
  if (!range) return [];

  const localRecords = records.filter(({ citation }) =>
    isCitationWithinRange(citation, range),
  );
  const declaredUrls = item.citationUrls.map(normalizedUrlKey);
  const requestedUrls = new Set(
    declaredUrls.filter((url): url is string => Boolean(url)),
  );
  if (
    item.kind === "evidence" &&
    (declaredUrls.length === 0 ||
      requestedUrls.size !== declaredUrls.length ||
      declaredUrls.some((url) => !url))
  ) {
    return [];
  }
  const matchingRecords =
    requestedUrls.size > 0
      ? localRecords.filter(({ citation }) =>
          requestedUrls.has(normalizedUrlKey(citation.url) ?? ""),
        )
      : localRecords;

  if (
    item.kind === "evidence" &&
    ![...requestedUrls].every((url) =>
      matchingRecords.some(
        ({ citation }) => normalizedUrlKey(citation.url) === url,
      ),
    )
  ) {
    return [];
  }

  return [...new Set(matchingRecords.map(({ sourceId }) => sourceId))];
}

function sourceIdsForProviderItem(
  item: z.infer<typeof modelEvidenceItemSchema>,
  range: SerializedItemRange | undefined,
  sourceIdsByUrl: ReadonlyMap<string, string>,
): string[] {
  if (!range) return [];

  const declaredUrls = item.citationUrls.map(normalizedUrlKey);
  const requestedUrls = new Set(
    declaredUrls.filter((url): url is string => Boolean(url)),
  );
  if (
    item.kind === "evidence" &&
    (declaredUrls.length === 0 ||
      requestedUrls.size !== declaredUrls.length ||
      declaredUrls.some((url) => !url) ||
      ![...requestedUrls].every((url) => sourceIdsByUrl.has(url)))
  ) {
    return [];
  }

  return [
    ...new Set(
      [...requestedUrls]
        .map((url) => sourceIdsByUrl.get(url))
        .filter((sourceId): sourceId is string => Boolean(sourceId)),
    ),
  ];
}

function keepReferencedSources(
  items: NormalizedEvidenceItem[],
  sources: SourceReference[],
): { items: NormalizedEvidenceItem[]; sources: SourceReference[] } {
  const prioritizedIds = [
    ...items
      .filter((item) => item.kind === "evidence")
      .flatMap((item) => item.sourceIds.slice(0, 1)),
    ...items.flatMap((item) => item.sourceIds),
  ];
  const keptIds = new Set([...new Set(prioritizedIds)].slice(0, 8));

  return {
    items: items.map((item) => ({
      ...item,
      sourceIds: item.sourceIds.filter((sourceId) => keptIds.has(sourceId)),
    })),
    sources: sources.filter((source) => keptIds.has(source.id)),
  };
}

/**
 * Converts SDK-returned citations into the finite Evidence Lens shape. URL
 * annotations bind only when their full span lies within the item's serialized
 * statement. When the response has no URL annotations at all, completed web
 * search source URLs may bind only exact normalized declared URLs; they never
 * authorize an invented model URL or bypass serialized-output validation.
 */
export function normalizeEvidenceResult(
  items: readonly z.infer<typeof modelEvidenceItemSchema>[],
  outputText: string,
  citations: readonly ResponseOutputText.URLCitation[],
  providerSourceUrls: readonly string[] = [],
): NormalizedEvidenceResult {
  const { records, sources } = collectCitations(citations);
  const providerSources =
    citations.length === 0
      ? collectProviderSources(providerSourceUrls)
      : undefined;
  const ranges = serializedItemRanges(items, outputText);

  return keepReferencedSources(
    items.map((item, index) => ({
      id: `evidence-${index + 1}`,
      kind: item.kind as EvidenceKind,
      statement: item.statement,
      sourceIds: providerSources
        ? sourceIdsForProviderItem(
            item,
            ranges?.[index],
            providerSources.sourceIdsByUrl,
          )
        : sourceIdsForItem(item, ranges?.[index], records),
    })),
    providerSources ? providerSources.sources : sources,
  );
}

export function assertEvidenceCitationsAvailable(
  normalized: NormalizedEvidenceResult,
  usedWebSearch: boolean,
): void {
  if (!usedWebSearch || normalized.sources.length === 0) {
    throw new ApiError({
      code: "CITATIONS_UNAVAILABLE",
      message:
        "ReasonWeave could not verify sources for this Evidence Lens. Try again or use the demo quest.",
      status: 502,
      retryable: true,
    });
  }

  if (
    normalized.items.filter((item) => item.kind === "evidence").length < 2 ||
    normalized.items.some(
      (item) => item.kind === "evidence" && item.sourceIds.length === 0,
    )
  ) {
    throw new ApiError({
      code: "CITATIONS_UNAVAILABLE",
      message:
        "ReasonWeave could not connect every evidence claim to a returned source. Try again or use the demo quest.",
      status: 502,
      retryable: true,
    });
  }
}

export function buildValidatedEvidenceSummary(
  items: readonly NormalizedEvidenceItem[],
): string {
  const labels: Record<EvidenceKind, string> = {
    evidence: "Evidence",
    inference: "Inference",
    open_question: "Open question",
  };
  const summary = items
    .map((item) => {
      const sentence =
        item.statement.match(/^.*?[.!?](?:["'”’)\]])?(?=\s|$)/u)?.[0] ??
        item.statement;
      return `${labels[item.kind]}: ${sentence.trim()}`;
    })
    .join(" ");

  if (summary.length <= 1_450) return summary;
  const boundary = summary.lastIndexOf(" ", 1_448);
  return `${summary.slice(0, Math.max(boundary, 20)).trimEnd()}…`;
}

function wordCount(value: string): number {
  const normalized = value.trim();
  return normalized ? normalized.split(/\s+/).length : 0;
}

export function evidenceVisibleWordCount(
  bundle: Pick<
    EvidenceBundle,
    "items" | "conciseExplanation" | "uncertaintyNote"
  >,
): number {
  return wordCount(
    [
      ...bundle.items.map((item) => item.statement),
      bundle.conciseExplanation,
      bundle.uncertaintyNote ?? "",
    ].join(" "),
  );
}

export function assertEvidenceVisibleWordLimit(
  bundle: Pick<
    EvidenceBundle,
    "items" | "conciseExplanation" | "uncertaintyNote"
  >,
): void {
  if (evidenceVisibleWordCount(bundle) <= MAX_EVIDENCE_VISIBLE_WORDS) return;

  throw new ApiError({
    code: "INVALID_MODEL_RESPONSE",
    message:
      "The live evidence lens was too long for the quest. Try again or use the demo quest.",
    status: 502,
    retryable: true,
  });
}

export async function generateEvidence(
  input: EvidenceRequest,
  signal?: AbortSignal,
): Promise<EvidenceBundle> {
  assertSafetyIdentifier(input.safetyIdentifier);

  return withModelOutputRetry(async () => {
    const response = await getOpenAIClient().responses.parse(
      {
        model: getOpenAIModel(),
        instructions: REASONWEAVE_SYSTEM_PROMPT,
        input: buildEvidencePrompt(input),
        text: {
          ...responseTextDefaults,
          format: zodTextFormat(modelEvidenceSchema, "wonderlab_evidence"),
        },
        tools: [{ type: "web_search", search_context_size: "medium" }],
        tool_choice: "required",
        max_tool_calls: 3,
        include: ["web_search_call.action.sources"],
        max_output_tokens: 2_600,
        safety_identifier: input.safetyIdentifier,
        ...responseDefaults,
      },
      { signal },
    );

    const parsed = requireParsedOutput(response);
    assertModelProseComplete([
      ...parsed.items.map((item) => ({
        value: item.statement,
        maxLength: 420,
      })),
      ...(parsed.uncertaintyNote
        ? [{ value: parsed.uncertaintyNote, maxLength: 320 }]
        : []),
    ]);
    const completedWebSearch = webSearchCompleted(response.output);
    const citationAnnotations = collectCitationAnnotations(response);
    const providerSourceUrls = completedWebSearchSourceUrls(response);
    const normalized = normalizeEvidenceResult(
      parsed.items,
      response.output_text,
      citationAnnotations,
      providerSourceUrls,
    );
    try {
      assertEvidenceCitationsAvailable(normalized, completedWebSearch);
    } catch (error) {
      if (error instanceof ApiError && error.code === "CITATIONS_UNAVAILABLE") {
        logCitationDiagnostics(
          response,
          parsed.items,
          normalized,
          providerSourceUrls,
        );
      }
      throw error;
    }

    const bundle = parseModelResult(evidenceBundleSchema, {
      items: normalized.items,
      sources: normalized.sources,
      conciseExplanation: buildValidatedEvidenceSummary(normalized.items),
      ...(parsed.uncertaintyNote
        ? { uncertaintyNote: parsed.uncertaintyNote }
        : {}),
    });

    assertEvidenceVisibleWordLimit(bundle);

    assertBrowserSafeActivity([
      ...bundle.items.map((item) => item.statement),
      bundle.conciseExplanation,
      bundle.uncertaintyNote ?? "",
      ...bundle.sources.flatMap((source) => [source.title, source.domain]),
    ]);

    return bundle;
  }, signal);
}
