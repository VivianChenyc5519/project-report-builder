import * as XLSX from "xlsx";
import { fileToImageUrl } from "../utils";

import { createCard } from "../cards/cardService";
import type {
  SnippetCard,
  MilestoneCard,
  RiskLevel,
  CardSource,
} from "../types";

/*
|--------------------------------------------------------------------------
| Types
|--------------------------------------------------------------------------
*/

type ParsedRow = Record<string, string>;

/* Type that needs semantic classification */
type StructuredCardType = "metric" | "milestone" | "risk";

export type AutomaticInput = {
  projectId: string;
  rawText: string;
  files: File[];
};

/*
|--------------------------------------------------------------------------
| Main parser entry point
|--------------------------------------------------------------------------
|
| This is the only function App.tsx needs to call.
|
| It receives:
| - the destination project
| - optional raw text
| - optional uploaded files
|
| Every input is converted into SnippetCard objects.
|
*/

export async function parseAutomaticInput({
  projectId,
  rawText,
  files,
}: AutomaticInput): Promise<SnippetCard[]> {
  const cards: SnippetCard[] = [];

  if (rawText.trim() === '') {
    
  }

  /*
   * Parse pasted/raw text first.
   */
  if (rawText.trim()) {
    cards.push(...parseRawText(projectId, rawText));
  }

  /*
   * Then process every uploaded file.
   */
  for (const file of files) {
    /*
     * IMAGE
     */
    if (file.type.startsWith("image/")) {
      const url = fileToImageUrl(file);
      cards.push(
        createCard({
          type: "image",
          projectId,
          source: "auto",
          imageUrl: url,
        }),
      );

      continue;
    }

    const extension = getFileExtension(file.name);

    /*
     * CSV
     */
    if (extension === "csv") {
      const csvCards = await parseCsvFile(projectId, file);

      cards.push(...csvCards);

      continue;
    }

    /*
     * EXCEL
     */
    if (extension === "xlsx" || extension === "xls") {
      const excelCards = await parseExcelFile(projectId, file);

      cards.push(...excelCards);

      continue;
    }

    /*
     * Unsupported file.
     *
     * For now we simply ignore it.
     * You could throw an error instead if preferred.
     */
    console.warn(`Unsupported file type: ${file.name}`);
  }

  return cards;
}

/*
|--------------------------------------------------------------------------
| File helpers
|--------------------------------------------------------------------------
*/

function getFileExtension(fileName: string): string {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

/*
|--------------------------------------------------------------------------
| CSV parser
|--------------------------------------------------------------------------
|
| CSV files do not contain sheets.
|
| Therefore:
|
| filename
|     +
| column names
|     ↓
| card classification
|
| Each row becomes one card.
|
*/

async function parseCsvFile(
  projectId: string,
  file: File,
): Promise<SnippetCard[]> {
  const text = await file.text();

  /*
   * XLSX can also read CSV text.
   *
   * This lets us avoid installing a second CSV parsing package.
   */
  const workbook = XLSX.read(text, {
    type: "string",
  });

  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    return [];
  }

  const sheet = workbook.Sheets[firstSheetName];

  if (!sheet) {
    return [];
  }

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
  });

  const cards: SnippetCard[] = [];

  for (const rawRow of rows) {
    const row = normalizeRow(rawRow);

    /*
     * CSV has no sheet title, so use the filename
     * as classification context.
     */
    const card = structuredRowToCard(projectId, row, file.name);

    if (card) {
      cards.push(card);
    }
  }

  return cards;
}

/*
|--------------------------------------------------------------------------
| Excel parser
|--------------------------------------------------------------------------
|
| Excel can contain multiple sheets.
|
| For every sheet:
|
| sheet name
|     +
| column names
|     ↓
| card classification
|
| Each row becomes one card.
|
*/

async function parseExcelFile(
  projectId: string,
  file: File,
): Promise<SnippetCard[]> {
  const buffer = await file.arrayBuffer();

  const workbook = XLSX.read(buffer, {
    type: "array",
  });

  const cards: SnippetCard[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];

    if (!sheet) {
      continue;
    }

    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: "",
    });

    for (const rawRow of rows) {
      const row = normalizeRow(rawRow);

      const card = structuredRowToCard(projectId, row, sheetName);

      if (card) {
        cards.push(card);
      }
    }
  }

  return cards;
}

