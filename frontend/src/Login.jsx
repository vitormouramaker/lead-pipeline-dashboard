// frontend/src/Login.jsx
import React, { useState } from 'react';
import { api, setToken } from './api';
import './App.css';

function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSending(true);
    setError('');
    try {
      const response = await api.post('/auth/login', { email, senha });
      setToken(response.data.token);
      onLogin(response.data.user);
    } catch (err) {
      setError(err.response?.data?.error || 'Não foi possível entrar. Verifique se a API está rodando.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <img src={`${process.env.PUBLIC_URL}/logo.svg`} alt="" className="login-logo" />
        <h1>Painel de Leads</h1>
        <p className="login-subtitle">Entre para acompanhar o funil de vendas.</p>
        <div className="form-group">
          <label htmlFor="login-email">E-mail:</label>
          <input id="login-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
        </div>
        <div className="form-group">
          <label htmlFor="login-senha">Senha:</label>
          <input id="login-senha" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="current-password" required />
        </div>
        {error && <p className="login-error">{error}</p>}
        <button type="submit" className="save-button login-button" disabled={sending}>
          {sending ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}

export default Login;
