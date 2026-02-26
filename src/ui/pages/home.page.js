export function homePage() {
  return `
    <section class="hero card">
      <h1>Plataforma ministerial de Casa de Vida</h1>
      <p>
        Estructura inicial profesional para crecer hacia miembros, servidores, administración y módulos
        ministeriales.
      </p>
    </section>

    <section class="grid grid--3" style="margin-top: 1rem;">
      <article class="card">
        <h3>Zona pública</h3>
        <p class="copy-muted">Información general, anuncios y bienvenida para visitantes.</p>
      </article>
      <article class="card">
        <h3>Zona miembros</h3>
        <p class="copy-muted">Perfil, seguimiento espiritual, ofrendas y recursos privados.</p>
      </article>
      <article class="card">
        <h3>Zona servidores/admin</h3>
        <p class="copy-muted">Planificación de servicios, voluntarios y gestión ministerial.</p>
      </article>
    </section>
  `;
}
