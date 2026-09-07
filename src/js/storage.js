/**
 * n8n-kdd: Storage, Workflow Management & Pre-built Templates
 * Handles persistence in localStorage, import/export and ready-to-run templates.
 */

const STORAGE_PREFIX = 'n8n_kdd_';
const ACTIVE_WORKFLOW_KEY = 'n8n_kdd_active_id';
const WORKFLOW_LIST_KEY = 'n8n_kdd_workflows';

const memoryStore = new Map();
const isStorageAvailable = typeof localStorage !== 'undefined';

function getItem(key) {
  if (isStorageAvailable) {
    try { return localStorage.getItem(key); } catch {}
  }
  return memoryStore.get(key) || null;
}

function setItem(key, val) {
  if (isStorageAvailable) {
    try { localStorage.setItem(key, val); return; } catch {}
  }
  memoryStore.set(key, val);
}

function removeItem(key) {
  if (isStorageAvailable) {
    try { localStorage.removeItem(key); return; } catch {}
  }
  memoryStore.delete(key);
}

export class WorkflowStorage {
  constructor() {
    this.initStorage();
  }

  initStorage() {
    try {
      const list = this.getWorkflowList();
      if (list.length === 0) {
        // Initialize with default template
        const defaultWorkflow = this.getTemplates()[0];
        this.saveWorkflow(defaultWorkflow);
        this.setActiveWorkflowId(defaultWorkflow.id);
      }
    } catch (e) {
      console.warn('Storage init warning:', e);
    }
  }

