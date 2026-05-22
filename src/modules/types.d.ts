export interface ModuleDefinition {
  id: string;
  name: string;
  desc: string;
  /** @deprecated Legacy DSL — use graph manifest via GRAPH_MODULE_REGISTRY */
  code: string;
  category: string;
  /** When true, module is graph-native and composable */
  graphNative?: boolean;
}

export interface ModuleCategory {
  category: string;
  items: ModuleDefinition[];
}

export interface GraphModuleMergeStrategy {
  dedupeBot?: boolean;
  dedupeStart?: boolean;
  mergeGlobals?: 'first_wins' | 'reuse' | 'merge' | 'warn';
  mergeMenus?: boolean;
  placement?: 'foundation' | 'fragment';
}

export interface GraphModuleManifest {
  id: string;
  version: number;
  name?: string;
  category?: string;
  dependencies: string[];
  capabilities: string[];
  globals: string[];
  callbacks: string[];
  commands?: string[];
  mergeStrategy: GraphModuleMergeStrategy;
  graph: { nodes: object[]; edges: object[] };
  exports?: Record<string, string>;
  imports?: string[];
}

export interface ModuleComposePayload {
  moduleIds: string[];
  document: import('../constructor/graph_document/graph_document.js').GraphDocument;
  report: {
    ok: boolean;
    moduleIds: string[];
    resolvedDependencies: string[];
    conflicts: object[];
    fixes: object[];
    diagnostics: object[];
  };
}
