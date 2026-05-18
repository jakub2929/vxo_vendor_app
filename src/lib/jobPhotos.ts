// Job-completion photo upload — Storage bucket `job-photos`.
//
// Pattern mirrors lib/vendorStorage.ts (validate → read → uploadToBucket →
// throw UploadError) with two deliberate differences for the photo flow:
//
//   1. Client-side compression via expo-image-manipulator. Vendor doc flow
//      uploads raw because COI / W-9 PDFs and avatars are taken once at
//      onboarding. Completion photos are 4–12 MP iPhone shots taken on cell
//      networks, often 5 at a time — uploading raw blows the 10 MB cap and
//      tanks the experience. Resize to 1920px wide, JPEG @ 0.8 quality →
//      typical output 300–800 KB.
//   2. Path includes a unique filename per upload (timestamp + nonce), not a
//      fixed slot like vendor docs. Five photos per job means five distinct
//      objects under {job_id}/, not five upsert-overwrites of one path.
//
// Server-side: bucket constraints (10 MB cap, JPEG/PNG/WEBP allowlist) and
// RLS (vendor → own assigned jobs only) live in
// supabase/migrations/004_storage_realtime.sql +
// supabase/schema/add-job-photos-storage.sql.
import * as ImageManipulator from 'expo-image-manipulator';
import { supabase } from './supabase';
import {
  translateNetworkError,
  translateSupabaseStorageError,
  UploadError,
} from './uploadError';

const BUCKET = 'job-photos';

// Server bucket cap is 10 MB; we compress well below this. Anything larger
// after compression points at a corrupt or non-image asset.
const MAX_BYTES = 10 * 1024 * 1024;

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

// Resize target: anything above 1920px wide is wasted on a phone screen and
// not useful for a completion-photo "I did the work" record. Keeps aspect
// ratio (only width is constrained).
const RESIZE_MAX_WIDTH = 1920;
const JPEG_QUALITY = 0.8;

// Compressed output is always JPEG — even PNG/WEBP inputs are normalized.
// The bucket allows all three mime types in case a future flow wants to
// upload as-is; for the current Mark-Complete flow we always re-encode.
const OUTPUT_MIME = 'image/jpeg';
const OUTPUT_EXT = 'jpg';

export type UploadJobPhotoResult = { path: string };

// React Native's `fetch(file://...)` returns the local file bytes. ArrayBuffer
// is what supabase-js accepts on RN — Blob is patchy across RN versions.
// (Duplicated from vendorStorage.ts intentionally: the helper there is
// module-private, and we'd rather not export it just to share two functions.)
async function readLocalAsArrayBuffer(uri: string): Promise<ArrayBuffer> {
  let response: Response;
  try {
    response = await fetch(uri);
  } catch (err) {
    throw translateNetworkError(err);
  }
  if (!response.ok) {
    throw new UploadError(
      'UPLOAD_FAILED',
      `Failed to read local file (${response.status})`,
    );
  }
  try {
    return await response.arrayBuffer();
  } catch (err) {
    throw translateNetworkError(err);
  }
}

function generatePhotoFilename(): string {
  // Timestamp + 6-char nonce. Collision-free across the 5-photo cap and
  // sortable by capture order if anyone scans the bucket directly.
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return `photo-${ts}-${rand}.${OUTPUT_EXT}`;
}

// Pre-upload validation — call from picker callbacks to reject bad files at
// selection time rather than after a wasted compression round. Returns null
// on success; throws UploadError on failure for parity with vendorStorage.
function validateBeforeCompress(
  mimeType: string | null | undefined,
  fileSize: number | null | undefined,
): void {
  if (!mimeType || !(ALLOWED_MIME_TYPES as readonly string[]).includes(mimeType)) {
    throw new UploadError('WRONG_FILE_TYPE', mimeType ?? 'unknown');
  }
  // Hard reject anything above 50 MB pre-compress — that's almost certainly a
  // RAW or video misroute. Otherwise let the manipulator try; iPhone Pro
  // 48 MP HEIC frames can hit ~12 MB and compress fine.
  if (typeof fileSize === 'number' && fileSize > 50 * 1024 * 1024) {
    throw new UploadError(
      'FILE_TOO_LARGE',
      `${(fileSize / 1024 / 1024).toFixed(1)} MB`,
    );
  }
}

async function compress(uri: string): Promise<{ uri: string }> {
  try {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: RESIZE_MAX_WIDTH } }],
      { compress: JPEG_QUALITY, format: ImageManipulator.SaveFormat.JPEG },
    );
    return { uri: result.uri };
  } catch (err) {
    throw new UploadError(
      'UPLOAD_FAILED',
      err instanceof Error ? err.message : 'Compression failed',
    );
  }
}

async function uploadToBucket(
  path: string,
  buffer: ArrayBuffer,
  contentType: string,
): Promise<void> {
  let result;
  try {
    result = await supabase.storage
      .from(BUCKET)
      .upload(path, buffer, { contentType, upsert: false });
  } catch (err) {
    throw translateNetworkError(err);
  }
  if (result.error) {
    throw translateSupabaseStorageError(result.error);
  }
}

// Uploads one photo for a job and returns the Storage path on success
// (e.g. "a1234567-0000-4000-8000-000000000001/photo-1730000000000-abc123.jpg").
//
// Throws UploadError on any failure — caller maps to user-facing copy via
// alertCopyFor(error.code, 'job-photo', error.detail).
export async function uploadJobPhoto(
  jobId: string,
  localUri: string,
  contentType: string,
  fileSize?: number,
): Promise<UploadJobPhotoResult> {
  validateBeforeCompress(contentType, fileSize);

  const compressed = await compress(localUri);
  const buffer = await readLocalAsArrayBuffer(compressed.uri);

  if (buffer.byteLength > MAX_BYTES) {
    throw new UploadError(
      'FILE_TOO_LARGE',
      `${(buffer.byteLength / 1024 / 1024).toFixed(1)} MB after compression`,
    );
  }

  const path = `${jobId}/${generatePhotoFilename()}`;
  await uploadToBucket(path, buffer, OUTPUT_MIME);
  return { path };
}

// Best-effort cleanup when the vendor removes a thumbnail before tapping
// Mark Complete. Storage RLS (vendor_delete_own_job_photos) scopes this to
// {job_id}/ folders the vendor owns. Silent on failure: removing a tile is a
// UX nicety, not a correctness guarantee — leftover orphans can be swept by
// a cron later if it ever becomes an issue.
export async function deleteJobPhoto(path: string): Promise<void> {
  try {
    await supabase.storage.from(BUCKET).remove([path]);
  } catch {
    // intentionally silent
  }
}
