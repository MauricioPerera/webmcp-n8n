/**
 * n8n-kdd: Expression Evaluator
 * Evaluates expressions like {{ $json.fieldName }}, {{ $node["HTTP Request"].json.data }},
 * {{ $input.all() }}, {{ $now }}, and complex JS expressions safely.
 */

export function resolvePath(obj, path) {
  if (!obj || !path) return undefined;
  const parts = path.replace(/\[(\w+)\]/g, '.$1').replace(/^\./, '').split('.');
  let current = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = current[part];
  }
  return current;
}

export function evaluateExpression(expressionStr, context = {}) {
  if (typeof expressionStr !== 'string') return expressionStr;

  const trimmed = expressionStr.trim();

  // If the whole string is exactly {{ expression }}, evaluate and return native type (object, number, bool, etc.)
  const exactMatch = trimmed.match(/^\{\{\s*([\s\S]+?)\s*\}\}$/);
  if (exactMatch) {
    return evalCode(exactMatch[1], context);
  }

  // If it's an interpolated string: "Hello {{ $json.name }}!"
  if (trimmed.includes('{{') && trimmed.includes('}}')) {
    return trimmed.replace(/\{\{\s*([\s\S]+?)\s*\}\}/g, (match, expr) => {
      const res = evalCode(expr, context);
      if (res === null || res === undefined) return '';
      if (typeof res === 'object') return JSON.stringify(res);
      return String(res);
    });
  }

  return expressionStr;
}

function evalCode(code, context) {
  try {
    const safeContext = {
      $json: context.$json || {},
      $input: context.$input || {
        all: () => (context.items || []),
        first: () => (context.items && context.items[0] ? context.items[0] : null),
        item: context.$json || {}
      },
      $node: context.$node || {},
      $now: new Date().toISOString(),
      $today: new Date().toISOString().split('T')[0],
      $index: context.$index !== undefined ? context.$index : 0,
      $env: context.$env || {},
      Math: Math,
      Date: Date,
      JSON: JSON,
      parseInt: parseInt,
      parseFloat: parseFloat,
      encodeURIComponent: encodeURIComponent,
      decodeURIComponent: decodeURIComponent
    };

    // Create function with sandbox arguments
    const keys = Object.keys(safeContext);
    const values = Object.values(safeContext);

    // If code doesn't have a return statement and is a single expression, prepend return
    let sanitized = code.trim();
    if (!sanitized.startsWith('return') && !sanitized.includes(';')) {
      sanitized = `return (${sanitized})`;
    }

    const fn = new Function(...keys, sanitized);
    return fn(...values);
  } catch (err) {
    console.warn(`[Expression Evaluation Error]: "${code}"`, err);
    return `[Expr Error: ${err.message}]`;
  }
}

export function interpolateObject(obj, context) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return evaluateExpression(obj, context);
  if (Array.isArray(obj)) return obj.map(item => interpolateObject(item, context));
  if (typeof obj === 'object') {
    const result = {};
    for (const key of Object.keys(obj)) {
      result[key] = interpolateObject(obj[key], context);
    }
    return result;
  }
  return obj;
}
