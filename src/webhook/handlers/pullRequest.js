import { getPRDiff } from '../../github/diff.js';
import { buildStructuredDiff, buildDiffMaps } from '../../github/diffParser.js';
import { analyzeDiff } from '../../llm/analyze.js';
import { parseReview } from '../../llm/parse.js';
import { postReview } from '../../github/review.js';
import logger from '../../utils/logger.js';

const SKIP_FILES = [
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'bun.lockb',
  '.gitignore',
  '.env.example',
  'README.md',
];

export async function handlePullRequest(payload) {
  const { installation, repository, pull_request } = payload;

  const owner = repository.owner.login;
  const repo = repository.name;
  const pull_number = pull_request.number;
  const installationId = installation.id;

  logger.info(`Handling PR #${pull_number} — "${pull_request.title}"`);

  const { files } = await getPRDiff({
    installationId,
    owner,
    repo,
    pull_number,
  });

  if (!files || files.length === 0) {
    logger.warn('No files found in PR');
    return;
  }

  // Build exact position map AND line content map from the diff
  const { positionMap, lineContentMap } = buildDiffMaps(files);

  // Build numbered diff string for Gemini — exact line numbers, no guessing
  const structuredDiff = buildStructuredDiff(files, SKIP_FILES);

  if (!structuredDiff || structuredDiff.trim() === '') {
    logger.info('Nothing to review after filtering');
    return;
  }

  const raw = await analyzeDiff(structuredDiff);
  const comments = parseReview(raw);

  if (comments.length === 0) {
    logger.info('No issues found — PR looks clean');
    return;
  }

  await postReview({
    installationId,
    owner,
    repo,
    pull_number,
    comments,
    positionMap,
    lineContentMap,
  });
}