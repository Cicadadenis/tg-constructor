# Execution Flow

## Compile path (no execution)

```text
.ccd / DSL text
    → compiler.legacy_bridge.parse_dsl()   # cicada.parser (legacy AST)
    → compiler.ir_lowering.lower_program() # IrProgram
    → compiler.validate.validate_ir()
    → AST snapshot + IR JSON
```

## Runtime path (platform)

```text
Inbound raw (transport-specific)
    → TransportPlugin.normalize_inbound()
    → CicadaEvent
    → EventBus.publish() [optional]
    → EventDispatcher
        → MiddlewarePipeline
        → StateMachineEngine (handler + state)
        → ActionRegistry.execute(action_type)
        → list[EffectEnvelope]
    → TransportPlugin.deliver(effect)
```

## Sandbox path (Studio bot run target)

```text
POST /v1/sandbox/enqueue { ir, event }
    → SandboxJobQueue
    → SandboxWorkerPool (N workers)
        → RuntimeEngine.handle_event (isolated)
    → GET /v1/sandbox/result/{job_id}
```

## Legacy path (production today)

```text
.ccd file
    → cicada.runner.run_file()
    → TelegramAdapter (requests)
    → Executor.handle(update dict)   # DSL already parsed at load
```
