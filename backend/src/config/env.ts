import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(8080),

  DATABASE_URL: z.string().url(),

  REDIS_URL: z.string().url(),

  AWS_REGION: z.string().min(1),
  AWS_ACCESS_KEY_ID: z.string().min(1),
  AWS_SECRET_ACCESS_KEY: z.string().min(1),
  S3_BUCKET_NAME: z.string().min(1),

  SESSION_COOKIE_SECRET: z.string().min(32, {
    message: 'SESSION_COOKIE_SECRET must be at least 32 characters',
  }),
  SESSION_COOKIE_NAME: z.string().min(1),
  GALLERY_SESSION_COOKIE_NAME: z.string().min(1),

  FRONTEND_URL: z.string().url(),

  BCRYPT_COST: z.coerce.number().int().min(10).max(15).default(12),
  PIN_LENGTH: z.coerce.number().int().min(4).max(10).default(6),
  MAX_FILE_SIZE_BYTES: z.coerce.number().int().positive().default(20 * 1024 * 1024),
});

const parseResult = envSchema.safeParse(process.env);

if (!parseResult.success) {
  console.error('Invalid environment configuration:');
  for (const issue of parseResult.error.issues) {
    console.error('  - ' + issue.path.join('.') + ': ' + issue.message);
  }
  process.exit(1);
}

export const env = parseResult.data;
export type Env = z.infer<typeof envSchema>;
