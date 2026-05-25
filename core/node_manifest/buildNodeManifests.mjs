/**
 * Build NodeManifest entries from blockRegistry + capability maps (boot-time only).
 */

import { z } from 'zod';
import { blockCapabilitiesByType } from '../registry/blockCapabilities.js';
import {
  buildManifestInputPorts,
  buildManifestOutputPorts,
  capabilityOutputsFromPorts,
} from './manifestPorts.mjs';
import { PAYLOAD_VALIDATION_RULES } from './payloadValidationRules.mjs';
import { buildExecutionContractFromCapabilities } from './executionContract.mjs';

/** Strict node payload schema — props bag validated per-type via validateProps. */
export function createNodeInputSchema() {
  return z
    .object({
      props: z.record(z.string(), z.unknown()).default({}),
    })
    .strict();
}

/**
 * @param {readonly string[]} uiCaps
 * @param {{ triggers?: string[], actions?: string[] }} capMap
 */
function buildCapabilityStrings(uiCaps, capMap) {
  const out = new Set();
  for (const c of uiCaps || []) {
    const s = String(c || '').trim();
    if (s) out.add(s);
  }
  for (const t of capMap.triggers || []) {
    out.add(`trigger:${t}`);
  }
  for (const a of capMap.actions || []) {
    out.add(`action:${a}`);
  }
  return Object.freeze([...out].sort());
}

/**
 * @param {readonly import('../blockRegistry.js').BlockDefinition[]} blockDefinitions
 * @returns {import('./nodeManifestTypes.mjs').NodeManifest[]}
 */
export function buildAllNodeManifests(blockDefinitions) {
  if (!blockDefinitions?.length) {
    throw new Error('NodeManifest build: blockDefinitions is required');
  }
  /** @type {import('./nodeManifestTypes.mjs').NodeManifest[]} */
  const manifests = [];

  for (const definition of blockDefinitions) {
    const type = definition.type;
    const capMap = blockCapabilitiesByType[type];
    if (!capMap) {
      throw new Error(`NodeManifest build: missing blockCapabilitiesByType for "${type}"`);
    }

    const inputPorts = buildManifestInputPorts(definition);
    const outputPorts = buildManifestOutputPorts(definition);
    const validateProps = PAYLOAD_VALIDATION_RULES[type] || null;

    const manifest = Object.freeze({
      type,
      category: definition.category,
      description: definition.description,
      inputs: Object.freeze({
        schema: createNodeInputSchema(),
        ports: inputPorts,
      }),
      outputs: Object.freeze({
        ports: outputPorts,
        capabilityOutputs: capabilityOutputsFromPorts(outputPorts),
      }),
      capabilities: buildCapabilityStrings(definition.capabilities, capMap),
      executionContract: buildExecutionContractFromCapabilities(capMap),
      validateProps,
      flow: Object.freeze({
        maxOutputs: definition.constraints?.flow?.maxOutputs ?? null,
        allowedTargetCategories: definition.constraints?.flow?.allowedTargetCategories
          ? Object.freeze([...definition.constraints.flow.allowedTargetCategories])
          : null,
      }),
    });

    manifests.push(manifest);
  }

  if (!manifests.length) {
    throw new Error('NodeManifest build: blockDefinitions produced zero manifests');
  }

  return Object.freeze(manifests);
}
