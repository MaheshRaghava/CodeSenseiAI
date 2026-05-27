import logger from './logger.js';

export class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'AppError';
  }
}

export function errorHandler(err, req, res, next) {
  const status = err.statusCode || 500;
  const message = err.message || 'Internal server error';

  logger.error({
    status,
    message,
    stack: err.stack,
    url: req.url,
    method: req.method,
  });

  res.status(status).json({ error: message });
}