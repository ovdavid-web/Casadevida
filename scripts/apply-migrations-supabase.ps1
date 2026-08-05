param(
    [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = 'Stop'

$psql = Join-Path $ProjectRoot '.tools\postgresql-17.10\pgsql\bin\psql.exe'
if (-not (Test-Path -LiteralPath $psql)) {
    throw "No se encontro psql en $psql"
}

$migrations = @(
    'database\006_base_personas_roles.sql',
    'database\007_catalogo_permisos.sql',
    'database\008_audiencias_eventos.sql',
    'database\009_departamentos_y_actividades.sql',
    'database\010_vincular_miembros_personas.sql',
    'database\011_alta_transaccional_miembros.sql',
    'database\012_eliminar_area_servicio.sql',
    'database\013_alta_personas_invitadas.sql',
    'database\014_edicion_transaccional_miembros.sql',
    'database\015_roles_por_persona.sql',
    'database\016_corregir_textos_roles.sql',
    'database\017_vincular_usuario_persona.sql',
    'database\018_credenciales_temporales.sql'
)

foreach ($migration in $migrations) {
    $migrationPath = Join-Path $ProjectRoot $migration
    if (-not (Test-Path -LiteralPath $migrationPath)) {
        throw "No se encontro la migracion $migrationPath"
    }
}

$securePassword = Read-Host 'Contrasena PostgreSQL de Supabase' -AsSecureString
$passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
$migrationError = $null

try {
    $env:PGPASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)

    $connectionArgs = @(
        '--host=db.pwcsztjpmlhmidwahzlz.supabase.co'
        '--port=5432'
        '--username=postgres'
        '--dbname=postgres'
        '--set=ON_ERROR_STOP=1'
        '--no-psqlrc'
    )

    foreach ($migration in $migrations) {
        $migrationPath = Join-Path $ProjectRoot $migration
        Write-Host "Aplicando $migration..." -ForegroundColor Cyan
        & $psql @connectionArgs "--file=$migrationPath"
        if ($LASTEXITCODE -ne 0) {
            throw "Fallo $migration (codigo $LASTEXITCODE)."
        }
    }

    $verificationSql = @'
select 'tablas_nuevas=' || count(*)
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'personas',
    'vinculos_iglesia',
    'roles',
    'permisos',
    'rol_permisos',
    'usuario_roles',
    'evento_audiencias',
    'departamentos',
    'departamento_lideres'
  );

select 'roles=' || count(*) from public.roles;
select 'permisos=' || count(*) from public.permisos;
select 'eventos_sin_audiencia=' || count(*)
from public.eventos e
where not exists (
  select 1 from public.evento_audiencias ea where ea.evento_id = e.id
);
select 'rls_nuevas=' || count(*)
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'personas',
    'vinculos_iglesia',
    'roles',
    'permisos',
    'rol_permisos',
    'usuario_roles',
    'evento_audiencias',
    'departamentos',
    'departamento_lideres'
  )
  and c.relrowsecurity;
select 'oficial_finanzas=' || count(*)
from public.rol_permisos rp
join public.roles r on r.id = rp.rol_id
join public.permisos p on p.id = rp.permiso_id
where r.codigo = 'oficial'
  and p.modulo in ('finanzas', 'cuentas_por_pagar');
select 'tesorero_historial=' || count(*)
from public.rol_permisos rp
join public.roles r on r.id = rp.rol_id
join public.permisos p on p.id = rp.permiso_id
where r.codigo = 'tesorero'
  and p.codigo like 'aportes_historial.%';

select 'miembros=' || count(*) from public.miembros;
select 'personas=' || count(*) from public.personas;
select 'miembros_sin_persona=' || count(*)
from public.miembros
where persona_id is null;
select 'vinculos_miembro=' || count(*)
from public.vinculos_iglesia
where tipo = 'miembro';
select 'finanzas_huerfanas=' || count(*)
from public.finanzas f
left join public.miembros m on m.id = f.miembro_id
where f.miembro_id is not null
  and m.id is null;
select 'funcion_alta_miembro=' || count(*)
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'crear_miembro_con_persona'
  and p.pronargs = 9;
select 'columna_area_servicio=' || count(*)
from information_schema.columns
where table_schema = 'public'
  and table_name = 'miembros'
  and column_name = 'area_servicio';
select 'funcion_alta_invitado=' || count(*)
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'crear_persona_invitada'
  and p.pronargs = 8;
select 'funcion_editar_miembro=' || count(*)
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'actualizar_miembro_con_persona'
  and p.pronargs = 10;
select 'tabla_persona_roles=' || count(*)
from information_schema.tables
where table_schema = 'public'
  and table_name = 'persona_roles';
select 'funcion_asignar_roles=' || count(*)
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'asignar_roles_persona'
  and p.pronargs = 3;
select 'roles_texto_incorrecto=' || count(*)
from public.roles
where nombre like '%Ã%'
   or descripcion like '%Ã%';
select 'funcion_vincular_usuario=' || count(*)
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'vincular_usuario_persona'
  and p.pronargs = 3;
select 'usuarios_sin_persona=' || count(*)
from public.usuarios
where persona_id is null;
select 'funcion_crear_acceso=' || count(*)
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'crear_usuario_para_persona'
  and p.pronargs = 5;
select 'columnas_credencial_temporal=' || count(*)
from information_schema.columns
where table_schema = 'public'
  and table_name = 'usuarios'
  and column_name in (
      'debe_cambiar_password',
      'password_temporal_expira_en',
      'password_actualizado_en'
  );
'@

    Write-Host ''
    Write-Host 'VERIFICACION REMOTA' -ForegroundColor Cyan
    & $psql @connectionArgs '--tuples-only' '--no-align' "--command=$verificationSql"
    if ($LASTEXITCODE -ne 0) {
        throw "Las migraciones se aplicaron, pero fallo la verificacion remota."
    }

    Write-Host ''
    Write-Host 'MIGRACIONES COMPLETADAS' -ForegroundColor Green
}
catch {
    $migrationError = $_
    Write-Host ''
    Write-Host 'LAS MIGRACIONES NO SE COMPLETARON' -ForegroundColor Red
    Write-Host $_.Exception.Message
}
finally {
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    if ($passwordPointer -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
    }
}

Read-Host 'Presiona Enter para cerrar'
if ($migrationError) {
    exit 1
}
