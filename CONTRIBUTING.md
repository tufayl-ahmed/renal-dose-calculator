# Contributing

This is an early private project. Keep changes small, tested, and clinically
reviewable.

## Local Checks

```bash
npm install
npm test
```

## Coding Guidelines

- Keep the app adult-only unless the clinical scope is intentionally changed.
- Do not invent dose guidance when source labels are unclear.
- Preserve the educational/non-prescribing warning in the UI and bot replies.
- Do not commit real API tokens or `.env` files.
- Add or update tests for renal calculations, drug lookup, route filtering, and
  dose guidance behavior.
