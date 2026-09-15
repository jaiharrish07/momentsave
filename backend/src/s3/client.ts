import {
  S3Client,
  HeadObjectCommand,
  DeleteObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../config/env";
import { logger } from "../utils/logger";

/**
 * Shared S3 client. Uses IAM user credentials from env.
 * In production on EC2/EB, we could switch to instance profile roles
 * for keyless access — kept keys for simplicity.
 */
export const s3 = new S3Client({
  region: env.AWS_REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  },
});

/**
 * Generate a time-limited presigned URL that lets a client
 * PUT directly to S3 for a specific key + content-type.
 *
 * The client MUST send the exact same Content-Type header on their PUT,
 * or S3 rejects the request. Backend chose the type; client honors it.
 */
export async function generatePresignedUploadUrl(
  key: string,
  contentType: string,
  expiresInSeconds = 300
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: env.S3_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });

  return getSignedUrl(s3, command, { expiresIn: expiresInSeconds });
}

/**
 * Verify an S3 object exists and (optionally) matches an expected size.
 * Returns the size in bytes on success. Returns null if the object doesn't exist.
 * Rethrows any other error (network, auth) so the caller sees it.
 */
export async function headObject(
  key: string
): Promise<{ size: number; contentType?: string } | null> {
  try {
    const response = await s3.send(
      new HeadObjectCommand({
        Bucket: env.S3_BUCKET_NAME,
        Key: key,
      })
    );
    return {
      size: response.ContentLength ?? 0,
      contentType: response.ContentType,
    };
  } catch (err: unknown) {
    // S3 returns 404 as a NotFound error name.
    if (isS3NotFound(err)) {
      return null;
    }
    logger.error({ err, key }, "S3 headObject failed");
    throw err;
  }
}

/**
 * Delete an S3 object. Idempotent — succeeds even if object is already gone.
 */
export async function deleteObject(key: string): Promise<void> {
  await s3.send(
    new DeleteObjectCommand({
      Bucket: env.S3_BUCKET_NAME,
      Key: key,
    })
  );
}

/**
 * Generate a presigned URL for downloading an object.
 * Used by the public gallery module later — not photos directly.
 */
export async function generatePresignedDownloadUrl(
  key: string,
  expiresInSeconds = 3600
): Promise<string> {
  const { GetObjectCommand } = await import("@aws-sdk/client-s3");
  const command = new GetObjectCommand({
    Bucket: env.S3_BUCKET_NAME,
    Key: key,
  });
  return getSignedUrl(s3, command, { expiresIn: expiresInSeconds });
}

function isS3NotFound(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const asObj = err as { name?: unknown; $metadata?: { httpStatusCode?: number } };
  if (asObj.name === "NotFound" || asObj.name === "NoSuchKey") return true;
  if (asObj.$metadata?.httpStatusCode === 404) return true;
  return false;
}
