import { createApp } from './app';
import { env } from './config/env';
import { logger } from './utils/logger';
import { pool } from './db/client';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`Server listening on port ${env.PORT}`);
});

/**
 * Graceful shutdown on SIGTERM (from process managers like EB, Docker).
 * Give in-flight requests time to finish, then close DB pool cleanly.
 */
async function shutdown(signal: string) {
  logger.info(`Received ${signal}, shutting down gracefully...`);

  server.close(() => {
    logger.info('HTTP server closed.');
  });

  // Close DB pool after HTTP server stops accepting new requests.
  await pool.end();
  logger.info('Postgres pool closed.');

  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));//for process managers like EB, Docker
process.on('SIGINT', () => shutdown('SIGINT'));//for ctrl+c in local dev

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled promise rejection');
});

process.on('uncaughtException', (err) => {
  logger.error({ err }, 'Uncaught exception');
  process.exit(1);
});
