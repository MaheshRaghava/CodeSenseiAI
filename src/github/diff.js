import { getInstallationOctokit } from './auth.js';
import logger from '../utils/logger.js';

export async function getPRDiff({ installationId, owner, repo, pull_number }) {
  const octokit = await getInstallationOctokit(installationId);

  const { data: files } = await octokit.pulls.listFiles({
    owner,
    repo,
    pull_number,
  });

  const diff = files
    .filter(file => file.patch)
    .map(file => `File: ${file.filename}\n${file.patch}`)
    .join('\n\n---\n\n');

  logger.info('=== PR DIFF ===');
  logger.info(diff);
  logger.info('=== END DIFF ===');

  return { diff, files };
}