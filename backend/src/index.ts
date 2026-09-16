import { createApp } from './app';
import { env } from './config/env';
import { logger } from './utils/logger';
import { pool } from './db/client';
import { redis } from './redis/client';
import { startCleanupJob } from './jobs/cleanupPendingPhotos';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`Server listening on port ${env.PORT}`);
});

const cleanupInterval = startCleanupJob();

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'Shutting down');
  clearInterval(cleanupInterval);

  server.close(async () => {
    try {
      await pool.end();
      await redis.quit();
      logger.info('Shutdown complete');
      process.exit(0);
    } catch (err) {
      logger.error({ err }, 'Shutdown error');
      process.exit(1);
    }
  });

  setTimeout(() => {
    logger.error('Forced exit after 10s timeout');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
