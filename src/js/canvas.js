/**
 * n8n-kdd: Canvas Controller
 * Manages viewport (pan, zoom), node rendering, port interactions,
 * Bezier curve wire rendering, interactive connection dragging, and minimap.
 */

import { NODE_DEFINITIONS, NODE_CATEGORIES } from './node-registry.js';

export class WorkflowCanvas {
  constructor(containerElement, dagEngine) {
    this.container = containerElement;
    this.engine = dagEngine;

    // Viewport transforms
    this.scale = 1.0;
    this.pan = { x: 80, y: 80 };
    this.isPanning = false;
    this.panStart = { x: 0, y: 0 };

    // Selection & Dragging
    this.selectedNodeId = null;
    this.selectedConnectionId = null;
    this.isDraggingNode = false;
    this.draggedNodeId = null;
    this.dragStart = { x: 0, y: 0 };
    this.nodeInitialPos = { x: 0, y: 0 };

    // Connection dragging
    this.isConnecting = false;
    this.connectionStart = null; // { nodeId, port, isOutput, x, y }
    this.tempConnectionEnd = { x: 0, y: 0 };

    // Marquee selection
    this.isMarquee = false;
    this.marqueeStart = { x: 0, y: 0 };
    this.marqueeCurrent = { x: 0, y: 0 };

    this.onNodeConfigure = null; // Callback when node is double-clicked
    this.onNodeSelect = null;

    this.initDom();
    this.initEvents();
    this.engine.subscribe((evt, data) => this.handleEngineEvent(evt, data));
  }

  initDom() {
    this.container.innerHTML = `
      <div class="canvas-viewport w-full h-full relative overflow-hidden select-none bg-[#141416]">
        <!-- Dot grid background -->
        <div class="canvas-grid absolute inset-0 pointer-events-none"></div>

        <!-- SVG layer for wires and connection drawing -->
        <svg class="canvas-wires-layer absolute inset-0 w-full h-full pointer-events-none overflow-visible">
          <defs>
            <linearGradient id="wireGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="#3b82f6" />
              <stop offset="100%" stop-color="#8b5cf6" />
            </linearGradient>
            <linearGradient id="wireSuccessGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="#10b981" />
              <stop offset="100%" stop-color="#059669" />
            </linearGradient>
            <filter id="wireGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>
          <g class="wires-container"></g>
          <path class="temp-wire hidden" stroke="#f59e0b" stroke-width="3" stroke-dasharray="6,4" fill="none" />
        </svg>

        <!-- HTML nodes transform container -->
        <div class="canvas-nodes-layer absolute inset-0 origin-top-left pointer-events-none"></div>

        <!-- Marquee box -->
        <div class="marquee-box absolute hidden border border-blue-500 bg-blue-500/10 pointer-events-none rounded"></div>

        <!-- Minimap -->
        <div class="minimap-container absolute bottom-4 right-4 w-44 h-32 bg-[#1b1b1f]/90 backdrop-blur-sm border border-neutral-800 rounded-lg shadow-xl overflow-hidden pointer-events-auto">
          <svg class="minimap-svg w-full h-full"></svg>
          <div class="minimap-viewbox absolute border border-blue-400 bg-blue-400/10 rounded-sm pointer-events-none"></div>
        </div>
      </div>
    `;

    this.viewport = this.container.querySelector('.canvas-viewport');
    this.grid = this.container.querySelector('.canvas-grid');
    this.wiresContainer = this.container.querySelector('.wires-container');
    this.tempWire = this.container.querySelector('.temp-wire');
    this.nodesLayer = this.container.querySelector('.canvas-nodes-layer');
    this.marqueeBox = this.container.querySelector('.marquee-box');
    this.minimapSvg = this.container.querySelector('.minimap-svg');
    this.minimapBox = this.container.querySelector('.minimap-viewbox');

    this.updateTransform();
  }

