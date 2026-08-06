-- Casa de Vida
-- Migración 021: recurrencia segura, moneda extranjera y alertas contractuales.

begin;

alter table public.cuentas_por_pagar
    add column if not exists moneda text not null default 'CLP',
    add column if not exists monto_moneda_origen numeric(14, 2),
    add column if not exists tipo_cambio numeric(14, 4),
    add column if not exists comision_clp numeric(14, 2),
    add column if not exists cuenta_anterior_id uuid,
    add column if not exists fecha_inicio_servicio date,
    add column if not exists fecha_revision date,
    add column if not exists aviso_revision_dias integer not null default 30,
    add column if not exists nota_revision text;

do $$
begin
    if not exists (select 1 from pg_constraint where conname = 'cuentas_moneda_valida') then
        alter table public.cuentas_por_pagar add constraint cuentas_moneda_valida check (moneda in ('CLP', 'USD'));
    end if;
    if not exists (select 1 from pg_constraint where conname = 'cuentas_anterior_fkey') then
        alter table public.cuentas_por_pagar add constraint cuentas_anterior_fkey foreign key (cuenta_anterior_id) references public.cuentas_por_pagar(id) on delete restrict;
    end if;
    if not exists (select 1 from pg_constraint where conname = 'cuentas_aviso_revision_valido') then
        alter table public.cuentas_por_pagar add constraint cuentas_aviso_revision_valido check (aviso_revision_dias between 0 and 365);
    end if;
end
$$;

create unique index if not exists cuentas_siguiente_unica
    on public.cuentas_por_pagar(cuenta_anterior_id)
    where cuenta_anterior_id is not null;
create index if not exists cuentas_fecha_revision_idx
    on public.cuentas_por_pagar(fecha_revision)
    where fecha_revision is not null;

-- Continúa de manera segura las cuentas recurrentes que ya estaban pagadas
-- antes de activar esta función. El índice impide crear duplicados.
insert into public.cuentas_por_pagar(
    nombre, categoria, proveedor, monto, fecha_vencimiento, frecuencia, estado,
    observaciones, moneda, monto_moneda_origen, cuenta_anterior_id,
    fecha_inicio_servicio, fecha_revision, aviso_revision_dias, nota_revision
)
select
    c.nombre, c.categoria, c.proveedor, c.monto,
    case c.frecuencia
        when 'mensual' then (c.fecha_vencimiento + interval '1 month')::date
        when 'trimestral' then (c.fecha_vencimiento + interval '3 months')::date
        when 'semestral' then (c.fecha_vencimiento + interval '6 months')::date
        when 'anual' then (c.fecha_vencimiento + interval '1 year')::date
    end,
    c.frecuencia, 'pendiente', c.observaciones, c.moneda, c.monto_moneda_origen,
    c.id, c.fecha_inicio_servicio, c.fecha_revision, c.aviso_revision_dias, c.nota_revision
from public.cuentas_por_pagar c
where c.estado = 'pagada'
  and c.frecuencia <> 'unica'
  and not exists (select 1 from public.cuentas_por_pagar s where s.cuenta_anterior_id = c.id)
on conflict (cuenta_anterior_id) where cuenta_anterior_id is not null do nothing;

