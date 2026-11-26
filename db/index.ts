import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Neon: use the POOLED connection string. `prepare: false` keeps it compatible with
 * PgBouncer transaction pooling. One client per server instance (cached across HMR).
 */
const g = globalThis as unknown as { __pg?: ReturnType<typeof postgres> };
const client =
  g.__pg ??
  postgres(process.env.DATABASE_URL ?? "", {
    prepare: false,
    max: process.env.NODE_ENV === "production" ? 5 : 3,
    idle_timeout: 20,
  });
if (process.env.NODE_ENV !== "production") g.__pg = client;

export const db = drizzle(client, { schema });
export { schema };
