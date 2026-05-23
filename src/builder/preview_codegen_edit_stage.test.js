import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createGraphDocument } from '../constructor/graph_document/graph_document.js';
import { graphDocumentToProjectGraph } from '../constructor/graph_document/graph_project_bridge.js';
import { projectGraphToFlow } from '../../core/graph/model.js';
import { compileGraphToPython, PYTHON_EXPORT_MODES } from '../../core/pythonAiogramCodegen.js';
import { VALIDATION_STAGE } from '../constructor/graph_document/validation_stages.js';

describe('preview codegen stage', () => {
  it('COMMITTED stage keeps Python preview when inline lacks handler', () => {
    const doc = createGraphDocument({
      nodes: [
        { id: 's', type: 'start', position: { x: 0, y: 0 }, data: {} },
        {
          id: 'p',
          type: 'photo',
          position: { x: 0, y: 120 },
          data: { url: 'x.jpg' },
          meta: {
            uiAttachments: {
              inline: [{ id: '1', text: 'Да', callback: 'callback_да' }],
              buttons: [],
              replies: [],
              media: [],
              transitions: [],
            },
          },
        },
      ],
      edges: [{ id: 'e1', source: 's', target: 'p', sourcePort: 'flow', targetPort: 'flow' }],
    });
    const flow = projectGraphToFlow(graphDocumentToProjectGraph(doc));
    const edit = compileGraphToPython(flow, {
      exportMode: PYTHON_EXPORT_MODES.FULL_MODULE,
      graphDocument: doc,
      validationStage: VALIDATION_STAGE.EDIT,
      strict: false,
      skipGraphGate: true,
    });
    const committed = compileGraphToPython(flow, {
      exportMode: PYTHON_EXPORT_MODES.FULL_MODULE,
      graphDocument: doc,
      validationStage: VALIDATION_STAGE.COMMITTED,
      strict: false,
      skipGraphGate: true,
    });
    assert.equal((edit.code || '').length, 0);
    assert.ok((committed.code || '').length > 500, 'preview should use COMMITTED not EDIT');
  });
});
