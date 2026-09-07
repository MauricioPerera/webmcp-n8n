import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { resolvePath, evaluateExpression, interpolateObject } from '../src/js/expressions.js';

describe('Expression Evaluator Tests', () => {
  test('resolvePath traverses nested properties', () => {
    const obj = { user: { profile: { name: 'Gemini' } } };
    assert.equal(resolvePath(obj, 'user.profile.name'), 'Gemini');
    assert.equal(resolvePath(obj, 'user.missing.field'), undefined);
  });

  test('evaluateExpression returns native types for pure expressions', () => {
    const context = { $json: { count: 42, active: true } };
    assert.equal(evaluateExpression('{{ $json.count * 2 }}', context), 84);
    assert.equal(evaluateExpression('{{ $json.active }}', context), true);
  });

  test('evaluateExpression interpolates strings', () => {
    const context = { $json: { name: 'Alice', city: 'Madrid' } };
    const str = 'User {{ $json.name }} lives in {{ $json.city }}.';
    assert.equal(evaluateExpression(str, context), 'User Alice lives in Madrid.');
  });

  test('interpolateObject recursively interpolates object properties', () => {
    const context = { $json: { id: 101, title: 'Test Task' } };
    const template = {
      taskId: '{{ $json.id }}',
      title: '{{ $json.title }}',
      meta: {
        tag: 'task-{{ $json.id }}'
      }
    };

    const result = interpolateObject(template, context);
    assert.equal(result.taskId, 101);
    assert.equal(result.title, 'Test Task');
    assert.equal(result.meta.tag, 'task-101');
  });
});
