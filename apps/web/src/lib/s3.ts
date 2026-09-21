import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function getS3Config() {
  const accessKeyId =
    process.env.REROUTE_AWS_ACCESS_KEY_ID ||
    process.env.MY_AWS_ACCESS_KEY_ID ||
    process.env.AWS_ACCESS_KEY_ID ||
    "";
  const secretAccessKey =
    process.env.REROUTE_AWS_SECRET_ACCESS_KEY ||
    process.env.MY_AWS_SECRET_ACCESS_KEY ||
    process.env.AWS_SECRET_ACCESS_KEY ||
    "";
  const region =
    process.env.REROUTE_AWS_REGION ||
    process.env.MY_AWS_REGION ||
    process.env.AWS_REGION ||
    "us-east-1";
  const bucketName =
    process.env.REROUTE_AWS_S3_BUCKET_NAME ||
    process.env.MY_AWS_S3_BUCKET_NAME ||
    process.env.AWS_S3_BUCKET_NAME ||
    "reroute-evidence-storage";

  return { accessKeyId, secretAccessKey, region, bucketName };
}

export function isS3Configured(): boolean {
  const { accessKeyId, secretAccessKey } = getS3Config();
  return !!(accessKeyId && secretAccessKey);
}

let s3ClientInstance: S3Client | null = null;

function getS3Client(): S3Client {
  const { accessKeyId, secretAccessKey, region } = getS3Config();
  if (!s3ClientInstance) {
    s3ClientInstance = new S3Client({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }
  return s3ClientInstance;
}

/**
 * Uploads evidence file (photo or audio) to Amazon S3
 */
export async function uploadToS3(
  filename: string,
  buffer: Buffer,
  contentType: string
): Promise<{ s3Key: string; bucket: string; s3Uri: string; publicUrl: string }> {
  const { region, bucketName } = getS3Config();
  const s3Key = `evidence/${Date.now()}-${filename}`;
  const client = getS3Client();

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: s3Key,
    Body: buffer,
    ContentType: contentType,
  });

  await client.send(command);

  const s3Uri = `s3://${bucketName}/${s3Key}`;
  const publicUrl = `https://${bucketName}.s3.${region}.amazonaws.com/${s3Key}`;

  return { s3Key, bucket: bucketName, s3Uri, publicUrl };
}

/**
 * Generates a pre-signed URL for temporary secure access to an S3 object
 */
export async function getS3PresignedUrl(s3Key: string, expiresInSeconds = 3600): Promise<string> {
  const { bucketName } = getS3Config();
  const client = getS3Client();
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: s3Key,
  });

  return await getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}

/**
 * Fetches object from Amazon S3 directly as a Buffer
 */
export async function fetchFromS3(s3Key: string): Promise<Buffer | null> {
  if (!isS3Configured()) return null;
  try {
    const { bucketName } = getS3Config();
    const client = getS3Client();
    const key = s3Key.includes("/") ? s3Key : `evidence/${s3Key}`;
    const command = new GetObjectCommand({ Bucket: bucketName, Key: key });
    const response = await client.send(command);
    if (response.Body) {
      const byteArray = await response.Body.transformToByteArray();
      return Buffer.from(byteArray);
    }
  } catch (err) {
    console.warn("[S3 Fetch Warning] Could not fetch key from S3:", s3Key, err);
  }
  return null;
}
