/**
 * importPythonBot(zip) — parse aiogram3 Python bot archive → Bot IR → GraphDocument.
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, unlinkSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { createGraphDocument } from "../../src/constructor/graph_document/graph_document.js";
import type { GraphDocumentInput } from "../ir/bot_ir.js";
import { graphToBotIR, type BotIRGraph } from "../ir/bot_ir.js";
import {
  aiogramExtractToBotIR,
  aiogramExtractToGraphDocument,
  type AiogramExtractResult,
} from "./aiogramExtractToBotIR.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PARSER_SCRIPT = join(__dirname, "parse_aiogram_ast.py");

export type ImportPythonBotInput = Buffer | Uint8Array | string;

export interface ImportPythonBotResult {
  ok: boolean;
  error?: string;
  extract?: AiogramExtractResult;
  botIr?: BotIRGraph;
  graphDocument?: GraphDocumentInput;
  /** Canonical GraphDocument instance (normalized nodes/edges maps). */
  document?: ReturnType<typeof createGraphDocument>;
}

function toBuffer(input: ImportPythonBotInput): Buffer {
  if (typeof input === "string") {
    if (/^[A-Za-z0-9+/=\s]+$/.test(input.trim()) && input.trim().length > 40) {
      return Buffer.from(input.trim(), "base64");
    }
    return Buffer.from(input, "utf8");
  }
  return Buffer.from(input);
}

function runPythonAstParser(zipBuffer: Buffer): AiogramExtractResult {
  const dir = mkdtempSync(join(tmpdir(), "tg-import-"));
  const zipPath = join(dir, "bot.zip");
  try {
    writeFileSync(zipPath, zipBuffer);
    const out = execFileSync("python3", [PARSER_SCRIPT, zipPath], {
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
    });
    const parsed = JSON.parse(out) as AiogramExtractResult;
    return parsed;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `python_ast_parse_failed: ${message}` };
  } finally {
    try {
      unlinkSync(zipPath);
    } catch {
      /* ignore */
    }
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

/**
 * Parse zip (or raw .py bytes), build Bot IR and GraphDocument.
 */
export function importPythonBot(zip: ImportPythonBotInput): ImportPythonBotResult {
  const buffer = toBuffer(zip);
  if (!buffer.length) {
    return { ok: false, error: "empty_input" };
  }

  const extract = runPythonAstParser(buffer);
  if (!extract.ok) {
    return { ok: false, error: extract.error || "parse_failed", extract };
  }

  const botIr = aiogramExtractToBotIR(extract);
  const graphDocument = aiogramExtractToGraphDocument(extract);
  const document = createGraphDocument(graphDocument);

  return {
    ok: true,
    extract,
    botIr,
    graphDocument,
    document,
  };
}

/**
 * Parse in-memory extract (tests / fixtures without Python when pre-baked).
 */
export function importPythonBotFromExtract(
  extract: AiogramExtractResult,
): ImportPythonBotResult {
  if (!extract.ok) {
    return { ok: false, error: extract.error || "extract_not_ok", extract };
  }
  const botIr = aiogramExtractToBotIR(extract);
  const graphDocument = aiogramExtractToGraphDocument(extract);
  const document = createGraphDocument(graphDocument);
  return { ok: true, extract, botIr, graphDocument, document };
}

/** Re-export for callers that only need IR. */
export { aiogramExtractToBotIR, aiogramExtractToGraphDocument, graphToBotIR };
