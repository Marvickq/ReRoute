import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const REGION = process.env.AWS_REGION || "us-east-1";
const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || "reroute-evidence-storage";

export function isS3Configured(): boolean {
  return !!(
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY &&
    process.env.AWS_S3_BUCKET_NAME
  );
}

let s3ClientInstance: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3ClientInstance) {
    s3ClientInstance = new S3Client({
      region: REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
      },
    });
  }
  return s3ClientInstance;
}

/**
 * Uploads evidence file (photo or audio) to Amazon S3
 * @param filename File name / key to store in S3
 * @param buffer File buffer
 * @param contentType MIME content type (e.g., 'image/jpeg', 'audio/wav')
 * @returns Object containing s3Key, bucket, and public/s3 URI
 */
export async function uploadToS3(
  filename: string,
  buffer: Buffer,
  contentType: string
): Promise<{ s3Key: string; bucket: string; s3Uri: string; publicUrl: string }> {
  const s3Key = `evidence/${Date.now()}-${filename}`;
  const client = getS3Client();

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: s3Key,
    Body: buffer,
    ContentType: contentType,
  });

  await client.send(command);

  const s3Uri = `s3://${BUCKET_NAME}/${s3Key}`;
  const publicUrl = `https://${BUCKET_NAME}.s3.${REGION}.amazonaws.com/${s3Key}`;

  return { s3Key, bucket: BUCKET_NAME, s3Uri, publicUrl };
}

/**
 * Generates a pre-signed URL for temporary secure access to an S3 object
 */
export async function getS3PresignedUrl(s3Key: string, expiresInSeconds = 3600): Promise<string> {
  const client = getS3Client();
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: s3Key,
  });

  return await getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}
