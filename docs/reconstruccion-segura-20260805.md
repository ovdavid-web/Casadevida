# Reconstrucción segura — 5 de agosto de 2026

## Objetivo

Recuperar los avances verificados de Casa de Vida desde el último punto funcional, sin sobrescribir la línea original ni ejecutar cambios sobre el esquema o los datos oficiales de Supabase.

## Líneas conservadas

- Estado original congelado: `agent/respaldo-seguridad-accesos-20260805`.
- Reconstrucción aislada: `codex/reconstruccion-segura-20260805`.
- Punto de partida funcional: `ff399b7` (`respaldar avances funcionales y visuales antes de seguridad`).

## Bloques recuperados y comprobados

1. Herramientas de respaldo y migraciones `006` a `010`.
2. Migraciones `011` a `018`, conservadas como archivos pero no ejecutadas durante esta reconstrucción.
3. Identidad, acceso, roles acumulables, credenciales temporales, usuarios y personas.
4. Backend de miembros, finanzas, egresos, familias, servicios, eventos y cuentas por pagar.
5. Interfaz oficial servida desde `public/`.

Cada bloque se guardó en un commit independiente después de sus comprobaciones.

## Evidencia de funcionamiento

- Sintaxis de servidor, middleware, autenticación y rutas: correcta.
- Pruebas automatizadas: 3 aprobadas, 0 fallidas.
- Salud del servidor aislado: `ok`.
- Acceso de `admin@casadevida.cl`: HTTP 200, rol `superadmin`, cambio de contraseña obligatorio.
- Acceso de `orme.guz@gmail.com`: HTTP 200, rol efectivo `voluntario`, cambio de contraseña obligatorio.
- La interfaz oficial contiene el formulario y utiliza `/api/auth/login` del mismo servidor.
- El acceso administrativo fue confirmado manualmente desde la interfaz oficial.
- Matriz de lectura por rol: 28 combinaciones correctas de 28, sin fallos.

Las pruebas nunca imprimieron hashes ni incorporaron secretos a Git.

## Causa confirmada del incidente local

Un proceso Node antiguo, iniciado antes de la reconstrucción, seguía ocupando el puerto `3000`. El navegador se conectaba a ese proceso con configuración obsoleta, mientras cada intento de iniciar la versión reconstruida terminaba al no poder conservar el puerto. El proceso antiguo fue identificado por PID, validado como Node y detenido de forma puntual. Después de liberar el puerto, la reconstrucción inició normalmente y el acceso admin funcionó.

## Auditoría viva de cuentas y permisos

- `admin@casadevida.cl`: activo, `superadmin`, contraseña personal actualizada el 5 de agosto.
- `oficial.prueba@casadevida.test`: activo, rol efectivo `oficial`.
- `orme.guz@gmail.com`: activo, rol efectivo `voluntario`, credencial temporal pendiente.
- `tesorero.prueba@casadevida.test`: activo, rol efectivo `tesorero`, credencial temporal vencida.

La matriz comprobó accesos de solo lectura a personas, finanzas, servicios, cuentas por pagar, egresos, perfil personal y resumen personal. Los permisos y denegaciones coincidieron con la política esperada en los 28 casos.

## Corrección preventiva de configuración

El servidor carga el `.env` correspondiente a su propia instancia. En desarrollo local, esos valores reemplazan variables antiguas heredadas de Windows, pero `PORT` puede sobrescribirse para ejecutar pruebas aisladas. En producción se mantienen las variables administradas por el entorno de despliegue.

## Componente excluido intencionalmente

No se recuperó el segundo frontend ubicado en la raíz (`index.html`, `app.js`, `styles.css` y `src/app`, `src/data`, `src/services`, `src/ui`). Era una demostración con autenticación mock mediante `localStorage`, no era servido por Express y duplicaba la interfaz oficial. Debe permanecer fuera hasta que se decida formalmente si se elimina o se transforma en una aplicación real.

## Condiciones antes de promover esta rama

1. Crear un respaldo nuevo de código y base de datos.
2. Confirmar qué migraciones `011` a `018` ya existen en Supabase; no reaplicarlas a ciegas.
3. Probar cambio inicial de contraseña con cuentas de ensayo, no con datos oficiales de terceros.
4. Verificar permisos de cada rol con una matriz de pruebas de lectura y escritura.
5. Probar frontend y backend juntos desde una sola URL.
6. Revisar que `.env`, respaldos, logs y credenciales temporales sigan fuera de Git.
7. Promover mediante revisión y merge; nunca reemplazar carpetas manualmente.
