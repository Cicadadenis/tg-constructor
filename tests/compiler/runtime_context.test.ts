import assert from "node:assert/strict";

import {
  emitRuntimeContextRuntime,
  emitHandlerContextPreamble,
} from "../../core/codegen/runtimeContextCodegen.js";
import { buildPythonModule } from "../../core/codegen/compileCore.js";
import "../../core/codegen/index.js";

const runtime = emitRuntimeContextRuntime();
assert.match(runtime, /def build_runtime_ctx/);
assert.match(runtime, /"vars": dict\(_RUNTIME_CTX_DEFAULTS\)/);
assert.doesNotMatch(runtime, /GLOBAL_STORE/);

const preamble = emitHandlerContextPreamble(false, 1);
assert.match(preamble, /ctx = build_runtime_ctx\(message=message/);

const stacks = [
  {
    blocks: [
      { id: "bot1", type: "bot", props: { token: "TEST" } },
      { id: "g1", type: "global", props: { varname: "products", value: "[]" } },
    ],
  },
  {
    blocks: [
      { id: "start1", type: "start", props: { cmd: "start" } },
      { id: "set1", type: "set_variable", props: { name: "x", value: "1" } },
      { id: "get1", type: "get_variable", props: { name: "x", varname: "x" } },
      { id: "msg1", type: "message", props: { text: "ok {x}" } },
    ],
  },
];

const python = buildPythonModule(stacks);
assert.doesNotMatch(python, /GLOBAL_STORE/);
assert.match(python, /_RUNTIME_CTX_DEFAULTS/);
assert.match(python, /ctx_set_var\(ctx/);
assert.match(python, /ctx_get_var\(ctx/);
assert.match(python, /ctx = build_runtime_ctx/);
assert.match(python, /"products": \[\]/);
assert.match(python, /products = ctx_get_var\(ctx, "products"\)/);

console.log("runtime_context test OK");
