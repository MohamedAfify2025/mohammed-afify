<#
.SYNOPSIS
  Deploy username-based student account management to the verified LIVE Supabase project.

.DESCRIPTION
  LIVE-only deployment gate for admin-manage-student-accounts.
  Requires a verified LIVE backup and completed service_role grants before deployment.
  Sets only ALLOWED_ORIGINS, then deploys this single function with JWT verification.
  Does not run SQL, change browser config, create users, modify student access, or publish the website.

.NOTES
  Production website origin is taken from the existing LIVE deployment configuration:
  https://mohamedafify2025.github.io

  Supabase automatically injects SUPABASE_URL, SUPABASE_PUBLISHABLE_KEYS,
  and SUPABASE_SECRET_KEYS into Edge Function runtimes.
#>

$ErrorActionPreference = "Stop"
$ExpectedLiveProjectRef = "ybsjnubrswqksvktgmay"
$ExpectedRepository = "github.com/MohamedAfify2025/mohammed-afify"
$FunctionName = "admin-manage-student-accounts"
$WebsiteOrigin = "https://mohamedafify2025.github.io"

function Stop-With([string]$Message) {
    throw $Message
}

function Invoke-SupabaseCli([string[]]$Arguments) {
    $cli = Get-Command "supabase" -ErrorAction SilentlyContinue
    if ($cli) {
        $cliPath = $cli.Path
        if (-not $cliPath) { $cliPath = $cli.Definition }
        & $cliPath @Arguments
    }
    else {
        # Match the tested Windows environment: invoke a pinned CLI through npx.cmd.
        $npx = Get-Command "npx.cmd" -ErrorAction SilentlyContinue
        $npxPath = $null
        if ($npx) {
            $npxPath = $npx.Path
            if (-not $npxPath) { $npxPath = $npx.Definition }
        }
        if (-not $npxPath) {
            $candidateNpx = Join-Path $env:ProgramFiles "nodejs/npx.cmd"
            if (Test-Path -LiteralPath $candidateNpx) {
                $npxPath = $candidateNpx
            }
        }
        if (-not $npxPath) {
            Stop-With "Neither a global Supabase CLI nor npx.cmd was found. Install Node.js or Supabase CLI, then retry."
        }
        & $npxPath --yes supabase@3.4.0 @Arguments
    }

    if ($LASTEXITCODE -ne 0) {
        Stop-With "Supabase CLI failed (exit code $LASTEXITCODE). No further deployment steps were run."
    }
}

