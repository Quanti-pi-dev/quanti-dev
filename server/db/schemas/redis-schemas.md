# Redis Schema Documentation

> Redis is the **hot-path datastore** for the platform. It serves as the primary
> store for real-time progress, gamification state, and live game sessions, and as
> the caching layer for PostgreSQL/MongoDB data. Redis Pub/Sub powers the
> real-time event system for SSE connections.
>
> **Connection**: Single `ioredis` instance managed by `server/src/lib/database.ts`

---

## Key Naming Convention

All keys follow the pattern `{domain}:{identifier}[:sub-identifier]`.
User identifiers are **Auth0 IDs** (e.g. `auth0|abc123`) unless noted otherwise.

---

## 1. Gamification — Coins & Leaderboards

### `coins:{userId}` — String (integer)
> **Owner**: `gamification.repository.ts`

Current spendable coin balance. Modified atomically via Lua scripts.

| Operation | Method |
|---|---|
| Earn (+ leaderboard) | `earnCoins()` — `INCRBY` |
| Spend (atomic check) | `spendCoins()` — Lua `DECRBY` with balance guard |
| Credit (balance only) | `creditCoins()` — `INCRBY` (no leaderboard/lifetime) |

- **TTL**: None (permanent)

---

### `coins_lifetime:{userId}` — String (integer)
> **Owner**: `gamification.repository.ts`

Total coins ever earned (not decremented on spend). Used for lifetime stats.

- **TTL**: None (permanent)

---

### `coins_daily:{userId}:{YYYY-MM-DD}` — String (integer)
> **Owner**: `reward.service.ts`

Daily coin earnings counter. Enforced via Lua `DAILY_CAP_LUA` script that
atomically reads current value, computes remaining allowance, clamps the award,
and increments — eliminating the TOCTOU race between read and write.

- **TTL**: 24 hours (set by Lua script on first increment)
- **Default cap**: 100 coins/day (configurable via `platform_config.coin_daily_cap`)

---

### `leaderboard:global` — Sorted Set
> **Owner**: `gamification.repository.ts`

Global all-time leaderboard. Members are Auth0 IDs, scores are lifetime earned coins.

| Operation | Command |
|---|---|
| Add/update score | `ZINCRBY` (on `earnCoins()`) |
| Top N | `ZREVRANGE ... WITHSCORES` |
| User rank | `ZREVRANK` |
| Total participants | `ZCARD` |

- **TTL**: None (permanent)

---

### `leaderboard:weekly` — Sorted Set
> **Owner**: `gamification.repository.ts`

Weekly leaderboard. Same structure as global. Reset externally (cron or manual).

- **TTL**: None (reset by admin/cron)

---

## 2. Badges

### `badges:{userId}` — Set
> **Owner**: `gamification.repository.ts`

Set of badge IDs (PG UUID strings) the user has earned. Used for O(1) duplicate
checks before awarding. Authoritative badge records live in PostgreSQL `user_badges`.

- **TTL**: None (permanent)

---

## 3. Study Progress

### `progress:{userId}:{deckId}` — Hash
> **Owner**: `progress.repository.ts`

Per-deck study progress for a user.

| Field | Type | Description |
|---|---|---|
| `completed_cards` | int | Number of cards answered correctly |
| `total_cards` | int | Total cards in deck (set on initialize) |
| `last_card_index` | int | Resume position |
| `last_studied_at` | ISO string | Last activity timestamp |

- **TTL**: None (permanent)

---

### `progress_decks:{userId}` — Set
> **Owner**: `progress.repository.ts`

Tracking set of all deck IDs the user has studied. Replaces `SCAN` pattern for
O(1) lookup in `getSummary()`.

- **TTL**: None (permanent)
- **Populated by**: `recordCompletion()` via `SADD`

---

### `daily_activity:{userId}:{YYYY-MM-DD}` — Hash
> **Owner**: `progress.repository.ts`

Daily study activity metrics.

| Field | Type | Description |
|---|---|---|
| `cards_studied` | int | Cards completed today |
| `time_ms` | int | Cumulative response time in ms |

- **TTL**: 90 days (7,776,000 seconds)

---

## 4. Level-Scoped Progress (Topic System)

### `level_progress:{userId}:{examId}:{subjectId}:{topicSlug}:{level}` — Hash
> **Owner**: `progress.repository.ts`

Answer counters for a specific (user, exam, subject, topic, level) combination.

| Field | Type | Description |
|---|---|---|
| `correct` | int | Correct answer count |
| `total` | int | Total answer count |

- **TTL**: None (permanent)
- **Unlock trigger**: When `correct >= LEVEL_UNLOCK_THRESHOLD` (20), the next level is unlocked

---

### `unlocked_levels:{userId}:{examId}:{subjectId}:{topicSlug}` — Set
> **Owner**: `progress.repository.ts`

Set of level names (e.g. `Beginner`, `Intermediate`, `Advanced`, `Expert`, `Olympiad`, `Master`)
that the user has unlocked for this topic.

