-- Casa de Vida
-- Migración 015: roles acumulables asociados a personas.
--
-- Los roles organizacionales pertenecen a la persona aunque todavía no tenga
-- una cuenta de usuario. El vínculo "miembro" no se duplica como rol.

begin;

create table if not exists public.persona_roles (
    persona_id uuid not null references public.personas(id) on delete restrict,
    rol_id uuid not null references public.roles(id) on delete restrict,
    asignado_por uuid references public.usuarios(id) on delete set null,
    asignado_en timestamptz not null default now(),
    actualizado_en timestamptz not null default now(),
    activo boolean not null default true,
    primary key (persona_id, rol_id)
);

create index if not exists persona_roles_activos_persona
    on public.persona_roles (persona_id)
    where activo;

alter table public.persona_roles enable row level security;

create or replace function public.asignar_roles_persona(
    p_persona_id uuid,
    p_roles text[],
    p_actor_id uuid
)
returns table (
    rol_id uuid,
    codigo text,
    nombre text,
    es_critico boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_roles text[] := coalesce(p_roles, array[]::text[]);
    v_roles_antes jsonb;
    v_roles_despues jsonb;
    v_codigo text;
begin
    if not exists (
        select 1
        from public.miembros m
        where m.persona_id = p_persona_id
    ) then
        raise exception using
            errcode = '22023',
            message = 'Solo los miembros pueden recibir roles.';
    end if;

    foreach v_codigo in array v_roles loop
        if v_codigo not in (
            'pastor',
            'tesorero',
            'oficial',
            'secretaria',
            'lider',
            'editor_contenido',
            'voluntario'
        ) then
            raise exception using
                errcode = '22023',
                message = format('El rol %s no puede asignarse desde el directorio.', v_codigo);
        end if;
    end loop;

    select coalesce(
        jsonb_agg(
            jsonb_build_object('codigo', r.codigo, 'nombre', r.nombre)
            order by r.nombre
        ),
        '[]'::jsonb
    )
    into v_roles_antes
    from public.persona_roles pr
    join public.roles r on r.id = pr.rol_id
    where pr.persona_id = p_persona_id
      and pr.activo;

    update public.persona_roles pr
    set
        activo = false,
        actualizado_en = now()
    where pr.persona_id = p_persona_id
      and pr.activo
      and pr.rol_id in (
          select r.id
          from public.roles r
          where r.codigo in (
              'pastor',
              'tesorero',
              'oficial',
              'secretaria',
              'lider',
              'editor_contenido',
              'voluntario'
          )
      );

    insert into public.persona_roles (
        persona_id,
        rol_id,
        asignado_por,
        asignado_en,
        actualizado_en,
        activo
    )
    select
        p_persona_id,
        r.id,
        p_actor_id,
        now(),
        now(),
        true
    from public.roles r
    where r.codigo = any(v_roles)
      and r.activo
    on conflict on constraint persona_roles_pkey do update
    set
        asignado_por = excluded.asignado_por,
        asignado_en = excluded.asignado_en,
        actualizado_en = excluded.actualizado_en,
        activo = true;

    select coalesce(
        jsonb_agg(
            jsonb_build_object('codigo', r.codigo, 'nombre', r.nombre)
            order by r.nombre
        ),
        '[]'::jsonb
    )
    into v_roles_despues
    from public.persona_roles pr
    join public.roles r on r.id = pr.rol_id
    where pr.persona_id = p_persona_id
      and pr.activo;

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
        'ASIGNAR_ROLES',
        'persona_roles',
        p_persona_id,
        jsonb_build_object('roles', v_roles_antes),
        jsonb_build_object('roles', v_roles_despues)
    );

    return query
    select
        r.id,
        r.codigo,
        r.nombre,
        r.es_critico
    from public.persona_roles pr
    join public.roles r on r.id = pr.rol_id
    where pr.persona_id = p_persona_id
      and pr.activo
    order by r.nombre;
end;
$$;

revoke all on function public.asignar_roles_persona(uuid, text[], uuid) from public;

do $$
begin
    if exists (select 1 from pg_roles where rolname = 'anon') then
        revoke all on function public.asignar_roles_persona(uuid, text[], uuid)
            from anon;
    end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
        revoke all on function public.asignar_roles_persona(uuid, text[], uuid)
            from authenticated;
    end if;
    if exists (select 1 from pg_roles where rolname = 'service_role') then
        grant execute on function public.asignar_roles_persona(uuid, text[], uuid)
            to service_role;
    end if;
end
$$;

comment on table public.persona_roles is
    'Roles acumulables de responsabilidad asociados a una persona, tenga o no cuenta de usuario.';

notify pgrst, 'reload schema';

commit;
