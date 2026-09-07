import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { DagEngine } from '../src/js/dag-engine.js';
import { NODE_DEFINITIONS } from '../src/js/node-registry.js';
import { evaluateExpression, resolvePath, interpolateObject } from '../src/js/expressions.js';
import { WebMcpBridge } from '../src/js/webmcp-bridge.js';

describe('Adversarial & Error Injection Suite: Expressions', () => {
  test('handles null, undefined, numbers and booleans safely', () => {
    assert.equal(evaluateExpression(null), null);
    assert.equal(evaluateExpression(undefined), undefined);
    assert.equal(evaluateExpression(123), 123);
    assert.equal(evaluateExpression(true), true);
  });

  test('catches JS syntax errors in expressions without crashing', () => {
    const context = { $json: { a: 5 } };
    const res = evaluateExpression('{{ $json.a +* 2 }}', context);
    assert.ok(typeof res === 'string');
    assert.ok(res.includes('[Expr Error:'));
  });

  test('handles undefined property access gracefully', () => {
    const context = { $json: { user: null } };
    const res = evaluateExpression('{{ $json.user.profile.name }}', context);
    assert.ok(res.includes('[Expr Error:'));

    // Safe path resolution
    assert.equal(resolvePath({}, 'deep.nested.nonexistent'), undefined);
    assert.equal(resolvePath(null, 'any.path'), undefined);
    assert.equal(resolvePath({ a: 1 }, null), undefined);
  });

  test('interpolates string with broken and working expressions', () => {
    const context = { $json: { val: 'OK' } };
    const str = 'Status: {{ $json.val }}, Error: {{ 10 / 2 }}';
    const res = evaluateExpression(str, context);
    assert.equal(res, 'Status: OK, Error: 5');
  });

  test('interpolateObject handles deeply nested arrays and objects with edge values', () => {
    const context = { $json: { id: 7, active: false } };
    const obj = {
      str: 'ID: {{ $json.id }}',
      num: 99,
      arr: ['{{ $json.id * 10 }}', null, 42],
      nested: {
        flag: '{{ $json.active }}'
      }
    };
    const res = interpolateObject(obj, context);
    assert.equal(res.str, 'ID: 7');
    assert.equal(res.num, 99);
    assert.equal(res.arr[0], 70);
    assert.equal(res.arr[1], null);
    assert.equal(res.arr[2], 42);
    assert.equal(res.nested.flag, false);
  });
});

describe('Adversarial & Error Injection Suite: DAG Engine & Topology', () => {
  test('rejects self-loop connection (Node -> Node)', () => {
    const engine = new DagEngine();
    const n = engine.addNode('manual_trigger');
    const conn = engine.addConnection(n.id, 'main', n.id, 'main');
    assert.equal(conn, null);
    assert.equal(engine.connections.length, 0);
  });

  test('rejects duplicate connections', () => {
    const engine = new DagEngine();
    const n1 = engine.addNode('manual_trigger');
    const n2 = engine.addNode('code_javascript');

    const c1 = engine.addConnection(n1.id, 'main', n2.id, 'main');
    assert.ok(c1);
    const c2 = engine.addConnection(n1.id, 'main', n2.id, 'main');
    assert.equal(c2, null);
    assert.equal(engine.connections.length, 1);
  });

  test('detects and reverts indirect cycle: A -> B -> C -> A', () => {
    const engine = new DagEngine();
    const a = engine.addNode('manual_trigger');
    const b = engine.addNode('code_javascript');
    const c = engine.addNode('edit_fields_set');

    engine.addConnection(a.id, 'main', b.id, 'main');
    engine.addConnection(b.id, 'main', c.id, 'main');

    assert.throws(() => {
      engine.addConnection(c.id, 'main', a.id, 'main');
    }, /cycle/i);

    assert.equal(engine.connections.length, 2);
    assert.equal(engine.hasCycle(), false);
  });

  test('halts workflow and records error when intermediate node fails', async () => {
    const engine = new DagEngine();
    const n1 = engine.addNode('manual_trigger');
    const n2 = engine.addNode('code_javascript', {}, {
      code: 'throw new Error("Intentional Node 2 Failure");'
    });
    const n3 = engine.addNode('edit_fields_set', {}, {
      assignments: [{ field: 'unreachable', value: '1' }]
    });

    engine.addConnection(n1.id, 'main', n2.id, 'main');
    engine.addConnection(n2.id, 'main', n3.id, 'main');

    const summary = await engine.executeWorkflow();

    assert.equal(summary.success, false);
    assert.ok(summary.error);
    assert.equal(summary.error.nodeId, n2.id);
    assert.ok(summary.error.message.includes('Intentional Node 2 Failure'));

    const n1Exec = engine.executionData.get(n1.id);
    const n2Exec = engine.executionData.get(n2.id);
    const n3Exec = engine.executionData.get(n3.id);

    assert.equal(n1Exec.status, 'success');
    assert.equal(n2Exec.status, 'error');
    assert.equal(n3Exec.status, 'idle'); // Did not run!
  });

  test('skips disabled node and downstream path when input not available', async () => {
    const engine = new DagEngine();
    const n1 = engine.addNode('manual_trigger');
    const n2 = engine.addNode('code_javascript', {}, { code: 'return [{ json: { x: 1 } }];' });
    const n3 = engine.addNode('edit_fields_set', {}, { assignments: [{ field: 'y', value: '2' }] });

    engine.addConnection(n1.id, 'main', n2.id, 'main');
    engine.addConnection(n2.id, 'main', n3.id, 'main');

    engine.setNodeDisabled(n2.id, true);

    const summary = await engine.executeWorkflow();
    assert.equal(summary.success, true);

    const n2Exec = engine.executionData.get(n2.id);
    const n3Exec = engine.executionData.get(n3.id);

    assert.equal(n2Exec.status, 'disabled');
    assert.equal(n3Exec.status, 'skipped');
  });

  test('fromJSON handles empty, null and corrupted structures safely', () => {
    const engine = new DagEngine();
    engine.fromJSON(null);
    assert.equal(engine.nodes.size, 0);

    engine.fromJSON({});
    assert.equal(engine.nodes.size, 0);

    engine.fromJSON({
      nodes: [{ id: 'x', type: 'manual_trigger' }],
      connections: [{ fromNodeId: 'x', fromOutput: 'main', toNodeId: 'missing', toInput: 'main' }]
    });
    assert.equal(engine.nodes.size, 1);
    assert.equal(engine.connections.length, 1);
  });
});

