/**
 * n8n-kdd: Main Application Orchestrator
 * Integrates Canvas, DAG Engine, HTMX Drawer, Storage, WebMCP,
 * Sidebar node catalog, Toolbar actions, and Modals.
 */

import { DagEngine } from './dag-engine.js';
import { WorkflowCanvas } from './canvas.js';
import { HtmxDrawer } from './htmx-drawer.js';
import { storage } from './storage.js';
import { webmcp } from './webmcp-bridge.js';
import { NODE_DEFINITIONS, NODE_CATEGORIES } from './node-registry.js';

export class App {
  constructor() {
    this.engine = new DagEngine();
    this.currentWorkflow = null;

    this.initElements();
    this.initCanvas();
    this.initDrawer();
    this.initSidebarCatalog();
    this.initToolbar();
    this.initModals();
    this.loadInitialWorkflow();

    // Notify ready
    console.log('[n8n-kdd] Application initialized 100% client-side with WebMCP & KDD.');
  }

  initElements() {
    this.canvasContainer = document.getElementById('canvas-container');
    this.drawerContainer = document.getElementById('drawer-container');
    this.sidebarNodesList = document.getElementById('sidebar-nodes-list');
    this.nodeSearchInput = document.getElementById('node-search-input');
    this.workflowSelect = document.getElementById('workflow-select');
    this.workflowNameInput = document.getElementById('workflow-name-input');
    this.runWorkflowBtn = document.getElementById('run-workflow-btn');
    this.saveWorkflowBtn = document.getElementById('save-workflow-btn');
    this.statusPill = document.getElementById('workflow-status-pill');
  }

  initCanvas() {
    this.canvas = new WorkflowCanvas(this.canvasContainer, this.engine);
    this.canvas.onNodeConfigure = (node) => this.drawer.open(node);
  }

  initDrawer() {
    this.drawer = new HtmxDrawer(this.drawerContainer, this.engine);
  }

  initSidebarCatalog() {
    this.renderSidebarNodes();

    if (this.nodeSearchInput) {
      this.nodeSearchInput.addEventListener('input', (e) => {
        this.renderSidebarNodes(e.target.value.trim().toLowerCase());
      });
    }
  }

  renderSidebarNodes(filterQuery = '') {
    if (!this.sidebarNodesList) return;
    this.sidebarNodesList.innerHTML = '';

    const grouped = {};
    for (const catKey of Object.keys(NODE_CATEGORIES)) {
      grouped[catKey] = [];
    }

    for (const [type, def] of Object.entries(NODE_DEFINITIONS)) {
      if (filterQuery) {
        const matches = def.name.toLowerCase().includes(filterQuery) ||
                        def.description.toLowerCase().includes(filterQuery) ||
                        type.toLowerCase().includes(filterQuery);
        if (!matches) continue;
      }
      if (grouped[def.category]) {
        grouped[def.category].push(def);
      }
    }

    for (const [catKey, nodes] of Object.entries(grouped)) {
      if (nodes.length === 0) continue;
      const cat = NODE_CATEGORIES[catKey];

      const section = document.createElement('div');
      section.className = 'mb-4';
      section.innerHTML = `
        <div class="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-2 px-1 flex items-center gap-1.5">
          <div class="w-2 h-2 rounded-full" style="background-color: ${cat.color}"></div>
          <span>${cat.name}</span>
        </div>
        <div class="space-y-1.5"></div>
      `;

      const list = section.querySelector('.space-y-1\\.5');
      for (const nodeDef of nodes) {
        const item = document.createElement('div');
        item.className = 'group flex items-center gap-2.5 p-2 rounded-lg bg-[#18181c] hover:bg-[#202026] border border-neutral-800/80 hover:border-neutral-700 cursor-pointer transition-all';
        item.innerHTML = `
          <div class="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style="background-color: ${cat.bg}; color: ${cat.color}">
            <i data-lucide="${nodeDef.icon || 'box'}" class="w-4 h-4"></i>
          </div>
          <div class="overflow-hidden flex-1">
            <div class="text-xs font-medium text-neutral-200 group-hover:text-white truncate">${nodeDef.name}</div>
            <div class="text-[10px] text-neutral-500 truncate">${nodeDef.description}</div>
          </div>
        `;

        // Click to add node in center of view
        item.addEventListener('click', () => {
          const vpRect = this.canvas.viewport.getBoundingClientRect();
          const centerX = (-this.canvas.pan.x + vpRect.width / 2) / this.canvas.scale - 120;
          const centerY = (-this.canvas.pan.y + vpRect.height / 2) / this.canvas.scale - 36;
          const added = this.engine.addNode(nodeDef.type, { x: Math.round(centerX), y: Math.round(centerY) });
          this.canvas.selectNode(added.id);
        });

        list.appendChild(item);
      }

      this.sidebarNodesList.appendChild(section);
    }

    if (window.lucide) window.lucide.createIcons();
  }

