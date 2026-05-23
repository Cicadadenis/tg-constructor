# Cicada-Studio: Глубокий анализ ошибок | Deep Analysis Report

**Дата:** 2026-05-22  
**Статус:** Критичные и потенциальные проблемы найдены  
**Версия проекта:** 0.1.0

---

## 🔴 P0 — КРИТИЧНЫЕ ОШИБКИ (User-Blocking)

### P0-01: Graph canvas useEffect dependency issue
**Файл:** [src/builder/ReactFlowCanvas.jsx](src/builder/ReactFlowCanvas.jsx#L101-L119)  
**Строка:** 101-119  
**Тип:** React infinite render / missing dependency  
**Статус:** 🔴 OPEN

```jsx
useEffect(() => {
  const rev = projection?.metadata?.revision;
  if (rev === lastRevRef.current && !draggingRef.current) return;
  lastRevRef.current = rev;

  setNodes(...);
  setEdges(...);
  
  // ... viewport logic ...
  
}, [projection?.metadata?.revision, selectedBlockId, setViewport, document]);
```

**Проблема:**  
- Зависимость `document` изменяется на каждый рендер (`graph.getGraphDocument()` вызывается каждый раз)
- Это вызывает бесконечный цикл обновлений canvas при изменении одного узла
- `projection` целиком должна быть в deps, или нужна мемоизация

**Решение:**  
Извлечь `revision` в отдельную переменную и добавить `projection.metadata?.revision` вместо `document`:
```jsx
}, [projection?.metadata?.revision, selectedBlockId, setViewport])
```

---

### P0-02: React Flow connection validation missing error catch
**Файл:** [src/builder/ReactFlowCanvas.jsx](src/builder/ReactFlowCanvas.jsx#L158-L188)  
**Строка:** 176  
**Тип:** Missing error handling  
**Статус:** 🔴 OPEN

```jsx
const onConnect = useCallback(
  (params) => {
    const doc = graph.getGraphDocument();
    const verdict = validateConnection(doc, { ... });
    if (!verdict?.ok) {
      onConnectFeedback?.({ ok: false, reason: verdict?.reason, params });
      return;
    }
    // ...
    const result = graphAddEdge(graph, { ... });
    if (!result?.ok) {
      onConnectFeedback?.({ ok: false, reason: result?.error || 'AddEdge rejected', params });
      return;
    }
    // Если graphAddEdge выбросит exception, он не будет поймана
  },
  [graph, onConnectFeedback],
);
```

**Проблема:**  
- `graphAddEdge()` может выбросить исключение, если граф невалидный или корруптированный
- UI зависнет без feedback пользователю

**Решение:**  
```jsx
try {
  const result = graphAddEdge(graph, { ... });
  // ...
} catch (error) {
  onConnectFeedback?.({ ok: false, reason: error.message, params });
}
```

---

## 🟠 P1 — СЕРЬЁЗНЫЕ БАГИ (Logic Errors)

### P1-01: Pipeline graph/stacks mismatch
**Файл:** [core/codegen/pipeline.js](core/codegen/pipeline.js#L65-L125)  
**Строка:** 65-70, 108-115  
**Тип:** Graph model inconsistency  
**Статус:** 🟠 OPEN

```js
// Line 65: При autoFix может заменяться workingFlow на ruleResult.flow
if (ruleResult.stacksModified && ruleResult.flow) {
  workingFlow = ruleResult.flow;
}

// Потом Line 108:
let stacks = ruleResult.stacks?.length ? ruleResult.stacks : flowToStacks(workingFlow);
// Но ruleResult.stacks был из СТАРОГО flow'а!
```

**Проблема:**  
- Если `ruleResult` модифицировал граф (`stacksModified=true`), то `ruleResult.stacks` может быть из старой версии
- При конвертации в Python возможны потери данных или неправильная генерация кода

**Решение:**  
```js
if (ruleResult.stacksModified && ruleResult.flow) {
  workingFlow = ruleResult.flow;
  stacks = flowToStacks(ruleResult.flow); // Пересчитать stacks
} else {
  stacks = ruleResult.stacks?.length ? ruleResult.stacks : flowToStacks(workingFlow);
}
```

---

### P1-02: Callback resolution missing null check
**Файл:** [core/codegen/ast/callbackResolver.js](core/codegen/ast/callbackResolver.js#L139-L165)  
**Строка:** 139-165  
**Тип:** Broken handler validation  
**Статус:** 🟠 OPEN

```js
export function validateCallbackHandlerConnectivity(flow, handlers) {
  const edges = flow?.edges || [];
  const nodes = flow?.nodes || [];
  const idToType = new Map(nodes.map((n) => [n.id, n?.data?.type || n?.type]));

  for (const h of handlers) {
    const rootId = h.root?.id;
    // ...
    const hasFlowEdge = edges.some((e) => {
      if (e.source !== rootId) return false;
      const t = idToType.get(e.target);
      return t && t !== 'callback'; // ← может быть undefined если e.target не в idToType
    });
```

**Проблема:**  
- `idToType.get(e.target)` может вернуть `undefined` если целевой узел удалён или ещё не загружен
- Это создаёт orphan edges → codegen может в них упасть

**Решение:**  
```js
const t = idToType.get(e.target);
if (!t || !nodes.find(n => n.id === e.target)) {
  errors.push({
    code: 'ORPHAN_EDGE',
    message: `Edge ${e.id}: target node ${e.target} не существует`,
    blockId: rootId,
  });
  continue;
}
return t && t !== 'callback';
```

---

### P1-03: Server route missing await
**Файл:** [server.mjs](server.mjs#L2280)  
**Строка:** ~2280  
**Тип:** Unhandled async Promise  
**Статус:** 🟠 OPEN

```js
function recordUserLogin(userId, ipOrReq, method) {
  if (!userId) return;
  const ip = (ipOrReq && typeof ipOrReq === 'object' && ipOrReq.headers)
    ? getClientIp(ipOrReq)
    : normalizeClientIp(ipOrReq);
  // ...
  if (ip) void persistUserLoginIp(userId, ip); // ← Если IP save fail, молча игнорируется
}
```

**Проблема:**  
- `persistUserLoginIp` async но результат игнорируется
- Если DB connection down, пользователь не узнает о проблеме
- Потенциальное потечение памяти если много failed promises

**Решение:**  
```js
if (ip) {
  persistUserLoginIp(userId, ip).catch(err => {
    console.warn(`[persistUserLoginIp] ${userId}:`, err?.message || err);
  });
}
```

---

## 🟡 P2 — DESIGN FLAWS (Low Priority)

### P2-01: Missing graph hydration after load
**Файл:** [src/constructor/graph_document/graph_document.js](src/constructor/graph_document/graph_document.js#L30-L50)  
**Строка:** 30-50  
**Тип:** State validation gap  
**Статус:** 🟡 OPEN

```js
export function createGraphDocument(seed = {}) {
  const nodes = {};
  const edges = {};
  for (const raw of asArray(seed.nodes)) {
    const node = normalizeGraphDocumentNode(raw);
    if (node) nodes[node.id] = node;
  }
  for (const raw of asArray(seed.edges)) {
    const edge = normalizeGraphDocumentEdge(raw);
    if (edge && nodes[edge.source] && nodes[edge.target]) {
      edges[edge.id] = edge;
    }
  }
  // ← Если edge.source или edge.target не найден, edge молча пропускается
  // Это может привести к потере данных при загрузке из БД
```

**Проблема:**  
- Orphan edges просто удаляются при загрузке → данные теряются
- При reload проекта из БД граф может быть другим

**Рекомендация:**  
```js
const orphaned = [];
for (const raw of asArray(seed.edges)) {
  const edge = normalizeGraphDocumentEdge(raw);
  if (edge && nodes[edge.source] && nodes[edge.target]) {
    edges[edge.id] = edge;
  } else if (edge) {
    orphaned.push(edge.id);
  }
}
if (orphaned.length > 0) {
  console.warn(`[Graph] Orphan edges skipped: ${orphaned.join(', ')}`);
}
```

---

### P2-02: Python codegen missing aiogram imports for FSM
**Файл:** [core/codegen/blockCompilers/state.js](core/codegen/blockCompilers/state.js)  
**Строка:** N/A (not yet created?)  
**Тип:** Missing code generation  
**Статус:** 🟡 OPEN

**Проблема:**  
- Генерируемый Python код может использовать FSM state classes, но не импортировать их
- Пример: `@router.message(StateClass.waiting)` без `from aiogram.fsm.state import State, StatesGroup`

**Проверить:**  
Файл [core/codegen/blockCompilers/registerAll.js](core/codegen/blockCompilers/registerAll.js) не включает state compiler для всех FSM типов.

---

### P2-03: Circular import risk
**Файл:** [server.mjs](server.mjs#L1-80)  
**Строка:** 1-80  
**Тип:** Deep import chain  
**Статус:** 🟡 INVESTIGATE

```js
import { generateBotPyFromStacks } from './services/pythonCodegen.mjs';
import { repairIrDeterministic } from './core/ai/irRepairEngine.mjs';
import { buildIrSymbolRegistryPromptContext } from './core/ai/irSymbolRegistry.mjs';
// ... 50+ more imports ...
```

**Рекомендация:**  
Проверить циклические зависимости: `npx depcheck` или `npm ls --all | grep '(★ circular'`

---

## 📋 SUMMARY TABLE

| ID | Файл | Строка | Тип | Статус | Критичность |
|----|------|--------|-----|--------|-------------|
| P0-01 | ReactFlowCanvas.jsx | 101-119 | Infinite render | 🔴 | P0 |
| P0-02 | ReactFlowCanvas.jsx | 176 | Missing error | 🔴 | P0 |
| P1-01 | pipeline.js | 65-115 | Graph mismatch | 🟠 | P1 |
| P1-02 | callbackResolver.js | 139-165 | Orphan edges | 🟠 | P1 |
| P1-03 | server.mjs | 2280 | Unhandled async | 🟠 | P1 |
| P2-01 | graph_document.js | 30-50 | Data loss | 🟡 | P2 |
| P2-02 | (unknown) | N/A | Missing import | 🟡 | P2 |
| P2-03 | server.mjs | 1-80 | Circular? | 🟡 | P2 |

---

## 🔧 RECOMMENDED FIXES (Priority Order)

### Immediate (Today):
1. **Fix P0-01:** Memoize `document` or use `projection.metadata.revision` only
2. **Fix P0-02:** Add try-catch in `onConnect` callback

### This Week:
3. **Fix P1-01:** Resync `stacks` after rule modification
4. **Fix P1-02:** Add orphan edge validation
5. **Fix P1-03:** Add error logging to async operations

### Next Sprint:
6. **Improve P2-01:** Log orphan edges at load time
7. **Audit P2-03:** Run circular dependency check

---

## ✅ VERIFIED GOOD PATTERNS

- ✅ Connection validation contracts (`operation_registry.js`) — robust
- ✅ Error boundary in pipeline (`pipeline.js` try-catch blocks) — comprehensive
- ✅ Graph command validation (`core/graph/commands.js`) — thorough
- ✅ CSRF protection in server.mjs — solid

