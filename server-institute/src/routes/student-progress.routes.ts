// ─── Institute Student Progress Routes ────────────────────────────
// Staff-facing endpoints to view individual student progress within
// the institute context. All routes are read-only for staff.
//
// Data sources:
//   Redis:  level_progress_keys:{uid}  — tracked (exam,subject,topic,level) tuples
//           level_progress:{uid}:...   — correct/total per level hash
//           error_journal:{uid}        — wrong-answer log
//   Mongo:  subjects, decks, flashcards — names and topic metadata
//   PG:     users, institute_members, study_sessions — identity + activity

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { requireInstituteRole } from '../middleware/auth.js';
import {
  instituteRepository,
  getRedisClient,
  getMongoDb,
  getPostgresPool,
} from '@kd/db';
import { ObjectId } from 'mongodb';
import { SUBJECT_LEVELS } from '@kd/shared';

// ─── Helpers ─────────────────────────────────────────────────────

/** Verify that a firebaseUid is an active student of this institute. */
async function assertStudentInInstitute(
  instituteId: string,
  firebaseUid: string,
): Promise<string> { // returns userId (PG UUID)
  const pg = getPostgresPool();
  const result = await pg.query(
    `SELECT user_id FROM institute_members
     WHERE institute_id = $1 AND firebase_uid = $2 AND role = 'student' AND is_active = TRUE`,
    [instituteId, firebaseUid],
  );
  if (result.rows.length === 0) {
    throw Object.assign(new Error('STUDENT_NOT_IN_INSTITUTE'), { statusCode: 404 });
  }
  return result.rows[0]['user_id'] as string;
}

// ─── Route Registration ──────────────────────────────────────────

