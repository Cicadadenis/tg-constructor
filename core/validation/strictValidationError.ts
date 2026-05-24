/**
 * Fail-fast validation errors for the strict graph → Bot IR → compile pipeline.
 */

export type StrictValidationStage = "graph" | "bot_ir" | "compile";

export interface StrictValidationIssue {
  code: string;
  message: string;
  stage: StrictValidationStage;
  nodeId?: string;
  edgeId?: string;
  type?: string;
}

export class StrictValidationError extends Error {
  readonly stage: StrictValidationStage;
  readonly code: string;
  readonly issue: StrictValidationIssue;

  constructor(issue: StrictValidationIssue) {
    super(issue.message);
    this.name = "StrictValidationError";
    this.stage = issue.stage;
    this.code = issue.code;
    this.issue = issue;
  }
}

export function throwStrict(
  stage: StrictValidationStage,
  code: string,
  message: string,
  extra: Partial<StrictValidationIssue> = {},
): never {
  throw new StrictValidationError({ stage, code, message, ...extra });
}
