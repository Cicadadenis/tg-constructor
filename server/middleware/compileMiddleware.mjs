import { parseGraph } from "../../core/compiler/parser.ts";
import { normalizeAst } from "../../core/compiler/normalizer.ts";
import { buildExecutionGraph } from "../../core/execution/buildExecutionGraph.ts";
import {
  ExecutionGraphMigrationError,
  ExecutionGraphValidationError,
  MigrationChainError,
  prepareExecutionGraph,
} from "../../core/execution/prepareExecutionGraph.ts";

const compileRequests = new Map();

function pruneCompileRateStore(now = Date.now()) {
  const windowMs = 60_000;
  for (const [key, timestamps] of compileRequests.entries()) {
    const fresh = timestamps.filter((ts) => now - ts < windowMs);
    if (fresh.length === 0) {
      compileRequests.delete(key);
    } else {
      compileRequests.set(key, fresh);
    }
  }
}

/** Basic in-memory rate limit for /api/compile (per IP). */
export function compileRateLimit(req, res, next) {
  const now = Date.now();
  const windowMs = 60_000;
  const max = 30;
  const key = req.ip || req.socket?.remoteAddress || "unknown";

  pruneCompileRateStore(now);

  const timestamps = compileRequests.get(key) ?? [];
  const recent = timestamps.filter((ts) => now - ts < windowMs);

  if (recent.length >= max) {
    return res.status(429).json({
      success: false,
      error: "Too many compile requests",
      code: "RATE_LIMITED",
    });
  }

  recent.push(now);
  compileRequests.set(key, recent);
  next();
}

function buildExecutionFromRequest(body) {
  const parsed = parseGraph(body);
  const normalized = normalizeAst(parsed);
  return buildExecutionGraph(
    normalized.nodes,
    normalized.edges,
    normalized.version ?? body?.version ?? "1.0",
  );
}

/** Validate ExecutionGraph via unified prepareExecutionGraph pipeline. */
export function validateCompileExecutionGraph(req, res, next) {
  try {
    const built = buildExecutionFromRequest(req.body);
    req.preparedExecutionGraph = prepareExecutionGraph(built);
    next();
  } catch (err) {
    if (err instanceof ExecutionGraphValidationError) {
      return res.status(400).json({
        success: false,
        error: err.message,
        code: err.code,
        details: err.details ?? null,
      });
    }

    if (err instanceof MigrationChainError) {
      return res.status(400).json({
        success: false,
        error: err.message,
        code: err.code,
        trace: err.trace,
        details: err.details ?? null,
      });
    }

    if (err instanceof ExecutionGraphMigrationError) {
      return res.status(400).json({
        success: false,
        error: err.message,
        code: err.code,
        details: err.details ?? null,
      });
    }

    return res.status(400).json({
      success: false,
      error: err?.message ?? "Invalid compile request",
      code: "INVALID_COMPILE_REQUEST",
    });
  }
}
