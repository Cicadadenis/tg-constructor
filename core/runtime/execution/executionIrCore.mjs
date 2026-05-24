/** Execution IR core — immutable plan (Node ESM, shared by .mjs pipeline and .ts runtime). */

export const EXECUTION_IR_VERSION = '1.0';

export function freezeRetryPolicy(policy) {
  return Object.freeze({
    maxAttempts: Math.max(1, policy.maxAttempts),
    backoffMs: Math.max(0, policy.backoffMs),
    ...(policy.retryableErrors?.length
      ? { retryableErrors: Object.freeze([...policy.retryableErrors]) }
      : {}),
  });
}

export function freezeStep(step) {
  return Object.freeze({
    ...step,
    payload: Object.freeze({ ...(step.payload || {}) }),
    successors: Object.freeze([...(step.successors || [])]),
    ...(step.forkBranches
      ? { forkBranches: Object.freeze(step.forkBranches.map((b) => Object.freeze({ ...b }))) }
      : {}),
    ...(step.retry ? { retry: freezeRetryPolicy(step.retry) } : {}),
  });
}

export function freezeBarrier(barrier) {
  return Object.freeze({
    ...barrier,
    requiredBranchIds: Object.freeze([...barrier.requiredBranchIds]),
  });
}

export function freezeExecutionIrPlan(plan) {
  const frozenSteps = plan.steps.map(freezeStep);
  const stepById = {};
  for (const step of frozenSteps) stepById[step.stepId] = step;
  const frozenBarriers = plan.barriers.map(freezeBarrier);
  const barrierById = {};
  for (const barrier of frozenBarriers) barrierById[barrier.barrierId] = barrier;
  return Object.freeze({
    version: plan.version,
    planId: plan.planId,
    entryStepId: plan.entryStepId,
    steps: Object.freeze(frozenSteps),
    barriers: Object.freeze(frozenBarriers),
    stepById: Object.freeze(stepById),
    barrierById: Object.freeze(barrierById),
    metadata: Object.freeze({ ...(plan.metadata || {}) }),
  });
}

export function getExecutionStep(plan, stepId) {
  return plan.stepById[stepId];
}

export function getJoinBarrier(plan, barrierId) {
  return plan.barrierById[barrierId];
}
