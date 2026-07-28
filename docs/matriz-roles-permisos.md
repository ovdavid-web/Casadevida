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
| `voluntario` | Acceso a convocatorias, reuniones y asignaciones del equipo de servicio |
| `miembro` | Acceso personal y, en el futuro, a inscripciones educativas |

## Matriz funcional propuesta

Leyenda: `C` crear, `V` ver, `E` editar, `A` anular/desactivar, `P` publicar.

| Módulo | Superadmin | Pastor | Tesorero | Oficial | Editor contenido | Miembro |
|---|---:|---:|---:|---:|---:|---:|
| Panel administrativo | V | V | V financiero | V completo en modo consulta | V contenido | Panel personal filtrado |
| Personas y miembros | C/V/E/A | C/V/E/A | V limitada para asociar aportes | V limitada según tarea | — | Solo perfil propio |
| Familias | C/V/E/A | C/V/E/A | V limitada | — | — | Solo información propia |
| Usuarios | C/V/E/A | C/V/E sin roles críticos | — | — | — | Cuenta propia |
| Asignar roles críticos | C/V/E/A | — | — | — | — | — |
| Ingresos | C/V/E/A | C/V | C/V/E/A | — | — | — |
| Egresos | C/V/E/A | V | C/V/E/A | — | — | — |
| Reportes financieros | V | V | V | — | — | — |
| Historial de aportes por persona o familia | V/Exportar | V/Exportar | — | — | — | — |
| Cuentas por pagar | C/V/E/A | V | C/V/E/A | V solo como resumen del Panel General | — | — |
| Contenido público | C/V/E/A/P | V | — | — | C/V/E/A/P | V público |
| Eventos públicos | C/V/E/A/P | V y solicitar | — | V logístico | C/V/E/A/P | V público |
| Eventos internos | C/V/E/A | C/V/E/A | V si corresponde | V | Solo parte pública | — |
| Auditoría | V | V limitada | V financiera | — | V de contenido propio | — |
| Servicios y voluntarios | Pendiente | Pendiente | — | Pendiente | — | Pendiente |
| Educación | Futuro | Futuro | Como participante | Como participante | Como participante | Por inscripción |

## Panel personal y audiencias de actividades

Un miembro con cuenta puede ver un Panel General personal, sin cifras administrativas
ni financieras. El backend entrega solamente las actividades autorizadas para esa persona.

Audiencias previstas:

- `publica`: visible también en el Home.
- `miembros`: visible para miembros con cuenta.
- `rol`: visible para quienes tengan un rol concreto, por ejemplo `voluntario`.
- `equipo`: visible para integrantes de un equipo específico.
- `administrativa`: visible únicamente para los roles administrativos autorizados.

Ejemplos:

- Culto o actividad pública: todos.
- Actividad interna general: miembros.
- Reunión de voluntarios: rol `voluntario`.
- Reunión de un equipo: solo integrantes de ese equipo.
- Reunión administrativa: roles administrativos definidos.

El rol `voluntario` es acumulable. Un usuario puede tener simultáneamente
`miembro` y `voluntario`, sin crear otra cuenta.

Reglas de seguridad:

- Un evento puede tener más de una audiencia.
- La audiencia `publica` permite verlo sin iniciar sesión.
- La audiencia `miembros` exige una cuenta activa con rol `miembro`.
- La audiencia `rol` puede repetirse para varios roles autorizados.
- Si un evento no tiene audiencia válida, no se muestra.
- Las audiencias se filtran en el backend antes de enviar datos al navegador.
- Los eventos internos antiguos quedan inicialmente limitados a superadmin y pastor.
- Las audiencias por equipo se agregarán junto con el futuro módulo de Servicios y Voluntarios.

## Actualización del perfil personal

Un miembro con cuenta puede:

- Editar directamente su teléfono y dirección.
- Solicitar un cambio de correo, que solo se aplica después de verificar el correo nuevo.
- Cambiar su contraseña mediante un flujo seguro.

Un miembro debe solicitar corrección administrativa para:

- Nombres y apellidos.
- RUT u otro documento de identidad.

Un miembro no puede modificar:

- Su estado o vínculo de membresía.
- Su familia.
- Su fecha de bautismo.
- Sus roles o permisos.

Todos los cambios directos y administrativos quedan auditados.

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

`oficial` puede:

- Ver el Panel General completo en modo de consulta.
- Ver el total y un listado limitado de miembros.
- Ver próximas actividades y actividades realizadas.
- Ver en el Panel General alertas de cuentas próximas a vencer o vencidas.

`oficial` no puede:

- Entrar a los módulos de ingresos, egresos, reportes o cuentas por pagar.
- Crear, editar, pagar, anular o eliminar información financiera.
- Crear, editar, suspender o eliminar actividades.
- Ver RUT, domicilio, familia, bautismo o historial financiero de miembros.
- Administrar usuarios, roles o contenido público.

`tesorero` puede:

- Gestionar ingresos, egresos, cuentas por pagar y reportes generales.
- Ver los movimientos asociados a personas o familias dentro de la operación mensual.
- Corregir o anular movimientos dejando motivo y auditoría.

`tesorero` no puede:

- Consultar, construir ni descargar un historial acumulado de aportes por persona o familia.
- Crear perfiles financieros individuales.
- Acceder a información personal que no sea necesaria para asociar un movimiento.

El historial acumulado de aportes por persona o familia:

- Es exclusivo de `superadmin` y `pastor`.
- Se consulta solo ante una necesidad administrativa, conflicto o solicitud de transparencia.
- Exige registrar el motivo de la consulta.
- Registra en auditoría quién lo visualizó o descargó, cuándo y para qué.

## Decisiones pendientes

- Quién puede aprobar futuras inscripciones educativas cuando un curso no sea abierto.
- Política de retención para personas externas que no continúan.
