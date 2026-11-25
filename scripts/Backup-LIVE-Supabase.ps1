<#
.SYNOPSIS
  Read-only export of LIVE Supabase database metadata, Storage files, and a limited Auth inventory.

.DESCRIPTION
  Targets only project ybsjnubrswqksvktgmay. Uses the global Supabase CLI when present;
  otherwise invokes the pinned package through npx.cmd (supabase@3.4.0).

  Storage listing/download and read-only SQL inventories do not require Docker.
  Private/public Storage objects are downloaded through the authenticated Storage object
  endpoint using a masked, locally entered legacy service_role key. Logical PostgreSQL
  dumps are attempted only when Docker Engine is running. If Docker is unavailable,
  Storage export still proceeds and the final backup status stays INCOMPLETE.

  This is NOT a full-project backup: Supabase CLI db dump excludes managed auth/storage
  schemas and extension-managed schemas. Auth exports intentionally omit password hashes,
  tokens, sessions, MFA secrets, and raw user/identity metadata.

  No SQL writes, grants, deployments, secret changes, user creation, or Storage mutations
  are performed. Remote operations are limited to read-only queries/dumps and downloads.
#>

[CmdletBinding()]
param(
    [string]$BackupRoot = ""
)

$ErrorActionPreference = "Stop"
$ExpectedProjectRef = "ybsjnubrswqksvktgmay"
$ExpectedProjectName = "mohammed-afify-learning"
$Buckets = @("private-course-lessons", "public-course-assets")
$CliVersion = "3.4.0"

function Stop-Backup([string]$Message) {
    throw $Message
}

function Initialize-SupabaseCli {
    # Ignore PowerShell aliases/functions from profiles; accept only a real executable.
    $globalCli = Get-Command "supabase" -CommandType Application -ErrorAction SilentlyContinue
    if ($globalCli) {
        $script:SupabaseExe = $globalCli.Path
        if (-not $script:SupabaseExe) { $script:SupabaseExe = $globalCli.Definition }
        $script:SupabasePrefixArgs = @()
        if (-not $script:SupabaseExe) { Stop-Backup "Could not resolve the global Supabase CLI executable path." }
        return
    }

    $npxCommand = Get-Command "npx.cmd" -CommandType Application -ErrorAction SilentlyContinue
    $npxPath = $null
    if ($npxCommand) {
        $npxPath = $npxCommand.Path
        if (-not $npxPath) { $npxPath = $npxCommand.Definition }
    }
    if (-not $npxPath) {
        $programFiles = $env:ProgramFiles
        if ($programFiles) {
            $candidate = Join-Path $programFiles "nodejs\npx.cmd"
            if (Test-Path -LiteralPath $candidate) { $npxPath = $candidate }
        }
    }
    if (-not $npxPath) {
        Stop-Backup "Neither a global Supabase CLI nor npx.cmd was found."
    }

    $script:SupabaseExe = $npxPath
    $script:SupabasePrefixArgs = @("--yes", "supabase@$CliVersion")
}

function Invoke-SupabaseCli([string[]]$Arguments, [string]$Step) {
    Write-Host "`n[$Step] Supabase CLI $($Arguments -join ' ')" -ForegroundColor Cyan
    $allArgs = @($script:SupabasePrefixArgs) + @($Arguments)
    & $script:SupabaseExe @allArgs
    if ($LASTEXITCODE -ne 0) {
        Stop-Backup "Supabase CLI failed during '$Step' (exit code $LASTEXITCODE). No later steps were run."
    }
}

function Invoke-SupabaseCapture([string[]]$Arguments, [string]$Step, [string]$OutputPath) {
    Write-Host "`n[$Step]" -ForegroundColor Cyan
    $stderrPath = "$OutputPath.stderr.txt"
    $allArgs = @($script:SupabasePrefixArgs) + @($Arguments)

    # Supabase CLI prints a normal "Target: project ..." progress line to stderr
    # for hosted database commands. PowerShell can promote native stderr records
    # to terminating errors when ErrorActionPreference=Stop; keep this as captured
    # diagnostic output and trust the process exit code instead.
    $previousErrorAction = $ErrorActionPreference
    $nativePreferenceExists = Test-Path variable:PSNativeCommandUseErrorActionPreference
    if ($nativePreferenceExists) { $previousNativePreference = $PSNativeCommandUseErrorActionPreference }
    try {
        $ErrorActionPreference = "Continue"
        if ($nativePreferenceExists) { $PSNativeCommandUseErrorActionPreference = $false }
        $output = & $script:SupabaseExe @allArgs 2> $stderrPath | Out-String
        $exitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousErrorAction
        if ($nativePreferenceExists) { $PSNativeCommandUseErrorActionPreference = $previousNativePreference }
    }

    if ($exitCode -ne 0) {
        $diagnostic = if (Test-Path -LiteralPath $stderrPath) { Get-Content -Raw $stderrPath } else { "No CLI diagnostic was captured." }
        Stop-Backup "Supabase CLI failed during '$Step' (exit code $exitCode). Diagnostic: $diagnostic"
    }
    [IO.File]::WriteAllText($OutputPath, $output, [Text.UTF8Encoding]::new($false))
    return $stderrPath
}

function ConvertFrom-SecureStringToPlainText([Security.SecureString]$SecureValue) {
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureValue)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
}

