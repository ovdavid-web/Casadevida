export function loginPage({ error = '', success = '' } = {}) {
  const errorNode = error ? `<div class="alert alert--error">${error}</div>` : '';
  const successNode = success ? `<div class="alert alert--success">${success}</div>` : '';

  return `
    <section class="card form">
      <h2>Iniciar sesión</h2>
      <p class="copy-muted">Base lista para reemplazar por Supabase Auth.</p>
      ${errorNode}
      ${successNode}
      <form id="login-form" class="form" autocomplete="off">
        <div class="form__row">
          <label for="email">Correo</label>
          <input id="email" name="email" type="email" placeholder="miembro@casadevida.org" required />
        </div>
        <div class="form__row">
          <label for="password">Contraseña</label>
          <input id="password" name="password" type="password" placeholder="••••••" required />
        </div>
        <button class="button" type="submit">Entrar</button>
      </form>
      <p class="copy-muted" style="margin-top: 1rem; font-size: 0.86rem;">
        Demo: miembro@casadevida.org | servidor@casadevida.org | admin@casadevida.org (clave 123456)
      </p>
    </section>
  `;
}
