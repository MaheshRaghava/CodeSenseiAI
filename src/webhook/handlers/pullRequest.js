import { getPRDiff } from '../../github/diff.js';
import { buildStructuredDiff, buildDiffMaps } from '../../github/diffParser.js';
import { analyzeDiff } from '../../llm/analyze.js';
import { parseReview } from '../../llm/parse.js';
import { postReview } from '../../github/review.js';
import { getInstallationOctokit } from '../../github/auth.js';
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

async function postStartComment({ installationId, owner, repo, pull_number }) {
  try {
    const octokit = await getInstallationOctokit(installationId);
    await octokit.issues.createComment({
      owner,
      repo,
      issue_number: pull_number,
      body: `## 🤖 CodeSenseiAI is reviewing this PR...\n\n> Analyzing code for security vulnerabilities, bugs, and bad practices. Results will appear as inline comments in a few seconds.\n\n<sub>Powered by Gemini 2.5 Flash</sub>`,
    });
  } catch (err) {
    // Non-critical — don't let this block the actual review
    logger.warn(`Could not post start comment: ${err.message}`);
  }
}

export async function handlePullRequest(payload) {
  const { installation, repository, pull_request } = payload;

  const owner = repository.owner.login;
  const repo = repository.name;
  const pull_number = pull_request.number;
  const installationId = installation.id;

  logger.info(`Handling PR #${pull_number} — "${pull_request.title}"`);

  // Post immediately
  await postStartComment({ installationId, owner, repo, pull_number });

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

  const { positionMap, lineContentMap } = buildDiffMaps(files);
  const structuredDiff = buildStructuredDiff(files, SKIP_FILES);

  if (!structuredDiff || structuredDiff.trim() === '') {
    logger.info('Nothing to review after filtering');
    return;
  }

  const raw = await analyzeDiff(structuredDiff);
  const comments = parseReview(raw);

  if (comments.length === 0) {
    logger.info('No issues found — PR looks clean');

    // Update the start comment to show clean result
    try {
      const octokit = await getInstallationOctokit(installationId);
      await octokit.issues.createComment({
        owner,
        repo,
        issue_number: pull_number,
        body: `## ✅ CodeSenseiAI Review Complete\n\n**No issues found** — this PR looks clean!\n\n<sub>Powered by Gemini 2.5 Flash</sub>`,
      });
    } catch (err) {
      logger.warn(`Could not post clean comment: ${err.message}`);
    }

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