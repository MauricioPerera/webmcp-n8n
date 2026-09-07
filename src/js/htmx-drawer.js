/**
 * n8n-kdd: HTMX Node Configuration Drawer
 * Provides an n8n-accurate 3-column drawer: Input Data preview,
 * Dynamic HTMX parameter form, Output Data preview and KDD contract inspector.
 */

import { NODE_DEFINITIONS, NODE_CATEGORIES } from './node-registry.js';

export class HtmxDrawer {
  constructor(drawerContainer, dagEngine) {
    this.container = drawerContainer;
    this.engine = dagEngine;
    this.activeNodeId = null;
    this.activeTab = 'params';

    this.initDom();
    this.initEvents();
  }

  initDom() {
    this.container.innerHTML = `
      <div class="drawer-backdrop fixed inset-0 bg-black/60 backdrop-blur-sm z-40 hidden transition-opacity"></div>
      <div class="drawer-panel fixed inset-y-0 right-0 w-full max-w-2xl bg-[#1b1b1f] border-l border-neutral-800 shadow-2xl z-50 flex flex-col transform translate-x-full transition-transform duration-200">
        <!-- Header -->
        <div class="p-4 border-b border-neutral-800 flex items-center justify-between bg-[#141416]">
          <div class="flex items-center gap-3">
            <div id="drawer-node-icon" class="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-500/20 text-blue-400">
              <i data-lucide="box" class="w-5 h-5"></i>
            </div>
            <div>
              <input id="drawer-node-name" type="text" class="bg-transparent text-neutral-100 font-semibold text-base border-b border-transparent hover:border-neutral-700 focus:border-blue-500 focus:bg-[#202025] px-1 py-0.5 rounded outline-none w-64" />
              <div id="drawer-node-type" class="text-xs text-neutral-400 px-1">Node Type</div>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button id="drawer-test-step-btn" class="px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium flex items-center gap-1.5 transition-colors shadow-sm">
              <i data-lucide="play" class="w-3.5 h-3.5"></i> Test step
            </button>
            <button id="drawer-close-btn" class="w-8 h-8 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 flex items-center justify-center transition-colors">
              <i data-lucide="x" class="w-5 h-5"></i>
            </button>
          </div>
        </div>

        <!-- Navigation Tabs -->
        <div class="flex border-b border-neutral-800 px-4 bg-[#18181c] text-xs font-medium text-neutral-400">
          <button class="drawer-tab-btn py-2.5 px-4 border-b-2 border-blue-500 text-blue-400 flex items-center gap-1.5" data-tab="params">
            <i data-lucide="sliders" class="w-3.5 h-3.5"></i> Parameters
          </button>
          <button class="drawer-tab-btn py-2.5 px-4 border-b-2 border-transparent hover:text-neutral-200 flex items-center gap-1.5" data-tab="input">
            <i data-lucide="arrow-down-left" class="w-3.5 h-3.5"></i> Input Data <span id="drawer-input-count" class="px-1.5 py-0.2 rounded-full bg-neutral-800 text-[10px] text-neutral-400">0</span>
          </button>
          <button class="drawer-tab-btn py-2.5 px-4 border-b-2 border-transparent hover:text-neutral-200 flex items-center gap-1.5" data-tab="output">
            <i data-lucide="arrow-up-right" class="w-3.5 h-3.5"></i> Output Data <span id="drawer-output-count" class="px-1.5 py-0.2 rounded-full bg-neutral-800 text-[10px] text-neutral-400">0</span>
          </button>
          <button class="drawer-tab-btn py-2.5 px-4 border-b-2 border-transparent hover:text-neutral-200 flex items-center gap-1.5" data-tab="contract">
            <i data-lucide="shield-check" class="w-3.5 h-3.5"></i> KDD & WebMCP
          </button>
        </div>

        <!-- Tab Contents -->
        <div class="flex-1 overflow-y-auto p-5 text-neutral-200 space-y-4">
          <div id="drawer-tab-params" class="drawer-tab-content space-y-4"></div>

          <div id="drawer-tab-input" class="drawer-tab-content hidden space-y-3">
            <div class="flex items-center justify-between text-xs text-neutral-400 pb-2 border-b border-neutral-800">
              <span>Items received from upstream nodes:</span>
              <span class="font-mono text-neutral-500">n8n item standard: [ { json: {...} } ]</span>
            </div>
            <div id="drawer-input-json" class="p-3 bg-[#141416] rounded-lg border border-neutral-800 font-mono text-xs overflow-x-auto text-emerald-400"></div>
          </div>

          <div id="drawer-tab-output" class="drawer-tab-content hidden space-y-3">
            <div class="flex items-center justify-between text-xs text-neutral-400 pb-2 border-b border-neutral-800">
              <span>Items produced by this step:</span>
              <span id="drawer-output-status-pill" class="px-2 py-0.5 rounded text-[10px] font-medium bg-neutral-800 text-neutral-400">No output yet</span>
            </div>
            <div id="drawer-output-json" class="p-3 bg-[#141416] rounded-lg border border-neutral-800 font-mono text-xs overflow-x-auto text-sky-400"></div>
          </div>

          <div id="drawer-tab-contract" class="drawer-tab-content hidden space-y-4 text-xs">
            <div class="p-4 bg-[#141416] rounded-lg border border-neutral-800 space-y-3">
              <div class="flex items-center gap-2 text-sm font-semibold text-blue-400">
                <i data-lucide="shield" class="w-4 h-4"></i> KDD (Knowledge-Driven Development) Specification
              </div>
              <p class="text-neutral-400 leading-relaxed">
                Este nodo opera como un contrato determinista bajo la especificación <span class="text-neutral-200 font-mono">CCDD v0.3</span> y <span class="text-neutral-200 font-mono">OKF</span>.
                Todas las entradas y salidas están tipadas y aisladas sin efectos colaterales.
              </p>
              <div id="drawer-kdd-details" class="font-mono text-[11px] text-neutral-300 bg-[#0f0f11] p-3 rounded border border-neutral-800/80"></div>
            </div>

            <div class="p-4 bg-[#141416] rounded-lg border border-neutral-800 space-y-3">
              <div class="flex items-center gap-2 text-sm font-semibold text-pink-400">
                <i data-lucide="cpu" class="w-4 h-4"></i> WebMCP / FastWebMCP Status
              </div>
              <p class="text-neutral-400 leading-relaxed">
                Compatible con la API nativa de navegador <span class="text-neutral-200 font-mono">document.modelContext</span> y el SDK <span class="text-neutral-200 font-mono">fastwebmcp</span>.
              </p>
              <div id="drawer-webmcp-details" class="font-mono text-[11px] text-neutral-300 bg-[#0f0f11] p-3 rounded border border-neutral-800/80"></div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="p-4 border-t border-neutral-800 bg-[#141416] flex items-center justify-between">
          <button id="drawer-delete-node-btn" class="text-rose-400 hover:text-rose-300 text-xs flex items-center gap-1.5">
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i> Delete node
          </button>
          <div class="flex items-center gap-2">
            <button id="drawer-done-btn" class="px-4 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium shadow-sm transition-colors">
              Save & Close
            </button>
          </div>
        </div>
      </div>
    `;

    this.backdrop = this.container.querySelector('.drawer-backdrop');
    this.panel = this.container.querySelector('.drawer-panel');
    this.nodeNameInput = this.container.querySelector('#drawer-node-name');
    this.nodeTypeEl = this.container.querySelector('#drawer-node-type');
    this.nodeIconEl = this.container.querySelector('#drawer-node-icon');
    this.paramsTab = this.container.querySelector('#drawer-tab-params');
    this.inputJsonEl = this.container.querySelector('#drawer-input-json');
    this.outputJsonEl = this.container.querySelector('#drawer-output-json');
    this.inputCountEl = this.container.querySelector('#drawer-input-count');
    this.outputCountEl = this.container.querySelector('#drawer-output-count');
    this.outputStatusPill = this.container.querySelector('#drawer-output-status-pill');
    this.kddDetailsEl = this.container.querySelector('#drawer-kdd-details');
    this.webmcpDetailsEl = this.container.querySelector('#drawer-webmcp-details');
  }

