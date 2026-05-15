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
