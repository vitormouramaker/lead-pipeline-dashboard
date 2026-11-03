/**
 * Cria (ou redefine a senha de) um usuário do painel. Não existe cadastro aberto.
 *
 *   npm run user:create -- "Nome da Pessoa" pessoa@example.com "SenhaForte@123"
 */
const { pool, ensureSchema } = require('../src/db');
const { upsertUser } = require('../src/auth');

async function main() {
  const [nome, email, senha] = process.argv.slice(2);
  if (!nome || !email || !senha) {
    throw new Error('Uso: npm run user:create -- "Nome" email@example.com "Senha"');
  }
  if (senha.length < 8) {
    throw new Error('A senha precisa ter pelo menos 8 caracteres.');
  }
  await ensureSchema();
  const user = await upsertUser({ nome, email, senha });
  console.log(`usuário pronto: ${user.email}`);
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
