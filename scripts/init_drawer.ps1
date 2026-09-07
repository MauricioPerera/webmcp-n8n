import os

code_parts = []
def add(text):
    code_parts.append(text)

add("""/**
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
""")

with open('scripts/build_drawer.py', 'w', encoding='utf-8') as f:
    f.write(''.join(code_parts))
