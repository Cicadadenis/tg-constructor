export {
  LegacyExecutionDisabledError,
  isLegacyExecutionEnabled,
  isProductionRuntime,
  assertLegacyExecutionAllowed,
  withExecutionIrCompileGate,
  isExecutionIrCompileGateOpen,
  assertGraphExecutionIrCompilePath,
  assertGraphExecutionIrPlan,
} from "./legacyExecutionPolicy.mjs";
