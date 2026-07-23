-- Conserva la razón administrativa por la que un evento fue suspendido.

alter table public.eventos
    add column if not exists motivo_suspension text;
