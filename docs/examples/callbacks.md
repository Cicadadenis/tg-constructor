# callbacks

| Example | Key | Highlights |
|---------|-----|------------|
| Callbacks | `callbacks` | Inline `callback_data` + `callback` entry with `callbackPrefix` (`run_`, `cancel_`) |

Explicit handlers only — **no auto-generated stub handlers**:

| Prop on «При нажатии» | Generated filter |
|----------------------|------------------|
| `data` / `callbackData` | `F.data == "..."` |
| `callbackPrefix` | `F.data.startswith("...")` |
| `label` | `F.text == "..."` (reply keyboard) |

Missing handler for any `inline` `callback_data` → compile error `MissingCallbackHandlerError`.
