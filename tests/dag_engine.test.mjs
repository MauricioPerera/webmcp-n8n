import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { DagEngine } from '../src/js/dag-engine.js';

describe('DAG Engine Core Tests', () => {
  test('addNode and removeNode work correctly', () => {
    const engine = new DagEngine();
    const node1 = engine.addNode('manual_trigger', { x: 100, y: 100 });
    assert.equal(engine.nodes.size, 1);
    assert.equal(node1.type, 'manual_trigger');

    const removed = engine.removeNode(node1.id);
    assert.equal(removed, true);
    assert.equal(engine.nodes.size, 0);
  });

  test('addConnection enforces acyclic graph', () => {
    const engine = new DagEngine();
    const n1 = engine.addNode('manual_trigger');
    const n2 = engine.addNode('code_javascript');
    const n3 = engine.addNode('edit_fields_set');

    const c1 = engine.addConnection(n1.id, 'main', n2.id, 'main');
    assert.ok(c1);
    const c2 = engine.addConnection(n2.id, 'main', n3.id, 'main');
    assert.ok(c2);

    // Attempt to introduce cycle: n3 -> n1
    assert.throws(() => {
      engine.addConnection(n3.id, 'main', n1.id, 'main');
    }, /cycle/i);
  });

  test('topological sort orders dependencies correctly', () => {
    const engine = new DagEngine();
    const n1 = engine.addNode('manual_trigger');
    const n2 = engine.addNode('code_javascript');
    const n3 = engine.addNode('edit_fields_set');

    engine.addConnection(n1.id, 'main', n2.id, 'main');
    engine.addConnection(n2.id, 'main', n3.id, 'main');

    const order = engine.getTopologicalOrder();
    assert.deepEqual(order, [n1.id, n2.id, n3.id]);
  });

  test('executes linear workflow successfully', async () => {
    const engine = new DagEngine();
    const n1 = engine.addNode('manual_trigger');
    const n2 = engine.addNode('code_javascript', { x: 200, y: 100 }, {
      code: 'return [{ json: { count: 42, name: "Test" } }];'
    });
    const n3 = engine.addNode('edit_fields_set', { x: 400, y: 100 }, {
      assignments: [{ field: 'doubled', value: '{{ $json.count * 2 }}' }]
    });

    engine.addConnection(n1.id, 'main', n2.id, 'main');
    engine.addConnection(n2.id, 'main', n3.id, 'main');

    const summary = await engine.executeWorkflow();
    assert.equal(summary.success, true);
    assert.equal(summary.executedNodes.length, 3);

    const n3Exec = engine.executionData.get(n3.id);
    assert.equal(n3Exec.status, 'success');
    assert.equal(n3Exec.output[0].json.doubled, 84);
  });

  test('handles branching in IF conditional node', async () => {
    const engine = new DagEngine();
    const nStart = engine.addNode('manual_trigger');
    const nData = engine.addNode('code_javascript', {}, {
      code: 'return [{ json: { score: 95 } }];'
    });
    const nIf = engine.addNode('if_conditional', {}, {
      field: '{{ $json.score }}',
      operator: '>=',
      value: '90'
    });
    const nTrue = engine.addNode('edit_fields_set', {}, {
      assignments: [{ field: 'grade', value: 'A' }]
    });
    const nFalse = engine.addNode('edit_fields_set', {}, {
      assignments: [{ field: 'grade', value: 'B' }]
    });

    engine.addConnection(nStart.id, 'main', nData.id, 'main');
    engine.addConnection(nData.id, 'main', nIf.id, 'main');
    engine.addConnection(nIf.id, 'true', nTrue.id, 'main');
    engine.addConnection(nIf.id, 'false', nFalse.id, 'main');

    const summary = await engine.executeWorkflow();
    assert.equal(summary.success, true);

    const trueExec = engine.executionData.get(nTrue.id);
    const falseExec = engine.executionData.get(nFalse.id);

    assert.equal(trueExec.status, 'success');
    assert.equal(trueExec.output[0].json.grade, 'A');
    assert.equal(falseExec.status, 'skipped');
  });

  test('toJSON and fromJSON preserve nodes and connections', () => {
    const engine1 = new DagEngine();
    const n1 = engine1.addNode('manual_trigger', { x: 50, y: 50 });
    const n2 = engine1.addNode('code_javascript', { x: 250, y: 50 });
    engine1.addConnection(n1.id, 'main', n2.id, 'main');

    const json = engine1.toJSON();
    const engine2 = new DagEngine();
    engine2.fromJSON(json);

    assert.equal(engine2.nodes.size, 2);
    assert.equal(engine2.connections.length, 1);
    assert.equal(engine2.connections[0].fromNodeId, n1.id);
    assert.equal(engine2.connections[0].toNodeId, n2.id);
  });
});
