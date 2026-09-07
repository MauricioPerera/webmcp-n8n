---
type: 'Task Contract'
title: 'Implementar Catalogo y Ejecucion de Nodos n8n'
description: 'Definicion formal de nodos estandar (Triggers, Logic, Transform, Network, AI/WebMCP) y sus contratos de ejecucion.'
tags: ['ccdd', 'nodes', 'transform', 'http', 'ai', 'kdd']

task: node_execution
intent: "Definir e implementar la logica de ejecucion aislada para cada tipo de nodo en el catalogo."
target: src/js/node-registry.js
signature: "execute(params, inputItems, context)"
test_command: "node --test tests/node_registry.test.mjs"
budget:
  lines_max: 700
  cyclomatic_max: 20
forbids: ['child_process']
tests: tests/node_registry.test.mjs
tests_sha256: da74f9ef0863dfbea1cb7e1e06096beb84d904d1be7ea35c1dbf4dd29183f2ca
touch_only: ['src/js/node-registry.js']
deps_allowed: []
---

# Contrato: Catalogo y Ejecucion de Nodos n8n

## Intent
Proveer la implementacion de las transformaciones de datos e integraciones de red especificadas en [workflow_model.md](../data_models/workflow_model.md) y [architecture.md](../architecture.md).

## Interface
- `NODE_DEFINITIONS[type].execute(params: object, inputItems: object[], context?: object): Promise<object[] | object>`
- Tipos cubiertos:
  - `manual_trigger`, `schedule_trigger`, `webhook_trigger`, `webmcp_trigger`
  - `if_conditional`, `switch_router`, `filter_node`, `merge_node`
  - `code_javascript`, `edit_fields_set`, `json_transform`, `okf_parser`
  - `http_request`, `webmcp_tool_call`, `ai_agent_llm`, `kdd_contract_gate`

## Invariants
- Toda funcion `execute` debe retornar un arreglo de items con formato `[{ json: {...} }]` o un objeto de enrutamiento `{ outputRouting: {...} }`.
- El sandbox de codigo JS no debe mutar las variables globales del navegador.

## Examples
- `manual_trigger.execute({})` produce `[{ json: { trigger: 'manual', status: 'success' } }]`.
- `if_conditional.execute({ field: '{{ $json.val }}', operator: '>', value: '10' }, items)` divide los items en rutas `true` y `false`.

## Do / Don't
- **DO:** Permitir la interpolacion de expresiones `{{ $json.campo }}` en los parametros de los nodos.
- **DON'T:** Arrojar excepciones no controladas cuando un campo evaluado sea indefinido; usar valores de fallback seguros.

## Tests
El oraculo de pruebas unitarias esta sellado en `tests/node_registry.test.mjs` y se valida con:
`node --test tests/node_registry.test.mjs`

## Constraints
- Ejecucion 100% en el cliente sin requerir dependencias de servidor.
- PARAR y reportar si un nodo produce una estructura de salida invalida o si el usuario introduce codigo con bucles infinitos en el nodo Code.
