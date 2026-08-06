-- Casa de Vida
-- Migración 023: una alerta visual diaria por cuenta y usuario.

begin;

create table if not exists public.cuenta_alertas_vistas (
    cuenta_id uuid not null references public.cuentas_por_pagar(id) on delete cascade,
    usuario_id uuid not null references public.usuarios(id) on delete cascade,
    fecha date not null default current_date,
    visto_en timestamptz not null default now(),
    primary key (cuenta_id, usuario_id, fecha)
);

create index if not exists cuenta_alertas_vistas_usuario_fecha_idx
    on public.cuenta_alertas_vistas(usuario_id, fecha);

alter table public.cuenta_alertas_vistas enable row level security;

comment on table public.cuenta_alertas_vistas is
    'Evita repetir una alerta visual de vencimiento para la misma cuenta y usuario durante el mismo día.';

commit;
