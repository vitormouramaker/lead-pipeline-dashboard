// backend/src/auth.js
// Login com e-mail e senha (bcrypt) e token JWT enviado no cabeçalho Authorization.
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const { pool } = require('./db');

// Hash fixo usado quando o e-mail não existe, para o tempo de resposta não
// revelar quais e-mails têm conta.
const DUMMY_HASH = bcrypt.hashSync('senha-inexistente', 10);

const signToken = (user) =>
  jwt.sign({ sub: String(user.id), nome: user.nome, email: user.email }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });

const requireAuth = (req, res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Faça login para continuar' });
  }
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    req.user = { id: Number(payload.sub), nome: payload.nome, email: payload.email };
    return next();
  } catch {
    return res.status(401).json({ error: 'Sessão expirada. Faça login novamente' });
  }
};

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Muitas tentativas de login. Tente novamente em alguns minutos' },
});

const router = express.Router();

router.post('/login', loginLimiter, async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const senha = String(req.body?.senha || '');
    if (!email || !senha) {
      return res.status(400).json({ error: 'Informe e-mail e senha' });
    }

    const result = await pool.query('SELECT id, nome, email, senha_hash FROM usuarios WHERE email = $1', [email]);
    const user = result.rows[0];
    const ok = await bcrypt.compare(senha, user ? user.senha_hash : DUMMY_HASH);
    if (!user || !ok) {
      return res.status(401).json({ error: 'E-mail ou senha incorretos' });
    }

    return res.json({ token: signToken(user), user: { id: user.id, nome: user.nome, email: user.email } });
  } catch (err) {
    console.error('Erro no login:', err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// Cria ou atualiza um usuário (usado pelo seed e pelo script criar-usuario).
const upsertUser = async ({ nome, email, senha }) => {
  const hash = await bcrypt.hash(senha, 10);
  const result = await pool.query(
    `INSERT INTO usuarios (nome, email, senha_hash) VALUES ($1, $2, $3)
     ON CONFLICT (email) DO UPDATE SET nome = EXCLUDED.nome, senha_hash = EXCLUDED.senha_hash
     RETURNING id, nome, email`,
    [nome, String(email).trim().toLowerCase(), hash],
  );
  return result.rows[0];
};

module.exports = { router, requireAuth, upsertUser };