  getWorkflowList() {
    try {
      const raw = getItem(WORKFLOW_LIST_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  saveWorkflowList(list) {
    setItem(WORKFLOW_LIST_KEY, JSON.stringify(list));
  }

  getActiveWorkflowId() {
    return getItem(ACTIVE_WORKFLOW_KEY);
  }

  setActiveWorkflowId(id) {
    setItem(ACTIVE_WORKFLOW_KEY, id);
  }

  saveWorkflow(workflow) {
    if (!workflow.id) {
      workflow.id = `wf_${Date.now()}`;
    }
    workflow.updatedAt = new Date().toISOString();

    // Save workflow data
    setItem(`${STORAGE_PREFIX}${workflow.id}`, JSON.stringify(workflow));

    // Update list index
    const list = this.getWorkflowList();
    const existingIdx = list.findIndex(w => w.id === workflow.id);
    const meta = {
      id: workflow.id,
      name: workflow.name || 'Untitled Workflow',
      updatedAt: workflow.updatedAt,
      nodeCount: (workflow.nodes || []).length
    };

    if (existingIdx >= 0) {
      list[existingIdx] = meta;
    } else {
      list.unshift(meta);
    }
    this.saveWorkflowList(list);
    return workflow;
  }

  loadWorkflow(id) {
    try {
      const raw = getItem(`${STORAGE_PREFIX}${id}`);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.error('Error loading workflow:', e);
    }
    return null;
  }

  deleteWorkflow(id) {
    removeItem(`${STORAGE_PREFIX}${id}`);
    const list = this.getWorkflowList().filter(w => w.id !== id);
    this.saveWorkflowList(list);
    if (this.getActiveWorkflowId() === id) {
      this.setActiveWorkflowId(list[0]?.id || null);
    }
  }

  exportWorkflowJson(workflow) {
    return JSON.stringify(workflow, null, 2);
  }

  importWorkflowJson(jsonStr) {
    const data = JSON.parse(jsonStr);
    data.id = `wf_${Date.now()}`;
    data.name = `${data.name || 'Imported Workflow'} (Imported)`;
    data.updatedAt = new Date().toISOString();
    this.saveWorkflow(data);
    this.setActiveWorkflowId(data.id);
    return data;
  }

  // -------------------------------------------------------------
  // PRELOADED SHOWCASE TEMPLATES
  // -------------------------------------------------------------
  getTemplates() {
    return [
      {
        id: 'template_fastwebmcp_agent',
        name: 'FastWebMCP Autonomous Agent',
        description: 'Discovers browser WebMCP tools, runs an autonomous AI agent, and formats results.',
        nodes: [
          {
            id: 'node_1',
            type: 'manual_trigger',
            name: 'When clicking "Test workflow"',
            position: { x: 80, y: 220 },
            params: {}
          },
          {
            id: 'node_2',
            type: 'webmcp_tool_call',
            name: 'Get Weather (WebMCP)',
            position: { x: 380, y: 220 },
            params: {
              toolName: 'get_weather',
              argumentsJson: '{\n  "city": "Madrid"\n}'
            }
          },
          {
            id: 'node_3',
            type: 'ai_agent_llm',
            name: 'AI Agent (LLM + WebMCP)',
            position: { x: 680, y: 220 },
            params: {
              provider: 'browser_mock',
              systemPrompt: 'You are an autonomous agent using FastWebMCP tools.',
              userPrompt: 'Formulate an alert based on weather: {{ JSON.stringify($json.result) }}',
              enableWebMcpTools: true
            }
          },
          {
            id: 'node_4',
            type: 'edit_fields_set',
            name: 'Format Response',
            position: { x: 980, y: 220 },
            params: {
              assignments: [
                { field: 'summary', value: '{{ $json.content }}' },
                { field: 'status', value: 'Ready for Dispatch' }
              ]
            }
          }
        ],
        connections: [
          { id: 'c1', fromNodeId: 'node_1', fromOutput: 'main', toNodeId: 'node_2', toInput: 'main' },
          { id: 'c2', fromNodeId: 'node_2', fromOutput: 'main', toNodeId: 'node_3', toInput: 'main' },
          { id: 'c3', fromNodeId: 'node_3', fromOutput: 'main', toNodeId: 'node_4', toInput: 'main' }
        ]
      },
      {
        id: 'template_kdd_gate_pipeline',
        name: 'KDD Contract Quality Gate',
        description: 'Validates data with a CCDD contract gate, routing valid items to processing and errors to alerts.',
        nodes: [
          {
            id: 'node_k1',
            type: 'manual_trigger',
            name: 'Test Trigger',
            position: { x: 80, y: 240 },
            params: {}
          },
          {
            id: 'node_k2',
            type: 'code_javascript',
            name: 'Generate Ingestion Items',
            position: { x: 340, y: 240 },
            params: {
              code: `return [\n  { json: { id: "USR-001", name: "Alice", status: "active", email: "alice@example.com" } },\n  { json: { id: "USR-002", name: "Bob", status: null, email: "" } }\n];`
            }
          },
          {
            id: 'node_k3',
            type: 'kdd_contract_gate',
            name: 'KDD Contract Gate',
            position: { x: 640, y: 240 },
            params: {
              contractName: 'user_ingestion_v1',
              requiredFields: ['id', 'status', 'email']
            }
          },
          {
            id: 'node_k4',
            type: 'if_conditional',
            name: 'IF Contract Valid',
            position: { x: 940, y: 240 },
            params: {
              field: '{{ $json._kdd_validation.valid }}',
              operator: '==',
              value: 'true'
            }
          },
          {
            id: 'node_k5_true',
            type: 'edit_fields_set',
            name: 'Processed Valid Data',
            position: { x: 1240, y: 150 },
            params: {
              assignments: [
                { field: 'ingested', value: 'approved' },
                { field: 'pipeline', value: 'KDD Production' }
              ]
            }
          },
          {
            id: 'node_k6_false',
            type: 'edit_fields_set',
            name: 'Log Validation Violation',
            position: { x: 1240, y: 340 },
            params: {
              assignments: [
                { field: 'ingested', value: 'rejected' },
                { field: 'errorReason', value: 'Missing fields: {{ $json._kdd_validation.missingFields.join(", ") }}' }
              ]
            }
          }
        ],
        connections: [
          { id: 'ck1', fromNodeId: 'node_k1', fromOutput: 'main', toNodeId: 'node_k2', toInput: 'main' },
          { id: 'ck2', fromNodeId: 'node_k2', fromOutput: 'main', toNodeId: 'node_k3', toInput: 'main' },
          { id: 'ck3', fromNodeId: 'node_k3', fromOutput: 'main', toNodeId: 'node_k4', toInput: 'main' },
          { id: 'ck4', fromNodeId: 'node_k4', fromOutput: 'true', toNodeId: 'node_k5_true', toInput: 'main' },
          { id: 'ck5', fromNodeId: 'node_k4', fromOutput: 'false', toNodeId: 'node_k6_false', toInput: 'main' }
        ]
      },
      {
        id: 'template_crypto_monitor',
        name: 'Public API & Data Flow',
        description: 'Fetches sample data from a public API, extracts fields with JS Code, and calculates metrics.',
        nodes: [
          {
            id: 'node_c1',
            type: 'manual_trigger',
            name: 'Manual Trigger',
            position: { x: 100, y: 200 },
            params: {}
          },
          {
            id: 'node_c2',
            type: 'http_request',
            name: 'Fetch Sample Todo',
            position: { x: 400, y: 200 },
            params: {
              method: 'GET',
              url: 'https://jsonplaceholder.typicode.com/todos/1'
            }
          },
          {
            id: 'node_c3',
            type: 'code_javascript',
            name: 'Enrich & Calculate',
            position: { x: 700, y: 200 },
            params: {
              code: `const todo = $input.first().json.data;\nreturn [{\n  json: {\n    taskTitle: todo.title,\n    isCompleted: todo.completed,\n    priority: todo.id < 5 ? 'High' : 'Normal',\n    checkedAt: new Date().toISOString()\n  }\n}];`
            }
          },
          {
            id: 'node_c4',
            type: 'webmcp_exporter',
            name: 'Expose As WebMCP Tool',
            position: { x: 1000, y: 200 },
            params: {
              toolName: 'get_todo_metrics',
              description: 'Exposes processed todo metrics via browser modelContext'
            }
          }
        ],
        connections: [
          { id: 'cc1', fromNodeId: 'node_c1', fromOutput: 'main', toNodeId: 'node_c2', toInput: 'main' },
          { id: 'cc2', fromNodeId: 'node_c2', fromOutput: 'main', toNodeId: 'node_c3', toInput: 'main' },
          { id: 'cc3', fromNodeId: 'node_c3', fromOutput: 'main', toNodeId: 'node_c4', toInput: 'main' }
        ]
      },
      {
        id: 'template_fastwebmcp_forms',
        name: 'FastWebMCP Form Submission Bridge',
        description: 'Connects a declarative web form directly to an automated workflow pipeline.',
        nodes: [
          {
            id: 'node_f1',
            type: 'webmcp_trigger',
            name: 'WebMCP Tool Trigger',
            position: { x: 100, y: 220 },
            params: {
              toolName: 'submit_support_ticket'
            }
          },
          {
            id: 'node_f2',
            type: 'fastwebmcp_declarative',
            name: 'Annotate Declarative Form',
            position: { x: 420, y: 220 },
            params: {
              toolName: 'support_form',
              tooldescription: 'Support request ticket'
            }
          },
          {
            id: 'node_f3',
            type: 'webmcp_tool_call',
            name: 'Calculate Estimated Wait',
            position: { x: 740, y: 220 },
            params: {
              toolName: 'calculate',
              argumentsJson: '{\n  "expression": "15 * 3 + 5"\n}'
            }
          },
          {
            id: 'node_f4',
            type: 'edit_fields_set',
            name: 'Dispatch Confirmation',
            position: { x: 1060, y: 220 },
            params: {
              assignments: [
                { field: 'ticketStatus', value: 'Queued' },
                { field: 'estimatedMinutes', value: '{{ $json.result.result }} min' }
              ]
            }
          }
        ],
        connections: [
          { id: 'cf1', fromNodeId: 'node_f1', fromOutput: 'main', toNodeId: 'node_f2', toInput: 'main' },
          { id: 'cf2', fromNodeId: 'node_f2', fromOutput: 'main', toNodeId: 'node_f3', toInput: 'main' },
          { id: 'cf3', fromNodeId: 'node_f3', fromOutput: 'main', toNodeId: 'node_f4', toInput: 'main' }
        ]
      }
    ];
  }
}

export const storage = new WorkflowStorage();
