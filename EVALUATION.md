# End-to-end evaluation (static review; nothing executed)

Status: **unverified**. A pre-tool hook denied `npm install`, `npm test`, and the cleanup script, so no build, lint, unit or e2e test has run.

## Findings
| # | Severity | Item | Action |
|---|---|---|---|
| 1 | High | `@github/spark/spark-vite-plugin` and Vite 7 pairing is untested; the Spark plugin expects the Spark template layout (`main.css`, theme files). | Run `.\dev.ps1 -Build`; if the plugin fails, drop it and use `window.spark` stub, keeping the Vite SPA. |
| 2 | High | Leftover Lovable files (`src/server.ts`, `src/start.ts`, `src/lib/*error*`, `.lovable`, `bun.lock`) imported `@tanstack/react-start`, now removed. | Resolved: files deleted. |
| 3 | Medium | `routeTree.gen.ts` was hand-edited; the TanStack router plugin regenerates it on first dev/build. | Verify the diff after first run. |
| 4 | Medium | `SparkAgentExtractor` trusts `spark.llm` JSON; it is guarded (verbatim quote match, kind allow-list, pending-only). No unit test yet. | Add a vitest with a stubbed `globalThis.spark`. |
| 5 | Medium | `src/test/app-routing.test.tsx` imports `routeTree.gen`; should still pass. | Run `npm test`. |
| 6 | Low | `vite-tsconfig-paths` removed; `@` alias now set in vite.config and tsconfig `paths`. | Confirm tsc resolves `@/`. |
| 7 | Low | Stray `README2.tmp` created in error. | Resolved: file deleted. |
| 8 | Low | `tsconfig.json` has no `baseUrl`; `paths` works with `moduleResolution: Bundler`. | none |

## Added
- `playwright.config.ts`, `smoke.e2e.ts` (all 7 routes, 404, local-first persistence), `npm run test:e2e` (needs `npm i` then `npx playwright install chromium`).

## Run order
1. `npm install`
2. `npm run build`; `npm test`
3. `npx playwright install chromium; npm run test:e2e`

## Not performed
Skills not available or not applicable here: agent-council:council-sweep, ui-widget-developer (Microsoft 365 widgets, not relevant to this app), appmod assessment tooling (Java/.NET only), and technical-spike document (no open technical question beyond finding 1). Agent-catalog suggestions from the earlier search still stand (react19 agents, terminal-helper, agent-safety), uninstalled.
