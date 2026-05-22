import { DEFAULT_STUDIO_CAPABILITIES } from '../manifests/constants.js';
import { buildMinimalProjectManifest } from '../manifests/minimalManifest.js';
import {
  buildProjectGraphDocument,
  GRAPH_DOCUMENT_BLOB_KEYS,
} from '../manifests/graphDocumentRefs.js';
import { graphBlobDigestKey } from '../manifests/blobIntegrity.js';
import { enrichGraphDocumentWithBlobManifestAsync } from '../manifests/blobManifest.js';
import { normalizeChunkDependencyGraphV0 } from '../manifests/chunkDependencyGraph.js';
import { computeGraphHashes } from '../manifests/hashes.js';
import { negotiateCapabilities } from '../manifests/capabilities.js';
import { normalizeFlowNode } from '../ir/normalizeFlowNode.js';
import { inferRequiredFeaturesFromFlow } from './features.js';
import { stacksToFlow } from '../codegen/stacksFlow.js';

export const SCHEMA_VERSIONS_FOR_UI = Object.freeze({
  irSchemaVersion: 2,
  astSchemaVersion: 1,
  buildGraphFormatVersion: 1,
  dslSnapshotManifestVersion: 1,
  capabilitiesManifestVersion: 1,
  projectManifestFormatVersion: 1,
});

export function buildProjectManifestDraft(flow) {
  return buildMinimalProjectManifest({
    requiredFeatures: inferRequiredFeaturesFromFlow(flow),
    dialect: 'cicada-graph',
  });
}

export function buildProjectManifestDraftFromStacks(stacks) {
  const flow = stacksToFlow(stacks);
  return buildMinimalProjectManifest({
    requiredFeatures: inferRequiredFeaturesFromFlow(flow),
    dialect: 'cicada-graph',
  });
}

export function buildProjectGraphDocumentFromFlow(flow, options = {}) {
  const sv = options.schemaVersions || SCHEMA_VERSIONS_FOR_UI;
  const nodesRaw = flow?.nodes || [];
  const edges = flow?.edges || [];
  const norm = nodesRaw.map(normalizeFlowNode);
  const { contentHash, rollupHash, subtreeByNode } = computeGraphHashes(norm, edges);
  const requiredFeatures = inferRequiredFeaturesFromFlow(flow);
  const caps = negotiateCapabilities(DEFAULT_STUDIO_CAPABILITIES, {
    requiredFeatures,
    dialect: 'cicada-graph',
  });

  const manifest = buildMinimalProjectManifest({
    requiredFeatures,
    dialect: 'cicada-graph',
  });

  const ir = {
    schemaVersion: sv.irSchemaVersion,
    nodes: norm,
    edges: (edges || []).map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle,
    })),
  };

  const buildGraph = {
    schemaVersion: sv.buildGraphFormatVersion,
    contentHash,
    rollupHash,
    subtreeHashSample: norm.length ? subtreeByNode[norm[0].id] : null,
    stats: { nodeCount: norm.length, edgeCount: edges.length },
    semanticIds: norm.map((n) => n.semanticId || n.id),
    edges: ir.edges,
    capabilitiesNegotiation: caps,
  };

  const parts = { manifest };
  const r = options.sectionRefs || {};
  if (typeof r.ir === 'string' && r.ir) parts.irRef = r.ir;
  else parts.ir = ir;
  if (typeof r.buildGraph === 'string' && r.buildGraph) parts.buildGraphRef = r.buildGraph;
  else parts.buildGraph = buildGraph;
  parts.ui = options.ui ?? null;
  parts.ast = options.ast ?? { schemaVersion: sv.astSchemaVersion, _stub: true };

  const dig = options.sectionDigests || {};
  for (const k of GRAPH_DOCUMENT_BLOB_KEYS) {
    const v = dig[k];
    if (typeof v === 'string' && v.trim()) parts[graphBlobDigestKey(k)] = v.trim();
  }
  if (options.dependencyGraph != null) {
    parts.dependencyGraph = normalizeChunkDependencyGraphV0(options.dependencyGraph);
  }
  return buildProjectGraphDocument(parts);
}

export async function buildProjectGraphDocumentFromFlowAsync(flow, options = {}) {
  const doc = buildProjectGraphDocumentFromFlow(flow, options);
  if (!options.autoBlobManifest) return doc;
  return enrichGraphDocumentWithBlobManifestAsync(doc, options.blobManifestOptions);
}

export function buildProjectGraphDocumentFromStacks(stacks, options = {}) {
  const flow = stacksToFlow(stacks);
  const ui = options.ui ?? {
    stacks: (stacks || []).map((s) => ({
      id: s.id,
      x: s.x,
      y: s.y,
      blockIds: (s.blocks || []).map((b) => b.id),
    })),
  };
  return buildProjectGraphDocumentFromFlow(flow, { ...options, ui });
}

export async function buildProjectGraphDocumentFromStacksAsync(stacks, options = {}) {
  const doc = buildProjectGraphDocumentFromStacks(stacks, options);
  if (!options.autoBlobManifest) return doc;
  return enrichGraphDocumentWithBlobManifestAsync(doc, options.blobManifestOptions);
}