  initEvents() {
    const closeDrawer = () => this.close();
    this.container.querySelector('#drawer-close-btn').addEventListener('click', closeDrawer);
    this.container.querySelector('#drawer-done-btn').addEventListener('click', closeDrawer);
    this.backdrop.addEventListener('click', closeDrawer);

    this.container.querySelectorAll('.drawer-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        this.switchTab(tab);
      });
    });

    this.nodeNameInput.addEventListener('change', (e) => {
      if (this.activeNodeId) {
        this.engine.renameNode(this.activeNodeId, e.target.value.trim());
      }
    });

    this.container.querySelector('#drawer-delete-node-btn').addEventListener('click', () => {
      if (this.activeNodeId && confirm('Are you sure you want to delete this node?')) {
        this.engine.removeNode(this.activeNodeId);
        this.close();
      }
    });

    this.container.querySelector('#drawer-test-step-btn').addEventListener('click', async () => {
      if (!this.activeNodeId) return;
      await this.testSingleStep();
    });
  }

  switchTab(tab) {
    this.activeTab = tab;
    this.container.querySelectorAll('.drawer-tab-btn').forEach(btn => {
      const active = btn.dataset.tab === tab;
      btn.className = `drawer-tab-btn py-2.5 px-4 border-b-2 flex items-center gap-1.5 ${
        active ? 'border-blue-500 text-blue-400' : 'border-transparent text-neutral-400 hover:text-neutral-200'
      }`;
    });

    this.container.querySelectorAll('.drawer-tab-content').forEach(c => c.classList.add('hidden'));
    const target = this.container.querySelector(`#drawer-tab-${tab}`);
    if (target) target.classList.remove('hidden');

    if (window.lucide) window.lucide.createIcons();
  }

  open(node) {
    this.activeNodeId = node.id;
    const def = NODE_DEFINITIONS[node.type] || { name: node.type, category: 'transform', icon: 'box' };
    const cat = NODE_CATEGORIES[def.category] || NODE_CATEGORIES.transform;

    this.nodeNameInput.value = node.name;
    this.nodeTypeEl.textContent = `${def.name} • ${cat.name}`;
    this.nodeIconEl.style.backgroundColor = cat.bg;
    this.nodeIconEl.style.color = cat.color;
    this.nodeIconEl.innerHTML = `<i data-lucide="${def.icon || 'box'}" class="w-5 h-5"></i>`;

    this.renderParametersForm(node, def);
    this.updateDataTabs(node.id);
    this.renderKddWebMcpDetails(node, def);

    this.switchTab('params');

    this.backdrop.classList.remove('hidden');
    setTimeout(() => {
      this.panel.classList.remove('translate-x-full');
    }, 10);

    if (window.lucide) window.lucide.createIcons();
  }

  close() {
    this.panel.classList.add('translate-x-full');
    setTimeout(() => {
      this.backdrop.classList.add('hidden');
      this.activeNodeId = null;
    }, 200);
  }

  updateDataTabs(nodeId) {
    const exec = this.engine.executionData.get(nodeId) || { input: [], output: [], status: 'idle' };

    const inItems = exec.input || [];
    this.inputCountEl.textContent = inItems.length;
    this.inputJsonEl.innerHTML = `<pre>${JSON.stringify(inItems, null, 2)}</pre>`;

    const outItems = exec.output || [];
    this.outputCountEl.textContent = outItems.length;
    this.outputJsonEl.innerHTML = `<pre>${JSON.stringify(outItems, null, 2)}</pre>`;

    if (exec.status === 'success') {
      this.outputStatusPill.className = 'px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
      this.outputStatusPill.textContent = `✓ Success (${exec.duration}ms)`;
    } else if (exec.status === 'error') {
      this.outputStatusPill.className = 'px-2 py-0.5 rounded text-[10px] font-medium bg-rose-500/20 text-rose-400 border border-rose-500/30';
      this.outputStatusPill.textContent = `✕ Error: ${exec.error || 'Failed'}`;
    } else {
      this.outputStatusPill.className = 'px-2 py-0.5 rounded text-[10px] font-medium bg-neutral-800 text-neutral-400';
      this.outputStatusPill.textContent = 'No execution output';
    }
  }

  renderKddWebMcpDetails(node, def) {
    this.kddDetailsEl.innerHTML = `
contract: knowledge/contracts/${node.type}.md
type: "Task Contract"
task: "${node.name}"
inputs: [${(def.inputs || []).map(i => `"${i}"`).join(', ')}]
outputs: [${(def.outputs || []).map(o => `"${o}"`).join(', ')}]
category: "${def.category}"
invariants: ["item-based data pipeline", "deterministic output"]
    `.trim();

    this.webmcpDetailsEl.innerHTML = `
document.modelContext.active: true
fastwebmcp_support: true
tool_registered: "${node.params.toolName || node.name}"
schema_validated: true
browser_side_only: 100% (zero backend required)
    `.trim();
  }

  renderParametersForm(node, def) {
    const p = node.params || {};
    let formHtml = '';

    if (node.type === 'manual_trigger') {
      formHtml = `
        <div class="p-4 bg-[#141416] rounded-lg border border-neutral-800 text-xs text-neutral-400 space-y-2">
          <p class="font-medium text-neutral-200">Trigger manual de flujo</p>
          <p>Este nodo inicia la ejecución cuando haces click en el botón <strong>"Test workflow"</strong> en la barra superior.</p>
          <p class="text-neutral-500 font-mono">No requiere configuración adicional.</p>
        </div>
      `;
    } else if (node.type === 'schedule_trigger') {
      formHtml = `
        <div class="space-y-3">
          <label class="block text-xs font-medium text-neutral-300">Intervalo de Ejecución (segundos)</label>
          <input type="number" name="intervalSeconds" value="${p.intervalSeconds || 10}" min="1" max="3600"
                 class="param-input w-full bg-[#141416] border border-neutral-700 focus:border-blue-500 rounded px-3 py-2 text-xs text-neutral-100 outline-none" />
        </div>
      `;
    } else if (node.type === 'if_conditional') {
      formHtml = `
        <div class="space-y-4">
          <div>
            <label class="block text-xs font-medium text-neutral-300 mb-1">Campo o Expresión (Izquierda)</label>
            <input type="text" name="field" value="${p.field || '{{ $json.value }}'}"
                   class="param-input w-full bg-[#141416] border border-neutral-700 focus:border-blue-500 rounded px-3 py-2 text-xs font-mono text-neutral-100 outline-none" />
            <span class="text-[10px] text-neutral-500 mt-1 block">Ejemplo: {{ $json.status }} o {{ $json.age }}</span>
          </div>

          <div>
            <label class="block text-xs font-medium text-neutral-300 mb-1">Operador de Comparación</label>
            <select name="operator" class="param-input w-full bg-[#141416] border border-neutral-700 focus:border-blue-500 rounded px-3 py-2 text-xs text-neutral-100 outline-none">
              <option value="==" ${p.operator === '==' ? 'selected' : ''}>Igual a (==)</option>
              <option value="!=" ${p.operator === '!=' ? 'selected' : ''}>Diferente de (!=)</option>
              <option value=">" ${p.operator === '>' ? 'selected' : ''}>Mayor que (>)</option>
              <option value="<" ${p.operator === '<' ? 'selected' : ''}>Menor que (<)</option>
              <option value=">=" ${p.operator === '>=' ? 'selected' : ''}>Mayor o igual (>=)</option>
              <option value="<=" ${p.operator === '<=' ? 'selected' : ''}>Menor o igual (<=)</option>
              <option value="contains" ${p.operator === 'contains' ? 'selected' : ''}>Contiene texto (contains)</option>
              <option value="not_contains" ${p.operator === 'not_contains' ? 'selected' : ''}>No contiene (not contains)</option>
              <option value="is_empty" ${p.operator === 'is_empty' ? 'selected' : ''}>Está vacío (is empty)</option>
              <option value="is_not_empty" ${p.operator === 'is_not_empty' ? 'selected' : ''}>No está vacío (is not empty)</option>
            </select>
          </div>

          <div>
            <label class="block text-xs font-medium text-neutral-300 mb-1">Valor Comparado (Derecha)</label>
            <input type="text" name="value" value="${p.value || 'true'}"
                   class="param-input w-full bg-[#141416] border border-neutral-700 focus:border-blue-500 rounded px-3 py-2 text-xs font-mono text-neutral-100 outline-none" />
          </div>
        </div>
      `;
    } else if (node.type === 'code_javascript') {
      formHtml = `
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <label class="block text-xs font-medium text-neutral-300">Código JavaScript (Sandbox n8n)</label>
            <span class="text-[10px] text-neutral-500 font-mono">Disponibles: $input, items, $node, $now</span>
          </div>
          <textarea name="code" rows="12" class="param-input w-full bg-[#141416] border border-neutral-700 focus:border-blue-500 rounded-lg p-3 text-xs font-mono text-emerald-400 outline-none leading-relaxed">${p.code || ''}</textarea>
          <div class="text-[11px] text-neutral-400 bg-[#18181c] p-2.5 rounded border border-neutral-800">
            <strong>Ejemplo:</strong><br/>
            <code>for (const item of $input.all()) { item.json.total = item.json.qty * item.json.price; }<br/>return $input.all();</code>
          </div>
        </div>
      `;
    } else if (node.type === 'http_request') {
      formHtml = `
        <div class="space-y-4">
          <div class="grid grid-cols-4 gap-2">
            <div class="col-span-1">
              <label class="block text-xs font-medium text-neutral-300 mb-1">Método</label>
              <select name="method" class="param-input w-full bg-[#141416] border border-neutral-700 focus:border-blue-500 rounded px-3 py-2 text-xs text-neutral-100 outline-none">
                <option value="GET" ${p.method === 'GET' ? 'selected' : ''}>GET</option>
                <option value="POST" ${p.method === 'POST' ? 'selected' : ''}>POST</option>
                <option value="PUT" ${p.method === 'PUT' ? 'selected' : ''}>PUT</option>
                <option value="DELETE" ${p.method === 'DELETE' ? 'selected' : ''}>DELETE</option>
                <option value="PATCH" ${p.method === 'PATCH' ? 'selected' : ''}>PATCH</option>
              </select>
            </div>
            <div class="col-span-3">
              <label class="block text-xs font-medium text-neutral-300 mb-1">URL</label>
              <input type="text" name="url" value="${p.url || ''}"
                     class="param-input w-full bg-[#141416] border border-neutral-700 focus:border-blue-500 rounded px-3 py-2 text-xs font-mono text-neutral-100 outline-none" />
            </div>
          </div>

          <div>
            <label class="block text-xs font-medium text-neutral-300 mb-1">Body (JSON / Texto)</label>
            <textarea name="body" rows="4" class="param-input w-full bg-[#141416] border border-neutral-700 focus:border-blue-500 rounded p-3 text-xs font-mono text-neutral-100 outline-none">${p.body || ''}</textarea>
          </div>

          <div class="flex items-center gap-2">
            <input type="checkbox" id="param-cors" name="useCorsProxy" ${p.useCorsProxy ? 'checked' : ''} class="param-input rounded bg-[#141416] border-neutral-700 text-blue-600 focus:ring-0" />
            <label for="param-cors" class="text-xs text-neutral-300">Usar Proxy CORS (para peticiones cross-origin desde navegador)</label>
          </div>
        </div>
      `;
    } else if (node.type === 'edit_fields_set') {
      const assignments = p.assignments || [];
      formHtml = `
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <label class="block text-xs font-medium text-neutral-300">Asignaciones de Campos</label>
            <button type="button" id="add-assignment-btn" class="px-2 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs rounded border border-neutral-700">
              + Agregar campo
            </button>
          </div>
          <div id="assignments-list" class="space-y-2">
            ${assignments.map((a, idx) => `
              <div class="flex items-center gap-2 assignment-row">
                <input type="text" placeholder="Nombre de campo" value="${a.field}" class="assign-field w-1/3 bg-[#141416] border border-neutral-700 rounded px-2.5 py-1.5 text-xs text-neutral-100 outline-none" />
                <input type="text" placeholder="Valor o {{ $json.x }}" value="${a.value}" class="assign-value flex-1 bg-[#141416] border border-neutral-700 rounded px-2.5 py-1.5 text-xs font-mono text-neutral-100 outline-none" />
                <button type="button" class="remove-assign-btn text-neutral-500 hover:text-rose-400 p-1">✕</button>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    } else if (node.type === 'webmcp_tool_call') {
      formHtml = `
        <div class="space-y-4">
          <div>
            <label class="block text-xs font-medium text-neutral-300 mb-1">Nombre de Herramienta WebMCP</label>
            <input type="text" name="toolName" value="${p.toolName || 'calculate'}"
                   class="param-input w-full bg-[#141416] border border-neutral-700 focus:border-blue-500 rounded px-3 py-2 text-xs font-mono text-neutral-100 outline-none" />
            <span class="text-[10px] text-neutral-500 mt-1 block">Herramientas: calculate, get_weather, convert_currency, kdd_validate_schema</span>
          </div>

          <div>
            <label class="block text-xs font-medium text-neutral-300 mb-1">Argumentos en JSON</label>
            <textarea name="argumentsJson" rows="5" class="param-input w-full bg-[#141416] border border-neutral-700 focus:border-blue-500 rounded p-3 text-xs font-mono text-pink-400 outline-none">${p.argumentsJson || '{\n  "expression": "42 * 2"\n}'}</textarea>
          </div>
        </div>
      `;
    } else if (node.type === 'ai_agent_llm') {
      formHtml = `
        <div class="space-y-4">
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-medium text-neutral-300 mb-1">Proveedor LLM</label>
              <select name="provider" class="param-input w-full bg-[#141416] border border-neutral-700 focus:border-blue-500 rounded px-3 py-2 text-xs text-neutral-100 outline-none">
                <option value="browser_mock" ${p.provider === 'browser_mock' ? 'selected' : ''}>Agente WebMCP Autónomo (100% Client Offline)</option>
                <option value="openai_compatible" ${p.provider === 'openai_compatible' ? 'selected' : ''}>OpenAI Compatible (API Key)</option>
                <option value="groq" ${p.provider === 'groq' ? 'selected' : ''}>Groq API</option>
                <option value="ollama" ${p.provider === 'ollama' ? 'selected' : ''}>Ollama Local (http://localhost:11434)</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-medium text-neutral-300 mb-1">Modelo</label>
              <input type="text" name="model" value="${p.model || 'gpt-4o-mini'}"
                     class="param-input w-full bg-[#141416] border border-neutral-700 focus:border-blue-500 rounded px-3 py-2 text-xs text-neutral-100 outline-none" />
            </div>
          </div>

          <div>
            <label class="block text-xs font-medium text-neutral-300 mb-1">System Prompt</label>
            <textarea name="systemPrompt" rows="2" class="param-input w-full bg-[#141416] border border-neutral-700 focus:border-blue-500 rounded p-2.5 text-xs text-neutral-200 outline-none">${p.systemPrompt || ''}</textarea>
          </div>

          <div>
            <label class="block text-xs font-medium text-neutral-300 mb-1">User Prompt (con Expresiones)</label>
            <textarea name="userPrompt" rows="4" class="param-input w-full bg-[#141416] border border-neutral-700 focus:border-blue-500 rounded p-2.5 text-xs font-mono text-neutral-200 outline-none">${p.userPrompt || ''}</textarea>
          </div>

          <div class="flex items-center gap-2">
            <input type="checkbox" id="param-enable-tools" name="enableWebMcpTools" ${p.enableWebMcpTools ? 'checked' : ''} class="param-input rounded bg-[#141416] border-neutral-700 text-blue-600 focus:ring-0" />
            <label for="param-enable-tools" class="text-xs text-neutral-300">Equipar Agente con herramientas registradas en WebMCP</label>
          </div>
        </div>
      `;
    } else if (node.type === 'kdd_contract_gate') {
      const reqFields = (p.requiredFields || []).join(', ');
      formHtml = `
        <div class="space-y-4">
          <div>
            <label class="block text-xs font-medium text-neutral-300 mb-1">Nombre del Contrato CCDD</label>
            <input type="text" name="contractName" value="${p.contractName || 'user_profile_contract'}"
                   class="param-input w-full bg-[#141416] border border-neutral-700 focus:border-blue-500 rounded px-3 py-2 text-xs font-mono text-neutral-100 outline-none" />
          </div>

          <div>
            <label class="block text-xs font-medium text-neutral-300 mb-1">Campos Requeridos (separados por coma)</label>
            <input type="text" id="kdd-required-fields" value="${reqFields}"
                   class="w-full bg-[#141416] border border-neutral-700 focus:border-blue-500 rounded px-3 py-2 text-xs font-mono text-neutral-100 outline-none" />
            <span class="text-[10px] text-neutral-500 mt-1 block">Ejemplo: id, status, email</span>
          </div>
        </div>
      `;
    } else {
      formHtml = `
        <div class="space-y-3">
          <label class="block text-xs font-medium text-neutral-300">Parámetros de Configuración (JSON)</label>
          <textarea id="generic-params-json" rows="8" class="w-full bg-[#141416] border border-neutral-700 focus:border-blue-500 rounded p-3 text-xs font-mono text-neutral-100 outline-none">${JSON.stringify(p, null, 2)}</textarea>
        </div>
      `;
    }

    this.paramsTab.innerHTML = formHtml;
    this.attachFormListeners(node);
  }

  attachFormListeners(node) {
    this.paramsTab.querySelectorAll('.param-input').forEach(input => {
      const update = () => {
        const name = input.name;
        let val;
        if (input.type === 'checkbox') val = input.checked;
        else if (input.type === 'number') val = Number(input.value);
        else val = input.value;

        this.engine.updateNodeParams(node.id, { [name]: val });
      };
      input.addEventListener('input', update);
      input.addEventListener('change', update);
    });

    if (node.type === 'edit_fields_set') {
      const listEl = this.paramsTab.querySelector('#assignments-list');
      const addBtn = this.paramsTab.querySelector('#add-assignment-btn');

      const syncAssignments = () => {
        const rows = listEl.querySelectorAll('.assignment-row');
        const assignments = [];
        rows.forEach(r => {
          const f = r.querySelector('.assign-field').value.trim();
          const v = r.querySelector('.assign-value').value;
          if (f) assignments.push({ field: f, value: v });
        });
        this.engine.updateNodeParams(node.id, { assignments });
      };

      if (addBtn) {
        addBtn.addEventListener('click', () => {
          const div = document.createElement('div');
          div.className = 'flex items-center gap-2 assignment-row';
          div.innerHTML = `
            <input type="text" placeholder="Nombre de campo" class="assign-field w-1/3 bg-[#141416] border border-neutral-700 rounded px-2.5 py-1.5 text-xs text-neutral-100 outline-none" />
            <input type="text" placeholder="Valor" class="assign-value flex-1 bg-[#141416] border border-neutral-700 rounded px-2.5 py-1.5 text-xs font-mono text-neutral-100 outline-none" />
            <button type="button" class="remove-assign-btn text-neutral-500 hover:text-rose-400 p-1">✕</button>
          `;
          listEl.appendChild(div);
          div.querySelectorAll('input').forEach(i => i.addEventListener('input', syncAssignments));
          div.querySelector('.remove-assign-btn').addEventListener('click', () => {
            div.remove();
            syncAssignments();
          });
        });
      }

      listEl.querySelectorAll('.assignment-row').forEach(row => {
        row.querySelectorAll('input').forEach(i => i.addEventListener('input', syncAssignments));
        row.querySelector('.remove-assign-btn')?.addEventListener('click', () => {
          row.remove();
          syncAssignments();
        });
      });
    }

    const kddFieldsInput = this.paramsTab.querySelector('#kdd-required-fields');
    if (kddFieldsInput) {
      kddFieldsInput.addEventListener('input', (e) => {
        const arr = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
        this.engine.updateNodeParams(node.id, { requiredFields: arr });
      });
    }

    const genericJson = this.paramsTab.querySelector('#generic-params-json');
    if (genericJson) {
      genericJson.addEventListener('change', (e) => {
        try {
          const parsed = JSON.parse(e.target.value);
          this.engine.updateNodeParams(node.id, parsed);
        } catch {}
      });
    }
  }

  async testSingleStep() {
    if (!this.activeNodeId) return;
    const node = this.engine.nodes.get(this.activeNodeId);
    if (!node) return;

    const def = NODE_DEFINITIONS[node.type];
    if (!def) return;

    const btn = this.container.querySelector('#drawer-test-step-btn');
    btn.disabled = true;
    btn.innerHTML = `<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i> Running...`;

    const incomingConns = this.engine.connections.filter(c => c.toNodeId === node.id);
    let inputItems = [];
    for (const c of incomingConns) {
      const upExec = this.engine.executionData.get(c.fromNodeId);
      if (upExec && upExec.output) {
        inputItems = inputItems.concat(upExec.output);
      }
    }
    if (inputItems.length === 0) {
      inputItems = [{ json: { timestamp: new Date().toISOString(), test: true } }];
    }

    const startTime = Date.now();
    try {
      const result = await def.execute(node.params, inputItems, { triggerPayload: {}, nodeOutputs: {} });
      const duration = Date.now() - startTime;

      let finalOutput = [];
      if (result && typeof result === 'object' && 'outputRouting' in result) {
        finalOutput = Object.values(result.outputRouting).flat();
      } else {
        finalOutput = Array.isArray(result) ? result : [result];
      }

      this.engine.executionData.set(node.id, {
        input: inputItems,
        output: finalOutput,
        status: 'success',
        duration
      });

      this.updateDataTabs(node.id);
      this.switchTab('output');
    } catch (err) {
      this.engine.executionData.set(node.id, {
        input: inputItems,
        output: [],
        status: 'error',
        error: err.message,
        duration: Date.now() - startTime
      });
      this.updateDataTabs(node.id);
      this.switchTab('output');
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<i data-lucide="play" class="w-3.5 h-3.5"></i> Test step`;
      if (window.lucide) window.lucide.createIcons();
    }
  }
}
