// backend/src/db.js
const { Pool, types } = require('pg');
const config = require('./config');

// Colunas DATE voltam como texto 'YYYY-MM-DD'. Sem isso o driver cria um Date à
// meia-noite do fuso do servidor e a data pode "andar" um dia no navegador.
types.setTypeParser(1082, (value) => value);

const pool = new Pool(config.db);

// Schema idempotente: roda a cada subida e deixa um banco vazio pronto para uso.
const ensureSchema = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS leads (
      id SERIAL PRIMARY KEY,
      data DATE,
      curso VARCHAR(255),
      instagram_de_origem VARCHAR(255),
      nome_do_lead VARCHAR(255),
      telefone VARCHAR(255),
      email VARCHAR(255) UNIQUE,
      status_do_lead VARCHAR(255),
      status_de_venda VARCHAR(255),
      valor_da_venda DECIMAL(10,2),
      data_do_follow_up DATE,
      responsavel VARCHAR(255),
      observacoes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  // A importação da planilha faz "upsert" pelo telefone, então ele precisa ser único.
  await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS leads_telefone_key ON leads (telefone);');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id SERIAL PRIMARY KEY,
      nome VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      senha_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
};

module.exports = { pool, ensureSchema };
