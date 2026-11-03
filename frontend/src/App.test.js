import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from './App';
import Login from './Login';
import { api, formatDate, toInputDate, getToken, setToken } from './api';

afterEach(() => {
  jest.restoreAllMocks();
  setToken(null);
});

test('sem sessão, mostra a tela de login', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: /painel de leads/i })).toBeInTheDocument();
  expect(screen.getByLabelText(/e-mail/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /entrar/i })).toBeInTheDocument();
});

test('login guarda o token e avisa quem chamou', async () => {
  const user = { id: 1, nome: 'Equipe Demo', email: 'demo@example.com' };
  jest.spyOn(api, 'post').mockResolvedValue({ data: { token: 'token-de-teste', user } });
  const onLogin = jest.fn();

  render(<Login onLogin={onLogin} />);
  fireEvent.change(screen.getByLabelText(/e-mail/i), { target: { value: 'demo@example.com' } });
  fireEvent.change(screen.getByLabelText(/senha/i), { target: { value: 'Demo@1234' } });
  fireEvent.click(screen.getByRole('button', { name: /entrar/i }));

  await waitFor(() => expect(onLogin).toHaveBeenCalledWith(user));
  expect(api.post).toHaveBeenCalledWith('/auth/login', { email: 'demo@example.com', senha: 'Demo@1234' });
  expect(getToken()).toBe('token-de-teste');
});

test('login com erro mostra a mensagem da API', async () => {
  jest.spyOn(api, 'post').mockRejectedValue({ response: { data: { error: 'E-mail ou senha incorretos' } } });

  render(<Login onLogin={jest.fn()} />);
  fireEvent.change(screen.getByLabelText(/e-mail/i), { target: { value: 'demo@example.com' } });
  fireEvent.change(screen.getByLabelText(/senha/i), { target: { value: 'errada' } });
  fireEvent.click(screen.getByRole('button', { name: /entrar/i }));

  expect(await screen.findByText('E-mail ou senha incorretos')).toBeInTheDocument();
});

test('datas DATE são formatadas sem deslocar o dia', () => {
  expect(formatDate('2026-08-01')).toBe('01/08/2026');
  expect(formatDate(null)).toBe('');
  expect(toInputDate('2026-08-01')).toBe('2026-08-01');
  expect(toInputDate('')).toBe('');
});
