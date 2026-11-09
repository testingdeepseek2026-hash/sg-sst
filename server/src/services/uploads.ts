import { mkdir, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

import { genId } from '../lib/utils.js';

const UPLOAD_DIR = join(process.cwd(), 'uploads');

export async function ensureUploadDir() {
  try {
    await mkdir(UPLOAD_DIR, { recursive: true });
  } catch {}
}

export async function saveUploadedFile(
  file: any,
  subdir: string = ''
): Promise<{ url: string; filename: string; size: number }> {
  await ensureUploadDir();

  const targetDir = subdir ? join(UPLOAD_DIR, subdir) : UPLOAD_DIR;
  await mkdir(targetDir, { recursive: true });

  const ext = extname(file.filename) || '.bin';
  const uniqueName = `${genId()}${ext}`;
  const filepath = join(targetDir, uniqueName);

  const buffer = await fileToBuffer(file);
  await writeFile(filepath, buffer);

  const url = `/uploads/${subdir ? subdir + '/' : ''}${uniqueName}`;
  return { url, filename: file.filename, size: buffer.length };
}

async function fileToBuffer(file: any): Promise<Buffer> {
  const chunks: Buffer[] = [];
  const stream = file.file;

  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

export function getUploadDir(): string {
  return UPLOAD_DIR;
}
