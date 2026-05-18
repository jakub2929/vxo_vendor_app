// Typed error for vendor file uploads. Surfaces a stable `code` field so call
// sites can map to user-facing Alert copy without scraping raw error strings.
//
// Error sources translated into UploadError:
//   - Client validation (MIME / size mismatch caught before the network call)
//   - Supabase Storage server response (413 / 415 / 401 / 403, etc.)
//   - React Native fetch failures (filesystem read, offline, server down)

export type UploadErrorCode =
  | 'FILE_TOO_LARGE'
  | 'WRONG_FILE_TYPE'
  | 'PERMISSION_DENIED'
  | 'NETWORK_ERROR'
  | 'UPLOAD_FAILED';

export type FileKind = 'avatar' | 'coi' | 'w9' | 'job-photo';

export class UploadError extends Error {
  readonly code: UploadErrorCode;
  readonly detail?: string;

  constructor(code: UploadErrorCode, detail?: string) {
    super(`${code}${detail ? `: ${detail}` : ''}`);
    this.name = 'UploadError';
    this.code = code;
    this.detail = detail;
  }
}

// Substring match against Supabase Storage error messages. Message strings
// drift across server versions, so we match conservatively and fall back to
// UPLOAD_FAILED with the raw detail attached for unknown cases.
export function translateSupabaseStorageError(err: {
  message?: string;
  statusCode?: string | number;
  name?: string;
}): UploadError {
  const msg = (err.message ?? '').toLowerCase();
  const status = String(err.statusCode ?? '');

  if (
    status === '413' ||
    msg.includes('payload too large') ||
    msg.includes('exceeded the maximum') ||
    msg.includes('exceeds')
  ) {
    return new UploadError('FILE_TOO_LARGE', err.message);
  }
  if (
    msg.includes('mime type') ||
    msg.includes('not supported') ||
    msg.includes('not allowed') ||
    status === '415'
  ) {
    return new UploadError('WRONG_FILE_TYPE', err.message);
  }
  if (
    status === '401' ||
    status === '403' ||
    msg.includes('row-level security') ||
    msg.includes('unauthorized') ||
    msg.includes('not authorized')
  ) {
    return new UploadError('PERMISSION_DENIED', err.message);
  }
  return new UploadError('UPLOAD_FAILED', err.message);
}

// React Native `fetch` failures and other network-layer issues throw raw
// Errors (TypeError, AbortError, etc.) — none of them go through the
// supabase-js `{ error }` channel. Treat them as NETWORK_ERROR.
export function translateNetworkError(err: unknown): UploadError {
  const detail = err instanceof Error ? err.message : String(err);
  return new UploadError('NETWORK_ERROR', detail);
}

export function alertCopyFor(
  code: UploadErrorCode,
  kind: FileKind,
  detail?: string,
): [title: string, message: string] {
  const isImageOnly = kind === 'avatar' || kind === 'job-photo';

  switch (code) {
    case 'FILE_TOO_LARGE':
      return isImageOnly
        ? [
            'Photo too large',
            'Photos must be under 10 MB. Try a smaller image or compress it.',
          ]
        : [
            'File too large',
            'Documents must be under 10 MB. Try a smaller file.',
          ];
    case 'WRONG_FILE_TYPE':
      return isImageOnly
        ? [
            'Unsupported file type',
            'Please select a JPEG, PNG, or WEBP image.',
          ]
        : [
            'Unsupported file type',
            'Please select a PDF, JPEG, or PNG file.',
          ];
    case 'PERMISSION_DENIED':
      return [
        'Upload not allowed',
        "You don't have permission to upload this file. Try signing out and back in.",
      ];
    case 'NETWORK_ERROR':
      return [
        'Connection problem',
        "Couldn't reach the server. Check your internet connection and try again.",
      ];
    case 'UPLOAD_FAILED':
    default:
      return [
        'Upload failed',
        detail
          ? `Something went wrong while uploading (${detail}). Please try again. If this keeps happening, contact support.`
          : 'Something went wrong while uploading. Please try again. If this keeps happening, contact support.',
      ];
  }
}

// Short label for a file kind, used inside composite messages when multiple
// uploads fail in a single submit ("Avatar — too large. COI — connection
// problem.").
export function kindLabel(kind: FileKind): string {
  switch (kind) {
    case 'avatar':
      return 'Avatar';
    case 'coi':
      return 'COI';
    case 'w9':
      return 'W-9';
    case 'job-photo':
      return 'Photo';
  }
}

// Used by the submit composite Alert to describe a single failure inline.
export function shortReasonFor(code: UploadErrorCode): string {
  switch (code) {
    case 'FILE_TOO_LARGE':
      return 'too large';
    case 'WRONG_FILE_TYPE':
      return 'wrong file type';
    case 'PERMISSION_DENIED':
      return 'permission denied';
    case 'NETWORK_ERROR':
      return 'connection problem';
    case 'UPLOAD_FAILED':
    default:
      return 'upload failed';
  }
}
