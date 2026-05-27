import 'dotenv/config';
import express from 'express';
import webhookRouter from './webhook/router.js';
import { errorHandler } from './utils/errors.js';
import logger from './utils/logger.js';

const app = express();

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ status: 'CodeSenseiAI is running' });
});

app.use('/webhook', webhookRouter);
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});

export default app;