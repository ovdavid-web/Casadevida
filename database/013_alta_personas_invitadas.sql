-- Casa de Vida
-- Migración 013: alta transaccional de personas invitadas.
--
-- Una persona invitada no crea membresía, usuario ni roles. Si posteriormente
-- se convierte en miembro, la función de membresía reutiliza esta identidad.

begin;

create or replace function public.crear_persona_invitada(
    p_nombre text,
    p_rut text,
    p_correo text default null,
    p_telefono text default null,
    p_direccion text default null,
    p_fecha_inicio date default current_date,
    p_activo boolean default true,
    p_actor_id uuid default null
)
returns public.personas
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
    v_vinculo_activo public.vinculos_iglesia;
begin
    if p_nombre is null
       or char_length(btrim(p_nombre)) < 2
       or char_length(btrim(p_nombre)) > 120 then
        raise exception using
            errcode = '22023',
            message = 'El nombre debe tener entre 2 y 120 caracteres.';
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
        select v.*
        into v_vinculo_activo
        from public.vinculos_iglesia v
        where v.persona_id = v_persona.id
          and v.estado = 'activo'
        for update;

        if found then
            raise exception using
                errcode = '23505',
                message = case
                    when v_vinculo_activo.tipo = 'miembro'
                        then 'Esta persona ya está registrada como miembro.'
                    else 'Esta persona ya tiene un vínculo activo con la iglesia.'
                end;
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

    insert into public.vinculos_iglesia (
        persona_id, tipo, estado, fecha_inicio, fecha_fin, motivo_fin
    )
    values (
        v_persona.id,
        'invitado',
        case when p_activo then 'activo' else 'inactivo' end,
        coalesce(p_fecha_inicio, current_date),
        null,
        case when p_activo then null else 'Invitado registrado inicialmente como inactivo' end
    );

    insert into public.auditoria (
        usuario_id, accion, tabla, registro_id, datos_despues
    )
    values (
        p_actor_id,
        'CREAR',
        'personas',
        v_persona.id,
        to_jsonb(v_persona) || jsonb_build_object('tipo_vinculo', 'invitado')
    );

    return v_persona;
end;
$$;

revoke all on function public.crear_persona_invitada(
    text, text, text, text, text, date, boolean, uuid
) from public;

do $$
begin
    if exists (select 1 from pg_roles where rolname = 'service_role') then
        execute $grant$
            grant execute on function public.crear_persona_invitada(
                text, text, text, text, text, date, boolean, uuid
            ) to service_role
        $grant$;
    end if;
end
$$;

comment on function public.crear_persona_invitada(
    text, text, text, text, text, date, boolean, uuid
) is
    'Crea o reactiva una identidad como invitado sin conceder membresía, usuario ni roles.';

notify pgrst, 'reload schema';

commit;
