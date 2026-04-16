// ─── CSV / JSON → Flashcard Parser ──────────────────────────
// Converts admin-uploaded CSV or JSON text into the flashcard
// payload expected by POST /admin/subjects/:id/levels/:level/cards
// and POST /admin/flashcards/bulk.

export interface ParsedFlashcard {
  question: string;
  options: { id: string; text: string }[];
  correctAnswerId: string;
  explanation: string | null;
}

export interface ParseResult {
  cards: ParsedFlashcard[];
  errors: string[];
}

// ─── CSV Parser ──────────────────────────────────────────────
// Expected CSV headers (case-insensitive):
//   question, optionA, optionB, optionC, optionD, correctAnswer, explanation
//
// correctAnswer must be one of: A, B, C, D
// explanation is optional — blank cells are fine.

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

export function parseCSV(text: string): ParseResult {
  const errors: string[] = [];
  const cards: ParsedFlashcard[] = [];

  // ── Character-level row splitter (handles newlines inside quotes) ──
  const rows: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (ch === '"') {
      // Handle escaped double-quote ("") — keep quotes toggled correctly
      if (inQuotes && i + 1 < text.length && text[i + 1] === '"') {
        current += '""';
        i++; // skip the second quote
      } else {
        inQuotes = !inQuotes;
      }
      current += ch;
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      // Skip the \n in a \r\n pair
      if (ch === '\r' && i + 1 < text.length && text[i + 1] === '\n') {
        i++;
      }
      if (current.trim().length > 0) {
        rows.push(current);
      }
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim().length > 0) {
    rows.push(current);
  }

  if (rows.length < 2) {
    return { cards: [], errors: ['CSV must have a header row and at least one data row.'] };
  }

  // Validate headers
  const headers = splitCSVRow(rows[0] ?? '').map((h) => h.toLowerCase().replace(/\s+/g, ''));
  const required = ['question', 'optiona', 'optionb', 'optionc', 'optiond', 'correctanswer'];
  const missing = required.filter((r) => !headers.includes(r));
  if (missing.length > 0) {
    return { cards: [], errors: [`Missing required CSV columns: ${missing.join(', ')}`] };
  }

  const qi = headers.indexOf('question');
  const ai = headers.indexOf('optiona');
  const bi = headers.indexOf('optionb');
  const ci = headers.indexOf('optionc');
  const di = headers.indexOf('optiond');
  const correctI = headers.indexOf('correctanswer');
  const explI = headers.indexOf('explanation');

  for (let row = 1; row < rows.length; row++) {
    const cols = splitCSVRow(rows[row]!);
    const question = cols[qi]?.trim() ?? '';
    const optA = cols[ai]?.trim() ?? '';
    const optB = cols[bi]?.trim() ?? '';
    const optC = cols[ci]?.trim() ?? '';
    const optD = cols[di]?.trim() ?? '';
    const correct = (cols[correctI]?.trim() ?? '').toUpperCase();
    const explanation = explI >= 0 ? cols[explI]?.trim() ?? '' : '';

    if (!question) {
      errors.push(`Row ${row + 1}: Question is empty — skipped.`);
      continue;
    }
    if (!optA || !optB) {
      errors.push(`Row ${row + 1}: At least options A and B are required — skipped.`);
      continue;
    }
    if (!['A', 'B', 'C', 'D'].includes(correct)) {
      errors.push(`Row ${row + 1}: correctAnswer must be A, B, C, or D — got "${correct}" — skipped.`);
      continue;
    }

    const options: { id: string; text: string }[] = [];
    if (optA) options.push({ id: 'A', text: optA });
    if (optB) options.push({ id: 'B', text: optB });
    if (optC) options.push({ id: 'C', text: optC });
    if (optD) options.push({ id: 'D', text: optD });

    // Verify that the selected correct option is actually filled
    const hasCorrectOption = options.some((o) => o.id === correct);
    if (!hasCorrectOption) {
      errors.push(`Row ${row + 1}: correctAnswer "${correct}" references an empty option — skipped.`);
      continue;
    }

    cards.push({
      question,
      options,
      correctAnswerId: correct,
      explanation: explanation || null,
    });
  }

  return { cards, errors };
}

// ─── JSON Parser ─────────────────────────────────────────────
// Expected structure: an array of objects:
// [
//   {
//     "question": "...",
//     "options": [{ "id": "A", "text": "..." }, ...],
//     "correctAnswerId": "A",
//     "explanation": "..."          // optional
//   }
// ]

export function parseJSON(text: string): ParseResult {
  const errors: string[] = [];
  const cards: ParsedFlashcard[] = [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { cards: [], errors: ['Invalid JSON. Please check for syntax errors.'] };
  }

  if (!Array.isArray(parsed)) {
    return { cards: [], errors: ['JSON must be an array of flashcard objects.'] };
  }

  for (let i = 0; i < parsed.length; i++) {
    const item = parsed[i];
    const prefix = `Item ${i + 1}`;

    if (typeof item !== 'object' || item === null) {
      errors.push(`${prefix}: Not a valid object — skipped.`);
      continue;
    }

    const record = item as Record<string, unknown>;
    const q = record.question;
    const opts = record.options;
    const correct = record.correctAnswerId;
    const expl = record.explanation ?? null;

    if (typeof q !== 'string' || !q.trim()) {
      errors.push(`${prefix}: Missing or empty "question" field — skipped.`);
      continue;
    }

    if (!Array.isArray(opts) || opts.length < 2) {
      errors.push(`${prefix}: "options" must be an array with at least 2 entries — skipped.`);
      continue;
    }

    const validOptions: { id: string; text: string }[] = [];
    let optionError = false;
    for (const opt of opts) {
      if (typeof opt?.id !== 'string' || typeof opt?.text !== 'string') {
        errors.push(`${prefix}: Each option must have "id" and "text" strings — skipped.`);
        optionError = true;
        break;
      }
      validOptions.push({ id: opt.id, text: opt.text });
    }
    if (optionError) continue;

    if (typeof correct !== 'string' || !validOptions.some((o) => o.id === correct)) {
      errors.push(`${prefix}: "correctAnswerId" must match one of the option ids — skipped.`);
      continue;
    }

    cards.push({
      question: q.trim(),
      options: validOptions,
      correctAnswerId: correct,
      explanation: typeof expl === 'string' && expl.trim() ? expl.trim() : null,
    });
  }

  return { cards, errors };
}
