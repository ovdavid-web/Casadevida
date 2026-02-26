import { requireAuth } from './guards.js';
import { ROUTE_TABLE, ROUTES } from '../config/routes.js';
import { login, logout } from '../services/auth.service.js';
import { renderShell } from '../ui/layout.js';
import { dashboardPage } from '../ui/pages/dashboard.page.js';
import { homePage } from '../ui/pages/home.page.js';
import { loginPage } from '../ui/pages/login.page.js';
import { notFoundPage } from '../ui/pages/not-found.page.js';

const app = document.getElementById('app');

function getCurrentPath() {
  const hash = window.location.hash || ROUTES.home;
  const path = hash.replace(/^#/, '') || '/';
  return path;
}

function render(path, uiState = {}) {
  const guard = requireAuth(path);

  if (!guard.allowed) {
    window.location.hash = guard.redirectTo;
    return;
  }

  let pageHtml;

  switch (ROUTE_TABLE[path]) {
    case 'home':
      pageHtml = homePage();
      break;
    case 'login':
      pageHtml = loginPage(uiState);
      break;
    case 'dashboard':
      pageHtml = dashboardPage(guard.session);
      break;
    default:
      pageHtml = notFoundPage();
  }

  app.innerHTML = renderShell({
    content: pageHtml,
    session: guard.session,
  });

  registerUiEvents(path);
}

function registerUiEvents(path) {
  const logoutBtn = document.querySelector('[data-action="logout"]');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      logout();
      window.location.hash = ROUTES.home;
    });
  }

  if (path !== '/login') {
    return;
  }

  const form = document.getElementById('login-form');
  if (!form) {
    return;
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const result = login({
      email: String(formData.get('email') || ''),
      password: String(formData.get('password') || ''),
    });

    if (!result.ok) {
      render('/login', { error: result.error });
      return;
    }

    render('/login', { success: 'Ingreso exitoso. Redirigiendo al dashboard...' });
    setTimeout(() => {
      window.location.hash = ROUTES.dashboard;
    }, 500);
  });
}

export function initRouter() {
  window.addEventListener('hashchange', () => {
    render(getCurrentPath());
  });

  if (!window.location.hash) {
    window.location.hash = ROUTES.home;
  }

  render(getCurrentPath());
}
