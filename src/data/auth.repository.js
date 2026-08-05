const SESSION_KEY = 'casadevida.session';

const USERS = [
  { email: 'miembro@casadevida.org', password: '123456', role: 'miembro', name: 'Miembro Demo' },
  { email: 'servidor@casadevida.org', password: '123456', role: 'servidor', name: 'Servidor Demo' },
  { email: 'admin@casadevida.org', password: '123456', role: 'admin', name: 'Admin Demo' },
];

export function findUserByCredentials(email, password) {
  return USERS.find((user) => user.email === email && user.password === password) ?? null;
}

export function saveSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function getSession() {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}
