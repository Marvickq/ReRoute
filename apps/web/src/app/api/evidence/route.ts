import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import os from "os";
import { storeEvidence } from "@/lib/store";
import { isS3Configured, uploadToS3 } from "@/lib/s3";
import { Evidence } from "@/types";

const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
const ALLOWED_VOICE_TYPES = ["audio/webm", "audio/mp4", "audio/mpeg", "audio/wav", "audio/ogg", "audio/x-wav"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

async function saveFileLocally(filename: string, buffer: Buffer): Promise<string> {
  const primaryDir = path.join(process.cwd(), "uploads");
  const tmpDir = path.join(os.tmpdir(), "uploads");

  try {
    if (!existsSync(primaryDir)) {
      await mkdir(primaryDir, { recursive: true });
    }
    const filePath = path.join(primaryDir, filename);
    await writeFile(filePath, buffer);
    return filePath;
  } catch {
    // Fallback to OS temp directory for read-only serverless environments (e.g. AWS Amplify / Lambda)
    if (!existsSync(tmpDir)) {
      await mkdir(tmpDir, { recursive: true });
    }
    const tmpFilePath = path.join(tmpDir, filename);
    await writeFile(tmpFilePath, buffer);
    return tmpFilePath;
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const lotId = formData.get("lot_id") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File too large. Maximum size is 10MB." }, { status: 400 });
    }

    const isPhoto = ALLOWED_PHOTO_TYPES.includes(file.type);
    const isVoice = ALLOWED_VOICE_TYPES.includes(file.type);

    if (!isPhoto && !isVoice) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type}. Allowed: images (JPEG, PNG, WebP, HEIC) and audio (WebM, MP4, MPEG, WAV, OGG).` },
        { status: 400 }
      );
    }

    const evidenceId = `EVD-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const ext = file.name.split(".").pop() || (isPhoto ? "jpg" : "webm");
    const filename = `${evidenceId}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    // Save locally or in /tmp for serverless runtime
    await saveFileLocally(filename, buffer);

    let s3Url: string | undefined = undefined;
    let s3Key: string | undefined = undefined;

    if (isS3Configured()) {
      try {
        const s3Result = await uploadToS3(filename, buffer, file.type);
        s3Url = s3Result.publicUrl;
        s3Key = s3Result.s3Key;
      } catch (s3Err) {
        console.warn("[S3 Upload Warning] Failed to upload evidence to S3:", s3Err);
      }
    }

    const evidence: Evidence = {
      evidence_id: evidenceId,
      lot_id: lotId || "",
      type: isPhoto ? "photo" : "voice",
      filename,
      original_filename: file.name,
      mime_type: file.type,
      size: file.size,
      url: s3Url || `/uploads/${filename}`,
      s3_key: s3Key,
      created_at: new Date().toISOString(),
    };

    storeEvidence(evidence);

    return NextResponse.json({ evidence }, { status: 201 });
  } catch (error) {
    console.error("Evidence upload error:", error);
    return NextResponse.json(
      { error: "Upload failed: " + (error instanceof Error ? error.message : String(error)) },
      { status: 500 }
    );
  }
}
