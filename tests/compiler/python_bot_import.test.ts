import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, mkdtempSync, writeFileSync, unlinkSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  importPythonBot,
  importPythonBotFromExtract,
  aiogramExtractToBotIR,
  verifyImportRoundTrip,
} from "../../core/import/index.ts";
import { graphToBotIR } from "../../core/ir/bot_ir";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PY = join(__dirname, "../fixtures/aiogram3_minimal/bot.py");
const PARSER = join(__dirname, "../../core/import/parse_aiogram_ast.py");

function makeZipFromPy(pyPath: string): Buffer {
  const dir = mkdtempSync(join(tmpdir(), "tg-import-test-"));
  const zipPath = join(dir, "bot.zip");
  try {
    execFileSync(
      "python3",
      [
        "-c",
        `import zipfile,sys; z=zipfile.ZipFile(sys.argv[1],'w'); z.writestr('bot.py', open(sys.argv[2]).read()); z.close()`,
        zipPath,
        pyPath,
      ],
      { encoding: "utf8" },
    );
    return readFileSync(zipPath);
  } finally {
    try {
      unlinkSync(zipPath);
    } catch {
      /* ignore */
    }
    rmSync(dir, { recursive: true, force: true });
  }
}

function parseFixtureZip(): ReturnType<typeof JSON.parse> {
  const zip = makeZipFromPy(FIXTURE_PY);
  const dir = mkdtempSync(join(tmpdir(), "tg-parse-"));
  const zipPath = join(dir, "bot.zip");
  writeFileSync(zipPath, zip);
  try {
    const out = execFileSync("python3", [PARSER, zipPath], { encoding: "utf8" });
    return JSON.parse(out);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const extract = parseFixtureZip();
assert.equal(extract.ok, true);
assert.ok(extract.handlers.length >= 4);
assert.ok(extract.fsm.groups.some((g: { name: string }) => g.name === "OrderStates"));
assert.equal(extract.fsm.groups[0].states.length, 2);

const startHandler = extract.handlers.find((h: { kind: string }) => h.kind === "start");
assert.ok(startHandler);
assert.ok(startHandler.actions.some((a: { type: string }) => a.type === "answer"));

const ir = aiogramExtractToBotIR(extract);
assert.ok(ir.nodes.some((n) => n.type === "start"));
assert.ok(ir.nodes.some((n) => n.type === "command"));
assert.ok(ir.nodes.some((n) => n.type === "callback"));
assert.ok(ir.nodes.some((n) => n.type === "fsm.state"));
assert.ok(ir.nodes.some((n) => n.type === "message"));
if (extract.botToken) {
  assert.ok(ir.nodes.some((n) => n.type === "bot"));
}

const { roundIr } = verifyImportRoundTrip(extract);
assert.equal(roundIr.nodes.length, ir.nodes.length);

const fromExtract = importPythonBotFromExtract(extract);
assert.equal(fromExtract.ok, true);
assert.ok(fromExtract.document);
const docNodes = Object.values(fromExtract.document!.nodes);
assert.ok(docNodes.some((n) => n.type === "start"));

const zip = makeZipFromPy(FIXTURE_PY);
const imported = importPythonBot(zip);
assert.equal(imported.ok, true);
assert.ok(imported.botIr);
assert.ok(imported.graphDocument);
const back = graphToBotIR(imported.graphDocument!);
assert.ok(back.nodes.length >= 4);
assert.equal(back.context.metadata?.importedFrom, "aiogram3_python");

console.log("python_bot_import.test.ts OK");
