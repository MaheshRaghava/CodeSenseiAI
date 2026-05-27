import { GoogleGenerativeAI } from '@google/generative-ai';
import { REVIEW_PROMPT } from './prompts.js';
import logger from '../utils/logger.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function generateWithBackoff(model, prompt, retries = 3, delay = 1000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await model.generateContent(prompt);
    } catch (err) {
      const is503 =
        err.message.includes('503') ||
        err.message.includes('Service Unavailable') ||
        err.message.includes('high demand');

      if (is503 && attempt < retries) {
        logger.warn(`Gemini 503 on attempt ${attempt}/${retries}. Retrying in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
        delay *= 2;
        continue;
      }
      throw err;
    }
  }
}

async function callGemini(modelName, structuredDiff, retries = 3, delay = 1000) {
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: REVIEW_PROMPT,
  });

  const result = await generateWithBackoff(
    model,
    `Review the following code. Line numbers are exact — use them as-is:\n\n${structuredDiff}`,
    retries,
    delay
  );

  return result.response.text();
}

export async function analyzeDiff(structuredDiff) {
  if (!structuredDiff || structuredDiff.trim() === '') {
    logger.info('Empty diff after filtering — nothing to review');
    return '[]';
  }

  logger.info('Sending structured diff to Gemini...');

  try {
    const raw = await callGemini('gemini-2.5-flash', structuredDiff);
    logger.info('=== RAW GEMINI RESPONSE ===');
    logger.info(raw);
    logger.info('=== END GEMINI RESPONSE ===');
    return raw;
  } catch (primaryErr) {
    logger.warn(`Primary model failed: ${primaryErr.message}`);
    try {
      const raw = await callGemini('gemini-1.5-flash', structuredDiff, 2, 500);
      logger.info('=== RAW GEMINI RESPONSE (fallback) ===');
      logger.info(raw);
      return raw;
    } catch (fallbackErr) {
      logger.error(`Both models failed: ${fallbackErr.message}`);
      return '[]';
    }
  }
}