-- Casa de Vida
-- Migración 022: edición pendiente y cierre trazable de recurrencias.

begin;

alter table public.cuentas_por_pagar
    add column if not exists fecha_anulacion timestamptz,
    add column if not exists motivo_anulacion text,
    add column if not exists anulada_por uuid;

update public.cuentas_por_pagar
set fecha_anulacion = coalesce(fecha_anulacion, updated_at, now()),
    motivo_anulacion = coalesce(motivo_anulacion, 'Registro anulado antes de habilitar el motivo obligatorio')
where estado = 'anulada';

do $$
begin
    if not exists (select 1 from pg_constraint where conname = 'cuentas_anulada_por_fkey') then
        alter table public.cuentas_por_pagar add constraint cuentas_anulada_por_fkey
            foreign key (anulada_por) references public.usuarios(id) on delete set null;
    end if;
    if not exists (select 1 from pg_constraint where conname = 'cuentas_anulacion_coherente') then
        alter table public.cuentas_por_pagar add constraint cuentas_anulacion_coherente check (
            (estado = 'anulada' and fecha_anulacion is not null and motivo_anulacion is not null)
            or (estado <> 'anulada' and fecha_anulacion is null and motivo_anulacion is null)
        );
    end if;
end
$$;

comment on column public.cuentas_por_pagar.motivo_anulacion is
    'Explica el cierre anticipado, cambio de proveedor o término de la recurrencia sin borrar su historia.';

commit;
