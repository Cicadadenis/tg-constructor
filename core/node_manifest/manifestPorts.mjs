/**
 * Port descriptors for NodeManifest (graph semantic layer).
 */

import { FLOW_PORTS } from '../graph/flowPorts.js';
import {
  isGraphKeyboardNode,
  isReplyCapable,
  KEYBOARD_EDGE_SOURCE_PORT,
  KEYBOARD_EDGE_TARGET_PORT,
} from '../keyboard_topology.js';

export const PORT_DIRECTIONS = Object.freeze({
  INPUT: 'in',
  OUTPUT: 'out',
});

export const PORT_KINDS = Object.freeze({
  FLOW: 'flow',
  KEYBOARD: 'keyboard',
  CONDITION_TRUE: 'true',
  CONDITION_FALSE: 'false',
  LOOP_BODY: 'body',
  LOOP_DONE: 'done',
});

function portFromFlow(blockType, dir) {
  const cfg = FLOW_PORTS[blockType] || { input: 'flow', output: 'flow' };
  const transport = dir === PORT_DIRECTIONS.INPUT ? cfg.input : cfg.output;
  return transport ?? null;
}

/**
 * @param {import('../../core/blockRegistry.js').BlockDefinition} definition
 */
export function buildManifestOutputPorts(definition) {
  const type = definition.type;
  if (isReplyCapable(type)) {
    const flowTransport = portFromFlow(type, PORT_DIRECTIONS.OUTPUT) || 'flow';
    return Object.freeze([
      Object.freeze({
        id: flowTransport,
        transport: flowTransport,
        kind: PORT_KINDS.FLOW,
        label: 'flow',
        direction: PORT_DIRECTIONS.OUTPUT,
      }),
      Object.freeze({
        id: KEYBOARD_EDGE_SOURCE_PORT,
        transport: KEYBOARD_EDGE_SOURCE_PORT,
        kind: PORT_KINDS.KEYBOARD,
        label: 'keyboard',
        direction: PORT_DIRECTIONS.OUTPUT,
      }),
    ]);
  }
  const transport = portFromFlow(type, PORT_DIRECTIONS.OUTPUT);
  if (transport == null) return Object.freeze([]);
  if (type === 'condition' || type === 'condition_not') {
    return Object.freeze([
      Object.freeze({
        id: PORT_KINDS.CONDITION_TRUE,
        transport,
        kind: PORT_KINDS.CONDITION_TRUE,
        label: 'TRUE',
        edgeLabel: 'TRUE',
        direction: PORT_DIRECTIONS.OUTPUT,
      }),
      Object.freeze({
        id: PORT_KINDS.CONDITION_FALSE,
        transport,
        kind: PORT_KINDS.CONDITION_FALSE,
        label: 'FALSE',
        edgeLabel: 'FALSE',
        direction: PORT_DIRECTIONS.OUTPUT,
      }),
    ]);
  }
  if (type === 'loop' || type === 'foreach') {
    return Object.freeze([
      Object.freeze({
        id: PORT_KINDS.LOOP_BODY,
        transport,
        kind: PORT_KINDS.LOOP_BODY,
        label: 'BODY',
        edgeLabel: 'body',
        direction: PORT_DIRECTIONS.OUTPUT,
      }),
      Object.freeze({
        id: PORT_KINDS.LOOP_DONE,
        transport,
        kind: PORT_KINDS.LOOP_DONE,
        label: 'DONE',
        edgeLabel: 'done',
        direction: PORT_DIRECTIONS.OUTPUT,
      }),
    ]);
  }
  return Object.freeze([
    Object.freeze({
      id: transport,
      transport,
      kind: PORT_KINDS.FLOW,
      label: transport === 'scenario_flow' ? 'scenario' : 'flow',
      direction: PORT_DIRECTIONS.OUTPUT,
    }),
  ]);
}

/**
 * @param {import('../../core/blockRegistry.js').BlockDefinition} definition
 */
export function buildManifestInputPorts(definition) {
  if (isGraphKeyboardNode(definition.type)) {
    return Object.freeze([
      Object.freeze({
        id: KEYBOARD_EDGE_TARGET_PORT,
        transport: KEYBOARD_EDGE_TARGET_PORT,
        kind: PORT_KINDS.KEYBOARD,
        label: 'keyboard',
        direction: PORT_DIRECTIONS.INPUT,
      }),
    ]);
  }
  const transport = portFromFlow(definition.type, PORT_DIRECTIONS.INPUT);
  if (transport == null) return Object.freeze([]);
  return Object.freeze([
    Object.freeze({
      id: transport,
      transport,
      kind: PORT_KINDS.FLOW,
      label: transport === 'scenario_flow' ? 'scenario' : 'flow',
      direction: PORT_DIRECTIONS.INPUT,
    }),
  ]);
}

/** Map manifest output ports → capability flow output ids. */
export function capabilityOutputsFromPorts(outputPorts) {
  const ids = [];
  for (const port of outputPorts) {
    if (port.kind === PORT_KINDS.CONDITION_TRUE) ids.push('true');
    else if (port.kind === PORT_KINDS.CONDITION_FALSE) ids.push('false');
    else if (port.kind === PORT_KINDS.LOOP_BODY) ids.push('body');
    else if (port.kind === PORT_KINDS.LOOP_DONE) ids.push('done');
    else if (port.kind === PORT_KINDS.KEYBOARD) ids.push('keyboard');
    else ids.push(String(port.id || port.transport || 'flow'));
  }
  return Object.freeze([...new Set(ids)]);
}
