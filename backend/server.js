// backend/server.js
const config = require('./src/config');
const { ensureSchema } = require('./src/db');
const app = require('./src/app');

const start = async () => {
  try {
    await ensureSchema();
    console.log('✅ Tabelas "leads" e "usuarios" criadas ou já existentes.');
  } catch (err) {
    console.error('❌ Erro ao preparar o banco de dados:', err.message);
    process.exit(1);
  }

  app.listen(config.port, () => {
    console.log(`🚀 Servidor rodando no ambiente ${config.env} na porta ${config.port}`);
    console.log(`📊 Banco de dados: ${config.db.database}`);
  });
};

start();
