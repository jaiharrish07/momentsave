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
import { photosRouter } from './modules/photos/photos.routes';
import { galleriesRouter } from './modules/galleries/galleries.routes';
import { publicGalleryRouter } from './modules/public-gallery/public.routes';

export function createApp(): Application {
  const app = express();

  // Behind CloudFront + EB — trust proxy so req.ip and X-Forwarded-For resolve.
  app.set('trust proxy', true);

  app.use(pinoHttp({ logger }));

    const allowedOrigins = [
    env.FRONTEND_URL,
    "http://localhost:3000",
  ];

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        // Also allow any Vercel preview URL for this project
        if (/^https:\/\/momentsave-.*\.vercel\.app$/.test(origin)) {
          return callback(null, true);
        }
        callback(new Error("Not allowed by CORS"));
      },
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
  app.use('/api/photos', photosRouter);
  app.use('/api/galleries', galleriesRouter);
  app.use('/api/public/galleries', publicGalleryRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
