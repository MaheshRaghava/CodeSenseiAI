import { parseReview } from '../src/llm/parse.js';

describe('parseReview', () => {

  test('parses clean JSON array correctly', () => {
    const raw = JSON.stringify([
      { 
        file: 'auth.js', 
        start_line: 1, 
        end_line: 1,
        comment: 'Hardcoded password detected' 
      }
    ]);
    const result = parseReview(raw);
    expect(result).toHaveLength(1);
    expect(result[0].file).toBe('auth.js');
    expect(result[0].start_line).toBe(1);
    expect(result[0].comment).toBe('Hardcoded password detected');
  });

  test('handles markdown fences wrapping the JSON', () => {
    const raw = '```json\n[{"file":"index.js","start_line":2,"end_line":2,"comment":"Missing error handling"}]\n```';
    const result = parseReview(raw);
    expect(result).toHaveLength(1);
    expect(result[0].file).toBe('index.js');
  });

  test('returns empty array when LLM returns empty array', () => {
    const result = parseReview('[]');
    expect(result).toEqual([]);
  });

  test('returns empty array on completely broken response', () => {
    const result = parseReview('sorry I cannot review this');
    expect(result).toEqual([]);
  });

  test('filters out items missing required fields', () => {
    const raw = JSON.stringify([
      { file: 'app.js', start_line: 1, end_line: 1, comment: 'Valid comment' },
      { file: 'app.js' },
      { start_line: 5, comment: 'Missing file field' }
    ]);
    const result = parseReview(raw);
    expect(result).toHaveLength(1);
  });

});