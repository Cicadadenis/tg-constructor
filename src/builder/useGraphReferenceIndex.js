import React from 'react';
import { buildGraphReferenceIndex } from '../constructor/graph_document/graph_reference_registry.js';

/**
 * @param {() => object} getGraphDocument
 * @param {number} graphRevision
 * @param {ReadonlyArray} blockTypes
 */
export function useGraphReferenceIndex(getGraphDocument, graphRevision, blockTypes = []) {
  return React.useMemo(() => {
    const doc = typeof getGraphDocument === 'function' ? getGraphDocument() : null;
    if (!doc) return buildGraphReferenceIndex({ nodes: {}, edges: {} }, blockTypes);
    return buildGraphReferenceIndex(doc, blockTypes);
  }, [getGraphDocument, graphRevision, blockTypes]);
}
