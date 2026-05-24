/**
 * Project NodeManifest → legacy operation contract shape (ports, validation, roles).
 */

import { getBlockDefinition } from '../blockRegistry.js';
import { isGraphKeyboardNode } from '../keyboard_topology.js';

const CATEGORY_DESCRIPTORS = Object.freeze({
  control: 'control',
  logic: 'logic',
  render: 'render',
  media: 'media',
  action: 'action',
  data: 'data',
  telegram: 'telegram',
  settings: 'settings',
});

/**
 * @param {import('./nodeManifestTypes.mjs').NodeManifest} manifest
 */
export function manifestToOperationContract(manifest) {
  const definition = getBlockDefinition(manifest.type);
  const flow = manifest.flow || {};
  const ui = definition?.constraints?.ui || {};

  return Object.freeze({
    type: manifest.type,
    category: manifest.category,
    description: manifest.description,
    inputs: manifest.inputs.ports,
    outputs: manifest.outputs.ports,
    allowedConnections: Object.freeze({
      maxOutputs: flow.maxOutputs ?? null,
      outputLabels: definition?.constraints?.flow?.outputLabels
        ? Object.freeze([...definition.constraints.flow.outputLabels])
        : null,
      allowedTargetCategories: flow.allowedTargetCategories,
    }),
    inspectorSchema: Object.freeze([]),
    validationRules: manifest.validateProps,
    roles: Object.freeze({
      isRoot: Boolean(ui.canBeRoot || definition?.constraints?.flow?.canBeRoot),
      isTerminal:
        manifest.type === 'stop'
        || manifest.type === 'goto'
        || isGraphKeyboardNode(manifest.type),
      isSettings: manifest.category === CATEGORY_DESCRIPTORS.settings,
    }),
  });
}
