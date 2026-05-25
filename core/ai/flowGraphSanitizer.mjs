/**

 * Strict flow graph preparation before Execution IR — fail-fast, no silent drops.

 */



import {

  ALLOWED_FLOW_GRAPH_NODE_TYPES,

  isIntentOnlyNodeType,

  validateNodeType,

} from '../runtime/execution/executionNodeTypes.mjs';

import { ExecutionError } from '../runtime/execution/executionErrors.mjs';



function asArray(value) {

  return Array.isArray(value) ? value : [];

}



/**

 * @param {object} flowGraph

 * @returns {object} same graph when every node is executable

 */

export function sanitizeFlowGraphForExecution(flowGraph) {

  const nodes = asArray(flowGraph?.nodes);

  const path = ['sanitize:flow_graph'];



  for (const node of nodes) {

    const type = String(node?.type || '').trim();

    const nodeId = String(node?.id ?? 'unknown');



    if (type === 'scenario' || isIntentOnlyNodeType(type)) {

      throw ExecutionError.intentOnlyNode(nodeId, type, [...path, nodeId]);

    }



    const validation = validateNodeType(node, ALLOWED_FLOW_GRAPH_NODE_TYPES, {

      strict: false,

    });

    if (!validation.ok) {

      throw ExecutionError.invalidStep(

        { sourceNodeId: nodeId, kind: type },

        `node type not allowed for execution: ${validation.reason}`,

        [...path, nodeId],

      );

    }

  }



  return {

    ...flowGraph,

    nodes,

    edges: asArray(flowGraph?.edges),

    metadata: {

      ...(flowGraph?.metadata || {}),

      sanitizedForExecution: true,

    },

  };

}



/**

 * Assert flow graph has no intent-only types (post-sanitize).

 * @param {object} flowGraph

 */

export function assertFlowGraphExecutableOnly(flowGraph) {

  for (const node of asArray(flowGraph?.nodes)) {

    validateNodeType(node, ALLOWED_FLOW_GRAPH_NODE_TYPES, {

      strict: true,

      throwOnIntentOnly: true,

    });

  }

}


