/**
 * Cria o banco (se ainda não existir) e as tabelas. Útil para rodar sem Docker.
 *
 *   npm run db:init
 */
const { Client } = require('pg');
const config = require('../src/config');

async function main() {
  const admin = new Client({ ...config.db, database: 'postgres' });
  await admin.connect();
  try {
    const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [config.db.database]);
    if (exists.rowCount === 0) {
      // Nome de banco não aceita parâmetro: aspas duplas escapadas.
      await admin.query(`CREATE DATABASE "${config.db.database.replace(/"/g, '""')}"`);
      console.log(`banco criado: ${config.db.database}`);
    } else {
      console.log(`banco já existe: ${config.db.database}`);
    }
  } finally {
    await admin.end();
  }

  const { pool, ensureSchema } = require('../src/db');
  await ensureSchema();
  await pool.end();
  console.log('tabelas prontas');
}

main().catch((err) => {
  console.error('Erro ao preparar o banco:', err.message);
  process.exitCode = 1;
});
