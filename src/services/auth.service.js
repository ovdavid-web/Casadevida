import {
  clearSession,
  findUserByCredentials,
  getSession,
  saveSession,
} from '../data/auth.repository.js';

export function login({ email, password }) {
  const user = findUserByCredentials(email.trim().toLowerCase(), password);

  if (!user) {
    return {
      ok: false,
      error: 'Credenciales inválidas. Verifica correo y contraseña.',
    };
  }

  const session = {
    user: {
      email: user.email,
      role: user.role,
      name: user.name,
    },
    expiresAt: Date.now() + 1000 * 60 * 60 * 8,
  };

  saveSession(session);

  return {
    ok: true,
    data: session,
  };
}

export function logout() {
  clearSession();
}

export function getCurrentSession() {
  const session = getSession();

  if (!session) {
    return null;
  }

  if (session.expiresAt < Date.now()) {
    clearSession();
    return null;
  }

  return session;
}
