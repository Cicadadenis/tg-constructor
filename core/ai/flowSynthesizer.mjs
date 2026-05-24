/**
 * Automatic non-linear flow graph synthesis from capability plan + semantic intent.
 */

import { CAPABILITY_IDS } from './capabilityRegistry.mjs';

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function str(value, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function slug(raw, fallback) {
  const cleaned = str(raw)
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9_]+/giu, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  return cleaned || fallback;
}

let nodeSeq = 0;

function nextNodeId(prefix = 'n') {
  nodeSeq += 1;
  return `${prefix}_${nodeSeq}`;
}

function resetNodeSeq() {
  nodeSeq = 0;
}

/**
 * @typedef {object} FlowNode
 * @property {string} id
 * @property {string} type — entry|present|collect|notify|branch|persist|load|route_inline|delegate|terminal
 * @property {object} [payload]
 */

/**
 * @typedef {object} FlowEdge
 * @property {string} from
 * @property {string} to
 * @property {string} [kind] — flow|true|false|on_select|merge
 * @property {string} [condition]
 * @property {string} [label]
 */

function entityById(entities, id) {
  return asArray(entities).find((e) => e.id === id);
}

function synthesizeTaskSubgraph(task, entities, capabilitySet) {
  const nodes = [];
  const edges = [];
  let prevId = null;
  const entryId = nextNodeId('task_entry');

  nodes.push({ id: entryId, type: 'task_entry', payload: { taskId: task.id, goal: task.goal } });
  prevId = entryId;

  for (const op of asArray(task.operations)) {
    if (op.kind === 'present') {
      const entity = entityById(entities, op.entityId);
      const nid = nextNodeId('present');
      nodes.push({
        id: nid,
        type: 'present',
        payload: {
          entityId: op.entityId,
          message: entity?.presentation?.message || entity?.label || '...',
          buttons: entity?.presentation?.buttons || entity?.attributes || [],
          inlineCatalog: entity?.presentation?.inlineCatalog || null,
        },
      });
      edges.push({ from: prevId, to: nid, kind: 'flow' });
      if (capabilitySet.has(CAPABILITY_IDS.INLINE_SELECTION) && entity?.presentation?.inlineCatalog) {
        const routeId = nextNodeId('inline');
        nodes.push({ id: routeId, type: 'route_inline', payload: { ...entity.presentation.inlineCatalog } });
        edges.push({ from: nid, to: routeId, kind: 'on_select' });
        prevId = routeId;
      } else {
        prevId = nid;
      }
      continue;
    }

    if (op.kind === 'collect') {
      const nid = nextNodeId('collect');
      nodes.push({ id: nid, type: 'collect', payload: { field: op.field, prompt: op.prompt } });
      edges.push({ from: prevId, to: nid, kind: 'flow' });
      prevId = nid;
      continue;
    }

    if (op.kind === 'notify') {
      const nid = nextNodeId('notify');
      nodes.push({ id: nid, type: 'notify', payload: { text: op.text } });
      edges.push({ from: prevId, to: nid, kind: 'flow' });
      prevId = nid;
      continue;
    }

    if (op.kind === 'remember') {
      const nid = nextNodeId('remember');
      nodes.push({ id: nid, type: 'remember', payload: { field: op.field, value: op.value } });
      edges.push({ from: prevId, to: nid, kind: 'flow' });
      prevId = nid;
      continue;
    }

    if (op.kind === 'persist') {
      const nid = nextNodeId('persist');
      nodes.push({ id: nid, type: 'persist', payload: { scope: op.scope, key: op.key, value: op.value } });
      edges.push({ from: prevId, to: nid, kind: 'flow' });
      prevId = nid;
      continue;
    }

    if (op.kind === 'load') {
      const nid = nextNodeId('load');
      nodes.push({ id: nid, type: 'load', payload: { key: op.key, field: op.field } });
      edges.push({ from: prevId, to: nid, kind: 'flow' });
      prevId = nid;
      continue;
    }

    if (op.kind === 'send_file') {
      const nid = nextNodeId('file');
      nodes.push({ id: nid, type: 'send_file', payload: { field: op.field } });
      edges.push({ from: prevId, to: nid, kind: 'flow' });
      prevId = nid;
      continue;
    }

    if (op.kind === 'branch') {
      const branchId = nextNodeId('branch');
      nodes.push({ id: branchId, type: 'branch', payload: { expression: op.expression } });
      edges.push({ from: prevId, to: branchId, kind: 'flow' });
      const trueEntry = nextNodeId('bt');
      const falseEntry = nextNodeId('bf');
      nodes.push({ id: trueEntry, type: 'branch_arm', payload: { arm: 'true' } });
      nodes.push({ id: falseEntry, type: 'branch_arm', payload: { arm: 'false' } });
      edges.push({ from: branchId, to: trueEntry, kind: 'true', condition: op.expression });
      edges.push({ from: branchId, to: falseEntry, kind: 'false', condition: op.expression });
      let truePrev = trueEntry;
      let falsePrev = falseEntry;
      for (const child of asArray(op.ifTrue)) {
        const sub = synthesizeOperationLeaf(child, entities);
        nodes.push(...sub.nodes);
        edges.push({ from: truePrev, to: sub.nodes[0].id, kind: 'flow' });
        truePrev = sub.terminalId;
      }
      for (const child of asArray(op.ifFalse)) {
        const sub = synthesizeOperationLeaf(child, entities);
        nodes.push(...sub.nodes);
        edges.push({ from: falsePrev, to: sub.nodes[0].id, kind: 'flow' });
        falsePrev = sub.terminalId;
      }
      const mergeId = nextNodeId('merge');
      nodes.push({ id: mergeId, type: 'merge', payload: {} });
      edges.push({ from: truePrev, to: mergeId, kind: 'merge' });
      edges.push({ from: falsePrev, to: mergeId, kind: 'merge' });
      prevId = mergeId;
      continue;
    }

    if (op.kind === 'delegate') {
      const nid = nextNodeId('delegate');
      nodes.push({ id: nid, type: 'delegate', payload: { taskId: op.taskId } });
      edges.push({ from: prevId, to: nid, kind: 'flow' });
      prevId = nid;
      continue;
    }

    if (op.kind === 'end') {
      const nid = nextNodeId('term');
      nodes.push({ id: nid, type: 'terminal', payload: {} });
      edges.push({ from: prevId, to: nid, kind: 'flow' });
      prevId = nid;
    }
  }

  if (prevId && !nodes.some((n) => n.id === prevId && n.type === 'terminal')) {
    const termId = nextNodeId('term');
    nodes.push({ id: termId, type: 'terminal', payload: {} });
    edges.push({ from: prevId, to: termId, kind: 'flow' });
  }

  return { nodes, edges, entryId, terminalIds: nodes.filter((n) => n.type === 'terminal').map((n) => n.id) };
}

