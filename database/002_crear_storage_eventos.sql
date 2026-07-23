-- Bucket público para miniaturas cuadradas de eventos.
-- Ejecutar una sola vez desde el SQL Editor de Supabase.

insert into storage.buckets (
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types
)
values (
    'eventos-publicos',
    'eventos-publicos',
    true,
    307200,
    array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
