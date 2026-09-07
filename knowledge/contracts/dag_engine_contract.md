---
type: 'Task Contract'
title: 'Implementar Motor DAG de Ejecucion de Flujos'
description: 'Motor de grafos aciclicos dirigidos con ordenamiento topologico, enrutamiento multi-puerto y ejecucion por items.'
tags: ['ccdd', 'dag', 'engine', 'topology', 'n8n']

task: dag_engine
intent: "Gestionar el grafo aciclico dirigido, validacion de ciclos y ejecucion topologica de flujos."
target: src/js/dag-engine.js
signature: "addNode(type, pos, params, name), addConnection(from, out, to, in), executeWorkflow(startId, payload)"
test_command: "node --test tests/dag_engine.test.mjs"
budget:
  lines_max: 550
  cyclomatic_max: 18
forbids: ['eval', 'child_process']
tests: tests/dag_engine.test.mjs
tests_sha256: 5e75d4e547ff3498afccd38ab9c72602c785c12f0610feca367cf2369e9d9e0e
touch_only: ['src/js/dag-engine.js']
deps_allowed: []
---

# Contrato: Motor DAG de Ejecucion de Flujos

## Intent
Implementar el motor central de grafos aciclicos dirigidos referenciado en [architecture.md](../architecture.md) y [workflow_model.md](../data_models/workflow_model.md). Debe resolver dependencias topologicas y permitir el paso determinista de datos por items.

## Interface
- `addNode(type: string, position: object, params?: object, customName?: string): object`
- `removeNode(nodeId: string): boolean`
- `addConnection(fromNodeId: string, fromOutput: string, toNodeId: string, toInput: string): object`
- `removeConnection(connectionId: string): boolean`
- `getTopologicalOrder(startNodeId?: string): string[]`
- `executeWorkflow(startNodeId?: string, triggerPayload?: object): Promise<object>`

## Invariants
- El grafo nunca debe permitir ciclos. Cualquier llamada a `addConnection` que introduzca un ciclo debe arrojar una excepcion.
- Las ramas no seleccionadas en nodos condicionales (por ejemplo salida inactiva de un nodo IF) deben omitirse de la ejecucion.

## Examples
- `addNode('manual_trigger', { x: 100, y: 100 })` crea y registra un nodo con ID unico.
- `executeWorkflow()` ejecuta todos los nodos en orden topologico y devuelve `{ success: true, executedNodes: [...] }`.

## Do / Don't
- **DO:** Emitir eventos de notificacion (`node:start`, `node:finish`, `node:error`) para mantener la reactividad visual del lienzo.
- **DON'T:** Ejecutar nodos marcados como deshabilitados (`disabled: true`).

## Tests
El oraculo de pruebas unitarias esta sellado en `tests/dag_engine.test.mjs` y se ejecuta con:
`node --test tests/dag_engine.test.mjs`

## Constraints
- Compatible 100% con navegadores modernos y ejecucion sin backend.
- PARAR y reportar si se detecta un ciclo en el grafo o si la ejecucion de un nodo arroja un error critico no recuperable.
