import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { NODE_DEFINITIONS } from '../src/js/node-registry.js';

describe('Node Registry Execution Tests', () => {
  test('manual_trigger generates initial item', async () => {
    const def = NODE_DEFINITIONS.manual_trigger;
    const output = await def.execute({});
    assert.equal(output.length, 1);
    assert.equal(output[0].json.trigger, 'manual');
    assert.ok(output[0].json.timestamp);
  });

  test('code_javascript executes custom script with $input', async () => {
    const def = NODE_DEFINITIONS.code_javascript;
    const input = [
      { json: { val: 10 } },
      { json: { val: 20 } }
    ];
    const code = `
      return $input.all().map(it => ({
        json: { ...it.json, doubled: it.json.val * 2 }
      }));
    `;
    const output = await def.execute({ code }, input);
    assert.equal(output.length, 2);
    assert.equal(output[0].json.doubled, 20);
    assert.equal(output[1].json.doubled, 40);
  });

  test('if_conditional evaluates conditions and routes correctly', async () => {
    const def = NODE_DEFINITIONS.if_conditional;
    const input = [
      { json: { status: 'active', age: 25 } },
      { json: { status: 'inactive', age: 17 } }
    ];

    const result = await def.execute({
      field: '{{ $json.age }}',
      operator: '>=',
      value: '18'
    }, input);

    assert.ok(result.outputRouting);
    assert.equal(result.outputRouting.true.length, 1);
    assert.equal(result.outputRouting.true[0].json.status, 'active');
    assert.equal(result.outputRouting.false.length, 1);
    assert.equal(result.outputRouting.false[0].json.status, 'inactive');
  });

  test('edit_fields_set assigns fields with expressions', async () => {
    const def = NODE_DEFINITIONS.edit_fields_set;
    const input = [{ json: { user: 'Antigravity' } }];
    const assignments = [
      { field: 'greeting', value: 'Hello {{ $json.user }}!' },
      { field: 'role', value: 'Admin' }
    ];

    const output = await def.execute({ assignments }, input);
    assert.equal(output.length, 1);
    assert.equal(output[0].json.greeting, 'Hello Antigravity!');
    assert.equal(output[0].json.role, 'Admin');
  });

  test('kdd_contract_gate flags missing required fields', async () => {
    const def = NODE_DEFINITIONS.kdd_contract_gate;
    const input = [
      { json: { id: 'U-1', status: 'valid' } },
      { json: { id: 'U-2' } }
    ];

    const output = await def.execute({
      contractName: 'user_contract',
      requiredFields: ['id', 'status']
    }, input);

    assert.equal(output[0].json._kdd_validation.valid, true);
    assert.equal(output[1].json._kdd_validation.valid, false);
    assert.deepEqual(output[1].json._kdd_validation.missingFields, ['status']);
  });
});
