-- Vincula cada cuenta pagada con el egreso generado al confirmar su pago.
-- La relación única evita que una cuenta produzca el mismo egreso dos veces.

alter table public.cuentas_por_pagar
    add column if not exists egreso_id uuid;

alter table public.cuentas_por_pagar
    drop constraint if exists cuentas_por_pagar_egreso_id_fkey;

alter table public.cuentas_por_pagar
    add constraint cuentas_por_pagar_egreso_id_fkey
    foreign key (egreso_id)
    references public.egresos(id)
    on delete set null;

create unique index if not exists cuentas_por_pagar_egreso_unico_idx
    on public.cuentas_por_pagar (egreso_id)
    where egreso_id is not null;

comment on column public.cuentas_por_pagar.egreso_id is
    'Egreso creado al confirmar el pago; impide generar movimientos duplicados.';