  initToolbar() {
    // 1. Run Workflow Button ("Test workflow")
    if (this.runWorkflowBtn) {
      this.runWorkflowBtn.addEventListener('click', async () => {
        await this.runWorkflow();
      });
    }

    // 2. Save Workflow Button
    if (this.saveWorkflowBtn) {
      this.saveWorkflowBtn.addEventListener('click', () => {
        this.saveCurrentWorkflow();
      });
    }

    // 3. Workflow Name Input
    if (this.workflowNameInput) {
      this.workflowNameInput.addEventListener('change', (e) => {
        if (this.currentWorkflow) {
          this.currentWorkflow.name = e.target.value.trim() || 'Untitled Workflow';
          this.saveCurrentWorkflow();
          this.updateWorkflowSelect();
        }
      });
    }

    // 4. Workflow Selector Dropdown
    if (this.workflowSelect) {
      this.workflowSelect.addEventListener('change', (e) => {
        const id = e.target.value;
        if (id === '__new__') {
          this.createNewWorkflow();
        } else {
          this.loadWorkflowById(id);
        }
      });
    }

    // 5. Canvas Zoom & View Controls
    document.getElementById('zoom-in-btn')?.addEventListener('click', () => this.canvas.zoomIn());
    document.getElementById('zoom-out-btn')?.addEventListener('click', () => this.canvas.zoomOut());
    document.getElementById('zoom-reset-btn')?.addEventListener('click', () => this.canvas.resetZoom());
    document.getElementById('zoom-fit-btn')?.addEventListener('click', () => this.canvas.fitToScreen());

    // 6. Export / Import Buttons
    document.getElementById('export-json-btn')?.addEventListener('click', () => {
      const data = this.engine.toJSON();
      data.name = this.currentWorkflow?.name || 'Workflow';
      const jsonStr = storage.exportWorkflowJson(data);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${data.name.toLowerCase().replace(/\s+/g, '_')}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });

    const importInput = document.getElementById('import-file-input');
    document.getElementById('import-json-btn')?.addEventListener('click', () => {
      importInput?.click();
    });

    importInput?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const imported = storage.importWorkflowJson(evt.target.result);
          this.loadWorkflow(imported);
          this.updateWorkflowSelect();
          this.showToast('Workflow importado exitosamente', 'success');
        } catch (err) {
          alert('Error al importar JSON: ' + err.message);
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    });
  }

  initModals() {
    // A. Templates Modal
    const templatesModal = document.getElementById('templates-modal');
    const openTemplatesBtn = document.getElementById('open-templates-btn');
    const closeTemplatesBtn = document.getElementById('close-templates-btn');
    const templatesList = document.getElementById('templates-list');

    if (openTemplatesBtn && templatesModal) {
      openTemplatesBtn.addEventListener('click', () => {
        this.renderTemplatesList(templatesList);
        templatesModal.classList.remove('hidden');
      });
      closeTemplatesBtn?.addEventListener('click', () => {
        templatesModal.classList.add('hidden');
      });
      templatesModal.addEventListener('click', (e) => {
        if (e.target === templatesModal) templatesModal.classList.add('hidden');
      });
    }

    // B. WebMCP Explorer Modal
    const webmcpModal = document.getElementById('webmcp-modal');
    const openWebmcpBtn = document.getElementById('open-webmcp-btn');
    const closeWebmcpBtn = document.getElementById('close-webmcp-btn');

    if (openWebmcpBtn && webmcpModal) {
      openWebmcpBtn.addEventListener('click', () => {
        this.renderWebmcpExplorer();
        webmcpModal.classList.remove('hidden');
      });
      closeWebmcpBtn?.addEventListener('click', () => {
        webmcpModal.classList.add('hidden');
      });
      webmcpModal.addEventListener('click', (e) => {
        if (e.target === webmcpModal) webmcpModal.classList.add('hidden');
      });
    }
  }

  renderTemplatesList(container) {
    if (!container) return;
    container.innerHTML = '';
    const templates = storage.getTemplates();

    for (const t of templates) {
      const card = document.createElement('div');
      card.className = 'p-4 rounded-xl bg-[#141416] border border-neutral-800 hover:border-blue-500/80 transition-all cursor-pointer group flex flex-col justify-between';
      card.innerHTML = `
        <div>
          <div class="flex items-center justify-between mb-2">
            <span class="font-semibold text-sm text-neutral-100 group-hover:text-blue-400">${t.name}</span>
            <span class="text-[10px] px-2 py-0.5 rounded bg-neutral-800 text-neutral-400 font-mono">${(t.nodes || []).length} nodos</span>
          </div>
          <p class="text-xs text-neutral-400 leading-relaxed">${t.description}</p>
        </div>
        <div class="mt-4 pt-3 border-t border-neutral-800/80 flex items-center justify-between">
          <span class="text-[10px] text-emerald-400 flex items-center gap-1">✓ 100% Client-Side</span>
          <button class="px-3 py-1 bg-blue-600 group-hover:bg-blue-500 text-white text-xs font-medium rounded transition-colors">
            Cargar Plantilla
          </button>
        </div>
      `;

      card.addEventListener('click', () => {
        const cloned = JSON.parse(JSON.stringify(t));
        cloned.id = `wf_${Date.now()}`;
        storage.saveWorkflow(cloned);
        storage.setActiveWorkflowId(cloned.id);
        this.loadWorkflow(cloned);
        this.updateWorkflowSelect();
        document.getElementById('templates-modal')?.classList.add('hidden');
        this.showToast(`Plantilla "${t.name}" cargada`, 'success');
      });

      container.appendChild(card);
    }
  }

  renderWebmcpExplorer() {
    const listEl = document.getElementById('webmcp-tools-list');
    const detailsEl = document.getElementById('webmcp-tool-details');
    if (!listEl || !detailsEl) return;

    listEl.innerHTML = '';
    const tools = webmcp.listTools();

    let activeTool = tools[0] || null;

    const renderDetails = (tool) => {
      if (!tool) {
        detailsEl.innerHTML = '<div class="text-neutral-500 text-xs">No tool selected.</div>';
        return;
      }
      detailsEl.innerHTML = `
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-semibold text-pink-400 font-mono">${tool.name}</h3>
            <span class="px-2 py-0.5 rounded text-[10px] bg-neutral-800 text-neutral-400 font-mono">${tool.source}</span>
          </div>
          <p class="text-xs text-neutral-300">${tool.description || 'Sin descripción'}</p>

          <div>
            <div class="text-[11px] font-semibold text-neutral-400 mb-1">Input Schema (JSON Schema / Zod):</div>
            <pre class="bg-[#141416] p-3 rounded border border-neutral-800 text-xs font-mono text-neutral-300 overflow-x-auto">${JSON.stringify(tool.inputSchema, null, 2)}</pre>
          </div>

          <div>
            <div class="text-[11px] font-semibold text-neutral-400 mb-1">Prueba interactiva (Argumentos JSON):</div>
            <textarea id="webmcp-test-args" rows="3" class="w-full bg-[#141416] border border-neutral-700 rounded p-2.5 text-xs font-mono text-neutral-200 outline-none">{}</textarea>
          </div>

          <button id="webmcp-invoke-btn" class="px-3 py-1.5 bg-pink-600 hover:bg-pink-500 text-white text-xs font-medium rounded transition-colors flex items-center gap-1.5">
            <i data-lucide="play" class="w-3.5 h-3.5"></i> Invocar herramienta
          </button>

          <div id="webmcp-invoke-result" class="hidden space-y-1">
            <div class="text-[11px] font-semibold text-neutral-400">Resultado:</div>
            <pre id="webmcp-result-json" class="bg-[#141416] p-3 rounded border border-neutral-800 text-xs font-mono text-emerald-400 overflow-x-auto"></pre>
          </div>
        </div>
      `;

      if (window.lucide) window.lucide.createIcons();

      detailsEl.querySelector('#webmcp-invoke-btn')?.addEventListener('click', async () => {
        const argsStr = detailsEl.querySelector('#webmcp-test-args')?.value || '{}';
        const resultContainer = detailsEl.querySelector('#webmcp-invoke-result');
        const resultPre = detailsEl.querySelector('#webmcp-result-json');

        try {
          const args = JSON.parse(argsStr);
          const res = await webmcp.callTool(tool.name, args);
          resultContainer.classList.remove('hidden');
          resultPre.textContent = JSON.stringify(res, null, 2);
        } catch (err) {
          resultContainer.classList.remove('hidden');
          resultPre.className = 'bg-[#141416] p-3 rounded border border-neutral-800 text-xs font-mono text-rose-400 overflow-x-auto';
          resultPre.textContent = `Error: ${err.message}`;
        }
      });
    };

    for (const t of tools) {
      const item = document.createElement('div');
      item.className = 'p-2.5 rounded-lg border border-neutral-800 bg-[#141416] hover:bg-[#1a1a1e] cursor-pointer transition-colors';
      item.innerHTML = `
        <div class="flex items-center justify-between mb-1">
          <span class="text-xs font-mono font-medium text-neutral-200">${t.name}</span>
          <span class="text-[9px] px-1.5 py-0.2 rounded bg-neutral-800 text-neutral-400">${t.source}</span>
        </div>
        <div class="text-[11px] text-neutral-400 truncate">${t.description}</div>
      `;
      item.addEventListener('click', () => {
        renderDetails(t);
      });
      listEl.appendChild(item);
    }

    renderDetails(activeTool);
  }

  loadInitialWorkflow() {
    this.updateWorkflowSelect();
    const activeId = storage.getActiveWorkflowId();
    if (activeId) {
      const wf = storage.loadWorkflow(activeId);
      if (wf) {
        this.loadWorkflow(wf);
        return;
      }
    }
    // Fallback to first template
    const templates = storage.getTemplates();
    this.loadWorkflow(templates[0]);
  }

  loadWorkflow(workflow) {
    this.currentWorkflow = workflow;
    if (this.workflowNameInput) this.workflowNameInput.value = workflow.name;
    this.engine.fromJSON(workflow);
    this.canvas.render();
    setTimeout(() => this.canvas.fitToScreen(), 50);
  }

  loadWorkflowById(id) {
    const wf = storage.loadWorkflow(id);
    if (wf) {
      storage.setActiveWorkflowId(id);
      this.loadWorkflow(wf);
    }
  }

  createNewWorkflow() {
    const newWf = {
      id: `wf_${Date.now()}`,
      name: 'Untitled Workflow',
      nodes: [
        {
          id: 'node_start',
          type: 'manual_trigger',
          name: 'When clicking "Test workflow"',
          position: { x: 120, y: 240 },
          params: {}
        }
      ],
      connections: []
    };
    storage.saveWorkflow(newWf);
    storage.setActiveWorkflowId(newWf.id);
    this.loadWorkflow(newWf);
    this.updateWorkflowSelect();
    this.showToast('Nuevo flujo creado', 'success');
  }

  saveCurrentWorkflow() {
    if (!this.currentWorkflow) return;
    const data = this.engine.toJSON();
    this.currentWorkflow.name = this.workflowNameInput?.value.trim() || this.currentWorkflow.name;
    this.currentWorkflow.nodes = data.nodes;
    this.currentWorkflow.connections = data.connections;

    storage.saveWorkflow(this.currentWorkflow);
    this.showToast('Workflow guardado en localStorage', 'success');
  }

  updateWorkflowSelect() {
    if (!this.workflowSelect) return;
    this.workflowSelect.innerHTML = '';

    const list = storage.getWorkflowList();
    const activeId = storage.getActiveWorkflowId();

    for (const w of list) {
      const opt = document.createElement('option');
      opt.value = w.id;
      opt.textContent = w.name;
      if (w.id === activeId) opt.selected = true;
      this.workflowSelect.appendChild(opt);
    }

    const newOpt = document.createElement('option');
    newOpt.value = '__new__';
    newOpt.textContent = '+ Create new workflow';
    this.workflowSelect.appendChild(newOpt);
  }

  async runWorkflow() {
    if (!this.runWorkflowBtn) return;
    this.runWorkflowBtn.disabled = true;
    this.runWorkflowBtn.innerHTML = `<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i> Running...`;

    if (this.statusPill) {
      this.statusPill.className = 'px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse';
      this.statusPill.textContent = 'Executing workflow...';
    }

    try {
      const summary = await this.engine.executeWorkflow();
      if (summary.success) {
        if (this.statusPill) {
          this.statusPill.className = 'px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
          this.statusPill.textContent = `✓ Done in ${summary.totalDuration}ms`;
        }
        this.showToast(`Flujo ejecutado con éxito (${summary.totalDuration}ms)`, 'success');
      } else {
        if (this.statusPill) {
          this.statusPill.className = 'px-2 py-0.5 rounded text-[10px] font-medium bg-rose-500/20 text-rose-400 border border-rose-500/30';
          this.statusPill.textContent = `✕ Failed at ${summary.error?.name}`;
        }
        this.showToast(`Error en nodo ${summary.error?.name}: ${summary.error?.message}`, 'error');
      }
    } catch (err) {
      console.error(err);
      this.showToast('Error en la ejecución: ' + err.message, 'error');
    } finally {
      this.runWorkflowBtn.disabled = false;
      this.runWorkflowBtn.innerHTML = `<i data-lucide="play" class="w-3.5 h-3.5"></i> Test workflow`;
      if (window.lucide) window.lucide.createIcons();
    }
  }

  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    const bg = type === 'success' ? 'bg-emerald-600' : (type === 'error' ? 'bg-rose-600' : 'bg-blue-600');
    toast.className = `fixed bottom-5 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg text-white text-xs font-medium shadow-2xl z-50 transition-all duration-300 opacity-0 transform translate-y-2 ${bg}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.classList.remove('opacity-0', 'translate-y-2');
    }, 10);

    setTimeout(() => {
      toast.classList.add('opacity-0', 'translate-y-2');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
}

// Bootstrap on DOM load
window.addEventListener('DOMContentLoaded', () => {
  window.n8nApp = new App();
  if (window.lucide) {
    window.lucide.createIcons();
  }
});