function synthesizeOperationLeaf(op, entities) {
  const nodes = [];
  const edges = [];
  const kind = str(op?.kind);
  if (kind === 'message' || kind === 'notify') {
    const nid = nextNodeId('notify');
    nodes.push({ id: nid, type: 'notify', payload: { text: str(op.text || op.message) } });
    const term = nextNodeId('term');
    nodes.push({ id: term, type: 'terminal', payload: {} });
    edges.push({ from: nid, to: term, kind: 'flow' });
    return { nodes, edges, terminalId: term };
  }
  if (kind === 'end') {
    const term = nextNodeId('term');
    nodes.push({ id: term, type: 'terminal', payload: {} });
    return { nodes, edges, terminalId: term };
  }
  const nid = nextNodeId('notify');
  nodes.push({ id: nid, type: 'notify', payload: { text: '...' } });
  const term = nextNodeId('term');
  nodes.push({ id: term, type: 'terminal', payload: {} });
  edges.push({ from: nid, to: term, kind: 'flow' });
  return { nodes, edges, terminalId: term };
}

/**
 * @param {object} capabilityPlan — from planCapabilities
 */
export function synthesizeFlowGraph(capabilityPlan) {
  resetNodeSeq();
  const semantic = capabilityPlan.semantic;
  const capabilitySet = new Set(asArray(capabilityPlan.capabilities));
  const nodes = [];
  const edges = [];
  const taskSubgraphs = new Map();

  const rootId = nextNodeId('root');
  nodes.push({ id: rootId, type: 'entry', payload: { summary: semantic.summary } });

  for (const task of asArray(semantic.tasks)) {
    taskSubgraphs.set(task.id, synthesizeTaskSubgraph(task, semantic.entities, capabilitySet));
  }

  const interactionAnchors = new Map();

  for (const ix of asArray(semantic.interactions)) {
    const anchorId = nextNodeId('ix');
    interactionAnchors.set(ix.id, anchorId);
    nodes.push({
      id: anchorId,
      type: 'interaction',
      payload: {
        interactionId: ix.id,
        kind: ix.kind,
        trigger: ix.trigger,
        taskId: ix.taskId,
        label: ix.label,
      },
    });

    if (ix.branch?.expression) {
      const branchId = nextNodeId('ix_branch');
      nodes.push({ id: branchId, type: 'branch', payload: { expression: ix.branch.expression } });
      edges.push({ from: anchorId, to: branchId, kind: 'flow' });
      if (ix.branch.ifTrueTaskId && taskSubgraphs.has(ix.branch.ifTrueTaskId)) {
        const sub = taskSubgraphs.get(ix.branch.ifTrueTaskId);
        edges.push({ from: branchId, to: sub.entryId, kind: 'true', condition: ix.branch.expression });
      }
      if (ix.branch.ifFalseTaskId && taskSubgraphs.has(ix.branch.ifFalseTaskId)) {
        const sub = taskSubgraphs.get(ix.branch.ifFalseTaskId);
        edges.push({ from: branchId, to: sub.entryId, kind: 'false', condition: ix.branch.expression });
      }
      continue;
    }

    if (ix.taskId && taskSubgraphs.has(ix.taskId)) {
      const sub = taskSubgraphs.get(ix.taskId);
      edges.push({ from: anchorId, to: sub.entryId, kind: 'flow' });
      nodes.push(...sub.nodes);
      edges.push(...sub.edges);
    }
  }

  const startIx = asArray(semantic.interactions).find((ix) => ix.trigger?.type === 'start') ||
    asArray(semantic.interactions)[0];
  if (startIx && interactionAnchors.has(startIx.id)) {
    edges.push({ from: rootId, to: interactionAnchors.get(startIx.id), kind: 'flow' });
  } else if (taskSubgraphs.size) {
    const first = taskSubgraphs.values().next().value;
    edges.push({ from: rootId, to: first.entryId, kind: 'flow' });
    nodes.push(...first.nodes);
    edges.push(...first.edges);
  }

  for (const [taskId, sub] of taskSubgraphs) {
    const linked = asArray(semantic.interactions).some((ix) => ix.taskId === taskId);
    if (!linked) {
      edges.push({ from: rootId, to: sub.entryId, kind: 'parallel', label: taskId });
      nodes.push(...sub.nodes);
      edges.push(...sub.edges);
    }
  }

  return {
    version: 1,
    nodes,
    edges,
    capabilities: [...capabilitySet],
    taskSubgraphs: Object.fromEntries([...taskSubgraphs.entries()].map(([k, v]) => [k, { entryId: v.entryId }])),
    nonLinear: edges.some((e) => e.kind === 'true' || e.kind === 'false' || e.kind === 'merge'),
  };
}
