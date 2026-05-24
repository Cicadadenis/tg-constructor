/**
 * Unified runtime context — single bag for handler execution (codegen + IR).
 */

export const RUNTIME_CTX_VERSION = "1.0";

/** Canonical runtime context shape emitted into generated Python handlers. */
export interface BotRuntimeContext {
  user: unknown;
  message: unknown;
  callback: unknown;
  state: unknown;
  vars: Record<string, unknown>;
}

/** Default variable seeds from `global` / project settings blocks. */
export interface RuntimeContextDefaults {
  [name: string]: unknown;
}

/** Minimal node shape for variable extraction from Bot IR / execution graph. */
export interface RuntimeContextNodeSource {
  id: string;
  type: string;
  payload: Record<string, unknown>;
}

export const SET_VARIABLE_TYPE = "set_variable";
export const GET_VARIABLE_TYPE = "get_variable";

export function isVariableNodeType(type: string): boolean {
  const t = String(type || "").trim();
  return (
    t === SET_VARIABLE_TYPE
    || t === GET_VARIABLE_TYPE
    || t === "remember"
    || t === "set_global"
    || t === "get"
  );
}

export function extractCtxDefaultsFromPayload(
  payload: Record<string, unknown>,
): RuntimeContextDefaults | null {
  const name = String(payload.varname ?? payload.name ?? "").trim();
  if (!name) return null;
  return { [name]: payload.value ?? null };
}
