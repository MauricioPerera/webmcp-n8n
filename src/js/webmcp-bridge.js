/**
 * n8n-kdd: FastWebMCP & WebMCP Standard Bridge
 * Implements WebMCP (document.modelContext / navigator.modelContext)
 * and FastWebMCP ergonomics (Mauricio Perera / webmcp.com).
 */

export class WebMcpBridge {
  constructor() {
    this.tools = new Map();
    this.declarativeTools = new Map();
    this.initNativeContext();
    this.registerBuiltInTools();
  }

  /**
   * Detect and hook into document.modelContext or navigator.modelContext
   */
  initNativeContext() {
    // Expose window.fastwebmcp
    if (typeof window !== 'undefined') {
      window.fastwebmcp = this;

      // Polyfill or hook document.modelContext
      if (!window.document.modelContext) {
        window.document.modelContext = {
          registerTool: (tool) => this.registerTool(tool),
          listTools: () => this.listTools(),
          callTool: (name, args) => this.callTool(name, args)
        };
      } else {
        // Wrap existing modelContext
        const origRegister = window.document.modelContext.registerTool?.bind(window.document.modelContext);
        if (origRegister) {
          const self = this;
          window.document.modelContext.registerTool = function(tool) {
            self.registerTool(tool);
            return origRegister(tool);
          };
        }
      }

      // Check navigator.modelContext fallback
      if (!window.navigator.modelContext) {
        window.navigator.modelContext = window.document.modelContext;
      }
    }
  }

  /**
   * Register a WebMCP tool (Imperative API)
   * @param {Object} tool - { name, description, inputSchema, execute }
   */
  registerTool(tool) {
    if (!tool || !tool.name || typeof tool.execute !== 'function') {
      throw new Error('Invalid WebMCP tool: name and execute function are required');
    }

    const normalizedTool = {
      name: tool.name,
      description: tool.description || '',
      inputSchema: tool.inputSchema || { type: 'object', properties: {} },
      execute: tool.execute,
      source: tool.source || 'user'
    };

    this.tools.set(tool.name, normalizedTool);

    // Dispatch event
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('webmcp:tool-registered', { detail: normalizedTool }));
    }

    return normalizedTool;
  }

  /**
   * Register a Declarative Tool over an HTML Form (FastWebMCP Declarative API)
   */
  defineDeclarativeTool(formElement, spec) {
    if (!formElement) return null;
    const name = spec.name || formElement.getAttribute('toolname') || 'form_tool';
    const description = spec.description || formElement.getAttribute('tooldescription') || '';

    formElement.setAttribute('toolname', name);
    formElement.setAttribute('tooldescription', description);

    if (Array.isArray(spec.fields)) {
      for (const field of spec.fields) {
        const input = formElement.querySelector(`[name="${field.name}"]`);
        if (input && field.description) {
          input.setAttribute('toolparamdescription', field.description);
        }
      }
    }

    const tool = {
      name,
      description,
      formElement,
      inputSchema: spec.inputSchema || { type: 'object' },
      execute: async (inputData) => {
        // Fill form fields
        for (const [k, v] of Object.entries(inputData || {})) {
          const field = formElement.querySelector(`[name="${k}"]`);
          if (field) {
            field.value = v;
            field.dispatchEvent(new Event('input', { bubbles: true }));
            field.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }
        // Submit
        formElement.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        return { success: true, message: `Declarative tool "${name}" submitted form` };
      },
      source: 'declarative'
    };

    this.tools.set(name, tool);
    this.declarativeTools.set(name, tool);
    return tool;
  }

  /**
   * Call a tool by name
   */
  async callTool(name, args = {}) {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`WebMCP Tool "${name}" not found in registry`);
    }

    try {
      const result = await tool.execute(args);
      return result;
    } catch (err) {
      console.error(`[WebMCP Execution Error] ${name}:`, err);
      throw err;
    }
  }

  /**
   * List all registered tools
   */
  listTools() {
    return Array.from(this.tools.values()).map(t => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
      source: t.source
    }));
  }

  /**
   * Register default built-in WebMCP tools from webmcp.com specification
   */
  registerBuiltInTools() {
    // 1. Math Calculator
    this.registerTool({
      name: 'calculate',
      description: 'Performs safe mathematical calculations.',
      inputSchema: {
        type: 'object',
        properties: {
          expression: { type: 'string', description: 'Mathematical expression, e.g. "42 * 1.08"' }
        },
        required: ['expression']
      },
      execute: async ({ expression }) => {
        // Sanitize: allow only numbers, operators, parens, Math functions
        const sanitized = String(expression).replace(/[^0-9+\-*/()., Math.sincoetqrplgb]/g, '');
        const fn = new Function(`return (${sanitized})`);
        const result = fn();
        return { expression, result };
      },
      source: 'builtin'
    });

    // 2. Weather Tool (WebMCP demo)
    this.registerTool({
      name: 'get_weather',
      description: 'Get current weather conditions for a city.',
      inputSchema: {
        type: 'object',
        properties: {
          city: { type: 'string', description: 'City name' }
        },
        required: ['city']
      },
      execute: async ({ city }) => {
        const conditions = ['Sunny', 'Cloudy', 'Rainy', 'Clear', 'Windy'];
        const temp = Math.floor(Math.random() * 15) + 15;
        const condition = conditions[Math.floor(Math.random() * conditions.length)];
        return {
          city: city || 'Madrid',
          temperature: `${temp}°C`,
          condition,
          humidity: `${Math.floor(Math.random() * 40) + 40}%`,
          source: 'webmcp.com-mock-provider'
        };
      },
      source: 'builtin'
    });

    // 3. Currency Converter
    this.registerTool({
      name: 'convert_currency',
      description: 'Convert amounts between major currencies.',
      inputSchema: {
        type: 'object',
        properties: {
          amount: { type: 'number', description: 'Amount to convert' },
          from: { type: 'string', description: 'Source currency code, e.g. USD, EUR, GBP' },
          to: { type: 'string', description: 'Target currency code, e.g. EUR, USD, JPY' }
        },
        required: ['amount', 'from', 'to']
      },
      execute: async ({ amount, from, to }) => {
        const rates = { USD: 1.0, EUR: 0.92, GBP: 0.79, JPY: 152.5, CAD: 1.36 };
        const rateFrom = rates[from?.toUpperCase()] || 1.0;
        const rateTo = rates[to?.toUpperCase()] || 1.0;
        const converted = (Number(amount) / rateFrom) * rateTo;
        return {
          amount: Number(amount),
          from: from?.toUpperCase(),
          to: to?.toUpperCase(),
          result: Math.round(converted * 100) / 100
        };
      },
      source: 'builtin'
    });

    // 4. KDD Contract Validator Tool
    this.registerTool({
      name: 'kdd_validate_schema',
      description: 'Validates a data object against required KDD schema constraints.',
      inputSchema: {
        type: 'object',
        properties: {
          data: { type: 'object', description: 'Data object to validate' },
          requiredFields: { type: 'array', items: { type: 'string' } }
        },
        required: ['data', 'requiredFields']
      },
      execute: async ({ data, requiredFields = [] }) => {
        const missing = [];
        for (const field of requiredFields) {
          if (data[field] === undefined || data[field] === null || data[field] === '') {
            missing.push(field);
          }
        }
        return {
          valid: missing.length === 0,
          missingFields: missing,
          checkedAt: new Date().toISOString()
        };
      },
      source: 'builtin'
    });
  }
}

export const webmcp = new WebMcpBridge();
