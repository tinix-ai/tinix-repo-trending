import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Connection string should come from environment variables
const connectionString = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/tinix_trending';

// Prevent multiple connections in development (Next.js hot reloads)
const globalForDb = globalThis as unknown as {
  conn: postgres.Sql | undefined;
};

// Limit connection pool in development to prevent Postgres connection exhaustion
const client = globalForDb.conn ?? postgres(connectionString, {
  max: process.env.NODE_ENV === 'production' ? undefined : 5,
  idle_timeout: 20, // Automatically close idle connections after 20 seconds
});

if (process.env.NODE_ENV !== 'production') {
  globalForDb.conn = client;
}

export const db = drizzle(client, { schema });

