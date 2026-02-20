PRD v1 (Agent-Compact) — Web→16-Type→Persona Chat→Top3→Subscription→Dating Core

Project: Web-led dating app
Dev language: English-only (code/docs/tickets)
UI locales: en-US, ko-KR
Internal architecture: 1 product / 2 engines: IdealBuilder + DatingCore

⸻

0) Agent Operating Mode (Subagents + Merge Rules)

0.1 Subagents (recommended)
	•	A0-Orchestrator: owns end-to-end; assigns sections by ID; merges outputs.
	•	A1-UXFlow: screens + states + edge cases; outputs SRS skeleton.
	•	A2-APIContract: REST endpoints + auth + rate limits; outputs OpenAPI outline.
	•	A3-DBSchema: tables + keys + indexes + retention; outputs schema spec.
	•	A4-RecoMatch: eligibility + ranking + quotas + feed paging; outputs algo contract.
	•	A5-ChatRealtime: socket events + message model + delivery semantics.
	•	A6-SubsEntitlements: SKU + entitlement gates + server verification model.
	•	A7-SafetyOps: block/report + admin console + evidence snapshot policy.
	•	A8-AnalyticsExp: events + funnels + guardrails + experiments.

0.2 Merge rules (to keep context clean)
	•	Requirements referenced by IDs (e.g., REQ-FEED-03).
	•	Changes must be proposed as diff blocks: “Replace/Append section X.Y”.
	•	No rephrasing. Preserve field names + IDs.

⸻

1) Product Definition

1.1 One-line

Users enter via web link, finish 12-item A/B quiz → 16-type, run persona-guided chat (6–10 turns) to produce structured dating criteria + profile draft + message starters, view Top-3 ideal preview (free), then unlock full feed + interactions + chat via iOS subscription.

1.2 Principles (hard constraints)
	•	P1: User journey is seamless (web→app via handoff), even if modules differ.
	•	P2: Type data is alignment/coaching + ranking input, never punitive.
	•	P3: Monetize execution (full feed + interaction + premium controls), not “getting a result”.
	•	P4: Default privacy: type private; Axis C private by default.

⸻

2) Goals & Metrics

2.1 North Star
	•	KPI-NS: 24h reciprocal conversation rate (match → reply within 24h).

2.2 Supporting KPIs
	•	KPI-Q1: quiz completion (web)
	•	KPI-C1: persona chat completion
	•	KPI-P1: summary/top3 view rate
	•	KPI-S1: paywall→subscription conversion
	•	KPI-D1: match rate, first-message rate

2.3 Guardrails
	•	GR-1: block/report rate (aggregated)
	•	GR-2: refunds/cancels
	•	GR-3: anonymous abuse signals (rate-limit hits, suspicious sessions)

⸻

3) Scope

3.1 In scope (v1)
	•	Web: landing → quiz → short result → persona chat → summary+Top3 → paywall → app handoff
	•	iOS: universal link claim, auth (Apple/Google/Kakao), profile minimum, subscription gating, full feed, likes/matches, 1:1 chat, block/report, push
	•	Analytics: Amplitude; Experiments/flags: Firebase Remote Config
	•	Abuse control for anonymous: TTL + rate limits + chat caps

3.2 Out of scope (v1)
	•	boosts/superlikes/spotlights (add-on)
	•	audio/video calls, group/community
	•	advanced ML personalization
	•	identity verification

⸻

4) End-to-End Flow (Screen/State Summary)

4.1 Web flow (primary acquisition)
	•	WEB-01 Landing: value prop + 18+ + terms/privacy; create anon_session_id
	•	WEB-02 Quiz12: A/B forced; progress; resume
	•	WEB-03 ResultPreview: type+axes (short); CTA→chat
	•	WEB-04 PersonaChat: 6–10 turns; outputs structured bundle
	•	WEB-05 Summary+Top3: show bundle + Top3 preview; CTA→paywall
	•	WEB-06 Paywall: subscribe; on success issue handoff_token + deep link to app

4.2 iOS flow
	•	IOS-01 UniversalLink: claim handoff_token (attach anon data)
	•	IOS-02 Auth: Apple/Google/Kakao
	•	IOS-03 ProfileMinimum: enforce required fields
	•	IOS-04 RouteByEntitlement: subscribed→full feed; else→Top3+paywall
	•	IOS-05 DatingCore: feed→like→match→chat; starters on match

⸻

5) 16-Type System (Quiz Contract)

5.1 Axes (binary)
	•	AX-A Avoidance: CLOSE vs DIST
	•	AX-B Anxiety: CALM vs NEED
	•	AX-C Dating orientation proxy: COMMIT vs EXPLORE
	•	AX-D Conflict approach: ENGAGE vs PAUSE

5.2 Quiz rules
	•	REQ-QUIZ-01: 12 items, all required, A/B forced-choice
	•	REQ-QUIZ-02: 3 items per axis; axis score 0..3
	•	REQ-QUIZ-03: axis pole = majority (≥2)
	•	REQ-QUIZ-04: store answers[12], axis_scores, axis_poles, deterministic type_id
	•	REQ-QUIZ-05: no silent type changes post-assignment (analytics drift cannot change user-facing type)

