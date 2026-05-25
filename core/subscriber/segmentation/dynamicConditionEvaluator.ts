import type { SegmentFilter } from "../entities/types.js";
import {
  evaluateSegmentFilter,
  type SegmentEvaluationContext,
} from "./segmentEngine.js";

const SEGMENT_FILTER_OPS = new Set([
  "and",
  "or",
  "not",
  "hasTag",
  "missingTag",
  "fieldEq",
  "fieldContains",
  "attrEq",
  "statusEq",
  "eventOccurred",
  "variableEq",
  "variableContains",
  "fieldGt",
  "fieldLt",
  "hasAnyTag",
  "inSegment",
  "dynamicExpr",
]);

/**
 * Parse condition string from flow block into segment filter or simple expression.
 * Supports:
 * - JSON segment filter: `{"op":"hasTag","tag":"vip"}`
 * - Shorthand: `tag:vip`, `!tag:buyer`, `field:plan=pro`, `attr:locale=en`
 * - Variable: `var:score>10`, `session.step=2`
 */
export function parseConditionExpression(expression: string): SegmentFilter | null {
  const raw = String(expression || "").trim();
  if (!raw) return null;

  if (raw.startsWith("{")) {
    try {
      const parsed = JSON.parse(raw) as SegmentFilter;
      if (parsed && typeof parsed === "object" && "op" in parsed) {
        if (SEGMENT_FILTER_OPS.has(String(parsed.op))) return parsed;
      }
    } catch {
      return null;
    }
  }

  if (raw.startsWith("tag:")) {
    const tag = raw.slice(4).trim();
    if (raw.startsWith("!tag:")) {
      return { op: "missingTag", tag: raw.slice(5).trim() };
    }
    return tag ? { op: "hasTag", tag } : null;
  }
  if (raw.startsWith("!tag:")) {
    return { op: "missingTag", tag: raw.slice(5).trim() };
  }

  if (raw.startsWith("field:")) {
    const rest = raw.slice(6);
    const eq = rest.indexOf("=");
    if (eq < 0) return { op: "fieldContains", field: rest, substring: "" };
    const field = rest.slice(0, eq).trim();
    const value = rest.slice(eq + 1).trim();
    const num = Number(value);
    return {
      op: Number.isFinite(num) ? "fieldEq" : "fieldEq",
      field,
      value: Number.isFinite(num) ? num : value,
    };
  }

  if (raw.startsWith("attr:")) {
    const rest = raw.slice(5);
    const eq = rest.indexOf("=");
    if (eq < 0) return null;
    return {
      op: "attrEq",
      key: rest.slice(0, eq).trim(),
      value: rest.slice(eq + 1).trim(),
    };
  }

  if (raw.startsWith("event:")) {
    return { op: "eventOccurred", eventType: raw.slice(6).trim() };
  }

  if (raw.startsWith("segment:")) {
    return { op: "inSegment", segmentId: raw.slice(8).trim() };
  }

  return { op: "dynamicExpr", expression: raw };
}

function evalDynamicExpr(
  expression: string,
  ctx: SegmentEvaluationContext,
): boolean {
  const expr = expression.trim();
  const { subscriber } = ctx;
  const vars = {
    ...ctx.flowVariables,
    ...subscriber.customFields,
    ...subscriber.attributes,
  };

  const tagMatch = expr.match(/^tags?\s*(includes|has)\s+["']?(\w+)["']?$/i);
  if (tagMatch) {
    return subscriber.tags.includes(tagMatch[2]);
  }

  const varMatch = expr.match(/^(subscriber\.|attr\.|session\.|var\.)?([\w.]+)\s*(==|!=|>=|<=|>|<)\s*(.+)$/);
  if (varMatch) {
    const key = (varMatch[1] ? varMatch[1] + varMatch[2] : varMatch[2]).replace(/\.$/, "");
    const op = varMatch[3];
    let rhs: unknown = varMatch[4].trim().replace(/^["']|["']$/g, "");
    const num = Number(rhs);
    if (Number.isFinite(num) && String(rhs) === String(num)) rhs = num;
    const lhs = vars[key] ?? vars[`subscriber.${key}`] ?? vars[`attr.${key}`] ?? vars[`session.${key}`];
    switch (op) {
      case "==":
        return lhs === rhs;
      case "!=":
        return lhs !== rhs;
      case ">":
        return Number(lhs) > Number(rhs);
      case "<":
        return Number(lhs) < Number(rhs);
      case ">=":
        return Number(lhs) >= Number(rhs);
      case "<=":
        return Number(lhs) <= Number(rhs);
      default:
        return false;
    }
  }

  return Boolean(expr);
}

/**
 * Evaluate flow condition against subscriber state (ManyChat dynamic conditions).
 */
export function evaluateDynamicCondition(
  expression: string,
  ctx: SegmentEvaluationContext,
): boolean {
  const filter = parseConditionExpression(expression);
  if (!filter) return false;
  if (filter.op === "dynamicExpr") {
    return evalDynamicExpr(filter.expression, ctx);
  }
  return evaluateSegmentFilter(filter, ctx);
}
