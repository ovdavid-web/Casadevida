-- Casa de Vida
-- Migración 006: base escalable de personas, vínculos y RBAC.
--
-- IMPORTANTE:
--   1. Esta migración es aditiva.
--   2. No elimina ni migra datos de miembros o usuarios.
--   3. No sustituye todavía usuarios.rol.
--   4. Debe revisarse antes de ejecutarse en Supabase.

begin;

create table if not exists public.personas (
    id uuid primary key default gen_random_uuid(),
    tipo_documento text not null default 'rut'
        check (tipo_documento in ('rut', 'pasaporte', 'otro')),
    documento_normalizado text,
    nombres text not null,
    apellidos text,
    correo text,
    correo_verificado boolean not null default false,
    telefono text,
    fecha_nacimiento date,
    direccion text,
    estado text not null default 'activo'
        check (estado in ('activo', 'inactivo', 'fallecido')),
    creado_en timestamptz not null default now(),
    actualizado_en timestamptz not null default now(),
    constraint personas_nombres_validos
        check (char_length(trim(nombres)) between 2 and 120),
    constraint personas_documento_requerido
        check (
            documento_normalizado is not null
            and char_length(trim(documento_normalizado)) between 3 and 40
        )
);

create unique index if not exists personas_documento_unico
    on public.personas (tipo_documento, upper(documento_normalizado));

create index if not exists personas_correo_busqueda
    on public.personas (lower(correo))
    where correo is not null;

create table if not exists public.vinculos_iglesia (
    id uuid primary key default gen_random_uuid(),
    persona_id uuid not null references public.personas(id) on delete restrict,
    tipo text not null
        check (tipo in ('invitado', 'participante', 'congregante', 'miembro')),
    estado text not null default 'activo'
        check (estado in ('activo', 'inactivo')),
    fecha_inicio date not null default current_date,
    fecha_fin date,
    motivo_fin text,
    creado_en timestamptz not null default now(),
    actualizado_en timestamptz not null default now(),
    constraint vinculos_fechas_coherentes
        check (fecha_fin is null or fecha_fin >= fecha_inicio),
    constraint vinculos_cierre_coherente
        check (
            (estado = 'activo' and fecha_fin is null)
            or estado = 'inactivo'
        )
);

create unique index if not exists vinculos_persona_activo_unico
    on public.vinculos_iglesia (persona_id)
    where estado = 'activo';

create table if not exists public.roles (
    id uuid primary key default gen_random_uuid(),
    codigo text not null unique,
    nombre text not null,
    descripcion text,
    es_critico boolean not null default false,
    activo boolean not null default true,
    creado_en timestamptz not null default now(),
    constraint roles_codigo_valido
        check (codigo ~ '^[a-z][a-z0-9_]{2,49}$')
);

create table if not exists public.permisos (
    id uuid primary key default gen_random_uuid(),
    codigo text not null unique,
    modulo text not null,
    accion text not null,
    descripcion text,
    creado_en timestamptz not null default now(),
    constraint permisos_codigo_valido
        check (codigo ~ '^[a-z][a-z0-9_.]{2,79}$')
);

create table if not exists public.rol_permisos (
    rol_id uuid not null references public.roles(id) on delete cascade,
    permiso_id uuid not null references public.permisos(id) on delete cascade,
    creado_en timestamptz not null default now(),
    primary key (rol_id, permiso_id)
);

create table if not exists public.usuario_roles (
    usuario_id uuid not null references public.usuarios(id) on delete cascade,
    rol_id uuid not null references public.roles(id) on delete restrict,
    asignado_por uuid references public.usuarios(id) on delete set null,
    asignado_en timestamptz not null default now(),
    activo boolean not null default true,
    primary key (usuario_id, rol_id)
);

alter table public.usuarios
    add column if not exists persona_id uuid;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'usuarios_persona_id_fkey'
          and conrelid = 'public.usuarios'::regclass
    ) then
        alter table public.usuarios
            add constraint usuarios_persona_id_fkey
            foreign key (persona_id)
            references public.personas(id)
            on delete restrict;
    end if;
end
$$;

create unique index if not exists usuarios_persona_unica
    on public.usuarios (persona_id)
    where persona_id is not null;

insert into public.roles (codigo, nombre, descripcion, es_critico)
values
    ('superadmin', 'Superadministrador', 'Control completo y seguridad del sistema', true),
    ('pastor', 'Pastor', 'Gestión pastoral y administrativa amplia', true),
    ('tesorero', 'Tesorero', 'Gestión completa del módulo financiero', true),
    ('oficial', 'Oficial', 'Funciones logísticas autorizadas', false),
    ('secretaria', 'Secretaría', 'Gestión de actas, registros eclesiásticos y memoria institucional', true),
    ('lider', 'Líder', 'Coordinación de los equipos que dirige', false),
    ('editor_contenido', 'Editor de contenido', 'Gestión y publicación del contenido público', true),
    ('voluntario', 'Voluntario', 'Acceso a convocatorias y actividades del equipo de servicio', false),
    ('miembro', 'Miembro', 'Acceso personal y futuras inscripciones educativas', false)
on conflict (codigo) do update
set
    nombre = excluded.nombre,
    descripcion = excluded.descripcion,
    es_critico = excluded.es_critico;

alter table public.personas enable row level security;
alter table public.vinculos_iglesia enable row level security;
alter table public.roles enable row level security;
alter table public.permisos enable row level security;
alter table public.rol_permisos enable row level security;
alter table public.usuario_roles enable row level security;

comment on table public.personas is
    'Identidad central. Una persona puede existir sin usuario y sin membresía.';
comment on table public.vinculos_iglesia is
    'Historial del vínculo de una persona con Casa de Vida.';
comment on table public.usuario_roles is
    'Roles acumulables asignados a cada cuenta de usuario.';

commit;
