---
type: 'Task Contract'
title: 'Implementar WebMCP Bridge y FastWebMCP Runtime'
description: 'Integracion del estandar WebMCP para exposicion y ejecucion de herramientas en document.modelContext.'
tags: ['ccdd', 'webmcp', 'fastwebmcp', 'tools', 'ai-agent']

task: webmcp_bridge
intent: "Gestionar el registro, ejecucion e inspeccion de herramientas bajo el estandar WebMCP y FastWebMCP."
target: src/js/webmcp-bridge.js
signature: "registerTool(tool), callTool(name, args), listTools(), defineDeclarativeTool(form, spec)"
test_command: "node --test tests/webmcp_bridge.test.mjs"
budget:
  lines_max: 500
  cyclomatic_max: 15
forbids: ['eval', 'child_process']
tests: tests/webmcp_bridge.test.mjs
tests_sha256: bc07ad8bd85269a3ca8efdc045d0dc0a995304101cb5afa4e3dc9a4605952c9c
touch_only: ['src/js/webmcp-bridge.js']
deps_allowed: []
---

# Contrato: WebMCP Bridge y FastWebMCP Runtime

## Intent
Implementar el runtime puente especificado en [webmcp_spec.md](../data_models/webmcp_spec.md) y [architecture.md](../architecture.md) para registrar y ejecutar herramientas de agentes autonomos.

## Interface
- `registerTool(tool: object): object`
- `callTool(name: string, args?: object): Promise<any>`
- `listTools(): object[]`
- `defineDeclarativeTool(formElement: Element, spec: object): object`
- Herramientas incorporadas:
  - `calculate`
  - `get_weather`
  - `convert_currency`
  - `kdd_validate_schema`

## Invariants
- Toda invocacion a `callTool` con un nombre no registrado debe lanzar un error descriptivo.
- Las herramientas expuestas deben reflejarse tanto en `document.modelContext` como en `window.fastwebmcp`.

## Examples
- `callTool('calculate', { expression: '10 * 5' })` devuelve `{ expression: '10 * 5', result: 50 }`.
- `listTools()` devuelve la coleccion completa de herramientas disponibles para el agente de IA.

## Do / Don't
- **DO:** Permitir herramientas declarativas asociadas a formularios HTML con atributos `toolname`.
- **DON'T:** Permitir el registro de herramientas que carezcan de un nombre o de una funcion `execute`.

## Tests
El oraculo de pruebas unitarias esta sellado en `tests/webmcp_bridge.test.mjs` y se ejecuta con:
`node --test tests/webmcp_bridge.test.mjs`

## Constraints
- Compatible con el estandar propuesto por W3C Web Machine Learning Community Group y webmcp.com.
- PARAR y reportar si el navegador no permite definir `document.modelContext` o si se intenta invocar una herramienta con argumentos incompatibles.
