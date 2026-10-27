import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import os from "os";

/** Saves under ./uploads, falling back to the OS temp dir on read-only serverless runtimes. */
export async function saveFileLocally(filename: string, buffer: Buffer): Promise<string> {
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
    if (!existsSync(tmpDir)) {
      await mkdir(tmpDir, { recursive: true });
    }
    const tmpFilePath = path.join(tmpDir, filename);
    await writeFile(tmpFilePath, buffer);
    return tmpFilePath;
  }
}
