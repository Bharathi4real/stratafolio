/**
 * Turns low-level errors (Postgres via Drizzle, network) into messages a person can act on.
 * Drizzle wraps the driver error as `cause`; Postgres puts the SQLSTATE in `code`.
 */
const MIGRATE =
  "The database is missing recent updates. Run `bun run db:migrate` (locally) or redeploy, then try again.";

export function humanizeError(e: unknown): string {
  const err = e as { message?: string; code?: string; cause?: { code?: string; message?: string } };
  const code = err?.cause?.code ?? err?.code;
  switch (code) {
    case "42703": // undefined_column
    case "42P01": // undefined_table
      return MIGRATE;
    case "23505": // unique_violation
      return "That already exists. Use a different name or slug.";
    case "23503": // foreign_key_violation
      return "Something else still depends on this, so it can’t be changed right now.";
    case "57P01":
    case "08006":
    case "08001":
      return "Couldn’t reach the database. Check DATABASE_URL and your connection, then retry.";
  }
  const msg = err?.message ?? String(e);
  if (/^Failed query:/i.test(msg)) {
    const inner = err?.cause?.message;
    return inner ? `Database error: ${inner}` : "A database error occurred. Try again.";
  }
  if (/ECONNREFUSED|ENOTFOUND|fetch failed|ETIMEDOUT/i.test(msg))
    return "A network request failed. Check your connection (or the R2 / database settings) and retry.";
  return msg;
}
