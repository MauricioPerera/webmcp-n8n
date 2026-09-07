# n8n KDD — 100% Client-Side Workflow Automation

> **Clon 100% funcional de [n8n](https://n8n.io/) listo para desplegar en GitHub Pages (cero dependencias de backend).**
> Construido con **Tailwind CSS**, **HTMX**, gobernado bajo **KDD (Knowledge-Driven Development)** de [MauricioPerera/KDD](https://github.com/MauricioPerera/KDD) y habilitado para agentes autónomos mediante **FastWebMCP / WebMCP standard** ([webmcp.com](https://webmcp.com) y [fastwebmcp](https://mauricioperera.github.io/fastwebmcp/)).

---

## 🌟 Características Principales

### 1. Lienzo Visual Interactivo (Fiel a la Experiencia n8n)
- **Lienzo Infinito:** Desplazamiento fluido (*pan* con arrastre del fondo, botón central o `Espacio + Arrastre`), zoom centrado en el cursor (`25%` a `250%`), botones de control (*Fit to View*, *100%*, *Zoom In/Out*).
- **Fondo de Grilla:** Estilo de matriz de puntos n8n (`dot matrix`) con modo oscuro elegante y moderno (`#141416` / `#18181c`).
- **Tarjetas de Nodos (Node Cards):**
  - Iconos por categoría y colores oficiales de n8n:
    - 🟢 **Triggers** (`#10b981`): Puntos de entrada del flujo.
    - 🔵 **Logic & Routing** (`#3b82f6`): Control de flujo y bifurcación condicional.
    - 🟣 **Data Transform** (`#8b5cf6`): Manipulación y transformación de ítems.
    - 🟡 **Network & APIs** (`#f59e0b`): Peticiones HTTP fetch desde el cliente.
    - 🌸 **AI & WebMCP** (`#ec4899`): Agentes de IA, herramientas WebMCP y compuertas KDD.
  - Puertos de entrada (izquierda) y salidas múltiples (derecha). Soporte para salidas diferenciadas (ej: salidas **True** y **False** en nodos **IF**).
  - Indicadores de estado en tiempo real: *Ready*, *Running* (pulso animado), *Success* (verde + tiempo de ejecución en ms), *Error* (rojo con tooltip).
  - Acciones rápidas: Duplicar (`Ctrl+D`), Desactivar/Activar, Eliminar (`Delete`/`Backspace`), y Configurar (Doble click).
- **Cables y Conexiones Dinámicas (Wires):**
  - Curvas de Bézier cúbicas fluidas entre puertos.
  - Conexión interactiva: arrastre desde un puerto de salida hacia un puerto de entrada con previsualización magnética y validación contra ciclos.
  - **Líneas de flujo animadas:** Durante la ejecución o al finalizar con éxito, los cables muestran una animación continua de partículas que refleja el paso de datos.
- **Minimapa Flotante:** Visor interactivo en la esquina inferior derecha con representación de todos los nodos y el campo visual activo.

### 2. Catálogo de Nodos 100% Funcionales
| Categoría | Nodo | Descripción y Funcionalidad |
| :--- | :--- | :--- |
| **Triggers** | **Manual Trigger** | Inicia el flujo manualmente al pulsar "Test workflow". |
| **Triggers** | **Schedule Trigger** | Ejecuta el flujo periódicamente (cada N segundos). |
| **Triggers** | **Event / Webhook** | Escucha eventos del navegador (`window.postMessage`, eventos DOM personalizados o URL params). |
| **Triggers** | **WebMCP Tool Trigger** | Se activa automáticamente cuando un Agente de IA invoca la herramienta WebMCP registrada. |
| **Lógica** | **IF (Conditional)** | Evalúa condiciones (`==`, `!=`, `>`, `<`, `>=`, `<=`, `contains`, `is_empty`) y bifurca a la rama **True** o **False**. |
| **Lógica** | **Switch** | Enrutador multi-rama basado en reglas de coincidencia. |
| **Lógica** | **Filter** | Filtra ítems entrantes descartando los que no cumplan la condición. |
| **Lógica** | **Merge** | Combina datos de múltiples ramas (Append, Merge by Key). |
| **Transform** | **Code (JavaScript)** | Sandbox JS con sintaxis n8n: manipulación de `items`, `$input.all()`, `$json`, `$node["Nombre"].json`. |
| **Transform** | **Edit Fields (Set)** | Agrega o actualiza campos usando valores fijos o expresiones `{{ $json.campo }}`. |
| **Transform** | **JSON Transform** | Parsea cadenas JSON o convierte objetos en cadenas JSON legibles. |
| **Transform** | **OKF / Markdown Parser** | Parsea documentos markdown con Frontmatter YAML del estándar KDD/OKF a objetos JSON estructurados. |
| **Red** | **HTTP Request** | `fetch` completo desde el cliente: GET, POST, PUT, DELETE, PATCH, cabeceras personalizadas, payload JSON/Form y opción de Proxy CORS. |
| **IA & MCP** | **WebMCP Tool Call** | Ejecuta cualquier herramienta registrada en `document.modelContext`, `navigator.modelContext` o `window.fastwebmcp`. |
| **IA & MCP** | **FastWebMCP Form Adapter**| Vincula formularios declarativos (`toolname`, `tooldescription`) de la página. |
| **IA & MCP** | **AI Agent (LLM)** | Ejecuta prompts de IA vía endpoints compatibles con OpenAI / Gemini / Groq / Ollama local (`http://localhost:11434`) o modo offline simulado con soporte de herramientas WebMCP. |
| **IA & MCP** | **WebMCP Server Exporter**| Registra dinámicamente el flujo como una herramienta WebMCP disponible en el navegador para otros agentes. |
| **IA & MCP** | **KDD Contract Gate** | Valida el payload de datos contra un contrato CCDD o esquema JSON estricto antes de permitir continuar la ejecución. |

### 3. Panel de Configuración de Nodo (Drawer Modal)
- Doble click en cualquier nodo abre el drawer contextual:
  - **Pestaña Parámetros:** Formulario dinámico impulsado por HTMX y plantillas reactivas (selectores, inputs de texto, toggle de expresiones, editor de código para nodos JS, configurador de condiciones para IF).
  - **Pestaña Input Data:** Visualizador de datos de entrada estructurados en JSON recibidos de los nodos previos en el pipeline (`[ { json: {...} } ]`).
  - **Pestaña Output Data:** Vista en vivo del resultado de salida con botón "Test Step" para depurar paso a paso de forma aislada.
  - **Pestaña KDD & WebMCP:** Inspector de contratos CCDD asociados y estado de herramientas WebMCP.

### 4. Plantillas Preconfiguradas (Ready-to-run)
1. **FastWebMCP Autonomous Agent:** Trigger manual -> WebMCP Tool Call (get_weather) -> AI Agent (con herramientas WebMCP) -> Formateo final.
2. **KDD Contract Quality Gate:** Ingesta de datos -> KDD Contract Gate -> IF Valid -> Rama True a producción y Rama False a log de errores.
3. **Public API & Data Flow:** HTTP Request a JSONPlaceholder -> Enriquecimiento con código JS -> Exposición de métricas como herramienta WebMCP.
4. **FastWebMCP Form Submission Bridge:** WebMCP Trigger -> Anotación de formulario declarativo -> Cálculo matemático -> Despacho de confirmación.

### 5. FastWebMCP y WebMCP Standard ([webmcp.com](https://webmcp.com))
El sistema implementa el estándar emergente **WebMCP** para que agentes de IA colaboren e interactúen con la página:
- Detección y registro en `document.modelContext.registerTool` y `navigator.modelContext`.
- Soporte para la biblioteca `fastwebmcp` de Mauricio Perera (`defineTool`, `defineDeclarativeTool`, esquemas Zod).
- **Consola WebMCP Explorer:** Modal interactivo para inspeccionar esquemas JSON Schema y probar herramientas en tiempo real.

---

## 🚀 Despliegue en GitHub Pages (100% Client-Side)

Al ser una aplicación 100% estática (HTML5, ES Modules, CSS, SVG), el despliegue es inmediato y sin pasos de compilación en servidor:

1. Crea un repositorio en GitHub (ej. `n8n-kdd`).
2. Sube el contenido de este directorio a la rama `main`:
   ```bash
   git init
   git add .
   git commit -m "feat: 100% functional n8n clone for GitHub Pages"
   git remote add origin https://github.com/<tu-usuario>/<tu-repo>.git
   git push -u origin main
   ```
3. En tu repositorio de GitHub, ve a **Settings** -> **Pages**.
4. En **Build and deployment** -> **Source**, selecciona **Deploy from a branch**.
5. Elige la rama `main` y la carpeta `/ (root)`.
6. Haz click en **Save**. En pocos segundos tu instancia de n8n estará online en:
   `https://<tu-usuario>.github.io/<tu-repo>/`

---

## 💻 Ejecución Local

Para probarlo localmente, puedes servirlo con cualquier servidor HTTP estático:

```bash
# Opción 1: Con Python
python -m http.server 8080

# Opción 2: Con Node / npm
npm run serve
```

Abre `http://localhost:8080` en tu navegador.

---

## 🧠 Gobernanza KDD (Knowledge-Driven Development)

El proyecto sigue rigurosamente el estándar [MauricioPerera/KDD](https://github.com/MauricioPerera/KDD):
- `knowledge/`: Base de conocimiento OKF con nodos interconectados y YAML frontmatter normativo.
- `knowledge/contracts/`: Contratos de tareas CCDD con firmas congeladas y hashes SHA-256 inmutables de pruebas.
- `scripts/`: Validadores deterministas en Python stdlib.

### Ejecutar todas las compuertas de calidad:
```bash
npm run validate:all
```
Esto ejecutará:
1. Suite de pruebas unitarias (`node --test tests/*.test.mjs`)
2. Validador de conformidad OKF (`python scripts/validate_okf.py`)
3. Validador de contratos CCDD (`python scripts/validate_contracts.py`)

---

## 📜 Licencia

Distribuido bajo la Licencia MIT.
