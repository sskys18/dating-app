# Infra: $0 free-tier stack + Redis removal — Design

- **Date:** 2026-06-16
- **Status:** Approved (Approach A). Phase 1 not yet implemented.
- **Author:** brainstorming session
- **Scope:** Replace the unbuilt AWS-managed deployment assumption with a truly-$0,
  Korea-first free-tier stack, and remove Redis as a hard runtime dependency.

---

## 1. Problem

The app is pre-launch (~0 users, EP-07/08 still open). There is **no deploy/IaC**
yet, so no money has been spent — but the wired integrations (S3, managed
Postgres+Redis, etc.) point toward an AWS-managed deployment that idles at
**~$100–150/mo before a single user**. At this stage, fixed idle cost is the only
real cost risk; variable cost (gpt-4o-mini, Rekognition, APNs) is negligible.

Two asks:
1. Pick a **truly $0**, **Korea-first** infra stack (Oracle Cloud explicitly excluded).
2. **Remove Redis** as a moving part (the user's chosen option).

## 2. Goal

A documented free-tier architecture that runs the existing NestJS API (incl. the
Socket.IO chat gateway), Next.js web, and iOS backend with **$0/mo** monthly fixed
cost, plus a code change that drops Redis entirely. One clear upgrade lever
(Render Free → $7 Starter) for when realtime cold-starts hurt real users.

## 3. Decision — Approach A: Pure $0, Neon

| Layer | Choice | Free tier | KR/Asia | Notes |
|---|---|---|---|---|
| Compute (API + WS) | **Render** Free web service | 750 instance-hr/mo | ✅ Singapore | WS keeps awake since Feb 2026; 15-min idle → ~1 min cold start; **ephemeral disk** |
| Database | **Neon** Postgres Free | 0.5 GB, scale-to-zero 5 min | SG/Tokyo (verify Seoul) | ~sub-second resume |
| Object storage | **Cloudflare R2** | 10 GB, **$0 egress forever** | global edge | S3-API compatible — drop-in for `@aws-sdk/client-s3` |
| Web (Next.js) | **Vercel** Hobby | free | global edge incl. Seoul | auto-detects Next 15 |
| CI | **GitHub Actions** | 2000 min/mo | — | type-check + build on PR |
| Errors | **Sentry** Free | 5k events/mo | — | optional, add later |
| Uptime | **UptimeRobot** Free | — | — | optional heartbeat |
| Push | **APNs** | free | — | already wired |
| LLM | **OpenAI gpt-4o-mini** | not free, ~$0 at volume | — | already the cheap tier |
| Photo moderation | **AWS Rekognition** | 5k img/mo free (year 1) | — | keep; cheap |

**Upgrade lever (only knob to flip first):** Render Free → **Starter $7/mo**
(no sleep, same Singapore region) the day chat cold-starts affect real users.
Everything else (Neon, R2, Vercel, GH Actions) outlasts first traction.

### Rejected alternatives
- **Fly.io** — free tier killed in 2024 (legacy orgs only); now ~$2/mo min. Out.
- **Koyeb** — free instances are **Frankfurt / Washington DC only**; no Asia region
  on free → 150–250 ms to KR. Out (acquired by Mistral AI, Feb 2026).
- **Oracle Cloud Always-Free** — excluded by user.
- **Supabase** (Approach B) — Seoul region + bundled auth/storage, but pauses after
  **7 days** idle → 30 s wake; more lock-in; app already has its own auth. Worse
  wake latency than Neon for a chat app.

## 4. Redis removal design (Phase 1 — code)

**Why removal (not Upstash):** Render-Free has an ephemeral disk + scale-to-zero, so
a co-located Redis container is impossible there. The only alternatives were
(a) add managed Upstash Redis (another vendor + command-count caps) or (b) remove
Redis. Removal chosen. Sleep already wipes process state, so in-memory-with-loss is
already the runtime reality for everything except auth.

### 4.1 New `InMemoryStore` service
A tiny in-process KV+TTL implementing **only** the ioredis methods actually called:
`get`, `set` (supporting `'EX' <n>` and optional `'NX'`), `setex`, `del`, `exists`,
`incr`, `decr`, `expire`, `sadd`, `smembers`, `srem`. Backed by `Map` with lazy TTL
expiry + a periodic sweep. Method signatures match ioredis so consumer modules change
only their import + constructor type.

Replaces `RedisService` in these modules (caches / rate-limits / presence):

| Concern | Module(s) | Keys |
|---|---|---|
| Cache (recompute from DB on miss) | `entitlement`, `preview`, `block` | `entitlement:*`, preview cache, `blocked:*` |
| Rate-limit / quota | `anon-session`, `quiz`, `chat`, `feed` | `*ratelimit*`, `likes:daily:*`, feed quota |
| Feed seen-set (24h TTL) | `feed` | `feed:seen:*` |
| WS presence + msg dedup | `realtime.gateway` | `ws:user:*`, `msgdedup:*` |

All lose state on sleep/restart — already true today, so **no regression**.

### 4.2 Auth → Postgres (security-critical) 🟡
The **only** state that must survive sleep. New Prisma model:

```prisma
model RefreshToken {
  jti       String    @id
  userId    String
  tokenHash String
  expiresAt DateTime
  revokedAt DateTime?
  createdAt DateTime  @default(now())
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId])
}
```

`auth.service.ts` changes:
- `generateTokenPair` → **insert** a `RefreshToken` row (jti, userId, sha256 hash,
  expiresAt). Removes the dead `refresh:{userId}:{jti}` Redis write (currently written,
  never read).
- `refreshTokens` → look up row by `jti`; reject if **missing OR `revokedAt` set OR
  expired**; on rotation set `revokedAt` on the old row + insert the new. Replaces the
  `revoked:{jti}` get/set.
- `logout` → set `revokedAt` on the jti's row.
- Add a daily expired-row prune to the existing `ScheduleModule`.

**Deliberate behavior change:** denylist (valid unless revoked; fails *open* if store
wiped) → **allowlist** (valid only if row present + not revoked + not expired; fails
*closed*). Strictly more secure. Cost: all currently-issued refresh tokens invalidate
on deploy → users re-login **once**. Access-token path is unchanged (stateless JWT;
the WS gateway already verifies access tokens statelessly).

### 4.3 Anti-abuse (opportunistic, same files)
Add an anon-chat **turn cap + IP rate-limit** to the LLM funnel (`chat.service.ts`) —
3–4 unbounded `gpt-4o-mini` calls per anonymous visitor is the only real variable-cost
abuse surface. In-memory limiter resets on sleep (marked shortcut).

## 5. Infra artifacts (Phase 2 — config, no provisioning by Claude)
- **R2 swap** in `s3.service.ts`: add `endpoint` + `forcePathStyle: true`; new env
  `AWS_S3_ENDPOINT` (`https://<account>.r2.cloudflarestorage.com`). ~5 lines. User
  creates the R2 bucket + token.
- **`render.yaml`** blueprint: web service, region `singapore`, plan `free`, build
  (`pnpm install && pnpm db:generate && pnpm --filter @dating-app/api build`), start
  (`node apps/api/dist/main`), env var list.
- **`.env.example`**: all 25 enumerated vars, **minus** `REDIS_URL`, **plus**
  `AWS_S3_ENDPOINT` and Neon `DATABASE_URL`.
- **GH Actions CI** (`.github/workflows/ci.yml`): `pnpm db:generate` + `type-check` +
  `build` on PR.
- Remove `ioredis` dep + drop `redis` service from `docker-compose.yml` (keep Postgres
  for local dev).

## 6. Marked shortcuts (`shortcut:` in code)
- In-memory store is **single-instance only** — ceiling: one API process. Upgrade path:
  socket.io Redis adapter + shared store (reintroduce Redis/Upstash) when scaling out.
- In-memory rate-limits **reset on sleep/restart** — a forced sleep resets counters
  (minor abuse vector). Acceptable pre-launch; upgrade path = persistent/shared limiter.

## 7. Risks / behavior changes
- 🟡 Refresh-token semantics flip (denylist→allowlist) → one-time forced re-login on
  deploy. Intended.
- Render-Free cold start (~1 min) drops chat until first request wakes it → flip to
  Render Starter $7 when it matters.
- Neon free scale-to-zero adds ~sub-second latency to the first query after idle.

## 8. Open items to verify during implementation
- [ ] Confirm Neon Free supports a Seoul (ap-northeast-2) or Tokyo region; else use
      Singapore (ap-southeast-1). [Medium]
- [ ] Confirm Render build supports a pnpm monorepo workspace build (rootDir/filters).
- [ ] R2 presigned-PUT works with `forcePathStyle` from the iOS/web client.
- [ ] Decide whether to keep Rekognition moderation on free tier or defer (`MODERATION_ENABLED`).

## 9. Implementation task list (for writing-plans / executing-plans)
**Phase 1 — Redis removal (code):**
1. Add `InMemoryStore` service + module (methods in §4.1) with TTL + sweep.
2. Add `RefreshToken` Prisma model + `pnpm db:generate`; migration.
3. Rewrite `auth.service.ts` refresh/revocation/logout to the Postgres allowlist (§4.2).
4. Swap `RedisService` → `InMemoryStore` in `chat`, `anon-session`, `quiz`,
   `entitlement`, `realtime.gateway`, `feed`, `preview`, `block`.
5. Add anon-chat turn cap + rate-limit (§4.3).
6. Remove `RedisModule`/`RedisService`, `ioredis` dep, `REDIS_URL` usage; drop `redis`
   from `docker-compose.yml`.
7. Daily expired-`RefreshToken` prune in `ScheduleModule`.
8. `pnpm type-check` clean; boot-test against local Postgres (no Redis).

**Phase 2 — Infra artifacts (config):**
9. R2 endpoint support in `s3.service.ts` + `AWS_S3_ENDPOINT`.
10. `render.yaml`, `.env.example`, `.github/workflows/ci.yml`.

## 10. Clarity scorecard (brownfield)
| Dimension | Score | Justification |
|---|---|---|
| Goal | 0.80 | Explicit: free-tier (no Oracle), remove Redis; "how far to implement now" resolved to spec+handoff |
| Constraint | 0.75 | Free/$0, no Oracle, pre-launch ~0 users, single-instance acceptable |
| Success | 0.70 | "done" = Redis gone + app type-checks/boots + documented free stack |
| Context | 0.85 | Codebase read thoroughly (Redis call sites, auth, gateway, deps) |

Weighted 0.77 → ambiguity 0.23; all floors met. One clarifying round resolved the
compute/region fork (user: truly $0 + Korea-first → Render Free Singapore).

## 11. Defaults taken
| Default | Reversal path |
|---|---|
| Single API instance (in-memory store) | Reintroduce Redis/Upstash + socket.io adapter |
| Neon over Supabase | Switch `DATABASE_URL` to Supabase Seoul (Approach B) |
| Allowlist refresh tokens (fail-closed) | Revert to denylist if one-time re-login unacceptable |
| Keep Rekognition moderation | Toggle `MODERATION_ENABLED=false` to defer |
| Render Free (accept sleep) | Render Starter $7/mo to remove sleep |

## Sources (free-tier findings, 2026)
- Fly.io free tier ended: <https://expresstech.io/7-fly-io-alternatives-in-2026-real-pricing-after-the-free-tier-died/>, <https://fly.io/docs/about/pricing/>
- Render free + WS-keep-awake (Feb 2026) + Singapore: <https://render.com/docs/free>, <https://render.com/changelog/free-web-services-now-remain-active-while-receiving-websocket-messages>
- Koyeb free regions (Frankfurt/DC only): <https://www.koyeb.com/docs/reference/regions>, <https://www.koyeb.com/docs/reference/instances>
- Neon free tier + scale-to-zero: <https://neon.com/faqs/managed-postgres-databases-free-tier>
- Supabase free 7-day pause: <https://uibakery.io/blog/supabase-pricing>
- Cloudflare R2 free + $0 egress: <https://www.cloudflare.com/products/r2/>
