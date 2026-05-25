/**
 * @typedef {object} ManifestPortDescriptor
 * @property {string} id
 * @property {string} transport
 * @property {string} kind
 * @property {string} label
 * @property {'in' | 'out'} direction
 * @property {string} [edgeLabel]
 */

/**
 * @typedef {object} ExecutionContract
 * @property {boolean} async
 * @property {boolean} idempotent
 * @property {{ maxAttempts: number, backoffMs: number } | null} retryPolicy
 */

/**
 * @typedef {object} NodeManifest
 * @property {string} type
 * @property {string} category
 * @property {string} description
 * @property {{ schema: import('zod').ZodTypeAny, ports: readonly ManifestPortDescriptor[] }} inputs
 * @property {{ ports: readonly ManifestPortDescriptor[], capabilityOutputs: readonly string[] }} outputs
 * @property {readonly string[]} capabilities
 * @property {ExecutionContract} executionContract
 * @property {((props: Record<string, unknown>) => string | null) | null} validateProps
 * @property {{ maxOutputs: number | null, allowedTargetCategories: readonly string[] | null }} flow
 */

export {};
