---
type: 'Data Model'
title: 'Especificacion de Herramientas WebMCP y FastWebMCP'
description: 'Estructura de registro de herramientas en document.modelContext y fastwebmcp para agentes de IA.'
tags: ['data-model', 'webmcp', 'fastwebmcp', 'tools', 'schema']
---

# Especificacion de Herramientas WebMCP y FastWebMCP

Define la interfaz mediante la cual el sistema se conecta con [architecture.md](../architecture.md) y permite a los agentes de IA descubrir y ejecutar capacidades de la pagina.

## Objeto de Declaracion de Herramienta

```json
{
  "name": "calculate",
  "description": "Performs mathematical calculations.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "expression": { "type": "string" }
    },
    "required": ["expression"]
  },
  "source": "builtin"
}
```

## Declarative Tool Attributes (FastWebMCP)

En formularios HTML, FastWebMCP aplica los siguientes atributos normativos:
- `toolname`: Nombre unico de la herramienta.
- `tooldescription`: Descripcion de la capacidad que ejecuta el formulario.
- `toolparamdescription`: Descripcion en cada campo `<input>` o `<select>`.