  initEvents() {
    // Canvas Pan & Zoom
    this.viewport.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
      const rect = this.viewport.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const newScale = Math.min(Math.max(this.scale * zoomFactor, 0.25), 2.5);

      // Adjust pan to zoom into mouse position
      this.pan.x = mouseX - (mouseX - this.pan.x) * (newScale / this.scale);
      this.pan.y = mouseY - (mouseY - this.pan.y) * (newScale / this.scale);
      this.scale = newScale;

      this.updateTransform();
      this.render();
    }, { passive: false });

    this.viewport.addEventListener('mousedown', (e) => {
      // Middle mouse or Spacebar or clicking empty canvas initiates pan
      if (e.button === 1 || e.spaceKey || e.target === this.viewport || e.target === this.grid) {
        this.isPanning = true;
        this.panStart = { x: e.clientX - this.pan.x, y: e.clientY - this.pan.y };
        this.viewport.style.cursor = 'grabbing';
      } else if (e.button === 0 && (e.target === this.viewport || e.target === this.grid)) {
        // Deselect node/wire if clicking canvas background
        this.selectNode(null);
        this.selectedConnectionId = null;
        this.renderWires();
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isPanning) {
        this.pan.x = e.clientX - this.panStart.x;
        this.pan.y = e.clientY - this.panStart.y;
        this.updateTransform();
        this.updateMinimap();
      } else if (this.isDraggingNode && this.draggedNodeId) {
        const dx = (e.clientX - this.dragStart.x) / this.scale;
        const dy = (e.clientY - this.dragStart.y) / this.scale;
        const snap = 16;
        const rawX = this.nodeInitialPos.x + dx;
        const rawY = this.nodeInitialPos.y + dy;
        const snappedX = Math.round(rawX / snap) * snap;
        const snappedY = Math.round(rawY / snap) * snap;

        this.engine.updateNodePosition(this.draggedNodeId, { x: snappedX, y: snappedY });
        this.updateNodeElementPosition(this.draggedNodeId, snappedX, snappedY);
        this.renderWires();
        this.updateMinimap();
      } else if (this.isConnecting && this.connectionStart) {
        const rect = this.viewport.getBoundingClientRect();
        const canvasX = (e.clientX - rect.left - this.pan.x) / this.scale;
        const canvasY = (e.clientY - rect.top - this.pan.y) / this.scale;
        this.tempConnectionEnd = { x: canvasX, y: canvasY };
        this.renderTempWire();
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (this.isPanning) {
        this.isPanning = false;
        this.viewport.style.cursor = 'default';
      }
      if (this.isDraggingNode) {
        this.isDraggingNode = false;
        this.draggedNodeId = null;
      }
      if (this.isConnecting) {
        this.isConnecting = false;
        this.tempWire.classList.add('hidden');
        this.connectionStart = null;
      }
    });

    // Keyboard shortcuts: Delete to remove selected node or connection
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (this.selectedConnectionId) {
          this.engine.removeConnection(this.selectedConnectionId);
          this.selectedConnectionId = null;
          this.renderWires();
        } else if (this.selectedNodeId) {
          this.engine.removeNode(this.selectedNodeId);
          this.selectedNodeId = null;
          this.render();
        }
      } else if (e.key === 'd' && (e.ctrlKey || e.metaKey) && this.selectedNodeId) {
        // Ctrl+D Duplicate Node
        e.preventDefault();
        this.duplicateSelectedNode();
      }
    });
  }

  duplicateSelectedNode() {
    if (!this.selectedNodeId) return;
    const node = this.engine.nodes.get(this.selectedNodeId);
    if (!node) return;
    const newNode = this.engine.addNode(
      node.type,
      { x: node.position.x + 40, y: node.position.y + 40 },
      JSON.parse(JSON.stringify(node.params)),
      `${node.name} (Copy)`
    );
    this.selectNode(newNode.id);
    this.render();
  }

  updateTransform() {
    // Transform nodes layer
    this.nodesLayer.style.transform = `translate(${this.pan.x}px, ${this.pan.y}px) scale(${this.scale})`;
    // Update grid background offset and scale
    const gridSize = 24 * this.scale;
    this.grid.style.backgroundImage = `radial-gradient(circle, #2a2a30 1.2px, transparent 1.2px)`;
    this.grid.style.backgroundSize = `${gridSize}px ${gridSize}px`;
    this.grid.style.backgroundPosition = `${this.pan.x}px ${this.pan.y}px`;

    this.renderWires();
    this.updateMinimap();
  }

  // -------------------------------------------------------------
  // RENDERING
  // -------------------------------------------------------------
  render() {
    this.renderNodes();
    this.renderWires();
    this.updateMinimap();
  }

  renderNodes() {
    this.nodesLayer.innerHTML = '';
    for (const node of this.engine.nodes.values()) {
      const el = this.createNodeElement(node);
      this.nodesLayer.appendChild(el);
    }
  }

  createNodeElement(node) {
    const def = NODE_DEFINITIONS[node.type] || {
      name: node.type,
      category: 'transform',
      icon: 'box',
      inputs: ['main'],
      outputs: ['main']
    };

    const cat = NODE_CATEGORIES[def.category] || NODE_CATEGORIES.transform;
    const execData = this.engine.executionData.get(node.id) || { status: 'idle', duration: 0 };

    const el = document.createElement('div');
    el.className = `canvas-node absolute pointer-events-auto transition-shadow rounded-xl border bg-[#1a1a1e] text-neutral-200 select-none cursor-move ${
      this.selectedNodeId === node.id ? 'ring-2 ring-blue-500 shadow-xl shadow-blue-500/10 border-blue-500' : 'border-neutral-700/70 hover:border-neutral-500'
    } ${node.disabled ? 'opacity-50' : ''}`;
    el.style.width = '240px';
    el.style.transform = `translate(${node.position.x}px, ${node.position.y}px)`;
    el.setAttribute('data-node-id', node.id);

    // Status badge UI
    let statusBadgeHtml = '';
    if (execData.status === 'running') {
      statusBadgeHtml = `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse">Running...</span>`;
    } else if (execData.status === 'success') {
      statusBadgeHtml = `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">✓ ${execData.duration}ms</span>`;
    } else if (execData.status === 'error') {
      statusBadgeHtml = `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-rose-500/20 text-rose-400 border border-rose-500/30" title="${execData.error || 'Error'}">✕ Error</span>`;
    }

    // Node Header & Body
    el.innerHTML = `
      <!-- Top category bar -->
      <div class="h-1.5 rounded-t-xl" style="background-color: ${cat.color}"></div>

      <!-- Main card body -->
      <div class="p-3">
        <div class="flex items-center justify-between gap-2 mb-1.5">
          <div class="flex items-center gap-2 overflow-hidden">
            <div class="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style="background-color: ${cat.bg}; color: ${cat.color}">
              <i data-lucide="${def.icon || 'box'}" class="w-4 h-4"></i>
            </div>
            <span class="font-medium text-xs truncate text-neutral-100">${node.name}</span>
          </div>
          ${statusBadgeHtml}
        </div>

        <div class="text-[11px] text-neutral-400 truncate">${def.name}</div>
      </div>

      <!-- Input Ports (Left) -->
      <div class="ports-input absolute left-0 top-0 bottom-0 flex flex-col justify-center gap-4 -translate-x-2.5">
        ${(def.inputs || []).map(port => `
          <div class="port-handle port-input w-4 h-4 rounded-full bg-neutral-800 border-2 border-neutral-400 hover:border-blue-400 hover:scale-125 transition-transform flex items-center justify-center cursor-crosshair"
               data-node-id="${node.id}" data-port="${port}" data-port-type="input" title="Input: ${port}">
            <div class="w-1.5 h-1.5 rounded-full bg-neutral-300 pointer-events-none"></div>
          </div>
        `).join('')}
      </div>

      <!-- Output Ports (Right) -->
      <div class="ports-output absolute right-0 top-0 bottom-0 flex flex-col justify-center gap-4 translate-x-2.5">
        ${(def.outputs || []).map(port => {
          const isTrue = port === 'true';
          const isFalse = port === 'false';
          const dotColor = isTrue ? 'border-emerald-500' : (isFalse ? 'border-rose-500' : 'border-neutral-400');
          const fillColor = isTrue ? 'bg-emerald-500' : (isFalse ? 'bg-rose-500' : 'bg-neutral-300');
          const label = isTrue ? 'True' : (isFalse ? 'False' : '');

          return `
            <div class="relative flex items-center justify-center">
              ${label ? `<span class="absolute right-5 text-[9px] font-semibold text-neutral-400 uppercase tracking-wider">${label}</span>` : ''}
              <div class="port-handle port-output w-4 h-4 rounded-full bg-neutral-800 border-2 ${dotColor} hover:border-emerald-400 hover:scale-125 transition-transform flex items-center justify-center cursor-crosshair"
                   data-node-id="${node.id}" data-port="${port}" data-port-type="output" title="Output: ${port}">
                <div class="w-1.5 h-1.5 rounded-full ${fillColor} pointer-events-none"></div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    // Bind Drag & Selection Events
    el.addEventListener('mousedown', (e) => {
      // Check if clicking port
      const portHandle = e.target.closest('.port-handle');
      if (portHandle) {
        e.stopPropagation();
        const port = portHandle.dataset.port;
        const isOutput = portHandle.dataset.portType === 'output';
        if (isOutput) {
          this.startConnecting(node.id, port, portHandle);
        }
        return;
      }

      if (e.button === 0) {
        e.stopPropagation();
        this.selectNode(node.id);
        this.isDraggingNode = true;
        this.draggedNodeId = node.id;
        this.dragStart = { x: e.clientX, y: e.clientY };
        this.nodeInitialPos = { ...node.position };
      }
    });

    // Double click to open parameters drawer
    el.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      if (this.onNodeConfigure) {
        this.onNodeConfigure(node);
      }
    });

    // Handle port mouseup for finishing connection
    el.querySelectorAll('.port-input').forEach(inputHandle => {
      inputHandle.addEventListener('mouseup', (e) => {
        if (this.isConnecting && this.connectionStart) {
          e.stopPropagation();
          const targetPort = inputHandle.dataset.port;
          try {
            this.engine.addConnection(
              this.connectionStart.nodeId,
              this.connectionStart.port,
              node.id,
              targetPort
            );
          } catch (err) {
            alert(err.message);
          }
          this.isConnecting = false;
          this.tempWire.classList.add('hidden');
          this.renderWires();
        }
      });
    });

    return el;
  }

  updateNodeElementPosition(nodeId, x, y) {
    const el = this.nodesLayer.querySelector(`[data-node-id="${nodeId}"]`);
    if (el) {
      el.style.transform = `translate(${x}px, ${y}px)`;
    }
  }

  selectNode(nodeId) {
    this.selectedNodeId = nodeId;
    this.selectedConnectionId = null;

    // Update active ring classes
    this.nodesLayer.querySelectorAll('.canvas-node').forEach(nEl => {
      if (nEl.dataset.nodeId === nodeId) {
        nEl.classList.add('ring-2', 'ring-blue-500', 'shadow-xl', 'shadow-blue-500/10', 'border-blue-500');
        nEl.classList.remove('border-neutral-700/70');
      } else {
        nEl.classList.remove('ring-2', 'ring-blue-500', 'shadow-xl', 'shadow-blue-500/10', 'border-blue-500');
        nEl.classList.add('border-neutral-700/70');
      }
    });

    if (this.onNodeSelect) {
      const node = nodeId ? this.engine.nodes.get(nodeId) : null;
      this.onNodeSelect(node);
    }
  }

  // -------------------------------------------------------------
  // WIRES & CONNECTIONS (BEZIER)
  // -------------------------------------------------------------
  startConnecting(fromNodeId, fromPort, handleEl) {
    const handleRect = handleEl.getBoundingClientRect();
    const viewportRect = this.viewport.getBoundingClientRect();

    const startX = (handleRect.left + handleRect.width / 2 - viewportRect.left - this.pan.x) / this.scale;
    const startY = (handleRect.top + handleRect.height / 2 - viewportRect.top - this.pan.y) / this.scale;

    this.isConnecting = true;
    this.connectionStart = { nodeId: fromNodeId, port: fromPort, x: startX, y: startY };
    this.tempConnectionEnd = { x: startX, y: startY };

    this.tempWire.classList.remove('hidden');
    this.renderTempWire();
  }

  renderTempWire() {
    if (!this.connectionStart) return;
    const p1 = this.toScreenCoords(this.connectionStart.x, this.connectionStart.y);
    const p2 = this.toScreenCoords(this.tempConnectionEnd.x, this.tempConnectionEnd.y);
    const d = this.calculateBezierPath(p1.x, p1.y, p2.x, p2.y);
    this.tempWire.setAttribute('d', d);
  }

  renderWires() {
    this.wiresContainer.innerHTML = '';

    for (const conn of this.engine.connections) {
      const fromNode = this.engine.nodes.get(conn.fromNodeId);
      const toNode = this.engine.nodes.get(conn.toNodeId);
      if (!fromNode || !toNode) continue;

      // Compute port offsets on canvas
      const fromPortPos = this.getNodePortCoords(fromNode, conn.fromOutput, true);
      const toPortPos = this.getNodePortCoords(toNode, conn.toInput, false);

      const p1 = this.toScreenCoords(fromPortPos.x, fromPortPos.y);
      const p2 = this.toScreenCoords(toPortPos.x, toPortPos.y);

      const pathData = this.calculateBezierPath(p1.x, p1.y, p2.x, p2.y);

      const isSelected = this.selectedConnectionId === conn.id;
      const fromExec = this.engine.executionData.get(conn.fromNodeId);
      const isFlowing = fromExec && fromExec.status === 'success';

      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('class', 'wire-group cursor-pointer');

      // Broad invisible path for easier click targeting
      const clickPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      clickPath.setAttribute('d', pathData);
      clickPath.setAttribute('stroke', 'transparent');
      clickPath.setAttribute('stroke-width', '18');
      clickPath.setAttribute('fill', 'none');
      clickPath.setAttribute('class', 'pointer-events-auto');

      // Visible styled path
      const visiblePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      visiblePath.setAttribute('d', pathData);
      visiblePath.setAttribute('fill', 'none');
      visiblePath.setAttribute('stroke-width', isSelected ? '3.5' : '2.5');

      let strokeColor = isSelected ? '#38bdf8' : (isFlowing ? '#10b981' : '#64748b');
      if (conn.fromOutput === 'false') {
        strokeColor = isSelected ? '#f87171' : (isFlowing ? '#f43f5e' : '#64748b');
      }

      visiblePath.setAttribute('stroke', strokeColor);

      if (isFlowing) {
        visiblePath.setAttribute('stroke-dasharray', '8,6');
        visiblePath.setAttribute('class', 'animated-flowing-wire');
      }

      g.appendChild(clickPath);
      g.appendChild(visiblePath);

      // Wire click selection
      clickPath.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectedConnectionId = conn.id;
        this.selectNode(null);
        this.renderWires();
      });

      this.wiresContainer.appendChild(g);
    }
  }

  getNodePortCoords(node, portName, isOutput) {
    const nodeWidth = 240;
    const nodeHeight = 72;

    const def = NODE_DEFINITIONS[node.type] || { outputs: ['main'], inputs: ['main'] };
    const ports = isOutput ? (def.outputs || ['main']) : (def.inputs || ['main']);
    const portIndex = Math.max(0, ports.indexOf(portName));
    const totalPorts = ports.length;

    // Distribute ports vertically
    const step = nodeHeight / (totalPorts + 1);
    const offsetY = step * (portIndex + 1);

    return {
      x: node.position.x + (isOutput ? nodeWidth : 0),
      y: node.position.y + offsetY
    };
  }

  toScreenCoords(canvasX, canvasY) {
    return {
      x: canvasX * this.scale + this.pan.x,
      y: canvasY * this.scale + this.pan.y
    };
  }

  calculateBezierPath(x1, y1, x2, y2) {
    const dx = Math.abs(x2 - x1) * 0.55;
    const p1x = x1 + Math.max(dx, 40);
    const p1y = y1;
    const p2x = x2 - Math.max(dx, 40);
    const p2y = y2;
    return `M ${x1} ${y1} C ${p1x} ${p1y}, ${p2x} ${p2y}, ${x2} ${y2}`;
  }

  // -------------------------------------------------------------
  // MINIMAP
  // -------------------------------------------------------------
  updateMinimap() {
    if (!this.minimapSvg) return;
    this.minimapSvg.innerHTML = '';

    const nodes = Array.from(this.engine.nodes.values());
    if (nodes.length === 0) return;

    // Determine bounding box of all nodes
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of nodes) {
      minX = Math.min(minX, n.position.x);
      minY = Math.min(minY, n.position.y);
      maxX = Math.max(maxX, n.position.x + 240);
      maxY = Math.max(maxY, n.position.y + 100);
    }

    const padding = 120;
    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;

    const worldWidth = Math.max(maxX - minX, 800);
    const worldHeight = Math.max(maxY - minY, 600);

    const mapWidth = 176;
    const mapHeight = 128;
    const scale = Math.min(mapWidth / worldWidth, mapHeight / worldHeight);

    // Draw nodes on minimap
    for (const n of nodes) {
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', (n.position.x - minX) * scale);
      rect.setAttribute('y', (n.position.y - minY) * scale);
      rect.setAttribute('width', Math.max(240 * scale, 6));
      rect.setAttribute('height', Math.max(60 * scale, 3));
      rect.setAttribute('rx', '2');
      rect.setAttribute('fill', n.id === this.selectedNodeId ? '#3b82f6' : '#52525b');
      this.minimapSvg.appendChild(rect);
    }

    // Viewport rectangle
    const vpRect = this.viewport.getBoundingClientRect();
    const curLeft = (-this.pan.x / this.scale - minX) * scale;
    const curTop = (-this.pan.y / this.scale - minY) * scale;
    const curWidth = (vpRect.width / this.scale) * scale;
    const curHeight = (vpRect.height / this.scale) * scale;

    this.minimapBox.style.left = `${Math.max(0, curLeft)}px`;
    this.minimapBox.style.top = `${Math.max(0, curTop)}px`;
    this.minimapBox.style.width = `${Math.min(mapWidth, curWidth)}px`;
    this.minimapBox.style.height = `${Math.min(mapHeight, curHeight)}px`;
  }

  // -------------------------------------------------------------
  // CONTROLS: ZOOM & FIT
  // -------------------------------------------------------------
  zoomIn() {
    this.scale = Math.min(this.scale * 1.2, 2.5);
    this.updateTransform();
  }

  zoomOut() {
    this.scale = Math.max(this.scale / 1.2, 0.25);
    this.updateTransform();
  }

  resetZoom() {
    this.scale = 1.0;
    this.pan = { x: 80, y: 80 };
    this.updateTransform();
  }

  fitToScreen() {
    const nodes = Array.from(this.engine.nodes.values());
    if (nodes.length === 0) {
      this.resetZoom();
      return;
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of nodes) {
      minX = Math.min(minX, n.position.x);
      minY = Math.min(minY, n.position.y);
      maxX = Math.max(maxX, n.position.x + 240);
      maxY = Math.max(maxY, n.position.y + 100);
    }

    const vpRect = this.viewport.getBoundingClientRect();
    const w = maxX - minX + 160;
    const h = maxY - minY + 160;

    this.scale = Math.min(Math.max(Math.min(vpRect.width / w, vpRect.height / h), 0.3), 1.5);
    this.pan.x = (vpRect.width - (maxX + minX) * this.scale) / 2;
    this.pan.y = (vpRect.height - (maxY + minY) * this.scale) / 2;
    this.updateTransform();
  }

  handleEngineEvent(event, data) {
    if (event.startsWith('node:') || event.startsWith('connection:') || event.startsWith('workflow:')) {
      this.render();
      if (window.lucide) {
        window.lucide.createIcons();
      }
    }
  }
}
