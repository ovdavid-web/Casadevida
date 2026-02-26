# Casa de Vida - Base Frontend Escalable (HTML/CSS/JS)

Esta versión implementa una base profesional sin frameworks para preparar la siguiente etapa con Supabase.

## Estructura sugerida

```txt
.
├── index.html              # Entrada principal (shell + carga de app)
├── styles.css              # Estilos globales (design tokens + componentes base)
├── app.js                  # Bootstrap de la aplicación
└── src
    ├── app
    │   ├── router.js       # Rutas hash y eventos globales
    │   └── guards.js       # Reglas de protección de rutas
    ├── config
    │   └── routes.js       # Tabla centralizada de rutas
    ├── data
    │   └── auth.repository.js   # Acceso a datos/sesión (hoy localStorage)
    ├── services
    │   └── auth.service.js      # Lógica de autenticación (independiente de UI)
    └── ui
        ├── layout.js       # Layout general (header/main/footer)
        └── pages
            ├── home.page.js
            ├── login.page.js
            ├── dashboard.page.js
            └── not-found.page.js
```

## Decisiones de arquitectura

1. **Separación UI / lógica / datos**
   - `ui/`: render HTML de páginas y layout.
   - `services/`: reglas de negocio (login, sesión vigente, logout).
   - `data/`: persistencia; hoy `localStorage`, luego `Supabase Auth` + tablas.

2. **Router simple y extensible**
   - Se usa hash routing (`#/ruta`) para evitar servidor adicional.
   - `ROUTE_TABLE` centraliza rutas para crecer sin duplicar strings.

3. **Guardas de seguridad por ruta**
   - `requireAuth` protege dashboard privado y redirige a login.
   - Es base para agregar control por rol (`miembro/servidor/admin`).

4. **Preparado para Supabase**
   - La UI no conoce detalles de persistencia.
   - Al integrar Supabase, solo cambia `data/` + parte de `services/`, manteniendo páginas.

## Flujo actual

- Home público: `#/`
- Login: `#/login`
- Dashboard base privado: `#/dashboard`
- Usuarios demo:
  - `miembro@casadevida.org` / `123456`
  - `servidor@casadevida.org` / `123456`
  - `admin@casadevida.org` / `123456`

## Siguiente paso recomendado (Supabase)

1. Configurar Supabase Auth con email/password.
2. Reemplazar `auth.repository.js` por cliente Supabase.
3. Crear tabla `profiles` con rol y políticas RLS.
4. Aplicar guards por rol para rutas de servidores y admin.
