-- Casa de Vida
-- Migración 017: vinculación transaccional entre una cuenta de usuario
-- y una identidad de persona.
--
-- No habilita accesos ni modifica roles. Solo establece la relación uno a uno.

begin;

create or replace function public.vincular_usuario_persona(
    p_usuario_id uuid,
    p_persona_id uuid,
    p_actor_id uuid
)
returns table (
    usuario_id uuid,
    persona_id uuid,
    correo text,
    nombre_persona text
)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_usuario public.usuarios%rowtype;
    v_persona public.personas%rowtype;
begin
    select *
    into v_usuario
    from public.usuarios
    where id = p_usuario_id
    for update;

    if not found then
        raise exception using
            errcode = 'P0002',
            message = 'La cuenta de usuario no existe.';
    end if;

    select *
    into v_persona
    from public.personas
    where id = p_persona_id
    for update;

    if not found then
        raise exception using
            errcode = 'P0002',
            message = 'La persona no existe.';
    end if;

    if v_usuario.persona_id is not null
       and v_usuario.persona_id <> p_persona_id then
        raise exception using
            errcode = '23505',
            message = 'La cuenta ya está vinculada a otra persona.';
    end if;

    if exists (
        select 1
        from public.usuarios u
        where u.persona_id = p_persona_id
          and u.id <> p_usuario_id
    ) then
        raise exception using
            errcode = '23505',
            message = 'La persona ya tiene una cuenta de usuario vinculada.';
    end if;

    update public.usuarios
    set persona_id = p_persona_id
    where id = p_usuario_id;

    if v_usuario.persona_id is distinct from p_persona_id then
        insert into public.auditoria (
            usuario_id,
            accion,
            tabla,
            registro_id,
            datos_antes,
            datos_despues
        )
        values (
            p_actor_id,
            'VINCULAR_PERSONA',
            'usuarios',
            p_usuario_id,
            jsonb_build_object('persona_id', v_usuario.persona_id),
            jsonb_build_object('persona_id', p_persona_id)
        );
    end if;

    return query
    select
        v_usuario.id,
        p_persona_id,
        v_usuario.correo::text,
        concat_ws(' ', v_persona.nombres, v_persona.apellidos);
end;
$$;

revoke all on function public.vincular_usuario_persona(uuid, uuid, uuid) from public;

do $$
begin
    if exists (select 1 from pg_roles where rolname = 'anon') then
        revoke all on function public.vincular_usuario_persona(uuid, uuid, uuid)
            from anon;
    end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
        revoke all on function public.vincular_usuario_persona(uuid, uuid, uuid)
            from authenticated;
    end if;
    if exists (select 1 from pg_roles where rolname = 'service_role') then
        grant execute on function public.vincular_usuario_persona(uuid, uuid, uuid)
            to service_role;
    end if;
end
$$;

comment on function public.vincular_usuario_persona(uuid, uuid, uuid) is
    'Vincula una cuenta y una persona de forma uno a uno, idempotente y auditada.';

notify pgrst, 'reload schema';

commit;
