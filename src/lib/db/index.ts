import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Connection string should come from environment variables
const connectionString = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/tinix_trending';

// Prevent multiple connections in development (Next.js hot reloads)
const globalForDb = globalThis as unknown as {
  conn: postgres.Sql | undefined;
  db: ReturnType<typeof drizzle<typeof schema>> | undefined;
};

// Limit connection pool to prevent Postgres connection exhaustion
const maxConnections = process.env.DB_MAX_CONNECTIONS 
  ? parseInt(process.env.DB_MAX_CONNECTIONS) 
  : (process.env.NODE_ENV === 'production' ? 10 : 5);

const client = globalForDb.conn ?? postgres(connectionString, {
  max: maxConnections,
  idle_timeout: 20, // Automatically close idle connections after 20 seconds
});

if (process.env.NODE_ENV !== 'production') {
  globalForDb.conn = client;
}

export const db = globalForDb.db ?? drizzle(client, { schema });

if (process.env.NODE_ENV !== 'production') {
  globalForDb.db = db;
}

