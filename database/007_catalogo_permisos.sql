-- Casa de Vida
-- Migración 007: catálogo inicial de permisos y asignación por roles.
--
-- Requiere: 006_base_personas_roles.sql
-- No modifica todavía el backend ni concede acceso directo mediante RLS.

begin;

insert into public.permisos (codigo, modulo, accion, descripcion)
values
    ('panel.admin.ver', 'panel', 'ver', 'Ver el Panel General administrativo autorizado'),
    ('panel.personal.ver', 'panel', 'ver', 'Ver el Panel General personal'),
    ('panel.alertas_cuentas.ver', 'panel', 'ver', 'Ver alertas resumidas de cuentas en el Panel General'),

    ('personas.completo.ver', 'personas', 'ver', 'Ver la ficha administrativa completa de personas'),
    ('personas.limitado.ver', 'personas', 'ver', 'Ver nombre, estado y datos operativos autorizados'),
    ('personas.crear', 'personas', 'crear', 'Crear personas y miembros'),
    ('personas.editar', 'personas', 'editar', 'Editar datos administrativos de personas'),
    ('personas.desactivar', 'personas', 'desactivar', 'Desactivar personas sin borrar su historial'),
    ('personas.contacto_propio.editar', 'personas', 'editar', 'Editar teléfono y dirección propios'),

    ('familias.ver', 'familias', 'ver', 'Ver familias'),
    ('familias.gestionar', 'familias', 'gestionar', 'Crear, editar y desactivar familias'),

    ('usuarios.ver', 'usuarios', 'ver', 'Ver cuentas de usuario'),
    ('usuarios.crear', 'usuarios', 'crear', 'Crear cuentas de usuario'),
    ('usuarios.editar', 'usuarios', 'editar', 'Editar y activar o desactivar cuentas'),
    ('roles.asignar_criticos', 'roles', 'asignar', 'Asignar o retirar roles críticos'),

    ('ingresos.ver', 'finanzas', 'ver', 'Ver ingresos y movimientos del período'),
    ('ingresos.crear', 'finanzas', 'crear', 'Registrar ingresos'),
    ('ingresos.editar', 'finanzas', 'editar', 'Corregir ingresos con auditoría'),
    ('ingresos.anular', 'finanzas', 'anular', 'Anular ingresos sin borrarlos'),
    ('egresos.ver', 'finanzas', 'ver', 'Ver egresos'),
    ('egresos.crear', 'finanzas', 'crear', 'Registrar egresos'),
    ('egresos.editar', 'finanzas', 'editar', 'Corregir egresos con auditoría'),
    ('egresos.anular', 'finanzas', 'anular', 'Anular egresos sin borrarlos'),
    ('reportes_financieros.ver', 'finanzas', 'ver', 'Ver reportes financieros generales'),
    ('aportes_historial.ver', 'finanzas', 'ver', 'Ver historial acumulado por persona o familia'),
    ('aportes_historial.exportar', 'finanzas', 'exportar', 'Descargar historial acumulado con motivo auditado'),

    ('cuentas.ver', 'cuentas_por_pagar', 'ver', 'Ver el módulo de cuentas por pagar'),
    ('cuentas.crear', 'cuentas_por_pagar', 'crear', 'Crear cuentas por pagar'),
    ('cuentas.editar', 'cuentas_por_pagar', 'editar', 'Editar cuentas por pagar'),
    ('cuentas.pagar', 'cuentas_por_pagar', 'pagar', 'Registrar el pago de una cuenta'),
    ('cuentas.anular', 'cuentas_por_pagar', 'anular', 'Anular una cuenta sin borrarla'),

    ('contenido.ver', 'contenido', 'ver', 'Ver la administración de contenido público'),
    ('contenido.crear', 'contenido', 'crear', 'Crear contenido público'),
    ('contenido.editar', 'contenido', 'editar', 'Editar textos e imágenes públicas'),
    ('contenido.publicar', 'contenido', 'publicar', 'Publicar contenido en el sitio'),
    ('contenido.retirar', 'contenido', 'retirar', 'Retirar contenido publicado'),
    ('contenido.archivos.gestionar', 'contenido', 'gestionar', 'Subir y reemplazar imágenes y banners'),

    ('eventos_publicos.ver', 'eventos', 'ver', 'Ver administración de eventos públicos'),
    ('eventos_publicos.crear', 'eventos', 'crear', 'Crear eventos públicos'),
    ('eventos_publicos.editar', 'eventos', 'editar', 'Editar eventos y miniaturas'),
    ('eventos_publicos.publicar', 'eventos', 'publicar', 'Publicar eventos en el sitio'),
    ('eventos_publicos.suspender', 'eventos', 'suspender', 'Suspender eventos dejando motivo'),
    ('eventos_internos.ver', 'eventos', 'ver', 'Ver eventos internos autorizados'),
    ('eventos_internos.gestionar', 'eventos', 'gestionar', 'Crear y modificar eventos internos'),
    ('eventos_autorizados.ver', 'eventos', 'ver', 'Ver actividades según rol, equipo o audiencia'),
    ('eventos_equipo.crear', 'eventos', 'crear', 'Crear actividades internas para un equipo dirigido'),
    ('eventos_equipo.editar', 'eventos', 'editar', 'Editar actividades del equipo dirigido'),
    ('eventos_equipo.suspender', 'eventos', 'suspender', 'Suspender actividades del equipo dirigido dejando motivo'),
    ('equipos_integrantes.limitado.ver', 'equipos', 'ver', 'Ver datos operativos limitados del equipo dirigido'),

    ('auditoria.completa.ver', 'auditoria', 'ver', 'Ver la auditoría completa'),
    ('auditoria.limitada.ver', 'auditoria', 'ver', 'Ver auditoría del ámbito autorizado')
