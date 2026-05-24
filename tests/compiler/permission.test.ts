import assert from "node:assert/strict";

import {
  expandRoleRequirement,
  parseRequireRoleProps,
  validateRequireRoleProps,
} from "../../core/permissions/permissionRoles.js";
import {
  compileRequireRole,
  emitPermissionMiddlewareRuntime,
  stackHasRequireRole,
} from "../../core/codegen/permissionCodegen.js";
import { validatePermissionNodes } from "../../core/compiler/permissionValidator.ts";
import { validateGraphPermissions } from "../../core/graph/permissionGraphValidate.js";
import { buildPythonModule } from "../../core/codegen/compileCore.js";
import { buildExecutionGraph } from "../../core/execution/buildExecutionGraph";
import { generateAiogramBot } from "../../generators/python_aiogram/generateBot";
import "../../core/codegen/index.js";

assert.deepEqual(expandRoleRequirement("moderator"), ["admin", "moderator"]);
assert.deepEqual(expandRoleRequirement("admin"), ["admin"]);

const spec = parseRequireRoleProps({ role: "admin" });
assert.ok(spec.allowedRoles.includes("admin"));

assert.match(
  validateRequireRoleProps({ role: "superuser" }) || "",
  /Неизвестная роль/,
);
assert.deepEqual(expandRoleRequirement("user"), ["admin", "moderator", "user"]);

const guard = compileRequireRole(
  { props: { role: "admin", message: "No access" } },
  { indent: 1 },
);
assert.match(guard, /user_has_required_role\(ctx/);
assert.match(guard, /return/);

const runtime = emitPermissionMiddlewareRuntime();
assert.match(runtime, /class RolePermissionMiddleware/);
assert.match(runtime, /resolve_user_role/);

const permErrors = validatePermissionNodes([
  { id: "r1", type: "require_role", data: { role: "admin" } },
  { id: "r2", type: "require_role", data: { roles: "bad" } },
]);
assert.equal(permErrors.length, 1);

const graphDiag = validateGraphPermissions({
  nodes: {
    n1: { id: "n1", type: "require_role", data: { role: "moderator" } },
  },
});
assert.equal(graphDiag.length, 0);

const execution = buildExecutionGraph(
  [
    { id: "s1", type: "start", data: {} },
    { id: "p1", type: "require_role", data: { role: "admin" } },
  ],
  [{ source: "s1", target: "p1", sourceHandle: "flow", targetHandle: "flow" }],
);
assert.match(generateAiogramBot(execution), /# REQUIRE_ROLE p1/);

const stacks = [
  { blocks: [{ id: "b1", type: "bot", props: { token: "T" } }] },
  {
    blocks: [
      { id: "start1", type: "start", props: {} },
      { id: "rr1", type: "require_role", props: { role: "admin" } },
      { id: "msg1", type: "message", props: { text: "secret" } },
    ],
  },
];
assert.ok(stackHasRequireRole(stacks));
const py = buildPythonModule(stacks);
assert.match(py, /RolePermissionMiddleware/);
assert.match(py, /router\.message\.middleware/);
assert.match(py, /user_has_required_role/);
assert.match(py, /ctx_set_var\(ctx, "_role"/);

console.log("permission test OK");
