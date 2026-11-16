#requires -Version 5.1
[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "MOHAMMED AFIFY - SOURCE EVENT TRIGGER & EXTENSION AUDIT" -ForegroundColor Cyan
Write-Host "Read-only PostgreSQL catalog inspection. No schema or data changes." -ForegroundColor Cyan

$PsqlCandidates = @(
    (Get-Command psql.exe -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -ErrorAction SilentlyContinue),
    "C:\Program Files\Odoo 18.0.20260824\PostgreSQL\bin\psql.exe"
) | Where-Object { $_ -and (Test-Path -LiteralPath $_) }

if (-not $PsqlCandidates) {
    throw "psql.exe was not found. Expected PostgreSQL client or Odoo PostgreSQL bin."
}
$Psql = $PsqlCandidates[0]

$HostName = Read-Host "Source Supabase database host (Session Pooler host)"
$PortInput = Read-Host "Port [5432]"
if ([string]::IsNullOrWhiteSpace($PortInput)) { $PortInput = "5432" }
$DbName = Read-Host "Database name [postgres]"
if ([string]::IsNullOrWhiteSpace($DbName)) { $DbName = "postgres" }
$DbUser = Read-Host "Database username (copy exactly from Supabase Connect)"

if ([string]::IsNullOrWhiteSpace($HostName) -or
    [string]::IsNullOrWhiteSpace($DbUser)) {
    throw "Host and username are required."
}

$Stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$Desktop = [Environment]::GetFolderPath("Desktop")
$OutRoot = Join-Path $Desktop "Supabase_V2_EventTrigger_Audit_$Stamp"
New-Item -ItemType Directory -Path $OutRoot -Force | Out-Null
$OutFile = Join-Path $OutRoot "Source_EventTrigger_Extension_Audit.csv"

$Query = @"
BEGIN READ ONLY;
SELECT
    'IDENTITY'::text AS section,
    current_database()::text AS database_name,
    current_user::text AS object_owner,
    current_setting('server_version')::text AS object_version,
    current_setting('transaction_read_only')::text AS enabled_state,
    NULL::text AS object_name,
    NULL::text AS object_definition;
SELECT
    'EVENT_TRIGGER'::text AS section,
    evt.evtname::text AS database_name,
    pg_get_userbyid(evt.evtowner)::text AS object_owner,
    evt.evtevent::text AS object_version,
    evt.evtenabled::text AS enabled_state,
    evt.evtname::text AS object_name,
    (pg_get_event_triggerdef(evt.oid) || E'\n\n' ||
     pg_get_functiondef(evt.evtfoid))::text AS object_definition
FROM pg_catalog.pg_event_trigger evt
ORDER BY evt.evtname;
SELECT
    'EXTENSION'::text AS section,
    ext.extname::text AS database_name,
    ext.extversion::text AS object_owner,
    ns.nspname::text AS object_version,
    ext.extrelocatable::text AS enabled_state,
    NULL::text AS object_name,
    NULL::text AS object_definition
FROM pg_catalog.pg_extension ext
JOIN pg_catalog.pg_namespace ns ON ns.oid = ext.extnamespace
ORDER BY ext.extname;
SELECT
    'ROLE'::text AS section,
    rol.rolname::text AS database_name,
    rol.rolsuper::text AS object_owner,
    rol.rolinherit::text AS object_version,
    rol.rolcreaterole::text AS enabled_state,
    rol.rolcreatedb::text AS object_name,
    ('replication=' || rol.rolreplication ||
     '; bypassrls=' || rol.rolbypassrls)::text AS object_definition
FROM pg_catalog.pg_roles rol
WHERE rol.rolname IN (
    'postgres', 'supabase_admin', 'anon', 'authenticated',
    'service_role', 'authenticator', 'dashboard_user'
)
ORDER BY rol.rolname;
SELECT
    'SCHEMA_GRANT'::text AS section,
    'membership_v2_private'::text AS database_name,
    role_name::text AS object_owner,
    has_schema_privilege(role_name, 'membership_v2_private', 'USAGE')::text AS object_version,
    has_schema_privilege(role_name, 'membership_v2_private', 'CREATE')::text AS enabled_state,
    NULL::text AS object_name,
    NULL::text AS object_definition
FROM (VALUES ('anon'), ('authenticated'), ('service_role'), ('postgres')) AS r(role_name)
ORDER BY role_name;
COMMIT;
"@

$OldTimeout = $env:PGCONNECT_TIMEOUT
$OldSsl = $env:PGSSLMODE
$env:PGCONNECT_TIMEOUT = "15"
$env:PGSSLMODE = "require"

try {
    Write-Host ""
    Write-Host "[INFO] psql: $Psql"
    Write-Host "[INFO] The password prompt is hidden. Password is not saved."
    Write-Host "[INFO] Running one explicit READ ONLY transaction..."

    & $Psql -X -W -h $HostName -p $PortInput -U $DbUser -d $DbName `
        -v ON_ERROR_STOP=1 --csv -o $OutFile -c $Query

    if ($LASTEXITCODE -ne 0) {
        throw "psql failed with exit code $LASTEXITCODE. No database changes were performed."
    }

    $OutputText = Get-Content -LiteralPath $OutFile -Raw -ErrorAction Stop
    if ($OutputText -notmatch 'IDENTITY') {
        throw "Audit output is missing the identity result."
    }
    if ($OutputText -notmatch 'on') {
        throw "Read-only marker was not found in the output; review report and do not proceed."
    }

    $ZipPath = "$OutRoot.zip"
    Compress-Archive -Path (Join-Path $OutRoot "*") -DestinationPath $ZipPath -Force

    Write-Host ""
    Write-Host "[OK] Read-only source audit completed." -ForegroundColor Green
    Write-Host "CSV: $OutFile"
    Write-Host "ZIP: $ZipPath"
    Write-Host "No database objects or records were changed." -ForegroundColor Green
}
finally {
    if ($null -eq $OldTimeout) {
        Remove-Item Env:\PGCONNECT_TIMEOUT -ErrorAction SilentlyContinue
    } else {
        $env:PGCONNECT_TIMEOUT = $OldTimeout
    }
    if ($null -eq $OldSsl) {
        Remove-Item Env:\PGSSLMODE -ErrorAction SilentlyContinue
    } else {
        $env:PGSSLMODE = $OldSsl
    }
}
