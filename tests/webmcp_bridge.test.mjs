import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { WebMcpBridge } from '../src/js/webmcp-bridge.js';

describe('WebMCP & FastWebMCP Bridge Tests', () => {
  test('registers and calls a custom WebMCP tool', async () => {
    const bridge = new WebMcpBridge();

    bridge.registerTool({
      name: 'add_numbers',
      description: 'Adds two numbers',
      inputSchema: {
        type: 'object',
        properties: { a: { type: 'number' }, b: { type: 'number' } }
      },
      execute: async ({ a, b }) => ({ sum: a + b })
    });

    const tools = bridge.listTools();
    const hasTool = tools.some(t => t.name === 'add_numbers');
    assert.equal(hasTool, true);

    const result = await bridge.callTool('add_numbers', { a: 15, b: 27 });
    assert.equal(result.sum, 42);
  });

  test('calls built-in calculate tool', async () => {
    const bridge = new WebMcpBridge();
    const res = await bridge.callTool('calculate', { expression: '10 * 5 + 2' });
    assert.equal(res.result, 52);
  });

  test('calls built-in get_weather tool', async () => {
    const bridge = new WebMcpBridge();
    const res = await bridge.callTool('get_weather', { city: 'Tokyo' });
    assert.equal(res.city, 'Tokyo');
    assert.ok(res.temperature);
  });

  test('calls built-in kdd_validate_schema tool', async () => {
    const bridge = new WebMcpBridge();
    const resValid = await bridge.callTool('kdd_validate_schema', {
      data: { id: 'test-1', title: 'Doc' },
      requiredFields: ['id', 'title']
    });
    assert.equal(resValid.valid, true);

    const resInvalid = await bridge.callTool('kdd_validate_schema', {
      data: { id: 'test-2' },
      requiredFields: ['id', 'title']
    });
    assert.equal(resInvalid.valid, false);
    assert.deepEqual(resInvalid.missingFields, ['title']);
  });
});
