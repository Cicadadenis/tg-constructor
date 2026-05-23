import { z } from "zod";

export const executionTriggerSchema = z.enum(["next", "callback", "state"]);

export const executionEdgeSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  trigger: executionTriggerSchema,
  condition: z.string().optional(),
});

export const executionNodeSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  data: z.record(z.string(), z.unknown()),
});

export const executionGraphSchema = z.object({
  version: z.string().min(1),
  nodes: z.array(executionNodeSchema),
  edges: z.array(executionEdgeSchema),
});

export type ExecutionGraphInput = z.infer<typeof executionGraphSchema>;
