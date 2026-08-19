# Developer workflows

This guide separates local, provider-free validation from release and live-provider procedures. It does not replace the evidence-preservation instructions in the release documentation.

## Everyday local gate

Use the core gate while iterating on application or domain code:

```bash
npm run verify
```

It runs lint, TypeScript validation, the Vitest suite, and deterministic fixture evaluations. Before opening a review or handing off a release candidate, run the complete provider-free gate:

```bash
npm run validate:local
```

It runs, in order:

1. formatting;
2. the complete `npm run verify` core gate;
3. the production build and client bundle budgets; and
4. the isolated no-key Playwright journey.

`validate:local` composes `verify` rather than duplicating its individual checks, so the two commands cannot silently diverge.

The final browser check starts the application with `OPENAI_API_KEY` empty, `WONDERLAB_LIVE_GENERATION_ENABLED=false`, and seeded fallback enabled. The fixture evaluations use local fixtures. None of these checks makes an OpenAI, web-search, or other provider request.

If a constrained environment blocks the local worker socket used by Next.js, Playwright, or `tsx`, rerun the same command where local loopback/IPC is permitted; do not change the application to work around a sandbox limitation.

## Focused checks

Use the smallest relevant command while iterating:

| Change area                 | Check                                           |
| --------------------------- | ----------------------------------------------- |
| React, types, or UI         | `npm run lint`, `npm run typecheck`, `npm test` |
| Learner-flow contract       | `npm test`, `npm run evals:fixtures`            |
| Deferred UI/bundle boundary | `npm run build`, `npm run performance:bundle`   |
| Seeded/no-key behavior      | `npm run test:e2e:no-key`                       |

The broader multi-browser suite remains available as `npm run test:e2e`. It uses test-only fake credentials in its local server configuration; it is not a live-provider validation.

## Source ownership

| Area                                      | Primary location                                                                                                       |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Next routes and metadata                  | `app/`                                                                                                                 |
| Stable public learner-app import          | `components/wonderlab-app.tsx`                                                                                         |
| Learner-flow state and persistence        | `components/quest/quest-app.tsx`                                                                                       |
| Stage-specific learner UI                 | `components/quest/screens/`                                                                                            |
| Shared quest chrome and focused utilities | `components/quest/chrome.tsx`, `components/quest/{api-error,evidence-note,learner-work,options,presentation,types}.ts` |
| Curiosity Map and Discovery Card          | `components/curiosity-map.tsx`, `components/discovery-card.tsx`                                                        |
| Domain contracts and state machine        | `lib/schemas.ts`, `lib/session-machine.ts`                                                                             |
| Server/provider boundary                  | `app/api/`, `lib/openai/`, `lib/safety.ts`                                                                             |
| Seeded demo path                          | `data/`, `lib/seeded-*.ts`                                                                                             |
| Tests, deterministic evals, browser flows | `tests/`, `evals/`, `e2e/`                                                                                             |
| Release-media and preflight tooling       | `scripts/`, `docs/media/`, `docs/screenshots/`                                                                         |

Do not rename, move, or regenerate release-media inputs simply to tidy the tree. Those paths participate in release receipts and preservation checks.
