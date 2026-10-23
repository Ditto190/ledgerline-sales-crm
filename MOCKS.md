# What is mock / demo-only

Items marked with a **Demo** badge in the app are listed here.

| Area | Current behaviour | What a real version needs |
| --- | --- | --- |
| Storage | `InMemorySalesRepository` keeps data in memory and mirrors it to the browser's localStorage (`crm-demo-db-v1`). Clearing browser data wipes it. Single user, single browser. | Implement `SalesRepository` (src/data/repository.ts) against SQLite or a local API, then swap the factory in `src/data/hooks.ts`. |
| Demo data | Fictional Australian companies, people and deals generated in `src/data/seed.ts`, dated relative to today. "Reset demo data" regenerates it. | Remove seed / reset once real data exists. |
| Sales team | Owners are plain names in Settings. No accounts, sign-in or permissions. | Real users and authentication. |
| Email / phone | Email addresses are `mailto:` links. Activities are logged manually; no email or calendar sync, no dialler. | Mail / calendar integrations. |
| Import / export | JSON snapshot of the whole database only. No CSV, no merge, no validation beyond basic shape checks. | Proper import mapping and de-duplication. |
| Currency | AUD only, no multi-currency or tax. | — |
| Extractor | **Demo** deterministic keywords, regex and contact-name matching; no LLM, imperfect extraction. Per-assertion and per-link confidence is heuristic. | Swap `Extractor` via `ingestionConfig` in `src/services/ingestion.ts`. |
| Inbox / mailbox | **Demo** manual paste and file drop only. No Outlook forwarding, Excel, Power BI or SharePoint API calls, mailbox polling or folder watching. Files already synced to your computer can be selected or dropped. | Supply a local capture adapter behind `IngestionPipeline` and `SalesRepository`; online integrations require an explicit scope change. |
| Evidence files | **Demo** UTF-8 .txt, .md, .eml and .vtt up to 2 MB. Email is treated as plain source text, not a full MIME/attachment decoder. PDF, DOCX and audio report “Not supported in demo”. | Replace the parsing stage with local format parsers. |
| Review / audit | **Demo** reviewer is a Settings team member, not a verified signed-in identity. Approved tasks are real local Activities with source links. | Preserve approval policy and source provenance when swapping storage. |
| Dashboard generator | **Demo** phrase-to-widget rules, not AI. Saved JSON layouts use an allowlisted query catalogue. | Swap `DashboardGenerator`; validate every generated definition. |
| Evidence fixtures | Ten fictional items: two transcripts, three emails, three notes (including ambiguous names), an exact duplicate and a failed parse. Existing CRM records are preserved. | Replace fixtures with local captures. |

## Replacing mocks
Implement `SalesRepository` for local SQLite/API storage, `Extractor` for richer local extraction, `IngestionPipeline` for parsing/capture adapters and `DashboardGenerator` for generation. Preserve immutable originals, exact hashing, unresolved-name handling, internal task ownership and explicit stage/value confirmation. No Microsoft services are connected in this version.
