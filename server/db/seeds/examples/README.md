# Bulk Insert — Usage Guide

## API Endpoints

There are **3 endpoints** for inserting flashcards. Use the one that fits your situation:

---

### Route 1 — Topic-Scoped Bulk Insert (recommended)

> `POST /admin/subjects/:subjectId/levels/:level/cards/bulk?topicSlug=<slug>`

Finds the correct deck automatically by `(subjectId, level, topicSlug)`.
Auto-creates the deck if it doesn't exist yet.

```
POST /admin/subjects/664a1b2c3d4e5f6a7b8c9d0e/levels/Beginner/cards/bulk?topicSlug=thermal-physics
Authorization: Bearer <admin-token>
Content-Type: application/json

{ "cards": [...] }
```

**Valid levels:** `Beginner` | `Rookie` | `Skilled` | `Competent` | `Expert` | `Master`

---

### Route 2 — Generic Bulk Insert (by deck ID)

> `POST /admin/flashcards/bulk?deckId=<deckId>`

Use when you already know the MongoDB `_id` of the target deck.

```
POST /admin/flashcards/bulk?deckId=664a1b2c3d4e5f6a7b8c9d0e
Authorization: Bearer <admin-token>
Content-Type: application/json

{ "cards": [...] }
```

---

### Route 3 — Single Card Insert

> `POST /admin/subjects/:subjectId/levels/:level/cards?topicSlug=<slug>`

Same as Route 1 but inserts one card at a time. Useful for testing.

---

## Payload Format

```json
{
  "cards": [
    {
      "question": "Your question text here (max 2000 chars)",
      "options": [
        { "id": "A", "text": "Option A text" },
        { "id": "B", "text": "Option B text" },
        { "id": "C", "text": "Option C text" },
        { "id": "D", "text": "Option D text" }
      ],
      "correctAnswerId": "B",
      "explanation": "Why B is correct (optional, max 2000 chars)",
      "imageUrl": null,
      "tags": ["SubjectName", "topic-slug", "ExamTag"]
    }
  ]
}
```

### Field Rules

| Field | Required | Constraints |
|-------|----------|-------------|
| `question` | ✅ | 1–2000 chars |
| `options` | ✅ | 2–6 items, each with `id` (1–50 chars) and `text` (1–1000 chars) |
| `correctAnswerId` | ✅ | Must match one of `options[].id` |
| `explanation` | ❌ | Optional, up to 2000 chars, or `null` |
| `imageUrl` | ❌ | Optional valid URL, or `null` |
| `tags` | ❌ | Optional array of strings (each max 100 chars) |

> **Max 100 cards per request.** Split larger batches into multiple calls.

---

## Example curl Commands

### Bulk insert to a topic-scoped deck

```bash
curl -X POST \
  "http://localhost:3000/admin/subjects/664a1b2c3d4e5f6a7b8c9d0e/levels/Beginner/cards/bulk?topicSlug=thermal-physics" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d @server/db/seeds/examples/bulk-insert-example.json
```

### Bulk insert to a known deck ID

```bash
curl -X POST \
  "http://localhost:3000/admin/flashcards/bulk?deckId=664a1b2c3d4e5f6a7b8c9d0e" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d @server/db/seeds/examples/bulk-insert-example.json
```

---

## Finding Subject / Deck IDs

```bash
# List all subjects
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/content/subjects

# List decks for a subject + level
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/content/subjects/:subjectId/levels/Beginner/decks"
```

---

## Successful Response

```json
{
  "success": true,
  "data": {
    "deckId": "664a1b2c3d4e5f6a7b8c9d0e",
    "created": 3,
    "requested": 3
  },
  "timestamp": "2026-04-26T09:00:00.000Z"
}
```

## Notes

- **Idempotency**: The API does **not** check for duplicate questions. Re-sending the same payload will insert duplicates. Verify before re-submitting.
- **Cache**: Redis deck cache is automatically busted after each successful insert — students see the updated `cardCount` immediately.
- **Tags**: If you omit `tags`, the auto-created deck will still have `[topicSlug, subjectName, level]`. For flashcards, the level is appended by the seed script but not by the API — add it manually in your payload if needed.
