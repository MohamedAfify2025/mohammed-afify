#requires -Version 5.1
<#
.SYNOPSIS
  Deploy the student invitation Edge Function to the verified LIVE Supabase project.
.DESCRIPTION
  LIVE-only deployment. Requires the known production project ref, exact GitHub Pages
  origin/redirect, a public browser key, and operator confirmation that Auth Redirect
  URLs and custom SMTP are ready. Deploys one Edge Function and publishes only the
  publishable browser configuration to the public GitHub Pages source.
  Does not run SQL, create users, send invitations, or change existing student data.
#>
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ExpectedBranch = "main"
# This is the project ref previously identified by the repository's TEST safety guard
# as the Supabase project already connected to the public website.
$ExpectedLiveProjectRef = "ybsjnubrswqksvktgmay"
$FunctionName = "admin-create-student-invitations"
$WebsiteOrigin = "https://mohamedafify2025.github.io"
$RedirectUrl = "https://mohamedafify2025.github.io/mohammed-afify/student-set-password.html"
$ConfigRelativePath = "public-site/assets/js/membership-config.js"

function Stop-With([string]$Message) { throw $Message }

function Convert-SecureStringToPlainText([Security.SecureString]$Value) {
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Value)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}

function Test-SupabasePublicKey([string]$Key) {
    if ([string]::IsNullOrWhiteSpace($Key)) { return $false }
    $Key = $Key.Trim().Trim([char]0xFEFF).Trim().Trim('"').Trim("'")
    if ($Key.StartsWith("sb_publishable_")) { return $Key.Length -gt 20 }
    if ($Key.StartsWith("sb_secret_") -or $Key.StartsWith("sb_service_role_")) { return $false }
    if (-not $Key.StartsWith("eyJ")) { return $false }

    $parts = $Key.Split(".")
    if ($parts.Count -ne 3) { return $false }
    $payloadPart = $parts[1].Replace("-", "+").Replace("_", "/")
    switch ($payloadPart.Length % 4) {
        0 { }
        2 { $payloadPart += "==" }
        3 { $payloadPart += "=" }
        default { return $false }
    }
    try {
        $payload = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($payloadPart)) | ConvertFrom-Json
        return ([string]$payload.role -eq "anon")
    }
    catch { return $false }
}

function Invoke-SupabaseCli([string[]]$Arguments) {
    $cli = Get-Command "supabase" -ErrorAction SilentlyContinue
    if ($cli) {
        & $cli.Source @Arguments
    }
    else {
        & npx --yes supabase@latest @Arguments
    }
    if ($LASTEXITCODE -ne 0) {
        Stop-With "Supabase CLI failed (exit code $LASTEXITCODE). Review the output above."
    }
}

