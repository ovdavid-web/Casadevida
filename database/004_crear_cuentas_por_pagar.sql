-- Cuentas y compromisos pendientes de Casa de Vida.
-- Una cuenta pagada todavía NO genera automáticamente un egreso.

create extension if not exists pgcrypto;

create table if not exists public.cuentas_por_pagar (
    id uuid primary key default gen_random_uuid(),
    nombre text not null,
    categoria text not null default 'Otro',
    proveedor text,
    monto numeric(12, 2),
    fecha_vencimiento date not null,
    frecuencia text not null default 'unica',
    estado text not null default 'pendiente',
    observaciones text,
    fecha_pago timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint cuentas_por_pagar_nombre_valido
        check (char_length(trim(nombre)) between 2 and 150),
    constraint cuentas_por_pagar_monto_valido
        check (monto is null or monto > 0),
    constraint cuentas_por_pagar_categoria_valida
        check (categoria in (
            'Infraestructura',
            'Pastoral',
            'Operacional',
            'Ministerial',
            'Tecnología',
            'Otro'
        )),
    constraint cuentas_por_pagar_frecuencia_valida
        check (frecuencia in (
            'unica',
            'mensual',
            'trimestral',
            'semestral',
            'anual'
        )),
    constraint cuentas_por_pagar_estado_valido
        check (estado in (
            'pendiente',
            'pagada',
            'anulada'
        )),
    constraint cuentas_por_pagar_fecha_pago_coherente
        check (
            (estado = 'pagada' and fecha_pago is not null)
            or
            (estado <> 'pagada' and fecha_pago is null)
        )
);

create index if not exists cuentas_por_pagar_estado_idx
    on public.cuentas_por_pagar (estado);

create index if not exists cuentas_por_pagar_vencimiento_idx
    on public.cuentas_por_pagar (fecha_vencimiento);

create or replace function public.actualizar_fecha_cuentas_por_pagar()
returns trigger
language plpgsql
set search_path = public
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists cuentas_por_pagar_actualizar_fecha
    on public.cuentas_por_pagar;

create trigger cuentas_por_pagar_actualizar_fecha
before update on public.cuentas_por_pagar
for each row
execute function public.actualizar_fecha_cuentas_por_pagar();

alter table public.cuentas_por_pagar enable row level security;

comment on table public.cuentas_por_pagar is
    'Compromisos financieros pendientes; no representan egresos hasta que el pago sea registrado.';

comment on column public.cuentas_por_pagar.estado is
    'La condición vencida se calcula comparando fecha_vencimiento con la fecha actual.';

comment on column public.cuentas_por_pagar.frecuencia is
    'Dato informativo inicial; la generación automática de próximos vencimientos se implementará después.';