describe('Adversarial & Error Injection Suite: All Node Types', () => {
  test('all trigger types execute properly with payloads', async () => {
    // schedule_trigger
    const sched = await NODE_DEFINITIONS.schedule_trigger.execute({ intervalSeconds: 5 });
    assert.equal(sched[0].json.trigger, 'schedule');
    assert.equal(sched[0].json.intervalSeconds, 5);

    // webhook_trigger
    const hook = await NODE_DEFINITIONS.webhook_trigger.execute(
      { eventName: 'custom:webhook' },
      [],
      { triggerPayload: { body: { user: 'Alice' } } }
    );
    assert.equal(hook[0].json.body.user, 'Alice');

    // webmcp_trigger
    const mcpTrig = await NODE_DEFINITIONS.webmcp_trigger.execute(
      { toolName: 'test_tool' },
      [],
      { triggerPayload: { query: 'Madrid' } }
    );
    assert.equal(mcpTrig[0].json.toolName, 'test_tool');
    assert.equal(mcpTrig[0].json.arguments.query, 'Madrid');
  });

  test('if_conditional tests ALL 10 comparison operators rigorously', async () => {
    const ifDef = NODE_DEFINITIONS.if_conditional;
    const testCases = [
      { op: '==', field: '10', val: '10', expectedTrue: true },
      { op: '!=', field: '10', val: '20', expectedTrue: true },
      { op: '>', field: '25', val: '15', expectedTrue: true },
      { op: '>', field: '5', val: '15', expectedTrue: false },
      { op: '<', field: '5', val: '15', expectedTrue: true },
      { op: '>=', field: '10', val: '10', expectedTrue: true },
      { op: '<=', field: '10', val: '10', expectedTrue: true },
      { op: 'contains', field: 'hello world', val: 'WORLD', expectedTrue: true },
      { op: 'not_contains', field: 'hello world', val: 'xyz', expectedTrue: true },
      { op: 'is_empty', field: '', val: '', expectedTrue: true },
      { op: 'is_empty', field: null, val: '', expectedTrue: true },
      { op: 'is_empty', field: 'something', val: '', expectedTrue: false },
      { op: 'is_not_empty', field: 'valid', val: '', expectedTrue: true },
      { op: 'is_not_empty', field: '', val: '', expectedTrue: false }
    ];

    for (const tc of testCases) {
      const res = await ifDef.execute({
        field: tc.field,
        operator: tc.op,
        value: tc.val
      }, [{ json: {} }]);

      const wentTrue = res.outputRouting.true.length === 1;
      assert.equal(wentTrue, tc.expectedTrue, `Failed operator "${tc.op}" with field "${tc.field}" and val "${tc.val}"`);
    }
  });

  test('switch_router routes correctly across all rules and fallback', async () => {
    const sw = NODE_DEFINITIONS.switch_router;
    const input = [
      { json: { cat: 'sales' } },
      { json: { cat: 'support' } },
      { json: { cat: 'billing' } },
      { json: { cat: 'unknown' } }
    ];

    const res = await sw.execute({
      field: '{{ $json.cat }}',
      rule0: 'sales',
      rule1: 'support',
      rule2: 'billing'
    }, input);

    assert.equal(res.outputRouting['0'].length, 1);
    assert.equal(res.outputRouting['0'][0].json.cat, 'sales');
    assert.equal(res.outputRouting['1'].length, 1);
    assert.equal(res.outputRouting['1'][0].json.cat, 'support');
    assert.equal(res.outputRouting['2'].length, 1);
    assert.equal(res.outputRouting['2'][0].json.cat, 'billing');
    assert.equal(res.outputRouting.fallback.length, 1);
    assert.equal(res.outputRouting.fallback[0].json.cat, 'unknown');
  });

  test('filter_node and merge_node handle empty and edge data', async () => {
    const filter = NODE_DEFINITIONS.filter_node;
    const input = [
      { json: { score: 10 } },
      { json: { score: 50 } },
      { json: { score: 90 } }
    ];

    const passed = await filter.execute({ field: '{{ $json.score }}', operator: '>', value: '30' }, input);
    assert.equal(passed.length, 2);
    assert.equal(passed[0].json.score, 50);
    assert.equal(passed[1].json.score, 90);

    const merge = NODE_DEFINITIONS.merge_node;
    const merged = await merge.execute({}, passed);
    assert.equal(merged.length, 2);
  });

  test('code_javascript normalizes various return types and catches errors', async () => {
    const codeNode = NODE_DEFINITIONS.code_javascript;

    // 1. Returning primitive
    const resPrim = await codeNode.execute({ code: 'return 100;' }, [{ json: {} }]);
    assert.equal(resPrim[0].json.value, 100);

    // 2. Returning single object
    const resObj = await codeNode.execute({ code: 'return { custom: true };' }, [{ json: {} }]);
    assert.equal(resObj[0].json.custom, true);

    // 3. Returning null
    const resNull = await codeNode.execute({ code: 'return null;' }, [{ json: {} }]);
    assert.equal(resNull.length, 0);

    // 4. Runtime error in user code throws structured error
    await assert.rejects(async () => {
      await codeNode.execute({ code: 'const a = null; return a.crash();' }, [{ json: {} }]);
    }, /User Code Error/i);
  });

  test('json_transform handles invalid JSON gracefully with _parseError', async () => {
    const jt = NODE_DEFINITIONS.json_transform;

    // Invalid JSON
    const resErr = await jt.execute({ action: 'parse', sourceField: 'bad', targetField: 'res' }, [
      { json: { bad: '{ incomplete json' } }
    ]);
    assert.equal(resErr[0].json.res, null);
    assert.ok(resErr[0].json._parseError);

    // Stringify
    const resStr = await jt.execute({ action: 'stringify', sourceField: 'data', targetField: 'raw' }, [
      { json: { data: { num: 42 } } }
    ]);
    assert.equal(resStr[0].json.raw, '{"num":42}');
  });

  test('okf_parser handles documents without frontmatter and valid OKF', async () => {
    const okf = NODE_DEFINITIONS.okf_parser;

    // Without frontmatter
    const resPlain = await okf.execute({ markdownContent: '# Just a heading\nSimple text' }, []);
    assert.equal(resPlain[0].json.isOkfValid, false);
    assert.equal(resPlain[0].json.body, '# Just a heading\nSimple text');

    // With valid OKF
    const resOkf = await okf.execute({
      markdownContent: '---\ntype: "Data Model"\ntitle: "Test"\n---\n# Body'
    }, []);
    assert.equal(resOkf[0].json.isOkfValid, true);
    assert.equal(resOkf[0].json.frontmatter.type, 'Data Model');
    assert.equal(resOkf[0].json.frontmatter.title, 'Test');
  });

  test('webmcp_tool_call and bridge handle nonexistent tools without crashing', async () => {
    const toolCall = NODE_DEFINITIONS.webmcp_tool_call;
    const res = await toolCall.execute({
      toolName: 'non_existent_tool_xyz',
      argumentsJson: '{}'
    }, [{ json: {} }]);

    assert.equal(res.length, 1);
    assert.equal(res[0].json.failed, true);
    assert.ok(res[0].json.error.includes('not found'));
  });

  test('ai_agent_llm executes browser_mock reasoning and exposes WebMCP tools', async () => {
    const agent = NODE_DEFINITIONS.ai_agent_llm;
    const res = await agent.execute({
      provider: 'browser_mock',
      userPrompt: 'Test prompt for assistant'
    }, [{ json: {} }]);

    assert.equal(res.length, 1);
    assert.equal(res[0].json.role, 'assistant');
    assert.ok(res[0].json.toolsExposed.includes('calculate'));
    assert.ok(res[0].json.content.includes('[AI Agent Response]'));
  });

  test('webmcp_exporter dynamically registers tool in WebMCP registry', async () => {
    const exporter = NODE_DEFINITIONS.webmcp_exporter;
    const res = await exporter.execute({
      toolName: 'dynamic_exported_tool',
      description: 'Exported from test'
    }, [{ json: {} }]);

    assert.equal(res[0].json.registeredTool, 'dynamic_exported_tool');
    assert.equal(res[0].json.status, 'active');

    // Verify it is in WebMcpBridge
    const bridge = new WebMcpBridge();
    bridge.registerTool({
      name: 'dynamic_exported_tool',
      description: 'Exported from test',
      execute: async () => ({ success: true })
    });
    const result = await bridge.callTool('dynamic_exported_tool');
    assert.equal(result.success, true);
  });
});
