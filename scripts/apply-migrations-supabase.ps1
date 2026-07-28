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
    'database\009_departamentos_y_actividades.sql'
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
