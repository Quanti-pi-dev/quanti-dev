// ─── Knowledge Graph Service ─────────────────────────────────
// Loads the knowledge graph from disk and provides prerequisite
// queries for the adaptive card selector.

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createServiceLogger } from '../lib/logger.js';
import type { ConceptNode } from '@kd/shared';

const log = createServiceLogger('KnowledgeGraph');

// ─── Graph Data ──────────────────────────────────────────────

interface GraphData {
  topics: Record<string, { concepts: ConceptNode[] }>;
}

let _graph: GraphData | null = null;

/** Load the knowledge graph (lazy singleton). */
function loadGraph(): GraphData {
  if (_graph) return _graph;

  try {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const graphPath = join(__dirname, '..', '..', 'db', 'knowledge-graph.json');
    const raw = readFileSync(graphPath, 'utf-8');
    _graph = JSON.parse(raw) as GraphData;
    log.info({ topics: Object.keys(_graph.topics).length }, 'Knowledge graph loaded');
  } catch (err) {
    log.warn({ err }, 'Knowledge graph not found — prerequisite scoring disabled');
    _graph = { topics: {} };
  }

  return _graph;
}

// ─── Prerequisite Queries ────────────────────────────────────

/**
 * Get the prerequisite concept tags for a given concept.
 *
 * @param conceptTag  The concept tag to look up
 * @returns           Array of prerequisite tags, or empty if not found
 */
export function getPrerequisites(conceptTag: string): string[] {
  const graph = loadGraph();

  for (const topic of Object.values(graph.topics)) {
    const node = topic.concepts.find(c => c.tag === conceptTag);
    if (node) return node.prerequisites;
  }

  return [];
}

/**
 * Check if all prerequisites for a concept are mastered.
 *
 * @param conceptTag   The concept to check readiness for
 * @param masteryMap   Map of conceptTag → P(mastery)
 * @param threshold    Minimum mastery for a prerequisite to count as "ready" (default 0.4)
 * @returns            Score 0–1 representing prerequisite readiness
 */
export function prerequisiteReadiness(
  conceptTag: string,
  masteryMap: Map<string, number>,
  threshold: number = 0.4,
): number {
  const prereqs = getPrerequisites(conceptTag);

  // No prerequisites → fully ready
  if (prereqs.length === 0) return 1.0;

  let readyCount = 0;
  for (const prereq of prereqs) {
    const mastery = masteryMap.get(prereq) ?? 0;
    if (mastery >= threshold) readyCount++;
  }

  return readyCount / prereqs.length;
}

/**
 * Get all concepts in the knowledge graph for a topic.
 */
export function getTopicConcepts(topicSlug: string): ConceptNode[] {
  const graph = loadGraph();
  return graph.topics[topicSlug]?.concepts ?? [];
}

/**
 * Get the topological order for studying concepts in a topic.
 * Returns concepts sorted so prerequisites come before dependents.
 */
export function getStudyOrder(topicSlug: string): string[] {
  const concepts = getTopicConcepts(topicSlug);
  if (concepts.length === 0) return [];

  // Kahn's algorithm for topological sort
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const c of concepts) {
    if (!inDegree.has(c.tag)) inDegree.set(c.tag, 0);
    if (!adjacency.has(c.tag)) adjacency.set(c.tag, []);

    for (const prereq of c.prerequisites) {
      if (!adjacency.has(prereq)) adjacency.set(prereq, []);
      adjacency.get(prereq)!.push(c.tag);
      inDegree.set(c.tag, (inDegree.get(c.tag) ?? 0) + 1);
    }
  }

  const queue: string[] = [];
  for (const [tag, deg] of inDegree) {
    if (deg === 0) queue.push(tag);
  }

  const order: string[] = [];
  while (queue.length > 0) {
    const tag = queue.shift()!;
    order.push(tag);
    for (const dependent of adjacency.get(tag) ?? []) {
      const newDeg = (inDegree.get(dependent) ?? 1) - 1;
      inDegree.set(dependent, newDeg);
      if (newDeg === 0) queue.push(dependent);
    }
  }

  return order;
}
