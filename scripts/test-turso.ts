import dotenv from 'dotenv';
dotenv.config({ path: '../.env.turso' });
import { createClient } from '@libsql/client';

const db = createClient({
  url: (process.env.TURSO_DATABASE_URL || 'file:local.db').trim(),
  authToken: process.env.TURSO_AUTH_TOKEN?.trim(),
});

async function main() {
  try {
    const result = await db.execute('SELECT 1 as test');
    console.log('Connection successful:', result.rows);
  } catch (err: any) {
    console.error('Connection failed:', err.message);
  }
}
main();