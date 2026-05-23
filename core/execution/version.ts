/** ExecutionGraph schema version produced and understood by this runtime. */
export const CURRENT_VERSION = "1.0";

export interface ExecutionGraphVersionParts {
  major: number;
  minor: number;
}

export interface VersionCompatibility {
  /** False only on major mismatch or unparseable version. */
  compatible: boolean;
  /** Non-fatal warnings (e.g. graph minor ahead of runtime minor). */
  warnings: string[];
}

export function parseExecutionGraphVersion(
  version: string,
): ExecutionGraphVersionParts | null {
  const match = /^(\d+)\.(\d+)(?:\.\d+)?$/.exec(String(version).trim());
  if (!match) return null;

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
  };
}

/**
 * Version compatibility for compile/runtime.
 * - major mismatch → incompatible (breaking IR change)
 * - minor ahead of runtime → compatible + warning (backward-compatible extension)
 * - patch segment is ignored
 */
export function checkVersionCompatibility(version: string): VersionCompatibility {
  const parsed = parseExecutionGraphVersion(version);
  const current = parseExecutionGraphVersion(CURRENT_VERSION);
  if (!parsed || !current) {
    return { compatible: false, warnings: [] };
  }

  if (parsed.major !== current.major) {
    return { compatible: false, warnings: [] };
  }

  const warnings: string[] = [];
  if (parsed.minor > current.minor) {
    warnings.push(
      `ExecutionGraph version "${version}" uses minor ${parsed.minor} while runtime is ${CURRENT_VERSION}; newer extensions may be partially unsupported`,
    );
  }

  return { compatible: true, warnings };
}

export function isCompatible(version: string): boolean {
  return checkVersionCompatibility(version).compatible;
}

export function isDevEnvironment(): boolean {
  const env = process.env.NODE_ENV;
  return env === undefined || env === "" || env === "development";
}