5.3 Non-diagnostic copy (must appear)
	•	COPY-01: “Research-inspired preferences — not a diagnosis.”
	•	COPY-02: “These results describe tendencies, not rules. You can always change them.”
	•	COPY-03: “Share what you want: you control what’s visible on your profile.”

5.4 Visibility defaults
	•	REQ-VIS-01: type private by default
	•	REQ-VIS-02: Axis C private by default; separate toggle

⸻

6) Module A — IdealBuilder (Anon Quiz + Persona Chat + Top3)

6.1 Anonymous session
	•	REQ-ANON-01: anon_session_id created on web start; TTL ~24h
	•	REQ-ANON-02: store quiz progress + chat progress; resume supported
	•	REQ-ANON-03: abuse controls: rate-limit per IP/device + TTL + chat caps

6.2 Persona Chat (refinement)
	•	REQ-CHATB-01: 6–10 turns hard cap
	•	REQ-CHATB-02: persona affects tone/question style only (no heavy roleplay)
	•	REQ-CHATB-03: prioritize clarifying ambiguous axes first (if axis score 2–1)
	•	REQ-CHATB-04: output must be JSON-schema validated server-side

6.3 Sensitive constraints (v1)
	•	REQ-SAFE-01: no explicit sexual history counts, partner numbers, explicit sexual behavior prompts
	•	REQ-SAFE-02: Axis C questions limited to relationship definition/pacing/boundaries/intention

6.4 Mandatory structured outputs (always produced)
	•	OUT-01 ProfileDraft:
	•	bio_variants[2]
	•	prompt_answers[3]
	•	OUT-02 MatchingCriteria:
	•	dealbreakers[]
	•	green_flags[]
	•	weights (axis weights + optional extras)
	•	OUT-03 MessageStarters:
	•	starters[3]

6.5 Top-3 preview
	•	REQ-TOP3-01: generated via same reco engine as full feed
	•	REQ-TOP3-02: free access (web/app); avoid heavy “blur paywalls”

6.6 Web→App handoff
	•	REQ-HAND-01: one-time handoff_token with expiry
	•	REQ-HAND-02: app claims token → attach anon outputs to user_id
	•	REQ-HAND-03: claim is idempotent; token single-use enforced

⸻

7) Module B — DatingCore (Auth, Profile, Subs, Feed, Match, Chat, Safety)

7.1 Auth (Apple/Google/Kakao)
	•	REQ-AUTH-01: support Apple + Google + Kakao
	•	REQ-AUTH-02: provider linking supported (1 user ↔ multiple providers)
	•	REQ-AUTH-03: token policy
	•	Web: refresh token in HttpOnly Secure cookie
	•	iOS: refresh token in Keychain; access token short TTL

7.2 Profile & Media
	•	REQ-PROF-01: minimum profile required before full feed
	•	photo≥1, nickname, age, approx location, 1-line intro (+ policy fields)
	•	REQ-PROF-02: apply chat outputs as editable drafts (never forced)
	•	REQ-MEDIA-01: S3 storage + CDN; EXIF removal; size/format limits
	•	REQ-MEDIA-02: minimum NSFW/spam filtering for uploads

7.3 Recommendation & Feed
	•	REQ-FEED-01: eligibility filters (self, seen cooldown, blocks, reports, inactive/banned, pref constraints)
	•	REQ-FEED-02: ranking inputs v1 = alignment score (with weights) + preference fit + mild activity signal
	•	REQ-FEED-03: outputs:
	•	preview_top3 (free)
	•	feed (subscribed)
	•	REQ-FEED-04: no v1 hard exclude filters by type; weights only
	•	REQ-FEED-05: pagination cursor-based

7.4 Likes/Matches
	•	REQ-LIKE-01: actions = like, pass
	•	REQ-MATCH-01: mutual like → match; atomic + race-safe + idempotent
	•	REQ-MATCH-02: on match create chat room + show 3 starters (from OUT-03)

7.5 Realtime Chat
	•	REQ-RTC-01: 1:1 text
	•	REQ-RTC-02: delivery status required; read receipts optional
	•	REQ-RTC-03: cursor pagination for history
	•	REQ-RTC-04: block immediately prevents send/receive
	•	REQ-RTC-05: report captures snapshot for ops

7.6 Push
	•	REQ-PUSH-01: new match + new message
	•	REQ-PUSH-02: push denied → in-app badge fallback

7.7 Safety & Ops
	•	REQ-SAFE-OPS-01: block/report within 2 taps (profile + chat)
	•	REQ-ADMIN-01: minimal admin console v1:
	•	list reports; view snapshots; ban/unban; hide profile

⸻

8) Subscription Model (v1 Fixed)

8.1 Plans
	•	PLAN-FREE
	•	PLAN-PLUS (Volume)
	•	PLAN-PREMIUM (Efficiency + Control + Priority)

8.2 Entitlements (fixed)

