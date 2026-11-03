// backend/src/config.js
// Lê as variáveis de ambiente uma vez e aplica padrões que funcionam localmente.
const crypto = require('crypto');
require('dotenv').config();

const isProduction = process.env.NODE_ENV === 'production';

let jwtSecret = String(process.env.JWT_SECRET || '').trim();
if (!jwtSecret) {
  if (isProduction) {
    throw new Error('JWT_SECRET é obrigatório em produção.');
  }
  // Em desenvolvimento, gera um segredo aleatório para não depender de valor fixo.
  // Os tokens deixam de valer quando a API reinicia.
  jwtSecret = crypto.randomBytes(32).toString('hex');
  console.warn('⚠️  JWT_SECRET não definido: usando um segredo aleatório (só para desenvolvimento).');
} else if (jwtSecret.length < 32) {
  throw new Error('JWT_SECRET precisa ter pelo menos 32 caracteres.');
}

const corsOrigins = String(process.env.CORS_ORIGIN || 'http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

module.exports = {
  isProduction,
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 5000,
  db: {
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'painel_leads',
    password: process.env.DB_PASSWORD || 'postgres',
    port: Number(process.env.DB_PORT) || 5432,
  },
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  corsOrigins,
  uploadMaxBytes: (Number(process.env.UPLOAD_MAX_MB) || 5) * 1024 * 1024,
};
