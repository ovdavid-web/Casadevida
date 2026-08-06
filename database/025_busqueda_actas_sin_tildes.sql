-- Casa de Vida
-- Migración 025: búsqueda de actas insensible a tildes.

begin;

create extension if not exists unaccent with schema extensions;

create or replace function public.normalizar_texto_busqueda(valor text)
returns text
language sql
immutable
strict
parallel safe
set search_path = public, extensions
as $$
    select extensions.unaccent(valor)
$$;

alter table public.actas
    add column if not exists busqueda_normalizada tsvector generated always as (
        to_tsvector(
            'spanish',
            public.normalizar_texto_busqueda(
                coalesce(titulo,'') || ' ' ||
                coalesce(objetivo,'') || ' ' ||
                coalesce(desarrollo,'') || ' ' ||
                coalesce(observaciones,'')
            )
        )
    ) stored;

create index if not exists actas_busqueda_normalizada_idx
    on public.actas using gin(busqueda_normalizada);

comment on column public.actas.busqueda_normalizada is
    'Índice documental que permite buscar indistintamente con o sin tildes.';

commit;
