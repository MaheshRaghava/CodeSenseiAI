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

async function postStartComment({ octokit, owner, repo, pull_number }) {
  try {
    const { data } = await octokit.issues.createComment({
      owner,
      repo,
      issue_number: pull_number,
      body: `## 🤖 CodeSenseiAI is reviewing this PR...\n\n> Analyzing code for security vulnerabilities, bugs, and bad practices. Inline comments will appear shortly.\n\n<sub>Powered by Gemini 2.5 Flash</sub>`,
    });
    return data.id;
  } catch (err) {
    logger.warn(`Could not post start comment: ${err.message}`);
    return null;
  }
}

async function updateStartComment({ octokit, owner, repo, commentId, comments }) {
  if (!commentId) return;

  const SEVERITY_EMOJI = { critical:'🔴', major:'🟠', minor:'🟡', style:'🔵' };

  try {
    if (!comments || comments.length === 0) {
      await octokit.issues.updateComment({
        owner,
        repo,
        comment_id: commentId,
        body: `## ✅ CodeSenseiAI Review Complete\n\n**No issues found** — this PR looks clean!\n\n<sub>Powered by Gemini 2.5 Flash</sub>`,
      });
      return;
    }

    const summaryLine = ['critical','major','minor','style']
      .map(s => {
        const count = comments.filter(c => c.severity === s).length;
        return count
          ? `${SEVERITY_EMOJI[s]} ${count} ${s.charAt(0).toUpperCase()+s.slice(1)}`
          : null;
      })
      .filter(Boolean)
      .join(' · ');

    await octokit.issues.updateComment({
      owner,
      repo,
      comment_id: commentId,
      body: `## 🤖 CodeSenseiAI Review Complete\n\n**Summary:** ${summaryLine}\n\n<sub>Powered by Gemini 2.5 Flash</sub>`,
    });
  } catch (err) {
    logger.warn(`Could not update start comment: ${err.message}`);
  }
}

export async function handlePullRequest(payload) {
  const { installation, repository, pull_request } = payload;

  const owner = repository.owner.login;
  const repo = repository.name;
  const pull_number = pull_request.number;
  const installationId = installation.id;

  logger.info(`Handling PR #${pull_number} — "${pull_request.title}"`);

  const octokit = await getInstallationOctokit(installationId);

  // Post "reviewing..."
  const commentId = await postStartComment({ octokit, owner, repo, pull_number });

  const { files } = await getPRDiff({
    installationId,
    owner,
    repo,
    pull_number,
  });

  if (!files || files.length === 0) {
    logger.warn('No files found in PR');
    await updateStartComment({ octokit, owner, repo, commentId, comments: [] });
    return;
  }

  const { positionMap, lineContentMap } = buildDiffMaps(files);
  const structuredDiff = buildStructuredDiff(files, SKIP_FILES);

  if (!structuredDiff || structuredDiff.trim() === '') {
    logger.info('Nothing to review after filtering');
    await updateStartComment({ octokit, owner, repo, commentId, comments: [] });
    return;
  }

  const raw = await analyzeDiff(structuredDiff);
  const comments = parseReview(raw);

  // Update the same comment
  await updateStartComment({ octokit, owner, repo, commentId, comments });

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