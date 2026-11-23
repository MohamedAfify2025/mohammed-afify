#requires -Version 5.1
<#
.SYNOPSIS
  Configure and deploy the student invitation Edge Function to Supabase TEST only.
.DESCRIPTION
  Writes a local, gitignored Publishable-key browser config for testing, sets only
  ALLOWED_ORIGINS and STUDENT_INVITE_REDIRECT_URL, and deploys one Edge Function.
  It does not run SQL, create an admin account, invite students, or deploy to LIVE.
#>
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ExpectedBranch = "feature/student-invitations-and-login-2026-11-23"
$KnownSiteProjectRef = "ybsjnubrswqksvktgmay"
$FunctionName = "admin-create-student-invitations"

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

$repoRoot = Split-Path -Parent $PSScriptRoot
Push-Location $repoRoot
$tempEnvFile = $null
try {
    Write-Host "Student invitation deployment — TEST only" -ForegroundColor Cyan

    $branch = (& git branch --show-current).Trim()
    if ($branch -ne $ExpectedBranch) {
        Stop-With "Wrong branch '$branch'. Check out '$ExpectedBranch' first."
    }

    & node tests/student-invites.test.mjs
    if ($LASTEXITCODE -ne 0) { Stop-With "Student invitation tests failed." }

    $config = Get-Content -Raw -LiteralPath (Join-Path $repoRoot "supabase/config.toml")
    if ($config -notmatch '(?m)^\[functions\.admin-create-student-invitations\]\s*\r?\nverify_jwt\s*=\s*true\s*$') {
        Stop-With "The invitation Edge Function must have verify_jwt = true."
    }

    $confirmation = Read-Host "Type TEST to confirm you are deploying to an isolated Supabase TEST project"
    if ($confirmation -cne "TEST") { Stop-With "Cancelled: TEST was not confirmed." }

    $projectRef = (Read-Host "Supabase TEST Project Ref").Trim()
    if ($projectRef -notmatch '^[a-z0-9]{20}$') { Stop-With "Invalid Supabase Project Ref." }
    if ($projectRef -eq $KnownSiteProjectRef) {
        Stop-With "Blocked: this is the Supabase project currently configured in the website source. Do not use it for TEST."
    }

    $websiteOriginText = (Read-Host "Exact website origin [http://localhost:5500]").Trim()
    if (-not $websiteOriginText) { $websiteOriginText = "http://localhost:5500" }
    $websiteUri = $null
    if (-not [Uri]::TryCreate($websiteOriginText, [UriKind]::Absolute, [ref]$websiteUri) -or
        @("http", "https") -notcontains $websiteUri.Scheme -or
        $websiteUri.AbsoluteUri.TrimEnd("/") -ne $websiteOriginText.TrimEnd("/") -or
        $websiteOriginText.Contains("*")) {
        Stop-With "Website origin must be one exact http(s) origin without a path or wildcard."
    }
    $websiteOrigin = $websiteUri.GetLeftPart([UriPartial]::Authority)

    $defaultRedirect = $websiteOrigin + "/student-set-password.html"
    $redirectUrl = (Read-Host "Student invite redirect URL [$defaultRedirect]").Trim()
    if (-not $redirectUrl) { $redirectUrl = $defaultRedirect }
    $redirectUri = $null
    if (-not [Uri]::TryCreate($redirectUrl, [UriKind]::Absolute, [ref]$redirectUri) -or
        $redirectUri.GetLeftPart([UriPartial]::Authority) -ne $websiteOrigin -or
        -not $redirectUri.AbsolutePath.EndsWith("/student-set-password.html")) {
        Stop-With "Redirect URL must use the exact configured website origin and end with /student-set-password.html."
    }

    $publishableSecure = Read-Host -Prompt 'Supabase TEST Publishable Key' -AsSecureString
    $publishableKey = (Convert-SecureStringToPlainText $publishableSecure).Trim()
    if (-not (Test-SupabasePublicKey $publishableKey)) {
        Stop-With "Rejected key. Enter sb_publishable_... or a legacy JWT with role=anon. Secret/service_role keys are blocked."
    }
    $supabaseUrl = "https://$projectRef.supabase.co"

    Write-Host "Checking Supabase REST endpoint..."
    try {
        $headers = @{ apikey = $publishableKey }
        $null = Invoke-RestMethod -Method GET -Uri "$supabaseUrl/auth/v1/settings" -Headers $headers -TimeoutSec 30
    }
    catch {
        Stop-With "Could not verify the TEST Supabase URL/key pair. Check the project ref and Publishable Key. Details: $($_.Exception.Message)"
    }

    # Local-only config is ignored by Git and is not included in the Pages artifact.
    $localConfigPath = Join-Path $repoRoot "public-site/assets/js/membership-config.local.js"
    $urlJson = ConvertTo-Json -InputObject $supabaseUrl -Compress
    $keyJson = ConvertTo-Json -InputObject $publishableKey -Compress
    $localJs = "window.MEMBERSHIP_CONFIG = { supabaseUrl: $urlJson, supabasePublishableKey: $keyJson };"
    [IO.File]::WriteAllText($localConfigPath, $localJs, [Text.UTF8Encoding]::new($false))
    Write-Host "Created gitignored local TEST browser config." -ForegroundColor Green

    Write-Host ""
    Write-Host "Supabase Auth URL Configuration must include this exact Redirect URL:" -ForegroundColor Yellow
    Write-Host $redirectUrl -ForegroundColor Yellow
    Write-Host "If this URL is not allowlisted in Auth > URL Configuration, invitation links will not redirect correctly."

    Write-Host ""
    Write-Host "Supabase CLI login..."
    Invoke-SupabaseCli @("login")

    $tempEnvFile = Join-Path ([IO.Path]::GetTempPath()) ("student-invites-" + [Guid]::NewGuid().ToString("N") + ".env")
    $envLines = @(
        "ALLOWED_ORIGINS='$websiteOrigin'"
        "STUDENT_INVITE_REDIRECT_URL='$redirectUrl'"
    )
    [IO.File]::WriteAllLines($tempEnvFile, $envLines, [Text.UTF8Encoding]::new($false))
    try {
        Invoke-SupabaseCli @("secrets", "set", "--project-ref", $projectRef, "--env-file", $tempEnvFile)
    }
    finally {
        if (Test-Path $tempEnvFile) { Remove-Item -LiteralPath $tempEnvFile -Force }
        $tempEnvFile = $null
    }

    Write-Host "Deploying only $FunctionName to TEST..."
    Invoke-SupabaseCli @("functions", "deploy", $FunctionName, "--project-ref", $projectRef, "--use-api")

    Write-Host ""
    Write-Host "Deployment command completed." -ForegroundColor Green
    Write-Host "No SQL was executed and no LIVE project was changed."
    Write-Host "Local browser config: public-site/assets/js/membership-config.local.js (gitignored)"
    Write-Host "Local admin page: $websiteOrigin/admin-students.html"
    Write-Host "Student login page: $websiteOrigin/student-login.html"
    Write-Host ""
    Write-Host "Before sending real invitations, confirm: V2 admin profile exists (role=admin, status=approved, account_state=active), the is_platform_admin RPC works, and Supabase Auth email delivery is configured."
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
