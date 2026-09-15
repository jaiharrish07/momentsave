import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import { env } from './config/env';
import { logger } from './utils/logger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { attachUser } from './middleware/auth';
import { authRouter } from './modules/auth/auth.routes';
import { usersRouter } from './modules/users/users.routes';
import { eventsRouter } from './modules/events/events.routes';
import { eventPhotosRouter, photosRouter } from './modules/photos/photos.routes';

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
  app.use(attachUser);

  app.get('/health', (req: Request, res: Response) => {
    res.json({ ok: true, uptime: process.uptime() });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/team-members', usersRouter);
  app.use('/api/events', eventsRouter);

  // Event-scoped photo routes: /api/events/:eventId/photos/...
  app.use('/api/events/:eventId/photos', eventPhotosRouter);

  // Photo-scoped routes: /api/photos/:photoId/...
  app.use('/api/photos', photosRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