Entitlement	Free	Plus	Premium
Quiz + type	✅	✅	✅
Persona chat + outputs	✅	✅	✅
Top-3 preview	✅	✅	✅
Full feed	❌	✅	✅
Likes	daily quota (3–5)	unlimited	unlimited
Rewind/backtrack	❌	✅	✅
Advanced prefs/dealbreakers	basic	✅	✅ (more control)
Likes You (incoming likes list)	❌	❌	✅
Incognito	❌	❌	✅
Travel (location override)	❌	❌	✅
Priority likes (ranking boost)	❌	❌	✅

8.3 iOS IAP SKUs
	•	plus_monthly, plus_yearly
	•	premium_monthly, premium_yearly
	•	Optional: Premium trial (needs abuse controls)

8.4 Implementation constraints
	•	REQ-SUB-01: StoreKit 2
	•	REQ-SUB-02: server is source-of-truth for entitlements
	•	REQ-SUB-03: App Store Server Notifications v2 sync
	•	REQ-SUB-04: entitlement gates must cover feed, likes quota, likes-you, incognito, travel, priority boost, advanced prefs

⸻

9) Localization
	•	REQ-L10N-01: locales: en-US, ko-KR
	•	REQ-L10N-02: quiz, result copy, paywall copy, safety flows localized
	•	REQ-L10N-03: all dev artifacts in English
	•	REQ-L10N-04: translation QA: professional + review; avoid stigmatizing tone; extra caution on Axis C

⸻

10) Data, Versioning, Retention

10.1 Versioning
	•	REQ-VER-01: quiz_version increments on any quiz wording/scoring/tie-break change
	•	REQ-VER-02: type_catalog_version increments on labels/icons/desc change
	•	REQ-VER-03: no silent user-facing type changes; re-run is user-initiated (cooldown recommended 30d)

10.2 Retention
	•	REQ-RET-01: raw quiz answers + raw chat transcript retained 30–90d
	•	REQ-RET-02: long-term keep: type_id, axis_scores, structured outputs, user profile edits
	•	REQ-RET-03: deletion request deletes associated records per policy

10.3 Key IDs

anon_session_id, quiz_response_id, chat_session_id, handoff_token, user_id

⸻

11) Analytics & Experiments

11.1 Minimum events

landing_view, quiz_start, quiz_complete, result_preview_view, chat_start, chat_complete, summary_view, preview_top3_view, paywall_view, purchase_start, purchase_success, purchase_cancel, handoff_claim_success, profile_minimum_complete, feed_view, like, match_created, chat_open, message_sent, reply_received_24h, block, report

11.2 Experiments (Remote Config)
	•	EXP-01: paywall presentation
	•	EXP-02: Top3 preview layout
	•	EXP-03: chat length 6 vs 10 turns

⸻

12) NFRs
	•	NFR-01: deterministic type assignment
	•	NFR-02: match create is atomic + idempotent
	•	NFR-03: realtime chat reconnect-safe
	•	NFR-04: strict validation for LLM outputs (schema)
	•	NFR-05: rate-limit anonymous endpoints; TTL sessions; chat caps
	•	NFR-06: secure token storage (web HttpOnly cookie; iOS Keychain)

⸻

13) Tech Stack (Final)

Web: Next.js(App Router)+TS, Tailwind, TanStack Query, Zod, next-intl; Vercel; Sentry
iOS: SwiftUI, Universal Links, Sign in with Apple + ASWebAuthenticationSession(Google/Kakao), Keychain, Socket.IO client, Sentry, APNs+FCM
Backend/Infra: NestJS+TS (REST+OpenAPI), Prisma, Postgres(RDS), Redis(ElastiCache), BullMQ, Socket.IO gateway; ECS Fargate + ALB + ACM; S3+CloudFront; Secrets Manager; Terraform; GitHub Actions; CloudWatch; Sentry
LLM: OpenAI API; server-side orchestration; JSON schema validation; cost caps

⸻

14) Release Epics (v1)
	•	EP-01 Web: Landing+Anon Session+Quiz+ResultPreview
	•	EP-02 Web: Persona Chat + Structured Outputs + Summary
	•	EP-03 Web: Top3 Preview + Paywall + Handoff Token
	•	EP-04 iOS: Universal Link Claim + Auth (Apple/Google/Kakao)
	•	EP-05 iOS: Profile Minimum + Subscription/Entitlements
	•	EP-06 DatingCore: Feed + Like/Match + Realtime Chat + Push
	•	EP-07 Safety/Ops: Block/Report + Minimal Admin Console
	•	EP-08 Hardening: abuse controls, stability, app review readiness

⸻

15) Definition of Done (v1)
	•	Web anon: quiz→chat→summary→Top3 works end-to-end
	•	App: handoff claim works; Apple/Google/Kakao auth works; profile minimum enforced
	•	Subscription gates full feed + premium entitlements correctly
	•	Dating core: feed→like→match→chat works end-to-end
	•	Block/report removes visibility immediately; evidence snapshot stored
	•	Analytics fully instrumented; experiments configurable
	•	Abuse controls prevent runaway LLM cost/spam

⸻
