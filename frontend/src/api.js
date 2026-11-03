// frontend/src/api.js
import axios from 'axios';

export const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const TOKEN_KEY = 'painel-leads:token';

export const getToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

export const setToken = (token) => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Sem storage disponível: o login vale só até recarregar a página.
  }
};

export const api = axios.create({ baseURL: API_URL });

// Envia o token em toda requisição.
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Token vencido ou inválido: limpa a sessão e avisa a tela.
let onUnauthorized = () => {};
export const setUnauthorizedHandler = (handler) => {
  onUnauthorized = handler;
};

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isLogin = error.config?.url?.includes('/auth/login');
    if (error.response?.status === 401 && !isLogin) {
      setToken(null);
      onUnauthorized();
    }
    return Promise.reject(error);
  },
);

// Datas DATE chegam como 'YYYY-MM-DD'. Formata sem passar por new Date(), que
// interpretaria como UTC e poderia mostrar o dia anterior.
export const formatDate = (value) => {
  if (!value) return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
  if (!match) return String(value);
  return `${match[3]}/${match[2]}/${match[1]}`;
};

export const toInputDate = (value) => {
  if (!value) return '';
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(String(value));
  return match ? match[1] : '';
};
