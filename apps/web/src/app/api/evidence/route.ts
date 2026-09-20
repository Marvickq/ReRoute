import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { storeEvidence } from "@/lib/store";
import { Evidence } from "@/types";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");
const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
const ALLOWED_VOICE_TYPES = ["audio/webm", "audio/mp4", "audio/mpeg", "audio/wav", "audio/ogg", "audio/x-wav"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

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

    const PUBLIC_UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
    if (!existsSync(UPLOAD_DIR)) {
      await mkdir(UPLOAD_DIR, { recursive: true });
    }
    if (!existsSync(PUBLIC_UPLOAD_DIR)) {
      await mkdir(PUBLIC_UPLOAD_DIR, { recursive: true });
    }

    const evidenceId = `EVD-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const ext = file.name.split(".").pop() || (isPhoto ? "jpg" : "webm");
    const filename = `${evidenceId}.${ext}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(UPLOAD_DIR, filename), buffer);
    try {
      await writeFile(path.join(PUBLIC_UPLOAD_DIR, filename), buffer);
    } catch {
      // ignore public directory copy errors if permissions restricted
    }

    const evidence: Evidence = {
      evidence_id: evidenceId,
      lot_id: lotId || "",
      type: isPhoto ? "photo" : "voice",
      filename,
      original_filename: file.name,
      mime_type: file.type,
      size: file.size,
      url: `/uploads/${filename}`,
      created_at: new Date().toISOString(),
    };

    storeEvidence(evidence);

    return NextResponse.json({ evidence }, { status: 201 });
  } catch (error) {
    console.error("Evidence upload error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
