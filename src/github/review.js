import { getInstallationOctokit } from './auth.js';
import logger from '../utils/logger.js';

const SEVERITY_EMOJI = {
  critical: '🔴',
  major:    '🟠',
  minor:    '🟡',
  style:    '🔵',
};

function extractRelevantLines(lineContentMap, file, start_line, end_line) {
  const fileMap = lineContentMap?.[file];
  if (!fileMap) return null;

  const blockSize = end_line - start_line + 1;

  if (blockSize <= 10) {
    const lines = [];
    for (let i = start_line; i <= end_line; i++) {
      if (fileMap[i] !== undefined) lines.push(fileMap[i]);
    }
    return lines.length > 0 ? lines.join('\n') : null;

  } else if (blockSize <= 20) {
    const firstLines = [];
    const lastLines = [];
    const omitted = blockSize - 6;

    for (let i = start_line; i <= start_line + 2; i++) {
      if (fileMap[i] !== undefined) firstLines.push(fileMap[i]);
    }
    for (let i = end_line - 2; i <= end_line; i++) {
      if (fileMap[i] !== undefined) lastLines.push(fileMap[i]);
    }

    return [...firstLines, `... ${omitted} lines omitted ...`, ...lastLines].join('\n');

  } else {
    const lines = [];
    const capEnd = start_line + 9;
    const totalLines = end_line - start_line + 1;

    for (let i = start_line; i <= capEnd; i++) {
      if (fileMap[i] !== undefined) lines.push(fileMap[i]);
    }
    lines.push(`... ${totalLines - 10} more lines (showing 10 of ${totalLines}) ...`);
    return lines.join('\n');
  }
}

function buildCommentBody(c, lineContentMap) {
  const emoji = SEVERITY_EMOJI[c.severity] || '🔵';
  const label = c.severity?.charAt(0).toUpperCase() + c.severity?.slice(1);

  let body = `${emoji} **${label} — ${c.category}: ${c.title}**\n\n${c.comment}`;

  const ext = c.file.split('.').pop() || 'js';
  const currentCode = extractRelevantLines(lineContentMap, c.file, c.start_line, c.end_line);

  if (currentCode) {
    const lineRange = c.start_line === c.end_line
      ? `line ${c.start_line}`
      : `lines ${c.start_line}–${c.end_line}`;
    body += `\n\n**Current implementation (${lineRange}):**\n\`\`\`${ext}\n${currentCode}\n\`\`\``;
  }

  if (c.suggestion) {
    const isSingleLine = c.start_line === c.end_line;
    const isStyleFix = c.severity === 'style';

    if (isSingleLine && isStyleFix) {
      body += `\n\n\`\`\`suggestion\n${c.suggestion}\n\`\`\``;
    } else {
      body += `\n\n**Suggested fix:**\n\`\`\`${ext}\n${c.suggestion}\n\`\`\``;
    }
  }

  body += `\n\n<sub>🤖 CodeSenseiAI · Powered by Gemini 2.5 Flash</sub>`;
  return body;
}

export async function postReview({
  installationId,
  owner,
  repo,
  pull_number,
  comments,
  positionMap,
  lineContentMap,
}) {
  const octokit = await getInstallationOctokit(installationId);

  const { data: pr } = await octokit.pulls.get({ owner, repo, pull_number });
  const commitId = pr.head.sha;

  // ============================================================
  // Post summary comment at the top of the PR
  // This appears regardless of whether inline comments succeed
  // ============================================================
  const counts = ['critical', 'major', 'minor', 'style']
    .map(s => {
      const count = comments.filter(c => c.severity === s).length;
      return count ? `${SEVERITY_EMOJI[s]} ${count} ${s.charAt(0).toUpperCase() + s.slice(1)}` : null;
    })
    .filter(Boolean)
    .join(' · ');

  await octokit.issues.createComment({
    owner,
    repo,
    issue_number: pull_number,
    body: `## 🤖 CodeSenseiAI Review Complete\n\n**Summary:** ${counts}\n\n<sub>Powered by Gemini 2.5 Flash</sub>`,
  });

  logger.info(`✅ Posted summary comment on PR #${pull_number} with counts: ${counts}`);

  // ============================================================
  // Continue with inline comments
  // ============================================================

  const validComments = [];
  const skipped = [];

  for (const c of comments) {
    const fileMap = positionMap[c.file];

    if (!fileMap) {
      logger.warn(`File not in position map: ${c.file}`);
      skipped.push(c);
      continue;
    }

    const anchorLine = c.end_line || c.start_line;
    const position = fileMap[anchorLine];

    if (!position) {
      logger.warn(`No position for ${c.file} line ${anchorLine} — skipping to fallback`);
      skipped.push(c);
      continue;
    }

    logger.info(`Mapping ${c.file} line ${anchorLine} → diff position ${position}`);

    validComments.push({
      path: c.file,
      position,
      body: buildCommentBody(c, lineContentMap),
      _original: c,
    });
  }

  // Try batch first — fastest path
  if (validComments.length > 0) {
    try {
      await octokit.pulls.createReview({
        owner,
        repo,
        pull_number,
        commit_id: commitId,
        event: 'COMMENT',
        comments: validComments.map(({ _original, ...rest }) => rest),
      });
      logger.info(`✅ Posted ${validComments.length} inline comments on PR #${pull_number}`);
      return; // success — done
    } catch (batchErr) {
      logger.warn(`Batch inline failed: ${batchErr.message} — trying one by one...`);
    }
  }

  // Batch failed — try each comment individually
  const stillSkipped = [];

  for (const vc of validComments) {
    try {
      await octokit.pulls.createReview({
        owner,
        repo,
        pull_number,
        commit_id: commitId,
        event: 'COMMENT',
        comments: [{ path: vc.path, position: vc.position, body: vc.body }],
      });
      logger.info(`✅ Posted individual comment on ${vc.path} position ${vc.position}`);
    } catch (individualErr) {
      logger.warn(`Individual comment failed for ${vc.path}:${vc.position} — ${individualErr.message}`);
      stillSkipped.push(vc._original);
    }
  }

  // Anything still failing + originally skipped → fallback body comment
  const allSkipped = [...skipped, ...stillSkipped];

  if (allSkipped.length > 0) {
    const fallbackSummaryLine = ['critical', 'major', 'minor', 'style']
      .map(s => {
        const count = allSkipped.filter(c => c.severity === s).length;
        return count
          ? `${SEVERITY_EMOJI[s]} ${count} ${s.charAt(0).toUpperCase() + s.slice(1)}`
          : null;
      })
      .filter(Boolean)
      .join(' · ');

    const body = [
      `## 🤖 CodeSenseiAI Review — Additional Notes`,
      `**Summary:** ${fallbackSummaryLine}`,
      ``,
      `---`,
      ``,
      ...allSkipped.map(c => [
        buildCommentBody(c, lineContentMap),
        `> **File:** \`${c.file}\` · **Lines:** ${c.start_line}–${c.end_line}`,
        ``,
        `---`,
        ``,
      ].join('\n')),
      `<sub>Powered by Gemini 2.5 Flash</sub>`,
    ].join('\n');

    await octokit.issues.createComment({
      owner,
      repo,
      issue_number: pull_number,
      body,
    });

    logger.info(`✅ Posted ${allSkipped.length} fallback comments on PR #${pull_number}`);
  }
}