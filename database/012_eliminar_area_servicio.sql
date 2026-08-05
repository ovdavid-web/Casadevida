-- Casa de Vida
-- Migración 012: elimina el campo heredado area_servicio.
--
-- Los departamentos y roles se gestionan mediante sus relaciones propias.
-- No se conserva el dato anterior porque no representa el modelo definitivo.

begin;

drop function if exists public.crear_miembro_con_persona(
    text, text, text, text, date, text, text, date, boolean, uuid
);

alter table public.miembros
    drop column if exists area_servicio;

create or replace function public.crear_miembro_con_persona(
    p_nombre text,
    p_rut text,
    p_correo text default null,
    p_telefono text default null,
    p_fecha_bautismo date default null,
    p_direccion text default null,
    p_fecha_ingreso date default current_date,
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
    v_dv_esperado text;
    v_suma integer := 0;
    v_factor integer := 2;
    v_resto integer;
    v_indice integer;
    v_persona public.personas;
    v_miembro public.miembros;
    v_fecha_ingreso date := coalesce(p_fecha_ingreso, current_date);
begin
    if p_nombre is null
       or char_length(btrim(p_nombre)) < 2
       or char_length(btrim(p_nombre)) > 100 then
        raise exception using
            errcode = '22023',
            message = 'El nombre debe tener entre 2 y 100 caracteres.';
    end if;

    v_rut_normalizado := upper(regexp_replace(coalesce(p_rut, ''), '[^0-9kK]', '', 'g'));

    if v_rut_normalizado !~ '^[0-9]{7,8}[0-9K]$' then
        raise exception using
            errcode = '22023',
            message = 'El RUT ingresado no tiene un formato válido.';
    end if;

    v_cuerpo := left(v_rut_normalizado, -1);
    v_dv := right(v_rut_normalizado, 1);

    for v_indice in reverse char_length(v_cuerpo)..1 loop
        v_suma := v_suma + substring(v_cuerpo from v_indice for 1)::integer * v_factor;
        v_factor := case when v_factor = 7 then 2 else v_factor + 1 end;
    end loop;

    v_resto := 11 - (v_suma % 11);
    v_dv_esperado := case
        when v_resto = 11 then '0'
        when v_resto = 10 then 'K'
        else v_resto::text
    end;

    if v_dv <> v_dv_esperado then
        raise exception using
            errcode = '22023',
            message = 'El dígito verificador del RUT no es válido.';
    end if;

    if p_correo is not null and char_length(btrim(p_correo)) > 100 then
        raise exception using errcode = '22023', message = 'El correo supera el máximo de 100 caracteres.';
    end if;
    if p_telefono is not null and char_length(btrim(p_telefono)) > 20 then
        raise exception using errcode = '22023', message = 'El teléfono supera el máximo de 20 caracteres.';
    end if;
    if p_direccion is not null and char_length(btrim(p_direccion)) > 200 then
        raise exception using errcode = '22023', message = 'La dirección supera el máximo de 200 caracteres.';
    end if;

    select p.*
    into v_persona
    from public.personas p
    where p.tipo_documento = 'rut'
      and upper(p.documento_normalizado) = v_rut_normalizado
    for update;

    if found then
        if exists (
            select 1 from public.miembros m where m.persona_id = v_persona.id
        ) then
            raise exception using
                errcode = '23505',
                message = 'Ya existe un miembro registrado con este RUT.';
        end if;

        update public.personas
        set
            nombres = btrim(p_nombre),
            correo = coalesce(nullif(lower(btrim(p_correo)), ''), correo),
            telefono = coalesce(nullif(btrim(p_telefono), ''), telefono),
            direccion = coalesce(nullif(btrim(p_direccion), ''), direccion),
            estado = case when p_activo then 'activo' else 'inactivo' end,
            actualizado_en = now()
        where id = v_persona.id
        returning * into v_persona;
    else
        insert into public.personas (
            tipo_documento, documento_normalizado, nombres, correo,
            telefono, direccion, estado
        )
        values (
            'rut', v_rut_normalizado, btrim(p_nombre),
            nullif(lower(btrim(p_correo)), ''),
            nullif(btrim(p_telefono), ''),
            nullif(btrim(p_direccion), ''),
            case when p_activo then 'activo' else 'inactivo' end
        )
        returning * into v_persona;
    end if;

    insert into public.miembros (
        nombre, rut, correo, telefono, fecha_bautismo, estado,
        activo, fecha_ingreso, direccion, persona_id
    )
    values (
        btrim(p_nombre), v_cuerpo || '-' || v_dv,
        nullif(lower(btrim(p_correo)), ''),
        nullif(btrim(p_telefono), ''),
        p_fecha_bautismo,
        case when p_activo then 'activo' else 'inactivo' end,
        p_activo, v_fecha_ingreso, nullif(btrim(p_direccion), ''),
        v_persona.id
    )
    returning * into v_miembro;

    if p_activo then
        update public.vinculos_iglesia
        set
            estado = 'inactivo',
            fecha_fin = greatest(fecha_inicio, v_fecha_ingreso),
            motivo_fin = coalesce(motivo_fin, 'Cambio de vínculo a miembro'),
            actualizado_en = now()
        where persona_id = v_persona.id
          and estado = 'activo';
    end if;

    insert into public.vinculos_iglesia (
        persona_id, tipo, estado, fecha_inicio, fecha_fin, motivo_fin
    )
    values (
        v_persona.id,
        'miembro',
        case when p_activo then 'activo' else 'inactivo' end,
        v_fecha_ingreso,
        null,
        case when p_activo then null else 'Miembro registrado inicialmente como inactivo' end
    );

    insert into public.auditoria (
        usuario_id, accion, tabla, registro_id, datos_despues
    )
    values (
        p_actor_id, 'CREAR', 'miembros', v_miembro.id, to_jsonb(v_miembro)
    );

    return v_miembro;
end;
$$;

revoke all on function public.crear_miembro_con_persona(
    text, text, text, text, date, text, date, boolean, uuid
) from public;

do $$
begin
    if exists (select 1 from pg_roles where rolname = 'service_role') then
        execute $grant$
            grant execute on function public.crear_miembro_con_persona(
                text, text, text, text, date, text, date, boolean, uuid
            ) to service_role
        $grant$;
    end if;
end
$$;

comment on function public.crear_miembro_con_persona(
    text, text, text, text, date, text, date, boolean, uuid
) is
    'Alta atómica de persona, miembro, vínculo y auditoría, sin campos heredados de área.';

notify pgrst, 'reload schema';

commit;
