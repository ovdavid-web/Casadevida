param(
    [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = 'Stop'

$pgDump = Join-Path $ProjectRoot '.tools\postgresql-17.10\pgsql\bin\pg_dump.exe'
if (-not (Test-Path -LiteralPath $pgDump)) {
    throw "No se encontro pg_dump en $pgDump"
}

$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupDir = Join-Path $ProjectRoot "backups\supabase\$timestamp"
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null

$securePassword = Read-Host 'Contrasena PostgreSQL de Supabase' -AsSecureString
$passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
$backupError = $null

try {
    $env:PGPASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)

    $connectionArgs = @(
        '--host=db.pwcsztjpmlhmidwahzlz.supabase.co'
        '--port=5432'
        '--username=postgres'
        '--dbname=postgres'
        '--schema=public'
    )

    $fullBackup = Join-Path $backupDir 'casadevida-completo.backup'
    & $pgDump @connectionArgs '--format=custom' '--compress=9' "--file=$fullBackup"
    if ($LASTEXITCODE -ne 0) {
        throw "Fallo el respaldo completo (codigo $LASTEXITCODE)."
    }

    $schemaBackup = Join-Path $backupDir 'casadevida-esquema.sql'
    & $pgDump @connectionArgs '--schema-only' '--quote-all-identifiers' "--file=$schemaBackup"
    if ($LASTEXITCODE -ne 0) {
        throw "Fallo el respaldo del esquema (codigo $LASTEXITCODE)."
    }

    $dataBackup = Join-Path $backupDir 'casadevida-datos.sql'
    & $pgDump @connectionArgs '--data-only' '--inserts' '--column-inserts' "--file=$dataBackup"
    if ($LASTEXITCODE -ne 0) {
        throw "Fallo el respaldo de datos (codigo $LASTEXITCODE)."
    }

    $files = Get-ChildItem -LiteralPath $backupDir -File
    $manifest = foreach ($file in $files) {
        $hash = Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256
        [pscustomobject]@{
            archivo = $file.Name
            bytes = $file.Length
            sha256 = $hash.Hash
        }
    }

    $manifestPath = Join-Path $backupDir 'manifest.json'
    $manifest | ConvertTo-Json | Set-Content -LiteralPath $manifestPath -Encoding UTF8

    Write-Host ''
    Write-Host 'RESPALDO COMPLETADO' -ForegroundColor Green
    Write-Host "Carpeta: $backupDir"
    Get-ChildItem -LiteralPath $backupDir -File |
        Select-Object Name, Length |
        Format-Table -AutoSize
}
catch {
    $backupError = $_
    $errorPath = Join-Path $backupDir 'error-respaldo.txt'
    $_.Exception.Message | Set-Content -LiteralPath $errorPath -Encoding UTF8

    Write-Host ''
    Write-Host 'EL RESPALDO NO SE COMPLETO' -ForegroundColor Red
    Write-Host $_.Exception.Message
    Write-Host "Detalle local: $errorPath"
}
finally {
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    if ($passwordPointer -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
    }
}

if ($backupError) {
    Read-Host 'Presiona Enter para cerrar'
    exit 1
}

Read-Host 'Presiona Enter para cerrar'
