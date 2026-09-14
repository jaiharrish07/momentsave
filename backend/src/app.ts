import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import { env } from './config/env';
import { logger } from './utils/logger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { attachUser } from './middleware/auth';
import { authRouter } from './modules/auth/auth.routes';

export function createApp(): Application {
  const app = express();

  app.use(pinoHttp({ logger }));

  app.use(
    cors({
      origin: env.FRONTEND_URL,
      credentials: true,
    })
  );

  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  // Attach req.user if a valid session cookie is present.
  app.use(attachUser);

  // Health check — public, no DB.
  app.get('/health', (req: Request, res: Response) => {
    res.json({ ok: true, uptime: process.uptime() });
  });

  // API routes.
  app.use('/api/auth', authRouter);

  // 404 + error handler must come last.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
