# Base de Conocimiento n8n KDD (OKF + CCDD)

Bienvenido a la base de conocimiento normativa del clon 100% funcional de n8n para GitHub Pages, gobernada por los principios de **Knowledge-Driven Development (KDD)** de [MauricioPerera/KDD](https://github.com/MauricioPerera/KDD) y el estándar **WebMCP / FastWebMCP** ([webmcp.com](https://webmcp.com) y [fastwebmcp](https://mauricioperera.github.io/fastwebmcp/)).

## 🏛️ Arquitectura del Sistema
- [architecture.md](architecture.md): Especificación de la arquitectura client-side y el motor DAG.

## 📊 Modelos de Datos
- [data_models/workflow_model.md](data_models/workflow_model.md): Estructura de workflows, nodos, conexiones y pipeline de datos por ítems.
- [data_models/webmcp_spec.md](data_models/webmcp_spec.md): Especificación de herramientas WebMCP y formularios declarativos FastWebMCP.

## 📜 Contratos de Tareas CCDD (Task Contracts)
- [contracts/dag_engine_contract.md](contracts/dag_engine_contract.md): Contrato del motor DAG, ordenamiento topológico y resolución de ciclos.
- [contracts/node_execution_contract.md](contracts/node_execution_contract.md): Contrato del catálogo y ejecución de nodos estándar.
- [contracts/webmcp_bridge_contract.md](contracts/webmcp_bridge_contract.md): Contrato del runtime puente WebMCP y FastWebMCP.