/*
|--------------------------------------------------------------------------
| Structured data normalization
|--------------------------------------------------------------------------
|
| Spreadsheet headers might be:
|
| "Probability"
| " probability "
| "PROBABILITY"
|
| Normalize everything before classification.
|
*/

function normalizeKey(key: string): string {
  return key.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

function normalizeRow(row: Record<string, unknown>): ParsedRow {
  const normalized: ParsedRow = {};

  for (const [key, value] of Object.entries(row)) {
    normalized[normalizeKey(key)] = String(value ?? "").trim();
  }

  return normalized;
}

/*
|--------------------------------------------------------------------------
| Structured row classification
|--------------------------------------------------------------------------
|
| Classification priority:
|
| 1. Risk
| 2. Milestone
| 3. Metric
|
| We first inspect the sheet/filename.
| Then inspect the column names.
|
*/

function classifyStructuredRow(
  row: ParsedRow,
  contextTitle: string,
): StructuredCardType | null {
  const context = contextTitle.toLowerCase();

  /*
   * First use sheet/file title as a hint.
   */

  if (containsAny(context, ["risk", "risks", "blocker", "blockers"])) {
    return "risk";
  }

  if (
    containsAny(context, [
      "milestone",
      "milestones",
      "schedule",
      "timeline",
      "deadline",
    ])
  ) {
    return "milestone";
  }

  if (containsAny(context, ["metric", "metrics", "kpi", "performance"])) {
    return "metric";
  }

  /*
   * Otherwise inspect column headers.
   */

  const keys = Object.keys(row);

  if (
    keysContainAny(keys, [
      "probability",
      "likelihood",
      "impact",
      "severity",
      "mitigation",
    ])
  ) {
    return "risk";
  }

  if (keysContainAny(keys, ["status", "date", "deadline", "due date", "due"])) {
    return "milestone";
  }

  if (
    keysContainAny(keys, ["value", "metric value", "result", "measurement"])
  ) {
    return "metric";
  }

  /*
   * Unknown structure.
   *
   * Instead of inventing a card,
   * skip the row.
   */
  console.warn(`Could not classify structured row in "${contextTitle}":`, row);
  return null;
}

/*
|--------------------------------------------------------------------------
| Convert structured row → card
|--------------------------------------------------------------------------
*/

function structuredRowToCard(
  projectId: string,
  row: ParsedRow,
  contextTitle: string,
): SnippetCard | null {
  const type = classifyStructuredRow(row, contextTitle);

  if (!type) {
    return null;
  }

  const title = extractTitle(row) || "New card";

  /*
   * METRIC
   */
  if (type === "metric") {
    const value = getFirstValue(row, [
      "value",
      "metric value",
      "result",
      "measurement",
    ]);

    return createCard({
      type: "metric",
      projectId,
      source: "auto",
      title,
      value: value || "—",
    });
  }

  /*
   * MILESTONE
   */
  if (type === "milestone") {
    const description = getFirstValue(row, [
      "description",
      "details",
      "note",
      "notes",
    ]);

    const rawStatus = getFirstValue(row, ["status", "state"]);

    const date = getFirstValue(row, ["date", "deadline", "due date", "due"]);

    return createCard({
      type: "milestone",
      projectId,
      source: "auto",
      title,
      description,
      status: normalizeMilestoneStatus(rawStatus),
      date: date || undefined,
    });
  }

  /*
   * RISK
   */
  const description = getFirstValue(row, [
    "description",
    "details",
    "risk",
    "note",
    "notes",
  ]);

  const probability = getFirstValue(row, ["probability", "likelihood"]);

  const impact = getFirstValue(row, ["impact", "severity"]);

  const mitigation = getFirstValue(row, ["mitigation", "response", "action"]);

  return createCard({
    type: "risk",
    projectId,
    source: "auto",
    title,
    description,
    probability: normalizeRiskLevel(probability),
    impact: normalizeRiskLevel(impact),
    mitigation,
  });
}

/*
|--------------------------------------------------------------------------
| Structured data extraction helpers
|--------------------------------------------------------------------------
*/

function extractTitle(row: ParsedRow): string {
  return getFirstValue(row, ["title", "name", "metric", "milestone", "risk"]);
}

function getFirstValue(row: ParsedRow, possibleKeys: string[]): string {
  /*
   * First try exact key matches.
   */
  for (const candidate of possibleKeys) {
    if (row[candidate]) {
      return row[candidate];
    }
  }

  /*
   * Then allow partial matches.
   *
   * Example:
   *
   * "risk probability"
   *
   * still matches:
   *
   * "probability"
   */
  for (const [key, value] of Object.entries(row)) {
    if (possibleKeys.some((candidate) => key.includes(candidate)) && value) {
      return value;
    }
  }

  return "";
}

/*
|--------------------------------------------------------------------------
| Raw text parser
|--------------------------------------------------------------------------
|
| Example:
|
| API latency: 280 ms.
| API migration is in progress.
| Risk of security approval delay;
| probability: high;
| impact: medium;
| mitigation: complete review early.
|
*/

/*
 * First split the raw text into segments.
 *
 * Both "." and ";" are delimiters.
 *
 * However, probability / impact / mitigation fragments
 * are often continuations of the previous risk statement.
 *
 * Therefore we merge those fragments back into
 * the previous segment.
 */
function splitRawText(text: string): string[] {
  const rawSegments = text
    .split(/[.;]+/)
    .map((segment) => segment.trim())
    .filter(Boolean);

  const result: string[] = [];

  for (const segment of rawSegments) {
    const lower = segment.toLowerCase();

    const isRiskContinuation =
      lower.startsWith("probability") ||
      lower.startsWith("likelihood") ||
      lower.startsWith("impact") ||
      lower.startsWith("severity") ||
      lower.startsWith("mitigation");

    if (isRiskContinuation && result.length > 0) {
      result[result.length - 1] += `; ${segment}`;

      continue;
    }

    result.push(segment);
  }

  return result;
}

/*
|--------------------------------------------------------------------------
| Raw text classification
|--------------------------------------------------------------------------
*/

function classifyTextSegment(segment: string): StructuredCardType {
  const text = segment.toLowerCase();

  /*
   * RISK FIRST.
   *
   * Risks may contain percentages or numbers,
   * so risk detection should happen before metrics.
   */
  if (
    containsAny(text, [
      "risk",
      "probability",
      "likelihood",
      "impact",
      "severity",
      "mitigation",
      "blocker",
      "may delay",
      "might delay",
      "could delay",
      "at risk",
    ])
  ) {
    return "risk";
  }

  /*
   * Metric syntax examples:
   *
   * API latency: 280 ms
   * Completion: 87%
   * Defects: 12
   * Budget: $5000
   */
  if (looksLikeMetric(segment)) {
    return "metric";
  }

  /*
   * Milestone keywords.
   */
  if (
    containsAny(text, [
      "completed",
      "complete",
      "finished",
      "in progress",
      "planned",
      "scheduled",
      "deadline",
      "due",
      "deployed",
      "released",
      "launched",
      "migration",
    ])
  ) {
    return "milestone";
  }

  /*
   * Generic project text defaults to milestone.
   *
   * This gives unknown text somewhere useful
   * instead of silently discarding it.
   */
  return "milestone";
}

/*
|--------------------------------------------------------------------------
| Raw text → cards
|--------------------------------------------------------------------------
*/

function parseRawText(projectId: string, text: string): SnippetCard[] {
  const segments = splitRawText(text);

  const cards: SnippetCard[] = [];

  for (const segment of segments) {
    const type = classifyTextSegment(segment);

    if (type === "metric") {
      cards.push(parseMetricSegment(projectId, segment));

      continue;
    }

    if (type === "risk") {
      cards.push(parseRiskSegment(projectId, segment));

      continue;
    }

    cards.push(parseMilestoneSegment(projectId, segment));
  }

  return cards;
}

/*
|--------------------------------------------------------------------------
| Raw metric parser
|--------------------------------------------------------------------------
*/

function looksLikeMetric(segment: string): boolean {
  /*
   * Require the "title: value" structure.
   *
   * Examples:
   *
   * Completion: 87%
   * Latency: 280 ms
   * Bugs: 12
   */
  return /^.+:\s*\$?\d+(?:[.,]\d+)?\s*(?:%|ms|s|sec|seconds?|mb|gb|kb|m|k|x)?$/i.test(
    segment.trim(),
  );
}

function parseMetricSegment(projectId: string, segment: string): SnippetCard {
  const separatorIndex = segment.indexOf(":");

  /*
   * Fallback
   */
  if (separatorIndex === -1) {
    return createCard({
      type: "metric",
      projectId,
      source: "auto",
      title: "Metric",
      value: segment.trim(),
    });
  }

  const title = segment.slice(0, separatorIndex).trim();

  const value = segment.slice(separatorIndex + 1).trim();

  return createCard({
    type: "metric",
    projectId,
    source: "auto",
    title,
    value,
  });
}

/*
|--------------------------------------------------------------------------
| Raw milestone parser
|--------------------------------------------------------------------------
*/

function parseMilestoneSegment(
  projectId: string,
  segment: string,
): SnippetCard {
  const status = detectMilestoneStatus(segment);

  return createCard({
    type: "milestone",
    projectId,
    source: "auto",

    /*
     * For now use the first part of the sentence
     * as the generated title.
     */
    title: createTitleFromText(segment),

    description: segment,

    status,
  });
}

function detectMilestoneStatus(text: string): MilestoneCard["status"] {
  const lower = text.toLowerCase();

  if (
    containsAny(lower, [
      "completed",
      "complete",
      "finished",
      "deployed",
      "released",
      "launched",
    ])
  ) {
    return "completed";
  }

  if (
    containsAny(lower, ["planned", "scheduled", "will begin", "will start"])
  ) {
    return "planned";
  }

  return "in-progress";
}

/*
|--------------------------------------------------------------------------
| Raw risk parser
|--------------------------------------------------------------------------
*/

function parseRiskSegment(projectId: string, segment: string): SnippetCard {
  const probability = extractRiskLevel(segment, ["probability", "likelihood"]);

  const impact = extractRiskLevel(segment, ["impact", "severity"]);

  const mitigation = extractTextField(segment, "mitigation");

  return createCard({
    type: "risk",
    projectId,
    source: "auto",
    title: createRiskTitle(segment),
    description: createRiskDescription(segment),
    probability,
    impact,
    mitigation,
  });
}

function extractRiskLevel(text: string, fieldNames: string[]): RiskLevel {
  for (const field of fieldNames) {
    /* Create a term with each field name, e.g. probability: high */
    const regex = new RegExp(`${field}\\s*(?::|is)?\\s*(low|medium|high)`, "i");

    const match = text.match(regex);

    if (match?.[1]) {
      return normalizeRiskLevel(match[1]);
    }
  }

  /*
   * Fall back to medium
   */
  return "medium";
}

function extractTextField(text: string, field: string): string {
  const regex = new RegExp(`${field}\\s*(?::|is)?\\s*([^;]+)`, "i");

  return text.match(regex)?.[1]?.trim() ?? "";
}

function createRiskTitle(segment: string): string {
  /*
   * Remove structured fields from the title.
   *
   * Example:
   *
   * "Risk: Security approval delay;
   *  probability: high;
   *  impact: medium"
   *
   * becomes approximately:
   *
   * "Security approval delay"
   */

  const firstPart = segment.split(";")[0].trim();

  return firstPart
    .replace(/^risk\s*:\s*/i, "")
    .slice(0, 70)
    .trim();
}

function createRiskDescription(segment: string): string {
  /*
   * Keep the first section as the human-readable
   * risk description.
   */
  return segment
    .split(";")[0]
    .replace(/^risk\s*:\s*/i, "")
    .trim();
}

/*
|--------------------------------------------------------------------------
| Value normalization
|--------------------------------------------------------------------------
*/

function normalizeRiskLevel(value: string): RiskLevel {
  const lower = value.trim().toLowerCase();

  if (lower.includes("high")) {
    return "high";
  }

  if (lower.includes("low")) {
    return "low";
  }

  return "medium";
}

function normalizeMilestoneStatus(value: string): MilestoneCard["status"] {
  const lower = value.trim().toLowerCase();

  if (
    lower.includes("complete") ||
    lower.includes("finished") ||
    lower.includes("done")
  ) {
    return "completed";
  }

  if (
    lower.includes("plan") ||
    lower.includes("scheduled") ||
    lower.includes("not started")
  ) {
    return "planned";
  }

  return "in-progress";
}

/*
|--------------------------------------------------------------------------
| Generic helpers
|--------------------------------------------------------------------------
*/

function containsAny(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword));
}

function keysContainAny(keys: string[], keywords: string[]): boolean {
  return keys.some((key) => keywords.some((keyword) => key.includes(keyword)));
}

function createTitleFromText(text: string): string {
  const cleaned = text.trim();

  /*
   * Avoid putting an enormous sentence into
   * the card title.
   */
  if (cleaned.length <= 60) {
    return cleaned;
  }

  return `${cleaned.slice(0, 57)}...`;
}