$repoRoot = (& git rev-parse --show-toplevel)
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($repoRoot)) {
    Stop-With "Run this script from inside the cloned repository."
}
$repoRoot = $repoRoot.Trim()
Push-Location $repoRoot
$tempEnvFile = $null
try {
    Write-Host "Student invitations — LIVE deployment" -ForegroundColor Cyan

    $branch = (& git branch --show-current).Trim()
    if ($branch -ne $ExpectedBranch) {
        Stop-With "Wrong branch '$branch'. Switch to '$ExpectedBranch' after the LIVE deployment PR is merged."
    }

    $remote = (& git remote get-url origin).Trim()
    if ($remote -notmatch 'github\.com[:/]MohamedAfify2025/mohammed-afify(?:\.git)?$') {
        Stop-With "The origin remote is not the expected GitHub repository."
    }

    $dirty = @(& git status --porcelain)
    if ($dirty.Count -gt 0) {
        Stop-With "The working tree is not clean. Commit or move local changes before deployment."
    }

    & node tests/student-invites.test.mjs
    if ($LASTEXITCODE -ne 0) { Stop-With "Student invitation tests failed." }

    $configToml = Get-Content -Raw -LiteralPath (Join-Path $repoRoot "supabase/config.toml")
    if ($configToml -notmatch '(?m)^\[functions\.admin-create-student-invitations\]\s*\r?\nverify_jwt\s*=\s*true\s*$') {
        Stop-With "Expected verify_jwt = true for this user-JWT authenticated function."
    }

    $confirmLive = Read-Host "Type LIVE to confirm production deployment"
    if ($confirmLive -cne "LIVE") { Stop-With "Cancelled: LIVE was not confirmed." }

    $projectRef = (Read-Host "LIVE Supabase Project Ref").Trim()
    if ($projectRef -cne $ExpectedLiveProjectRef) {
        Stop-With "Project ref does not match the previously identified LIVE project. No deployment was made."
    }

    Write-Host ""
    Write-Host "Before continuing, verify the Auth URL Configuration in the Supabase Dashboard:" -ForegroundColor Yellow
    Write-Host $RedirectUrl -ForegroundColor Yellow
    Write-Host "Also verify custom SMTP/email delivery is configured and tested."
    $authReady = Read-Host "Type AUTH_READY only after both Redirect URL and custom SMTP are configured"
    if ($authReady -cne "AUTH_READY") { Stop-With "Cancelled: Auth redirect/email readiness was not confirmed." }

    $publishableSecure = Read-Host -Prompt 'LIVE Supabase Publishable Key' -AsSecureString
    $publishableKey = (Convert-SecureStringToPlainText $publishableSecure).Trim()
    if (-not (Test-SupabasePublicKey $publishableKey)) {
        Stop-With "Rejected key. Secret/service_role keys are not allowed here."
    }

    $supabaseUrl = "https://$projectRef.supabase.co"
    Write-Host "Checking the LIVE Supabase URL/key pair..."
    try {
        $headers = @{ apikey = $publishableKey }
        $authSettings = Invoke-RestMethod -Method GET -Uri "$supabaseUrl/auth/v1/settings" -Headers $headers -TimeoutSec 30
        if ($null -eq $authSettings) { Stop-With "Supabase Auth settings response was empty." }
    }
    catch {
        Stop-With "Could not verify the LIVE Supabase URL/key pair. Check the exact project ref and Publishable Key. Details: $($_.Exception.Message)"
    }

    # Check current browser config before replacing it. Never silently replace a different project.
    $configPath = Join-Path $repoRoot $ConfigRelativePath
    if (-not (Test-Path -LiteralPath $configPath)) {
        Stop-With "Expected browser config file was not found: $ConfigRelativePath"
    }
    $existingConfig = Get-Content -Raw -LiteralPath $configPath
    $existingProjectMatches = [regex]::Matches($existingConfig, 'https://([a-z0-9-]+)\.supabase\.co')
    foreach ($match in $existingProjectMatches) {
        if ($match.Groups[1].Value -cne $projectRef) {
            Stop-With "Browser config references a different Supabase project. Review it manually before replacing."
        }
    }

    Write-Host ""
    Write-Host "Supabase CLI login..."
    Invoke-SupabaseCli @("login")

    # Set only application-specific function configuration.
    # Supabase injects SUPABASE_URL, SUPABASE_PUBLISHABLE_KEYS and SUPABASE_SECRET_KEYS.
    $tempEnvFile = Join-Path ([IO.Path]::GetTempPath()) ("student-invites-live-" + [Guid]::NewGuid().ToString("N") + ".env")
    $envLines = @(
        "ALLOWED_ORIGINS='$WebsiteOrigin'"
        "STUDENT_INVITE_REDIRECT_URL='$RedirectUrl'"
    )
    [IO.File]::WriteAllLines($tempEnvFile, $envLines, [Text.UTF8Encoding]::new($false))
    try {
        Invoke-SupabaseCli @("secrets", "set", "--project-ref", $projectRef, "--env-file", $tempEnvFile)
    }
    finally {
        if (Test-Path $tempEnvFile) { Remove-Item -LiteralPath $tempEnvFile -Force }
        $tempEnvFile = $null
    }

    Write-Host "Deploying only $FunctionName to the verified LIVE project..."
    Invoke-SupabaseCli @("functions", "deploy", $FunctionName, "--project-ref", $projectRef, "--use-api")

    # Publishable keys are designed for browser use. Secret/service-role keys are rejected above.
    $urlJson = ConvertTo-Json -InputObject $supabaseUrl -Compress
    $keyJson = ConvertTo-Json -InputObject $publishableKey -Compress
    # Build JavaScript from ordinary PowerShell strings. This is compatible with Windows PowerShell 5.1.
    $configLines = @(
        "// Public browser configuration. Publishable keys are intended for browser clients."
        "// Row Level Security and RPC authorization remain the actual access controls."
        "window.MEMBERSHIP_CONFIG = {"
        "  supabaseUrl: $urlJson,"
        "  supabasePublishableKey: $keyJson,"
        '  supabaseAnonKey: ""'
        "};"
        ""
        "window.isMembershipPublicKey = function (value) {"
        '  const key = String(value || "").trim();'
        '  if (key.startsWith("sb_publishable_")) return key.length > 20;'
        '  if (key.startsWith("sb_secret_") || key.startsWith("sb_service_role_")) return false;'
        '  if (!key.startsWith("eyJ")) return false;'
        '  const parts = key.split(".");'
        '  if (parts.length !== 3) return false;'
        '  let payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");'
        '  while (payload.length % 4) payload += "=";'
        '  try {'
        '    return JSON.parse(atob(payload)).role === "anon";'
        '  } catch (_) {'
        '    return false;'
        '  }'
        "};"
    )
    $configJs = $configLines -join [Environment]::NewLine
    [IO.File]::WriteAllText($configPath, $configJs, [Text.UTF8Encoding]::new($false))

    node --check $configPath
    if ($LASTEXITCODE -ne 0) { Stop-With "Published browser configuration failed JavaScript syntax check." }

    git diff --check
    if ($LASTEXITCODE -ne 0) { Stop-With "Git diff check failed." }

    $changed = @(& git status --porcelain)
    if ($changed.Count -ne 1 -or $changed[0] -notmatch [regex]::Escape($ConfigRelativePath)) {
        Stop-With "Unexpected local changes were found. Review git status; no commit was created."
    }

    Write-Host ""
    Write-Host "The publishable key will be written to the public GitHub repository." -ForegroundColor Yellow
    Write-Host "This is safe only because it is a Publishable/anon key; no secret key is included."
    $publish = Read-Host "Type PUBLISH to commit and publish the browser configuration to GitHub Pages"
    if ($publish -cne "PUBLISH") {
        Stop-With "Edge Function deployed, but browser config was not committed or published. No student invitations have been sent."
    }

    git add -- $ConfigRelativePath
    if ($LASTEXITCODE -ne 0) { Stop-With "Could not stage the browser configuration." }

    git commit -m "Configure student portal for LIVE Supabase"
    if ($LASTEXITCODE -ne 0) { Stop-With "Could not commit the LIVE browser configuration." }

    git push origin main
    if ($LASTEXITCODE -ne 0) { Stop-With "The LIVE Edge Function is deployed, but pushing the Pages configuration failed. Resolve the Git push before inviting students." }

    Write-Host ""
    Write-Host "LIVE Edge Function deployed and browser configuration pushed to main." -ForegroundColor Green
    Write-Host "GitHub Actions will publish the updated pages."
    Write-Host "No SQL was executed. No user was created and no invitation was sent."
    Write-Host "Admin page: https://mohamedafify2025.github.io/mohammed-afify/admin-students.html"
    Write-Host "Student login: https://mohamedafify2025.github.io/mohammed-afify/student-login.html"
    Write-Host "Student password setup: $RedirectUrl"
    Write-Host "Before inviting students, sign in as the approved admin and send one invitation to an email address you control."
}
catch {
    Write-Error $_
    throw
}
finally {
    if ($tempEnvFile -and (Test-Path $tempEnvFile)) {
        Remove-Item -LiteralPath $tempEnvFile -Force -ErrorAction SilentlyContinue
    }
    Pop-Location
}