on conflict (codigo) do update
set
    modulo = excluded.modulo,
    accion = excluded.accion,
    descripcion = excluded.descripcion;

-- Superadmin recibe todo el catálogo.
insert into public.rol_permisos (rol_id, permiso_id)
select r.id, p.id
from public.roles r
cross join public.permisos p
where r.codigo = 'superadmin'
on conflict do nothing;

-- Pastor: administración pastoral amplia, ingresos operativos y supervisión financiera.
with asignaciones(rol_codigo, permiso_codigo) as (
    values
        ('pastor', 'panel.admin.ver'),
        ('pastor', 'personas.completo.ver'),
        ('pastor', 'personas.crear'),
        ('pastor', 'personas.editar'),
        ('pastor', 'personas.desactivar'),
        ('pastor', 'familias.ver'),
        ('pastor', 'familias.gestionar'),
        ('pastor', 'usuarios.ver'),
        ('pastor', 'usuarios.crear'),
        ('pastor', 'usuarios.editar'),
        ('pastor', 'ingresos.ver'),
        ('pastor', 'ingresos.crear'),
        ('pastor', 'egresos.ver'),
        ('pastor', 'reportes_financieros.ver'),
        ('pastor', 'aportes_historial.ver'),
        ('pastor', 'aportes_historial.exportar'),
        ('pastor', 'cuentas.ver'),
        ('pastor', 'eventos_internos.ver'),
        ('pastor', 'eventos_internos.gestionar'),
        ('pastor', 'auditoria.limitada.ver')
)
insert into public.rol_permisos (rol_id, permiso_id)
select r.id, p.id
from asignaciones a
join public.roles r on r.codigo = a.rol_codigo
join public.permisos p on p.codigo = a.permiso_codigo
on conflict do nothing;

