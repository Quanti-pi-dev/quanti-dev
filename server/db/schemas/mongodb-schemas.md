# MongoDB Schema Documentation

> MongoDB stores **content data** — exams, subjects, topics, flashcard decks/cards,
> tournaments, and analytics events. All content is managed by admin users and
> consumed read-only by students.
>
> **Index Script**: `server/db/scripts/create-mongo-indexes.ts` (idempotent)

---

## Collection: `exams`
> **Owner**: Content Repository (Admin)

Represents a certification exam available on the platform.

```jsonc
{
  "_id":          ObjectId,
  "title":        String,          // "GATE 2024 — Mathematics"
  "description":  String,
  "category":     String,          // "engineering", "commerce", etc.
  "difficulty":   String,          // "beginner", "intermediate", "advanced"
  "imageUrl":     String,          // cover image CDN URL
  "isPublished":  Boolean,         // false = hidden from students
  "createdAt":    ISODate,
  "updatedAt":    ISODate
}
```

**Indexes:**
| Index Name | Fields | Options |
|---|---|---|
| `exams_published_date` | `{ isPublished: 1, createdAt: -1 }` | |
| `exams_category` | `{ category: 1 }` | |
| `exams_difficulty` | `{ difficulty: 1 }` | |
| `exams_text_search` | `{ title: 'text', description: 'text' }` | Text index |

---

## Collection: `subjects`
> **Owner**: Content Repository (Admin)

A subject area that can appear across multiple exams (many-to-many via `exam_subjects`).

```jsonc
{
  "_id":          ObjectId,
  "name":         String,          // "Linear Algebra" (unique)
  "description":  String,
  "imageUrl":     String,          // icon CDN URL
  "createdAt":    ISODate,
  "updatedAt":    ISODate
}
```

**Indexes:**
| Index Name | Fields | Options |
|---|---|---|
| `subjects_name_unique` | `{ name: 1 }` | `unique: true` |
| `subjects_text_search` | `{ name: 'text' }` | Text index |

---

## Collection: `exam_subjects`
> **Owner**: Content Repository (Admin)

Many-to-many join collection linking exams to subjects with display order.

```jsonc
{
  "_id":          ObjectId,
  "examId":       ObjectId,        // → exams._id
  "subjectId":    ObjectId,        // → subjects._id
  "order":        Number           // display sort order within the exam
}
```

**Indexes:**
| Index Name | Fields | Options |
|---|---|---|
| `exam_subjects_unique_pair` | `{ examId: 1, subjectId: 1 }` | `unique: true` |
| `exam_subjects_ordered` | `{ examId: 1, order: 1 }` | |

---

## Collection: `topics`
> **Owner**: Content Repository (Admin)

Topics are the **granular content units** within a subject. Each subject contains
multiple topics (e.g. "Eigenvalues" under "Linear Algebra"). Topics replaced the
old static taxonomy system.

```jsonc
{
  "_id":          ObjectId,
  "subjectId":    ObjectId,        // → subjects._id
  "slug":         String,          // URL-safe unique within subject, e.g. "eigenvalues"
  "displayName":  String,          // "Eigenvalues & Eigenvectors"
  "order":        Number,          // display sort order within the subject
  "createdAt":    ISODate,
  "updatedAt":    ISODate
}
```

**Indexes:**
| Index Name | Fields | Options |
|---|---|---|
| `topics_subject_slug_unique` | `{ subjectId: 1, slug: 1 }` | `unique: true` |
| `topics_subject_ordered` | `{ subjectId: 1, order: 1 }` | |

**Relationship:** One subject → N topics. Each topic generates up to 6 decks (one per level).

---

## Collection: `decks`
> **Owner**: Content Repository

A deck is a named set of flashcards scoped to a subject, topic, and difficulty level.

```jsonc
{
  "_id":          ObjectId,
  "title":        String,          // "Eigenvalues — Beginner"
  "description":  String,
  "subjectId":    ObjectId,        // → subjects._id
  "level":        String,          // "Beginner" | "Intermediate" | ... | "Master"
  "category":     String,          // "free" or "premium"
  "isPublished":  Boolean,
  "cardCount":    Number,          // denormalized flashcard count
  "tags":         String[],        // tags[0] = topicSlug (convention)
  "imageUrl":     String,
  "createdAt":    ISODate,
  "updatedAt":    ISODate
}
```

**Key convention:** `tags[0]` is always the **topic slug**. This enables topic-scoped
deck retrieval (`findBySubjectAndLevel` filters by `tags[0]`).

