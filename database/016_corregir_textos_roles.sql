-- Casa de Vida
-- Migración 016: corrige textos del catálogo de roles almacenados con
-- codificación incorrecta. No modifica permisos ni asignaciones.

begin;

update public.roles
set nombre = valores.nombre,
    descripcion = valores.descripcion
from (
    values
        ('superadmin', 'Superadministrador', 'Control completo y seguridad del sistema'),
        ('pastor', 'Pastor', 'Gestión pastoral y administrativa amplia'),
        ('tesorero', 'Tesorero', 'Gestión completa del módulo financiero'),
        ('oficial', 'Oficial', 'Funciones logísticas autorizadas'),
        ('lider', 'Líder', 'Coordinación de los equipos que dirige'),
        ('editor_contenido', 'Editor de contenido', 'Gestión y publicación del contenido público'),
        ('voluntario', 'Voluntario', 'Acceso a convocatorias y actividades del equipo de servicio'),
        ('miembro', 'Miembro', 'Acceso personal y futuras inscripciones educativas')
) as valores(codigo, nombre, descripcion)
where public.roles.codigo = valores.codigo;

commit;
