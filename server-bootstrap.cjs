const rawDatabaseUrl = process.env.DATABASE_URL;

if (rawDatabaseUrl) {
  try {
    const databaseUrl = new URL(rawDatabaseUrl);
    databaseUrl.searchParams.delete('sslmode');
    process.env.DATABASE_URL = databaseUrl.toString();
  } catch {
    // Leave an unusual/non-URL connection string untouched; the existing
    // database configuration will handle it in the same way as before.
  }
}

require('./dist/server.cjs');
