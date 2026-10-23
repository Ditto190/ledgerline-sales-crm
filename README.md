# Ledgerline Sales CRM

Local-first sales CRM, a GitHub Spark-style Vite SPA (converted from Lovable). Runs natively on Windows.

```powershell
.\dev.ps1          # install + dev server at http://127.0.0.1:5000
.\dev.ps1 -Test    # vitest
.\dev.ps1 -Build   # type-check + production build
```

Copilot agent guidance lives in `.github/agents/` and `.github/copilot-instructions.md`. It assists development in VS Code; the app does not run an autonomous AI agent. Evidence extraction stays deterministic and local; imported source text is never treated as instructions.
Conversion plan: `plan.md`. Legacy Lovable files have been removed.

Stack: React 19, Vite, TanStack Router, Tailwind 4, shadcn/ui, `@github/spark`.
