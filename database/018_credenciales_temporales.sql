-- Casa de Vida
-- Migración 018: credenciales temporales de un solo uso.

begin;

alter table public.usuarios
    add column if not exists debe_cambiar_password boolean not null default false,
    add column if not exists password_temporal_expira_en timestamptz,
    add column if not exists password_actualizado_en timestamptz;

create or replace function public.crear_usuario_para_persona(
    p_persona_id uuid,
    p_correo text,
    p_password_hash text,
    p_expira_en timestamptz,
    p_actor_id uuid
)
returns table (
    usuario_id uuid,
    persona_id uuid,
    correo text,
    activo boolean,
    debe_cambiar_password boolean,
    password_temporal_expira_en timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_persona public.personas%rowtype;
    v_usuario public.usuarios%rowtype;
    v_correo text := lower(btrim(coalesce(p_correo, '')));
begin
    select *
    into v_persona
    from public.personas
    where id = p_persona_id
    for update;

    if not found then
        raise exception using errcode = 'P0002', message = 'La persona no existe.';
    end if;

    if not exists (
        select 1 from public.miembros m where m.persona_id = p_persona_id
    ) then
        raise exception using errcode = '22023', message = 'Solo los miembros pueden recibir acceso en esta etapa.';
    end if;

    if v_correo !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
        raise exception using errcode = '22023', message = 'Ingresa un correo válido.';
    end if;

    if p_password_hash is null or char_length(p_password_hash) < 50 then
        raise exception using errcode = '22023', message = 'La credencial cifrada no es válida.';
    end if;

    if p_expira_en is null or p_expira_en <= now() then
        raise exception using errcode = '22023', message = 'La fecha de expiración no es válida.';
    end if;

    if exists (select 1 from public.usuarios u where u.persona_id = p_persona_id) then
        raise exception using errcode = '23505', message = 'El miembro ya tiene una cuenta de acceso.';
    end if;

    if exists (select 1 from public.usuarios u where lower(u.correo) = v_correo) then
        raise exception using errcode = '23505', message = 'El correo ya pertenece a una cuenta de acceso.';
    end if;

    insert into public.usuarios (
        nombre,
        correo,
        password_hash,
        rol,
        activo,
        persona_id,
        debe_cambiar_password,
        password_temporal_expira_en
    )
    values (
        concat_ws(' ', v_persona.nombres, v_persona.apellidos),
        v_correo,
        p_password_hash,
        'miembro',
        true,
        p_persona_id,
        true,
        p_expira_en
    )
    returning * into v_usuario;

    update public.personas
    set correo = v_correo,
        actualizado_en = now()
    where id = p_persona_id;

    insert into public.auditoria (
        usuario_id,
        accion,
        tabla,
        registro_id,
        datos_despues
    )
    values (
        p_actor_id,
        'CREAR_ACCESO_TEMPORAL',
        'usuarios',
        v_usuario.id,
        jsonb_build_object(
            'persona_id', p_persona_id,
            'correo', v_correo,
            'expira_en', p_expira_en
        )
    );

    return query
    select
        v_usuario.id,
        v_usuario.persona_id,
        v_usuario.correo::text,
        v_usuario.activo,
        v_usuario.debe_cambiar_password,
        v_usuario.password_temporal_expira_en;
end;
$$;

revoke all on function public.crear_usuario_para_persona(uuid, text, text, timestamptz, uuid) from public;

do $$
begin
    if exists (select 1 from pg_roles where rolname = 'anon') then
        revoke all on function public.crear_usuario_para_persona(uuid, text, text, timestamptz, uuid) from anon;
    end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
        revoke all on function public.crear_usuario_para_persona(uuid, text, text, timestamptz, uuid) from authenticated;
    end if;
    if exists (select 1 from pg_roles where rolname = 'service_role') then
        grant execute on function public.crear_usuario_para_persona(uuid, text, text, timestamptz, uuid) to service_role;
    end if;
end
$$;

notify pgrst, 'reload schema';

commit;
