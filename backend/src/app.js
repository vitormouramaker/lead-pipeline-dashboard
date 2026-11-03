// backend/src/app.js
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const os = require('os');
const path = require('path');
const config = require('./config');
const { pool } = require('./db');
const auth = require('./auth');
const { validateLead, normalizeLead, toValues, importRows } = require('./leads');

const app = express();
app.disable('x-powered-by');

// Middleware
app.use(cors({ origin: config.corsOrigins }));
app.use(express.json({ limit: '100kb' }));

// Upload da planilha: arquivo temporário fora do projeto, só .csv e com limite de tamanho.
const upload = multer({
  dest: path.join(os.tmpdir(), 'painel-leads-uploads'),
  limits: { fileSize: config.uploadMaxBytes, files: 1 },
  fileFilter: (req, file, cb) => {
    if (path.extname(file.originalname || '').toLowerCase() !== '.csv') {
      return cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'csvFile'));
    }
    return cb(null, true);
  },
});

const isValidId = (id) => /^\d{1,10}$/.test(String(id));

const uniqueViolationMessage = (err) =>
  String(err.constraint || '').includes('telefone') ? 'Telefone já cadastrado' : 'Email já existe';

// Health check (público)
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'OK', database: 'up' });
  } catch {
    res.status(503).json({ status: 'ERROR', database: 'down' });
  }
});

// Autenticação
app.use('/api/auth', auth.router);

// Daqui para baixo, toda rota exige login.
app.use('/api', auth.requireAuth);

// GET /api/leads
app.get('/api/leads', async (req, res) => {
  try {
    const { status_do_lead, responsavel, curso, instagram_de_origem, search } = req.query;
    let query = 'SELECT * FROM leads WHERE 1=1';
    const values = [];
    let paramIndex = 1;

    if (status_do_lead) {
      query += ` AND status_do_lead = $${paramIndex++}`;
      values.push(String(status_do_lead));
    }
    if (responsavel) {
      query += ` AND responsavel = $${paramIndex++}`;
      values.push(String(responsavel));
    }
    if (curso) {
      query += ` AND curso = $${paramIndex++}`;
      values.push(String(curso));
    }
    if (instagram_de_origem) {
      query += ` AND instagram_de_origem = $${paramIndex++}`;
      values.push(String(instagram_de_origem));
    }
    if (search) {
      query += ` AND nome_do_lead ILIKE $${paramIndex++}`;
      values.push(`%${String(search)}%`);
    }

    query += ' ORDER BY created_at DESC, id DESC';
    const result = await pool.query(query, values);
    res.json(result.rows);
  } catch (err) {
    console.error('Erro ao buscar leads:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/leads
app.post('/api/leads', async (req, res) => {
  try {
    const lead = normalizeLead(req.body || {});
    const errors = validateLead(lead);
    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    const query = `
      INSERT INTO leads (data, curso, instagram_de_origem, nome_do_lead, telefone, email, status_do_lead, status_de_venda, valor_da_venda, data_do_follow_up, responsavel, observacoes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `;
    const result = await pool.query(query, toValues(lead));
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Erro ao criar lead:', err);
    if (err.code === '23505') {
      return res.status(400).json({ error: uniqueViolationMessage(err) });
    }
    if (err.code === '22007' || err.code === '22008' || err.code === '22P02') {
      return res.status(400).json({ error: 'Dados inválidos' });
    }
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PUT /api/leads/:id
app.put('/api/leads/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json({ error: 'ID inválido' });

    const lead = normalizeLead(req.body || {});
    const errors = validateLead(lead);
    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    const query = `
      UPDATE leads SET
        data = $1, curso = $2, instagram_de_origem = $3, nome_do_lead = $4, telefone = $5, email = $6,
        status_do_lead = $7, status_de_venda = $8, valor_da_venda = $9, data_do_follow_up = $10,
        responsavel = $11, observacoes = $12, updated_at = CURRENT_TIMESTAMP
      WHERE id = $13
      RETURNING *
    `;
    const result = await pool.query(query, [...toValues(lead), id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Lead não encontrado' });
    }
    return res.json(result.rows[0]);
  } catch (err) {
    console.error('Erro ao atualizar lead:', err);
    if (err.code === '23505') {
      return res.status(400).json({ error: uniqueViolationMessage(err) });
    }
    if (err.code === '22007' || err.code === '22008' || err.code === '22P02') {
      return res.status(400).json({ error: 'Dados inválidos' });
    }
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// DELETE /api/leads/:id
app.delete('/api/leads/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json({ error: 'ID inválido' });

    const result = await pool.query('DELETE FROM leads WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Lead não encontrado' });
    }
    return res.json({ message: 'Lead deletado com sucesso' });
  } catch (err) {
    console.error('Erro ao deletar lead:', err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/upload-csv
app.post('/api/upload-csv', upload.single('csvFile'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Nenhum arquivo foi enviado' });
  }

  const rows = [];
  const filePath = req.file.path;
  const removeTempFile = () =>
    fs.unlink(filePath, (err) => {
      if (err) console.error('Erro ao remover arquivo temporário:', err);
    });

  return fs
    .createReadStream(filePath)
    // Remove BOM e espaços dos cabeçalhos (planilhas exportadas pelo Excel).
    .pipe(csv({ mapHeaders: ({ header }) => header.replace(/^﻿/, '').trim() }))
    .on('data', (row) => rows.push(row))
    .on('end', async () => {
      try {
        const summary = await importRows(pool, rows);
        res.json({
          message: `CSV importado com sucesso! ${summary.added} leads adicionados, ${summary.updated} atualizados, ${summary.errors} com erros.`,
          ...summary,
        });
      } catch (err) {
        console.error('Erro ao importar CSV:', err);
        const detail = err.code === '23505' ? 'Há e-mails repetidos entre leads diferentes' : undefined;
        res.status(500).json({ error: 'Erro ao importar CSV', details: detail });
      } finally {
        removeTempFile();
      }
    })
    .on('error', (err) => {
      console.error('Erro ao processar stream CSV:', err);
      removeTempFile();
      res.status(500).json({ error: 'Erro ao processar arquivo CSV' });
    });
});

// Erros do upload (arquivo grande ou que não é .csv) e JSON malformado.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const error =
      err.code === 'LIMIT_FILE_SIZE' ? 'Arquivo grande demais' : 'Envie um único arquivo .csv no campo csvFile';
    return res.status(400).json({ error });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'JSON inválido' });
  }
  console.error('Erro não tratado:', err);
  return res.status(500).json({ error: 'Erro interno do servidor' });
});

module.exports = app;
