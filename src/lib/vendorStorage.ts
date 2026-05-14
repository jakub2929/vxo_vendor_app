// Vendor file storage — avatar + documents (COI, W-9).
//
// Buckets and policies are defined in
// supabase/schema/add-vendor-documents-avatars.sql:
//   vendor-avatars     — public read, own-folder write (2 MB, jpeg/png)
//   vendor-documents   — own-folder read+write (10 MB, jpeg/png/pdf)
//
// Path convention: {vendor_id}/{kind} with NO file extension. Content-type is
// stored on the Storage object metadata at upload. This keeps "replace"
// idempotent across format changes (jpg → png never orphans the old object).
//
// vendors.avatar_path / coi_path / w9_path store the path; URLs are
// constructed on demand (public for avatars, signed for documents).
//
// All thrown errors are UploadError with a typed `code` field — see
// uploadError.ts. Call sites map the code to user-facing Alert copy via
// alertCopyFor(); they should never inspect raw Supabase error strings.
import { supabase } from './supabase';
import {
  type FileKind,
  translateNetworkError,
  translateSupabaseStorageError,
  UploadError,
} from './uploadError';

const AVATAR_BUCKET = 'vendor-avatars';
const DOCUMENT_BUCKET = 'vendor-documents';

// iPhone camera photos at full quality run 3–7 MB (12 MP) or higher on 48 MP
// Pro models. 2 MB was too tight for native camera output, so the avatar
// limit matches documents at 10 MB. Server bucket has the same cap (see
// supabase/schema/add-vendor-documents-avatars.sql Section 5).
const AVATAR_MAX_BYTES = 10 * 1024 * 1024;
const DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;

const AVATAR_MIME_TYPES = ['image/jpeg', 'image/png'] as const;
const DOCUMENT_MIME_TYPES = ['image/jpeg', 'image/png', 'application/pdf'] as const;

const SIGNED_URL_EXPIRES_SECONDS = 3600;

export type DocumentKind = 'coi' | 'w9';

function limitsFor(kind: FileKind): {
  maxBytes: number;
  allowedMimeTypes: readonly string[];
} {
  if (kind === 'avatar') {
    return { maxBytes: AVATAR_MAX_BYTES, allowedMimeTypes: AVATAR_MIME_TYPES };
  }
  return { maxBytes: DOCUMENT_MAX_BYTES, allowedMimeTypes: DOCUMENT_MIME_TYPES };
}

// Pre-upload validation, callable from picker callbacks so we reject bad
// files at the moment of selection rather than at submit time. Returns null
// if the asset is acceptable; otherwise a typed UploadError to alert on.
//
// `fileSize` may be undefined when the picker didn't report it (Android
// camera in some cases). When unknown, we skip the size check and trust the
// server bucket limit as a backstop. mimeType missing is strict-reject — see
// the picker callback comments.
export function validateAsset(
  kind: FileKind,
  mimeType: string | null | undefined,
  fileSize: number | null | undefined,
): UploadError | null {
  const { maxBytes, allowedMimeTypes } = limitsFor(kind);

  if (!mimeType || !allowedMimeTypes.includes(mimeType)) {
    return new UploadError('WRONG_FILE_TYPE', mimeType ?? 'unknown');
  }
  if (typeof fileSize === 'number' && fileSize > maxBytes) {
    return new UploadError(
      'FILE_TOO_LARGE',
      `${(fileSize / 1024 / 1024).toFixed(1)} MB > ${maxBytes / 1024 / 1024} MB`,
    );
  }
  return null;
}

// React Native fetch(file://...) returns the local file's bytes. ArrayBuffer
// is what supabase-js accepts on RN — Blob is patchy across RN versions.
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

async function uploadToBucket(
  bucket: string,
  path: string,
  buffer: ArrayBuffer,
  contentType: string,
): Promise<void> {
  let result;
  try {
    result = await supabase.storage
      .from(bucket)
      .upload(path, buffer, { contentType, upsert: true });
  } catch (err) {
    throw translateNetworkError(err);
  }
  if (result.error) {
    throw translateSupabaseStorageError(result.error);
  }
}

export async function uploadVendorAvatar(
  vendorId: string,
  localUri: string,
  contentType: string,
  fileSize?: number,
): Promise<string> {
  const pre = validateAsset('avatar', contentType, fileSize);
  if (pre) throw pre;

  const buffer = await readLocalAsArrayBuffer(localUri);
  if (buffer.byteLength > AVATAR_MAX_BYTES) {
    throw new UploadError(
      'FILE_TOO_LARGE',
      `${(buffer.byteLength / 1024 / 1024).toFixed(1)} MB`,
    );
  }

  const path = `${vendorId}/avatar`;
  await uploadToBucket(AVATAR_BUCKET, path, buffer, contentType);
  return path;
}

export async function uploadVendorDocument(
  vendorId: string,
  kind: DocumentKind,
  localUri: string,
  contentType: string,
  fileSize?: number,
): Promise<string> {
  const pre = validateAsset(kind, contentType, fileSize);
  if (pre) throw pre;

  const buffer = await readLocalAsArrayBuffer(localUri);
  if (buffer.byteLength > DOCUMENT_MAX_BYTES) {
    throw new UploadError(
      'FILE_TOO_LARGE',
      `${(buffer.byteLength / 1024 / 1024).toFixed(1)} MB`,
    );
  }

  const path = `${vendorId}/${kind}`;
  await uploadToBucket(DOCUMENT_BUCKET, path, buffer, contentType);
  return path;
}

export function getVendorAvatarUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  // Public bucket — synchronous URL construction, no network call.
  return supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path).data.publicUrl;
}

// Signed URLs expire — fetch lazily on view, don't cache aggressively.
// downloadName lets the browser suggest a filename even though the stored
// object has no extension (e.g. createSignedUrl(..., { download: 'coi.pdf' })).
export async function getVendorDocumentSignedUrl(
  path: string | null | undefined,
  downloadName?: string,
): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from(DOCUMENT_BUCKET)
    .createSignedUrl(path, SIGNED_URL_EXPIRES_SECONDS, {
      download: downloadName,
    });
  if (error) {
    console.warn('[vendorStorage] signed URL failed', error);
    return null;
  }
  return data?.signedUrl ?? null;
}