create or replace function public.registrar_pago_cuenta_recurrente(
    p_cuenta_id uuid,
    p_usuario_id uuid,
    p_total_clp numeric,
    p_fecha_pago date,
    p_moneda text default 'CLP',
    p_monto_origen numeric default null,
    p_tipo_cambio numeric default null,
    p_comision_clp numeric default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_cuenta public.cuentas_por_pagar%rowtype;
    v_egreso public.egresos%rowtype;
    v_siguiente public.cuentas_por_pagar%rowtype;
    v_proximo_vencimiento date;
    v_antes jsonb;
begin
    if p_total_clp is null or p_total_clp <= 0 then raise exception 'El total pagado en CLP debe ser mayor a 0'; end if;
    if p_moneda not in ('CLP', 'USD') then raise exception 'Moneda no válida'; end if;
    if p_moneda = 'USD' and (p_monto_origen is null or p_monto_origen <= 0 or p_tipo_cambio is null or p_tipo_cambio <= 0) then
        raise exception 'Para USD se requieren monto original y tipo de cambio';
    end if;

    select * into v_cuenta from public.cuentas_por_pagar where id = p_cuenta_id for update;
    if not found then raise exception 'Cuenta no encontrada'; end if;
    if v_cuenta.egreso_id is not null then raise exception 'Esta cuenta ya tiene un egreso asociado'; end if;
    if v_cuenta.estado not in ('pendiente', 'pagada') then raise exception 'La cuenta no puede registrarse como pagada'; end if;
    v_antes := to_jsonb(v_cuenta);

    insert into public.egresos(item, categoria, proveedor, monto, fecha, observaciones, registrado_por)
    values (
        v_cuenta.nombre, v_cuenta.categoria, v_cuenta.proveedor, p_total_clp, p_fecha_pago,
        concat('Cuenta por pagar', case when p_moneda = 'USD' then concat(': USD ', p_monto_origen, ' · cambio ', p_tipo_cambio, ' · comisión CLP ', coalesce(p_comision_clp, 0)) else '' end,
               case when v_cuenta.observaciones is not null then concat(' · ', v_cuenta.observaciones) else '' end),
        p_usuario_id
    ) returning * into v_egreso;

    update public.cuentas_por_pagar set
        estado = 'pagada', fecha_pago = p_fecha_pago::timestamptz, monto = p_total_clp,
        moneda = p_moneda, monto_moneda_origen = p_monto_origen,
        tipo_cambio = p_tipo_cambio, comision_clp = coalesce(p_comision_clp, 0), egreso_id = v_egreso.id
    where id = v_cuenta.id returning * into v_cuenta;

    if v_cuenta.frecuencia <> 'unica' then
        v_proximo_vencimiento := case v_cuenta.frecuencia
            when 'mensual' then (v_cuenta.fecha_vencimiento + interval '1 month')::date
            when 'trimestral' then (v_cuenta.fecha_vencimiento + interval '3 months')::date
            when 'semestral' then (v_cuenta.fecha_vencimiento + interval '6 months')::date
            when 'anual' then (v_cuenta.fecha_vencimiento + interval '1 year')::date
        end;

        insert into public.cuentas_por_pagar(
            nombre, categoria, proveedor, monto, fecha_vencimiento, frecuencia, estado, observaciones,
            moneda, monto_moneda_origen, cuenta_anterior_id, fecha_inicio_servicio,
            fecha_revision, aviso_revision_dias, nota_revision
        ) values (
            v_cuenta.nombre, v_cuenta.categoria, v_cuenta.proveedor, v_cuenta.monto,
            v_proximo_vencimiento, v_cuenta.frecuencia, 'pendiente', v_cuenta.observaciones,
            v_cuenta.moneda, v_cuenta.monto_moneda_origen, v_cuenta.id, v_cuenta.fecha_inicio_servicio,
            v_cuenta.fecha_revision, v_cuenta.aviso_revision_dias, v_cuenta.nota_revision
        )
        on conflict (cuenta_anterior_id) where cuenta_anterior_id is not null do nothing
        returning * into v_siguiente;
    end if;

    insert into public.auditoria(usuario_id, accion, tabla, registro_id, datos_antes, datos_despues)
    values (p_usuario_id, 'MARCAR_PAGADA', 'cuentas_por_pagar', v_cuenta.id, v_antes, to_jsonb(v_cuenta));

    return jsonb_build_object('cuenta', to_jsonb(v_cuenta), 'egreso', to_jsonb(v_egreso), 'siguiente', to_jsonb(v_siguiente));
end;
$$;

revoke all on function public.registrar_pago_cuenta_recurrente(uuid, uuid, numeric, date, text, numeric, numeric, numeric) from public, anon, authenticated;
grant execute on function public.registrar_pago_cuenta_recurrente(uuid, uuid, numeric, date, text, numeric, numeric, numeric) to service_role;

comment on column public.cuentas_por_pagar.fecha_revision is 'Fecha de término de promoción, contrato o revisión comercial.';
comment on column public.cuentas_por_pagar.cuenta_anterior_id is 'Garantiza una única continuidad para cada vencimiento recurrente.';

commit;
