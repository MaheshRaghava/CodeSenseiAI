import { createAppAuth } from '@octokit/auth-app';
import { Octokit } from '@octokit/rest';

export async function getInstallationOctokit(installationId) {
  const auth = createAppAuth({
    appId: process.env.GITHUB_APP_ID,
    privateKey: process.env.GITHUB_PRIVATE_KEY.replace(/\\n/g, '\n'),
    installationId,
  });

  const { token } = await auth({ type: 'installation' });

  console.log('Installation token generated:', token.slice(0, 10) + '...');

  const octokit = new Octokit({ auth: token });
  return octokit;
}