# Modernization plan: Lovable (TanStack Start) -> GitHub Spark SPA, Windows-native, agent-enabled

Language: TypeScript / React 19. Work folder: this repo. Tasks: `.metadata/tasks.json`.

## Scope
1. Replace Lovable tooling (`@lovable.dev/vite-tanstack-config`, SSR via TanStack Start + Nitro/Cloudflare, Lovable error reporting) with a client-only Vite SPA + TanStack Router + `@github/spark` runtime.
2. Windows-native workflow: npm + PowerShell (`scripts/dev.ps1`), no bun/bash.
3. Agents: GitHub Copilot IDE agent at `.github/agents/crm-evidence-agent.agent.md`; keep application ingestion deterministic and local. No in-app LLM runtime.
4. Security: remove server entry, keep untrusted-text policy, run `npm audit`.

## Notes
- Data stays local-first (`localStorage` via `SalesRepository`); Spark KV can replace it behind the same interface.
- Legacy Lovable files were removed after build and tests passed.
- Deployment: Spark hosting or any static host (`npm run build` -> `dist`).
