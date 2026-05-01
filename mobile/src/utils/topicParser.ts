// ─── CSV / JSON → Topic Parser ──────────────────────────────
// Converts admin-uploaded CSV or JSON text into the topic
// payload expected by POST /admin/subjects/:id/topics/bulk.
//
// CSV format:
//   Required: displayName
//   Optional: slug, order
//   If slug is omitted, it is auto-generated from displayName.
//
// JSON format:
//   [{ "displayName": "Kinematics", "slug": "kinematics", "order": 0 }]
//   slug and order are optional.

export interface ParsedTopic {
  slug: string;
  displayName: string;
  order?: number;
}

export interface TopicParseResult {
  topics: ParsedTopic[];
  errors: string[];
}

// ─── Slug Helper ─────────────────────────────────────────────

function toSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

// ─── CSV Row Splitter ────────────────────────────────────────

function splitCSVRow(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

// ─── CSV Parser ──────────────────────────────────────────────
// Required headers (case-insensitive): displayName (or displayname)
// Optional headers: slug, order

export function parseTopicCSV(text: string): TopicParseResult {
  const errors: string[] = [];
  const topics: ParsedTopic[] = [];

  // Character-level row splitter (handles newlines inside quotes)
  const rows: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (ch === '"') {
      if (inQuotes && i + 1 < text.length && text[i + 1] === '"') {
        current += '""';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      current += ch;
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && i + 1 < text.length && text[i + 1] === '\n') i++;
      if (current.trim().length > 0) rows.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim().length > 0) rows.push(current);

  if (rows.length < 2) {
    return { topics: [], errors: ['CSV must have a header row and at least one data row.'] };
  }

  const headers = splitCSVRow(rows[0] ?? '').map((h) => h.toLowerCase().replace(/\s+/g, ''));
  const required = ['displayname'];
  const missing = required.filter((r) => !headers.includes(r));
  if (missing.length > 0) {
    return { topics: [], errors: [`Missing required CSV column: displayName`] };
  }

  const nameI = headers.indexOf('displayname');
  const slugI = headers.indexOf('slug');
  const orderI = headers.indexOf('order');

  const seenSlugs = new Set<string>();

  for (let row = 1; row < rows.length; row++) {
    const cols = splitCSVRow(rows[row]!);
    const displayName = cols[nameI]?.trim() ?? '';
    let slug = slugI >= 0 ? (cols[slugI]?.trim() ?? '') : '';
    const rawOrder = orderI >= 0 ? (cols[orderI]?.trim() ?? '') : '';

    if (!displayName) {
      errors.push(`Row ${row + 1}: displayName is empty — skipped.`);
      continue;
    }

    // Auto-generate slug if not provided
    if (!slug) {
      slug = toSlug(displayName);
    }

    if (!isValidSlug(slug)) {
      errors.push(`Row ${row + 1}: Invalid slug "${slug}" (must be lowercase kebab-case) — skipped.`);
      continue;
    }

    // Deduplicate within the file
    if (seenSlugs.has(slug)) {
      errors.push(`Row ${row + 1}: Duplicate slug "${slug}" — skipped.`);
      continue;
    }
    seenSlugs.add(slug);

    const order = rawOrder ? parseInt(rawOrder, 10) : undefined;

    topics.push({
      slug,
      displayName,
      ...(order !== undefined && !isNaN(order) && { order }),
    });
  }

  return { topics, errors };
}

// ─── JSON Parser ─────────────────────────────────────────────
// Expected structure: array of objects:
// [
//   { "displayName": "Kinematics", "slug": "kinematics", "order": 0 },
//   { "displayName": "Laws of Motion" }  // slug auto-generated
// ]

export function parseTopicJSON(text: string): TopicParseResult {
  const errors: string[] = [];
  const topics: ParsedTopic[] = [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { topics: [], errors: ['Invalid JSON. Please check for syntax errors.'] };
  }

  if (!Array.isArray(parsed)) {
    return { topics: [], errors: ['JSON must be an array of topic objects.'] };
  }

  const seenSlugs = new Set<string>();

  for (let i = 0; i < parsed.length; i++) {
    const item = parsed[i];
    const prefix = `Item ${i + 1}`;

    if (typeof item !== 'object' || item === null) {
      errors.push(`${prefix}: Not a valid object — skipped.`);
      continue;
    }

    const record = item as Record<string, unknown>;
    const displayName = record['displayName'];
    let slug = record['slug'];
    const order = record['order'];

    if (typeof displayName !== 'string' || !displayName.trim()) {
      errors.push(`${prefix}: Missing or empty "displayName" — skipped.`);
      continue;
    }

    // Auto-generate slug if not provided
    if (slug === undefined || slug === null || slug === '') {
      slug = toSlug(displayName.trim());
    }
    if (typeof slug !== 'string' || !isValidSlug(slug)) {
      errors.push(`${prefix}: Invalid slug "${slug}" (must be lowercase kebab-case) — skipped.`);
      continue;
    }

    // Deduplicate within the file
    if (seenSlugs.has(slug)) {
      errors.push(`${prefix}: Duplicate slug "${slug}" — skipped.`);
      continue;
    }
    seenSlugs.add(slug);

    topics.push({
      slug,
      displayName: displayName.trim(),
      ...(typeof order === 'number' && Number.isInteger(order) && order >= 0 && { order }),
    });
  }

  return { topics, errors };
}
