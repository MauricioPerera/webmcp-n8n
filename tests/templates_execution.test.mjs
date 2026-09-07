import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { DagEngine } from '../src/js/dag-engine.js';
import { storage } from '../src/js/storage.js';

describe('Pre-built Templates End-to-End Execution Suite', () => {
  const templates = storage.getTemplates();

  test('Template 1: FastWebMCP Autonomous Agent executes end-to-end', async () => {
    const t = templates.find(item => item.id === 'template_fastwebmcp_agent');
    assert.ok(t, 'Template FastWebMCP Agent must exist');

    const engine = new DagEngine();
    engine.fromJSON(t);

    assert.equal(engine.nodes.size, 4);
    assert.equal(engine.connections.length, 3);
    assert.equal(engine.hasCycle(), false);

    const summary = await engine.executeWorkflow();
    assert.equal(summary.success, true);
    assert.equal(summary.executedNodes.length, 4);

    // Verify final node output
    const lastNode = engine.nodes.get('node_4');
    const lastExec = engine.executionData.get(lastNode.id);
    assert.equal(lastExec.status, 'success');
    assert.ok(lastExec.output[0].json.summary);
    assert.equal(lastExec.output[0].json.status, 'Ready for Dispatch');
  });

  test('Template 2: KDD Contract Quality Gate executes and routes branches', async () => {
    const t = templates.find(item => item.id === 'template_kdd_gate_pipeline');
    assert.ok(t, 'Template KDD Gate must exist');

    const engine = new DagEngine();
    engine.fromJSON(t);

    assert.equal(engine.nodes.size, 6);
    assert.equal(engine.hasCycle(), false);

    const summary = await engine.executeWorkflow();
    assert.equal(summary.success, true);

    const trueNode = engine.nodes.get('node_k5_true');
    const falseNode = engine.nodes.get('node_k6_false');

    const trueExec = engine.executionData.get(trueNode.id);
    const falseExec = engine.executionData.get(falseNode.id);

    // Ingestion has 2 items: Alice (valid) and Bob (invalid)
    // IF condition splits them: Alice goes to trueNode, Bob goes to falseNode!
    assert.equal(trueExec.status, 'success');
    assert.equal(trueExec.output[0].json.ingested, 'approved');

    assert.equal(falseExec.status, 'success');
    assert.equal(falseExec.output[0].json.ingested, 'rejected');
    assert.ok(falseExec.output[0].json.errorReason.includes('Missing fields'));
  });

  test('Template 3: Public API & Data Flow executes end-to-end', async () => {
    const t = templates.find(item => item.id === 'template_crypto_monitor');
    assert.ok(t, 'Template Public API & Data Flow must exist');

    const engine = new DagEngine();
    engine.fromJSON(t);

    assert.equal(engine.nodes.size, 4);
    assert.equal(engine.hasCycle(), false);

    const summary = await engine.executeWorkflow();
    assert.equal(summary.success, true);

    const codeNode = engine.nodes.get('node_c3');
    const codeExec = engine.executionData.get(codeNode.id);
    assert.equal(codeExec.status, 'success');
    assert.ok(codeExec.output[0].json.taskTitle);
  });

  test('Template 4: FastWebMCP Form Submission Bridge executes end-to-end', async () => {
    const t = templates.find(item => item.id === 'template_fastwebmcp_forms');
    assert.ok(t, 'Template FastWebMCP Form Bridge must exist');

    const engine = new DagEngine();
    engine.fromJSON(t);

    assert.equal(engine.nodes.size, 4);
    assert.equal(engine.hasCycle(), false);

    const summary = await engine.executeWorkflow();
    assert.equal(summary.success, true);

    const finalNode = engine.nodes.get('node_f4');
    const finalExec = engine.executionData.get(finalNode.id);
    assert.equal(finalExec.status, 'success');
    assert.equal(finalExec.output[0].json.ticketStatus, 'Queued');
    assert.equal(finalExec.output[0].json.estimatedMinutes, '50 min');
  });
});
