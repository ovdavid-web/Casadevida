-- Casa de Vida
-- Migración 014: edición sincronizada de miembro y persona.

begin;

create or replace function public.actualizar_miembro_con_persona(
    p_miembro_id uuid,
    p_nombre text,
    p_rut text,
    p_correo text default null,
    p_telefono text default null,
    p_fecha_bautismo date default null,
    p_direccion text default null,
    p_fecha_ingreso date default null,
    p_activo boolean default true,
    p_actor_id uuid default null
)
returns public.miembros
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_rut_normalizado text;
    v_cuerpo text;
    v_dv text;
    v_antes public.miembros;
    v_despues public.miembros;
    v_persona_id uuid;
begin
    if p_nombre is null
       or char_length(btrim(p_nombre)) < 2
       or char_length(btrim(p_nombre)) > 100 then
        raise exception using errcode = '22023', message = 'El nombre debe tener entre 2 y 100 caracteres.';
    end if;

    v_rut_normalizado := upper(regexp_replace(coalesce(p_rut, ''), '[^0-9kK]', '', 'g'));
    if v_rut_normalizado !~ '^[0-9]{7,8}[0-9K]$' then
        raise exception using errcode = '22023', message = 'El RUT ingresado no tiene un formato válido.';
    end if;
    v_cuerpo := left(v_rut_normalizado, -1);
    v_dv := right(v_rut_normalizado, 1);

    select m.*
    into v_antes
    from public.miembros m
    where m.id = p_miembro_id
    for update;

    if not found then
        raise exception using errcode = 'P0002', message = 'Miembro no encontrado.';
    end if;
    if v_antes.persona_id is null then
        raise exception using errcode = '23502', message = 'El miembro no tiene una persona asociada.';
    end if;

    v_persona_id := v_antes.persona_id;
    perform 1 from public.personas where id = v_persona_id for update;

    if exists (
        select 1
        from public.personas
        where tipo_documento = 'rut'
          and upper(documento_normalizado) = v_rut_normalizado
          and id <> v_persona_id
    ) then
        raise exception using errcode = '23505', message = 'Ya existe otra persona registrada con este RUT.';
    end if;

    update public.personas
    set
        documento_normalizado = v_rut_normalizado,
        nombres = btrim(p_nombre),
        correo = nullif(lower(btrim(p_correo)), ''),
        telefono = nullif(btrim(p_telefono), ''),
        direccion = nullif(btrim(p_direccion), ''),
        estado = case when p_activo then 'activo' else 'inactivo' end,
        actualizado_en = now()
    where id = v_persona_id;

    update public.miembros
    set
        nombre = btrim(p_nombre),
        rut = v_cuerpo || '-' || v_dv,
        correo = nullif(lower(btrim(p_correo)), ''),
        telefono = nullif(btrim(p_telefono), ''),
        fecha_bautismo = p_fecha_bautismo,
        direccion = nullif(btrim(p_direccion), ''),
        fecha_ingreso = coalesce(p_fecha_ingreso, fecha_ingreso),
        activo = p_activo,
        estado = case when p_activo then 'activo' else 'inactivo' end
    where id = p_miembro_id
    returning * into v_despues;

    if p_activo then
        if not exists (
            select 1 from public.vinculos_iglesia
            where persona_id = v_persona_id and estado = 'activo'
        ) then
            insert into public.vinculos_iglesia (
                persona_id, tipo, estado, fecha_inicio
            )
            values (
                v_persona_id, 'miembro', 'activo',
                coalesce(p_fecha_ingreso, v_despues.fecha_ingreso, current_date)
            );
        end if;
    else
        update public.vinculos_iglesia
        set
            estado = 'inactivo',
            fecha_fin = greatest(fecha_inicio, current_date),
            motivo_fin = coalesce(motivo_fin, 'Miembro desactivado administrativamente'),
            actualizado_en = now()
        where persona_id = v_persona_id
          and tipo = 'miembro'
          and estado = 'activo';
    end if;

    insert into public.auditoria (
        usuario_id, accion, tabla, registro_id, datos_antes, datos_despues
    )
    values (
        p_actor_id, 'MODIFICAR', 'miembros', p_miembro_id,
        to_jsonb(v_antes), to_jsonb(v_despues)
    );

    return v_despues;
end;
$$;

revoke all on function public.actualizar_miembro_con_persona(
    uuid, text, text, text, text, date, text, date, boolean, uuid
) from public;

do $$
begin
    if exists (select 1 from pg_roles where rolname = 'service_role') then
        execute $grant$
            grant execute on function public.actualizar_miembro_con_persona(
                uuid, text, text, text, text, date, text, date, boolean, uuid
            ) to service_role
        $grant$;
    end if;
end
$$;

notify pgrst, 'reload schema';

commit;
