import mysql from 'mysql2/promise';

let pool: mysql.Pool | null = null;

export function getPool(): mysql.Pool {
  if (pool) return pool;

  const { MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE, MYSQL_PORT } = process.env;
  if (!MYSQL_HOST || !MYSQL_USER || !MYSQL_PASSWORD || !MYSQL_DATABASE) {
    throw new Error('[db] Missing required env vars: MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE');
  }

  pool = mysql.createPool({
    host:             MYSQL_HOST,
    user:             MYSQL_USER,
    password:         MYSQL_PASSWORD,
    database:         MYSQL_DATABASE,
    port:             Number(MYSQL_PORT ?? 3306),
    ssl:              MYSQL_HOST !== 'localhost' ? { rejectUnauthorized: false } : undefined,
    connectionLimit:  5,
    waitForConnections: true,
    // Return DATE columns as 'YYYY-MM-DD' strings, not JS Date objects
    dateStrings: true,
    // Cast DECIMAL columns to JS numbers
    typeCast(field, next) {
      if (field.type === 'NEWDECIMAL' || field.type === 'DECIMAL') {
        const val = field.string();
        return val === null ? null : parseFloat(val);
      }
      return next();
    },
  });

  return pool;
}
