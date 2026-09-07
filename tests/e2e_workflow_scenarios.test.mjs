import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { DagEngine } from '../src/js/dag-engine.js';
import { webmcp } from '../src/js/webmcp-bridge.js';

describe('End-to-End Workflow Scenarios & System Resiliency', () => {
  test('Scenario 1: Full Diamond Graph (Split by IF, Process Both Branches, and Merge)', async () => {
    const engine = new DagEngine();

    // 1. Ingestion
    const nStart = engine.addNode('manual_trigger');
    const nData = engine.addNode('code_javascript', {}, {
      code: `return [
        { json: { id: 1, title: 'Server Down', status: 'urgent' } },
        { json: { id: 2, title: 'Update Docs', status: 'normal' } },
        { json: { id: 3, title: 'Security Breach', status: 'urgent' } }
      ];`
    });

    // 2. Branching
    const nIf = engine.addNode('if_conditional', {}, {
      field: '{{ $json.status }}',
      operator: '==',
      value: 'urgent'
    });

    // 3. True Branch (Urgent items)
    const nUrgent = engine.addNode('edit_fields_set', {}, {
      assignments: [{ field: 'tier', value: 'Level 1 Escalation' }]
    });

    // 4. False Branch (Normal items)
    const nNormal = engine.addNode('edit_fields_set', {}, {
      assignments: [{ field: 'tier', value: 'Standard Queue' }]
    });

    // 5. Merge
    const nMerge = engine.addNode('merge_node');

    // Wires
    engine.addConnection(nStart.id, 'main', nData.id, 'main');
    engine.addConnection(nData.id, 'main', nIf.id, 'main');
    engine.addConnection(nIf.id, 'true', nUrgent.id, 'main');
    engine.addConnection(nIf.id, 'false', nNormal.id, 'main');
    engine.addConnection(nUrgent.id, 'main', nMerge.id, 'input1');
    engine.addConnection(nNormal.id, 'main', nMerge.id, 'input2');

    const summary = await engine.executeWorkflow();
    assert.equal(summary.success, true);

    const mergeExec = engine.executionData.get(nMerge.id);
    assert.equal(mergeExec.status, 'success');
    assert.equal(mergeExec.output.length, 3);

    // 2 urgent items and 1 normal item merged
    const tiers = mergeExec.output.map(it => it.json.tier);
    assert.equal(tiers.filter(t => t === 'Level 1 Escalation').length, 2);
    assert.equal(tiers.filter(t => t === 'Standard Queue').length, 1);
  });

  test('Scenario 2: WebMCP External Invocation & Dynamic Tool Bridge', async () => {
    // 1. External AI agent calls WebMCP calculate
    const calcResult = await webmcp.callTool('calculate', { expression: '150 * 1.21' });
    assert.equal(calcResult.result, 181.5);

    // 2. Feed result into an n8n workflow
    const engine = new DagEngine();
    const nStart = engine.addNode('manual_trigger');
    const nSet = engine.addNode('edit_fields_set', {}, {
      assignments: [
        { field: 'invoiceSubtotal', value: '150' },
        { field: 'taxRate', value: '21%' },
        { field: 'totalWithTax', value: `${calcResult.result}` }
      ]
    });
    const nGate = engine.addNode('kdd_contract_gate', {}, {
      contractName: 'invoice_contract_v1',
      requiredFields: ['invoiceSubtotal', 'totalWithTax']
    });

    engine.addConnection(nStart.id, 'main', nSet.id, 'main');
    engine.addConnection(nSet.id, 'main', nGate.id, 'main');

    const summary = await engine.executeWorkflow();
    assert.equal(summary.success, true);

    const gateExec = engine.executionData.get(nGate.id);
    assert.equal(gateExec.status, 'success');
    assert.equal(gateExec.output[0].json._kdd_validation.valid, true);
    assert.equal(gateExec.output[0].json.totalWithTax, '181.5');
  });

  test('Scenario 3: Resiliency under failure, state recovery and post-fix success', async () => {
    const engine = new DagEngine();
    const n1 = engine.addNode('manual_trigger');
    const n2 = engine.addNode('code_javascript', {}, { code: 'return [{ json: { step: 1 } }];' });
    const n3 = engine.addNode('code_javascript', {}, { code: 'return [{ json: { step: 2 } }];' });
    const n4 = engine.addNode('code_javascript', {}, { code: 'throw new Error("Network timeout simulation");' });
    const n5 = engine.addNode('edit_fields_set', {}, { assignments: [{ field: 'step', value: '3' }] });

    engine.addConnection(n1.id, 'main', n2.id, 'main');
    engine.addConnection(n2.id, 'main', n3.id, 'main');
    engine.addConnection(n3.id, 'main', n4.id, 'main');
    engine.addConnection(n4.id, 'main', n5.id, 'main');

    // Run 1: Must fail at node 4
    const res1 = await engine.executeWorkflow();
    assert.equal(res1.success, false);
    assert.equal(res1.error.nodeId, n4.id);
    assert.equal(engine.executionData.get(n3.id).status, 'success');
    assert.equal(engine.executionData.get(n4.id).status, 'error');
    assert.equal(engine.executionData.get(n5.id).status, 'idle');

    // Fix node 4 with working code
    engine.updateNodeParams(n4.id, { code: 'return [{ json: { step: 4, recovered: true } }];' });

    // Run 2: Re-run should now succeed completely
    const res2 = await engine.executeWorkflow();
    assert.equal(res2.success, true);
    assert.equal(engine.executionData.get(n4.id).status, 'success');
    assert.equal(engine.executionData.get(n5.id).status, 'success');
    assert.equal(engine.executionData.get(n5.id).output[0].json.step, '3');
  });
});