function Download-LiveStorageObjects([object[]]$InventoryRows, [string[]]$BucketNames, [string]$StorageRoot) {
    $objects = @($InventoryRows | Where-Object { $_.object_path -and ($BucketNames -contains $_.bucket_name) })
    if ($objects.Count -eq 0) { Write-Host "No LIVE Storage objects were returned."; return @() }

    $failures = New-Object System.Collections.Generic.List[object]
    Add-Type -AssemblyName System.Net.Http
    $httpClient = [System.Net.Http.HttpClient]::new()
    $secureKey = $null
    $serviceRoleKey = $null
    try {
        $privateObjects = @($objects | Where-Object { -not [bool]$_.bucket_public })
        if ($privateObjects.Count -gt 0) {
            $secureKey = Read-Host -AsSecureString -Prompt "Enter the LIVE legacy service_role API key locally (masked; never paste it in chat)"
            $serviceRoleKey = ConvertFrom-SecureStringToPlainText $secureKey
            if ([string]::IsNullOrWhiteSpace($serviceRoleKey)) { Stop-Backup "No service_role key was provided." }
            if ($serviceRoleKey -notmatch '^eyJ[A-Za-z0-9_=-]+\.[A-Za-z0-9_=-]+\.[A-Za-z0-9_=-]+
function Invoke-SupabaseQueryCsv([string]$SqlPath, [string]$Step, [string]$CsvPath) {
    $jsonPath = "$CsvPath.json"
    $stderrPath = "$CsvPath.stderr.txt"
    Write-Host "`n[$Step]" -ForegroundColor Cyan

    # --output-format json selects machine-readable query rows. --agent yes avoids
    # the CLI's no-agent output path suppressing stdout in non-interactive sessions.
    $queryArgs = @(
        "--agent", "yes",
        "--output-format", "json",
        "db", "query",
        "--remote=$ExpectedProjectRef",
        "--read-only",
        "--file", $SqlPath
    )
    $allArgs = @($script:SupabasePrefixArgs) + $queryArgs

    # "Target: project ..." is normal CLI stderr progress, not a query failure.
    # Capture it separately; only a non-zero process exit makes the query fail.
    $previousErrorAction = $ErrorActionPreference
    $nativePreferenceExists = Test-Path variable:PSNativeCommandUseErrorActionPreference
    if ($nativePreferenceExists) { $previousNativePreference = $PSNativeCommandUseErrorActionPreference }
    try {
        $ErrorActionPreference = "Continue"
        if ($nativePreferenceExists) { $PSNativeCommandUseErrorActionPreference = $false }
        $raw = & $script:SupabaseExe @allArgs 2> $stderrPath | Out-String
        $exitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousErrorAction
        if ($nativePreferenceExists) { $PSNativeCommandUseErrorActionPreference = $previousNativePreference }
    }

    if ($exitCode -ne 0) {
        $diagnostic = if (Test-Path -LiteralPath $stderrPath) { Get-Content -Raw $stderrPath } else { "No CLI diagnostic was captured." }
        Stop-Backup "Read-only SQL query failed during '$Step' (exit code $exitCode). Diagnostic: $diagnostic"
    }
    [IO.File]::WriteAllText($jsonPath, $raw, [Text.UTF8Encoding]::new($false))

    try {
        $payload = $raw | ConvertFrom-Json
    }
    catch {
        Stop-Backup "The CLI did not return valid JSON for '$Step'. Raw response retained at $jsonPath"
    }

    $resultRows = $payload.rows
    if ($null -eq $resultRows -and $null -ne $payload.data) { $resultRows = $payload.data.rows }
    if ($null -eq $resultRows -and $null -ne $payload.result) { $resultRows = $payload.result.rows }
    if ($null -eq $resultRows) {
        $stderrHint = if (Test-Path -LiteralPath $stderrPath) { Get-Content -Raw $stderrPath } else { "No stderr was captured." }
        Stop-Backup "The CLI JSON response for '$Step' did not contain a rows array. Raw response retained at $jsonPath. stderr: $stderrHint"
    }

    $rows = @($resultRows)
    if ($rows.Count -gt 0) {
        $rows | Export-Csv -LiteralPath $CsvPath -NoTypeInformation -Encoding UTF8
    }
    else {
        [IO.File]::WriteAllText($CsvPath, "", [Text.UTF8Encoding]::new($false))
    }
    return $rows
}

try {
    $repoRoot = (& git rev-parse --show-toplevel 2>$null)
    if ($LASTEXITCODE -ne 0 -or -not $repoRoot) {
        Stop-Backup "Run this script from inside the cloned Mohammed Afify repository root."
    }
    $repoRoot = $repoRoot.Trim()
    $configToml = Join-Path $repoRoot "supabase\config.toml"
    if (-not (Test-Path -LiteralPath $configToml)) {
        Stop-Backup "The repository's supabase\config.toml was not found."
    }

    Initialize-SupabaseCli
    $versionText = (Invoke-SupabaseCli @("--version") "Read Supabase CLI version" | Out-String).Trim()
    if ($versionText -notmatch ('^' + [regex]::Escape($CliVersion) + '$')) {
        Stop-Backup "This backup script is pinned to Supabase CLI $CliVersion. Detected: $versionText"
    }

    # Probe Docker without allowing native stderr to become a terminating PowerShell
    # error under $ErrorActionPreference = Stop. Docker is optional for Storage export.
    $docker = Get-Command "docker" -CommandType Application -ErrorAction SilentlyContinue
    $dockerAvailable = $false
    if ($docker) {
        $dockerPath = $docker.Path
        if (-not $dockerPath) { $dockerPath = $docker.Definition }
        if ($dockerPath) {
            $probeId = [guid]::NewGuid().ToString("N")
            $dockerStdout = Join-Path $env:TEMP ("supabase-docker-probe-" + $probeId + ".out")
            $dockerStderr = Join-Path $env:TEMP ("supabase-docker-probe-" + $probeId + ".err")
            try {
                $probe = Start-Process -FilePath $dockerPath -ArgumentList @("info", "--format", "{{.ServerVersion}}") -RedirectStandardOutput $dockerStdout -RedirectStandardError $dockerStderr -NoNewWindow -Wait -PassThru
                $dockerAvailable = ($probe.ExitCode -eq 0)
            }
            catch {
                $dockerAvailable = $false
            }
            finally {
                Remove-Item -LiteralPath $dockerStdout, $dockerStderr -Force -ErrorAction SilentlyContinue
            }
        }
    }

    if (-not $BackupRoot) {
        $documents = [Environment]::GetFolderPath("MyDocuments")
        $stamp = Get-Date -Format "yyyyMMdd_HHmmss"
        $BackupRoot = Join-Path $documents ("SUPABASE_LIVE_BACKUP_" + $stamp)
    }
    $BackupRoot = [IO.Path]::GetFullPath($BackupRoot)
    if (Test-Path -LiteralPath $BackupRoot) {
        Stop-Backup "Backup output folder already exists. Choose a new empty folder: $BackupRoot"
    }
    New-Item -ItemType Directory -Path $BackupRoot -Force | Out-Null
    foreach ($folder in @("database", "storage", "inventory", "logs")) {
        New-Item -ItemType Directory -Path (Join-Path $BackupRoot $folder) -Force | Out-Null
    }

    Write-Host "LIVE BACKUP TARGET" -ForegroundColor Yellow
    Write-Host "Project: $ExpectedProjectName"
    Write-Host "Project ref: $ExpectedProjectRef"
    Write-Host "CLI: $versionText"
    Write-Host "Docker Engine: $(if ($dockerAvailable) { 'available' } else { 'not running; database dumps will be skipped' })"
    Write-Host "Output: $BackupRoot"
    Write-Host "Remote actions: read-only SQL/metadata requests, optional logical dumps, and Storage downloads only."
    Write-Host "This is not a full managed-schema/Auth backup."
    $typed = Read-Host "Type BACKUP-LIVE-$ExpectedProjectRef to continue"
    if ($typed -cne "BACKUP-LIVE-$ExpectedProjectRef") {
        Stop-Backup "Confirmation did not match. No remote backup commands were run."
    }

    Invoke-SupabaseCli @("login") "Supabase CLI login"

    # Read-only SQL inventories use the Management API path and do not start Docker.
    $storageInventorySql = Join-Path $BackupRoot "inventory\storage-inventory.sql"
    @'
SELECT
  b.name AS bucket_name,
  b.public AS bucket_public,
  b.file_size_limit,
  array_to_string(b.allowed_mime_types, '|') AS allowed_mime_types,
  o.name AS object_path,
  COALESCE(NULLIF(o.metadata->>'size', '')::bigint, 0) AS size_bytes,
  o.metadata->>'mimetype' AS mime_type,
  o.metadata->>'eTag' AS etag,
  o.created_at,
  o.updated_at
FROM storage.buckets AS b
LEFT JOIN storage.objects AS o ON o.bucket_id = b.id
ORDER BY b.name, o.name;
'@ | Set-Content -LiteralPath $storageInventorySql -Encoding utf8
    $storageInventoryCsv = Join-Path $BackupRoot "inventory\storage-inventory.csv"
    $inventoryRows = @(Invoke-SupabaseQueryCsv $storageInventorySql "Read LIVE Storage inventory" $storageInventoryCsv)

    $baselineSql = Join-Path $BackupRoot "inventory\database-baseline.sql"
    @'
SELECT
  current_setting('server_version') AS postgres_version,
  (SELECT count(*) FROM auth.users) AS auth_user_count,
  (SELECT count(*) FROM public.profiles) AS profiles_count,
  (SELECT count(*) FROM public.course_catalog) AS course_catalog_count,
  (SELECT count(*) FROM public.course_units) AS course_units_count,
  (SELECT count(*) FROM public.course_lessons) AS course_lessons_count,
  (SELECT count(*) FROM public.subscription_plans) AS subscription_plans_count,
  (SELECT count(*) FROM public.student_subscriptions) AS student_subscriptions_count,
  (SELECT count(*) FROM public.subscription_plan_courses) AS subscription_plan_courses_count,
  (SELECT count(*) FROM public.subscription_payments) AS subscription_payments_count,
  (SELECT count(*) FROM public.membership_audit_log) AS membership_audit_log_count,
  (SELECT count(*) FROM public.student_course_permissions) AS student_course_permissions_count,
  (SELECT count(*) FROM auth.identities) AS auth_identities_count;
'@ | Set-Content -LiteralPath $baselineSql -Encoding utf8
    $baselineCsv = Join-Path $BackupRoot "inventory\database-baseline.csv"
    [void](Invoke-SupabaseQueryCsv $baselineSql "Read LIVE row-count baseline" $baselineCsv)

    $authUsersSql = Join-Path $BackupRoot "inventory\auth-users-inventory.sql"
    @'
SELECT id, email, phone, email_confirmed_at, phone_confirmed_at,
       last_sign_in_at, created_at, updated_at
FROM auth.users
ORDER BY created_at, id;
'@ | Set-Content -LiteralPath $authUsersSql -Encoding utf8
    $authUsersCsv = Join-Path $BackupRoot "inventory\auth-users-inventory.csv"
    [void](Invoke-SupabaseQueryCsv $authUsersSql "Export limited Auth user reference inventory" $authUsersCsv)

    $authIdentitiesSql = Join-Path $BackupRoot "inventory\auth-identities-inventory.sql"
    @'
SELECT id, user_id, provider_id, provider,
       identity_data->>'sub' AS provider_subject,
       identity_data->>'email' AS provider_email,
       last_sign_in_at, created_at, updated_at
FROM auth.identities
ORDER BY user_id, provider;
'@ | Set-Content -LiteralPath $authIdentitiesSql -Encoding utf8
    $authIdentitiesCsv = Join-Path $BackupRoot "inventory\auth-identities-inventory.csv"
    [void](Invoke-SupabaseQueryCsv $authIdentitiesSql "Export limited Auth identity reference inventory" $authIdentitiesCsv)

    # CLI storage cp is not a remote-to-local downloader; use authenticated object GET.
    foreach ($bucket in $Buckets) {
        $listingPath = Join-Path (Join-Path $BackupRoot "inventory") ("storage-list-" + $bucket + ".txt")
        [void](Invoke-SupabaseCapture @("storage", "ls", ("ss:///" + $bucket), "--recursive", "--remote=$ExpectedProjectRef", "--experimental") "List LIVE Storage bucket $bucket" $listingPath)
    }
    $storageRoot = Join-Path $BackupRoot "storage"
    $storageDownloadFailures = @(Download-LiveStorageObjects $inventoryRows $Buckets $storageRoot)
    $downloadFailureCsv = Join-Path $BackupRoot "inventory\storage-download-failures.csv"
    if ($storageDownloadFailures.Count -gt 0) {
        $storageDownloadFailures | Export-Csv -LiteralPath $downloadFailureCsv -NoTypeInformation -Encoding UTF8
        Write-Warning "$($storageDownloadFailures.Count) Storage object(s) could not be downloaded. The script will continue to inventory and verify all other objects."
    } else {
        [IO.File]::WriteAllText($downloadFailureCsv, "", [Text.UTF8Encoding]::new($false))
    }

    $verificationRows = New-Object System.Collections.Generic.List[object]
    $hashRows = New-Object System.Collections.Generic.List[object]
    foreach ($bucket in $Buckets) {
        $expected = @($inventoryRows | Where-Object { $_.bucket_name -eq $bucket -and $_.object_path })
        $expectedCount = $expected.Count
        $expectedBytes = [long](($expected | Measure-Object -Property size_bytes -Sum).Sum)
        $destination = Join-Path (Join-Path $BackupRoot "storage") $bucket
        $files = @(Get-ChildItem -LiteralPath $destination -File -Recurse)
        $actualCount = $files.Count
        $actualBytes = [long](($files | Measure-Object -Property Length -Sum).Sum)

        foreach ($file in $files) {
            $relative = $file.FullName.Substring($destination.Length).TrimStart('\','/')
            $hashRows.Add([pscustomobject]@{
                bucket = $bucket
                relative_path = $relative
                bytes = $file.Length
                sha256 = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash
            })
        }
        $verificationRows.Add([pscustomobject]@{
            bucket = $bucket
            expected_files_from_remote_metadata = $expectedCount
            downloaded_files = $actualCount
            expected_bytes_from_remote_metadata = $expectedBytes
            downloaded_bytes = $actualBytes
            count_match = ($expectedCount -eq $actualCount)
            byte_total_match = ($expectedBytes -eq $actualBytes)
        })
    }
    $verificationCsv = Join-Path $BackupRoot "inventory\storage-verification.csv"
    $verificationRows | Export-Csv -LiteralPath $verificationCsv -NoTypeInformation -Encoding UTF8
    $hashManifest = Join-Path $BackupRoot "inventory\storage-files-sha256.csv"
    $hashRows | Export-Csv -LiteralPath $hashManifest -NoTypeInformation -Encoding UTF8
    $failedStorage = @($verificationRows | Where-Object { -not $_.count_match -or -not $_.byte_total_match })
    if ($failedStorage.Count -gt 0 -or $storageDownloadFailures.Count -gt 0) {
        Stop-Backup "Storage backup is PARTIAL and must not be used as a verified backup. Review $verificationCsv and $downloadFailureCsv for the exact missing or failed objects. Other readable objects were retained."
    }

    # Attempt a logical DB dump only when Docker is running. These dumps exclude managed schemas.
    $databaseDumpStatus = "SKIPPED: Docker Engine was not running; no SQL dumps were attempted."
    $rolesFile = Join-Path $BackupRoot "database\roles.sql"
    $schemaFile = Join-Path $BackupRoot "database\schema.sql"
    $dataFile = Join-Path $BackupRoot "database\data.sql"
    if ($dockerAvailable) {
        Invoke-SupabaseCli @("db", "dump", "--remote=$ExpectedProjectRef", "-f", $rolesFile, "--role-only") "Export LIVE database roles"
        Invoke-SupabaseCli @("db", "dump", "--remote=$ExpectedProjectRef", "-f", $schemaFile) "Export LIVE database schema"
        Invoke-SupabaseCli @("db", "dump", "--remote=$ExpectedProjectRef", "-f", $dataFile, "--use-copy", "--data-only", "-x", "storage.buckets_vectors", "-x", "storage.vector_indexes") "Export LIVE database data"
        foreach ($file in @($rolesFile, $schemaFile, $dataFile)) {
            if (-not (Test-Path -LiteralPath $file) -or (Get-Item -LiteralPath $file).Length -le 0) {
                Stop-Backup "Expected SQL export is missing or empty: $file"
            }
        }
        $databaseDumpStatus = "COMPLETED: logical schema/data/roles dumps created; managed auth/storage and extension-managed schemas remain excluded."
    }
    else {
        Write-Warning "Docker Engine is not running. Storage downloads and read-only inventories were completed, but PostgreSQL logical dumps were skipped."
    }

    # Capture migration history only; function/secret inventories are not included in this helper.
    [void](Invoke-SupabaseCapture @("migration", "list", "--remote=$ExpectedProjectRef") "Capture LIVE migration history" (Join-Path $BackupRoot "inventory\migration-history.txt"))

    $hashTargets = @($storageInventoryCsv, $baselineCsv, $authUsersCsv, $authIdentitiesCsv, $verificationCsv, $hashManifest)
    foreach ($file in @($rolesFile, $schemaFile, $dataFile)) {
        if (Test-Path -LiteralPath $file) { $hashTargets += $file }
    }
    $backupHashes = foreach ($target in $hashTargets) {
        [pscustomobject]@{
            file = $target.Substring($BackupRoot.Length).TrimStart('\','/')
            bytes = (Get-Item -LiteralPath $target).Length
            sha256 = (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash
        }
    }
    $backupHashes | Export-Csv -LiteralPath (Join-Path $BackupRoot "inventory\backup-files-sha256.csv") -NoTypeInformation -Encoding UTF8

    $notes = @"
SUPABASE LIVE BACKUP EXPORT — $([DateTime]::Now.ToString('yyyy-MM-dd HH:mm:ss zzz'))
Project: $ExpectedProjectName
Project ref: $ExpectedProjectRef
CLI: $versionText
Database logical dump: $databaseDumpStatus

WHAT THIS EXPORT CONTAINS
- Storage bytes for both known LIVE buckets. Private files use the authenticated object route; public files use the public object route. Failed object paths are recorded separately.
- Storage bucket/object inventory, per-object download results, and count/byte verification.
- Limited Auth user/identity reference inventory; no password hashes or tokens.
- LIVE row-count baseline and migration history.
- SHA-256 hashes for exported files.
- roles.sql/schema.sql/data.sql only when Docker was available.

IMPORTANT LIMITATIONS — NOT A FULL-PROJECT BACKUP
- Supabase CLI db dump excludes managed auth/storage schemas and extension-managed schemas.
- The Auth inventory is not restorable Auth backup. Existing passwords, recovery/confirmation tokens, MFA secrets, and sessions are not exported.
- Storage files are verified against remote metadata, but this does not back up all Supabase project configuration.
- Project secrets' VALUES, Auth provider configuration, SMTP, URL/redirect settings, Edge Function source, and other Dashboard configuration are not exported.
- This organization is on the FREE plan; do not assume scheduled daily backups exist.

REQUIRED BEFORE LIVE RELEASE APPROVAL
1. Confirm a platform-level restore point OR document and approve the manual Auth recovery procedure.
2. If database logical dumps were skipped, run them later after Docker Engine is available.
3. Copy this folder to access-controlled off-device storage and verify the copy hashes.
4. Review and store Auth/SMTP/URL/redirect configuration separately without exposing secret values.
5. Do not set BACKUP-VERIFIED until the full approved recovery path is documented.

No LIVE grants, functions, secrets, student data, course assignments, or Storage objects were changed by this script.
"@
    $statusFile = Join-Path $BackupRoot "BACKUP-STATUS-INCOMPLETE.txt"
    $notes | Set-Content -LiteralPath $statusFile -Encoding UTF8

    Write-Host "`nStorage download and verification completed." -ForegroundColor Green
    Write-Host "Database logical dump status: $databaseDumpStatus"
    Write-Host "Output folder: $BackupRoot"
    Write-Host "Final status intentionally remains INCOMPLETE until the Auth/platform recovery path and off-device copy are verified." -ForegroundColor Yellow
}
catch {
    Write-Error $_.Exception.Message
    if ($BackupRoot -and (Test-Path -LiteralPath $BackupRoot)) {
        Write-Host "Partial output retained for inspection at: $BackupRoot" -ForegroundColor Yellow
    }
    exit 1
}
) {
                Stop-Backup "Use the LIVE legacy JWT service_role key from Legacy API Keys; do not use anon/publishable keys."
            }
            $httpClient.DefaultRequestHeaders.Add("apikey", $serviceRoleKey)
            $httpClient.DefaultRequestHeaders.Authorization = [System.Net.Http.Headers.AuthenticationHeaderValue]::new("Bearer", $serviceRoleKey)
        }

        foreach ($bucket in $BucketNames) {
            $bucketFolder = Join-Path $StorageRoot $bucket
            New-Item -ItemType Directory -Path $bucketFolder -Force | Out-Null
            foreach ($entry in @($objects | Where-Object { $_.bucket_name -eq $bucket })) {
                $objectPath = [string]$entry.object_path
                $segments = $objectPath -split '/'
                if ([string]::IsNullOrWhiteSpace($objectPath) -or ($segments | Where-Object { $_ -eq "." -or $_ -eq ".." }).Count -gt 0) {
                    $failures.Add([pscustomobject]@{ bucket=$bucket; object_path=$objectPath; stage="path-validation"; status="blocked"; detail="Unsafe path from metadata" })
                    continue
                }
                $encodedPath = ($segments | ForEach-Object { [Uri]::EscapeDataString($_) }) -join '/'
                $isPublic = [bool]$entry.bucket_public
                $accessRoute = if ($isPublic) { "public" } else { "authenticated" }
                $url = "https://$ExpectedProjectRef.supabase.co/storage/v1/object/$accessRoute/$bucket/$encodedPath"
                $localPath = [IO.Path]::GetFullPath((Join-Path $bucketFolder $objectPath))
                $allowedRoot = [IO.Path]::GetFullPath($bucketFolder).TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
                if (-not $localPath.StartsWith($allowedRoot, [StringComparison]::OrdinalIgnoreCase)) {
                    $failures.Add([pscustomobject]@{ bucket=$bucket; object_path=$objectPath; stage="path-validation"; status="blocked"; detail="Path resolved outside the bucket folder" })
                    continue
                }
                New-Item -ItemType Directory -Path (Split-Path -Parent $localPath) -Force | Out-Null
                Write-Host "Downloading $bucket/$objectPath ($accessRoute route)"

                $response = $null; $inputStream = $null; $fileStream = $null
                try {
                    $response = $httpClient.GetAsync($url, [System.Net.Http.HttpCompletionOption]::ResponseHeadersRead).GetAwaiter().GetResult()
                    if (-not $response.IsSuccessStatusCode) {
                        $errorBody = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
                        if ($errorBody.Length -gt 1000) { $errorBody = $errorBody.Substring(0, 1000) }
                        $failures.Add([pscustomobject]@{
                            bucket=$bucket; object_path=$objectPath; stage="download";
                            status=[int]$response.StatusCode; detail=$errorBody
                        })
                        continue
                    }
                    $inputStream = $response.Content.ReadAsStreamAsync().GetAwaiter().GetResult()
                    $fileStream = [IO.File]::Open($localPath, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
                    $inputStream.CopyToAsync($fileStream).GetAwaiter().GetResult()
                }
                catch {
                    $failures.Add([pscustomobject]@{
                        bucket=$bucket; object_path=$objectPath; stage="download";
                        status="exception"; detail=$_.Exception.Message
                    })
                    if (Test-Path -LiteralPath $localPath) { Remove-Item -LiteralPath $localPath -Force -ErrorAction SilentlyContinue }
                    continue
                }
                finally {
                    if ($fileStream) { $fileStream.Dispose() }
                    if ($inputStream) { $inputStream.Dispose() }
                    if ($response) { $response.Dispose() }
                }

                $actualBytes = (Get-Item -LiteralPath $localPath).Length
                if ($null -ne $entry.size_bytes -and $actualBytes -ne [long]$entry.size_bytes) {
                    $failures.Add([pscustomobject]@{
                        bucket=$bucket; object_path=$objectPath; stage="size-verification";
                        status="mismatch"; detail="Expected $($entry.size_bytes) bytes; received $actualBytes."
                    })
                }
            }
        }
    }
    finally {
        $httpClient.Dispose()
        $serviceRoleKey = $null
        if ($secureKey) { $secureKey.Dispose() }
    }
    return @($failures)
function Invoke-SupabaseQueryCsv([string]$SqlPath, [string]$Step, [string]$CsvPath) {
    $jsonPath = "$CsvPath.json"
    $stderrPath = "$CsvPath.stderr.txt"
    Write-Host "`n[$Step]" -ForegroundColor Cyan

    # --output-format json selects machine-readable query rows. --agent yes avoids
    # the CLI's no-agent output path suppressing stdout in non-interactive sessions.
    $queryArgs = @(
        "--agent", "yes",
        "--output-format", "json",
        "db", "query",
        "--remote=$ExpectedProjectRef",
        "--read-only",
        "--file", $SqlPath
    )
    $allArgs = @($script:SupabasePrefixArgs) + $queryArgs

    # "Target: project ..." is normal CLI stderr progress, not a query failure.
    # Capture it separately; only a non-zero process exit makes the query fail.
    $previousErrorAction = $ErrorActionPreference
    $nativePreferenceExists = Test-Path variable:PSNativeCommandUseErrorActionPreference
    if ($nativePreferenceExists) { $previousNativePreference = $PSNativeCommandUseErrorActionPreference }
    try {
        $ErrorActionPreference = "Continue"
        if ($nativePreferenceExists) { $PSNativeCommandUseErrorActionPreference = $false }
        $raw = & $script:SupabaseExe @allArgs 2> $stderrPath | Out-String
        $exitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousErrorAction
        if ($nativePreferenceExists) { $PSNativeCommandUseErrorActionPreference = $previousNativePreference }
    }

    if ($exitCode -ne 0) {
        $diagnostic = if (Test-Path -LiteralPath $stderrPath) { Get-Content -Raw $stderrPath } else { "No CLI diagnostic was captured." }
        Stop-Backup "Read-only SQL query failed during '$Step' (exit code $exitCode). Diagnostic: $diagnostic"
    }
    [IO.File]::WriteAllText($jsonPath, $raw, [Text.UTF8Encoding]::new($false))

    try {
        $payload = $raw | ConvertFrom-Json
    }
    catch {
        Stop-Backup "The CLI did not return valid JSON for '$Step'. Raw response retained at $jsonPath"
    }

    $resultRows = $payload.rows
    if ($null -eq $resultRows -and $null -ne $payload.data) { $resultRows = $payload.data.rows }
    if ($null -eq $resultRows -and $null -ne $payload.result) { $resultRows = $payload.result.rows }
    if ($null -eq $resultRows) {
        $stderrHint = if (Test-Path -LiteralPath $stderrPath) { Get-Content -Raw $stderrPath } else { "No stderr was captured." }
        Stop-Backup "The CLI JSON response for '$Step' did not contain a rows array. Raw response retained at $jsonPath. stderr: $stderrHint"
    }

    $rows = @($resultRows)
    if ($rows.Count -gt 0) {
        $rows | Export-Csv -LiteralPath $CsvPath -NoTypeInformation -Encoding UTF8
    }
    else {
        [IO.File]::WriteAllText($CsvPath, "", [Text.UTF8Encoding]::new($false))
    }
    return $rows
}

try {
    $repoRoot = (& git rev-parse --show-toplevel 2>$null)
    if ($LASTEXITCODE -ne 0 -or -not $repoRoot) {
        Stop-Backup "Run this script from inside the cloned Mohammed Afify repository root."
    }
    $repoRoot = $repoRoot.Trim()
    $configToml = Join-Path $repoRoot "supabase\config.toml"
    if (-not (Test-Path -LiteralPath $configToml)) {
        Stop-Backup "The repository's supabase\config.toml was not found."
    }

    Initialize-SupabaseCli
    $versionText = (Invoke-SupabaseCli @("--version") "Read Supabase CLI version" | Out-String).Trim()
    if ($versionText -notmatch ('^' + [regex]::Escape($CliVersion) + '$')) {
        Stop-Backup "This backup script is pinned to Supabase CLI $CliVersion. Detected: $versionText"
    }

    # Probe Docker without allowing native stderr to become a terminating PowerShell
    # error under $ErrorActionPreference = Stop. Docker is optional for Storage export.
    $docker = Get-Command "docker" -CommandType Application -ErrorAction SilentlyContinue
    $dockerAvailable = $false
    if ($docker) {
        $dockerPath = $docker.Path
        if (-not $dockerPath) { $dockerPath = $docker.Definition }
        if ($dockerPath) {
            $probeId = [guid]::NewGuid().ToString("N")
            $dockerStdout = Join-Path $env:TEMP ("supabase-docker-probe-" + $probeId + ".out")
            $dockerStderr = Join-Path $env:TEMP ("supabase-docker-probe-" + $probeId + ".err")
            try {
                $probe = Start-Process -FilePath $dockerPath -ArgumentList @("info", "--format", "{{.ServerVersion}}") -RedirectStandardOutput $dockerStdout -RedirectStandardError $dockerStderr -NoNewWindow -Wait -PassThru
                $dockerAvailable = ($probe.ExitCode -eq 0)
            }
            catch {
                $dockerAvailable = $false
            }
            finally {
                Remove-Item -LiteralPath $dockerStdout, $dockerStderr -Force -ErrorAction SilentlyContinue
            }
        }
    }

    if (-not $BackupRoot) {
        $documents = [Environment]::GetFolderPath("MyDocuments")
        $stamp = Get-Date -Format "yyyyMMdd_HHmmss"
        $BackupRoot = Join-Path $documents ("SUPABASE_LIVE_BACKUP_" + $stamp)
    }
    $BackupRoot = [IO.Path]::GetFullPath($BackupRoot)
    if (Test-Path -LiteralPath $BackupRoot) {
        Stop-Backup "Backup output folder already exists. Choose a new empty folder: $BackupRoot"
    }
    New-Item -ItemType Directory -Path $BackupRoot -Force | Out-Null
    foreach ($folder in @("database", "storage", "inventory", "logs")) {
        New-Item -ItemType Directory -Path (Join-Path $BackupRoot $folder) -Force | Out-Null
    }

    Write-Host "LIVE BACKUP TARGET" -ForegroundColor Yellow
    Write-Host "Project: $ExpectedProjectName"
    Write-Host "Project ref: $ExpectedProjectRef"
    Write-Host "CLI: $versionText"
    Write-Host "Docker Engine: $(if ($dockerAvailable) { 'available' } else { 'not running; database dumps will be skipped' })"
    Write-Host "Output: $BackupRoot"
    Write-Host "Remote actions: read-only SQL/metadata requests, optional logical dumps, and Storage downloads only."
    Write-Host "This is not a full managed-schema/Auth backup."
    $typed = Read-Host "Type BACKUP-LIVE-$ExpectedProjectRef to continue"
    if ($typed -cne "BACKUP-LIVE-$ExpectedProjectRef") {
        Stop-Backup "Confirmation did not match. No remote backup commands were run."
    }

    Invoke-SupabaseCli @("login") "Supabase CLI login"

    # Read-only SQL inventories use the Management API path and do not start Docker.
    $storageInventorySql = Join-Path $BackupRoot "inventory\storage-inventory.sql"
    @'
SELECT
  b.name AS bucket_name,
  b.public AS bucket_public,
  b.file_size_limit,
  array_to_string(b.allowed_mime_types, '|') AS allowed_mime_types,
  o.name AS object_path,
  COALESCE(NULLIF(o.metadata->>'size', '')::bigint, 0) AS size_bytes,
  o.metadata->>'mimetype' AS mime_type,
  o.metadata->>'eTag' AS etag,
  o.created_at,
  o.updated_at
FROM storage.buckets AS b
LEFT JOIN storage.objects AS o ON o.bucket_id = b.id
ORDER BY b.name, o.name;
'@ | Set-Content -LiteralPath $storageInventorySql -Encoding utf8
    $storageInventoryCsv = Join-Path $BackupRoot "inventory\storage-inventory.csv"
    $inventoryRows = @(Invoke-SupabaseQueryCsv $storageInventorySql "Read LIVE Storage inventory" $storageInventoryCsv)

    $baselineSql = Join-Path $BackupRoot "inventory\database-baseline.sql"
    @'
SELECT
  current_setting('server_version') AS postgres_version,
  (SELECT count(*) FROM auth.users) AS auth_user_count,
  (SELECT count(*) FROM public.profiles) AS profiles_count,
  (SELECT count(*) FROM public.course_catalog) AS course_catalog_count,
  (SELECT count(*) FROM public.course_units) AS course_units_count,
  (SELECT count(*) FROM public.course_lessons) AS course_lessons_count,
  (SELECT count(*) FROM public.subscription_plans) AS subscription_plans_count,
  (SELECT count(*) FROM public.student_subscriptions) AS student_subscriptions_count,
  (SELECT count(*) FROM public.subscription_plan_courses) AS subscription_plan_courses_count,
  (SELECT count(*) FROM public.subscription_payments) AS subscription_payments_count,
  (SELECT count(*) FROM public.membership_audit_log) AS membership_audit_log_count,
  (SELECT count(*) FROM public.student_course_permissions) AS student_course_permissions_count,
  (SELECT count(*) FROM auth.identities) AS auth_identities_count;
'@ | Set-Content -LiteralPath $baselineSql -Encoding utf8
    $baselineCsv = Join-Path $BackupRoot "inventory\database-baseline.csv"
    [void](Invoke-SupabaseQueryCsv $baselineSql "Read LIVE row-count baseline" $baselineCsv)

    $authUsersSql = Join-Path $BackupRoot "inventory\auth-users-inventory.sql"
    @'
SELECT id, email, phone, email_confirmed_at, phone_confirmed_at,
       last_sign_in_at, created_at, updated_at
FROM auth.users
ORDER BY created_at, id;
'@ | Set-Content -LiteralPath $authUsersSql -Encoding utf8
    $authUsersCsv = Join-Path $BackupRoot "inventory\auth-users-inventory.csv"
    [void](Invoke-SupabaseQueryCsv $authUsersSql "Export limited Auth user reference inventory" $authUsersCsv)

    $authIdentitiesSql = Join-Path $BackupRoot "inventory\auth-identities-inventory.sql"
    @'
SELECT id, user_id, provider_id, provider,
       identity_data->>'sub' AS provider_subject,
       identity_data->>'email' AS provider_email,
       last_sign_in_at, created_at, updated_at
FROM auth.identities
ORDER BY user_id, provider;
'@ | Set-Content -LiteralPath $authIdentitiesSql -Encoding utf8
    $authIdentitiesCsv = Join-Path $BackupRoot "inventory\auth-identities-inventory.csv"
    [void](Invoke-SupabaseQueryCsv $authIdentitiesSql "Export limited Auth identity reference inventory" $authIdentitiesCsv)

    # CLI storage cp is not a remote-to-local downloader; use authenticated object GET.
    foreach ($bucket in $Buckets) {
        $listingPath = Join-Path (Join-Path $BackupRoot "inventory") ("storage-list-" + $bucket + ".txt")
        [void](Invoke-SupabaseCapture @("storage", "ls", ("ss:///" + $bucket), "--recursive", "--remote=$ExpectedProjectRef", "--experimental") "List LIVE Storage bucket $bucket" $listingPath)
    }
    $storageRoot = Join-Path $BackupRoot "storage"
    Download-LiveStorageObjects $inventoryRows $Buckets $storageRoot

    $verificationRows = New-Object System.Collections.Generic.List[object]
    $hashRows = New-Object System.Collections.Generic.List[object]
    foreach ($bucket in $Buckets) {
        $expected = @($inventoryRows | Where-Object { $_.bucket_name -eq $bucket -and $_.object_path })
        $expectedCount = $expected.Count
        $expectedBytes = [long](($expected | Measure-Object -Property size_bytes -Sum).Sum)
        $destination = Join-Path (Join-Path $BackupRoot "storage") $bucket
        $files = @(Get-ChildItem -LiteralPath $destination -File -Recurse)
        $actualCount = $files.Count
        $actualBytes = [long](($files | Measure-Object -Property Length -Sum).Sum)

        foreach ($file in $files) {
            $relative = $file.FullName.Substring($destination.Length).TrimStart('\','/')
            $hashRows.Add([pscustomobject]@{
                bucket = $bucket
                relative_path = $relative
                bytes = $file.Length
                sha256 = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash
            })
        }
        $verificationRows.Add([pscustomobject]@{
            bucket = $bucket
            expected_files_from_remote_metadata = $expectedCount
            downloaded_files = $actualCount
            expected_bytes_from_remote_metadata = $expectedBytes
            downloaded_bytes = $actualBytes
            count_match = ($expectedCount -eq $actualCount)
            byte_total_match = ($expectedBytes -eq $actualBytes)
        })
    }
    $verificationCsv = Join-Path $BackupRoot "inventory\storage-verification.csv"
    $verificationRows | Export-Csv -LiteralPath $verificationCsv -NoTypeInformation -Encoding UTF8
    $hashManifest = Join-Path $BackupRoot "inventory\storage-files-sha256.csv"
    $hashRows | Export-Csv -LiteralPath $hashManifest -NoTypeInformation -Encoding UTF8
    $failedStorage = @($verificationRows | Where-Object { -not $_.count_match -or -not $_.byte_total_match })
    if ($failedStorage.Count -gt 0) {
        Stop-Backup "Storage verification mismatch detected. Review $verificationCsv. Storage backup is not verified."
    }

    # Attempt a logical DB dump only when Docker is running. These dumps exclude managed schemas.
    $databaseDumpStatus = "SKIPPED: Docker Engine was not running; no SQL dumps were attempted."
    $rolesFile = Join-Path $BackupRoot "database\roles.sql"
    $schemaFile = Join-Path $BackupRoot "database\schema.sql"
    $dataFile = Join-Path $BackupRoot "database\data.sql"
    if ($dockerAvailable) {
        Invoke-SupabaseCli @("db", "dump", "--remote=$ExpectedProjectRef", "-f", $rolesFile, "--role-only") "Export LIVE database roles"
        Invoke-SupabaseCli @("db", "dump", "--remote=$ExpectedProjectRef", "-f", $schemaFile) "Export LIVE database schema"
        Invoke-SupabaseCli @("db", "dump", "--remote=$ExpectedProjectRef", "-f", $dataFile, "--use-copy", "--data-only", "-x", "storage.buckets_vectors", "-x", "storage.vector_indexes") "Export LIVE database data"
        foreach ($file in @($rolesFile, $schemaFile, $dataFile)) {
            if (-not (Test-Path -LiteralPath $file) -or (Get-Item -LiteralPath $file).Length -le 0) {
                Stop-Backup "Expected SQL export is missing or empty: $file"
            }
        }
        $databaseDumpStatus = "COMPLETED: logical schema/data/roles dumps created; managed auth/storage and extension-managed schemas remain excluded."
    }
    else {
        Write-Warning "Docker Engine is not running. Storage downloads and read-only inventories were completed, but PostgreSQL logical dumps were skipped."
    }

    # Capture migration history only; function/secret inventories are not included in this helper.
    [void](Invoke-SupabaseCapture @("migration", "list", "--remote=$ExpectedProjectRef") "Capture LIVE migration history" (Join-Path $BackupRoot "inventory\migration-history.txt"))

    $hashTargets = @($storageInventoryCsv, $baselineCsv, $authUsersCsv, $authIdentitiesCsv, $verificationCsv, $hashManifest)
    foreach ($file in @($rolesFile, $schemaFile, $dataFile)) {
        if (Test-Path -LiteralPath $file) { $hashTargets += $file }
    }
    $backupHashes = foreach ($target in $hashTargets) {
        [pscustomobject]@{
            file = $target.Substring($BackupRoot.Length).TrimStart('\','/')
            bytes = (Get-Item -LiteralPath $target).Length
            sha256 = (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash
        }
    }
    $backupHashes | Export-Csv -LiteralPath (Join-Path $BackupRoot "inventory\backup-files-sha256.csv") -NoTypeInformation -Encoding UTF8

    $notes = @"
SUPABASE LIVE BACKUP EXPORT — $([DateTime]::Now.ToString('yyyy-MM-dd HH:mm:ss zzz'))
Project: $ExpectedProjectName
Project ref: $ExpectedProjectRef
CLI: $versionText
Database logical dump: $databaseDumpStatus

WHAT THIS EXPORT CONTAINS
- Storage bytes for the two known LIVE buckets, downloaded through the authenticated Storage API.
- Storage bucket/object inventory and count/byte verification.
- Limited Auth user/identity reference inventory; no password hashes or tokens.
- LIVE row-count baseline and migration history.
- SHA-256 hashes for exported files.
- roles.sql/schema.sql/data.sql only when Docker was available.

IMPORTANT LIMITATIONS — NOT A FULL-PROJECT BACKUP
- Supabase CLI db dump excludes managed auth/storage schemas and extension-managed schemas.
- The Auth inventory is not restorable Auth backup. Existing passwords, recovery/confirmation tokens, MFA secrets, and sessions are not exported.
- Storage files are verified against remote metadata, but this does not back up all Supabase project configuration.
- Project secrets' VALUES, Auth provider configuration, SMTP, URL/redirect settings, Edge Function source, and other Dashboard configuration are not exported.
- This organization is on the FREE plan; do not assume scheduled daily backups exist.

REQUIRED BEFORE LIVE RELEASE APPROVAL
1. Confirm a platform-level restore point OR document and approve the manual Auth recovery procedure.
2. If database logical dumps were skipped, run them later after Docker Engine is available.
3. Copy this folder to access-controlled off-device storage and verify the copy hashes.
4. Review and store Auth/SMTP/URL/redirect configuration separately without exposing secret values.
5. Do not set BACKUP-VERIFIED until the full approved recovery path is documented.

No LIVE grants, functions, secrets, student data, course assignments, or Storage objects were changed by this script.
"@
    $statusFile = Join-Path $BackupRoot "BACKUP-STATUS-INCOMPLETE.txt"
    $notes | Set-Content -LiteralPath $statusFile -Encoding UTF8

    Write-Host "`nStorage download and verification completed." -ForegroundColor Green
    Write-Host "Database logical dump status: $databaseDumpStatus"
    Write-Host "Output folder: $BackupRoot"
    Write-Host "Final status intentionally remains INCOMPLETE until the Auth/platform recovery path and off-device copy are verified." -ForegroundColor Yellow
}
catch {
    Write-Error $_.Exception.Message
    if ($BackupRoot -and (Test-Path -LiteralPath $BackupRoot)) {
        Write-Host "Partial output retained for inspection at: $BackupRoot" -ForegroundColor Yellow
    }
    exit 1
}
