import { Router } from 'express';
import { verifySignature } from './verify.js';
import { handlePullRequest } from './handlers/index.js';
import logger from '../utils/logger.js';

const router = Router();

router.post('/', verifySignature, async (req, res) => {
  const event = req.headers['x-github-event'];
  const action = req.body.action;

  logger.info(`Received event: ${event} / action: ${action}`);

  // ✅ Respond to GitHub immediately — never let GitHub wait
  // GitHub has a 10 second timeout. If we await Gemini first,
  // slow responses or retries will cause GitHub to mark delivery as failed.
  res.status(200).json({ received: true });

  // Process in background after response is sent
  if (event === 'pull_request' && action === 'opened') {
    handlePullRequest(req.body).catch(err => {
      logger.error({ message: err.message, stack: err.stack }, 'Unhandled error in handlePullRequest');
    });
  }
});

export default router;