-- Casa de Vida
-- Migración 019: base del módulo Secretaría y Registros.
-- Reutiliza personas, roles y departamentos; no duplica identidades.

begin;

insert into public.roles (codigo, nombre, descripcion, es_critico, activo)
values (
    'secretaria',
    'Secretaría',
    'Gestión de actas, registros eclesiásticos y memoria institucional',
    true,
    true
)
on conflict (codigo) do update
set nombre = excluded.nombre,
    descripcion = excluded.descripcion,
    es_critico = excluded.es_critico,
    activo = true;

insert into public.permisos (codigo, modulo, accion, descripcion)
values
    ('secretaria.ver', 'secretaria', 'ver', 'Acceder al módulo Secretaría y Registros'),
    ('actas.ver', 'secretaria', 'ver', 'Consultar actas institucionales'),
    ('actas.gestionar', 'secretaria', 'gestionar', 'Crear y actualizar actas institucionales'),
    ('acuerdos.ver', 'secretaria', 'ver', 'Consultar el libro de acuerdos'),
    ('acuerdos.gestionar', 'secretaria', 'gestionar', 'Registrar y actualizar acuerdos'),
    ('registros_eclesiasticos.ver', 'secretaria', 'ver', 'Consultar registros eclesiásticos'),
    ('registros_eclesiasticos.gestionar', 'secretaria', 'gestionar', 'Gestionar bautismos, matrimonios, presentaciones y otros registros'),
    ('estructura_ministerial.ver', 'secretaria', 'ver', 'Consultar la estructura ministerial vigente e histórica'),
    ('estructura_ministerial.gestionar', 'secretaria', 'gestionar', 'Gestionar áreas, responsables y períodos ministeriales'),
    ('secretaria_reportes.generar', 'secretaria', 'generar', 'Generar documentos institucionales bajo petición')
on conflict (codigo) do update
set modulo = excluded.modulo,
    accion = excluded.accion,
    descripcion = excluded.descripcion;

-- Superadministración y pastorado conservan supervisión institucional.
insert into public.rol_permisos (rol_id, permiso_id)
select r.id, p.id
from public.roles r
cross join public.permisos p
where r.codigo in ('superadmin', 'pastor')
  and p.modulo = 'secretaria'
on conflict do nothing;

-- Secretaría gestiona su módulo y consulta el directorio necesario para vincular personas.
insert into public.rol_permisos (rol_id, permiso_id)
select r.id, p.id
from public.roles r
join public.permisos p on p.codigo in (
    'panel.admin.ver',
    'personas.completo.ver',
    'familias.ver',
    'secretaria.ver',
    'actas.ver',
    'actas.gestionar',
    'acuerdos.ver',
    'acuerdos.gestionar',
    'registros_eclesiasticos.ver',
    'registros_eclesiasticos.gestionar',
    'estructura_ministerial.ver',
    'estructura_ministerial.gestionar',
    'secretaria_reportes.generar',
    'auditoria.limitada.ver'
)
where r.codigo = 'secretaria'
on conflict do nothing;

alter table public.departamentos
    add column if not exists departamento_padre_id uuid,
    add column if not exists tipo text not null default 'ministerio',
    add column if not exists orden integer not null default 0;

do $$
begin
    if not exists (
        select 1 from pg_constraint
        where conname = 'departamentos_padre_id_fkey'
          and conrelid = 'public.departamentos'::regclass
    ) then
        alter table public.departamentos
            add constraint departamentos_padre_id_fkey
            foreign key (departamento_padre_id)
            references public.departamentos(id)
            on delete restrict;
    end if;

    if not exists (
        select 1 from pg_constraint
        where conname = 'departamentos_tipo_valido'
          and conrelid = 'public.departamentos'::regclass
    ) then
        alter table public.departamentos
            add constraint departamentos_tipo_valido
            check (tipo in ('gobierno', 'ministerio', 'equipo', 'apoyo'));
    end if;
end
$$;

create index if not exists departamentos_padre_orden_idx
    on public.departamentos (departamento_padre_id, orden, nombre);

alter table public.departamento_lideres
    add column if not exists cargo text not null default 'Líder',
    add column if not exists orden integer not null default 0;

comment on column public.departamentos.departamento_padre_id is
    'Permite representar la estructura ministerial sin duplicar personas ni áreas.';
comment on column public.departamento_lideres.cargo is
    'Nombre institucional de la responsabilidad ejercida durante el período.';

commit;