- **TTL**: None (permanent)
- **Auto-seeded**: `Beginner` is added on first access via `recordLevelAnswer()` or `getSubjectLevelSummary()`

---

### `level_progress_keys:{userId}` — Set
> **Owner**: `progress.repository.ts`

Tracking set storing composite keys (`examId:subjectId:topicSlug:level`) for all
levels the user has interacted with. Enables O(1) progress aggregation in
`getExamProgress()` and AI insights without `SCAN`.

- **TTL**: None (permanent)
- **Format**: Each member is `{examId}:{subjectId}:{topicSlug}:{level}`

---

### `answered_cards:{userId}:{examId}:{subjectId}:{topicSlug}:{level}` — Set
> **Owner**: `reward.service.ts`

Deduplication set for correct-answer coin rewards. Stores card IDs that have
already been rewarded. `SADD` returns 1 (newly added) or 0 (already exists),
providing atomic dedup without a separate check.

- **TTL**: 90 days (refreshed on each `SADD`)
- **Purpose**: Prevents double-rewarding the same card in the same context

---

## 5. Streaks

### `streak:{userId}` — Hash
> **Owner**: `progress.repository.ts`

Study streak state.

| Field | Type | Description |
|---|---|---|
| `current_streak` | int | Current consecutive study days |
| `longest_streak` | int | All-time longest streak |
| `last_study_date` | YYYY-MM-DD | Last date user studied |
| `freezes` | int | Available streak freeze inventory (max 3) |

**Streak freeze consumption** is handled via Lua script `CONSUME_FREEZE_LUA`:
atomically reads `freezes`, decrements if > 0, returns 1/0. Prevents race
conditions when multiple requests arrive simultaneously.

- **TTL**: None (permanent)

---

## 6. Subscriptions & Auth

### `sub:{userId}` — String (JSON)
> **Owner**: `subscription.service.ts`

Cached `SubscriptionContext` object for feature-gating.

```jsonc
{
  "planTier": 2,
  "planSlug": "pro-monthly",
  "status": "active",
  "features": { "unlimitedDecks": true, "aiRecommendations": true },
  "periodEnd": "2026-05-14T00:00:00Z"
}
```

- **TTL**: 5 minutes (300 seconds)
- **Invalidated by**: `subscriptionService.invalidateCache()` on any status change

---

### `lock:checkout:{userId}` — String
> **Owner**: `subscription.service.ts`

Distributed mutex preventing concurrent checkout attempts for the same user.
Acquired via Lua `SETNX + EX` (atomic SET-if-not-exists with TTL).

- **TTL**: 30 seconds
- **Value**: `"1"`
- **Released**: Explicitly via `DEL` in `finally` block, or auto-expires

---

### `token_block:{sha256Hash}` — String
> **Owner**: `auth.service.ts`

JWT blocklist entry. On logout, the SHA-256 hash of the access token is stored
with a TTL matching the token's remaining lifetime. The auth middleware checks
this before accepting any JWT.

- **TTL**: Remaining JWT lifetime (from `exp` claim), max ~1 hour
- **Value**: `"1"`

---

## 7. Push Notifications

### `fcm_token:{userId}` — String
> **Owner**: `user.routes.ts` (write), `notification.service.ts` (read)

Firebase Cloud Messaging device token for push notifications. Stored on app
launch, deleted on logout.

- **TTL**: 90 days (refreshed on each app launch)
- **Cleanup**: Auto-deleted if FCM API returns 404/400 (invalid token)

---

## 8. Trial Pass (Streak-Triggered Pro Trial)

### `trial_pass:{userId}` — String
> **Owner**: `trialpass.service.ts`

Active trial pass indicator. Presence + TTL determines if user has Pro access.

- **TTL**: Configurable via `platform_config.trial_pass_duration_days` (default 7 days)
- **Value**: `"active"`
- **Granted when**: Free user hits 7-day study streak

---

### `trial_pass_used:{userId}` — String
> **Owner**: `trialpass.service.ts`

Cooldown key preventing trial pass abuse. If this key exists, user cannot
receive another trial pass.

- **TTL**: 90 days
- **Value**: `"1"`

---

## 9. P2P Challenges (Live Game State)

### `active_challenge:{challengeId}` — Hash
> **Owner**: `challenge.service.ts`

Live game state for an accepted P2P challenge. Created on accept, deleted on finalize.

| Field | Type | Description |
|---|---|---|
| `creator_id` | string | PG UUID of challenge creator |
| `opponent_id` | string | PG UUID of opponent |
| `creator_score` | int | Creator's current score |
| `opponent_score` | int | Opponent's current score |
| `duration_sec` | int | Game duration in seconds |
| `started_at` | ISO string | Game start timestamp |
| `finalized` | "0" / "1" | CAS flag for idempotent finalization |

**Finalization guard**: Lua script `FINALIZE_GUARD_LUA` atomically checks and sets
`finalized=1`. Returns 1 if this process won the race, 0 if already finalized.
Prevents double-payout.

