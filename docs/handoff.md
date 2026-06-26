# Session Handoff
> Generated: 2026-06-16 13:45

## Task
Web-led dating app (`prompt.md`, 8 epics). This session closed EP-07/08 + feature
gaps, made the stack runnable for the first time, and added 3-locale i18n.

## Status
### Completed (merged to local `main` @ `cf1624e`; API+web type-check clean)
- EP-07: report flow + evidence snapshot, admin console (`apps/web/.../admin/`, x-admin-key), realtime block check.
- EP-08/features: feed paging+eligibility+ranking, all 6 premium entitlement gates, Top-3 shares feed engine, Rekognition photo moderation, LLM token cost cap, retention cron + `DELETE /api/account`.
- Runnable: fixed systemic `import type` DI bug (44 api files), `packages/db` `type:commonjs`, `apps/api/tsconfig` `ignoreDeprecations:"5.0"`, next-intl `src/middleware.ts` (+ removed self-redirecting root layout).
- i18n: `ko-KR` default + `en-US` + `ja-JP`; per-locale type text (TypeCatalog `labelJa`/`descriptionJa` + reseed); paywall→i18n keys; `LanguageSwitcher`; friendly copy; `{{var}}`→`{var}` fix.
- Realtime JWT `sub`/`id` fix; web→app handoff wired.

### Not done / blocked
- Persona chat: needs a real `OPENAI_API_KEY` (current is a placeholder → chat returns empty) AND doesn't reply in the user's locale yet.
- **Not pushed** — GitHub repo `sskys18/dating-app` does not exist; only on local `main`.

## Resume Here
1. **Push:** confirm with user whether to create the remote (`gh` active account is `yuseongkim-inbl`, not `sskys18`), then `gh repo create` + `git push origin main`. Until then the work is local-only.
2. Set a real `OPENAI_API_KEY` in `apps/api/.env`; then persona chat (WEB-04) completes the web flow. To localize chat, pass `locale` into the chat system prompt in `apps/api/src/modules/chat/chat.service.ts`.
3. Add tests + CI (none exist) and localize iOS (still English-only).
4. Known iOS review findings to fix: push-tap consumer (bind `MainTabView` TabView selection to `appState.selectedTab` + consume `pendingChatRoomId`); free-user Top-3 swipe cap in `FeedView`.

## Decisions (do NOT revisit)
- **Korean is the default locale** (`apps/web/src/i18n/routing.ts`); en/ja also offered.
- **Anonymous Top-3 preview returns opaque ids + no photo URL + no intro** (`preview.service.ts`) — privacy: it's served to unauthenticated visitors. Auto-review BLOCKED the raw-PII version; do not revert.
- **API runs via ts-node in dev** (not `nest start --watch`): `cd apps/api && TS_NODE_TRANSPILE_ONLY=true node -r reflect-metadata -r ts-node/register/transpile-only -r tsconfig-paths/register src/main.ts`. The compiled path had ESM/emit issues.
- **`.xcodeproj` is gitignored** — generated from `ios/project.yml` via `xcodegen generate`.
- seed.ts imports `../generated/client` (not `@prisma/client`).

## Gotchas
- LSP lags the regenerated Prisma client — trust `tsc`, not editor squiggles. Run `pnpm db:generate` after any schema change.
- Anon-session create is IP rate-limited (5/hr); `docker exec dating-app-redis redis-cli FLUSHALL` clears it in dev.
- chrome-devtools MCP wedges its profile; `pkill -f chrome-devtools-mcp/chrome-profile` to recover (loses browser session).
- Untracked junk left in tree (NOT committed): `.claude/wiki/`, `docs/specs/...infra...`, and this file — gitignore `.claude/` if it keeps reappearing.

## Separate pending thread (NOT this session, still valid)
Infra free-tier + Redis removal — fully designed, not started. Spec: `docs/specs/2026-06-16-infra-free-tier-design.md` §9 task list. Decisions there (Render+Neon+R2, remove Redis, refresh tokens→Postgres) are locked; execute via `executing-plans` when prioritized.

## Context
- **Branch**: `main` (local only; `feat/ep07-08-i18n` merged in, no remote repo exists).
- **Run locally**: `docker compose up -d` → `pnpm db:push && pnpm db:seed` → API (ts-node cmd above, set `CORS_ORIGIN=http://localhost:3001`) → `pnpm --filter @dating-app/web exec next dev --port 3001`. Open `http://localhost:3001/ko-KR`.
- **Tests**: none. **Verified**: API+web `tsc` clean; iOS `xcodebuild` simulator build succeeds; web flow landing→quiz→result confirmed in browser (`.demo/`).
