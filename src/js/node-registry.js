/**
 * n8n-kdd: Node Registry & Node Execution Implementations
 * Defines all standard node types, visual metadata, parameter schemas,
 * and execution engines.
 */

import { evaluateExpression, interpolateObject } from './expressions.js';
import { webmcp } from './webmcp-bridge.js';

export const NODE_CATEGORIES = {
  trigger: { id: 'trigger', name: 'Triggers', color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)' },
  logic: { id: 'logic', name: 'Logic & Routing', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.12)' },
  transform: { id: 'transform', name: 'Data Transform', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.12)' },
  network: { id: 'network', name: 'Network & APIs', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)' },
  ai_mcp: { id: 'ai_mcp', name: 'AI & WebMCP', color: '#ec4899', bg: 'rgba(236, 72, 153, 0.12)' }
};

export const NODE_DEFINITIONS = {
  // -------------------------------------------------------------
  // TRIGGERS
  // -------------------------------------------------------------
  manual_trigger: {
    type: 'manual_trigger',
    name: 'Manual Trigger',
    category: 'trigger',
    icon: 'play',
    description: 'Runs workflow on demand when clicking "Test workflow".',
    inputs: [],
    outputs: ['main'],
    defaultParams: {},
    execute: async (params, inputItems) => {
      return [{
        json: {
          timestamp: new Date().toISOString(),
          trigger: 'manual',
          status: 'success'
        }
      }];
    }
  },

  schedule_trigger: {
    type: 'schedule_trigger',
    name: 'Schedule Trigger',
    category: 'trigger',
    icon: 'clock',
    description: 'Triggers periodically at a specified interval.',
    inputs: [],
    outputs: ['main'],
    defaultParams: {
      intervalSeconds: 10,
      triggerOnLoad: true
    },
    execute: async (params) => {
      return [{
        json: {
          timestamp: new Date().toISOString(),
          intervalSeconds: params.intervalSeconds || 10,
          trigger: 'schedule'
        }
      }];
    }
  },

  webhook_trigger: {
    type: 'webhook_trigger',
    name: 'Event / Webhook',
    category: 'trigger',
    icon: 'radio',
    description: 'Fires upon browser CustomEvent, postMessage, or URL param.',
    inputs: [],
    outputs: ['main'],
    defaultParams: {
      eventName: 'n8n:event',
      listenPostMessage: true
    },
    execute: async (params, inputItems, context) => {
      const payload = context?.triggerPayload || { event: params.eventName, query: {} };
      return [{
        json: {
          ...payload,
          timestamp: new Date().toISOString()
        }
      }];
    }
  },

  webmcp_trigger: {
    type: 'webmcp_trigger',
    name: 'WebMCP Tool Trigger',
    category: 'trigger',
    icon: 'cpu',
    description: 'Fires when an AI agent calls the registered WebMCP tool.',
    inputs: [],
    outputs: ['main'],
    defaultParams: {
      toolName: 'my_workflow_tool',
      description: 'Triggered by AI Agent via WebMCP'
    },
    execute: async (params, inputItems, context) => {
      const args = context?.triggerPayload || {};
      return [{
        json: {
          toolName: params.toolName,
          arguments: args,
          invokedAt: new Date().toISOString()
        }
      }];
    }
  },

  // -------------------------------------------------------------
  // LOGIC & ROUTING
  // -------------------------------------------------------------
  if_conditional: {
    type: 'if_conditional',
    name: 'IF',
    category: 'logic',
    icon: 'git-branch',
    description: 'Routes items to True or False output based on conditions.',
    inputs: ['main'],
    outputs: ['true', 'false'],
    defaultParams: {
      field: '{{ $json.value }}',
      operator: '==',
      value: 'true'
    },
    execute: async (params, inputItems, context) => {
      const itemsTrue = [];
      const itemsFalse = [];

      for (let i = 0; i < inputItems.length; i++) {
        const item = inputItems[i];
        const itemContext = { ...context, $json: item.json, $index: i };

        const leftVal = evaluateExpression(params.field, itemContext);
        const rightVal = evaluateExpression(params.value, itemContext);
        const op = params.operator || '==';

        let conditionPassed = false;
        switch (op) {
          case '==':
            conditionPassed = String(leftVal) === String(rightVal) || leftVal == rightVal;
            break;
          case '!=':
            conditionPassed = String(leftVal) !== String(rightVal) && leftVal != rightVal;
            break;
          case '>':
            conditionPassed = Number(leftVal) > Number(rightVal);
            break;
          case '<':
            conditionPassed = Number(leftVal) < Number(rightVal);
            break;
          case '>=':
            conditionPassed = Number(leftVal) >= Number(rightVal);
            break;
          case '<=':
            conditionPassed = Number(leftVal) <= Number(rightVal);
            break;
          case 'contains':
            conditionPassed = String(leftVal).toLowerCase().includes(String(rightVal).toLowerCase());
            break;
          case 'not_contains':
            conditionPassed = !String(leftVal).toLowerCase().includes(String(rightVal).toLowerCase());
            break;
          case 'is_empty':
            conditionPassed = leftVal === null || leftVal === undefined || leftVal === '' || (Array.isArray(leftVal) && leftVal.length === 0);
            break;
          case 'is_not_empty':
            conditionPassed = leftVal !== null && leftVal !== undefined && leftVal !== '' && (!Array.isArray(leftVal) || leftVal.length > 0);
            break;
          default:
            conditionPassed = Boolean(leftVal);
        }

        if (conditionPassed) {
          itemsTrue.push(item);
        } else {
          itemsFalse.push(item);
        }
      }

      // Return output routing object
      return {
        outputRouting: {
          true: itemsTrue,
          false: itemsFalse
        }
      };
    }
  },

  switch_router: {
    type: 'switch_router',
    name: 'Switch',
    category: 'logic',
    icon: 'shuffle',
    description: 'Routes items across multiple outputs based on matching rules.',
    inputs: ['main'],
    outputs: ['0', '1', '2', 'fallback'],
    defaultParams: {
      field: '{{ $json.category }}',
      rule0: 'sales',
      rule1: 'support',
      rule2: 'billing'
    },
    execute: async (params, inputItems, context) => {
      const routing = { '0': [], '1': [], '2': [], fallback: [] };

      for (let i = 0; i < inputItems.length; i++) {
        const item = inputItems[i];
        const itemContext = { ...context, $json: item.json, $index: i };
        const val = String(evaluateExpression(params.field, itemContext));

        if (val === String(params.rule0)) {
          routing['0'].push(item);
        } else if (val === String(params.rule1)) {
          routing['1'].push(item);
        } else if (val === String(params.rule2)) {
          routing['2'].push(item);
        } else {
          routing.fallback.push(item);
        }
      }

      return { outputRouting: routing };
    }
  },

  filter_node: {
    type: 'filter_node',
    name: 'Filter',
    category: 'logic',
    icon: 'filter',
    description: 'Filters incoming items, discarding those that do not match.',
    inputs: ['main'],
    outputs: ['main'],
    defaultParams: {
      field: '{{ $json.status }}',
      operator: '==',
      value: 'active'
    },
    execute: async (params, inputItems, context) => {
      const passed = [];
      for (let i = 0; i < inputItems.length; i++) {
        const item = inputItems[i];
        const itemContext = { ...context, $json: item.json, $index: i };
        const leftVal = evaluateExpression(params.field, itemContext);
        const rightVal = evaluateExpression(params.value, itemContext);

        let keep = false;
        if (params.operator === '==') keep = String(leftVal) === String(rightVal);
        else if (params.operator === '!=') keep = String(leftVal) !== String(rightVal);
        else if (params.operator === '>') keep = Number(leftVal) > Number(rightVal);
        else if (params.operator === '<') keep = Number(leftVal) < Number(rightVal);
        else if (params.operator === 'contains') keep = String(leftVal).includes(String(rightVal));
        else keep = Boolean(leftVal);

        if (keep) passed.push(item);
      }
      return passed;
    }
  },

  merge_node: {
    type: 'merge_node',
    name: 'Merge',
    category: 'logic',
    icon: 'minimize-2',
    description: 'Merges items from multiple upstream branches.',
    inputs: ['input1', 'input2'],
    outputs: ['main'],
    defaultParams: {
      mode: 'append' // append | merge_by_index
    },
    execute: async (params, inputItems, context) => {
      // In DAG execution, inputItems is the merged array of all incoming inputs
      return inputItems || [];
    }
  },

  // -------------------------------------------------------------
  // TRANSFORM
  // -------------------------------------------------------------
  code_javascript: {
    type: 'code_javascript',
    name: 'Code',
    category: 'transform',
    icon: 'code',
    description: 'Runs custom JavaScript to transform or create items.',
    inputs: ['main'],
    outputs: ['main'],
    defaultParams: {
      code: `// n8n standard JS code sandbox\nfor (const item of $input.all()) {\n  item.json.processedAt = new Date().toISOString();\n  item.json.transformed = true;\n}\nreturn $input.all();`
    },
    execute: async (params, inputItems, context) => {
      const code = params.code || 'return $input.all();';

      const safeItems = JSON.parse(JSON.stringify(inputItems || []));

      const inputProxy = {
        all: () => safeItems,
        first: () => safeItems[0] || null,
        item: safeItems[0] ? safeItems[0].json : {}
      };

      const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
      const fn = new AsyncFunction('$input', 'items', '$node', '$now', `
        try {
          ${code}
        } catch (err) {
          throw new Error("User Code Error: " + err.message);
        }
      `);

      const result = await fn(inputProxy, safeItems, context?.nodeOutputs || {}, new Date().toISOString());

      // Normalize output to n8n item array [{ json: { ... } }]
      if (!result) return [];
      if (Array.isArray(result)) {
        return result.map(it => {
          if (it && typeof it === 'object' && 'json' in it) return it;
          return { json: typeof it === 'object' ? it : { value: it } };
        });
      }
      if (typeof result === 'object') {
        if ('json' in result) return [result];
        return [{ json: result }];
      }
      return [{ json: { value: result } }];
    }
  },

  edit_fields_set: {
    type: 'edit_fields_set',
    name: 'Edit Fields (Set)',
    category: 'transform',
    icon: 'edit-3',
    description: 'Add, update or transform fields on items.',
    inputs: ['main'],
    outputs: ['main'],
    defaultParams: {
      mode: 'set',
      assignments: [
        { field: 'greeting', value: 'Hello {{ $json.name || "World" }}' },
        { field: 'updatedAt', value: '{{ $now }}' }
      ]
    },
    execute: async (params, inputItems, context) => {
      const assignments = params.assignments || [];
      const output = [];

      for (let i = 0; i < inputItems.length; i++) {
        const item = inputItems[i];
        const newJson = { ...item.json };
        const itemContext = { ...context, $json: item.json, $index: i };

        for (const { field, value } of assignments) {
          if (!field) continue;
          newJson[field] = evaluateExpression(value, itemContext);
        }

        output.push({ json: newJson });
      }

      return output;
    }
  },

  json_transform: {
    type: 'json_transform',
    name: 'JSON Transform',
    category: 'transform',
    icon: 'file-text',
    description: 'Parse JSON strings into objects or stringify objects.',
    inputs: ['main'],
    outputs: ['main'],
    defaultParams: {
      action: 'parse', // parse | stringify
      sourceField: 'data',
      targetField: 'parsedData'
    },
    execute: async (params, inputItems) => {
      return inputItems.map(item => {
        const newJson = { ...item.json };
        const val = newJson[params.sourceField];
        if (params.action === 'parse') {
          try {
            newJson[params.targetField || 'parsed'] = typeof val === 'string' ? JSON.parse(val) : val;
          } catch (e) {
            newJson[params.targetField || 'parsed'] = null;
            newJson._parseError = e.message;
          }
        } else {
          newJson[params.targetField || 'stringified'] = JSON.stringify(val);
        }
        return { json: newJson };
      });
    }
  },

  okf_parser: {
    type: 'okf_parser',
    name: 'OKF / Markdown Parser',
    category: 'transform',
    icon: 'book-open',
    description: 'Parses OKF markdown content with YAML frontmatter into structured JSON.',
    inputs: ['main'],
    outputs: ['main'],
    defaultParams: {
      markdownContent: '---\ntype: "Task Contract"\ntitle: "Sample Contract"\nversion: 1.0\n---\n\n# Body content\nParsed OKF node.'
    },
    execute: async (params, inputItems, context) => {
      const content = evaluateExpression(params.markdownContent, context) || '';
      const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);

      let frontmatter = {};
      let body = content;

      if (fmMatch) {
        body = fmMatch[2].trim();
        const yamlLines = fmMatch[1].split('\n');
        for (const line of yamlLines) {
          const colonIdx = line.indexOf(':');
          if (colonIdx > 0) {
            const key = line.slice(0, colonIdx).trim();
            let val = line.slice(colonIdx + 1).trim();
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
              val = val.slice(1, -1);
            }
            frontmatter[key] = val;
          }
        }
      }

      return [{
        json: {
          frontmatter,
          body,
          isOkfValid: Boolean(frontmatter.type && frontmatter.title)
        }
      }];
    }
  },

  // -------------------------------------------------------------
  // NETWORK & HTTP
  // -------------------------------------------------------------
  http_request: {
    type: 'http_request',
    name: 'HTTP Request',
    category: 'network',
    icon: 'globe',
    description: 'Makes client-side HTTP requests with fetch.',
    inputs: ['main'],
    outputs: ['main'],
    defaultParams: {
      method: 'GET',
      url: 'https://jsonplaceholder.typicode.com/todos/1',
      headers: [
        { name: 'Accept', value: 'application/json' }
      ],
      body: '',
      useCorsProxy: false
    },
    execute: async (params, inputItems, context) => {
      const results = [];

      for (let i = 0; i < (inputItems.length || 1); i++) {
        const item = inputItems[i] || { json: {} };
        const itemContext = { ...context, $json: item.json, $index: i };

        let url = evaluateExpression(params.url, itemContext);
        const method = (params.method || 'GET').toUpperCase();

        if (params.useCorsProxy) {
          url = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
        }

        const headersObj = {};
        if (Array.isArray(params.headers)) {
          for (const h of params.headers) {
            if (h.name) headersObj[h.name] = evaluateExpression(h.value, itemContext);
          }
        }

        const fetchOptions = {
          method,
          headers: headersObj
        };

        if (['POST', 'PUT', 'PATCH'].includes(method) && params.body) {
          const evalBody = evaluateExpression(params.body, itemContext);
          fetchOptions.body = typeof evalBody === 'object' ? JSON.stringify(evalBody) : evalBody;
          if (!headersObj['Content-Type']) {
            headersObj['Content-Type'] = 'application/json';
          }
        }

        try {
          const response = await fetch(url, fetchOptions);
          let responseData;
          const contentType = response.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            responseData = await response.json();
          } else {
            responseData = await response.text();
          }

          results.push({
            json: {
              status: response.status,
              statusText: response.statusText,
              ok: response.ok,
              data: responseData
            }
          });
        } catch (err) {
          results.push({
            json: {
              error: err.message,
              url,
              failed: true
            }
          });
        }
      }

      return results;
    }
  },

  // -------------------------------------------------------------
  // AI & WEBMCP
  // -------------------------------------------------------------
  webmcp_tool_call: {
    type: 'webmcp_tool_call',
    name: 'WebMCP Tool Call',
    category: 'ai_mcp',
    icon: 'terminal',
    description: 'Executes tools registered via WebMCP or FastWebMCP.',
    inputs: ['main'],
    outputs: ['main'],
    defaultParams: {
      toolName: 'calculate',
      argumentsJson: '{\n  "expression": "42 * 2"\n}'
    },
    execute: async (params, inputItems, context) => {
      const results = [];
      const toolName = params.toolName;

      for (let i = 0; i < (inputItems.length || 1); i++) {
        const item = inputItems[i] || { json: {} };
        const itemContext = { ...context, $json: item.json, $index: i };

        let args = {};
        if (params.argumentsJson) {
          const evalArgs = evaluateExpression(params.argumentsJson, itemContext);
          args = typeof evalArgs === 'string' ? JSON.parse(evalArgs) : evalArgs;
        }

        try {
          const result = await webmcp.callTool(toolName, args);
          results.push({
            json: {
              toolName,
              arguments: args,
              result,
              executedAt: new Date().toISOString()
            }
          });
        } catch (err) {
          results.push({
            json: {
              toolName,
              error: err.message,
              failed: true
            }
          });
        }
      }

      return results;
    }
  },

  fastwebmcp_declarative: {
    type: 'fastwebmcp_declarative',
    name: 'FastWebMCP Form Adapter',
    category: 'ai_mcp',
    icon: 'layout',
    description: 'Binds or triggers declarative FastWebMCP tools on DOM forms.',
    inputs: ['main'],
    outputs: ['main'],
    defaultParams: {
      toolName: 'submit_support_request',
      tooldescription: 'Submit support request to agent queue'
    },
    execute: async (params, inputItems) => {
      return inputItems.map(item => ({
        json: {
          declarativeTool: params.toolName,
          description: params.tooldescription,
          status: 'annotated',
          inputReceived: item.json
        }
      }));
    }
  },

  ai_agent_llm: {
    type: 'ai_agent_llm',
    name: 'AI Agent (LLM)',
    category: 'ai_mcp',
    icon: 'sparkles',
    description: 'Executes reasoning prompts with optional WebMCP tools integration.',
    inputs: ['main'],
    outputs: ['main'],
    defaultParams: {
      provider: 'browser_mock', // browser_mock | openai_compatible | groq | ollama
      apiUrl: 'https://api.openai.com/v1/chat/completions',
      apiKey: '',
      model: 'gpt-4o-mini',
      systemPrompt: 'You are an autonomous AI workflow assistant powered by WebMCP.',
      userPrompt: 'Summarize the following data and formulate a response: {{ JSON.stringify($json) }}',
      enableWebMcpTools: true
    },
    execute: async (params, inputItems, context) => {
      const results = [];

      for (let i = 0; i < (inputItems.length || 1); i++) {
        const item = inputItems[i] || { json: {} };
        const itemContext = { ...context, $json: item.json, $index: i };

        const systemPrompt = evaluateExpression(params.systemPrompt, itemContext);
        const userPrompt = evaluateExpression(params.userPrompt, itemContext);

        if (params.provider === 'browser_mock') {
          // Autonomous client-side mock LLM with WebMCP reasoning
          const availableTools = webmcp.listTools().map(t => t.name);
          results.push({
            json: {
              role: 'assistant',
              model: 'browser-webmcp-agent',
              content: `[AI Agent Response]: Processed prompt "${userPrompt.slice(0, 60)}..." successfully. Available WebMCP tools: [${availableTools.join(', ')}].`,
              toolsExposed: availableTools,
              completedAt: new Date().toISOString()
            }
          });
        } else {
          // Real API call (OpenAI, Groq, Ollama)
          try {
            const messages = [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ];

            const bodyPayload = {
              model: params.model,
              messages
            };

            if (params.enableWebMcpTools) {
              bodyPayload.tools = webmcp.listTools().map(t => ({
                type: 'function',
                function: {
                  name: t.name,
                  description: t.description,
                  parameters: t.inputSchema
                }
              }));
            }

            const res = await fetch(params.apiUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(params.apiKey ? { 'Authorization': `Bearer ${params.apiKey}` } : {})
              },
              body: JSON.stringify(bodyPayload)
            });

            const data = await res.json();
            results.push({
              json: {
                provider: params.provider,
                response: data,
                content: data?.choices?.[0]?.message?.content || JSON.stringify(data)
              }
            });
          } catch (err) {
            results.push({
              json: {
                provider: params.provider,
                error: err.message,
                failed: true
              }
            });
          }
        }
      }

      return results;
    }
  },

  webmcp_exporter: {
    type: 'webmcp_exporter',
    name: 'WebMCP Server Exporter',
    category: 'ai_mcp',
    icon: 'share-2',
    description: 'Registers this workflow as an active WebMCP tool for browser agents.',
    inputs: ['main'],
    outputs: ['main'],
    defaultParams: {
      toolName: 'run_analysis_workflow',
      description: 'Executes the data analysis pipeline via WebMCP'
    },
    execute: async (params, inputItems) => {
      // Register into WebMCP
      webmcp.registerTool({
        name: params.toolName,
        description: params.description,
        inputSchema: {
          type: 'object',
          properties: {
            payload: { type: 'object' }
          }
        },
        execute: async (args) => {
          return { success: true, receivedArgs: args, source: 'exported_workflow' };
        },
        source: 'workflow_exporter'
      });

      return [{
        json: {
          registeredTool: params.toolName,
          status: 'active',
          exposedToModelContext: true
        }
      }];
    }
  },

  kdd_contract_gate: {
    type: 'kdd_contract_gate',
    name: 'KDD Contract Gate',
    category: 'ai_mcp',
    icon: 'shield-check',
    description: 'Validates payloads against CCDD contracts and schema rules.',
    inputs: ['main'],
    outputs: ['main'],
    defaultParams: {
      contractName: 'user_profile_contract',
      requiredFields: ['id', 'status'],
      allowExtraFields: true
    },
    execute: async (params, inputItems) => {
      const required = params.requiredFields || [];
      const output = [];

      for (const item of inputItems) {
        const missing = [];
        for (const field of required) {
          if (item.json[field] === undefined || item.json[field] === null) {
            missing.push(field);
          }
        }

        const isValid = missing.length === 0;
        output.push({
          json: {
            ...item.json,
            _kdd_validation: {
              contract: params.contractName,
              valid: isValid,
              missingFields: missing,
              validatedAt: new Date().toISOString()
            }
          }
        });
      }

      return output;
    }
  }
};
