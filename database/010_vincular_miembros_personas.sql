-- Casa de Vida
-- Migración 010: puente entre el directorio actual y la identidad central.
--
-- Esta migración:
--   1. Conserva miembros.id y todas sus relaciones actuales.
--   2. No elimina ni renombra columnas.
--   3. Crea una persona y un vínculo por cada miembro existente.
--   4. Se detiene ante RUT vacíos o duplicados para no unir personas por error.

begin;

alter table public.miembros
    add column if not exists persona_id uuid;

do $$
begin
    if exists (
        select 1
        from public.miembros
        where rut is null
           or btrim(regexp_replace(rut, '[^0-9kK]', '', 'g')) = ''
    ) then
        raise exception
            'No se puede vincular miembros: existe al menos un registro sin RUT utilizable.';
    end if;

    if exists (
        select 1
        from public.miembros
        group by upper(regexp_replace(rut, '[^0-9kK]', '', 'g'))
        having count(*) > 1
    ) then
        raise exception
            'No se puede vincular miembros: existen RUT duplicados en el directorio.';
    end if;
end
$$;

insert into public.personas (
    tipo_documento,
    documento_normalizado,
    nombres,
    correo,
    telefono,
    direccion,
    estado,
    creado_en,
    actualizado_en
)
select
    'rut',
    upper(regexp_replace(m.rut, '[^0-9kK]', '', 'g')),
    btrim(m.nombre),
    nullif(btrim(m.correo), ''),
    nullif(btrim(m.telefono), ''),
    nullif(btrim(m.direccion), ''),
    case when coalesce(m.activo, true) then 'activo' else 'inactivo' end,
    coalesce(m.created_at at time zone 'America/Santiago', now()),
    now()
from public.miembros m
where m.persona_id is null
  and not exists (
      select 1
      from public.personas p
      where p.tipo_documento = 'rut'
        and upper(p.documento_normalizado) =
            upper(regexp_replace(m.rut, '[^0-9kK]', '', 'g'))
  );

update public.miembros m
set persona_id = p.id
from public.personas p
where m.persona_id is null
  and p.tipo_documento = 'rut'
  and upper(p.documento_normalizado) =
      upper(regexp_replace(m.rut, '[^0-9kK]', '', 'g'));

do $$
begin
    if exists (
        select 1
        from public.miembros
        where persona_id is null
    ) then
        raise exception
            'La vinculación quedó incompleta: existen miembros sin persona asociada.';
    end if;
end
$$;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'miembros_persona_id_fkey'
          and conrelid = 'public.miembros'::regclass
    ) then
        alter table public.miembros
            add constraint miembros_persona_id_fkey
            foreign key (persona_id)
            references public.personas(id)
            on delete restrict;
    end if;
end
$$;

create unique index if not exists miembros_persona_unica
    on public.miembros (persona_id)
    where persona_id is not null;

insert into public.vinculos_iglesia (
    persona_id,
    tipo,
    estado,
    fecha_inicio,
    fecha_fin,
    motivo_fin
)
select
    m.persona_id,
    'miembro',
    case when coalesce(m.activo, true) then 'activo' else 'inactivo' end,
    coalesce(m.fecha_ingreso, m.created_at::date, current_date),
    null,
    case
        when coalesce(m.activo, true) then null
        else 'Registro histórico migrado desde el directorio'
    end
from public.miembros m
where not exists (
    select 1
    from public.vinculos_iglesia v
    where v.persona_id = m.persona_id
);

update public.usuarios u
set persona_id = m.persona_id
from public.miembros m
where m.usuario_id = u.id
  and u.persona_id is null;

comment on column public.miembros.persona_id is
    'Puente con la identidad central. miembros.id se conserva para compatibilidad e historial.';

commit;
