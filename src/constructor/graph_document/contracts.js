import { z } from 'zod';
import { GRAPH_OPERATION_TYPES } from './graph_schema.js';

const finiteNumber = z.number().finite();

export const ViewportSchema = z.object({
  x: finiteNumber,
  y: finiteNumber,
  zoom: finiteNumber.positive(),
});

export const GraphNodeSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  position: z.object({
    x: finiteNumber,
    y: finiteNumber,
  }),
  data: z.record(z.string(), z.any()).default({}),
  meta: z.record(z.string(), z.any()).default({}),
});

export const GraphEdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  sourcePort: z.string().min(1).default('flow'),
  targetPort: z.string().min(1).default('flow'),
  label: z.string().default(''),
  condition: z.string().default(''),
});

export const GraphDocumentRecordSchema = z.object({
  schema_version: z.number().int().min(1),
  nodes: z.record(z.string(), GraphNodeSchema),
  edges: z.record(z.string(), GraphEdgeSchema),
  metadata: z.object({
    name: z.string().default('untitled'),
    createdAt: z.string().nullable().optional(),
    updatedAt: z.string().nullable().optional(),
    revision: z.number().int().nonnegative().default(0),
    tags: z.array(z.string()).default([]),
  }).default({ name: 'untitled', revision: 0, tags: [] }),
  viewport: ViewportSchema,
  ui_state: z.object({
    selection: z.array(z.string()).default([]),
    collapsed: z.array(z.string()).default([]),
    groups: z.array(z.object({
      id: z.string().min(1),
      label: z.string().default(''),
      nodeIds: z.array(z.string()).default([]),
    })).default([]),
  }).default({ selection: [], collapsed: [], groups: [] }),
});

export const GraphDocumentExportSchema = z.object({
  schema_version: z.number().int().min(1),
  nodes: z.array(GraphNodeSchema),
  edges: z.array(GraphEdgeSchema),
  metadata: GraphDocumentRecordSchema.shape.metadata,
  viewport: ViewportSchema,
  ui_state: GraphDocumentRecordSchema.shape.ui_state,
});

export const GraphOperationSchema = z.object({
  type: z.enum(GRAPH_OPERATION_TYPES),
  payload: z.record(z.string(), z.any()),
  meta: z.record(z.string(), z.any()).optional(),
});

export const NormalizedAstNodeSchema = z.object({
  type: z.string().min(1),
  payload: z.record(z.string(), z.any()).default({}),
  children: z.array(z.lazy(() => NormalizedAstNodeSchema)).default([]),
});

export const CodegenSnapshotSchema = z.object({
  graph: z.record(z.string(), z.any()),
  generatedPython: z.string(),
  empty: z.boolean(),
  compileWarnings: z.array(z.string()).default([]),
  compileErrors: z.array(z.record(z.string(), z.any())).default([]),
  transpileTrace: z.array(z.record(z.string(), z.any())).default([]),
});

export function validateGraphDocumentContract(value) {
  return GraphDocumentRecordSchema.safeParse(value);
}

export function validateGraphExportContract(value) {
  return GraphDocumentExportSchema.safeParse(value);
}

export function validateGraphOperationContract(value) {
  return GraphOperationSchema.safeParse(value);
}

export function validateAstContract(value) {
  return z.array(NormalizedAstNodeSchema).safeParse(value);
}

export function validateCodegenContract(value) {
  return CodegenSnapshotSchema.safeParse(value);
}
