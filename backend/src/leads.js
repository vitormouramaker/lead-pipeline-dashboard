// backend/src/leads.js
// Regras de lead compartilhadas pela API, pela importação de planilha e pelo seed.

const LEAD_FIELDS = [
  'data',
  'curso',
  'instagram_de_origem',
  'nome_do_lead',
  'telefone',
  'email',
  'status_do_lead',
  'status_de_venda',
  'valor_da_venda',
  'data_do_follow_up',
  'responsavel',
  'observacoes',
];

// Validação básica: o telefone é a chave do lead (a planilha faz upsert por ele).
const validateLead = (lead) => {
  const errors = [];
  if (!lead.telefone) errors.push(`Telefone é obrigatório para o lead: ${lead.nome_do_lead}`);
  return errors;
};

// Aceita "1500.50", "1500,50" e "1.500,50". Valor vazio ou inválido vira 0.
const parseValor = (raw) => {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0;
  let text = String(raw ?? '').replace(/[R$\s]/g, '');
  if (!text) return 0;
  if (text.includes(',')) text = text.replace(/\./g, '').replace(',', '.');
  const value = parseFloat(text);
  return Number.isFinite(value) ? value : 0;
};

// Normaliza o corpo de POST/PUT para os valores gravados no banco.
const normalizeLead = (lead) => ({
  data: lead.data || null,
  curso: lead.curso || null,
  instagram_de_origem: lead.instagram_de_origem || null,
  nome_do_lead: lead.nome_do_lead || null,
  telefone: lead.telefone ? String(lead.telefone).trim() : null,
  email: lead.email ? String(lead.email).trim() : null,
  status_do_lead: lead.status_do_lead || 'Novo',
  status_de_venda: lead.status_de_venda || null,
  valor_da_venda: parseValor(lead.valor_da_venda),
  data_do_follow_up: lead.data_do_follow_up || null,
  responsavel: lead.responsavel || null,
  observacoes: lead.observacoes || null,
});

// Uma linha da planilha usa a coluna "e_mail" (cabeçalho da planilha original).
const mapCsvRow = (row) => normalizeLead({ ...row, email: row.e_mail ?? row.email });

const toValues = (lead) => LEAD_FIELDS.map((field) => lead[field]);

const UPSERT_SQL = `
  INSERT INTO leads (${LEAD_FIELDS.join(', ')})
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
  ON CONFLICT (telefone) DO UPDATE SET
    data = EXCLUDED.data,
    curso = EXCLUDED.curso,
    instagram_de_origem = EXCLUDED.instagram_de_origem,
    nome_do_lead = EXCLUDED.nome_do_lead,
    email = EXCLUDED.email,
    status_do_lead = EXCLUDED.status_do_lead,
    status_de_venda = EXCLUDED.status_de_venda,
    valor_da_venda = EXCLUDED.valor_da_venda,
    data_do_follow_up = EXCLUDED.data_do_follow_up,
    responsavel = EXCLUDED.responsavel,
    observacoes = EXCLUDED.observacoes,
    updated_at = CURRENT_TIMESTAMP
  RETURNING (xmax = 0) AS inserted
`;

// Importa linhas da planilha numa transação: adiciona leads novos e atualiza os
// que já existem (mesmo telefone). Linhas inválidas são puladas e relatadas.
const importRows = async (pool, rows) => {
  let added = 0;
  let updated = 0;
  const messageErrors = [];

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const row of rows) {
      const lead = mapCsvRow(row);
      const errors = validateLead(lead);
      if (errors.length > 0) {
        messageErrors.push(errors.join(', '));
        continue;
      }
      const result = await client.query(UPSERT_SQL, toValues(lead));
      if (result.rows[0].inserted) added++;
      else updated++;
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  return { added, updated, errors: messageErrors.length, messageErrors };
};

module.exports = { LEAD_FIELDS, validateLead, parseValor, normalizeLead, mapCsvRow, toValues, importRows };
