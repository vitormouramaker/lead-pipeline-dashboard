const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseValor, validateLead, mapCsvRow, normalizeLead, toValues, LEAD_FIELDS } = require('../src/leads');

test('parseValor aceita formatos brasileiros e internacionais', () => {
  assert.equal(parseValor('1500.50'), 1500.5);
  assert.equal(parseValor('1500,50'), 1500.5);
  assert.equal(parseValor('1.997,00'), 1997);
  assert.equal(parseValor('R$ 297,00'), 297);
  assert.equal(parseValor(''), 0);
  assert.equal(parseValor(undefined), 0);
  assert.equal(parseValor('abc'), 0);
  assert.equal(parseValor(42), 42);
});

test('validateLead exige telefone', () => {
  assert.deepEqual(validateLead({ telefone: '11900000001', nome_do_lead: 'X' }), []);
  assert.equal(validateLead({ nome_do_lead: 'Sem Telefone' }).length, 1);
});

test('mapCsvRow lê a coluna e_mail da planilha e aplica padrões', () => {
  const lead = mapCsvRow({ nome_do_lead: 'Alice Exemplo', telefone: ' 11900000001 ', e_mail: 'a@example.com', valor_da_venda: '497,00' });
  assert.equal(lead.email, 'a@example.com');
  assert.equal(lead.telefone, '11900000001');
  assert.equal(lead.status_do_lead, 'Novo');
  assert.equal(lead.valor_da_venda, 497);
  assert.equal(lead.data, null);
});

test('e-mail vazio vira null (não colide com a restrição UNIQUE)', () => {
  assert.equal(normalizeLead({ telefone: '1', email: '' }).email, null);
});

test('toValues segue a ordem das colunas', () => {
  const values = toValues(normalizeLead({ telefone: '1', nome_do_lead: 'N' }));
  assert.equal(values.length, LEAD_FIELDS.length);
  assert.equal(values[LEAD_FIELDS.indexOf('telefone')], '1');
  assert.equal(values[LEAD_FIELDS.indexOf('nome_do_lead')], 'N');
});
