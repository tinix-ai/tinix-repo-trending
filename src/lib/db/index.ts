import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Connection string should come from environment variables
const connectionString = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/tinix_trending';

// Create a postgres connection
const client = postgres(connectionString);

// Wrap it with drizzle
export const db = drizzle(client, { schema });
