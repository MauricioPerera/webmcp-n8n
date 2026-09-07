---
type: 'Architecture'
title: 'Arquitectura Client-Side n8n KDD'
description: 'Arquitectura del sistema de automatizacion de flujos 100% en el navegador con motor DAG, HTMX, Tailwind y FastWebMCP.'
tags: ['architecture', 'n8n', 'dag', 'client-side', 'webmcp']
---

# Arquitectura Client-Side n8n KDD

El sistema implementa una arquitectura orientada a grafos aciclicos dirigidos (DAG) completamente desacoplada de servidores de backend, permitiendo su despliegue estatico en GitHub Pages.

## Componentes del Sistema

1. **Capa de Presentacion (Tailwind CSS + HTMX):**
   - Lienzo infinito con pan, zoom y transformaciones CSS.
   - Cables SVG con curvas de Bezier cubicas y animaciones fluidas de flujo de datos.
   - Drawer modal impulsado por eventos reactivos y renderizado declarativo con HTMX.

2. **Motor de Ejecucion DAG (src/js/dag-engine.js):**
   - Ordenamiento topologico para determinar la secuencia de ejecucion segun dependencias.
   - Deteccion determinista de ciclos para garantizar la integridad aciclica.
   - Enrutamiento multi-puerto (ramificaciones condicionales `true` y `false` para nodos IF).
   - Pipeline de datos basado en el estandar n8n: `[ { json: {...} } ]`.

3. **Bridge WebMCP y FastWebMCP (src/js/webmcp-bridge.js):**
   - Integracion nativa con `document.modelContext` y `navigator.modelContext`.
   - Soporte para herramientas declarativas sobre formularios DOM.
   - Exposicion de flujos de trabajo como herramientas MCP invocables por agentes externos.

Vea los modelos de datos en [workflow_model.md](data_models/workflow_model.md) y la especificacion de herramientas en [webmcp_spec.md](data_models/webmcp_spec.md).