try {
    $repoRoot = (& git rev-parse --show-toplevel 2>$null)
    if ($LASTEXITCODE -ne 0 -or -not $repoRoot) {
        Stop-With "Run this script from inside the cloned repository."
    }
    $repoRoot = $repoRoot.Trim()

    $remote = (& git remote get-url origin 2>$null)
    if ($LASTEXITCODE -ne 0 -or $remote -notmatch [regex]::Escape($ExpectedRepository)) {
        Stop-With "Git origin is not the expected repository $ExpectedRepository."
    }

    $branchName = (& git branch --show-current 2>$null).Trim()
    if ($branchName -cne "main") {
        Stop-With "LIVE deployment is permitted only from the main branch after PR review and merge. Current branch: $branchName"
    }

    $workingTree = (& git status --porcelain 2>$null)
    if ($LASTEXITCODE -ne 0 -or $workingTree) {
        Stop-With "Git working tree is not clean. Commit or discard changes before LIVE deployment."
    }

    $functionPath = Join-Path $repoRoot "supabase/functions/admin-manage-student-accounts/index.ts"
    $helperPath = Join-Path $repoRoot "supabase/functions/_shared/student-account-helpers.mjs"
    $configPath = Join-Path $repoRoot "supabase/config.toml"
    if (-not (Test-Path -LiteralPath $functionPath) -or -not (Test-Path -LiteralPath $helperPath)) {
        Stop-With "The username student account function or its shared helper is missing."
    }

    $configToml = Get-Content -Raw -LiteralPath $configPath
    if ($configToml -notmatch '(?m)^\[functions\.admin-manage-student-accounts\]\s*\r?\nverify_jwt\s*=\s*true\s*$') {
        Stop-With "admin-manage-student-accounts must keep verify_jwt = true."
    }

    Write-Host ""
    Write-Host "LIVE RELEASE GATE" -ForegroundColor Yellow
    Write-Host "Repository: $ExpectedRepository"
    Write-Host "Branch: main"
    Write-Host "Project ref: $ExpectedLiveProjectRef"
    Write-Host "Function: $FunctionName"
    Write-Host "Website origin allowed by this function: $WebsiteOrigin"
    Write-Host ""
    Write-Host "Before continuing, verify both items:" -ForegroundColor Yellow
    Write-Host "1. LIVE database backup exported and stored off-site."
    Write-Host "2. LIVE Storage objects backed up separately, including private-course-lessons and public-course-assets."
    Write-Host "3. Auth recovery is covered by a verified platform restore point or an approved manual recovery plan."
    Write-Host "4. sql/student-username-accounts-live-preflight.sql was executed in LIVE after backup verification."
    Write-Host "5. Every service_role privilege check at the end of that SQL script returned true."
    Write-Host "6. The approved production admin identity and rollback owner are known."
    Write-Host ""

    $projectRef = (Read-Host "LIVE Supabase Project Ref").Trim()
    if ($projectRef -cne $ExpectedLiveProjectRef) {
        Stop-With "Project ref does not exactly match LIVE. No deployment was made."
    }

    $backupConfirmation = Read-Host "Type BACKUP-VERIFIED only after database AND Storage backups have been verified"
    if ($backupConfirmation -cne "BACKUP-VERIFIED") {
        Stop-With "Backup verification was not confirmed. Deployment cancelled."
    }

    $authConfirmation = Read-Host "Type AUTH-RECOVERY-VERIFIED only after Auth recovery is documented and approved"
    if ($authConfirmation -cne "AUTH-RECOVERY-VERIFIED") {
        Stop-With "Auth recovery path was not verified. Deployment cancelled."
    }

    $grantConfirmation = Read-Host "Type GRANTS-VERIFIED only after the LIVE SQL preflight returned all true"
    if ($grantConfirmation -cne "GRANTS-VERIFIED") {
        Stop-With "LIVE database grants were not confirmed. Deployment cancelled."
    }

    $finalConfirmation = Read-Host "Type DEPLOY-LIVE to deploy only $FunctionName to $ExpectedLiveProjectRef"
    if ($finalConfirmation -cne "DEPLOY-LIVE") {
        Stop-With "Final LIVE confirmation was not received. Deployment cancelled."
    }

    $version = (Invoke-SupabaseCli @("--version") | Out-String).Trim()
    if (-not $version) {
        Stop-With "Could not read Supabase CLI version."
    }
    Write-Host "Using Supabase CLI: $version"

    Invoke-SupabaseCli @("login")

    $tempEnvFile = Join-Path ([IO.Path]::GetTempPath()) ("username-student-live-" + [Guid]::NewGuid().ToString("N") + ".env")
    $envLine = "ALLOWED_ORIGINS='$WebsiteOrigin'"
    [IO.File]::WriteAllText($tempEnvFile, $envLine + [Environment]::NewLine, [Text.UTF8Encoding]::new($false))

    $oldSupabaseYes = $env:SUPABASE_YES
    try {
        # Current Supabase CLI requires explicit confirmation in non-interactive secret updates.
        $env:SUPABASE_YES = "1"
        Invoke-SupabaseCli @("secrets", "set", "--env-file", $tempEnvFile, "--project-ref", $projectRef)
    }
    finally {
        if ($null -eq $oldSupabaseYes) {
            Remove-Item Env:\SUPABASE_YES -ErrorAction SilentlyContinue
        }
        else {
            $env:SUPABASE_YES = $oldSupabaseYes
        }
        Remove-Item -LiteralPath $tempEnvFile -Force -ErrorAction SilentlyContinue
    }

    Write-Host ""
    Write-Host "Deploying only $FunctionName to LIVE with JWT verification enabled..." -ForegroundColor Yellow
    Invoke-SupabaseCli @("functions", "deploy", $FunctionName, "--project-ref", $projectRef, "--use-api")

    Write-Host ""
    Write-Host "LIVE Edge Function deployment completed." -ForegroundColor Green
    Write-Host "Verify the function is ACTIVE and verify_jwt remains true in the Supabase Dashboard."
    Write-Host "Then run the controlled post-deployment test plan in docs/USERNAME-STUDENT-ACCOUNTS-LIVE-ROLLOUT.md."
    Write-Host "This script did not run SQL, create students, assign courses, alter browser config, or push website code."
}
catch {
    Write-Error $_.Exception.Message
    exit 1
}
