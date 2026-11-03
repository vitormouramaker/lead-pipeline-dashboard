/**
 * Dados fictícios para rodar o painel localmente: uma conta de demonstração e
 * os leads de sample-data/leads-exemplo.csv. Pode rodar de novo: a conta tem a
 * senha redefinida e os leads são atualizados pelo telefone (mesmo upsert da
 * importação de planilha).
 *
 *   npm run seed:demo                       senha padrão Demo@1234
 *   DEMO_SENHA="OutraSenha@1" npm run seed:demo
 *
 * Trava de segurança: não roda com NODE_ENV=production.
 */
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const config = require('../src/config');

const CSV_FILE = path.join(__dirname, '..', 'sample-data', 'leads-exemplo.csv');

const readCsv = (file) =>
  new Promise((resolve, reject) => {
    const rows = [];
    fs.createReadStream(file)
      .pipe(csv())
      .on('data', (row) => rows.push(row))
      .on('end', () => resolve(rows))
      .on('error', reject);
  });

async function main() {
  if (config.isProduction) {
    throw new Error('Este roteiro cria uma conta com senha conhecida e não roda em produção.');
  }

  const { pool, ensureSchema } = require('../src/db');
  const { upsertUser } = require('../src/auth');
  const { importRows } = require('../src/leads');

  try {
    await ensureSchema();

    const senha = String(process.env.DEMO_SENHA || '').trim() || 'Demo@1234';
    const user = await upsertUser({ nome: 'Equipe Demo', email: 'demo@example.com', senha });
    console.log(`conta pronta: ${user.email} (senha: ${senha})`);

    const rows = await readCsv(CSV_FILE);
    const summary = await importRows(pool, rows);
    console.log(`leads de exemplo: ${summary.added} adicionados, ${summary.updated} atualizados, ${summary.errors} com erros`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Erro ao criar os dados de demonstração:', err.message);
  process.exitCode = 1;
});
