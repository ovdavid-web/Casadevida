import { ROUTES } from '../config/routes.js';
import { getCurrentSession } from '../services/auth.service.js';

export function requireAuth(route) {
  const session = getCurrentSession();

  if (route === '/dashboard' && !session) {
    return {
      allowed: false,
      redirectTo: ROUTES.login,
    };
  }

  return {
    allowed: true,
    session,
  };
}
