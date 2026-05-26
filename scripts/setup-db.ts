import * as fs from 'fs';
import * as path from 'path';
import * as mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function main() {
  const conn = await mysql.createConnection({
    host:     process.env.MYSQL_HOST,
    user:     process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    port:     Number(process.env.MYSQL_PORT ?? 3306),
    ssl:      process.env.MYSQL_HOST !== 'localhost' ? { rejectUnauthorized: false } : undefined,
    multipleStatements: true,
  });

  try {
    for (const file of ['01_schema.sql', '02_seed.sql']) {
      const sql = fs.readFileSync(path.resolve(__dirname, '../sql', file), 'utf8');
      await conn.query(sql);
      console.log(`✓ ${file}`);
    }
  } finally {
    await conn.end();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
