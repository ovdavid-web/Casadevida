import { ROUTES } from '../../config/routes.js';

export function notFoundPage() {
  return `
    <section class="card">
      <h2>Página no encontrada</h2>
      <p class="copy-muted">La ruta solicitada no existe en esta versión inicial.</p>
      <a class="button" href="${ROUTES.home}" style="display:inline-block; margin-top: 0.75rem;">Volver al inicio</a>
    </section>
  `;
}