- **TTL**: `durationSeconds + 60` (buffer for finalization)
- **Deleted**: Explicitly via `DEL` after finalization

---

### `challenge_invites:{opponentPgUuid}` — Set
> **Owner**: `challenge.service.ts`

Set of challenge IDs pending for an opponent. Used for fast "pending invites"
lookup without a PG query.

- **TTL**: 25 hours (slightly longer than PG challenge expiry of 24h)
- **Cleanup**: `SREM` on accept, decline, or cancel

---

## 10. Platform Config Cache

### `platform_config:all` — String (JSON)
> **Owner**: `config.repository.ts`

Cached flat map of all `platform_config` rows as `{ key: value }`.
Used by `getPublicMap()` and `getNumber()` for admin-configurable values.

- **TTL**: 5 minutes (300 seconds)
- **Invalidated by**: `configRepository.refreshCache()` on admin config update

---

## 11. Content Cache

### `cache:deck:subject:{subjectId}:level:{level}` — String (JSON)
> **Owner**: `content.repository.ts`

Cached deck lookup result for `findBySubjectAndLevel()`.

- **TTL**: 5 minutes (300 seconds)
- **Key variant**: May include `:topic:{topicSlug}` when topic-scoped

---

### `cache:flashcards:{deckId}:page:{page}:size:{size}` — String (JSON)
> **Owner**: `content.repository.ts`

Cached paginated flashcard results.

- **TTL**: 5 minutes (300 seconds)

---

### `cache:deck:{deckId}` — String (JSON)
> **Owner**: `content.repository.ts`

Cached individual deck document.

- **TTL**: 5 minutes (300 seconds)

---

## 12. Redis Pub/Sub Channels (Realtime)

> **Owner**: `realtime.service.ts`
>
> These are **Pub/Sub channels**, not key-value keys. They don't store data;
> they are used for cross-process event distribution. Each message is JSON.

### `realtime:score_update`

Published when a user earns coins. Consumed by SSE connections to update
leaderboard positions in real time.

```jsonc
{ "userId": "auth0|...", "newScore": 1250, "delta": 5, "leaderboard": "global", "timestamp": "..." }
```

---

### `realtime:badge_awarded`

Published when a badge is earned.

```jsonc
{ "userId": "auth0|...", "badgeId": "uuid", "timestamp": "..." }
```

---

### `realtime:challenge_score`

Published on each correct answer during a live challenge.

```jsonc
{ "challengeId": "uuid", "role": "creator", "newScore": 7 }
```

---

### `realtime:challenge_lifecycle`

Published on challenge acceptance and completion.

```jsonc
{ "challengeId": "uuid", "event": "accepted" }
{ "challengeId": "uuid", "event": "completed", "winnerId": "uuid" }
```

---

## Lua Scripts Reference

| Script | Location | Purpose |
|---|---|---|
| `SPEND_COINS_LUA` | `gamification.repository.ts` | Atomic balance-check-and-deduct (prevents double-spend) |
| `DAILY_CAP_LUA` | `reward.service.ts` | Atomic daily cap enforcement (read + clamp + increment) |
| `CONSUME_FREEZE_LUA` | `progress.repository.ts` | Atomic streak freeze consumption |
| `FINALIZE_GUARD_LUA` | `challenge.service.ts` | CAS finalization guard (prevents double-payout) |
| `CHECKOUT_LOCK_LUA` | `subscription.service.ts` | Distributed checkout mutex (`SETNX + EX`) |

---

## TTL Summary

| Key Pattern | TTL | Notes |
|---|---|---|
| `coins:*`, `coins_lifetime:*` | ∞ | Permanent balance |
| `leaderboard:*` | ∞ | Weekly reset via cron |
| `badges:*` | ∞ | Permanent badge set |
| `progress:*`, `progress_decks:*` | ∞ | Permanent progress |
| `level_progress:*` | ∞ | Permanent level counters |
| `unlocked_levels:*` | ∞ | Permanent unlock state |
| `level_progress_keys:*` | ∞ | Permanent tracking set |
| `streak:*` | ∞ | Permanent streak state |
| `daily_activity:*` | 90 days | Rolling window |
| `answered_cards:*` | 90 days | Dedup with refresh |
| `coins_daily:*` | 24 hours | Daily cap counter |
| `sub:*` | 5 minutes | Subscription cache |
| `platform_config:all` | 5 minutes | Config cache |
| `cache:*` | 5 minutes | Content cache |
| `token_block:*` | JWT remaining life | Auth blocklist |
| `fcm_token:*` | 90 days | Push notification token |
| `trial_pass:*` | 7 days (configurable) | Trial pass indicator |
| `trial_pass_used:*` | 90 days | Trial cooldown |
| `active_challenge:*` | duration + 60s | Live game state |
| `challenge_invites:*` | 25 hours | Pending invite set |
| `lock:checkout:*` | 30 seconds | Distributed mutex |
