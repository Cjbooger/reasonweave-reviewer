import type { ResponseOutputText } from "openai/resources/responses/responses";
import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/api-errors";
import {
  assertEvidenceVisibleWordLimit,
  assertEvidenceCitationsAvailable,
  buildValidatedEvidenceSummary,
  evidenceVisibleWordCount,
  MAX_EVIDENCE_VISIBLE_WORDS,
  normalizeEvidenceResult,
} from "@/lib/openai/generate-evidence";

const evidenceStatement =
  "A primary source documents a concrete constraint relevant to the learner's model.";
const secondEvidenceStatement =
  "A second returned source documents another concrete part of the system.";

function citation(
  url: string,
  title = "Primary source",
  startIndex = 0,
  endIndex = startIndex + 11,
): ResponseOutputText.URLCitation {
  return {
    type: "url_citation",
    url,
    title,
    start_index: startIndex,
    end_index: endIndex,
  };
}

function serializedOutput(
  items: Parameters<typeof normalizeEvidenceResult>[0],
): string {
  return JSON.stringify({ items });
}

function itemCitation(
  outputText: string,
  statement: string,
  url: string,
  title?: string,
): ResponseOutputText.URLCitation {
  const statementStart = outputText.indexOf(
    JSON.stringify(statement).slice(1, -1),
  );
  if (statementStart < 0) throw new Error("Test statement was not serialized");
  return citation(url, title, statementStart + 1);
}

function evidenceItem(
  statement: string,
  citationUrls: string[],
): {
  kind: "evidence";
  statement: string;
  citationUrls: string[];
} {
  return { kind: "evidence", statement, citationUrls };
}

