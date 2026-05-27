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
      const ok = item.file && item.start_line && item.comment;
      if (!ok) logger.warn({ item }, 'Skipping invalid comment item');
      return ok;
    });

    return valid.map(item => ({
      file: item.file,
      start_line: item.start_line,
      end_line: item.end_line || item.start_line,
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