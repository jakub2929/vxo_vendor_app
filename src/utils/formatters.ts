// Display-only formatters. Inputs come straight from the DB (raw UUIDs, etc);
// outputs are user-facing strings. Keep this module free of side effects so
// it's safe to import from anywhere (renderers, hooks, mocks).

// Vendor-facing job number: `Job# <first 8 hex chars of the job UUID>`
// (lowercase). Centralized so every surface renders identically and a future
// format change (e.g. when Ryan ships a sequential `job_number` column) is a
// single-file edit. Internal IDs in routes, push payloads, and DB writes
// stay raw UUIDs — this is presentation only.
export function formatJobNumber(jobId: string): string {
  return `Job# ${jobId.slice(0, 8)}`;
}

// Progressive US-phone mask. Runs on every keystroke from the phone Controller
// in FillProfile, so it must be cheap, idempotent (re-formatting an already-
// formatted string yields the same result), and tolerant of arbitrary input
// (pasted strings, backspaces partway through punctuation, etc).
//
// Storage convention: the form holds the formatted string; submit calls
// phoneDigitsOnly to strip back to 10 digits for vendors.phone.
export function formatPhoneInput(input: string): string {
  const digits = input.replace(/\D/g, '').slice(0, 10);
  if (digits.length === 0) return '';
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export function phoneDigitsOnly(formatted: string): string {
  return formatted.replace(/\D/g, '');
}