describe("Responses citation normalization", () => {
  it("binds each claim only to its item-local SDK citation", () => {
    const items = [
      evidenceItem(evidenceStatement, ["https://example.edu/source"]),
      evidenceItem(secondEvidenceStatement, ["https://agency.gov/report"]),
    ];
    const outputText = serializedOutput(items);
    const normalized = normalizeEvidenceResult(items, outputText, [
      itemCitation(
        outputText,
        evidenceStatement,
        "https://example.edu/source",
        "University source",
      ),
      itemCitation(
        outputText,
        secondEvidenceStatement,
        "https://agency.gov/report",
        "Agency report",
      ),
    ]);

    expect(normalized.sources.map((source) => source.url)).toEqual([
      "https://example.edu/source",
      "https://agency.gov/report",
    ]);
    expect(normalized.items.map((item) => item.sourceIds)).toEqual([
      ["source-1"],
      ["source-2"],
    ]);
    expect(() =>
      assertEvidenceCitationsAvailable(normalized, true),
    ).not.toThrow();
  });

  it("deduplicates returned URLs after removing fragments and trailing slashes", () => {
    const items = [
      evidenceItem(evidenceStatement, ["https://example.edu/source#finding"]),
      evidenceItem(secondEvidenceStatement, ["https://example.edu/source/"]),
    ];
    const outputText = serializedOutput(items);
    const normalized = normalizeEvidenceResult(items, outputText, [
      itemCitation(
        outputText,
        evidenceStatement,
        "https://example.edu/source/",
        "First title",
      ),
      itemCitation(
        outputText,
        secondEvidenceStatement,
        "https://example.edu/source#section",
        "Duplicate title",
      ),
    ]);

    expect(normalized.sources).toHaveLength(1);
    expect(
      normalized.items.every((item) => item.sourceIds[0] === "source-1"),
    ).toBe(true);
  });

  it("rejects evidence that omits declared citationUrls even when an annotation exists", () => {
    const items = [
      evidenceItem(evidenceStatement, []),
      evidenceItem(secondEvidenceStatement, []),
    ];
    const outputText = serializedOutput(items);
    const normalized = normalizeEvidenceResult(items, outputText, [
      itemCitation(
        outputText,
        evidenceStatement,
        "https://example.edu/annotation-only",
        "Annotation-only source",
      ),
    ]);

    expect(normalized.items.every((item) => item.sourceIds.length === 0)).toBe(
      true,
    );
    expect(normalized.sources).toEqual([]);
    expect(() => assertEvidenceCitationsAvailable(normalized, true)).toThrow(
      ApiError,
    );
  });

  it("uses completed provider source URLs only when no URL annotations exist", () => {
    const firstUrl = "https://example.edu/source";
    const secondUrl = "https://agency.gov/report";
    const items = [
      evidenceItem(evidenceStatement, [firstUrl]),
      evidenceItem(secondEvidenceStatement, [secondUrl]),
    ];
    const normalized = normalizeEvidenceResult(
      items,
      serializedOutput(items),
      [],
      [firstUrl, secondUrl],
    );

    expect(normalized.items.map((item) => item.sourceIds)).toEqual([
      ["source-1"],
      ["source-2"],
    ]);
    expect(normalized.sources).toEqual([
      {
        id: "source-1",
        title: "example.edu",
        url: firstUrl,
        domain: "example.edu",
      },
      {
        id: "source-2",
        title: "agency.gov",
        url: secondUrl,
        domain: "agency.gov",
      },
    ]);
  });

  it("rejects invented, mismatched, and invalid provider source URLs", () => {
    const knownUrl = "https://example.edu/source";
    const items = [
      evidenceItem(evidenceStatement, ["https://invented.example/claim"]),
      evidenceItem(secondEvidenceStatement, [knownUrl]),
    ];
    const normalized = normalizeEvidenceResult(
      items,
      serializedOutput(items),
      [],
      [knownUrl, "ftp://example.edu/invalid", "not a URL"],
    );

    expect(normalized.items.map((item) => item.sourceIds)).toEqual([
      [],
      ["source-1"],
    ]);
    expect(normalized.sources.map((source) => source.url)).toEqual([knownUrl]);
    expect(() => assertEvidenceCitationsAvailable(normalized, true)).toThrow(
      ApiError,
    );
  });

  it("requires every evidence declared URL to be valid, distinct, and provider-matched", () => {
    const knownUrl = "https://example.edu/source";
    const items = [
      evidenceItem(evidenceStatement, [knownUrl, knownUrl]),
      evidenceItem(secondEvidenceStatement, []),
    ];
    const normalized = normalizeEvidenceResult(
      items,
      serializedOutput(items),
      [],
      [knownUrl],
    );

    expect(normalized.items.map((item) => item.sourceIds)).toEqual([[], []]);
    expect(normalized.sources).toEqual([]);
  });

  it("requires every evidence declared URL to match an item-local annotation", () => {
    const returnedUrl = "https://example.edu/source";
    const secondUrl = "https://agency.gov/report";
    const items = [
      evidenceItem(evidenceStatement, [
        returnedUrl,
        "https://invented.example/extra",
      ]),
      evidenceItem(secondEvidenceStatement, [secondUrl]),
    ];
    const outputText = serializedOutput(items);
    const normalized = normalizeEvidenceResult(items, outputText, [
      itemCitation(outputText, evidenceStatement, returnedUrl),
      itemCitation(outputText, secondEvidenceStatement, secondUrl),
    ]);

    expect(normalized.items.map((item) => item.sourceIds)).toEqual([
      [],
      ["source-2"],
    ]);
    expect(normalized.sources.map((source) => source.url)).toEqual([secondUrl]);
    expect(() => assertEvidenceCitationsAvailable(normalized, true)).toThrow(
      ApiError,
    );
  });

  it("normalizes hashes and trailing slashes but does not erase query differences", () => {
    const matchedUrl = "https://example.edu/source#section";
    const queryMismatchUrl = "https://agency.gov/report?edition=2";
    const items = [
      evidenceItem(evidenceStatement, [matchedUrl]),
      evidenceItem(secondEvidenceStatement, [queryMismatchUrl]),
    ];
    const normalized = normalizeEvidenceResult(
      items,
      serializedOutput(items),
      [],
      ["https://example.edu/source/", "https://agency.gov/report?edition=1"],
    );

    expect(normalized.items.map((item) => item.sourceIds)).toEqual([
      ["source-1"],
      [],
    ]);
    expect(normalized.sources.map((source) => source.url)).toEqual([
      "https://example.edu/source/",
    ]);
  });

  it("does not use provider sources when any URL annotation is present", () => {
    const firstUrl = "https://example.edu/source";
    const secondUrl = "https://agency.gov/report";
    const items = [
      evidenceItem(evidenceStatement, [firstUrl]),
      evidenceItem(secondEvidenceStatement, [secondUrl]),
    ];
    const outputText = serializedOutput(items);
    const normalized = normalizeEvidenceResult(
      items,
      outputText,
      [itemCitation(outputText, evidenceStatement, firstUrl)],
      [firstUrl, secondUrl],
    );

    expect(normalized.items.map((item) => item.sourceIds)).toEqual([
      ["source-1"],
      [],
    ]);
    expect(normalized.sources.map((source) => source.url)).toEqual([firstUrl]);
  });

  it("rejects malformed, non-web, mismatched, and missing citations", () => {
    const normalized = normalizeEvidenceResult(
      [
        evidenceItem(evidenceStatement, ["https://invented.example/claim"]),
        evidenceItem(secondEvidenceStatement, ["javascript:alert(1)"]),
      ],
      "structured text without either statement",
      [
        citation("not a url"),
        citation("ftp://example.edu/source"),
        citation("https://returned.example/different"),
      ],
    );

    expect(normalized.sources).toHaveLength(0);
    expect(normalized.items.every((item) => item.sourceIds.length === 0)).toBe(
      true,
    );
    expect(() => assertEvidenceCitationsAvailable(normalized, true)).toThrow(
      ApiError,
    );
  });

  it("requires an actual web-search call even when citations are present", () => {
    const items = [
      evidenceItem(evidenceStatement, ["https://example.edu/source"]),
      evidenceItem(secondEvidenceStatement, ["https://agency.gov/report"]),
    ];
    const outputText = serializedOutput(items);
    const normalized = normalizeEvidenceResult(items, outputText, [
      itemCitation(outputText, evidenceStatement, "https://example.edu/source"),
      itemCitation(
        outputText,
        secondEvidenceStatement,
        "https://agency.gov/report",
      ),
    ]);

    expect(() => assertEvidenceCitationsAvailable(normalized, false)).toThrow(
      ApiError,
    );
  });

  it("builds prominent explanation text only from validated labeled items", () => {
    const items = [
      evidenceItem(evidenceStatement, ["https://example.edu/source"]),
      evidenceItem(secondEvidenceStatement, ["https://agency.gov/report"]),
      {
        kind: "open_question" as const,
        statement:
          "Which operating constraint remains unresolved at a larger scale?",
        citationUrls: [],
      },
    ];
    const outputText = serializedOutput(items);
    const normalized = normalizeEvidenceResult(items, outputText, [
      itemCitation(outputText, evidenceStatement, "https://example.edu/source"),
      itemCitation(
        outputText,
        secondEvidenceStatement,
        "https://agency.gov/report",
      ),
    ]);

    const summary = buildValidatedEvidenceSummary(normalized.items);
    expect(summary).toContain(`Evidence: ${evidenceStatement}`);
    expect(summary).toContain(
      "Open question: Which operating constraint remains unresolved",
    );
    expect(summary).not.toContain("unsupported synthesis");
  });

  it("keeps the rendered evidence word ceiling aligned with the UI evaluator", () => {
    const bundle = {
      items: [
        {
          id: "evidence-1",
          kind: "evidence" as const,
          statement: Array.from({ length: 200 }, () => "finding").join(" "),
          sourceIds: ["source-1"],
        },
      ],
      conciseExplanation: Array.from({ length: 200 }, () => "summary").join(
        " ",
      ),
      uncertaintyNote: Array.from({ length: 50 }, () => "uncertain").join(" "),
    };

    expect(evidenceVisibleWordCount(bundle)).toBe(MAX_EVIDENCE_VISIBLE_WORDS);
    expect(() => assertEvidenceVisibleWordLimit(bundle)).not.toThrow();

    const oversized = {
      ...bundle,
      uncertaintyNote: `${bundle.uncertaintyNote} unresolved`,
    };
    expect(evidenceVisibleWordCount(oversized)).toBe(
      MAX_EVIDENCE_VISIBLE_WORDS + 1,
    );
    expect(() => assertEvidenceVisibleWordLimit(oversized)).toThrow(
      expect.objectContaining({
        code: "INVALID_MODEL_RESPONSE",
        retryable: true,
      }),
    );
  });

  it("caps the final source allowlist at eight while preserving a source per evidence item", () => {
    const items = Array.from({ length: 4 }, (_, itemIndex) =>
      evidenceItem(
        `Evidence statement ${itemIndex + 1} contains enough detail for a concise learner-facing finding.`,
        Array.from(
          { length: 3 },
          (_, sourceIndex) =>
            `https://source-${itemIndex}-${sourceIndex}.example/report`,
        ),
      ),
    );
    const outputText = serializedOutput(items);
    const citations = items.flatMap((item) =>
      item.citationUrls.map((url) =>
        itemCitation(outputText, item.statement, url),
      ),
    );
    const normalized = normalizeEvidenceResult(items, outputText, citations);

    expect(normalized.sources).toHaveLength(8);
    expect(normalized.items.every((item) => item.sourceIds.length > 0)).toBe(
      true,
    );
  });

  it("rejects swapped model URLs instead of borrowing a source from another item", () => {
    const items = [
      evidenceItem(evidenceStatement, ["https://agency.gov/report"]),
      evidenceItem(secondEvidenceStatement, ["https://example.edu/source"]),
    ];
    const outputText = serializedOutput(items);
    const normalized = normalizeEvidenceResult(items, outputText, [
      itemCitation(outputText, evidenceStatement, "https://example.edu/source"),
      itemCitation(
        outputText,
        secondEvidenceStatement,
        "https://agency.gov/report",
      ),
    ]);

    expect(normalized.items.map((item) => item.sourceIds)).toEqual([[], []]);
    expect(normalized.sources).toEqual([]);
  });

  it("rejects citations whose offsets are outside their claimed item", () => {
    const items = [
      evidenceItem(evidenceStatement, ["https://example.edu/source"]),
      evidenceItem(secondEvidenceStatement, ["https://agency.gov/report"]),
    ];
    const outputText = serializedOutput(items);
    const secondStart = outputText.indexOf(
      JSON.stringify(secondEvidenceStatement).slice(1, -1),
    );
    const normalized = normalizeEvidenceResult(items, outputText, [
      citation("https://example.edu/source", "Primary source", secondStart + 1),
      itemCitation(
        outputText,
        secondEvidenceStatement,
        "https://agency.gov/report",
      ),
    ]);

    expect(normalized.items.map((item) => item.sourceIds)).toEqual([
      [],
      ["source-2"],
    ]);
  });

  it("rejects citations whose span is in citationUrls instead of statement text", () => {
    const sourceUrl = "https://example.edu/source";
    const items = [
      evidenceItem(evidenceStatement, [sourceUrl]),
      evidenceItem(secondEvidenceStatement, ["https://agency.gov/report"]),
    ];
    const outputText = serializedOutput(items);
    const urlStart = outputText.indexOf(JSON.stringify(sourceUrl));
    const normalized = normalizeEvidenceResult(items, outputText, [
      citation(
        sourceUrl,
        "Citation URL source",
        urlStart + 1,
        urlStart + sourceUrl.length,
      ),
    ]);

    expect(normalized.items[0].sourceIds).toEqual([]);
    expect(normalized.sources).toEqual([]);
  });

  it("rejects malformed citation offsets and invalid item boundaries", () => {
    const items = [
      evidenceItem(evidenceStatement, ["https://example.edu/source"]),
      evidenceItem(secondEvidenceStatement, ["https://agency.gov/report"]),
    ];
    const outputText = serializedOutput(items);
    const malformed = normalizeEvidenceResult(items, outputText, [
      citation("https://example.edu/source", "Primary source", -1, 4),
      citation("https://agency.gov/report", "Agency report", 20, 20),
    ]);
    const invalidBoundary = normalizeEvidenceResult(
      items,
      "not serialized JSON",
      [
        itemCitation(
          outputText,
          evidenceStatement,
          "https://example.edu/source",
        ),
      ],
    );

    expect(malformed.items.every((item) => item.sourceIds.length === 0)).toBe(
      true,
    );
    expect(
      invalidBoundary.items.every((item) => item.sourceIds.length === 0),
    ).toBe(true);
  });

  it("rejects duplicate serialized item keys before a discarded claim can bind", () => {
    const discardedStatement =
      "A discarded duplicate statement must never receive a source association.";
    const items = [
      evidenceItem(evidenceStatement, ["https://example.edu/source"]),
      evidenceItem(secondEvidenceStatement, ["https://agency.gov/report"]),
    ];
    const outputText = `{"items":[{"kind":"evidence","statement":${JSON.stringify(discardedStatement)},"statement":${JSON.stringify(evidenceStatement)},"citationUrls":["https://attacker.example/discarded"],"citationUrls":["https://example.edu/source"]},${JSON.stringify(items[1])}]}`;
    const discardedStart = outputText.indexOf(
      JSON.stringify(discardedStatement).slice(1, -1),
    );
    const normalized = normalizeEvidenceResult(items, outputText, [
      citation(
        "https://example.edu/source",
        "Discarded duplicate source",
        discardedStart,
      ),
      itemCitation(
        outputText,
        secondEvidenceStatement,
        "https://agency.gov/report",
      ),
    ]);

    expect(normalized.items.every((item) => item.sourceIds.length === 0)).toBe(
      true,
    );
    expect(normalized.sources).toEqual([]);
  });

  it("fails closed when serialized output contains extra evidence items", () => {
    const items = [
      evidenceItem(evidenceStatement, ["https://example.edu/source"]),
      evidenceItem(secondEvidenceStatement, ["https://agency.gov/report"]),
    ];
    const outputText = JSON.stringify({
      items: [
        ...items,
        evidenceItem(
          "An unexpected third item must invalidate all claimed associations.",
          ["https://unexpected.example/source"],
        ),
      ],
    });

    expect(() =>
      normalizeEvidenceResult(items, outputText, [
        itemCitation(
          outputText,
          evidenceStatement,
          "https://example.edu/source",
        ),
      ]),
    ).not.toThrow();
    expect(
      normalizeEvidenceResult(items, outputText, [
        itemCitation(
          outputText,
          evidenceStatement,
          "https://example.edu/source",
        ),
      ]).items.every((item) => item.sourceIds.length === 0),
    ).toBe(true);
  });

  it("rejects serialized items with unexpected keys", () => {
    const items = [
      evidenceItem(evidenceStatement, ["https://example.edu/source"]),
      evidenceItem(secondEvidenceStatement, ["https://agency.gov/report"]),
    ];
    const outputText = `{"items":[{"kind":"evidence","statement":${JSON.stringify(evidenceStatement)},"citationUrls":["https://example.edu/source"],"untrusted":"extra"},${JSON.stringify(items[1])}]}`;
    const normalized = normalizeEvidenceResult(items, outputText, [
      itemCitation(outputText, evidenceStatement, "https://example.edu/source"),
    ]);

    expect(normalized.items.every((item) => item.sourceIds.length === 0)).toBe(
      true,
    );
    expect(normalized.sources).toEqual([]);
  });

  it("accepts only full inclusive citation spans inside raw statement content", () => {
    const items = [
      evidenceItem(evidenceStatement, ["https://example.edu/source"]),
      evidenceItem(secondEvidenceStatement, ["https://agency.gov/report"]),
    ];
    const outputText = serializedOutput(items);
    const serializedStatement = JSON.stringify(evidenceStatement);
    const statementStart = outputText.indexOf(serializedStatement);
    const exactStatement = normalizeEvidenceResult(items, outputText, [
      citation(
        "https://example.edu/source",
        "Boundary source",
        statementStart + 1,
        statementStart + serializedStatement.length - 2,
      ),
    ]);
    const openingQuote = normalizeEvidenceResult(items, outputText, [
      citation(
        "https://example.edu/source",
        "Boundary source",
        statementStart,
        statementStart + serializedStatement.length - 2,
      ),
    ]);
    const closingQuote = normalizeEvidenceResult(items, outputText, [
      citation(
        "https://example.edu/source",
        "Boundary source",
        statementStart + 1,
        statementStart + serializedStatement.length - 1,
      ),
    ]);

    expect(exactStatement.items[0].sourceIds).toEqual(["source-1"]);
    expect(openingQuote.items[0].sourceIds).toEqual([]);
    expect(closingQuote.items[0].sourceIds).toEqual([]);
  });
});
