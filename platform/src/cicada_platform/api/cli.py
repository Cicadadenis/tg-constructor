"""CLI entry: uvicorn + optional uvloop."""

from __future__ import annotations

import argparse


def main() -> None:
    parser = argparse.ArgumentParser(prog="cicada-platform")
    sub = parser.add_subparsers(dest="cmd")

    serve = sub.add_parser("serve", help="Start FastAPI server")
    serve.add_argument("--host", default="127.0.0.1")
    serve.add_argument("--port", type=int, default=8090)
    serve.add_argument("--reload", action="store_true")

    args = parser.parse_args()
    if args.cmd == "serve":
        try:
            import uvloop  # type: ignore[import-untyped]

            uvloop.install()
        except ImportError:
            pass
        import uvicorn

        uvicorn.run(
            "cicada_platform.api.app:create_app",
            factory=True,
            host=args.host,
            port=args.port,
            reload=args.reload,
        )
        return
    parser.print_help()


if __name__ == "__main__":
    main()
