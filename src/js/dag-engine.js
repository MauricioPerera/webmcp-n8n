/**
 * n8n-kdd: DAG Execution Engine
 * Manages the node graph, topological sorting, dependency resolution,
 * multi-output routing (e.g. IF nodes), item-based data flow and execution state.
 */

import { NODE_DEFINITIONS } from './node-registry.js';

export class DagEngine {
  constructor() {
    this.nodes = new Map(); // id -> { id, type, name, position: {x,y}, params: {}, disabled: false }
    this.connections = []; // [ { id, fromNodeId, fromOutput, toNodeId, toInput } ]
    this.executionData = new Map(); // nodeId -> { input: [], output: [], status: 'idle'|'running'|'success'|'error', error: null, duration: 0 }
    this.listeners = new Set();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify(event, data) {
    for (const listener of this.listeners) {
      try {
        listener(event, data);
      } catch (e) {
        console.error('Listener error in DagEngine:', e);
      }
    }
  }

  // -------------------------------------------------------------
  // GRAPH MANIPULATION
  // -------------------------------------------------------------
  addNode(type, position = { x: 100, y: 100 }, params = {}, customName = null) {
    const def = NODE_DEFINITIONS[type];
    if (!def) throw new Error(`Unknown node type: ${type}`);

    const id = `node_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const name = customName || this.generateNodeName(def.name);

    const node = {
      id,
      type,
      name,
      position,
      params: { ...def.defaultParams, ...params },
      disabled: false
    };

    this.nodes.set(id, node);
    this.executionData.set(id, { input: [], output: [], status: 'idle', duration: 0 });
    this.notify('node:added', node);
    return node;
  }

  generateNodeName(baseName) {
    const count = Array.from(this.nodes.values()).filter(n => n.name.startsWith(baseName)).length;
    return count === 0 ? baseName : `${baseName} ${count + 1}`;
  }

  removeNode(nodeId) {
    if (!this.nodes.has(nodeId)) return false;
    this.nodes.delete(nodeId);
    this.executionData.delete(nodeId);
    this.connections = this.connections.filter(c => c.fromNodeId !== nodeId && c.toNodeId !== nodeId);
    this.notify('node:removed', nodeId);
    return true;
  }

  updateNodeParams(nodeId, params) {
    const node = this.nodes.get(nodeId);
    if (!node) return null;
    node.params = { ...node.params, ...params };
    this.notify('node:updated', node);
    return node;
  }

  updateNodePosition(nodeId, position) {
    const node = this.nodes.get(nodeId);
    if (!node) return null;
    node.position = position;
    this.notify('node:moved', node);
    return node;
  }

  renameNode(nodeId, newName) {
    const node = this.nodes.get(nodeId);
    if (!node) return null;
    node.name = newName;
    this.notify('node:updated', node);
    return node;
  }

  setNodeDisabled(nodeId, disabled) {
    const node = this.nodes.get(nodeId);
    if (!node) return null;
    node.disabled = Boolean(disabled);
    this.notify('node:updated', node);
    return node;
  }

  addConnection(fromNodeId, fromOutput = 'main', toNodeId, toInput = 'main') {
    if (fromNodeId === toNodeId) return null; // No self-loops

    // Check if connection already exists
    const exists = this.connections.some(c =>
      c.fromNodeId === fromNodeId &&
      c.fromOutput === fromOutput &&
      c.toNodeId === toNodeId &&
      c.toInput === toInput
    );
    if (exists) return null;

    const id = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const conn = { id, fromNodeId, fromOutput, toNodeId, toInput };
    this.connections.push(conn);

    // Verify acyclic
    if (this.hasCycle()) {
      // Revert if cycle introduced
      this.connections.pop();
      throw new Error('Connection would create a cycle (Workflow must be a Directed Acyclic Graph)');
    }

    this.notify('connection:added', conn);
    return conn;
  }

  removeConnection(connectionId) {
    const idx = this.connections.findIndex(c => c.id === connectionId);
    if (idx !== -1) {
      const removed = this.connections.splice(idx, 1)[0];
      this.notify('connection:removed', removed);
      return true;
    }
    return false;
  }

  // -------------------------------------------------------------
  // GRAPH TOPOLOGY & CYCLE DETECTION
  // -------------------------------------------------------------
  hasCycle() {
    const adj = new Map();
    for (const id of this.nodes.keys()) {
      adj.set(id, []);
    }
    for (const c of this.connections) {
      if (adj.has(c.fromNodeId)) {
        adj.get(c.fromNodeId).push(c.toNodeId);
      }
    }

    const visited = new Set();
    const inStack = new Set();

    const dfs = (nodeId) => {
      visited.add(nodeId);
      inStack.add(nodeId);

      for (const neighbor of (adj.get(nodeId) || [])) {
        if (!visited.has(neighbor)) {
          if (dfs(neighbor)) return true;
        } else if (inStack.has(neighbor)) {
          return true;
        }
      }

      inStack.delete(nodeId);
      return false;
    };

    for (const id of this.nodes.keys()) {
      if (!visited.has(id)) {
        if (dfs(id)) return true;
      }
    }

    return false;
  }

  getTopologicalOrder(startNodeId = null) {
    if (this.hasCycle()) {
      throw new Error('Graph has cycles, cannot determine topological order');
    }

    // If startNodeId is given, collect subgraph reachable from startNodeId
    const targetNodes = new Set();
    if (startNodeId) {
      const queue = [startNodeId];
      targetNodes.add(startNodeId);
      while (queue.length > 0) {
        const curr = queue.shift();
        for (const c of this.connections) {
          if (c.fromNodeId === curr && !targetNodes.has(c.toNodeId)) {
            targetNodes.add(c.toNodeId);
            queue.push(c.toNodeId);
          }
        }
      }
    } else {
      for (const id of this.nodes.keys()) {
        targetNodes.add(id);
      }
    }

    // In-degree calculation
    const inDegree = new Map();
    const adj = new Map();

    for (const id of targetNodes) {
      inDegree.set(id, 0);
      adj.set(id, []);
    }

    for (const c of this.connections) {
      if (targetNodes.has(c.fromNodeId) && targetNodes.has(c.toNodeId)) {
        adj.get(c.fromNodeId).push(c.toNodeId);
        inDegree.set(c.toNodeId, (inDegree.get(c.toNodeId) || 0) + 1);
      }
    }

    const queue = [];
    for (const [id, deg] of inDegree.entries()) {
      if (deg === 0) {
        queue.push(id);
      }
    }

    const order = [];
    while (queue.length > 0) {
      const u = queue.shift();
      order.push(u);

      for (const v of adj.get(u)) {
        inDegree.set(v, inDegree.get(v) - 1);
        if (inDegree.get(v) === 0) {
          queue.push(v);
        }
      }
    }

    return order;
  }

  // -------------------------------------------------------------
  // WORKFLOW EXECUTION
  // -------------------------------------------------------------
  async executeWorkflow(startNodeId = null, triggerPayload = {}) {
    // Reset statuses
    for (const id of this.nodes.keys()) {
      this.executionData.set(id, { input: [], output: [], status: 'idle', duration: 0 });
    }
    this.notify('workflow:start', { startNodeId });

    // Determine start nodes
    let startNodes = [];
    if (startNodeId) {
      startNodes = [startNodeId];
    } else {
      // Find trigger nodes or nodes with no incoming connections
      const nodesWithIncoming = new Set(this.connections.map(c => c.toNodeId));
      for (const node of this.nodes.values()) {
        const def = NODE_DEFINITIONS[node.type];
        if (def && (def.category === 'trigger' || !nodesWithIncoming.has(node.id))) {
          startNodes.push(node.id);
        }
      }
      if (startNodes.length === 0 && this.nodes.size > 0) {
        startNodes = [Array.from(this.nodes.keys())[0]];
      }
    }

    // Track output data available per node output port:
    // nodeOutputData.get(nodeId) -> { [outputPort]: items[] }
    const nodeOutputData = new Map();
    // Track node inputs: nodeId -> items[]
    const nodeInputData = new Map();

    const order = this.getTopologicalOrder(startNodes.length === 1 ? startNodes[0] : null);

    const context = {
      triggerPayload,
      nodeOutputs: {}
    };

    const executionSummary = {
      startTime: Date.now(),
      executedNodes: [],
      success: true,
      error: null
    };

    for (const nodeId of order) {
      const node = this.nodes.get(nodeId);
      if (!node) continue;
      if (node.disabled) {
        this.executionData.set(nodeId, { input: [], output: [], status: 'disabled', duration: 0 });
        this.notify('node:status', { nodeId, status: 'disabled' });
        continue;
      }

      const def = NODE_DEFINITIONS[node.type];
      if (!def) continue;

      // Collect inputs from incoming connections
      const incomingConns = this.connections.filter(c => c.toNodeId === nodeId);
      let inputItems = [];

      if (incomingConns.length > 0) {
        let hasActiveInput = false;
        for (const conn of incomingConns) {
          const upstreamOutputs = nodeOutputData.get(conn.fromNodeId);
          if (upstreamOutputs && upstreamOutputs[conn.fromOutput]) {
            const items = upstreamOutputs[conn.fromOutput];
            if (items && items.length > 0) {
              inputItems = inputItems.concat(items);
              hasActiveInput = true;
            }
          }
        }
        // If upstream didn't route any items to this node (e.g. inactive branch of an IF node), skip this node
        if (!hasActiveInput && incomingConns.some(c => nodeOutputData.has(c.fromNodeId))) {
          this.executionData.set(nodeId, { input: [], output: [], status: 'skipped', duration: 0 });
          this.notify('node:status', { nodeId, status: 'skipped' });
          continue;
        }
      } else if (def.category !== 'trigger') {
        // Non-trigger node with no inputs gets empty item
        inputItems = [{ json: {} }];
      }

      nodeInputData.set(nodeId, inputItems);
      this.executionData.set(nodeId, { input: inputItems, output: [], status: 'running', duration: 0 });
      this.notify('node:start', { nodeId, input: inputItems });

      const startTime = Date.now();
      try {
        const result = await def.execute(node.params, inputItems, context);
        const duration = Date.now() - startTime;

        let outputsByPort = {};
        let finalOutputItems = [];

        if (result && typeof result === 'object' && 'outputRouting' in result) {
          // Multi-port output routing (e.g. IF conditional)
          outputsByPort = result.outputRouting;
          finalOutputItems = Object.values(outputsByPort).flat();
        } else {
          // Standard single output or array
          finalOutputItems = Array.isArray(result) ? result : [result];
          outputsByPort = { main: finalOutputItems };
        }

        nodeOutputData.set(nodeId, outputsByPort);
        context.nodeOutputs[node.name] = finalOutputItems[0] || { json: {} };

        this.executionData.set(nodeId, {
          input: inputItems,
          output: finalOutputItems,
          outputsByPort,
          status: 'success',
          duration
        });

        executionSummary.executedNodes.push({ nodeId, name: node.name, duration });
        this.notify('node:finish', { nodeId, output: finalOutputItems, outputsByPort, duration });
      } catch (err) {
        const duration = Date.now() - startTime;
        console.error(`Execution error at node "${node.name}" (${nodeId}):`, err);

        this.executionData.set(nodeId, {
          input: inputItems,
          output: [],
          status: 'error',
          error: err.message,
          duration
        });

        executionSummary.success = false;
        executionSummary.error = { nodeId, name: node.name, message: err.message };
        this.notify('node:error', { nodeId, error: err.message, duration });
        break; // Stop execution on error
      }
    }

    executionSummary.totalDuration = Date.now() - executionSummary.startTime;
    this.notify('workflow:finish', executionSummary);
    return executionSummary;
  }

  // -------------------------------------------------------------
  // SERIALIZATION & DESERIALIZATION
  // -------------------------------------------------------------
  toJSON() {
    return {
      version: 1,
      name: this.name || 'My Workflow',
      nodes: Array.from(this.nodes.values()),
      connections: this.connections
    };
  }

  fromJSON(data) {
    this.nodes.clear();
    this.connections = [];
    this.executionData.clear();

    if (!data || !Array.isArray(data.nodes)) return;

    for (const nodeData of data.nodes) {
      this.nodes.set(nodeData.id, {
        id: nodeData.id,
        type: nodeData.type,
        name: nodeData.name,
        position: nodeData.position || { x: 100, y: 100 },
        params: nodeData.params || {},
        disabled: Boolean(nodeData.disabled)
      });
      this.executionData.set(nodeData.id, { input: [], output: [], status: 'idle', duration: 0 });
    }

    if (Array.isArray(data.connections)) {
      this.connections = [...data.connections];
    }

    this.notify('workflow:loaded', this.toJSON());
  }
}
