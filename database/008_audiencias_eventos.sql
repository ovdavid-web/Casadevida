-- Casa de Vida
-- Migración 008: audiencias explícitas para actividades y eventos.
--
-- Requiere:
--   006_base_personas_roles.sql
--   007_catalogo_permisos.sql
--
-- Esta migración no cambia todavía la forma en que el backend consulta eventos.

begin;

alter table public.eventos
    add column if not exists creado_por uuid;

alter table public.eventos
    add column if not exists actualizado_por uuid;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'eventos_creado_por_fkey'
          and conrelid = 'public.eventos'::regclass
    ) then
        alter table public.eventos
            add constraint eventos_creado_por_fkey
            foreign key (creado_por)
            references public.usuarios(id)
            on delete set null;
    end if;

    if not exists (
        select 1
        from pg_constraint
        where conname = 'eventos_actualizado_por_fkey'
          and conrelid = 'public.eventos'::regclass
    ) then
        alter table public.eventos
            add constraint eventos_actualizado_por_fkey
            foreign key (actualizado_por)
            references public.usuarios(id)
            on delete set null;
    end if;
end
$$;

create table if not exists public.evento_audiencias (
    id uuid primary key default gen_random_uuid(),
    evento_id uuid not null
        references public.eventos(id)
        on delete cascade,
    tipo text not null
        check (tipo in ('publica', 'miembros', 'rol')),
    rol_id uuid
        references public.roles(id)
        on delete cascade,
    creado_por uuid
        references public.usuarios(id)
        on delete set null,
    creado_en timestamptz not null default now(),
    constraint evento_audiencias_destino_coherente
        check (
            (tipo = 'rol' and rol_id is not null)
            or (tipo in ('publica', 'miembros') and rol_id is null)
        )
);

create unique index if not exists evento_audiencias_generales_unicas
    on public.evento_audiencias (evento_id, tipo)
    where tipo in ('publica', 'miembros');

create unique index if not exists evento_audiencias_roles_unicas
    on public.evento_audiencias (evento_id, rol_id)
    where tipo = 'rol';

create index if not exists evento_audiencias_evento_busqueda
    on public.evento_audiencias (evento_id);

create index if not exists evento_audiencias_rol_busqueda
    on public.evento_audiencias (rol_id)
    where rol_id is not null;

-- Conserva la visibilidad de los eventos públicos existentes.
insert into public.evento_audiencias (evento_id, tipo)
select e.id, 'publica'
from public.eventos e
where e.visibilidad = 'publica'
on conflict do nothing;

-- Los eventos internos antiguos quedan restringidos por defecto.
insert into public.evento_audiencias (evento_id, tipo, rol_id)
select e.id, 'rol', r.id
from public.eventos e
cross join public.roles r
where e.visibilidad <> 'publica'
  and r.codigo in ('superadmin', 'pastor')
on conflict do nothing;

alter table public.evento_audiencias enable row level security;

comment on table public.evento_audiencias is
    'Define quién puede ver un evento: público, miembros o roles específicos.';

commit;
