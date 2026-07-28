-- Casa de Vida
-- Migración 009: equipos, integrantes, liderazgo y audiencias por equipo.
--
-- Requiere:
--   006_base_personas_roles.sql
--   007_catalogo_permisos.sql
--   008_audiencias_eventos.sql

begin;

create table if not exists public.equipos (
    id uuid primary key default gen_random_uuid(),
    codigo text not null unique,
    nombre text not null,
    descripcion text,
    activo boolean not null default true,
    creado_por uuid references public.usuarios(id) on delete set null,
    creado_en timestamptz not null default now(),
    actualizado_en timestamptz not null default now(),
    constraint equipos_codigo_valido
        check (codigo ~ '^[a-z][a-z0-9_]{2,49}$'),
    constraint equipos_nombre_valido
        check (char_length(trim(nombre)) between 2 and 100)
);

create table if not exists public.equipo_integrantes (
    id uuid primary key default gen_random_uuid(),
    equipo_id uuid not null references public.equipos(id) on delete restrict,
    persona_id uuid not null references public.personas(id) on delete restrict,
    funcion text not null default 'integrante'
        check (funcion in ('integrante', 'lider')),
    estado text not null default 'activo'
        check (estado in ('activo', 'inactivo')),
    fecha_inicio date not null default current_date,
    fecha_fin date,
    asignado_por uuid references public.usuarios(id) on delete set null,
    creado_en timestamptz not null default now(),
    actualizado_en timestamptz not null default now(),
    constraint equipo_integrantes_fechas_coherentes
        check (fecha_fin is null or fecha_fin >= fecha_inicio),
    constraint equipo_integrantes_cierre_coherente
        check (
            (estado = 'activo' and fecha_fin is null)
            or estado = 'inactivo'
        )
);

create unique index if not exists equipo_integrantes_activos_unicos
    on public.equipo_integrantes (equipo_id, persona_id)
    where estado = 'activo';

create index if not exists equipo_integrantes_persona_busqueda
    on public.equipo_integrantes (persona_id)
    where estado = 'activo';

create index if not exists equipo_integrantes_lideres_busqueda
    on public.equipo_integrantes (equipo_id, persona_id)
    where estado = 'activo' and funcion = 'lider';

alter table public.eventos
    add column if not exists equipo_organizador_id uuid;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'eventos_equipo_organizador_id_fkey'
          and conrelid = 'public.eventos'::regclass
    ) then
        alter table public.eventos
            add constraint eventos_equipo_organizador_id_fkey
            foreign key (equipo_organizador_id)
            references public.equipos(id)
            on delete restrict;
    end if;
end
$$;

alter table public.evento_audiencias
    add column if not exists equipo_id uuid;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'evento_audiencias_equipo_id_fkey'
          and conrelid = 'public.evento_audiencias'::regclass
    ) then
        alter table public.evento_audiencias
            add constraint evento_audiencias_equipo_id_fkey
            foreign key (equipo_id)
            references public.equipos(id)
            on delete cascade;
    end if;
end
$$;

alter table public.evento_audiencias
    drop constraint if exists evento_audiencias_tipo_check;

alter table public.evento_audiencias
    add constraint evento_audiencias_tipo_check
    check (tipo in ('publica', 'miembros', 'rol', 'equipo'));

alter table public.evento_audiencias
    drop constraint if exists evento_audiencias_destino_coherente;

alter table public.evento_audiencias
    add constraint evento_audiencias_destino_coherente
    check (
        (tipo = 'rol' and rol_id is not null and equipo_id is null)
        or (tipo = 'equipo' and equipo_id is not null and rol_id is null)
        or (
            tipo in ('publica', 'miembros')
            and rol_id is null
            and equipo_id is null
        )
    );

create unique index if not exists evento_audiencias_equipos_unicas
    on public.evento_audiencias (evento_id, equipo_id)
    where tipo = 'equipo';

create index if not exists evento_audiencias_equipo_busqueda
    on public.evento_audiencias (equipo_id)
    where equipo_id is not null;

alter table public.equipos enable row level security;
alter table public.equipo_integrantes enable row level security;

comment on table public.equipos is
    'Equipos ministeriales u operativos de Casa de Vida.';
comment on table public.equipo_integrantes is
    'Relaciona personas con equipos y limita el liderazgo al equipo asignado.';

commit;
