# keyboards

| Example | Key | Highlights |
|---------|-----|------------|
| Weather | `weather` | Reply keyboard bound to `message.answer` per city |
| Keyboards AST | `keyboards` | Reply + inline bind; no `\u2060` ghost messages |

Pattern: `message` then `buttons` (or `inline` then `message`) in the same handler column — compiler merges `reply_markup` into one send call.
