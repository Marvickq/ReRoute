import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import os from "os";
import { isS3Configured } from "@/lib/s3";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

function getMimeType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "webm":
      return "audio/webm";
    case "mp3":
      return "audio/mpeg";
    case "wav":
      return "audio/wav";
    case "ogg":
      return "audio/ogg";
    case "m4a":
    case "mp4":
      return "audio/mp4";
    default:
      return "application/octet-stream";
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;
    if (!filename || filename.includes("..")) {
      return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
    }

    const mimeType = getMimeType(filename);
    let buffer: Buffer | null = null;

    // 1. Try process.cwd()/uploads
    try {
      const primaryPath = path.join(process.cwd(), "uploads", filename);
      buffer = await readFile(primaryPath);
    } catch {
      // ignore
    }

    // 2. Try os.tmpdir()/uploads
    if (!buffer) {
      try {
        const tmpPath = path.join(os.tmpdir(), "uploads", filename);
        buffer = await readFile(tmpPath);
      } catch {
        // ignore
      }
    }

    // 3. Try S3 if configured and file not local
    if (!buffer && isS3Configured()) {
      try {
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

        const s3Client = new S3Client({
          region,
          credentials: { accessKeyId, secretAccessKey },
        });

        // Search for matching key in evidence/ folder or exact filename
        const s3Key = filename.includes("/") ? filename : `evidence/${filename}`;
        const command = new GetObjectCommand({ Bucket: bucketName, Key: s3Key });
        const s3Response = await s3Client.send(command);

        if (s3Response.Body) {
          const byteArray = await s3Response.Body.transformToByteArray();
          buffer = Buffer.from(byteArray);
        }
      } catch (s3Err) {
        console.warn("[Upload Stream] Failed to fetch from S3:", s3Err);
      }
    }

    if (!buffer) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const headers = new Headers();
    headers.set("Content-Type", mimeType);
    headers.set("Content-Length", buffer.length.toString());
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
    headers.set("Accept-Ranges", "bytes");

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("Error serving upload file:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
