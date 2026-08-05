import { ROUTES } from '../config/routes.js';

export function renderShell({ content, session }) {
  const authLinks = session
    ? `<button class="button button--ghost" data-action="logout">Cerrar sesión</button>`
    : `<a class="nav__link" href="${ROUTES.login}">Login</a>`;

  return `
    <div class="app-shell">
      <header class="topbar">
        <div class="topbar__inner">
          <a href="${ROUTES.home}" class="brand">Casa de Vida</a>
          <nav class="nav">
            <a class="nav__link" href="${ROUTES.home}">Inicio</a>
            <a class="nav__link" href="${ROUTES.dashboard}">Dashboard</a>
            ${authLinks}
          </nav>
        </div>
      </header>
      <main class="main">${content}</main>
      <footer class="footer">Base preparada para integrar Supabase Auth + RLS.</footer>
    </div>
  `;
}