export async function studentProgressRoutes(fastify: FastifyInstance): Promise<void> {

  // ── GET /institutes/:id/students — Roster sorted by subject ────
  // Returns all students with their opted subjects + aggregate stats.
  // Staff (educators, examiners, admins) can view the roster.
  fastify.get<{ Params: { instituteId: string }; Querystring: unknown }>(
    '/institutes/:instituteId/students',
    { preHandler: [requireInstituteRole('institute_admin', 'educator', 'examiner')] },
    async (request: FastifyRequest<{ Params: { instituteId: string }; Querystring: unknown }>, reply: FastifyReply) => {
      const { instituteId } = request.params;
      const query = z.object({
        search: z.string().optional(),
        subjectId: z.string().optional(),
        limit: z.coerce.number().int().min(1).max(100).default(50),
        offset: z.coerce.number().int().min(0).default(0),
      }).parse(request.query);

      // 1. Fetch all students from PG
      const result = await instituteRepository.listMembers(instituteId, {
        role: 'student',
        search: query.search,
        limit: query.limit,
        offset: query.offset,
      });

      if (result.data.length === 0) {
        return reply.send({
          success: true,
          data: [],
          pagination: { total: result.total, limit: query.limit, offset: query.offset },
          timestamp: new Date().toISOString(),
        });
      }

      // 2. Enrich each student with opted subjects (from Redis level_progress_keys)
      const redis = getRedisClient();
      const mongo = getMongoDb();
      const pg = getPostgresPool();

      // Batch fetch firebase_uids for active students in this institute
      const memberRows = await pg.query(
        `SELECT im.firebase_uid, im.user_id, im.student_uid, u.email
         FROM institute_members im
         JOIN users u ON u.id = im.user_id
         WHERE im.institute_id = $1 AND im.role = 'student' AND im.is_active = TRUE
         ${query.search ? `AND (u.display_name ILIKE $2 OR u.email ILIKE $2 OR im.student_uid ILIKE $2)` : ''}
         LIMIT $${query.search ? 3 : 2} OFFSET $${query.search ? 4 : 3}`,
        query.search
          ? [instituteId, `%${query.search}%`, query.limit, query.offset]
          : [instituteId, query.limit, query.offset],
      );

      // Collect all subject IDs across all students
      const allSubjectIds = new Set<string>();

      // Pipeline all level_progress_keys reads
      const pipeline = redis.pipeline();
      for (const row of memberRows.rows) {
        pipeline.smembers(`level_progress_keys:${row['firebase_uid'] as string}`);
      }
      const pipelineResults = await pipeline.exec();

      // Build subject → name map
      for (let i = 0; i < memberRows.rows.length; i++) {
        const [, members] = pipelineResults?.[i] ?? [null, []];
        for (const member of (members as string[])) {
          const parts = member.split(':');
          if (parts.length === 4 && parts[1]) allSubjectIds.add(parts[1]);
        }
      }

      const validSubjectIds = [...allSubjectIds]
        .filter(id => /^[0-9a-fA-F]{24}$/.test(id))
        .map(id => new ObjectId(id));

      const subjects = validSubjectIds.length > 0
        ? await mongo.collection('subjects').find({ _id: { $in: validSubjectIds } }).project({ name: 1 }).toArray()
        : [];
      const subjectNameMap = new Map<string, string>(subjects.map(s => [s._id.toString(), s.name as string]));

      // Build enriched student list
      const students = memberRows.rows.map((row, i) => {
        const [, members] = pipelineResults?.[i] ?? [null, []];
        const trackedMembers = members as string[];

        // Aggregate subject-level stats
        const subjectMap = new Map<string, { correct: number; total: number; highestLevelIndex: number }>();
        for (const member of trackedMembers) {
          const parts = member.split(':');
          if (parts.length !== 4) continue;
          const [, subjectId] = parts as [string, string, string, string];
          if (!subjectId) continue;
          const existing = subjectMap.get(subjectId);
          if (!existing) {
            subjectMap.set(subjectId, { correct: 0, total: 0, highestLevelIndex: -1 });
          }
        }

        const optedSubjects = [...subjectMap.keys()].map(subjectId => ({
          subjectId,
          subjectName: subjectNameMap.get(subjectId) ?? subjectId,
        }));


        return {
          firebaseUid: row['firebase_uid'] as string,
          userId: row['user_id'] as string,
          studentUid: row['student_uid'] as string | null,
          displayName: (result.data.find((m: { email?: string }) => m.email === (row['email'] as string)) as { displayName?: string })?.displayName ?? row['email'] as string,
          email: row['email'] as string,
          optedSubjects,
          subjectCount: optedSubjects.length,
          totalLevelsTracked: trackedMembers.length,
        };
      });

      // Enrich displayName properly from the members result
      const nameMap = new Map(result.data.map((m: { email: string; displayName: string }) => [m.email, m.displayName]));
      const enriched = students.map(s => ({ ...s, displayName: nameMap.get(s.email) ?? s.email }));

      // Sort by subjectCount desc, then by displayName
      enriched.sort((a, b) => b.subjectCount - a.subjectCount || a.displayName.localeCompare(b.displayName));

      return reply.send({
        success: true,
        data: enriched,
        pagination: { total: result.total, limit: query.limit, offset: query.offset },
        timestamp: new Date().toISOString(),
      });
    },
  );

  // ── GET /institutes/:id/students/:firebaseUid/progress ─────────
  // Full individual progress report for one student.
  // Aggregates: subject overview, per-topic mastery, accuracy trend,
  // level distribution, recent activity, and study pattern.
  fastify.get<{ Params: { instituteId: string; firebaseUid: string } }>(
    '/institutes/:instituteId/students/:firebaseUid/progress',
    { preHandler: [requireInstituteRole('institute_admin', 'educator', 'examiner')] },
    async (request, reply) => {
      const { instituteId, firebaseUid } = request.params;

      // Verify student belongs to this institute
      const userId = await assertStudentInInstitute(instituteId, firebaseUid);

      const redis = getRedisClient();
      const mongo = getMongoDb();
      const pg = getPostgresPool();

      // ── 1. Student identity ───────────────────────────────────
      const userRow = await pg.query(
        `SELECT u.id, u.display_name, u.email, u.avatar_url, u.created_at,
                im.student_uid, im.joined_at, im.department
         FROM users u
         JOIN institute_members im ON im.user_id = u.id
         WHERE u.id = $1 AND im.institute_id = $2 AND im.is_active = TRUE`,
        [userId, instituteId],
      );
      if (userRow.rows.length === 0) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND' }, timestamp: new Date().toISOString() });
      }
      const student = userRow.rows[0]!;

      // ── 2. Level progress tracking set ───────────────────────
      const trackedMembers = await redis.smembers(`level_progress_keys:${firebaseUid}`);

      // Parse and pipeline all level_progress hashes
      type ParsedEntry = { examId: string; subjectId: string; topicSlug: string; level: string; levelIndex: number };
      const parsed: ParsedEntry[] = [];
      for (const member of trackedMembers) {
        const parts = member.split(':');
        if (parts.length !== 4) continue;
        const [examId, subjectId, topicSlug, level] = parts as [string, string, string, string];
        const levelIndex = SUBJECT_LEVELS.indexOf(level as typeof SUBJECT_LEVELS[number]);
        if (levelIndex === -1) continue;
        parsed.push({ examId, subjectId, topicSlug, level, levelIndex });
      }

      const levelPipeline = redis.pipeline();
      for (const entry of parsed) {
        levelPipeline.hgetall(`level_progress:${firebaseUid}:${entry.examId}:${entry.subjectId}:${entry.topicSlug}:${entry.level}`);
      }
      const levelResults = parsed.length > 0 ? await levelPipeline.exec() : [];

      // ── 3. Aggregate per subject ──────────────────────────────
      const subjectAgg = new Map<string, {
        examId: string;
        correct: number; total: number;
        highestLevelIndex: number; highestLevel: string;
        topicMap: Map<string, { correct: number; total: number; highestLevelIndex: number; highestLevel: string }>;
      }>();

      for (let i = 0; i < parsed.length; i++) {
        const entry = parsed[i]!;
        const [, raw] = levelResults?.[i] ?? [null, {}];
        const data = (raw ?? {}) as Record<string, string>;
        const correct = parseInt(data['correct'] ?? '0', 10);
        const total   = parseInt(data['total']   ?? '0', 10);

        const key = entry.subjectId;
        let subj = subjectAgg.get(key);
        if (!subj) {
          subj = { examId: entry.examId, correct: 0, total: 0, highestLevelIndex: -1, highestLevel: '', topicMap: new Map() };
          subjectAgg.set(key, subj);
        }
        subj.correct += correct;
        subj.total   += total;
        if (entry.levelIndex > subj.highestLevelIndex) {
          subj.highestLevelIndex = entry.levelIndex;
          subj.highestLevel = entry.level;
        }

        // Per-topic within subject
        let topic = subj.topicMap.get(entry.topicSlug);
        if (!topic) {
          topic = { correct: 0, total: 0, highestLevelIndex: -1, highestLevel: '' };
          subj.topicMap.set(entry.topicSlug, topic);
        }
        topic.correct += correct;
        topic.total   += total;
        if (entry.levelIndex > topic.highestLevelIndex) {
          topic.highestLevelIndex = entry.levelIndex;
          topic.highestLevel = entry.level;
        }
      }

      // ── 4. Enrich with names from MongoDB ─────────────────────
      const allSubjectIds = [...subjectAgg.keys()];
      const validSubjectIds = allSubjectIds.filter(id => /^[0-9a-fA-F]{24}$/.test(id)).map(id => new ObjectId(id));

      const subjectDocs = validSubjectIds.length > 0
        ? await mongo.collection('subjects').find({ _id: { $in: validSubjectIds } }).project({ name: 1 }).toArray()
        : [];
      const subjectNameMap = new Map<string, string>(subjectDocs.map(s => [s._id.toString(), s.name as string]));

      // Fetch topic display names via decks collection
      const topicNameMap = new Map<string, string>();
      if (allSubjectIds.length > 0) {
        const deckDocs = await mongo.collection('decks')
          .aggregate([
            { $match: { subjectId: { $in: validSubjectIds } } },
            { $group: { _id: '$topicSlug', displayName: { $first: '$topicDisplayName' } } },
          ])
          .toArray();
        for (const d of deckDocs) topicNameMap.set(d._id as string, d.displayName as string ?? d._id as string);
      }

      // ── 5. Build subject overview array ──────────────────────
      const subjectOverview = [...subjectAgg.entries()].map(([subjectId, subj]) => {
        const accuracy = subj.total > 0 ? Math.round((subj.correct / subj.total) * 100) : null;
        const topicsMastery = [...subj.topicMap.entries()].map(([slug, t]) => {
          const topicAccuracy = t.total > 0 ? Math.round((t.correct / t.total) * 100) : 0;
          const maxCorrect = SUBJECT_LEVELS.length * 30;
          const masteryPercent = Math.min(100, Math.round((t.correct / maxCorrect) * 100));
          return {
            topicSlug: slug,
            topicName: topicNameMap.get(slug) ?? slug,
            correct: t.correct,
            total: t.total,
            accuracy: topicAccuracy,
            masteryPercent,
            highestLevel: t.highestLevel || null,
            highestLevelIndex: t.highestLevelIndex,
            // Label: strong / needs_focus / studying
            tag: masteryPercent >= 60 ? 'strong' as const
              : masteryPercent >= 20 ? 'studying' as const
              : 'needs_focus' as const,
          };
        });

        // Sort topics: strong desc, then studying, then needs_focus
        topicsMastery.sort((a, b) => b.masteryPercent - a.masteryPercent);

        return {
          subjectId,
          subjectName: subjectNameMap.get(subjectId) ?? subjectId,
          correct: subj.correct,
          total: subj.total,
          accuracy,
          highestLevel: subj.highestLevel || null,
          highestLevelIndex: subj.highestLevelIndex,
          topics: topicsMastery,
          strongTopics:      topicsMastery.filter(t => t.tag === 'strong'),
          studyingTopics:    topicsMastery.filter(t => t.tag === 'studying'),
          needsFocusTopics:  topicsMastery.filter(t => t.tag === 'needs_focus'),
        };
      });

      // Sort subjects by accuracy desc (most studied first)
      subjectOverview.sort((a, b) => (b.accuracy ?? -1) - (a.accuracy ?? -1));

      // ── 6. Overall stats ──────────────────────────────────────
      const totalCorrectAgg = subjectOverview.reduce((s, x) => s + x.correct, 0);
      const totalAttempts = subjectOverview.reduce((s, x) => s + x.total, 0);
      const overallAccuracy = totalAttempts > 0 ? Math.round((totalCorrectAgg / totalAttempts) * 100) : null;

      // ── 7. Study activity from PG (last 30 days) ─────────────
      const activityResult = await pg.query(
        `SELECT
           DATE(started_at) as date,
           COUNT(*) as sessions,
           SUM(correct_answers) as correct,
           SUM(cards_studied) as studied,
           ROUND(AVG(correct_answers::numeric / NULLIF(cards_studied, 0) * 100)) as accuracy_pct
         FROM study_sessions
         WHERE user_id = $1
           AND started_at >= NOW() - INTERVAL '30 days'
         GROUP BY DATE(started_at)
         ORDER BY date ASC`,
        [userId],
      );

      // ── 8. Error journal top topics ───────────────────────────
      const errorRaw = await redis.zrevrange(`error_journal:${firebaseUid}`, 0, 99);
      const errorTopicCount = new Map<string, number>();
      for (let i = 0; i < errorRaw.length; i++) {
        try {
          const parsed2 = JSON.parse(errorRaw[i]!) as { topicSlug: string };
          errorTopicCount.set(parsed2.topicSlug, (errorTopicCount.get(parsed2.topicSlug) ?? 0) + 1);
        } catch { /* skip */ }
      }
      const topErrorTopics = [...errorTopicCount.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([slug, count]) => ({ topicSlug: slug, topicName: topicNameMap.get(slug) ?? slug, errorCount: count }));

      // ── 9. Streak ─────────────────────────────────────────────
      // Streaks are stored in Redis (streak:{firebaseUid} hash), not PostgreSQL.
      const streakData = await redis.hgetall(`streak:${firebaseUid}`);
      const streak = {
        current_streak:  parseInt(streakData['current_streak']  ?? '0', 10),
        longest_streak:  parseInt(streakData['longest_streak']  ?? '0', 10),
        last_study_date: streakData['last_study_date'] ?? null,
      };

      // ── 10. Institute test submissions ────────────────────────
      const testSubmissions = await pg.query(
        `SELECT cts.score, cts.max_score, cts.percentage, cts.submitted_at, ct.title
         FROM custom_test_submissions cts
         JOIN custom_tests ct ON ct.id = cts.test_id
         WHERE cts.firebase_uid = $1 AND ct.institute_id = $2
         ORDER BY cts.submitted_at DESC LIMIT 10`,
        [firebaseUid, instituteId],
      ).catch(() => ({ rows: [] })); // graceful if table doesn't exist yet

      return reply.send({
        success: true,
        data: {
          student: {
            firebaseUid,
            userId,
            displayName: student['display_name'] as string,
            email: student['email'] as string,
            avatarUrl: student['avatar_url'] as string | null,
            studentUid: student['student_uid'] as string | null,
            department: student['department'] as string | null,
            joinedAt: new Date(student['joined_at'] as string | Date).toISOString(),
            memberSince: new Date(student['created_at'] as string | Date).toISOString(),
          },
          overview: {
            totalCorrect: totalCorrectAgg,
            totalAttempts,
            overallAccuracy,
            subjectCount: subjectOverview.length,
            currentStreak: streak['current_streak'] as number,
            longestStreak: streak['longest_streak'] as number,
            lastStudyDate: streak['last_study_date'] as string | null,
          },
          subjects: subjectOverview,
          activityLog: activityResult.rows.map(r => ({
            date:        r['date'] as string,
            sessions:    parseInt(r['sessions'] as string, 10),
            correct:     parseInt(r['correct'] as string, 10),
            studied:     parseInt(r['studied'] as string, 10),
            accuracyPct: parseInt(r['accuracy_pct'] as string ?? '0', 10),
          })),
          topErrorTopics,
          recentTestSubmissions: testSubmissions.rows.map(r => ({
            title:       r['title'] as string,
            score:       r['score'] as number,
            maxScore:    r['max_score'] as number,
            percentage:  r['percentage'] as number,
            submittedAt: new Date(r['submitted_at'] as string | Date).toISOString(),
          })),
        },
        timestamp: new Date().toISOString(),
      });
    },
  );
}
