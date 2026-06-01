import logger from '../utils/logger.js';

export function parseReview(raw) {
  try {
    const cleaned = raw
      .trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();

    const parsed = JSON.parse(cleaned);

    if (!Array.isArray(parsed)) {
      logger.warn('LLM response was not an array, returning empty');
      return [];
    }

    const valid = parsed.filter(item => {
      const hasLine = item.start_line !== undefined || item.line !== undefined;
      const ok = item.file && hasLine && item.comment;
      if (!ok) logger.warn({ item }, 'Skipping invalid comment item');
      return ok;
    });

    return valid.map(item => ({
      file: item.file,
      // Fix 2 — fallback chain: start_line → line → 1
      start_line: item.start_line ?? item.line ?? 1,
      end_line: item.end_line ?? item.start_line ?? item.line ?? 1,
      severity: item.severity || 'minor',
      category: item.category || 'General',
      title: item.title || 'Code Issue',
      comment: item.comment,
      suggestion: item.suggestion || null,
    }));

  } catch (err) {
    logger.error(`Failed to parse LLM response: ${err.message}`);
    return [];
  }
}