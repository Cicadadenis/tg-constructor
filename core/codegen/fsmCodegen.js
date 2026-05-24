/**
 * Aiogram 3 FSM Python emission — graph-based (FsmGraph), not StatesGroup-as-primary-model.
 */

const FSM_STATE_TYPE = 'fsm.state';
const FSM_INPUT_TYPE = 'fsm.input';

function toPascalCase(value) {
  return String(value || 'State')
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join('') || 'State';
}

function pyIdent(value) {
  const raw = String(value || 'step').trim().replace(/[^a-zA-Z0-9_]/g, '_');
  return /^[a-zA-Z_]/.test(raw) ? raw : `_${raw}`;
}

function pyQuote(s) {
  return JSON.stringify(String(s ?? ''));
}

/**
 * Build FsmGraph-shaped data from legacy stacks (ask / scenario / step / goto).
 * @param {unknown[]} stacks
 */
export function buildFsmGraphFromStacks(stacks = []) {
  const states = [];
  const inputs = [];
  const transitions = [];
  const stateIds = new Map();

  const ensureState = (group, name, nodeId) => {
    const key = `${group}:${name}`;
    if (stateIds.has(key)) return stateIds.get(key);
    const id = nodeId || `fsm_state_${stateIds.size}`;
    stateIds.set(key, id);
    states.push({
      id,
      type: FSM_STATE_TYPE,
      group: toPascalCase(group),
      name: pyIdent(name),
      data: { group, name },
    });
    return id;
  };

  for (const stack of stacks || []) {
    for (const block of stack?.blocks || []) {
      if (block?.type === 'ask') {
        const group = 'Form';
        const field = pyIdent(block.props?.varname || 'field');
        inputs.push({
          id: block.id || `fsm_input_${inputs.length}`,
          type: FSM_INPUT_TYPE,
          group: toPascalCase(group),
          field,
          prompt: String(block.props?.question || block.props?.text || ''),
          data: { ...block.props },
        });
        ensureState(group, field, `${block.id}_state`);
      }
      if (block?.type === 'scenario') {
        ensureState(block.props?.name || 'Scenario', 'start', block.id);
      }
      if (block?.type === 'step') {
        const group = block.props?.scenario || 'Scenario';
        ensureState(group, block.props?.name || 'step', block.id);
      }
      if (block?.type === 'goto' || block?.type === 'run') {
        const target = block?.props?.target ?? block?.props?.label ?? 'main';
        const parts = String(target).split(/[./]/).filter(Boolean);
        const group = parts[0] || 'Scenario';
        const step = parts[1] || parts[0] || 'step';
        ensureState(group, step, `goto_${transitions.length}`);
      }
    }
  }

  for (let i = 0; i < states.length - 1; i += 1) {
    transitions.push({ from: states[i].id, to: states[i + 1].id });
  }

  return {
    version: '1.0',
    states,
    inputs,
    transitions,
  };
}

/**
 * @param {import('../execution/fsmGraph.ts').FsmGraph} fsmGraph
 */
export function emitFsmPythonFromGraph(fsmGraph) {
  if (!fsmGraph?.states?.length && !fsmGraph?.inputs?.length && !fsmGraph?.transitions?.length) {
    return '';
  }

  const lines = [
    '# --- FSM graph (source of truth) ---',
  ];

  for (const state of fsmGraph.states || []) {
    lines.push(
      `# FSM_STATE ${state.id} group=${state.group} name=${state.name}`,
    );
  }
  for (const input of fsmGraph.inputs || []) {
    lines.push(
      `# FSM_INPUT ${input.id} group=${input.group} field=${input.field} prompt=${pyQuote(input.prompt)}`,
    );
  }
  for (const tr of fsmGraph.transitions || []) {
    const event = tr.event ? ` event=${pyQuote(tr.event)}` : '';
    const via = tr.viaNodeId ? ` via=${tr.viaNodeId}` : '';
    lines.push(`# FSM_TRANSITION ${tr.from} -> ${tr.to}${event}${via}`);
  }

  const groups = new Map();
  for (const state of fsmGraph.states || []) {
    if (!groups.has(state.group)) groups.set(state.group, []);
    groups.get(state.group).push(state);
  }
  for (const input of fsmGraph.inputs || []) {
    if (!groups.has(input.group)) groups.set(input.group, []);
    const pseudo = {
      group: input.group,
      name: input.field,
    };
    if (!groups.get(input.group).some((s) => s.name === pseudo.name)) {
      groups.get(input.group).push(pseudo);
    }
  }

  const classLines = [];
  for (const [group, members] of groups.entries()) {
    if (!members.length) continue;
    classLines.push(`class ${group}(StatesGroup):`);
    const seen = new Set();
    for (const member of members) {
      const field = pyIdent(member.name);
      if (seen.has(field)) continue;
      seen.add(field);
      classLines.push(`    ${field} = State()`);
    }
    classLines.push('');
  }

  if (classLines.length) {
    lines.push('');
    lines.push('# --- aiogram StatesGroup (derived from FSM graph) ---');
    lines.push(...classLines);
  }

  return `${lines.join('\n')}\n`;
}
