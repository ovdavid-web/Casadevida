-- Casa de Vida
-- Migración 009: departamentos o grupos y actividades asociadas.
--
-- Requiere:
--   006_base_personas_roles.sql
--   007_catalogo_permisos.sql
--   008_audiencias_eventos.sql

begin;

create table if not exists public.departamentos (
    id uuid primary key default gen_random_uuid(),
    codigo text not null unique,
    nombre text not null,
    descripcion text,
    activo boolean not null default true,
    creado_por uuid references public.usuarios(id) on delete set null,
    creado_en timestamptz not null default now(),
    actualizado_en timestamptz not null default now(),
    constraint departamentos_codigo_valido
        check (codigo ~ '^[a-z][a-z0-9_]{2,49}$'),
    constraint departamentos_nombre_valido
        check (char_length(trim(nombre)) between 2 and 100)
);

create table if not exists public.departamento_lideres (
    id uuid primary key default gen_random_uuid(),
    departamento_id uuid not null
        references public.departamentos(id)
        on delete restrict,
    persona_id uuid not null
        references public.personas(id)
        on delete restrict,
    estado text not null default 'activo'
        check (estado in ('activo', 'inactivo')),
    fecha_inicio date not null default current_date,
    fecha_fin date,
    asignado_por uuid references public.usuarios(id) on delete set null,
    creado_en timestamptz not null default now(),
    actualizado_en timestamptz not null default now(),
    constraint departamento_lideres_fechas_coherentes
        check (fecha_fin is null or fecha_fin >= fecha_inicio),
    constraint departamento_lideres_cierre_coherente
        check (
            (estado = 'activo' and fecha_fin is null)
            or estado = 'inactivo'
        )
);

create unique index if not exists departamento_lideres_activos_unicos
    on public.departamento_lideres (departamento_id, persona_id)
    where estado = 'activo';

create index if not exists departamento_lideres_persona_busqueda
    on public.departamento_lideres (persona_id)
    where estado = 'activo';

alter table public.eventos
    add column if not exists departamento_id uuid;

alter table public.eventos
    add column if not exists responsable_persona_id uuid;

alter table public.eventos
    add column if not exists frecuencia text not null default 'unica';

alter table public.eventos
    add column if not exists repetir_hasta date;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'eventos_departamento_id_fkey'
          and conrelid = 'public.eventos'::regclass
    ) then
        alter table public.eventos
            add constraint eventos_departamento_id_fkey
            foreign key (departamento_id)
            references public.departamentos(id)
            on delete restrict;
    end if;

    if not exists (
        select 1
        from pg_constraint
        where conname = 'eventos_responsable_persona_id_fkey'
          and conrelid = 'public.eventos'::regclass
    ) then
        alter table public.eventos
            add constraint eventos_responsable_persona_id_fkey
            foreign key (responsable_persona_id)
            references public.personas(id)
            on delete set null;
    end if;
end
$$;

alter table public.eventos
    drop constraint if exists eventos_frecuencia_valida;

alter table public.eventos
    add constraint eventos_frecuencia_valida
    check (frecuencia in ('unica', 'semanal', 'quincenal', 'mensual'));

alter table public.eventos
    drop constraint if exists eventos_repeticion_coherente;

alter table public.eventos
    add constraint eventos_repeticion_coherente
    check (
        (frecuencia = 'unica' and repetir_hasta is null)
        or (
            frecuencia <> 'unica'
            and (
                repetir_hasta is null
                or repetir_hasta >= fecha_inicio::date
            )
        )
    );

alter table public.evento_audiencias
    add column if not exists departamento_id uuid;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'evento_audiencias_departamento_id_fkey'
          and conrelid = 'public.evento_audiencias'::regclass
    ) then
        alter table public.evento_audiencias
            add constraint evento_audiencias_departamento_id_fkey
            foreign key (departamento_id)
            references public.departamentos(id)
            on delete cascade;
    end if;
end
$$;

alter table public.evento_audiencias
    drop constraint if exists evento_audiencias_tipo_check;

alter table public.evento_audiencias
    add constraint evento_audiencias_tipo_check
    check (tipo in ('publica', 'miembros', 'rol', 'departamento'));

alter table public.evento_audiencias
    drop constraint if exists evento_audiencias_destino_coherente;

alter table public.evento_audiencias
    add constraint evento_audiencias_destino_coherente
    check (
        (tipo = 'rol' and rol_id is not null and departamento_id is null)
        or (
            tipo = 'departamento'
            and departamento_id is not null
            and rol_id is null
        )
        or (
            tipo in ('publica', 'miembros')
            and rol_id is null
            and departamento_id is null
        )
    );

create unique index if not exists evento_audiencias_departamentos_unicas
    on public.evento_audiencias (evento_id, departamento_id)
    where tipo = 'departamento';

create index if not exists evento_audiencias_departamento_busqueda
    on public.evento_audiencias (departamento_id)
    where departamento_id is not null;

alter table public.departamentos enable row level security;
alter table public.departamento_lideres enable row level security;

comment on table public.departamentos is
    'Departamentos, grupos, programas, cursos o ministerios que organizan actividades.';
comment on table public.departamento_lideres is
    'Limita a cada líder a los departamentos o grupos que tiene asignados.';

commit;
