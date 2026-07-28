# Matriz de roles y permisos — borrador v1

Estado: propuesta para revisión. Este documento todavía no autoriza cambios en producción.

## Principios acordados

- Una persona puede existir sin ser miembro y sin tener una cuenta de usuario.
- Una cuenta de usuario pertenece, como máximo, a una persona.
- Un usuario puede tener varios roles simultáneamente.
- Los cursos futuros se habilitarán mediante inscripciones, no mediante roles.
- El menú mostrará en una sola sesión todas las funciones autorizadas.
- Ocultar una opción en la interfaz no reemplaza la autorización del backend.
- Solo el superadmin puede asignar roles críticos.
- Los registros financieros y personales no se eliminan físicamente desde la operación normal.

## Roles iniciales

| Rol | Finalidad |
|---|---|
| `superadmin` | Configuración, seguridad, usuarios, roles y control completo del sistema |
| `pastor` | Gestión pastoral y administrativa amplia, sin editar contenido público ni elevar privilegios críticos |
| `tesorero` | Gestión completa de finanzas y cuentas por pagar |
| `oficial` | Funciones logísticas expresamente autorizadas |
| `editor_contenido` | Gestión y publicación del contenido público y eventos |
| `miembro` | Acceso personal y, en el futuro, a inscripciones educativas |

## Matriz funcional propuesta

Leyenda: `C` crear, `V` ver, `E` editar, `A` anular/desactivar, `P` publicar.

| Módulo | Superadmin | Pastor | Tesorero | Oficial | Editor contenido | Miembro |
|---|---:|---:|---:|---:|---:|---:|
| Panel administrativo | V | V | V financiero | V logístico | V contenido | — |
| Personas y miembros | C/V/E/A | C/V/E/A | V limitada para asociar aportes | V limitada según tarea | — | Solo perfil propio |
| Familias | C/V/E/A | C/V/E/A | V limitada | V/C/E según tarea | — | Solo información propia |
| Usuarios | C/V/E/A | C/V/E sin roles críticos | — | — | — | Cuenta propia |
| Asignar roles críticos | C/V/E/A | — | — | — | — | — |
| Ingresos | C/V/E/A | C/V/E/A | C/V/E/A | — | — | — |
| Egresos | C/V/E/A | C/V/E/A | C/V/E/A | — | — | — |
| Reportes financieros | V | V | V | — | — | — |
| Cuentas por pagar | C/V/E/A | C/V/E/A | C/V/E/A | — | — | — |
| Contenido público | C/V/E/A/P | V | — | — | C/V/E/A/P | V público |
| Eventos públicos | C/V/E/A/P | V y solicitar | — | V logístico | C/V/E/A/P | V público |
| Eventos internos | C/V/E/A | C/V/E/A | V si corresponde | V/E según tarea | Solo parte pública | — |
| Auditoría | V | V limitada | V financiera | — | V de contenido propio | — |
| Servicios y voluntarios | Pendiente | Pendiente | — | Pendiente | — | Pendiente |
| Educación | Futuro | Futuro | Como participante | Como participante | Como participante | Por inscripción |

## Permisos críticos

Solo `superadmin`:

- Asignar o retirar `superadmin`, `pastor`, `tesorero` y `editor_contenido`.
- Cambiar configuración de seguridad.
- Reactivar cuentas bloqueadas administrativamente.
- Consultar la auditoría completa.

`editor_contenido` puede:

- Crear, editar, publicar y retirar textos e imágenes públicas.
- Subir y reemplazar banners o fotografías.
- Crear y publicar eventos con su miniatura.
- Administrar la información pública de los eventos.

`editor_contenido` no puede:

- Consultar finanzas.
- Consultar el directorio completo.
- Administrar usuarios o roles.
- Modificar configuración técnica o credenciales.

## Decisiones pendientes

- Alcance exacto del oficial en personas, familias y servicios.
- Si el pastor puede modificar movimientos financieros o solamente supervisarlos.
- Qué datos personales puede ver el tesorero al asociar un aporte.
- Quién puede aprobar futuras inscripciones educativas cuando un curso no sea abierto.
- Política de retención para personas externas que no continúan.