**Indexes:**
| Index Name | Fields | Options |
|---|---|---|
| `decks_subject_level` | `{ subjectId: 1, level: 1 }` | Non-unique compound |
| `decks_subject_topic_level_unique` | `{ subjectId: 1, 'tags.0': 1, level: 1 }` | `unique: true, sparse: true` |
| `decks_category` | `{ category: 1 }` | |
| `decks_published_category` | `{ isPublished: 1, category: 1 }` | |
| `decks_text_search` | `{ title: 'text', description: 'text' }` | Text index |

**Uniqueness:** The canonical uniqueness constraint is `(subjectId, tags.0, level)` — one deck
per subject × topic × level combination. This replaced the earlier `(subjectId, level)` unique
index when topics were introduced.

---

## Collection: `flashcards`
> **Owner**: Content Repository

Individual flashcards belonging to a deck.

```jsonc
{
  "_id":          ObjectId,
  "deckId":       ObjectId,        // → decks._id
  "question":     String,          // supports Markdown / LaTeX
  "options":      String[],        // array of 4 answer choices
  "correctIndex": Number,          // 0-based index into options
  "explanation":  String,          // shown after answering
  "tags":         String[],        // content tags for search
  "order":        Number,          // display order within deck
  "createdAt":    ISODate,
  "updatedAt":    ISODate
}
```

**Indexes:**
| Index Name | Fields | Options |
|---|---|---|
| `flashcards_deck_ordered` | `{ deckId: 1, order: 1 }` | Ordered retrieval |
| `flashcards_deck` | `{ deckId: 1 }` | Bulk operations |
| `flashcards_text_search` | `{ question: 'text', tags: 'text' }` | Text index |

---

## Collection: `tournaments`
> **Owner**: Tournament Repository

Admin-created competitive events with entry fees, prizes, and leaderboards.
Stored in MongoDB for flexible schema and fast read access.

```jsonc
{
  "_id":              ObjectId,
  "name":             String,          // "Weekend Math Blitz"
  "description":      String,
  "entryFeeCoins":    Number,          // 0 = free entry
  "requiredTier":     Number,          // 0 = no restriction, 1 = Basic, 2 = Pro, 3 = Master
  "maxParticipants":  Number,          // 0 = unlimited
  "entryCount":       Number,          // atomically incremented on enter()
  "status":           String,          // "draft" | "active" | "completed" | "cancelled"
  "startsAt":         ISODate,
  "endsAt":           ISODate,
  "prizeDescription": String,          // human-readable prize text
  "prizeCoins":       Number,          // coins awarded to #1
  "rules":            String,          // markdown rules text
  "deckId":           String | null,   // optional: restrict to a specific deck
  "examId":           String | null,   // optional: restrict to a specific exam
  "createdBy":        String,          // Firebase ID of the admin
  "createdAt":        ISODate,
  "updatedAt":        ISODate
}
```

**Atomic operations:**
- `enter()` uses `findOneAndUpdate` with `$inc` on `entryCount` and a filter condition
  (`entryCount < maxParticipants || maxParticipants === 0`) to prevent TOCTOU race conditions
  when enforcing participant caps.

**Indexes:** (managed programmatically, not in `create-mongo-indexes.ts`)
- None explicit — queries by `_id` and status filtering.

---

## Collection: `tournament_entries`
> **Owner**: Tournament Repository

Individual participant entries in a tournament. One entry per (tournament, user) pair.

```jsonc
{
  "_id":              ObjectId,
  "tournamentId":     ObjectId,        // → tournaments._id
  "userId":           String,          // Firebase ID
  "score":            Number,          // best score submitted
  "answersCorrect":   Number,
  "answersTotal":     Number,
  "completedAt":      ISODate | null,  // null if not yet played
  "joinedAt":         ISODate
}
```

**Indexes:** (managed programmatically)
- Unique: `{ tournamentId: 1, userId: 1 }` — prevents duplicate entries

---

## Collection: `analytics_events`
> **Owner**: AI Service / Analytics Service

Time-series event tracking for AI recommendations and admin dashboards.

```jsonc
{
  "_id":          ObjectId,
  "user_id":      String,          // Firebase ID
  "event_name":   String,          // e.g. "study_completed", "checkout_initiated"
  "properties":   Object,          // event-specific key-value data
  "timestamp":    ISODate
}
```

**Indexes:**
| Index Name | Fields | Options |
|---|---|---|
| `analytics_user_event_time` | `{ user_id: 1, event_name: 1, timestamp: -1 }` | |
| `analytics_event_time` | `{ event_name: 1, timestamp: -1 }` | |
| `analytics_time` | `{ timestamp: -1 }` | |
| `analytics_ttl_1year` | `{ timestamp: 1 }` | `expireAfterSeconds: 31536000` (1 year) |

---

## Deprecated Collections

### ~~`questions`~~ — **DEPRECATED**

Replaced by the `flashcards` collection. The `questions` collection used an older
field naming convention (`questionText`, `answerChoices`, `correctChoice`).
**Do not use** — retained only for reference.
