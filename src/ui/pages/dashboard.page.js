const roleLabels = {
  miembro: 'Miembro',
  servidor: 'Servidor',
  admin: 'Administrador',
};

export function dashboardPage(session) {
  const name = session?.user?.name ?? 'Usuario';
  const role = session?.user?.role ?? 'miembro';

  return `
    <section class="card">
      <h2>Dashboard base</h2>
      <p class="copy-muted">
        Bienvenido, ${name}. Tu rol actual es <span class="badge">${roleLabels[role] ?? role}</span>.
      </p>
    </section>

    <section class="dashboard-grid" style="margin-top: 1rem;">
      <article class="card">
        <h3>Miembros</h3>
        <p class="copy-muted">Registro y gestión de miembros (pendiente).</p>
      </article>
      <article class="card">
        <h3>Ofrendas</h3>
        <p class="copy-muted">Control de ofrendas y reportes financieros (pendiente).</p>
      </article>
      <article class="card">
        <h3>Servicios y voluntarios</h3>
        <p class="copy-muted">Asignación de servidores y planificación semanal (pendiente).</p>
      </article>
      <article class="card">
        <h3>Canciones</h3>
        <p class="copy-muted">Repositorio de letras y acordes por ministerio (pendiente).</p>
      </article>
    </section>
  `;
}