-- Tesorero: operación financiera completa sin historiales individuales acumulados.
with asignaciones(rol_codigo, permiso_codigo) as (
    values
        ('tesorero', 'panel.admin.ver'),
        ('tesorero', 'personas.limitado.ver'),
        ('tesorero', 'familias.ver'),
        ('tesorero', 'ingresos.ver'),
        ('tesorero', 'ingresos.crear'),
        ('tesorero', 'ingresos.editar'),
        ('tesorero', 'ingresos.anular'),
        ('tesorero', 'egresos.ver'),
        ('tesorero', 'egresos.crear'),
        ('tesorero', 'egresos.editar'),
        ('tesorero', 'egresos.anular'),
        ('tesorero', 'reportes_financieros.ver'),
        ('tesorero', 'cuentas.ver'),
        ('tesorero', 'cuentas.crear'),
        ('tesorero', 'cuentas.editar'),
        ('tesorero', 'cuentas.pagar'),
        ('tesorero', 'cuentas.anular'),
        ('tesorero', 'auditoria.limitada.ver')
)
insert into public.rol_permisos (rol_id, permiso_id)
select r.id, p.id
from asignaciones a
join public.roles r on r.codigo = a.rol_codigo
join public.permisos p on p.codigo = a.permiso_codigo
on conflict do nothing;

-- Oficial: Panel General de consulta, sin acceso a módulos financieros.
with asignaciones(rol_codigo, permiso_codigo) as (
    values
        ('oficial', 'panel.admin.ver'),
        ('oficial', 'panel.alertas_cuentas.ver'),
        ('oficial', 'personas.limitado.ver'),
        ('oficial', 'eventos_internos.ver'),
        ('oficial', 'eventos_autorizados.ver')
)
insert into public.rol_permisos (rol_id, permiso_id)
select r.id, p.id
from asignaciones a
join public.roles r on r.codigo = a.rol_codigo
join public.permisos p on p.codigo = a.permiso_codigo
on conflict do nothing;

-- Editor: autonomía completa sobre el contenido público y sus eventos.
with asignaciones(rol_codigo, permiso_codigo) as (
    values
        ('editor_contenido', 'panel.admin.ver'),
        ('editor_contenido', 'contenido.ver'),
        ('editor_contenido', 'contenido.crear'),
        ('editor_contenido', 'contenido.editar'),
        ('editor_contenido', 'contenido.publicar'),
        ('editor_contenido', 'contenido.retirar'),
        ('editor_contenido', 'contenido.archivos.gestionar'),
        ('editor_contenido', 'eventos_publicos.ver'),
        ('editor_contenido', 'eventos_publicos.crear'),
        ('editor_contenido', 'eventos_publicos.editar'),
        ('editor_contenido', 'eventos_publicos.publicar'),
        ('editor_contenido', 'eventos_publicos.suspender'),
        ('editor_contenido', 'auditoria.limitada.ver')
)
insert into public.rol_permisos (rol_id, permiso_id)
select r.id, p.id
from asignaciones a
join public.roles r on r.codigo = a.rol_codigo
join public.permisos p on p.codigo = a.permiso_codigo
on conflict do nothing;

-- Miembro y voluntario: panel personal y actividades filtradas por audiencia.
with asignaciones(rol_codigo, permiso_codigo) as (
    values
        ('miembro', 'panel.personal.ver'),
        ('miembro', 'personas.contacto_propio.editar'),
        ('miembro', 'eventos_autorizados.ver'),
        ('voluntario', 'panel.personal.ver'),
        ('voluntario', 'eventos_autorizados.ver')
)
insert into public.rol_permisos (rol_id, permiso_id)
select r.id, p.id
from asignaciones a
join public.roles r on r.codigo = a.rol_codigo
join public.permisos p on p.codigo = a.permiso_codigo
on conflict do nothing;

-- Líder: coordinación limitada exclusivamente a los equipos que dirige.
with asignaciones(rol_codigo, permiso_codigo) as (
    values
        ('lider', 'panel.personal.ver'),
        ('lider', 'eventos_autorizados.ver'),
        ('lider', 'eventos_equipo.crear'),
        ('lider', 'eventos_equipo.editar'),
        ('lider', 'eventos_equipo.suspender'),
        ('lider', 'equipos_integrantes.limitado.ver')
)
insert into public.rol_permisos (rol_id, permiso_id)
select r.id, p.id
from asignaciones a
join public.roles r on r.codigo = a.rol_codigo
join public.permisos p on p.codigo = a.permiso_codigo
on conflict do nothing;

commit;
