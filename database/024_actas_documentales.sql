-- Casa de Vida
-- Migración 024: búsqueda documental y ciclo de cierre de actas.

begin;

alter table public.actas
    add column if not exists cerrada_en timestamptz,
    add column if not exists cerrada_por uuid,
    add column if not exists reabierta_en timestamptz,
    add column if not exists reabierta_por uuid,
    add column if not exists motivo_reapertura text;

do $$
begin
    if not exists (select 1 from pg_constraint where conname='actas_cerrada_por_fkey') then
        alter table public.actas add constraint actas_cerrada_por_fkey foreign key(cerrada_por) references public.usuarios(id) on delete set null;
    end if;
    if not exists (select 1 from pg_constraint where conname='actas_reabierta_por_fkey') then
        alter table public.actas add constraint actas_reabierta_por_fkey foreign key(reabierta_por) references public.usuarios(id) on delete set null;
    end if;
end
$$;

alter table public.actas
    add column if not exists busqueda tsvector generated always as (
        to_tsvector('spanish', coalesce(titulo,'') || ' ' || coalesce(objetivo,'') || ' ' || coalesce(desarrollo,'') || ' ' || coalesce(observaciones,''))
    ) stored;

create index if not exists actas_busqueda_idx on public.actas using gin(busqueda);

comment on column public.actas.busqueda is 'Índice de texto completo para localizar temas sin releer todas las actas.';
comment on column public.actas.motivo_reapertura is 'Justificación auditada de la última reapertura de un acta cerrada.';

commit;
