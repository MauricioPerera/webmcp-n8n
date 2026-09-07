---
type: 'Data Model'
title: 'Modelo de Datos del Flujo y Nodos n8n'
description: 'Estructura de datos para workflows, nodos, conexiones, items y ejecucion segun la especificacion KDD.'
tags: ['data-model', 'workflow', 'nodes', 'connections', 'n8n']
---

# Modelo de Datos del Flujo y Nodos n8n

Este modelo define la representacion estructurada del grafo de automatizacion documentado en [architecture.md](../architecture.md).

## Estructura del Flujo de Trabajo (Workflow)

```json
{
  "id": "wf_1725700000000",
  "name": "My Workflow",
  "nodes": [],
  "connections": [],
  "updatedAt": "2026-09-07T00:00:00.000Z"
}
```

## Estructura de Nodo (Node)

```json
{
  "id": "node_1725700000000_abc123",
  "type": "if_conditional",
  "name": "IF Condition",
  "position": { "x": 300, "y": 200 },
  "params": {
    "field": "{{ $json.status }}",
    "operator": "==",
    "value": "active"
  },
  "disabled": false
}
```

## Estructura de Conexion (Connection)

```json
{
  "id": "conn_1725700000000_xyz789",
  "fromNodeId": "node_1",
  "fromOutput": "true",
  "toNodeId": "node_2",
  "toInput": "main"
}
```

## Formato Estandar de Items (Item Data Flow)

Toda comunicacion entre nodos fluye como un arreglo de objetos tipados:

```json
[
  {
    "json": {
      "id": 1,
      "title": "Document",
      "valid": true
    }
  }
]
```
