import postgres from 'postgres';

async function main() {
  const sql = postgres('postgres://postgres:826002@localhost:5432/postgres');
  try {
    const result = await sql`SELECT 1 FROM pg_database WHERE datname = 'tinix_trending'`;
    if (result.length === 0) {
      await sql`CREATE DATABASE tinix_trending`;
      console.log('Database tinix_trending created successfully.');
    } else {
      console.log('Database tinix_trending already exists.');
    }
  } catch (err) {
    console.error('Error creating database:', err);
  } finally {
    await sql.end();
  }
}

main();
