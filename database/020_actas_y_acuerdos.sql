-- Casa de Vida
-- Migración 020: actas institucionales y libro de acuerdos.

begin;

create table if not exists public.actas (
    id uuid primary key default gen_random_uuid(),
    numero integer generated always as identity unique,
    titulo text not null,
    tipo text not null default 'reunion',
    fecha date not null,
    lugar text,
    objetivo text,
    desarrollo text,
    observaciones text,
    estado text not null default 'borrador'
        check (estado in ('borrador', 'cerrada', 'anulada')),
    creado_por uuid references public.usuarios(id) on delete set null,
    actualizado_por uuid references public.usuarios(id) on delete set null,
    creado_en timestamptz not null default now(),
    actualizado_en timestamptz not null default now()
);

create table if not exists public.acta_participantes (
    acta_id uuid not null references public.actas(id) on delete cascade,
    persona_id uuid not null references public.personas(id) on delete restrict,
    calidad text not null default 'asistente',
    primary key (acta_id, persona_id)
);

create table if not exists public.acuerdos (
    id uuid primary key default gen_random_uuid(),
    acta_id uuid references public.actas(id) on delete restrict,
    descripcion text not null,
    responsable_persona_id uuid references public.personas(id) on delete restrict,
    fecha_compromiso date,
    estado text not null default 'pendiente'
        check (estado in ('pendiente', 'en_proceso', 'cumplido', 'cancelado')),
    observaciones text,
    creado_por uuid references public.usuarios(id) on delete set null,
    actualizado_por uuid references public.usuarios(id) on delete set null,
    creado_en timestamptz not null default now(),
    actualizado_en timestamptz not null default now()
);

create index if not exists actas_fecha_idx on public.actas(fecha desc);
create index if not exists acta_participantes_persona_idx on public.acta_participantes(persona_id);
create index if not exists acuerdos_acta_idx on public.acuerdos(acta_id);
create index if not exists acuerdos_responsable_estado_idx on public.acuerdos(responsable_persona_id, estado);

alter table public.actas enable row level security;
alter table public.acta_participantes enable row level security;
alter table public.acuerdos enable row level security;

comment on table public.actas is 'Actas institucionales estructuradas; los documentos se generan bajo petición.';
comment on table public.acuerdos is 'Libro de acuerdos vinculado a actas y responsables del directorio.';

commit;
