"""Smoke-test the /v1/compile deprecation route + parse_dsl stub.

Imports the compile route module directly to avoid pulling in
`cicada_platform.api.__init__` (which transitively imports the
runtime stack and requires the external `cicada.security_utils`
package — unrelated to this fix).
"""

from __future__ import annotations

import importlib.util
import sys
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "platform" / "src"))


def _load_module(name: str, path: pathlib.Path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


def main() -> None:
    # Side-load legacy_bridge so we don't pull api/__init__.
    legacy_bridge = _load_module(
        "cicada_platform.compiler._legacy_bridge_under_test",
        ROOT / "platform" / "src" / "cicada_platform" / "compiler" / "legacy_bridge.py",
    )

    r = legacy_bridge.parse_dsl("anything")
    assert r.ok is False, "parse_dsl must return ok=False (never crash)"
    assert r.diagnostics, "parse_dsl must include a migration diagnostic"
    print("parse_dsl stub: ok=False, diag count =", len(r.diagnostics))

    legacy_bridge.ensure_legacy_path()
    print("ensure_legacy_path: no-op ok")

    try:
        legacy_bridge.parse_dsl("x", strict=True)
    except legacy_bridge.DslRemovedError:
        print("parse_dsl strict=True: DslRemovedError ok")
    else:
        raise AssertionError("strict=True must raise DslRemovedError")

    # /v1/compile route — load module directly to bypass api/__init__.
    compile_route = _load_module(
        "cicada_platform.api.routes._compile_under_test",
        ROOT / "platform" / "src" / "cicada_platform" / "api" / "routes" / "compile.py",
    )

    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    app = FastAPI()
    app.include_router(compile_route.router, prefix="/v1")
    client = TestClient(app)

    r1 = client.get("/v1/compile")
    print("GET  /v1/compile  →", r1.status_code, r1.json()["code"])
    assert r1.status_code == 410
    assert r1.json()["code"] == "DSL_COMPILE_REMOVED"

    r2 = client.post("/v1/compile", json={"dsl": 'message "hi"'})
    print("POST DSL body     →", r2.status_code, r2.json()["code"])
    assert r2.status_code == 410

    ir_payload = {
        "blocks": {},
        "handlers": [],
        "scenarios": {},
        "config": {},
        "globals": {},
    }
    r3 = client.post("/v1/compile", json={"graph": ir_payload})
    print("POST IR-shape     →", r3.status_code, "ok=" + str(r3.json().get("ok")))
    assert r3.status_code == 200
    assert r3.json()["ok"] is True
    assert "ast" in r3.json() and "diagnostics" in r3.json()

    print("smoke_compile_route: all checks passed")


if __name__ == "__main__":
    main()
