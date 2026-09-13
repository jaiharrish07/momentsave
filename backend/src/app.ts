import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import { env } from './config/env';
import { logger } from './utils/logger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

export function createApp(): Application {
  const app = express();

  // Log every request (structured JSON in prod, pretty in dev).
  app.use(pinoHttp({ logger }));

  // CORS: allow the frontend origin, with credentials so session cookies flow.
  app.use(
    cors({
      origin: env.FRONTEND_URL,
      credentials: true,
    })
  );

  // Parse JSON bodies. 100kb is enough for our request payloads
  // (photo uploads go direct to S3, not through us).
  app.use(express.json({ limit: '100kb' }));

  // Parse cookies so req.cookies is available in auth middleware.
  app.use(cookieParser());

  // Health check — no auth, no DB, just proves the process is up.
  app.get('/health', (req: Request, res: Response) => {
    res.json({ ok: true, uptime: process.uptime() });
  });

  // API routes will be mounted here in the next iteration.
  // app.use('/api/auth', authRouter);
  // app.use('/api/events', eventsRouter);
  // ...

  // 404 for anything not matched above.
  app.use(notFoundHandler);

  // Error handler must be LAST.
  app.use(errorHandler);

  return app;
}
